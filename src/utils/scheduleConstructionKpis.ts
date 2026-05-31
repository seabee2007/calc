import type { ScheduleEvent } from '../types/scheduleEvent';
import { eventIntersectsRange } from './scheduleEventUtils';

const DEADLINE_TYPES = new Set<ScheduleEvent['eventType']>([
  'bid_due_date',
  'proposal_due',
  'change_order_deadline',
  'permit_deadline',
  'submittal_due',
  'rfi_due',
]);

const DELIVERY_TYPES = new Set<ScheduleEvent['eventType']>([
  'material_delivery',
  'equipment_delivery',
]);

export interface ScheduleConstructionKpis {
  activeEvents: number;
  deliveries: number;
  inspections: number;
  deadlines: number;
  activeCrews: number;
}

export function buildScheduleConstructionKpis(
  events: ScheduleEvent[],
  dateFrom: string,
  dateTo: string,
): ScheduleConstructionKpis {
  const inRange = events.filter(
    (e) =>
      e.status !== 'cancelled' &&
      eventIntersectsRange(e, dateFrom, dateTo),
  );

  const crewNames = new Set<string>();
  for (const e of inRange) {
    if (e.eventType === 'crew_work_day' && e.crew?.trim()) {
      crewNames.add(e.crew.trim());
    }
  }

  return {
    activeEvents: inRange.length,
    deliveries: inRange.filter((e) => DELIVERY_TYPES.has(e.eventType)).length,
    inspections: inRange.filter((e) => e.eventType === 'inspection').length,
    deadlines: inRange.filter((e) => DEADLINE_TYPES.has(e.eventType)).length,
    activeCrews: crewNames.size,
  };
}
