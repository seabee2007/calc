import { supabase } from '../lib/supabase';
import type {
  ProjectMilestoneKey,
  RecurrenceRule,
  ScheduleEvent,
  ScheduleEventActivityEntry,
  ScheduleEventComment,
  ScheduleEventDocument,
  ScheduleEventInput,
  ScheduleEventStatus,
  ScheduleEventType,
  SchedulePriority,
  ScheduleWeatherRisk,
} from '../types/scheduleEvent';
import { normalizeMilestoneKey } from '../types/scheduleEvent';
import { parseRecurrenceRule } from '../utils/scheduleRecurrenceUtils';
import {
  filterScheduleEvents,
  parseActivityLog,
  parseAssignedTo,
  parseComments,
  parseRelatedDocuments,
} from '../utils/scheduleEventUtils';
import type { ScheduleFilters } from '../types/scheduleEvent';

export function mapScheduleEvent(row: Record<string, unknown>): ScheduleEvent {
  const rawMilestone = row.milestone_key as string | null;
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    taskId: (row.task_id as string) ?? null,
    createdBy: row.created_by as string,
    title: row.title as string,
    notes: (row.notes as string) ?? null,
    eventType: row.event_type as ScheduleEventType,
    status: row.status as ScheduleEventStatus,
    priority: (row.priority as SchedulePriority) ?? 'medium',
    startDate: row.start_date as string,
    endDate: (row.end_date as string) ?? null,
    startTime: row.start_time != null ? String(row.start_time).slice(0, 5) : null,
    endTime: row.end_time != null ? String(row.end_time).slice(0, 5) : null,
    trade: (row.trade as string) ?? null,
    crew: (row.crew as string) ?? null,
    location: (row.location as string) ?? null,
    assignedTo: parseAssignedTo(row.assigned_to),
    relatedDocuments: parseRelatedDocuments(row.related_documents),
    relatedPhotos: parseRelatedDocuments(row.related_photos),
    activityLog: parseActivityLog(row.activity_log),
    comments: parseComments(row.comments),
    weatherRisk: (row.weather_risk as ScheduleWeatherRisk) ?? null,
    milestoneKey: normalizeMilestoneKey(rawMilestone) ?? rawMilestone,
    syncMetadata: (row.sync_metadata as Record<string, unknown>) ?? null,
    recurrenceRule: parseRecurrenceRule(row.recurrence_rule),
    recurrenceSeriesId: (row.recurrence_series_id as string) ?? null,
    recurrenceInstanceDate: row.recurrence_instance_date
      ? String(row.recurrence_instance_date).slice(0, 10)
      : null,
    recurrenceExceptionType:
      (row.recurrence_exception_type as ScheduleEvent['recurrenceExceptionType']) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function buildInsertPayload(input: ScheduleEventInput): Record<string, unknown> {
  const milestoneDb =
    input.milestoneKey === 'warranty_end' ? 'warranty_end' : input.milestoneKey ?? null;
  return {
    project_id: input.projectId,
    task_id: input.taskId ?? null,
    created_by: input.createdBy,
    title: input.title,
    notes: input.notes ?? null,
    event_type: input.eventType,
    status: input.status ?? 'scheduled',
    priority: input.priority ?? 'medium',
    start_date: input.startDate,
    end_date: input.endDate ?? null,
    start_time: input.startTime ?? null,
    end_time: input.endTime ?? null,
    trade: input.trade ?? null,
    crew: input.crew ?? null,
    location: input.location ?? null,
    assigned_to: input.assignedTo ?? [],
    related_documents: input.relatedDocuments ?? [],
    related_photos: input.relatedPhotos ?? [],
    weather_risk: input.weatherRisk ?? null,
    milestone_key: milestoneDb,
    recurrence_rule: input.recurrenceRule ?? null,
    sync_metadata: input.syncMetadata ?? null,
  };
}

export async function fetchScheduleEventsForProject(
  projectId: string,
): Promise<ScheduleEvent[]> {
  const { data, error } = await supabase
    .from('schedule_events')
    .select('*')
    .eq('project_id', projectId)
    .order('start_date', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapScheduleEvent);
}

export async function fetchScheduleEventsForProjectIds(
  projectIds: string[],
): Promise<ScheduleEvent[]> {
  if (projectIds.length === 0) return [];
  const { data, error } = await supabase
    .from('schedule_events')
    .select('*')
    .in('project_id', projectIds)
    .order('start_date', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapScheduleEvent);
}

function overlapsRange(
  row: { start_date: string; end_date: string | null },
  dateFrom: string,
  dateTo: string,
): boolean {
  const end = row.end_date ?? row.start_date;
  return row.start_date <= dateTo && end >= dateFrom;
}

export async function fetchScheduleEventsInDateRange(
  projectIds: string[],
  dateFrom: string,
  dateTo: string,
): Promise<ScheduleEvent[]> {
  if (projectIds.length === 0) return [];
  const [byStartRes, byEndRes] = await Promise.all([
    supabase
      .from('schedule_events')
      .select('*')
      .in('project_id', projectIds)
      .lte('start_date', dateTo)
      .order('start_date', { ascending: true }),
    supabase
      .from('schedule_events')
      .select('*')
      .in('project_id', projectIds)
      .gte('end_date', dateFrom)
      .order('start_date', { ascending: true }),
  ]);
  if (byStartRes.error) throw byStartRes.error;
  if (byEndRes.error) throw byEndRes.error;

  const recurringRes = await supabase
    .from('schedule_events')
    .select('*')
    .in('project_id', projectIds)
    .not('recurrence_rule', 'is', null)
    .lte('start_date', dateTo);

  const exceptionsRes = await supabase
    .from('schedule_events')
    .select('*')
    .in('project_id', projectIds)
    .not('recurrence_series_id', 'is', null)
    .gte('recurrence_instance_date', dateFrom)
    .lte('recurrence_instance_date', dateTo);

  if (recurringRes.error) throw recurringRes.error;
  if (exceptionsRes.error) throw exceptionsRes.error;

  const merged = new Map<string, Record<string, unknown>>();
  for (const row of [
    ...(byStartRes.data ?? []),
    ...(byEndRes.data ?? []),
    ...(recurringRes.data ?? []),
    ...(exceptionsRes.data ?? []),
  ]) {
    const id = row.id as string;
    if (!merged.has(id)) merged.set(id, row);
  }

  return [...merged.values()]
    .filter((row) => {
      if (row.recurrence_rule) {
        return (row.start_date as string) <= dateTo;
      }
      return overlapsRange(
        row as { start_date: string; end_date: string | null },
        dateFrom,
        dateTo,
      );
    })
    .map(mapScheduleEvent)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export async function fetchScheduleEventById(
  eventId: string,
): Promise<ScheduleEvent | null> {
  const { data, error } = await supabase
    .from('schedule_events')
    .select('*')
    .eq('id', eventId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapScheduleEvent(data) : null;
}

export async function createScheduleEvent(
  input: ScheduleEventInput,
  activityUserId?: string,
): Promise<ScheduleEvent> {
  const { data, error } = await supabase
    .from('schedule_events')
    .insert(buildInsertPayload(input))
    .select('*')
    .single();
  if (error) throw error;
  const event = mapScheduleEvent(data);
  if (activityUserId) {
    return appendScheduleEventActivity(event.id, {
      userId: activityUserId,
      action: 'created',
      detail: 'Event created',
    });
  }
  return event;
}

export async function updateScheduleEvent(
  eventId: string,
  updates: Partial<{
    title: string;
    notes: string | null;
    eventType: ScheduleEventType;
    status: ScheduleEventStatus;
    priority: SchedulePriority;
    startDate: string;
    endDate: string | null;
    startTime: string | null;
    endTime: string | null;
    trade: string | null;
    crew: string | null;
    location: string | null;
    assignedTo: string[];
    relatedDocuments: ScheduleEventDocument[];
    relatedPhotos: ScheduleEventDocument[];
    weatherRisk: ScheduleWeatherRisk | null;
    milestoneKey: ProjectMilestoneKey | string | null;
    taskId: string | null;
    activityLog: ScheduleEventActivityEntry[];
    comments: ScheduleEventComment[];
    recurrenceRule: RecurrenceRule | null;
    syncMetadata: Record<string, unknown> | null;
  }>,
): Promise<ScheduleEvent> {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.notes !== undefined) payload.notes = updates.notes;
  if (updates.eventType !== undefined) payload.event_type = updates.eventType;
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.priority !== undefined) payload.priority = updates.priority;
  if (updates.startDate !== undefined) payload.start_date = updates.startDate;
  if (updates.endDate !== undefined) payload.end_date = updates.endDate;
  if (updates.startTime !== undefined) payload.start_time = updates.startTime;
  if (updates.endTime !== undefined) payload.end_time = updates.endTime;
  if (updates.trade !== undefined) payload.trade = updates.trade;
  if (updates.crew !== undefined) payload.crew = updates.crew;
  if (updates.location !== undefined) payload.location = updates.location;
  if (updates.assignedTo !== undefined) payload.assigned_to = updates.assignedTo;
  if (updates.relatedDocuments !== undefined) {
    payload.related_documents = updates.relatedDocuments;
  }
  if (updates.relatedPhotos !== undefined) payload.related_photos = updates.relatedPhotos;
  if (updates.weatherRisk !== undefined) payload.weather_risk = updates.weatherRisk;
  if (updates.milestoneKey !== undefined) {
    payload.milestone_key =
      updates.milestoneKey === 'warranty_end' ? 'warranty_end' : updates.milestoneKey;
  }
  if (updates.taskId !== undefined) payload.task_id = updates.taskId;
  if (updates.activityLog !== undefined) payload.activity_log = updates.activityLog;
  if (updates.comments !== undefined) payload.comments = updates.comments;
  if (updates.recurrenceRule !== undefined) {
    payload.recurrence_rule = updates.recurrenceRule;
  }
  if (updates.syncMetadata !== undefined) {
    payload.sync_metadata = updates.syncMetadata;
  }

  const { data, error } = await supabase
    .from('schedule_events')
    .update(payload)
    .eq('id', eventId)
    .select('*')
    .single();
  if (error) throw error;
  return mapScheduleEvent(data);
}

export async function deleteScheduleEvent(eventId: string): Promise<void> {
  const { error } = await supabase.from('schedule_events').delete().eq('id', eventId);
  if (error) throw error;
}

export async function markScheduleEventComplete(
  eventId: string,
  userId?: string,
): Promise<ScheduleEvent> {
  const event = await updateScheduleEvent(eventId, { status: 'completed' });
  if (userId) {
    return appendScheduleEventActivity(eventId, {
      userId,
      action: 'completed',
      detail: 'Marked complete',
    });
  }
  return event;
}

export async function rescheduleScheduleEvent(
  eventId: string,
  startDate: string,
  endDate?: string | null,
  startTime?: string | null,
  endTime?: string | null,
  userId?: string,
): Promise<ScheduleEvent> {
  const event = await updateScheduleEvent(eventId, {
    startDate,
    endDate: endDate ?? null,
    startTime: startTime ?? null,
    endTime: endTime ?? null,
    status: 'scheduled',
  });
  if (userId) {
    return appendScheduleEventActivity(eventId, {
      userId,
      action: 'rescheduled',
      detail: `Moved to ${startDate}`,
    });
  }
  return event;
}

export async function appendScheduleEventActivity(
  eventId: string,
  entry: { userId: string; action: string; detail?: string },
): Promise<ScheduleEvent> {
  const existing = await fetchScheduleEventById(eventId);
  if (!existing) throw new Error('Event not found');
  const newEntry: ScheduleEventActivityEntry = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    userId: entry.userId,
    action: entry.action,
    detail: entry.detail,
  };
  return updateScheduleEvent(eventId, {
    activityLog: [...existing.activityLog, newEntry],
  });
}

