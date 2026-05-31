import type {
  ProjectMilestoneKey,
  ScheduleEvent,
  ScheduleEventActivityEntry,
  ScheduleEventComment,
  ScheduleEventStatus,
  ScheduleEventType,
  ScheduleFilters,
} from '../types/scheduleEvent';
import {
  MILESTONE_DEFAULT_EVENT_TYPES,
  MILESTONE_LABELS,
  PROJECT_MILESTONE_KEYS,
  normalizeMilestoneKey,
} from '../types/scheduleEvent';

export function formatScheduleDate(isoDate: string): string {
  const d = new Date(isoDate + 'T12:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatScheduleTime(time: string | null | undefined): string {
  if (!time) return '';
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${m ?? '00'} ${ampm}`;
}

export function getEventEndDate(event: ScheduleEvent): string {
  return event.endDate ?? event.startDate;
}

export function isMultiDayEvent(event: ScheduleEvent): boolean {
  const end = event.endDate;
  return !!end && end > event.startDate;
}

export function eventOccursOnDate(event: ScheduleEvent, isoDate: string): boolean {
  const end = getEventEndDate(event);
  return isoDate >= event.startDate && isoDate <= end;
}

function toRangeIso(isoOrDate: string | Date): string {
  if (typeof isoOrDate === 'string') return isoOrDate.slice(0, 10);
  return toIsoDate(isoOrDate);
}

/** True when event [startDate, endDate] intersects [rangeStart, rangeEnd] (inclusive, day precision). */
export function eventIntersectsRange(
  event: ScheduleEvent,
  rangeStart: string | Date,
  rangeEnd: string | Date,
): boolean {
  const viewStart = toRangeIso(rangeStart);
  const viewEnd = toRangeIso(rangeEnd);
  const eventEnd = getEventEndDate(event);
  return event.startDate <= viewEnd && eventEnd >= viewStart;
}

/** @deprecated Prefer eventIntersectsRange — kept for existing imports. */
export function eventOverlapsDateRange(
  event: ScheduleEvent,
  dateFrom: string,
  dateTo: string,
): boolean {
  return eventIntersectsRange(event, dateFrom, dateTo);
}

/** Events visible in a calendar range (overlap), sorted ascending. */
export function filterEventsForVisibleRange(
  events: ScheduleEvent[],
  rangeStart: string,
  rangeEnd: string,
): ScheduleEvent[] {
  return events
    .filter((e) => eventIntersectsRange(e, rangeStart, rangeEnd))
    .sort(compareEventsAsc);
}

export function getCalendarLoadRange(
  cal: import('../types/scheduleEvent').CalendarSubView,
  anchorIso: string,
  filterFrom: string,
  filterTo: string,
): { dateFrom: string; dateTo: string } {
  const anchor = new Date(anchorIso + 'T12:00:00');
  if (cal === 'month') {
    const bounds = getMonthGridDateBounds(anchor.getFullYear(), anchor.getMonth());
    return {
      dateFrom:
        filterFrom && filterFrom < bounds.dateFrom ? filterFrom : bounds.dateFrom,
      dateTo: filterTo && filterTo > bounds.dateTo ? filterTo : bounds.dateTo,
    };
  }
  if (cal === 'day') {
    return { dateFrom: anchorIso, dateTo: anchorIso };
  }
  if (cal === 'agenda') {
    const todayIso = toIsoDate(new Date());
    let dateFrom = anchorIso < todayIso ? anchorIso : todayIso;
    let dateTo = addDays(dateFrom, 90);
    if (filterFrom && filterFrom < dateFrom) dateFrom = filterFrom;
    if (filterTo && filterTo > dateTo) dateTo = filterTo;
    return { dateFrom, dateTo };
  }
  const weekStart = toIsoDate(getWeekStart(anchor));
  const days =
    cal === 'work_week' ? getWorkWeekDays(weekStart) : getWeekDays(weekStart);
  const visibleFrom = days[0];
  const visibleTo = days[days.length - 1];
  let dateFrom = visibleFrom;
  let dateTo = visibleTo;
  if (filterFrom && filterFrom < dateFrom) dateFrom = filterFrom;
  if (filterTo && filterTo > dateTo) dateTo = filterTo;
  return { dateFrom, dateTo };
}

export function getEventDateSpan(
  event: ScheduleEvent,
  visibleStartDate: string,
  visibleEndDate: string,
): { visibleStart: string; visibleEnd: string } | null {
  const end = getEventEndDate(event);
  if (end < visibleStartDate || event.startDate > visibleEndDate) return null;
  return {
    visibleStart: event.startDate > visibleStartDate ? event.startDate : visibleStartDate,
    visibleEnd: end < visibleEndDate ? end : visibleEndDate,
  };
}

export function formatScheduleDateRangeShort(startIso: string, endIso: string): string {
  const start = new Date(startIso + 'T12:00:00');
  const end = new Date(endIso + 'T12:00:00');
  const sameYear = start.getFullYear() === end.getFullYear();
  const startStr = start.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  const endStr = end.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${startStr} – ${endStr}`;
}

export function formatScheduleEventDateRange(event: ScheduleEvent): string {
  const end = getEventEndDate(event);
  if (!isMultiDayEvent(event)) {
    return formatScheduleDateTime(event);
  }
  const range = formatScheduleDateRangeShort(event.startDate, end);
  const start = formatScheduleTime(event.startTime);
  const endTime = formatScheduleTime(event.endTime);
  if (start && endTime) return `${range} · ${start} – ${endTime}`;
  if (start) return `${range} · ${start}`;
  return range;
}

export function formatScheduleDateTime(event: ScheduleEvent): string {
  if (isMultiDayEvent(event)) {
    return formatScheduleEventDateRange(event);
  }
  const date = formatScheduleDate(event.startDate);
  const start = formatScheduleTime(event.startTime);
  const end = formatScheduleTime(event.endTime);
  if (!start) return date;
  if (end) return `${date} · ${start} – ${end}`;
  return `${date} · ${start}`;
}

export function isEventDelayed(event: ScheduleEvent): boolean {
  return event.status === 'delayed';
}

export function eventSortKey(event: ScheduleEvent): string {
  return `${event.startDate}T${event.startTime ?? '00:00:00'}`;
}

export function compareEventsAsc(a: ScheduleEvent, b: ScheduleEvent): number {
  return eventSortKey(a).localeCompare(eventSortKey(b));
}

export function filterScheduleEvents(
  events: ScheduleEvent[],
  filters: Partial<ScheduleFilters>,
): ScheduleEvent[] {
  return events.filter((e) => {
    if (filters.projectId && e.projectId !== filters.projectId) return false;
    if (filters.trade && e.trade !== filters.trade) return false;
    if (filters.crew && e.crew !== filters.crew) return false;
    if (filters.status && e.status !== filters.status) return false;
    if (filters.eventType && e.eventType !== filters.eventType) return false;
    if (filters.priority && e.priority !== filters.priority) return false;
    if (filters.weatherRisk && e.weatherRisk !== filters.weatherRisk) return false;
    if (filters.assignedUser) {
      const match = e.assignedTo.some((u) =>
        u.toLowerCase().includes(filters.assignedUser!.toLowerCase()),
      );
      if (!match) return false;
    }
    if (filters.dateFrom && filters.dateTo) {
      if (!eventIntersectsRange(e, filters.dateFrom, filters.dateTo)) return false;
    } else if (filters.dateFrom && getEventEndDate(e) < filters.dateFrom) {
      return false;
    } else if (filters.dateTo && e.startDate > filters.dateTo) {
      return false;
    }
    return true;
  });
}

export function distinctTrades(events: ScheduleEvent[]): string[] {
  const set = new Set<string>();
  for (const e of events) {
    if (e.trade?.trim()) set.add(e.trade.trim());
  }
  return [...set].sort();
}

export function distinctCrews(events: ScheduleEvent[]): string[] {
  const set = new Set<string>();
  for (const e of events) {
    if (e.crew?.trim()) set.add(e.crew.trim());
  }
  return [...set].sort();
}

export function distinctAssignedUsers(events: ScheduleEvent[]): string[] {
  const set = new Set<string>();
  for (const e of events) {
    for (const u of e.assignedTo) {
      if (u.trim()) set.add(u.trim());
    }
  }
  return [...set].sort();
}

export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

export function getDefaultDateRange(): { dateFrom: string; dateTo: string } {
  const today = new Date();
  const from = getWeekStart(today);
  const to = new Date(from);
  to.setDate(to.getDate() + 27);
  return { dateFrom: toIsoDate(from), dateTo: toIsoDate(to) };
}

export function getDateRangePreset(
  preset: 'this_week' | 'this_month' | 'next_30',
): { dateFrom: string; dateTo: string } {
  const today = new Date();
  const todayIso = toIsoDate(today);
  if (preset === 'this_week') {
    const from = getWeekStart(today);
    const to = addDays(toIsoDate(from), 6);
    return { dateFrom: toIsoDate(from), dateTo: to };
  }
  if (preset === 'this_month') {
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    const to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { dateFrom: toIsoDate(from), dateTo: toIsoDate(to) };
  }
  return { dateFrom: todayIso, dateTo: addDays(todayIso, 30) };
}

export interface DateBucket {
  key: string;
  label: string;
  events: ScheduleEvent[];
}

export function groupEventsByDate(events: ScheduleEvent[]): DateBucket[] {
  const map = new Map<string, ScheduleEvent[]>();
  const sorted = [...events].sort(compareEventsAsc);
  for (const e of sorted) {
    const list = map.get(e.startDate) ?? [];
    list.push(e);
    map.set(e.startDate, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, evts]) => ({
      key,
      label: formatScheduleDate(key),
      events: evts,
    }));
}

