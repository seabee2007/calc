import type {
  RecurrenceEndType,
  RecurrenceFrequency,
  RecurrenceRule,
  ScheduleEvent,
} from '../types/scheduleEvent';
import { addDays, eventIntersectsRange, getEventEndDate, toIsoDate } from './scheduleEventUtils';

export const RECURRENCE_INSTANCE_ID_SEP = '::';

const MAX_EXPAND_OCCURRENCES = 500;
const MAX_EXPAND_YEARS = 3;

export function parseRecurrenceRule(raw: unknown): RecurrenceRule | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const frequency = o.frequency as RecurrenceFrequency;
  if (!['daily', 'weekly', 'monthly', 'yearly', 'custom'].includes(frequency)) return null;
  const interval = Math.max(1, Number(o.interval) || 1);
  const endType = o.endType as RecurrenceEndType;
  if (!['never', 'on_date', 'after_count'].includes(endType)) return null;
  return {
    frequency,
    interval,
    weekdays: Array.isArray(o.weekdays)
      ? (o.weekdays as number[]).filter((d) => d >= 0 && d <= 6)
      : undefined,
    endType,
    endDate: typeof o.endDate === 'string' ? o.endDate.slice(0, 10) : null,
    occurrenceCount:
      o.occurrenceCount != null ? Math.max(1, Number(o.occurrenceCount)) : null,
    customInterval: o.customInterval != null ? Math.max(1, Number(o.customInterval)) : 1,
    customUnit:
      o.customUnit === 'day' || o.customUnit === 'week' || o.customUnit === 'month'
        ? o.customUnit
        : 'day',
  };
}

export function defaultRecurrenceRule(): RecurrenceRule {
  return {
    frequency: 'weekly',
    interval: 1,
    weekdays: [weekdayMon0(toIsoDate(new Date()))],
    endType: 'never',
  };
}

export function weekdayMon0(iso: string): number {
  const d = new Date(iso + 'T12:00:00');
  return (d.getDay() + 6) % 7;
}

export function buildRecurrenceInstanceId(seriesId: string, occurrenceDate: string): string {
  return `${seriesId}${RECURRENCE_INSTANCE_ID_SEP}${occurrenceDate}`;
}

export function parseRecurrenceInstanceId(
  id: string,
): { seriesId: string; occurrenceDate: string } | null {
  const idx = id.indexOf(RECURRENCE_INSTANCE_ID_SEP);
  if (idx <= 0) return null;
  const seriesId = id.slice(0, idx);
  const occurrenceDate = id.slice(idx + RECURRENCE_INSTANCE_ID_SEP.length);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(occurrenceDate)) return null;
  return { seriesId, occurrenceDate };
}

export function isRecurringSeriesMaster(event: ScheduleEvent): boolean {
  return !!event.recurrenceRule && !event.recurrenceSeriesId;
}

export function isRecurringOccurrenceSelection(event: ScheduleEvent): boolean {
  return !!event.isRecurringInstance || !!parseRecurrenceInstanceId(event.id);
}

function spanDaysFromMaster(master: ScheduleEvent): number {
  const end = master.endDate;
  if (!end || end <= master.startDate) return 0;
  const start = new Date(master.startDate + 'T12:00:00');
  const endD = new Date(end + 'T12:00:00');
  return Math.round((endD.getTime() - start.getTime()) / 86400000);
}

export function materializeRecurrenceInstance(
  master: ScheduleEvent,
  occurrenceDate: string,
): ScheduleEvent {
  const span = spanDaysFromMaster(master);
  const endDate = span > 0 ? addDays(occurrenceDate, span) : null;
  return {
    ...master,
    id: buildRecurrenceInstanceId(master.id, occurrenceDate),
    startDate: occurrenceDate,
    endDate,
    isRecurringInstance: true,
    seriesMasterId: master.id,
    occurrenceDate,
    recurrenceRule: master.recurrenceRule,
    recurrenceSeriesId: null,
    recurrenceInstanceDate: occurrenceDate,
    recurrenceExceptionType: null,
  };
}

