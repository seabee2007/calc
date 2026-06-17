import type { ScheduleEvent } from '../types/scheduleEvent';
import { buildScheduleDashboardSnapshot } from '../utils/scheduleDashboard';
import { toIsoDate } from '../utils/scheduleEventUtils';
import { fetchScheduleEventsForProjectIds } from './scheduleEventService';
import { notifyDeadlineDue, notifyScheduleAttention } from './notificationEventService';
import { getNotificationPreferences } from './notificationPreferenceService';
import { supabase } from '../lib/supabase';

const DEADLINE_TYPES = new Set([
  'bid_due_date',
  'proposal_due',
  'change_order_deadline',
  'permit_deadline',
  'submittal_due',
  'rfi_due',
]);

function formatDueDateLabel(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

async function ownerProjectIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from('projects').select('id').eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map((row) => row.id as string);
}

export async function runNotificationReminderChecksForOwner(userId: string): Promise<void> {
  const prefs = await getNotificationPreferences();
  if (prefs && !prefs.projectRemindersEnabled) return;

  const projectIds = await ownerProjectIds(userId);
  if (projectIds.length === 0) return;

  const events = await fetchScheduleEventsForProjectIds(projectIds);
  const todayIso = toIsoDate(new Date());
  const snapshot = buildScheduleDashboardSnapshot(events, todayIso);

  for (const event of snapshot.upcomingDeadlines) {
    await notifyDeadlineDue({
      projectId: event.projectId,
      scheduleEventId: event.id,
      title: event.title,
      dueDate: formatDueDateLabel(event.startDate),
      reminderDate: event.startDate,
    });
  }

  const overdueDeadlines = events.filter(
    (event) =>
      DEADLINE_TYPES.has(event.eventType) &&
      event.startDate < todayIso &&
      event.status !== 'completed' &&
      event.status !== 'cancelled',
  );

  for (const event of overdueDeadlines) {
    await notifyDeadlineDue({
      projectId: event.projectId,
      scheduleEventId: event.id,
      title: event.title,
      dueDate: formatDueDateLabel(event.startDate),
      reminderDate: `${event.startDate}:overdue`,
    });
  }

  const attentionByProject = new Map<string, ScheduleEvent[]>();
  for (const event of overdueDeadlines) {
    const list = attentionByProject.get(event.projectId) ?? [];
    list.push(event);
    attentionByProject.set(event.projectId, list);
  }

  const delayed = events.filter(
    (event) =>
      event.status === 'delayed' &&
      event.startDate <= todayIso &&
      event.status !== 'cancelled',
  );
  for (const event of delayed) {
    const list = attentionByProject.get(event.projectId) ?? [];
    list.push(event);
    attentionByProject.set(event.projectId, list);
  }

  for (const [projectId, projectEvents] of attentionByProject.entries()) {
    const count = projectEvents.length;
    await notifyScheduleAttention({
      projectId,
      sourceId: `${todayIso}:${projectId}`,
      reminderDate: todayIso,
      message: `${count} schedule item${count === 1 ? '' : 's'} on this project need review.`,
    });
  }
}