export interface AgendaGroup {
  key: string;
  label: string;
  events: ScheduleEvent[];
}

export function groupEventsByDayForAgenda(
  events: ScheduleEvent[],
  todayIso: string,
): AgendaGroup[] {
  const sorted = [...events].sort(compareEventsAsc);
  const map = new Map<string, ScheduleEvent[]>();
  for (const e of sorted) {
    if (isMultiDayEvent(e)) {
      const list = map.get(e.startDate) ?? [];
      if (!list.some((x) => x.id === e.id)) list.push(e);
      map.set(e.startDate, list);
      continue;
    }
    const list = map.get(e.startDate) ?? [];
    list.push(e);
    map.set(e.startDate, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, evts]) => {
      let label = formatScheduleDate(key);
      if (key === todayIso) label = 'Today';
      else if (key === addDays(todayIso, 1)) label = 'Tomorrow';
      return { key, label, events: evts };
    });
}

/** Single-day events on this date (multi-day events render as span bars). */
export function eventsForCalendarCell(
  events: ScheduleEvent[],
  isoDate: string,
): ScheduleEvent[] {
  return events
    .filter((e) => !isMultiDayEvent(e) && eventOccursOnDate(e, isoDate))
    .sort(compareEventsAsc);
}

export interface MultiDayBarLayout {
  event: ScheduleEvent;
  startColumnIndex: number;
  spanColumns: number;
  lane: number;
}

