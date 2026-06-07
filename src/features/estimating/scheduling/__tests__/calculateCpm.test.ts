import { describe, expect, it } from 'vitest';
import { calculateCpm } from '../cpm/calculateCpm';
import type { ScheduleActivity } from '../adapters/estimateLineItemsToScheduleActivities';
import type { CpmLogicLink } from '../cpmTypes';

function makeActivity(
  activityCode: string,
  durationDays: number = 3,
): ScheduleActivity {
  return {
    activityCode,
    activityDescription: activityCode,
    divisionCode: '01',
    divisionName: 'General',
    durationDays,
    laborHours: 24,
    manDays: 3,
    crewDays: 3,
    crewSize: 2,
    totalCost: 1000,
    relationshipType: 'FS',
    lagDays: 0,
  };
}

function fs(pred: string, succ: string, lag = 0): CpmLogicLink {
  return { predecessorActivityCode: pred, successorActivityCode: succ, relationshipType: 'FS', lagDays: lag };
}
function ss(pred: string, succ: string, lag = 0): CpmLogicLink {
  return { predecessorActivityCode: pred, successorActivityCode: succ, relationshipType: 'SS', lagDays: lag };
}
function ff(pred: string, succ: string, lag = 0): CpmLogicLink {
  return { predecessorActivityCode: pred, successorActivityCode: succ, relationshipType: 'FF', lagDays: lag };
}

