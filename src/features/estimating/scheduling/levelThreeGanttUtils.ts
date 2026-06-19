import { addDaysToScheduleDate } from '../application/mapScheduleCandidateToScheduleEventInput';
import type { ScheduleActivity } from './adapters/estimateLineItemsToScheduleActivities';
import { isDisplayCritical, resolveTopologyLabel } from './cpm/cpmDisplayCritical';
import type { CpmActivityResult, CpmResult } from './cpmTypes';
import { DAY_WIDTH, getLocalDateYmd } from './levelThreeGanttGrid';

/** @deprecated Use DAY_WIDTH from levelThreeGanttGrid */
export const LEVEL_THREE_DAY_COL_WIDTH_PX = DAY_WIDTH;

export interface TimelineDay {
  dayOffset: number;
  date: string;
  dayOfMonth: number;
  monthLabel: string;
  isToday: boolean;
  isWeekend: boolean;
}

export interface TimelineMonthSegment {
  monthLabel: string;
  startDayOffset: number;
  dayCount: number;
}

export interface LevelThreeGanttRow {
  activity: ScheduleActivity;
  cpm: CpmActivityResult;
  plannedStart: string;
  plannedFinish: string;
  leveledOffset: number;
}

export function buildTimelineDays(
  projectStartDate: string,
  projectDurationDays: number,
  todayYmd?: string,
): TimelineDay[] {
  const today = todayYmd ?? getLocalDateYmd();
  const days: TimelineDay[] = [];

  for (let dayOffset = 0; dayOffset < projectDurationDays; dayOffset += 1) {
    const date = addDaysToScheduleDate(projectStartDate, dayOffset);
    const parsed = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    const dayOfMonth = parsed ? Number(parsed[3]) : dayOffset + 1;
    const dateObj = new Date(`${date}T00:00:00`);
    const monthLabel = Number.isFinite(dateObj.getTime())
      ? dateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase()
      : '';
    const dayOfWeek = dateObj.getDay();

    days.push({
      dayOffset,
      date,
      dayOfMonth,
      monthLabel,
      isToday: date === today,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
    });
  }
  return days;
}

export function buildTimelineMonthSegments(days: TimelineDay[]): TimelineMonthSegment[] {
  if (days.length === 0) return [];
  const segments: TimelineMonthSegment[] = [];
  let current = days[0].monthLabel;
  let start = 0;
  let count = 0;

  for (const day of days) {
    if (day.monthLabel !== current) {
      segments.push({ monthLabel: current, startDayOffset: start, dayCount: count });
      current = day.monthLabel;
      start = day.dayOffset;
      count = 1;
    } else {
      count += 1;
    }
  }
  segments.push({ monthLabel: current, startDayOffset: start, dayCount: count });
  return segments;
}

export function getLevelThreeGanttRows(
  activities: ScheduleActivity[],
  cpmResult: CpmResult,
  projectStartDate: string,
  leveledOffsets: Record<string, number> = {},
): LevelThreeGanttRow[] {
  const actByCode = new Map(activities.map((a) => [a.activityCode, a]));
  const unsortedRows = cpmResult.activities
    .map((cpm) => {
      const activity = actByCode.get(cpm.activityCode);
      if (!activity) return null;
      const leveledOffset = leveledOffsets[cpm.activityCode] ?? 0;
      const es = cpm.earlyStart + leveledOffset;
      const ef = es + activity.durationDays;
      return {
        activity,
        cpm,
        plannedStart: addDaysToScheduleDate(projectStartDate, es),
        plannedFinish: addDaysToScheduleDate(projectStartDate, ef - 1),
        leveledOffset,
      };
    })
    .filter((row): row is LevelThreeGanttRow => row !== null);

  return unsortedRows.sort((left, right) => {
    const leftStart = left.cpm.earlyStart + left.leveledOffset;
    const rightStart = right.cpm.earlyStart + right.leveledOffset;
    if (leftStart !== rightStart) return leftStart - rightStart;
    return left.activity.activityCode.localeCompare(right.activity.activityCode);
  });
}

export type GanttCellKind = 'critical' | 'noncritical' | 'float' | 'empty';

export function resolveGanttCellKind(
  dayOffset: number,
  row: LevelThreeGanttRow,
  cpmResult: CpmResult | null,
): GanttCellKind {
  const es = row.cpm.earlyStart + row.leveledOffset;
  const ef = es + row.activity.durationDays;
  const tf = Math.max(0, row.cpm.totalFloat - row.leveledOffset);
  const floatEnd = ef + tf;
  const displayCritical =
    (cpmResult != null && isDisplayCritical(cpmResult, row.activity.activityCode)) ||
    (row.leveledOffset > 0 && tf === 0);

  if (dayOffset >= es && dayOffset < ef) {
    return displayCritical ? 'critical' : 'noncritical';
  }
  if (tf > 0 && dayOffset >= ef && dayOffset < floatEnd) {
    return 'float';
  }
  return 'empty';
}

export function resolveGanttRowCodeClassName(
  row: LevelThreeGanttRow,
  cpmResult: CpmResult | null,
): string {
  const adjustedFloat = Math.max(0, row.cpm.totalFloat - row.leveledOffset);
  if (
    (cpmResult && isDisplayCritical(cpmResult, row.activity.activityCode)) ||
    (row.leveledOffset > 0 && adjustedFloat === 0)
  ) {
    return 'text-red-600 dark:text-red-400';
  }

  if (
    cpmResult &&
    resolveTopologyLabel(cpmResult, row.activity.activityCode, adjustedFloat === 0)
  ) {
    return 'text-amber-600 dark:text-amber-400';
  }

  return 'text-slate-700 dark:text-slate-300';
}
