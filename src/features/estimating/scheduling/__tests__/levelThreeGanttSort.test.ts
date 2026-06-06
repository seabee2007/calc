import { describe, expect, it } from 'vitest';
import { calculateCpm } from '../cpm/calculateCpm';
import type { ScheduleActivity } from '../adapters/estimateLineItemsToScheduleActivities';
import type { CpmLogicLink } from '../cpmTypes';

function makeAct(code: string, duration: number): ScheduleActivity {
  return {
    activityCode: code,
    activityDescription: `Activity ${code}`,
    divisionCode: '01',
    divisionName: 'General',
    durationDays: duration,
    laborHours: 0,
    manDays: 0,
    crewDays: 0,
    crewSize: 1,
    totalCost: 0,
    relationshipType: 'FS',
    lagDays: 0,
  };
}

function fs(pred: string, succ: string): CpmLogicLink {
  return { predecessorActivityCode: pred, successorActivityCode: succ, relationshipType: 'FS', lagDays: 0 };
}

describe('Level III Gantt sort order (ES ascending)', () => {
  it('orders activities by earlyStart then activityCode', () => {
    const activities = [makeAct('C', 2), makeAct('A', 3), makeAct('B', 4)];
    const links: CpmLogicLink[] = [fs('A', 'B'), fs('A', 'C')];
    const cpmResult = calculateCpm({ activities, logicLinks: links });

    const sorted = [...cpmResult.activities].sort((left, right) => {
      if (left.earlyStart !== right.earlyStart) return left.earlyStart - right.earlyStart;
      return left.activityCode.localeCompare(right.activityCode);
    });

    expect(sorted[0].activityCode).toBe('A');
    // B and C both start after A; C should come before B alphabetically OR by ES
    const bCpm = cpmResult.activities.find((a) => a.activityCode === 'B')!;
    const cCpm = cpmResult.activities.find((a) => a.activityCode === 'C')!;
    expect(bCpm.earlyStart).toBe(3);
    expect(cCpm.earlyStart).toBe(3);
    // Both at same ES → alphabetical: B before C
    expect(sorted[1].activityCode).toBe('B');
    expect(sorted[2].activityCode).toBe('C');
  });

  it('places critical activities before non-critical when same ES', () => {
    // A(2) → C, B(5) → C, A and B start at 0; C starts after max(A.EF, B.EF)=5
    const activities = [makeAct('A', 2), makeAct('B', 5), makeAct('C', 2)];
    const links: CpmLogicLink[] = [fs('A', 'C'), fs('B', 'C')];
    const cpmResult = calculateCpm({ activities, logicLinks: links });

    const byCode = new Map(cpmResult.activities.map((a) => [a.activityCode, a]));
    // B is critical (longer path to C), A has float
    expect(byCode.get('B')!.isCritical).toBe(true);
    expect(byCode.get('A')!.isCritical).toBe(false);
    expect(byCode.get('C')!.isCritical).toBe(true);
  });
});