function assignBarLane(
  lanes: { endCol: number }[],
  startCol: number,
  endCol: number,
): number {
  for (let i = 0; i < lanes.length; i++) {
    if (lanes[i].endCol < startCol) {
      lanes[i].endCol = endCol;
      return i;
    }
  }
  lanes.push({ endCol });
  return lanes.length - 1;
}

export function layoutMultiDayBarsForDays(
  events: ScheduleEvent[],
  days: string[],
): MultiDayBarLayout[] {
  if (days.length === 0) return [];
  const visibleStart = days[0];
  const visibleEnd = days[days.length - 1];
  const multi = events
    .filter(
      (e) =>
        isMultiDayEvent(e) &&
        eventIntersectsRange(e, visibleStart, visibleEnd) &&
        getEventDateSpan(e, visibleStart, visibleEnd),
    )
    .sort(compareEventsAsc);

  const lanes: { endCol: number }[] = [];
  const layouts: MultiDayBarLayout[] = [];

  for (const event of multi) {
    const span = getEventDateSpan(event, visibleStart, visibleEnd)!;
    const startIdx = days.indexOf(span.visibleStart);
    const endIdx = days.indexOf(span.visibleEnd);
    if (startIdx < 0 || endIdx < 0) continue;
    const lane = assignBarLane(lanes, startIdx, endIdx);
    layouts.push({
      event,
      startColumnIndex: startIdx,
      spanColumns: endIdx - startIdx + 1,
      lane,
    });
  }
  return layouts;
}