describe('calculateCpm', () => {
  it('returns empty result when no activities given', () => {
    const result = calculateCpm({ activities: [], logicLinks: [] });
    expect(result.activities).toHaveLength(0);
    expect(result.projectDurationDays).toBe(0);
  });

  it('assigns ES=0 and EF=duration for a single activity', () => {
    const result = calculateCpm({ activities: [makeActivity('A', 5)], logicLinks: [] });
    expect(result.activities).toHaveLength(1);
    const a = result.activities[0];
    expect(a.earlyStart).toBe(0);
    expect(a.earlyFinish).toBe(5);
    expect(a.totalFloat).toBe(0);
    expect(a.isCritical).toBe(true);
    expect(result.projectDurationDays).toBe(5);
  });

  it('computes FS forward pass for a chain A→B→C', () => {
    const activities = [makeActivity('A', 3), makeActivity('B', 4), makeActivity('C', 2)];
    const links: CpmLogicLink[] = [fs('A', 'B'), fs('B', 'C')];
    const result = calculateCpm({ activities, logicLinks: links });
    const byCode = new Map(result.activities.map((a) => [a.activityCode, a]));
    expect(byCode.get('A')!.earlyStart).toBe(0);
    expect(byCode.get('A')!.earlyFinish).toBe(3);
    expect(byCode.get('B')!.earlyStart).toBe(3);
    expect(byCode.get('B')!.earlyFinish).toBe(7);
    expect(byCode.get('C')!.earlyStart).toBe(7);
    expect(byCode.get('C')!.earlyFinish).toBe(9);
    expect(result.projectDurationDays).toBe(9);
  });

  it('marks all activities on the critical path as critical', () => {
    const activities = [makeActivity('A', 3), makeActivity('B', 4), makeActivity('C', 2)];
    const links: CpmLogicLink[] = [fs('A', 'B'), fs('B', 'C')];
    const result = calculateCpm({ activities, logicLinks: links });
    for (const act of result.activities) {
      expect(act.isCritical).toBe(true);
      expect(act.totalFloat).toBe(0);
    }
  });

  it('gives float to non-critical parallel branch', () => {
    // A(5) has two successors: B(2) and C(3). No link between B and C.
    // Project ends at max(B.EF, C.EF) = max(7, 8) = 8.
    // Critical path: A→C (8 days). B has TF = 1.
    const activities = [makeActivity('A', 5), makeActivity('B', 2), makeActivity('C', 3)];
    const links: CpmLogicLink[] = [fs('A', 'B'), fs('A', 'C')];
    const result = calculateCpm({ activities, logicLinks: links });
    const byCode = new Map(result.activities.map((a) => [a.activityCode, a]));
    expect(result.projectDurationDays).toBe(8);
    expect(byCode.get('B')!.totalFloat).toBeGreaterThan(0);
    expect(byCode.get('B')!.isCritical).toBe(false);
    expect(byCode.get('C')!.isCritical).toBe(true);
  });

  it('respects FS lag in forward pass', () => {
    const activities = [makeActivity('A', 3), makeActivity('B', 2)];
    const links: CpmLogicLink[] = [fs('A', 'B', 2)];
    const result = calculateCpm({ activities, logicLinks: links });
    const byCode = new Map(result.activities.map((a) => [a.activityCode, a]));
    // B.ES = A.EF + lag = 3 + 2 = 5
    expect(byCode.get('B')!.earlyStart).toBe(5);
    expect(byCode.get('B')!.earlyFinish).toBe(7);
  });

  it('computes SS relationship correctly', () => {
    const activities = [makeActivity('A', 5), makeActivity('B', 3)];
    const links: CpmLogicLink[] = [ss('A', 'B', 1)];
    const result = calculateCpm({ activities, logicLinks: links });
    const byCode = new Map(result.activities.map((a) => [a.activityCode, a]));
    // B.ES >= A.ES + lag = 0 + 1 = 1
    expect(byCode.get('B')!.earlyStart).toBe(1);
    expect(byCode.get('B')!.earlyFinish).toBe(4);
  });

  it('computes FF relationship correctly', () => {
    const activities = [makeActivity('A', 5), makeActivity('B', 3)];
    const links: CpmLogicLink[] = [ff('A', 'B', 0)];
    const result = calculateCpm({ activities, logicLinks: links });
    const byCode = new Map(result.activities.map((a) => [a.activityCode, a]));
    // B.EF >= A.EF + lag = 5 → B.ES = 5 - 3 = 2
    expect(byCode.get('B')!.earlyStart).toBe(2);
    expect(byCode.get('B')!.earlyFinish).toBe(5);
  });

  it('warns and does not crash on cycle', () => {
    const activities = [makeActivity('A', 2), makeActivity('B', 2)];
    const links: CpmLogicLink[] = [fs('A', 'B'), fs('B', 'A')];
    const result = calculateCpm({ activities, logicLinks: links });
    expect(result.warnings.some((w) => w.toLowerCase().includes('circular'))).toBe(true);
  });

  it('warns on missing predecessor code', () => {
    const activities = [makeActivity('A', 2)];
    const links: CpmLogicLink[] = [fs('MISSING', 'A')];
    const result = calculateCpm({ activities, logicLinks: links });
    expect(result.warnings.some((w) => w.includes('MISSING'))).toBe(true);
  });

  it('computes backward pass and TF correctly', () => {
    // A(2) → B(3), B is the last activity
    const activities = [makeActivity('A', 2), makeActivity('B', 3)];
    const links: CpmLogicLink[] = [fs('A', 'B')];
    const result = calculateCpm({ activities, logicLinks: links });
    const byCode = new Map(result.activities.map((a) => [a.activityCode, a]));
    // Project duration = 5
    // B: LF = 5, LS = 2, TF = 2 - 2 = 0 → critical
    expect(byCode.get('B')!.lateFinish).toBe(5);
    expect(byCode.get('B')!.lateStart).toBe(2);
    expect(byCode.get('B')!.totalFloat).toBe(0);
    // A: LF = B.LS = 2, LS = 0, TF = 0 → critical
    expect(byCode.get('A')!.lateFinish).toBe(2);
    expect(byCode.get('A')!.totalFloat).toBe(0);
  });

  it('returns correct criticalPathActivityCodes', () => {
    const activities = [makeActivity('A', 3), makeActivity('B', 4), makeActivity('C', 2)];
    const links: CpmLogicLink[] = [fs('A', 'B'), fs('B', 'C')];
    const result = calculateCpm({ activities, logicLinks: links });
    expect(result.criticalPathActivityCodes.sort()).toEqual(['A', 'B', 'C']);
  });

  it('marks only totalFloat === 0 activities as critical', () => {
    const activities = [makeActivity('A', 5), makeActivity('B', 2), makeActivity('C', 3)];
    const links: CpmLogicLink[] = [fs('A', 'B'), fs('A', 'C')];
    const result = calculateCpm({ activities, logicLinks: links });
    const byCode = new Map(result.activities.map((a) => [a.activityCode, a]));

    expect(byCode.get('B')!.totalFloat).toBeGreaterThan(0);
    expect(byCode.get('B')!.isCritical).toBe(false);
    expect(byCode.get('A')!.totalFloat).toBe(0);
    expect(byCode.get('C')!.totalFloat).toBe(0);
    expect(byCode.get('A')!.isCritical).toBe(true);
    expect(byCode.get('C')!.isCritical).toBe(true);
  });

  it('computes total float as both LS - ES and LF - EF', () => {
    const activities = [makeActivity('A', 2), makeActivity('B', 3)];
    const links: CpmLogicLink[] = [fs('A', 'B')];
    const result = calculateCpm({ activities, logicLinks: links });

    for (const activity of result.activities) {
      expect(activity.totalFloat).toBe(activity.lateStart - activity.earlyStart);
      expect(activity.totalFloat).toBe(activity.lateFinish - activity.earlyFinish);
    }
  });

  it('does not expose a display-critical path when logic links are missing', () => {
    const activities = [makeActivity('A', 5), makeActivity('B', 5)];
    const result = calculateCpm({ activities, logicLinks: [] });

    expect(result.activities.every((activity) => activity.isCritical)).toBe(true);
    expect(result.hasValidCriticalPath).toBe(false);
    expect(result.displayCriticalActivityCodes).toEqual([]);
    expect(result.criticalPathStatus).toBe('missing-logic');
    expect(
      result.warnings.some((warning) => warning.includes('No logic links exist')),
    ).toBe(true);
  });

  it('does not warn when critical path is a continuous linked chain', () => {
    const activities = [makeActivity('A', 3), makeActivity('B', 4), makeActivity('C', 2)];
    const links: CpmLogicLink[] = [fs('A', 'B'), fs('B', 'C')];
    const result = calculateCpm({ activities, logicLinks: links });

    expect(
      result.warnings.some((warning) => warning.toLowerCase().includes('critical path')),
    ).toBe(false);
  });
});
