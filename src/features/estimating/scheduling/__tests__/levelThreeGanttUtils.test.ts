import { describe, expect, it } from 'vitest';
import {
  buildTimelineDays,
  buildTimelineMonthSegments,
  resolveGanttCellKind,
  getLevelThreeGanttRows,
} from '../levelThreeGanttUtils';
import type { ScheduleActivity } from '../adapters/estimateLineItemsToScheduleActivities';
import type { CpmResult } from '../cpmTypes';

function makeActivity(code: string, duration = 3): ScheduleActivity {
  return {
    activityCode: code,
    activityDescription: code,
    divisionCode: '01',
    divisionName: 'General',
    durationDays: duration,
    laborHours: 0,
    manDays: 0,
    crewDays: 0,
    crewSize: 2,
    totalCost: 0,
    relationshipType: 'FS',
    lagDays: 0,
  };
}

const sampleCpm: CpmResult = {
  activities: [
    {
      activityCode: 'A',
      earlyStart: 0,
      earlyFinish: 3,
      lateStart: 0,
      lateFinish: 3,
      totalFloat: 0,
      freeFloat: 0,
      isCritical: true,
    },
    {
      activityCode: 'B',
      earlyStart: 3,
      earlyFinish: 5,
      lateStart: 5,
      lateFinish: 7,
      totalFloat: 2,
      freeFloat: 2,
      isCritical: false,
    },
  ],
  projectDurationDays: 5,
  criticalPathActivityCodes: ['A'],
  warnings: [],
};

describe('levelThreeGanttUtils', () => {
  it('buildTimelineDays renders day numbers with isToday and isWeekend', () => {
    const days = buildTimelineDays('2026-06-06', 5, '2026-06-06');
    expect(days).toHaveLength(5);
    expect(days[0].dayOfMonth).toBe(6);
    expect(days[1].dayOfMonth).toBe(7);
    expect(days[0].monthLabel).toBe('JUN');
    expect(days[0].isToday).toBe(true);
    expect(days[1].isToday).toBe(false);
    expect(typeof days[0].isWeekend).toBe('boolean');
  });

  it('buildTimelineMonthSegments groups days by month', () => {
    const days = buildTimelineDays('2026-06-28', 6);
    const segments = buildTimelineMonthSegments(days);
    expect(segments.length).toBeGreaterThanOrEqual(2);
    expect(segments[0].monthLabel).toBe('JUN');
    expect(segments[1].monthLabel).toBe('JUL');
  });

  it('resolveGanttCellKind marks critical duration cells', () => {
    const rows = getLevelThreeGanttRows(
      [makeActivity('A'), makeActivity('B', 2)],
      sampleCpm,
      '2026-06-06',
    );
    const criticalRow = rows.find((r) => r.activity.activityCode === 'A')!;
    expect(resolveGanttCellKind(0, criticalRow)).toBe('critical');
    expect(resolveGanttCellKind(2, criticalRow)).toBe('critical');
    expect(resolveGanttCellKind(3, criticalRow)).toBe('empty');
  });

  it('resolveGanttCellKind marks float cells for noncritical activity', () => {
    const rows = getLevelThreeGanttRows(
      [makeActivity('A'), makeActivity('B', 2)],
      sampleCpm,
      '2026-06-06',
    );
    const floatRow = rows.find((r) => r.activity.activityCode === 'B')!;
    expect(resolveGanttCellKind(3, floatRow)).toBe('noncritical');
    expect(resolveGanttCellKind(5, floatRow)).toBe('float');
  });
});
