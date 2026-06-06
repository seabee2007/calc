import { addDaysToScheduleDate } from '../application/mapScheduleCandidateToScheduleEventInput';

const DEFAULT_WORK_WEEK = [1, 2, 3, 4, 5];

export interface GanttScheduleDateOptions {
  workWeek?: number[];
  includeWeekends?: boolean;
}

function parseYmd(date: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function formatYmd(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftScheduleDate(date: string, days: number): string {
  const parsed = parseYmd(date);
  if (!parsed) return date;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return formatYmd(parsed);
}

function getUtcDayOfWeek(date: string): number {
  return parseYmd(date)?.getUTCDay() ?? 0;
}

function isWorkingDay(date: string, workWeek: number[]): boolean {
  return workWeek.includes(getUtcDayOfWeek(date));
}

export function snapToWorkingDay(
  date: string,
  workWeek: number[],
  includeWeekends: boolean,
): string {
  if (includeWeekends) return date;

  let current = date;
  for (let guard = 0; guard < 14; guard += 1) {
    if (isWorkingDay(current, workWeek)) return current;
    current = addDaysToScheduleDate(current, 1);
  }

  return date;
}

export interface PlannedDateRange {
  startDate: string;
  endDate: string;
}

export function addInclusiveDuration(
  startDate: string,
  durationDays: number,
  options: GanttScheduleDateOptions,
): PlannedDateRange {
  const workWeek = options.workWeek ?? DEFAULT_WORK_WEEK;
  const includeWeekends = options.includeWeekends ?? false;
  const duration = Math.max(1, Math.ceil(durationDays));
  const start = snapToWorkingDay(startDate, workWeek, includeWeekends);

  if (includeWeekends) {
    return {
      startDate: start,
      endDate: addDaysToScheduleDate(start, duration - 1),
    };
  }

  let current = start;
  let remaining = duration - 1;

  while (remaining > 0) {
    current = addDaysToScheduleDate(current, 1);
    if (isWorkingDay(current, workWeek)) {
      remaining -= 1;
    }
  }

  return { startDate: start, endDate: current };
}

export function startFromInclusiveFinish(
  finishDate: string,
  durationDays: number,
  options: GanttScheduleDateOptions,
): string {
  const workWeek = options.workWeek ?? DEFAULT_WORK_WEEK;
  const includeWeekends = options.includeWeekends ?? false;
  const duration = Math.max(1, Math.ceil(durationDays));

  if (includeWeekends) {
    return shiftScheduleDate(finishDate, -(duration - 1));
  }

  let current = finishDate;
  let remaining = duration - 1;

  while (remaining > 0) {
    current = shiftScheduleDate(current, -1);
    if (isWorkingDay(current, workWeek)) {
      remaining -= 1;
    }
  }

  return snapToWorkingDay(current, workWeek, includeWeekends);
}

export function countInclusiveSpanDays(
  startDate: string,
  endDate: string,
  options: GanttScheduleDateOptions,
): number {
  const workWeek = options.workWeek ?? DEFAULT_WORK_WEEK;
  const includeWeekends = options.includeWeekends ?? false;

  if (!startDate || !endDate || startDate > endDate) return 0;

  let count = 0;
  let current = startDate;

  while (true) {
    if (includeWeekends || isWorkingDay(current, workWeek)) {
      count += 1;
    }
    if (current === endDate) break;
    current = addDaysToScheduleDate(current, 1);
  }

  return count;
}

export function resolveDurationDays(durationDays: number): number {
  if (!Number.isFinite(durationDays) || durationDays < 1) return 1;
  return Math.ceil(durationDays);
}
