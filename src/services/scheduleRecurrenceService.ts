import { supabase } from '../lib/supabase';
import type {
  RecurrenceEditScope,
  ScheduleEvent,
  ScheduleEventInput,
} from '../types/scheduleEvent';
import {
  clipRecurrenceRuleBeforeDate,
  parseRecurrenceInstanceId,
} from '../utils/scheduleRecurrenceUtils';
import { addDays } from '../utils/scheduleEventUtils';
import {
  appendScheduleEventActivity,
  createScheduleEvent,
  deleteScheduleEvent,
  fetchScheduleEventById,
  mapScheduleEvent,
  updateScheduleEvent,
} from './scheduleEventService';

function eventFieldsFromInput(input: ScheduleEventInput) {
  return {
    title: input.title,
    notes: input.notes ?? null,
    eventType: input.eventType,
    status: input.status ?? 'scheduled',
    priority: input.priority ?? 'medium',
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    startTime: input.startTime ?? null,
    endTime: input.endTime ?? null,
    trade: input.trade ?? null,
    crew: input.crew ?? null,
    location: input.location ?? null,
    assignedTo: input.assignedTo ?? [],
    relatedDocuments: input.relatedDocuments ?? [],
    relatedPhotos: input.relatedPhotos ?? [],
    weatherRisk: input.weatherRisk ?? null,
    milestoneKey: input.milestoneKey ?? null,
  };
}

export async function resolveScheduleEventForEdit(
  eventId: string,
  occurrenceDate?: string,
): Promise<{ master: ScheduleEvent; occurrenceDate: string | null }> {
  const parsed = parseRecurrenceInstanceId(eventId);
  if (parsed) {
    const master = await fetchScheduleEventById(parsed.seriesId);
    if (!master) throw new Error('Series not found');
    return { master, occurrenceDate: parsed.occurrenceDate };
  }
  const row = await fetchScheduleEventById(eventId);
  if (!row) throw new Error('Event not found');
  if (row.recurrenceSeriesId && row.recurrenceInstanceDate) {
    const master = await fetchScheduleEventById(row.recurrenceSeriesId);
    if (!master) throw new Error('Series not found');
    return { master, occurrenceDate: row.recurrenceInstanceDate };
  }
  return { master: row, occurrenceDate: occurrenceDate ?? null };
}

async function upsertModifiedException(
  seriesId: string,
  instanceDate: string,
  input: ScheduleEventInput,
  userId?: string,
): Promise<ScheduleEvent> {
  const { data: existing } = await supabase
    .from('schedule_events')
    .select('id')
    .eq('recurrence_series_id', seriesId)
    .eq('recurrence_instance_date', instanceDate)
    .maybeSingle();

  const fields = eventFieldsFromInput(input);
  const payload = {
    ...fields,
    project_id: input.projectId,
    start_date: instanceDate,
    end_date: input.endDate ?? null,
    recurrence_series_id: seriesId,
    recurrence_instance_date: instanceDate,
    recurrence_exception_type: 'modified',
    recurrence_rule: null,
  };

  if (existing?.id) {
    return updateScheduleEvent(existing.id as string, fields);
  }

  const master = await fetchScheduleEventById(seriesId);
  if (!master) throw new Error('Series not found');
  const { data, error } = await supabase
    .from('schedule_events')
    .insert({
      ...payload,
      task_id: input.taskId ?? null,
      created_by: input.createdBy,
    })
    .select('*')
    .single();
  if (error) throw error;
  const event = mapScheduleEvent(data);
  if (userId) {
    await appendScheduleEventActivity(seriesId, {
      userId,
      action: 'recurrence_exception',
      detail: `Modified occurrence ${instanceDate}`,
    });
  }
  return event;
}

