import type { ScheduleEvent } from '../types/scheduleEvent';
import { addDays, eventOccursOnDate, toIsoDate } from './scheduleEventUtils';
import { expandRecurringEventsForRange } from './scheduleRecurrenceUtils';

export interface ScheduleDashboardSnapshot {
  todayEvents: ScheduleEvent[];
  upcomingDeadlines: ScheduleEvent[];
  upcomingDeliveries: ScheduleEvent[];
  upcomingInspections: ScheduleEvent[];
  activeCrews: string[];
  weatherDelayCount: number;
  upcomingMilestones: ScheduleEvent[];
  recentChanges: ScheduleEvent[];
}

const DEADLINE_TYPES = new Set([
  'bid_due_date',
  'proposal_due',
  'change_order_deadline',
  'permit_deadline',
  'submittal_due',
  'rfi_due',
]);

/** One row per calendar occurrence (matches planner calendar expansion). */
function scheduleEventDisplayKey(e: ScheduleEvent): string {
  if (e.seriesMasterId && e.occurrenceDate) {
    return `series:${e.seriesMasterId}:${e.occurrenceDate}`;
  }
  if (e.recurrenceSeriesId && e.recurrenceInstanceDate) {
    return `series:${e.recurrenceSeriesId}:${e.recurrenceInstanceDate}`;
  }
  return `id:${e.id}`;
}

function eventsForCalendarDay(
  events: ScheduleEvent[],
  dayIso: string,
): ScheduleEvent[] {
  const expanded = expandRecurringEventsForRange(events, dayIso, dayIso);
  const seen = new Set<string>();
  const out: ScheduleEvent[] = [];
  for (const e of expanded) {
    if (e.status === 'cancelled') continue;
    if (!eventOccursOnDate(e, dayIso)) continue;
    const key = scheduleEventDisplayKey(e);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out.sort((a, b) => {
    const ta = a.startTime ?? '';
    const tb = b.startTime ?? '';
    if (ta !== tb) return ta.localeCompare(tb);
    return a.title.localeCompare(b.title);
  });
}

export function buildScheduleDashboardSnapshot(
  events: ScheduleEvent[],
  todayIso: string = toIsoDate(new Date()),
): ScheduleDashboardSnapshot {
  const horizon = addDays(todayIso, 14);
  const weekAgo = addDays(todayIso, -7);

  const todayEvents = eventsForCalendarDay(events, todayIso);
  const upcoming = events.filter(
    (e) => e.startDate >= todayIso && e.startDate <= horizon && e.status !== 'cancelled',
  );

  const upcomingDeadlines = upcoming.filter((e) => DEADLINE_TYPES.has(e.eventType));
  const upcomingDeliveries = upcoming.filter(
    (e) => e.eventType === 'material_delivery' || e.eventType === 'equipment_delivery',
  );
  const upcomingInspections = upcoming.filter((e) => e.eventType === 'inspection');

  const crewSet = new Set<string>();
  for (const e of todayEvents) {
    if (e.eventType === 'crew_work_day' && e.crew?.trim()) {
      crewSet.add(e.crew.trim());
    }
  }

  const weatherDelayCount = events.filter(
    (e) =>
      e.eventType === 'weather_delay' ||
      (e.status === 'delayed' && e.startDate >= todayIso && e.startDate <= horizon),
  ).length;

  const upcomingMilestones = events.filter(
    (e) =>
      e.milestoneKey != null &&
      e.startDate >= todayIso &&
      e.startDate <= horizon &&
      e.status !== 'cancelled',
  );

  const recentChanges = events
    .filter((e) => e.updatedAt.slice(0, 10) >= weekAgo)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 8);

  return {
    todayEvents,
    upcomingDeadlines,
    upcomingDeliveries,
    upcomingInspections,
    activeCrews: [...crewSet],
    weatherDelayCount,
    upcomingMilestones,
    recentChanges,
  };
}
