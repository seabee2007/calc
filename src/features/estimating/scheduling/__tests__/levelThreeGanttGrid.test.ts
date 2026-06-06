import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CODE_COLUMN_WIDTH,
  DAY_CELL_WIDTH,
  DAY_WIDTH,
  DESCRIPTION_COLUMN_WIDTH,
  FLOAT_COLUMN_CELL_BORDER_STYLE,
  FLOAT_COLUMN_CLASS,
  FLOAT_COLUMN_HEADER_BORDER_STYLE,
  FLOAT_COLUMN_WIDTH,
  LEFT_TABLE_HEADERS,
  LEFT_TABLE_WIDTH,
  ROW_HEIGHT,
  computeActivityBarLayout,
  computeTodayDayOffset,
  dayCellLeftPx,
  dayCellWidthPx,
  dayOffsetToX,
  formatEstimatedFloat,
  leftTableGridTemplateColumns,
  monthSegmentWidthPx,
  timelineWidthPx,
  todayLineLeftPx,
} from '../levelThreeGanttGrid';
import {
  buildTimelineDays,
  buildTimelineMonthSegments,
  getLevelThreeGanttRows,
} from '../levelThreeGanttUtils';
import type { ScheduleActivity } from '../adapters/estimateLineItemsToScheduleActivities';
import type { CpmResult } from '../cpmTypes';

const levelThreeGanttSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../ui/components/scheduling/LevelThreeGantt.tsx'),
  'utf8',
);

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