export function layoutMonthWeekMultiDayBars(
  week: (string | null)[],
  events: ScheduleEvent[],
): MultiDayBarLayout[] {
  const days = week.filter((d): d is string => d != null);
  if (days.length === 0) return [];

  const visibleStart = days[0];
  const visibleEnd = days[days.length - 1];
  const multi = events
    .filter(
      (e) =>
        isMultiDayEvent(e) &&
        eventIntersectsRange(e, visibleStart, visibleEnd) &&
        getEventDateSpan(e, visibleStart, visibleEnd),
    )
    .sort(compareEventsAsc);

  const lanes: { endCol: number }[] = [];
  const layouts: MultiDayBarLayout[] = [];

  for (const event of multi) {
    const clip = getEventDateSpan(event, visibleStart, visibleEnd)!;
    let startIdx = -1;
    let endIdx = -1;
    week.forEach((iso, idx) => {
      if (!iso) return;
      if (iso >= clip.visibleStart && iso <= clip.visibleEnd) {
        if (startIdx < 0) startIdx = idx;
        endIdx = idx;
      }
    });
    if (startIdx < 0 || endIdx < 0) continue;
    const lane = assignBarLane(lanes, startIdx, endIdx);
    layouts.push({
      event,
      startColumnIndex: startIdx,
      spanColumns: endIdx - startIdx + 1,
      lane,
    });
  }
  return layouts;
}

export function splitEventsForTimeGrid(
  events: ScheduleEvent[],
  days: string[],
): {
  multiDayBars: MultiDayBarLayout[];
  daySingleEvents: Map<string, ScheduleEvent[]>;
} {
  const multiDayBars = layoutMultiDayBarsForDays(events, days);
  const multiIds = new Set(multiDayBars.map((b) => b.event.id));
  const daySingleEvents = new Map<string, ScheduleEvent[]>();
  for (const iso of days) {
    daySingleEvents.set(
      iso,
      events
        .filter((e) => !multiIds.has(e.id) && !isMultiDayEvent(e) && eventOccursOnDate(e, iso))
        .sort(compareEventsAsc),
    );
  }
  return { multiDayBars, daySingleEvents };
}

export interface DayOperationalSummary {
  total: number;
  crews: number;
  deliveries: number;
  inspections: number;
  deadlines: number;
}

export function dayOperationalSummary(
  events: ScheduleEvent[],
  isoDate: string,
): DayOperationalSummary {
  const day = events.filter((e) => eventOccursOnDate(e, isoDate));
  const crews = new Set(
    day.filter((e) => e.eventType === 'crew_work_day' && e.crew).map((e) => e.crew),
  );
  return {
    total: day.length,
    crews: crews.size,
    deliveries: day.filter(
      (e) => e.eventType === 'material_delivery' || e.eventType === 'equipment_delivery',
    ).length,
    inspections: day.filter((e) => e.eventType === 'inspection').length,
    deadlines: day.filter(
      (e) =>
        e.eventType === 'bid_due_date' ||
        e.eventType === 'proposal_due' ||
        e.eventType === 'change_order_deadline' ||
        e.eventType === 'permit_deadline' ||
        e.eventType === 'submittal_due' ||
        e.eventType === 'rfi_due',
    ).length,
  };
}

