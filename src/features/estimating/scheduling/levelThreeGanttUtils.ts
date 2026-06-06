import { addDaysToScheduleDate } from '../application/mapScheduleCandidateToScheduleEventInput';
import type { ScheduleActivity } from './adapters/estimateLineItemsToScheduleActivities';
import type { CpmActivityResult, CpmResult } from './cpmTypes';

export const LEVEL_THREE_DAY_COL_WIDTH_PX = 24;

export interface TimelineDay {
  dayOffset: number;
  date: string;
  dayOfMonth: number;
  monthLabel: string;
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
): TimelineDay[] {
  const days: TimelineDay[] = [];
  for (let dayOffset = 0; dayOffset < projectDurationDays; dayOffset += 1) {
    const date = addDaysToScheduleDate(projectStartDate, dayOffset);
    const parsed = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    const dayOfMonth = parsed ? Number(parsed[3]) : dayOffset + 1;
    const monthLabel = parsed
      ? new Date(`${date}T00:00:00`).toLocaleString('en-US', { month: 'short' }).toUpperCase()
      : '';
    days.push({ dayOffset, date, dayOfMonth, monthLabel });
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

  return cpmResult.activities
    .slice()
    .sort((left, right) => {
      if (left.earlyStart !== right.earlyStart) return left.earlyStart - right.earlyStart;
      return left.activityCode.localeCompare(right.activityCode);
    })
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
}

export type GanttCellKind = 'critical' | 'noncritical' | 'float' | 'empty';

export function resolveGanttCellKind(
  dayOffset: number,
  row: LevelThreeGanttRow,
): GanttCellKind {
  const es = row.cpm.earlyStart + row.leveledOffset;
  const ef = es + row.activity.durationDays;
  const tf = Math.max(0, row.cpm.totalFloat - row.leveledOffset);
  const floatEnd = ef + tf;

  if (dayOffset >= es && dayOffset < ef) {
    return row.cpm.isCritical ? 'critical' : 'noncritical';
  }
  if (tf > 0 && dayOffset >= ef && dayOffset < floatEnd) {
    return 'float';
  }
  return 'empty';
}