function seriesHardEnd(rule: RecurrenceRule, seriesStart: string, rangeEnd: string): string {
  const cap = addDays(rangeEnd, MAX_EXPAND_YEARS * 365);
  if (rule.endType === 'on_date' && rule.endDate) {
    return rule.endDate < cap ? rule.endDate : cap;
  }
  return cap;
}

function addMonthsClamped(iso: string, months: number): string {
  const d = new Date(iso + 'T12:00:00');
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() !== day) d.setDate(0);
  return toIsoDate(d);
}

function addYearsClamped(iso: string, years: number): string {
  const d = new Date(iso + 'T12:00:00');
  const month = d.getMonth();
  const day = d.getDate();
  d.setFullYear(d.getFullYear() + years);
  if (d.getMonth() !== month || d.getDate() !== day) d.setDate(0);
  return toIsoDate(d);
}

function weeksSinceStart(seriesStart: string, iso: string): number {
  const a = new Date(seriesStart + 'T12:00:00').getTime();
  const b = new Date(iso + 'T12:00:00').getTime();
  return Math.floor((b - a) / (7 * 86400000));
}

function matchesWeekly(rule: RecurrenceRule, iso: string, seriesStart: string): boolean {
  const days = rule.weekdays?.length ? rule.weekdays : [weekdayMon0(seriesStart)];
  if (!days.includes(weekdayMon0(iso))) return false;
  const interval = Math.max(1, rule.interval);
  return weeksSinceStart(seriesStart, iso) % interval === 0;
}

function occursOnDate(
  rule: RecurrenceRule,
  iso: string,
  seriesStart: string,
  occurrenceIndex: number,
): boolean {
  if (iso < seriesStart) return false;
  switch (rule.frequency) {
    case 'daily': {
      const days = Math.round(
        (new Date(iso + 'T12:00:00').getTime() -
          new Date(seriesStart + 'T12:00:00').getTime()) /
          86400000,
      );
      return days >= 0 && days % Math.max(1, rule.interval) === 0;
    }
    case 'weekly':
      return matchesWeekly(rule, iso, seriesStart);
    case 'monthly': {
      const s = new Date(seriesStart + 'T12:00:00');
      const c = new Date(iso + 'T12:00:00');
      const months =
        (c.getFullYear() - s.getFullYear()) * 12 + (c.getMonth() - s.getMonth());
      return c.getDate() === s.getDate() && months >= 0 && months % Math.max(1, rule.interval) === 0;
    }
    case 'yearly': {
      const s = new Date(seriesStart + 'T12:00:00');
      const c = new Date(iso + 'T12:00:00');
      const years = c.getFullYear() - s.getFullYear();
      return (
        c.getMonth() === s.getMonth() &&
        c.getDate() === s.getDate() &&
        years >= 0 &&
        years % Math.max(1, rule.interval) === 0
      );
    }
    case 'custom': {
      const ci = Math.max(1, rule.customInterval ?? 1);
      const unit = rule.customUnit ?? 'day';
      const days = Math.round(
        (new Date(iso + 'T12:00:00').getTime() -
          new Date(seriesStart + 'T12:00:00').getTime()) /
          86400000,
      );
      if (days < 0) return false;
      if (unit === 'day') return days % ci === 0;
      if (unit === 'week') return days % (ci * 7) === 0;
      const s = new Date(seriesStart + 'T12:00:00');
      const c = new Date(iso + 'T12:00:00');
      const months =
        (c.getFullYear() - s.getFullYear()) * 12 + (c.getMonth() - s.getMonth());
      return c.getDate() === s.getDate() && months >= 0 && months % ci === 0;
    }
    default:
      return false;
  }
}

export function generateRecurrenceOccurrenceDates(
  rule: RecurrenceRule,
  seriesStartDate: string,
  rangeStart: string,
  rangeEnd: string,
): string[] {
  const hardEnd = seriesHardEnd(rule, seriesStartDate, rangeEnd);
  const maxCount =
    rule.endType === 'after_count' && rule.occurrenceCount
      ? rule.occurrenceCount
      : MAX_EXPAND_OCCURRENCES;

  const dates: string[] = [];
  let cursor = seriesStartDate < rangeStart ? rangeStart : seriesStartDate;
  let totalGenerated = 0;
  let safety = 0;

  while (cursor <= hardEnd && totalGenerated < maxCount && safety < 4000) {
    safety++;
    if (occursOnDate(rule, cursor, seriesStartDate, totalGenerated)) {
      totalGenerated++;
      if (cursor >= rangeStart && cursor <= rangeEnd) {
        dates.push(cursor);
      }
    }
    cursor = addDays(cursor, 1);
  }

  return dates;
}