export function getMonthGrid(year: number, month: number): (string | null)[][] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = (first.getDay() + 6) % 7;
  const days: (string | null)[] = [];
  for (let i = 0; i < startPad; i++) days.push(null);
  for (let d = 1; d <= last.getDate(); d++) {
    days.push(toIsoDate(new Date(year, month, d)));
  }
  while (days.length % 7 !== 0) days.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

export function getMonthGridDateBounds(
  year: number,
  month: number,
): { dateFrom: string; dateTo: string } {
  const monthNum = month + 1;
  const mm = String(monthNum).padStart(2, '0');
  const lastDay = new Date(year, month + 1, 0).getDate();
  const dd = String(lastDay).padStart(2, '0');
  return {
    dateFrom: `${year}-${mm}-01`,
    dateTo: `${year}-${mm}-${dd}`,
  };
}

export interface ProjectDateGroup {
  projectId: string;
  projectName: string;
  events: ScheduleEvent[];
}

export function groupEventsByProjectThenDate(
  events: ScheduleEvent[],
): Map<string, ProjectDateGroup> {
  const byProject = new Map<string, ProjectDateGroup>();
  for (const e of events) {
    const name = e.projectName ?? 'Project';
    const existing = byProject.get(e.projectId);
    if (existing) {
      existing.events.push(e);
    } else {
      byProject.set(e.projectId, {
        projectId: e.projectId,
        projectName: name,
        events: [e],
      });
    }
  }
  for (const g of byProject.values()) {
    g.events.sort(compareEventsAsc);
  }
  return byProject;
}

export function getWeekDays(weekStartIso: string): string[] {
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    days.push(addDays(weekStartIso, i));
  }
  return days;
}

/** Mon–Fri within the week containing weekStartIso (Monday-based). */
export function getWorkWeekDays(weekStartIso: string): string[] {
  return getWeekDays(weekStartIso).slice(0, 5);
}

export function parseTimeToMinutes(time: string | null | undefined): number | null {
  if (!time?.trim()) return null;
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const min = parseInt(m ?? '0', 10);
  if (Number.isNaN(hour)) return null;
  return hour * 60 + min;
}

const DEADLINE_EVENT_TYPES = new Set<ScheduleEvent['eventType']>([
  'bid_due_date',
  'proposal_due',
  'change_order_deadline',
  'permit_deadline',
  'submittal_due',
  'rfi_due',
]);

/** Untimed or deadline-type events use All day row (not hourly grid). */
export function isAllDayScheduleEvent(event: ScheduleEvent): boolean {
  if (isMultiDayEvent(event)) return false;
  if (parseTimeToMinutes(event.startTime) == null) return true;
  if (DEADLINE_EVENT_TYPES.has(event.eventType)) return true;
  return false;
}

/** Timed single-day events only — for hour grid placement. */
export function isTimedGridEvent(event: ScheduleEvent): boolean {
  if (isMultiDayEvent(event)) return false;
  if (isAllDayScheduleEvent(event)) return false;
  return parseTimeToMinutes(event.startTime) != null;
}

/** Single-day events on this date (multi-day use span bars / agenda grouping). */
export function eventsOnDate(events: ScheduleEvent[], isoDate: string): ScheduleEvent[] {
  return eventsForCalendarCell(events, isoDate);
}

export function splitTimedAndAllDay(events: ScheduleEvent[]): {
  allDay: ScheduleEvent[];
  timed: ScheduleEvent[];
} {
  const allDay: ScheduleEvent[] = [];
  const timed: ScheduleEvent[] = [];
  for (const e of events) {
    if (isTimedGridEvent(e)) timed.push(e);
    else if (!isMultiDayEvent(e)) allDay.push(e);
  }
  return { allDay, timed };
}

export interface TimedEventLayout {
  event: ScheduleEvent;
  topPx: number;
  heightPx: number;
}

