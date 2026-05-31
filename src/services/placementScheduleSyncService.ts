import { supabase } from '../lib/supabase';
import type { ScheduleEvent, ScheduleWeatherRisk } from '../types/scheduleEvent';
import { placementDateYmdFromIso } from '../utils/placementPourDate';
import {
  createScheduleEvent,
  fetchScheduleEventsForProject,
  updateScheduleEvent,
} from './scheduleEventService';

/** Identifies schedule rows auto-managed from Placement Planner pour date. */
export const PLACEMENT_POUR_SCHEDULE_SYNC_KEY = 'placement_planner_pour';

export function isPlacementPourScheduleEvent(event: ScheduleEvent): boolean {
  return event.syncMetadata?.syncKey === PLACEMENT_POUR_SCHEDULE_SYNC_KEY;
}

/** Calendar date (YYYY-MM-DD) from project pour_date ISO string (local timezone). */
export function pourDateIsoToScheduleDate(pourDateIso: string): string {
  const ymd = placementDateYmdFromIso(pourDateIso);
  if (!ymd) throw new Error('Invalid placement date');
  return ymd;
}

function normalizeScheduleTime(time: string | null | undefined): string | null {
  if (!time?.trim()) return null;
  const t = time.trim();
  const match = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!match) return null;
  const h = Math.min(23, Math.max(0, parseInt(match[1], 10)));
  const min = Math.min(59, Math.max(0, parseInt(match[2], 10)));
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function buildPlacementPourNotes(options: {
  volumeYd?: number;
  extraNotes?: string | null;
}): string {
  const lines = ['Synced from Placement Planner.'];
  if (options.volumeYd != null && options.volumeYd > 0) {
    lines.push(`Planned volume: ${options.volumeYd.toFixed(1)} yd³`);
  }
  if (options.extraNotes?.trim()) {
    lines.push(options.extraNotes.trim());
  }
  return lines.join('\n');
}

export interface SyncPlacementPourScheduleParams {
  projectId: string;
  projectName: string;
  pourDateIso: string;
  /** When omitted, uses the signed-in Supabase user. */
  userId?: string;
  location?: string | null;
  startTime?: string | null;
  weatherRisk?: ScheduleWeatherRisk | null;
  volumeYd?: number;
  extraNotes?: string | null;
}

async function resolveScheduleUserId(userId?: string): Promise<string> {
  if (userId) return userId;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Not authenticated');
  return data.user.id;
}

/**
 * Creates or updates the project's planner calendar event for a saved placement date.
 */
export async function syncPlacementPourToSchedule(
  params: SyncPlacementPourScheduleParams,
): Promise<ScheduleEvent> {
  const createdBy = await resolveScheduleUserId(params.userId);
  const startDate = pourDateIsoToScheduleDate(params.pourDateIso);
  const startTime = normalizeScheduleTime(params.startTime);
  const title = params.projectName.trim()
    ? `Concrete placement — ${params.projectName.trim()}`
    : 'Concrete placement';
  const notes = buildPlacementPourNotes({
    volumeYd: params.volumeYd,
    extraNotes: params.extraNotes,
  });
  const syncMetadata = { syncKey: PLACEMENT_POUR_SCHEDULE_SYNC_KEY };

  const existing = (await fetchScheduleEventsForProject(params.projectId)).find(
    isPlacementPourScheduleEvent,
  );

  if (existing) {
    return updateScheduleEvent(existing.id, {
      title,
      notes,
      eventType: 'material_delivery',
      status: existing.status === 'completed' ? 'completed' : 'scheduled',
      priority: 'high',
      startDate,
      endDate: startDate,
      startTime,
      endTime: null,
      location: params.location ?? existing.location,
      weatherRisk: params.weatherRisk ?? existing.weatherRisk,
      syncMetadata,
    });
  }

  return createScheduleEvent(
    {
      projectId: params.projectId,
      createdBy,
      title,
      notes,
      eventType: 'material_delivery',
      status: 'scheduled',
      priority: 'high',
      startDate,
      endDate: startDate,
      startTime,
      location: params.location ?? null,
      weatherRisk: params.weatherRisk ?? null,
      syncMetadata,
    },
    createdBy,
  );
}
