import { supabase } from '../lib/supabase';
import type { FieldNotification } from '../types/fieldPlanner';

function mapNotification(row: Record<string, unknown>): FieldNotification {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    projectId: (row.project_id as string) ?? null,
    taskId: (row.task_id as string) ?? null,
    type: row.type as string,
    title: row.title as string,
    body: (row.body as string) ?? null,
    href: (row.href as string) ?? null,
    isRead: row.is_read as boolean,
    createdAt: row.created_at as string,
  };
}

export async function createNotification(input: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  href?: string;
  projectId?: string;
  taskId?: string;
}) {
  const { data, error } = await supabase
    .from('field_notifications')
    .insert({
      user_id: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      href: input.href ?? null,
      project_id: input.projectId ?? null,
      task_id: input.taskId ?? null,
    })
    .select('*')
    .single();
  if (error) {
    if (error.code === 'PGRST205') return null;
    throw error;
  }
  return mapNotification(data);
}

export async function fetchNotifications(userId: string, limit = 30) {
  const { data, error } = await supabase
    .from('field_notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (error.code === 'PGRST205') return [];
    throw error;
  }
  return (data ?? []).map(mapNotification);
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase
    .from('field_notifications')
    .update({ is_read: true })
    .eq('id', id);
  if (error) throw error;
}