export const DEFAULT_GRID_DAY_START_HOUR = 7;
export const DEFAULT_GRID_DAY_END_HOUR = 18;
export const DEFAULT_GRID_SLOT_MINUTES = 30;
export const DEFAULT_GRID_SLOT_HEIGHT_PX = 24;

export function layoutTimedEventsForDay(
  events: ScheduleEvent[],
  options?: {
    dayStartHour?: number;
    dayEndHour?: number;
    slotMinutes?: number;
    slotHeightPx?: number;
  },
): TimedEventLayout[] {
  const dayStartHour = options?.dayStartHour ?? DEFAULT_GRID_DAY_START_HOUR;
  const dayEndHour = options?.dayEndHour ?? DEFAULT_GRID_DAY_END_HOUR;
  const slotMinutes = options?.slotMinutes ?? DEFAULT_GRID_SLOT_MINUTES;
  const slotHeightPx = options?.slotHeightPx ?? DEFAULT_GRID_SLOT_HEIGHT_PX;
  const pxPerMinute = slotHeightPx / slotMinutes;
  const gridStartMin = dayStartHour * 60;
  const gridEndMin = dayEndHour * 60;
  const minBlockHeight = slotHeightPx;

  const timed = events
    .filter((e) => isTimedGridEvent(e))
    .sort((a, b) => eventSortKey(a).localeCompare(eventSortKey(b)));

  return timed.map((event) => {
    const startMin = parseTimeToMinutes(event.startTime) ?? gridStartMin;
    const endMin =
      parseTimeToMinutes(event.endTime) ?? startMin + 60;
    const clampedStart = Math.max(gridStartMin, Math.min(startMin, gridEndMin - 15));
    const clampedEnd = Math.max(clampedStart + 15, Math.min(endMin, gridEndMin));
    const topPx = (clampedStart - gridStartMin) * pxPerMinute;
    const heightPx = Math.max(minBlockHeight, (clampedEnd - clampedStart) * pxPerMinute);
    return { event, topPx, heightPx };
  });
}

export function getCalendarRangeLabel(
  cal: import('../types/scheduleEvent').CalendarSubView,
  anchorIso: string,
): string {
  const anchor = new Date(anchorIso + 'T12:00:00');
  if (cal === 'month') {
    return anchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  if (cal === 'day') {
    return formatScheduleDate(anchorIso);
  }
  if (cal === 'agenda') {
    return 'Agenda';
  }
  const weekStart = toIsoDate(getWeekStart(anchor));
  const days = cal === 'work_week' ? getWorkWeekDays(weekStart) : getWeekDays(weekStart);
  const end = days[days.length - 1];
  const startLabel = dayLabel(days[0]).replace(/, \d{4}$/, '');
  const endLabel = dayLabel(end);
  return cal === 'work_week'
    ? `Work week · ${startLabel} – ${endLabel}`
    : `Week · ${startLabel} – ${endLabel}`;
}

export function shiftCalendarAnchor(
  cal: import('../types/scheduleEvent').CalendarSubView,
  anchorIso: string,
  delta: number,
): string {
  const d = new Date(anchorIso + 'T12:00:00');
  if (cal === 'month') {
    d.setMonth(d.getMonth() + delta);
    return toIsoDate(d);
  }
  if (cal === 'day') {
    d.setDate(d.getDate() + delta);
    return toIsoDate(d);
  }
  const step = cal === 'work_week' || cal === 'week' ? 7 * delta : 7 * delta;
  d.setDate(d.getDate() + step);
  return toIsoDate(d);
}

export function dayLabel(isoDate: string): string {
  const d = new Date(isoDate + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export interface MilestoneSlot {
  key: ProjectMilestoneKey;
  label: string;
  event: ScheduleEvent | null;
  status: 'not_scheduled' | ScheduleEventStatus;
}

function milestoneMatchesEvent(e: ScheduleEvent, key: ProjectMilestoneKey): boolean {
  const normalized = normalizeMilestoneKey(e.milestoneKey as string);
  if (normalized === key) return true;
  if (key === 'warranty_end' && e.milestoneKey === 'warranty') return true;
  const defaultType = MILESTONE_DEFAULT_EVENT_TYPES[key];
  return defaultType != null && e.eventType === defaultType;
}

export function resolveMilestoneForProject(
  events: ScheduleEvent[],
  projectId: string,
): MilestoneSlot[] {
  const projectEvents = events.filter((e) => e.projectId === projectId);
  return PROJECT_MILESTONE_KEYS.map((key) => {
    let event = projectEvents.find((e) => milestoneMatchesEvent(e, key)) ?? null;
    return {
      key,
      label: MILESTONE_LABELS[key],
      event,
      status: event ? event.status : 'not_scheduled',
    };
  });
}

export function statusAccentClass(status: ScheduleEventStatus): string {
  switch (status) {
    case 'delayed':
      return 'border-l-4 border-l-amber-500';
    case 'needs_attention':
      return 'border-l-4 border-l-red-500';
    case 'cancelled':
      return 'opacity-60';
    case 'completed':
      return 'border-l-4 border-l-green-500';
    default:
      return 'border-l-4 border-l-transparent';
  }
}

export function parseRelatedDocuments(raw: unknown): ScheduleEvent['relatedDocuments'] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => r && typeof r === 'object')
    .map((r) => {
      const row = r as Record<string, unknown>;
      return {
        id: String(row.id ?? crypto.randomUUID()),
        name: String(row.name ?? 'Document'),
        url: String(row.url ?? ''),
      };
    });
}

export function parseAssignedTo(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x)).filter(Boolean);
}

