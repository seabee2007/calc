import { describe, expect, it } from 'vitest';
import type { ScheduleActivity } from '../adapters/estimateLineItemsToScheduleActivities';
import { calculateCpm } from '../cpm/calculateCpm';
import type { CpmActivityResult, CpmLogicLink } from '../cpmTypes';

function makeActivity(activityCode: string, durationDays: number): ScheduleActivity {
  return {
    activityCode,
    activityDescription: activityCode,
    divisionCode: '01',
    divisionName: 'General',
    durationDays,
    laborHours: durationDays * 8,
    manDays: durationDays,
    crewDays: durationDays,
    crewSize: 2,
    totalCost: 1000,
    relationshipType: 'FS',
    lagDays: 0,
  };
}

function fs(pred: string, succ: string, lag = 0): CpmLogicLink {
  return {
    predecessorActivityCode: pred,
    successorActivityCode: succ,
    relationshipType: 'FS',
    lagDays: lag,
  };
}

function byCode(result: { activities: CpmActivityResult[] }): Map<string, CpmActivityResult> {
  return new Map(result.activities.map((activity) => [activity.activityCode, activity]));
}

describe('CPM math regression', () => {
  it('1. simple FS chain A→B→C computes forward and backward pass', () => {
    const activities = [makeActivity('A', 2), makeActivity('B', 3), makeActivity('C', 4)];
    const links = [fs('A', 'B'), fs('B', 'C')];
    const result = calculateCpm({ activities, logicLinks: links });
    const map = byCode(result);

    expect(map.get('A')).toMatchObject({ earlyStart: 0, earlyFinish: 2, lateStart: 0, lateFinish: 2, totalFloat: 0 });
    expect(map.get('B')).toMatchObject({ earlyStart: 2, earlyFinish: 5, lateStart: 2, lateFinish: 5, totalFloat: 0 });
    expect(map.get('C')).toMatchObject({ earlyStart: 5, earlyFinish: 9, lateStart: 5, lateFinish: 9, totalFloat: 0 });

    expect(result.projectDurationDays).toBe(9);
    expect(result.criticalPathActivityCodes.sort()).toEqual(['A', 'B', 'C']);
  });

  it('2. parallel paths with one critical path (A→C, B→C)', () => {
    const activities = [makeActivity('A', 5), makeActivity('B', 2), makeActivity('C', 3)];
    const links = [fs('A', 'C'), fs('B', 'C')];
    const result = calculateCpm({ activities, logicLinks: links });
    const map = byCode(result);

    expect(map.get('A')).toMatchObject({ earlyStart: 0, earlyFinish: 5, lateStart: 0, lateFinish: 5, totalFloat: 0 });
    expect(map.get('B')).toMatchObject({ earlyStart: 0, earlyFinish: 2, lateStart: 3, lateFinish: 5, totalFloat: 3 });
    expect(map.get('C')).toMatchObject({ earlyStart: 5, earlyFinish: 8, lateStart: 5, lateFinish: 8, totalFloat: 0 });

    expect(result.projectDurationDays).toBe(8);
    expect(result.criticalPathActivityCodes.sort()).toEqual(['A', 'C']);
    expect(map.get('B')!.isCritical).toBe(false);
  });

  it('3. free float on parallel branch (A→C, B→C)', () => {
    const activities = [makeActivity('A', 5), makeActivity('B', 2), makeActivity('C', 3)];
    const links = [fs('A', 'C'), fs('B', 'C')];
    const result = calculateCpm({ activities, logicLinks: links });
    const map = byCode(result);

    expect(map.get('A')!.freeFloat).toBe(0);
    expect(map.get('B')!.freeFloat).toBe(3);
    expect(map.get('C')!.freeFloat).toBe(0);
  });

  it('4. multiple successors (A→B, A→C, B→D, C→D)', () => {
    const activities = [
      makeActivity('A', 2),
      makeActivity('B', 4),
      makeActivity('C', 6),
      makeActivity('D', 2),
    ];
    const links = [fs('A', 'B'), fs('A', 'C'), fs('B', 'D'), fs('C', 'D')];
    const result = calculateCpm({ activities, logicLinks: links });
    const map = byCode(result);

    expect(map.get('A')).toMatchObject({ earlyStart: 0, earlyFinish: 2, lateStart: 0, lateFinish: 2, totalFloat: 0 });
    expect(map.get('B')).toMatchObject({ earlyStart: 2, earlyFinish: 6, lateStart: 4, lateFinish: 8, totalFloat: 2 });
    expect(map.get('C')).toMatchObject({ earlyStart: 2, earlyFinish: 8, lateStart: 2, lateFinish: 8, totalFloat: 0 });
    expect(map.get('D')).toMatchObject({ earlyStart: 8, earlyFinish: 10, lateStart: 8, lateFinish: 10, totalFloat: 0 });

    expect(map.get('A')!.freeFloat).toBe(0);
    expect(map.get('B')!.freeFloat).toBe(2);
    expect(map.get('C')!.freeFloat).toBe(0);
    expect(map.get('D')!.freeFloat).toBe(0);

    expect(result.projectDurationDays).toBe(10);
    expect(result.criticalPathActivityCodes.sort()).toEqual(['A', 'C', 'D']);
  });

  it('5. disconnected activities do not crash and use project-end backward pass', () => {
    const activities = [makeActivity('A', 3), makeActivity('B', 5)];
    const result = calculateCpm({ activities, logicLinks: [] });
    const map = byCode(result);

    expect(result.activities).toHaveLength(2);
    expect(map.get('A')).toMatchObject({ earlyStart: 0, earlyFinish: 3, lateStart: 2, lateFinish: 5, totalFloat: 2 });
    expect(map.get('B')).toMatchObject({ earlyStart: 0, earlyFinish: 5, lateStart: 0, lateFinish: 5, totalFloat: 0 });
    expect(result.projectDurationDays).toBe(5);
    expect(result.hasValidCriticalPath).toBe(false);
  });

  it('6. cycle detection warns and still returns a result', () => {
    const activities = [makeActivity('A', 2), makeActivity('B', 2), makeActivity('C', 2)];
    const links = [fs('A', 'B'), fs('B', 'C'), fs('C', 'A')];
    const result = calculateCpm({ activities, logicLinks: links });

    expect(result.warnings.some((warning) => warning.toLowerCase().includes('circular'))).toBe(true);
    expect(result.activities).toHaveLength(3);
    expect(result.projectDurationDays).toBeGreaterThan(0);
  });

  it('7. zero-duration milestone on critical path', () => {
    const activities = [makeActivity('A', 3), makeActivity('M', 0), makeActivity('B', 2)];
    const links = [fs('A', 'M'), fs('M', 'B')];
    const result = calculateCpm({ activities, logicLinks: links });
    const map = byCode(result);

    expect(map.get('A')).toMatchObject({ earlyStart: 0, earlyFinish: 3, lateStart: 0, lateFinish: 3, totalFloat: 0 });
    expect(map.get('M')).toMatchObject({ earlyStart: 3, earlyFinish: 3, lateStart: 3, lateFinish: 3, totalFloat: 0 });
    expect(map.get('B')).toMatchObject({ earlyStart: 3, earlyFinish: 5, lateStart: 3, lateFinish: 5, totalFloat: 0 });

    expect(result.criticalPathActivityCodes.sort()).toEqual(['A', 'B', 'M']);
  });
});
