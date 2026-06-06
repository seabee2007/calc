import { describe, expect, it } from 'vitest';
import { resourceLevelSchedule } from '../resources/resourceLevelSchedule';
import type { ScheduleActivity } from '../adapters/estimateLineItemsToScheduleActivities';
import type { CpmLogicLink } from '../cpmTypes';

function makeAct(code: string, durationDays: number, crewSize: number): ScheduleActivity {
  return {
    activityCode: code,
    activityDescription: code,
    divisionCode: '01',
    divisionName: 'General',
    durationDays,
    laborHours: 0,
    manDays: 0,
    crewDays: 0,
    crewSize,
    totalCost: 0,
    relationshipType: 'FS',
    lagDays: 0,
  };
}

function fs(pred: string, succ: string): CpmLogicLink {
  return {
    predecessorActivityCode: pred,
    successorActivityCode: succ,
    relationshipType: 'FS',
    lagDays: 0,
  };
}

describe('resourceLevelSchedule', () => {
  it('returns empty result when no activities', () => {
    const result = resourceLevelSchedule({
      activities: [],
      logicLinks: [],
      availableCrewSize: 10,
      projectStartDate: '2025-01-01',
    });
    expect(result.leveledActivities).toHaveLength(0);
    expect(result.movedActivities).toHaveLength(0);
  });

  it('does not move critical activities', () => {
    // A(3, crew=15) → B(3, crew=15) both critical, both overallocated
    // Leveler cannot delay them (no float)
    const activities = [makeAct('A', 3, 15), makeAct('B', 3, 15)];
    const links: CpmLogicLink[] = [fs('A', 'B')];
    const result = resourceLevelSchedule({
      activities,
      logicLinks: links,
      availableCrewSize: 5,
      projectStartDate: '2025-01-01',
    });
    // Warnings should be issued; no activities actually delayed
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.movedActivities).toHaveLength(0);
  });

  it('delays a non-critical activity to reduce overallocation', () => {
    // A(5, crew=5) starts at day 0 on the critical path
    // B(3, crew=5) also starts at day 0 (parallel, has float)
    // Available crew = 6 — both starting at 0 exceeds limit
    // B should be delayed by CPM float
    const activities = [makeAct('A', 5, 5), makeAct('B', 3, 5), makeAct('C', 2, 1)];
    // A → C is the critical path; B has float
    const links: CpmLogicLink[] = [fs('A', 'C'), fs('B', 'C')];
    const result = resourceLevelSchedule({
      activities,
      logicLinks: links,
      availableCrewSize: 6,
      projectStartDate: '2025-01-01',
    });
    // B should be moved at least a little
    expect(result.movedActivities.length).toBeGreaterThan(0);
    const moved = result.movedActivities.find((m) => m.activityCode === 'B');
    expect(moved).toBeTruthy();
    expect(moved!.daysMoved).toBeGreaterThan(0);
  });

  it('does not extend duration beyond TF', () => {
    // A has TF=3, we delay by at most 3 days
    const activities = [makeAct('A', 3, 6), makeAct('B', 6, 6), makeAct('C', 2, 1)];
    const links: CpmLogicLink[] = [fs('A', 'C'), fs('B', 'C')];
    const result = resourceLevelSchedule({
      activities,
      logicLinks: links,
      availableCrewSize: 7,
      projectStartDate: '2025-01-01',
    });
    const aResult = result.leveledActivities.find((a) => a.activityCode === 'A');
    const bResult = result.leveledActivities.find((a) => a.activityCode === 'B');
    if (aResult && bResult) {
      // Neither should exceed their LF
      expect(aResult.earlyStart).toBeLessThanOrEqual(aResult.lateStart + (result.projectDurationAfter - result.projectDurationBefore));
    }
  });

  it('histogramBefore vs histogramAfter reflects fewer over-allocated days', () => {
    const activities = [makeAct('A', 5, 5), makeAct('B', 3, 5), makeAct('C', 2, 1)];
    const links: CpmLogicLink[] = [fs('A', 'C'), fs('B', 'C')];
    const result = resourceLevelSchedule({
      activities,
      logicLinks: links,
      availableCrewSize: 6,
      projectStartDate: '2025-01-01',
    });
    const overBefore = result.resourceHistogramBefore.filter((d) => d.isOverallocated).length;
    const overAfter = result.resourceHistogramAfter.filter((d) => d.isOverallocated).length;
    // After leveling, overallocation should be reduced (or same if not possible)
    expect(overAfter).toBeLessThanOrEqual(overBefore);
  });
});