export function parseActivityLog(raw: unknown): ScheduleEventActivityEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => r && typeof r === 'object')
    .map((r) => {
      const row = r as Record<string, unknown>;
      return {
        id: String(row.id ?? crypto.randomUUID()),
        at: String(row.at ?? ''),
        userId: String(row.userId ?? ''),
        action: String(row.action ?? ''),
        detail: row.detail != null ? String(row.detail) : undefined,
      };
    });
}

export interface TimelineColumn {
  key: string;
  label: string;
}

export function getTimelineColumns(
  scale: import('../types/scheduleEvent').TimelineScale,
  dateFrom: string,
  dateTo: string,
): TimelineColumn[] {
  const cols: TimelineColumn[] = [];
  if (!dateFrom || !dateTo) return cols;
  if (scale === 'day') {
    let cur = dateFrom;
    while (cur <= dateTo) {
      cols.push({ key: cur, label: formatScheduleDate(cur).split(',')[0] });
      cur = addDays(cur, 1);
    }
    return cols;
  }
  if (scale === 'week') {
    let cur = getWeekStart(new Date(dateFrom + 'T12:00:00'));
    const end = new Date(dateTo + 'T12:00:00');
    while (cur <= end) {
      const key = toIsoDate(cur);
      cols.push({ key, label: `Wk ${key.slice(5)}` });
      cur.setDate(cur.getDate() + 7);
    }
    return cols;
  }
  const start = new Date(dateFrom + 'T12:00:00');
  const end = new Date(dateTo + 'T12:00:00');
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur <= end) {
    const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
    cols.push({
      key,
      label: cur.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    });
    cur.setMonth(cur.getMonth() + 1);
  }
  return cols;
}

export function eventTimelineColumnKey(
  event: ScheduleEvent,
  scale: import('../types/scheduleEvent').TimelineScale,
): string {
  if (scale === 'day') return event.startDate;
  if (scale === 'week') {
    return toIsoDate(getWeekStart(new Date(event.startDate + 'T12:00:00')));
  }
  const d = new Date(event.startDate + 'T12:00:00');
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function parseComments(raw: unknown): ScheduleEventComment[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => r && typeof r === 'object')
    .map((r) => {
      const row = r as Record<string, unknown>;
      return {
        id: String(row.id ?? crypto.randomUUID()),
        at: String(row.at ?? ''),
        userId: String(row.userId ?? ''),
        body: String(row.body ?? ''),
      };
    });
}
