import type { LevelThreeGanttRow } from './levelThreeGanttUtils';

/** Shared layout constants — used by UI, export, and tests. */
export const DAY_WIDTH = 32;
export const ROW_HEIGHT = 42;
export const HEADER_MONTH_HEIGHT = 28;
export const HEADER_DAY_HEIGHT = 28;

export const CODE_COLUMN_WIDTH = 110;
export const DESCRIPTION_COLUMN_WIDTH = 330;
export const FLOAT_COLUMN_WIDTH = 80;
export const LEFT_TABLE_WIDTH =
  CODE_COLUMN_WIDTH + DESCRIPTION_COLUMN_WIDTH + FLOAT_COLUMN_WIDTH;

export const LEFT_TABLE_HEADERS = ['CODE', 'DESCRIPTION', 'FLOAT'] as const;

/** Shared day-cell width for header cells and grid math. */
export const DAY_CELL_WIDTH = DAY_WIDTH;

/** Layout region markers — timeline gridlines must stay inside the timeline region. */
export const GANTT_LEFT_TABLE_REGION_ATTR = 'data-level-three-gantt-left-table';
export const GANTT_TIMELINE_REGION_ATTR = 'data-level-three-gantt-timeline';

/** Solid divider borders for the FLOAT header (stronger left, cyan timeline seam on right). */
export const FLOAT_COLUMN_HEADER_BORDER_STYLE = {
  borderLeft: '1px solid rgba(148, 163, 184, 0.55)',
  borderRight: '2px solid rgba(6, 182, 212, 0.75)',
} as const;

/** Solid divider borders for FLOAT body cells (cyan right edge marks timeline origin). */
export const FLOAT_COLUMN_CELL_BORDER_STYLE = {
  borderLeft: '1px solid rgba(148, 163, 184, 0.35)',
  borderRight: '2px solid rgba(6, 182, 212, 0.75)',
} as const;

/** Text layout for the FLOAT left-table column. */
export const FLOAT_COLUMN_CLASS = 'box-border flex items-center justify-center tabular-nums';

export const MIN_BAR_WIDTH_PX = 8;

export interface ActivityBarLayout {
  barLeft: number;
  barWidth: number;
  floatLeft: number;
  floatWidth: number;
  earlyStart: number;
  earlyFinish: number;
  totalFloat: number;
}

export function leftTableGridTemplateColumns(): string {
  return `${CODE_COLUMN_WIDTH}px ${DESCRIPTION_COLUMN_WIDTH}px ${FLOAT_COLUMN_WIDTH}px`;
}

export function dayOffsetToX(dayOffset: number): number {
  return dayOffset * DAY_WIDTH;
}

export function dayCellLeftPx(dayOffset: number): number {
  return dayOffsetToX(dayOffset);
}

export function dayCellWidthPx(): number {
  return DAY_CELL_WIDTH;
}

export function timelineWidthPx(projectDurationDays: number): number {
  return projectDurationDays * DAY_WIDTH;
}

export function monthSegmentWidthPx(dayCount: number): number {
  return dayCount * DAY_WIDTH;
}

export function computeTodayDayOffset(
  projectStartDate: string,
  todayYmd: string,
  projectDurationDays: number,
): number | null {
  const startMs = Date.parse(`${projectStartDate}T00:00:00Z`);
  const todayMs = Date.parse(`${todayYmd}T00:00:00Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(todayMs)) return null;
  const offset = Math.round((todayMs - startMs) / 86_400_000);
  if (offset < 0 || offset >= projectDurationDays) return null;
  return offset;
}

export function todayLineLeftPx(todayDayOffset: number): number {
  return dayOffsetToX(todayDayOffset);
}

/** Half-open interval [ES, EF): bar occupies ES..EF-1 day cells. */
export function computeActivityBarLayout(row: LevelThreeGanttRow): ActivityBarLayout {
  const earlyStart = row.cpm.earlyStart + row.leveledOffset;
  const earlyFinish = earlyStart + row.activity.durationDays;
  const totalFloat = Math.max(0, row.cpm.totalFloat - row.leveledOffset);

  return {
    earlyStart,
    earlyFinish,
    totalFloat,
    barLeft: dayOffsetToX(earlyStart),
    barWidth: Math.max(row.activity.durationDays * DAY_WIDTH, MIN_BAR_WIDTH_PX),
    floatLeft: dayOffsetToX(earlyFinish),
    floatWidth: totalFloat * DAY_WIDTH,
  };
}

export function formatEstimatedFloat(totalFloat: number): string {
  return `${totalFloat}d`;
}

export function assertGanttGridInvariants(
  projectDurationDays: number,
  timelineWidth: number,
  rowCount: number,
  barLayouts: ActivityBarLayout[],
): void {
  if (!import.meta.env.DEV) return;

  const expectedWidth = timelineWidthPx(projectDurationDays);
  if (timelineWidth !== expectedWidth) {
    console.warn(
      `[Level III Gantt] timelineWidth mismatch: got ${timelineWidth}, expected ${expectedWidth}`,
    );
  }

  for (const layout of barLayouts) {
    if (layout.barLeft % DAY_WIDTH !== 0) {
      console.warn(
        `[Level III Gantt] barLeft ${layout.barLeft} not aligned to DAY_WIDTH grid`,
      );
    }
    if (layout.floatLeft % DAY_WIDTH !== 0) {
      console.warn(
        `[Level III Gantt] floatLeft ${layout.floatLeft} not aligned to DAY_WIDTH grid`,
      );
    }
  }

  void rowCount;
  void ROW_HEIGHT;
}