describe('levelThreeGanttGrid', () => {
  it('FLOAT header renders exactly as FLOAT', () => {
    expect(LEFT_TABLE_HEADERS).toEqual(['CODE', 'DESCRIPTION', 'FLOAT']);
    expect(LEFT_TABLE_HEADERS[2]).toBe('FLOAT');
    expect(LEFT_TABLE_HEADERS).not.toContain('DUR');
    expect(LEFT_TABLE_HEADERS).not.toContain('START');
    expect(LEFT_TABLE_HEADERS).not.toContain('FINISH');
    expect(LEFT_TABLE_HEADERS).not.toContain('ESTIMATED FLOAT');
  });

  it('left table width equals CODE + DESCRIPTION + FLOAT column widths', () => {
    expect(LEFT_TABLE_WIDTH).toBe(
      CODE_COLUMN_WIDTH + DESCRIPTION_COLUMN_WIDTH + FLOAT_COLUMN_WIDTH,
    );
    expect(leftTableGridTemplateColumns()).toBe(
      `${CODE_COLUMN_WIDTH}px ${DESCRIPTION_COLUMN_WIDTH}px ${FLOAT_COLUMN_WIDTH}px`,
    );
  });

  it('FLOAT column uses solid borders with cyan timeline seam on the right', () => {
    expect(FLOAT_COLUMN_HEADER_BORDER_STYLE.borderLeft).toContain('solid');
    expect(FLOAT_COLUMN_HEADER_BORDER_STYLE.borderRight).toContain('solid');
    expect(FLOAT_COLUMN_HEADER_BORDER_STYLE.borderRight).toContain('rgba(6, 182, 212, 0.75)');
    expect(FLOAT_COLUMN_CELL_BORDER_STYLE.borderLeft).toContain('solid');
    expect(FLOAT_COLUMN_CELL_BORDER_STYLE.borderRight).toContain('solid');
    expect(FLOAT_COLUMN_CELL_BORDER_STYLE.borderRight).toContain('rgba(6, 182, 212, 0.75)');
    expect(FLOAT_COLUMN_HEADER_BORDER_STYLE.borderLeft).not.toContain('dashed');
    expect(FLOAT_COLUMN_CELL_BORDER_STYLE.borderRight).not.toContain('dashed');
    expect(FLOAT_COLUMN_CLASS).not.toContain('dashed');
    expect(FLOAT_COLUMN_CLASS).not.toContain('border-dashed');
  });

  it('timeline day 0 starts at x = 0 inside timeline container', () => {
    expect(dayCellLeftPx(0)).toBe(0);
    expect(dayOffsetToX(0)).toBe(0);
    expect(timelineWidthPx(10)).toBe(10 * DAY_WIDTH);
  });

  it('today/start line equals 0 when first visible day is project start', () => {
    const offset = computeTodayDayOffset('2026-06-06', '2026-06-06', 10);
    expect(offset).toBe(0);
    expect(todayLineLeftPx(offset!)).toBe(0);
  });

  it('blue vertical line position equals dayOffset * DAY_WIDTH', () => {
    const offset = computeTodayDayOffset('2026-06-06', '2026-06-08', 10);
    expect(offset).toBe(2);
    expect(todayLineLeftPx(offset!)).toBe(offset! * DAY_WIDTH);
  });

  it('day cell width equals DAY_WIDTH', () => {
    expect(dayCellWidthPx()).toBe(DAY_WIDTH);
    expect(DAY_CELL_WIDTH).toBe(DAY_WIDTH);
  });

  it('formatEstimatedFloat matches totalFloat from CPM', () => {
    expect(formatEstimatedFloat(0)).toBe('0d');
    expect(formatEstimatedFloat(37)).toBe('37d');
    expect(formatEstimatedFloat(41)).toBe('41d');
  });

  it('activity bar left equals earlyStart * DAY_WIDTH', () => {
    const rows = getLevelThreeGanttRows(
      [makeActivity('A'), makeActivity('B', 2)],
      sampleCpm,
      '2026-06-06',
    );
    const criticalRow = rows.find((r) => r.activity.activityCode === 'A')!;
    const layout = computeActivityBarLayout(criticalRow);
    expect(layout.barLeft).toBe(criticalRow.cpm.earlyStart * DAY_WIDTH);
    expect(layout.barLeft).toBe(0);
  });

  it('activity bar width equals durationDays * DAY_WIDTH', () => {
    const rows = getLevelThreeGanttRows([makeActivity('A')], sampleCpm, '2026-06-06');
    const layout = computeActivityBarLayout(rows[0]);
    expect(layout.barWidth).toBe(rows[0].activity.durationDays * DAY_WIDTH);
  });

  it('float bar left equals earlyFinish * DAY_WIDTH', () => {
    const rows = getLevelThreeGanttRows(
      [makeActivity('A'), makeActivity('B', 2)],
      sampleCpm,
      '2026-06-06',
    );
    const floatRow = rows.find((r) => r.activity.activityCode === 'B')!;
    const layout = computeActivityBarLayout(floatRow);
    const earlyFinish = floatRow.cpm.earlyStart + floatRow.activity.durationDays;
    expect(layout.floatLeft).toBe(earlyFinish * DAY_WIDTH);
  });

  it('float bar width equals totalFloat * DAY_WIDTH', () => {
    const rows = getLevelThreeGanttRows(
      [makeActivity('A'), makeActivity('B', 2)],
      sampleCpm,
      '2026-06-06',
    );
    const floatRow = rows.find((r) => r.activity.activityCode === 'B')!;
    const layout = computeActivityBarLayout(floatRow);
    expect(layout.floatWidth).toBe(2 * DAY_WIDTH);
  });

  it('month header span width equals daysInMonthSegment * DAY_WIDTH', () => {
    const days = buildTimelineDays('2026-06-28', 6);
    const segments = buildTimelineMonthSegments(days);
    expect(monthSegmentWidthPx(segments[0].dayCount)).toBe(segments[0].dayCount * DAY_WIDTH);
    expect(monthSegmentWidthPx(segments[1].dayCount)).toBe(segments[1].dayCount * DAY_WIDTH);
  });

  it('first visible calendar day cell starts at timeline x = 0', () => {
    const days = buildTimelineDays('2026-06-06', 5);
    expect(days[0].dayOfMonth).toBe(6);
    expect(dayCellLeftPx(days[0].dayOffset)).toBe(0);
  });

  it('ROW_HEIGHT is shared constant for schedule grid', () => {
    expect(ROW_HEIGHT).toBe(42);
  });

  it('timeline gridline elements render only inside the timeline container', () => {
    expect(levelThreeGanttSource).toContain('GANTT_TIMELINE_REGION_ATTR');
    expect(levelThreeGanttSource).toContain('GANTT_LEFT_TABLE_REGION_ATTR');
    expect(levelThreeGanttSource).toContain('function TimelineGridlines');
    expect(levelThreeGanttSource).toContain('<TimelineGridlines');

    const gridlinesIndex = levelThreeGanttSource.indexOf('<TimelineGridlines');
    const timelineAttrBeforeGridlines = levelThreeGanttSource.lastIndexOf(
      'GANTT_TIMELINE_REGION_ATTR',
      gridlinesIndex,
    );
    expect(timelineAttrBeforeGridlines).toBeGreaterThan(-1);

    const leftTableSection = levelThreeGanttSource.slice(
      levelThreeGanttSource.indexOf('GANTT_LEFT_TABLE_REGION_ATTR'),
      gridlinesIndex,
    );
    expect(leftTableSection).not.toContain('<TimelineGridlines');
  });
});
