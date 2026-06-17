import { supabase } from '../lib/supabase';
import type {
  AppNotification,
  NotificationSeverity,
  NotificationSourceMetadata,
  NotificationType,
} from '../lib/notificationTypes';
import { isUnreadNotification } from '../lib/notificationTypes';
import type { FieldNotification } from '../types/fieldPlanner';

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  return error?.code === 'PGRST205' || Boolean(error?.message?.includes('notifications'));
}

function mapNotification(row: Record<string, unknown>): AppNotification {
  return {
    id: row.id as string,
    userId: (row.user_id as string) ?? null,
    employerId: (row.employer_id as string) ?? null,
    projectId: (row.project_id as string) ?? null,
    createdBy: (row.created_by as string) ?? null,
    type: row.type as NotificationType,
    severity: (row.severity as AppNotification['severity']) ?? 'info',
    channel: (row.channel as AppNotification['channel']) ?? 'in_app',
    title: row.title as string,
    message: row.message as string,
    actionLabel: (row.action_label as string) ?? null,
    actionUrl: (row.action_url as string) ?? null,
    metadata: (row.metadata as NotificationSourceMetadata) ?? {},
    readAt: (row.read_at as string) ?? null,
    dismissedAt: (row.dismissed_at as string) ?? null,
    emailedAt: (row.emailed_at as string) ?? null,
    expiresAt: (row.expires_at as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/** Backward-compatible shape for existing bell/tests. */
export function toFieldNotification(notification: AppNotification): FieldNotification {
  return {
    id: notification.id,
    userId: notification.userId ?? '',
    projectId: notification.projectId,
    taskId: notification.metadata.taskId ?? null,
    type: notification.type,
    title: notification.title,
    body: notification.message,
    href: notification.actionUrl,
    isRead: !isUnreadNotification(notification),
    createdAt: notification.createdAt,
  };
}

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType | string;
  title: string;
  message: string;
  severity?: NotificationSeverity;
  actionLabel?: string;
  actionUrl?: string;
  projectId?: string;
  employerId?: string;
  taskId?: string;
  metadata?: NotificationSourceMetadata;
}

export async function createNotification(input: CreateNotificationInput): Promise<AppNotification | null> {
  const metadata: NotificationSourceMetadata = {
    ...input.metadata,
    ...(input.taskId ? { taskId: input.taskId } : {}),
    recipientUserId: input.userId,
  };

  const { data, error } = await supabase.rpc('create_app_notification', {
    p_user_id: input.userId,
    p_project_id: input.projectId ?? null,
    p_type: input.type,
    p_severity: input.severity ?? 'info',
    p_title: input.title,
    p_message: input.message,
    p_action_label: input.actionLabel ?? null,
    p_action_url: input.actionUrl ?? null,
    p_metadata: metadata,
    p_employer_id: input.employerId ?? null,
  });

  if (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }

  if (!data) return null;

  const { data: row, error: fetchError } = await supabase
    .from('notifications')
    .select('*')
    .eq('id', data as string)
    .maybeSingle();

  if (fetchError) {
    if (isMissingTableError(fetchError)) return null;
    throw fetchError;
  }

  return row ? mapNotification(row as Record<string, unknown>) : null;
}

export async function listNotifications(userId: string, limit = 30): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .is('dismissed_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }

  return (data ?? []).map((row) => mapNotification(row as Record<string, unknown>));
}

/** Backward-compatible alias. */
export async function fetchNotifications(userId: string, limit = 30): Promise<FieldNotification[]> {
  const rows = await listNotifications(userId, limit);
  return rows.map(toFieldNotification);
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null)
    .is('dismissed_at', null);

  if (error) {
    if (isMissingTableError(error)) return 0;
    throw error;
  }

  return count ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null)
    .is('dismissed_at', null);
  if (error) throw error;
}

export async function dismissNotification(id: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('notifications')
    .update({ dismissed_at: now, read_at: now })
    .eq('id', id);
  if (error) throw error;
}

export async function hasExistingNotification(input: {
  userId: string;
  type: string;
  sourceType: string;
  sourceId: string;
  reminderDate?: string;
}): Promise<boolean> {
  let query = supabase
    .from('notifications')
    .select('id')
    .eq('user_id', input.userId)
    .eq('type', input.type)
    .filter('metadata->>sourceType', 'eq', input.sourceType)
    .filter('metadata->>sourceId', 'eq', input.sourceId)
    .limit(1);

  if (input.reminderDate) {
    query = query.filter('metadata->>reminderDate', 'eq', input.reminderDate);
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingTableError(error)) return false;
    throw error;
  }

  return (data?.length ?? 0) > 0;
}

export async function listOwnerAttentionNotifications(
  userId: string,
  limit = 5,
): Promise<AppNotification[]> {
  const rows = await listNotifications(userId, 50);
  return rows
    .filter((row) => isUnreadNotification(row))
    .filter((row) => {
      if (!['warning', 'danger'].includes(row.severity) && row.type !== 'employee_message') {
        return false;
      }
      return ['employee_message', 'document_needs_review', 'deadline_due', 'schedule_attention'].includes(
        row.type,
      );
    })
    .slice(0, limit);
}