export async function addScheduleEventComment(
  eventId: string,
  userId: string,
  body: string,
): Promise<ScheduleEvent> {
  const existing = await fetchScheduleEventById(eventId);
  if (!existing) throw new Error('Event not found');
  const comment: ScheduleEventComment = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    userId,
    body: body.trim(),
  };
  const updated = await updateScheduleEvent(eventId, {
    comments: [...existing.comments, comment],
  });
  await appendScheduleEventActivity(eventId, {
    userId,
    action: 'comment',
    detail: 'Comment added',
  });
  return updated;
}

export async function duplicateScheduleEvent(
  eventId: string,
  createdBy: string,
): Promise<ScheduleEvent> {
  const source = await fetchScheduleEventById(eventId);
  if (!source) throw new Error('Event not found');
  return createScheduleEvent(
    {
      projectId: source.projectId,
      createdBy,
      title: `${source.title} (copy)`,
      notes: source.notes,
      eventType: source.eventType,
      status: 'scheduled',
      priority: source.priority,
      startDate: source.startDate,
      endDate: source.endDate,
      startTime: source.startTime,
      endTime: source.endTime,
      trade: source.trade,
      crew: source.crew,
      location: source.location,
      assignedTo: [...source.assignedTo],
      relatedDocuments: [...source.relatedDocuments],
      relatedPhotos: [...source.relatedPhotos],
      weatherRisk: source.weatherRisk,
      milestoneKey: source.milestoneKey,
    },
    createdBy,
  );
}

export function enrichEventsWithProjectNames(
  events: ScheduleEvent[],
  projectNameById: Map<string, string>,
): ScheduleEvent[] {
  return events.map((e) => ({
    ...e,
    projectName: projectNameById.get(e.projectId) ?? e.projectName ?? 'Project',
  }));
}

export function applyScheduleFilters(
  events: ScheduleEvent[],
  filters: Partial<ScheduleFilters>,
): ScheduleEvent[] {
  return filterScheduleEvents(events, filters);
}

export function exportScheduleToICS(events: ScheduleEvent[]): string {
  void events;
  throw new Error('ICS export is not available yet');
}
