import { describe, expect, it } from 'vitest';
import type { CpmResult } from '../cpmTypes';
import {
  computeLevelThreeGanttWorkspaceSummary,
  formatLevelThreeGanttWorkspaceSummary,
} from '../levelThreeGanttWorkspaceSummary';

describe('levelThreeGanttWorkspaceSummary', () => {
  it('formats schedule summary from CPM and histogram inputs', () => {
    const cpmResult = {
      hasRunCpm: true,
      hasValidCriticalPath: true,
      validCriticalPathActivityCodes: ['A'],
      projectDurationDays: 124,
      activities: [
        { activityCode: 'A', isCritical: true, totalFloat: 0 },
        { activityCode: 'B', isCritical: false, totalFloat: 2 },
      ],
    } as unknown as CpmResult;

    const summary = computeLevelThreeGanttWorkspaceSummary(
      [
        { activityCode: 'A', activityDescription: 'A', durationDays: 5 },
        { activityCode: 'B', activityDescription: 'B', durationDays: 3 },
      ],
      cpmResult,
      [
        {
          dayOffset: 0,
          requiredCrew: 33,
          availableCrew: 7,
          isOverallocated: true,
        },
        {
          dayOffset: 1,
          requiredCrew: 10,
          availableCrew: 7,
          isOverallocated: true,
        },
      ] as never[],
    );

    expect(summary.projectDurationDays).toBe(124);
    expect(summary.activityCount).toBe(2);
    expect(summary.criticalActivityCount).toBe(1);
    expect(summary.peakCrew).toBe(33);
    expect(summary.availableCrew).toBe(7);
    expect(summary.overallocatedDays).toBe(2);

    expect(formatLevelThreeGanttWorkspaceSummary(summary)).toContain('124d');
    expect(formatLevelThreeGanttWorkspaceSummary(summary)).toContain('Peak: 33');
    expect(formatLevelThreeGanttWorkspaceSummary(summary)).toContain('Over: 2d');
  });
});