async function upsertDeletedException(
  seriesId: string,
  instanceDate: string,
  projectId: string,
  createdBy: string,
): Promise<void> {
  const master = await fetchScheduleEventById(seriesId);
  if (!master) return;

  const { data: existing } = await supabase
    .from('schedule_events')
    .select('id')
    .eq('recurrence_series_id', seriesId)
    .eq('recurrence_instance_date', instanceDate)
    .maybeSingle();

  if (existing?.id) {
    await supabase
      .from('schedule_events')
      .update({
        recurrence_exception_type: 'deleted',
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
    return;
  }

  await supabase.from('schedule_events').insert({
    project_id: projectId,
    created_by: createdBy,
    title: master.title,
    event_type: master.eventType,
    status: 'cancelled',
    priority: master.priority,
    start_date: instanceDate,
    end_date: null,
    recurrence_series_id: seriesId,
    recurrence_instance_date: instanceDate,
    recurrence_exception_type: 'deleted',
    assigned_to: [],
    related_documents: [],
    related_photos: [],
    activity_log: [],
    comments: [],
  });
}

export async function saveRecurringScheduleEvent(
  input: ScheduleEventInput,
  options: {
    editingEventId?: string;
    occurrenceDate?: string;
    scope?: RecurrenceEditScope;
    userId: string;
  },
): Promise<ScheduleEvent> {
  const { editingEventId, occurrenceDate, scope = 'entire_series', userId } = options;

  if (!editingEventId) {
    return createScheduleEvent(
      { ...input, recurrenceRule: input.recurrenceRule ?? null },
      userId,
    );
  }

  const { master, occurrenceDate: resolvedOcc } = await resolveScheduleEventForEdit(
    editingEventId,
    occurrenceDate,
  );
  const occ = resolvedOcc ?? occurrenceDate ?? input.startDate;
  const isSeries = !!master.recurrenceRule && !master.recurrenceSeriesId;

  if (!isSeries) {
    const realId = master.recurrenceSeriesId ? master.id : editingEventId;
    return updateScheduleEvent(realId, {
      ...eventFieldsFromInput(input),
      recurrenceRule: input.recurrenceRule ?? null,
    });
  }

  const fields = eventFieldsFromInput(input);

  if (scope === 'this') {
    return upsertModifiedException(master.id, occ, input, userId);
  }

  if (scope === 'this_and_future') {
    const clipped = clipRecurrenceRuleBeforeDate(master.recurrenceRule!, occ);
    await updateScheduleEvent(master.id, { recurrenceRule: clipped });

    const span =
      master.endDate && master.endDate > master.startDate
        ? Math.round(
            (new Date(master.endDate + 'T12:00:00').getTime() -
              new Date(master.startDate + 'T12:00:00').getTime()) /
              86400000,
          )
        : 0;

    return createScheduleEvent(
      {
        ...input,
        startDate: occ,
        endDate: span > 0 ? addDays(occ, span) : input.endDate ?? null,
        recurrenceRule: input.recurrenceRule ?? master.recurrenceRule,
        createdBy: userId,
      },
      userId,
    );
  }

  await updateScheduleEvent(master.id, {
    ...fields,
    recurrenceRule: input.recurrenceRule ?? master.recurrenceRule ?? null,
  });

  return fetchScheduleEventById(master.id) as Promise<ScheduleEvent>;
}

export async function deleteRecurringScheduleEvent(
  eventId: string,
  scope: RecurrenceEditScope,
  options: { occurrenceDate?: string; userId: string },
): Promise<void> {
  const { master, occurrenceDate: resolvedOcc } = await resolveScheduleEventForEdit(
    eventId,
    options.occurrenceDate,
  );
  const occ = resolvedOcc ?? options.occurrenceDate;
  const isSeries = !!master.recurrenceRule && !master.recurrenceSeriesId;

  if (!isSeries || scope === 'entire_series') {
    if (isSeries) {
      await supabase
        .from('schedule_events')
        .delete()
        .eq('recurrence_series_id', master.id);
    }
    await deleteScheduleEvent(master.id);
    return;
  }

  if (!occ) throw new Error('Occurrence date required');

  if (scope === 'this') {
    await upsertDeletedException(master.id, occ, master.projectId, options.userId);
    return;
  }

  if (scope === 'this_and_future') {
    const clipped = clipRecurrenceRuleBeforeDate(master.recurrenceRule!, occ);
    await updateScheduleEvent(master.id, { recurrenceRule: clipped });
  }
}
