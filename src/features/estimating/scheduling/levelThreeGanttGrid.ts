import type { LevelThreeGanttRow } from './levelThreeGanttUtils';

/** Shared layout constants — used by UI, export, and tests. */
export const DAY_WIDTH = 32;
export const ROW_HEIGHT = 42;

/** Discrete zoom levels (pixels per day). */
export const ZOOM_LEVELS = [8, 14, 22, 32, 56] as const;
export type ZoomLevel = (typeof ZOOM_LEVELS)[number];

/** Default zoom level used when no pixelsPerDay is provided. */
export const DEFAULT_PIXELS_PER_DAY: ZoomLevel = 22;
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

export function dayOffsetToX(dayOffset: number, pixelsPerDay = DAY_WIDTH): number {
  return dayOffset * pixelsPerDay;
}

export function dayCellLeftPx(dayOffset: number, pixelsPerDay = DAY_WIDTH): number {
  return dayOffsetToX(dayOffset, pixelsPerDay);
}

/** Returns the pixel width of one day cell at the given zoom level. */
export function dayCellWidthPx(pixelsPerDay = DAY_WIDTH): number {
  return pixelsPerDay;
}

export function timelineWidthPx(projectDurationDays: number, pixelsPerDay = DAY_WIDTH): number {
  return projectDurationDays * pixelsPerDay;
}

export function monthSegmentWidthPx(dayCount: number, pixelsPerDay = DAY_WIDTH): number {
  return dayCount * pixelsPerDay;
}

/** Strip time — use local calendar year/month/day only. */
export function toLocalDateOnly(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Parse YYYY-MM-DD as local midnight (no UTC shift). */
export function parseLocalDateYmd(ymd: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(year, month, day);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

/** Local calendar date as YYYY-MM-DD (not UTC). */
export function getLocalDateYmd(date = new Date()): string {
  const local = toLocalDateOnly(date);
  const year = local.getFullYear();
  const month = String(local.getMonth() + 1).padStart(2, '0');
  const day = String(local.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Whole calendar days between two local date-only values. */
export function differenceInCalendarDays(later: Date, earlier: Date): number {
  const msPerDay = 86_400_000;
  return Math.round((later.getTime() - earlier.getTime()) / msPerDay);
}

export function computeTodayDayOffset(
  projectStartDate: string,
  todayYmd: string,
  projectDurationDays: number,
): number | null {
  const projectStart = parseLocalDateYmd(projectStartDate);
  const today = parseLocalDateYmd(todayYmd);
  if (!projectStart || !today) return null;

  const offset = differenceInCalendarDays(today, projectStart);
  if (offset < 0 || offset >= projectDurationDays) return null;
  return offset;
}

export function todayLineLeftPx(todayDayOffset: number, pixelsPerDay = DAY_WIDTH): number {
  return dayOffsetToX(todayDayOffset, pixelsPerDay);
}

/** Half-open interval [ES, EF): bar occupies ES..EF-1 day cells. */
export function computeActivityBarLayout(
  row: LevelThreeGanttRow,
  pixelsPerDay = DAY_WIDTH,
): ActivityBarLayout {
  const earlyStart = row.cpm.earlyStart + row.leveledOffset;
  const earlyFinish = earlyStart + row.activity.durationDays;
  const totalFloat = Math.max(0, row.cpm.totalFloat - row.leveledOffset);

  return {
    earlyStart,
    earlyFinish,
    totalFloat,
    barLeft: dayOffsetToX(earlyStart, pixelsPerDay),
    barWidth: Math.max(row.activity.durationDays * pixelsPerDay, MIN_BAR_WIDTH_PX),
    floatLeft: dayOffsetToX(earlyFinish, pixelsPerDay),
    floatWidth: totalFloat * pixelsPerDay,
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
  pixelsPerDay = DAY_WIDTH,
): void {
  if (!import.meta.env.DEV) return;

  const expectedWidth = timelineWidthPx(projectDurationDays, pixelsPerDay);
  if (timelineWidth !== expectedWidth) {
    console.warn(
      `[Level III Gantt] timelineWidth mismatch: got ${timelineWidth}, expected ${expectedWidth}`,
    );
  }

  for (const layout of barLayouts) {
    if (pixelsPerDay > 0 && layout.barLeft % pixelsPerDay !== 0) {
      console.warn(
        `[Level III Gantt] barLeft ${layout.barLeft} not aligned to pixelsPerDay grid`,
      );
    }
    if (pixelsPerDay > 0 && layout.floatLeft % pixelsPerDay !== 0) {
      console.warn(
        `[Level III Gantt] floatLeft ${layout.floatLeft} not aligned to pixelsPerDay grid`,
      );
    }
  }

  void rowCount;
  void ROW_HEIGHT;
}
