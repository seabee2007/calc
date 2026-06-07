import { describe, expect, it } from 'vitest';
import { calculateCpm } from '../cpm/calculateCpm';
import type { ScheduleActivity } from '../adapters/estimateLineItemsToScheduleActivities';
import type { CpmLogicLink } from '../cpmTypes';
import { validateCriticalPathContinuity } from '../logic/validateCriticalPathContinuity';

function makeActivity(activityCode: string, durationDays: number): ScheduleActivity {
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

function fs(pred: string, succ: string): CpmLogicLink {
  return {
    predecessorActivityCode: pred,
    successorActivityCode: succ,
    relationshipType: 'FS',
    lagDays: 0,
  };
}

describe('validateCriticalPathContinuity', () => {
  it('returns missing-logic when multiple activities have no links', () => {
    const activities = [makeActivity('A', 5), makeActivity('B', 3)];
    const cpm = calculateCpm({ activities, logicLinks: [] });

    expect(cpm.hasValidCriticalPath).toBe(false);
    expect(cpm.criticalPathStatus).toBe('missing-logic');
    expect(cpm.displayCriticalActivityCodes).toEqual([]);
  });

  it('returns valid for a single activity project', () => {
    const activities = [makeActivity('A', 5)];
    const cpm = calculateCpm({ activities, logicLinks: [] });

    expect(cpm.hasValidCriticalPath).toBe(true);
    expect(cpm.criticalPathStatus).toBe('valid');
    expect(cpm.displayCriticalActivityCodes).toEqual(['A']);
  });

  it('returns disconnected when no zero-float path spans project start to finish', () => {
    const disconnected = validateCriticalPathContinuity({
      activities: [
        {
          activityCode: 'A',
          earlyStart: 0,
          earlyFinish: 5,
          lateStart: 0,
          lateFinish: 5,
          totalFloat: 0,
          freeFloat: 0,
          isCritical: true,
        },
        {
          activityCode: 'B',
          earlyStart: 0,
          earlyFinish: 5,
          lateStart: 0,
          lateFinish: 5,
          totalFloat: 0,
          freeFloat: 0,
          isCritical: true,
        },
      ],
      logicLinks: [],
      projectStartDay: 0,
      projectFinish: 5,
      hasCycle: false,
    });

    expect(disconnected.hasValidCriticalPath).toBe(false);
    expect(disconnected.criticalPathStatus).toBe('missing-logic');
  });

  it('returns circular when the network has a cycle', () => {
    const activities = [makeActivity('A', 2), makeActivity('B', 2)];
    const cpm = calculateCpm({ activities, logicLinks: [fs('A', 'B'), fs('B', 'A')] });

    expect(cpm.hasValidCriticalPath).toBe(false);
    expect(cpm.criticalPathStatus).toBe('circular');
    expect(cpm.displayCriticalActivityCodes).toEqual([]);
  });

  it('returns over-constrained when any activity has negative float', () => {
    const result = validateCriticalPathContinuity({
      activities: [
        {
          activityCode: 'A',
          earlyStart: 0,
          earlyFinish: 5,
          lateStart: 0,
          lateFinish: 5,
          totalFloat: 0,
          freeFloat: 0,
          isCritical: true,
        },
        {
          activityCode: 'B',
          earlyStart: 5,
          earlyFinish: 8,
          lateStart: 3,
          lateFinish: 6,
          totalFloat: -2,
          freeFloat: 0,
          isCritical: false,
        },
      ],
      logicLinks: [fs('A', 'B')],
      projectStartDay: 0,
      projectFinish: 8,
      hasCycle: false,
    });

    expect(result.hasValidCriticalPath).toBe(false);
    expect(result.criticalPathStatus).toBe('over-constrained');
    expect(result.displayCriticalActivityCodes).toEqual([]);
  });

  it('returns valid display-critical codes for a continuous zero-float chain', () => {
    const activities = [makeActivity('A', 3), makeActivity('B', 4), makeActivity('C', 2)];
    const cpm = calculateCpm({ activities, logicLinks: [fs('A', 'B'), fs('B', 'C')] });

    expect(cpm.hasValidCriticalPath).toBe(true);
    expect(cpm.criticalPathStatus).toBe('valid');
    expect(cpm.displayCriticalActivityCodes.sort()).toEqual(['A', 'B', 'C']);
  });

  it('does not mark a zero-float branch activity as display-critical when it does not reach finish', () => {
    const activities = [makeActivity('A', 5), makeActivity('B', 2), makeActivity('C', 3)];
    const cpm = calculateCpm({ activities, logicLinks: [fs('A', 'B'), fs('A', 'C')] });

    expect(cpm.hasValidCriticalPath).toBe(true);
    expect(cpm.displayCriticalActivityCodes).toContain('A');
    expect(cpm.displayCriticalActivityCodes).toContain('C');
    expect(cpm.displayCriticalActivityCodes).not.toContain('B');
  });
});