export function formatRecurrenceSummary(rule: RecurrenceRule): string {
  const n = rule.interval;
  let freq = '';
  switch (rule.frequency) {
    case 'daily':
      freq = n === 1 ? 'Daily' : `Every ${n} days`;
      break;
    case 'weekly': {
      const days = rule.weekdays?.length
        ? rule.weekdays.map((d) => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][d]).join(', ')
        : '';
      freq = n === 1 ? `Weekly${days ? ` on ${days}` : ''}` : `Every ${n} weeks${days ? ` on ${days}` : ''}`;
      break;
    }
    case 'monthly':
      freq = n === 1 ? 'Monthly' : `Every ${n} months`;
      break;
    case 'yearly':
      freq = n === 1 ? 'Yearly' : `Every ${n} years`;
      break;
    case 'custom':
      freq = `Every ${rule.customInterval ?? 1} ${rule.customUnit ?? 'day'}(s)`;
      break;
  }
  let end = '';
  if (rule.endType === 'on_date' && rule.endDate) end = ` until ${rule.endDate}`;
  else if (rule.endType === 'after_count' && rule.occurrenceCount) {
    end = ` for ${rule.occurrenceCount} occurrence(s)`;
  }
  return freq + end;
}

export function expandRecurringEventsForRange(
  events: ScheduleEvent[],
  rangeStart: string,
  rangeEnd: string,
): ScheduleEvent[] {
  const masters = events.filter((e) => isRecurringSeriesMaster(e));
  const masterIds = new Set(masters.map((m) => m.id));

  const exceptionsBySeries = new Map<string, Map<string, ScheduleEvent>>();
  const standalone: ScheduleEvent[] = [];

  for (const e of events) {
    if (e.recurrenceSeriesId && e.recurrenceInstanceDate) {
      const map =
        exceptionsBySeries.get(e.recurrenceSeriesId) ?? new Map<string, ScheduleEvent>();
      map.set(e.recurrenceInstanceDate, e);
      exceptionsBySeries.set(e.recurrenceSeriesId, map);
      continue;
    }
    if (!e.recurrenceRule) standalone.push(e);
  }

  const expanded: ScheduleEvent[] = [...standalone];

  for (const master of masters) {
    if (!master.recurrenceRule) continue;
    const occDates = generateRecurrenceOccurrenceDates(
      master.recurrenceRule,
      master.startDate,
      rangeStart,
      rangeEnd,
    );
    const exMap = exceptionsBySeries.get(master.id) ?? new Map();

    for (const occ of occDates) {
      const ex = exMap.get(occ);
      if (ex?.recurrenceExceptionType === 'deleted') continue;
      if (ex && ex.recurrenceExceptionType === 'modified') {
        expanded.push({
          ...ex,
          isRecurringInstance: true,
          seriesMasterId: master.id,
          occurrenceDate: occ,
        });
      } else {
        expanded.push(materializeRecurrenceInstance(master, occ));
      }
    }
  }

  for (const e of events) {
    if (
      e.recurrenceSeriesId &&
      e.recurrenceInstanceDate &&
      !masterIds.has(e.recurrenceSeriesId) &&
      eventIntersectsRange(e, rangeStart, rangeEnd) &&
      e.recurrenceExceptionType === 'modified'
    ) {
      if (!expanded.some((x) => x.id === e.id)) expanded.push(e);
    }
  }

  return expanded.sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export function clipRecurrenceRuleBeforeDate(
  rule: RecurrenceRule,
  beforeDate: string,
): RecurrenceRule {
  const last = addDays(beforeDate, -1);
  return {
    ...rule,
    endType: 'on_date',
    endDate: last,
    occurrenceCount: null,
  };
}
