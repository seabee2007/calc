import { supabase } from '../lib/supabase';
import type { FieldMessage } from '../types/fieldPlanner';
import { buildProfileNameMap, nameFromMap } from './profileService';

function mapMessage(row: Record<string, unknown>): FieldMessage {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    taskId: (row.task_id as string) ?? null,
    senderId: row.sender_id as string,
    recipientId: (row.recipient_id as string) ?? null,
    message: row.message as string,
    urgency: row.urgency as string,
    isRead: row.is_read as boolean,
    createdAt: row.created_at as string,
  };
}

export async function fetchMessagesForUser(
  userId: string,
  asOwner: boolean,
): Promise<FieldMessage[]> {
  let query = supabase.from('field_messages').select('*').order('created_at', { ascending: false });

  if (asOwner) {
    const { data: projects } = await supabase.from('projects').select('id, name').eq('user_id', userId);
    const ids = (projects ?? []).map((p) => p.id as string);
    if (ids.length === 0) return [];
    query = query.in('project_id', ids);
  } else {
    const { data: assignments } = await supabase
      .from('employee_project_assignments')
      .select('project_id')
      .eq('employee_id', userId);
    const ids = (assignments ?? []).map((a) => a.project_id as string);
    if (ids.length === 0) return [];
    query = query.in('project_id', ids);
  }

  const { data, error } = await query.limit(50);
  if (error) throw error;

  const messages = (data ?? []).map(mapMessage);
  const senderIds = messages.map((m) => m.senderId);
  const nameMap = await buildProfileNameMap(senderIds);

  const projectIds = [...new Set(messages.map((m) => m.projectId))];
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name')
    .in('id', projectIds);
  const projectNames = new Map((projects ?? []).map((p) => [p.id as string, p.name as string]));

  return messages.map((m) => ({
    ...m,
    senderName: nameFromMap(nameMap, m.senderId),
    projectName: projectNames.get(m.projectId) ?? 'Project',
  }));
}

export async function sendFieldMessage(input: {
  projectId: string;
  senderId: string;
  message: string;
  recipientId?: string | null;
  taskId?: string | null;
  urgency?: string;
}) {
  const { data, error } = await supabase
    .from('field_messages')
    .insert({
      project_id: input.projectId,
      sender_id: input.senderId,
      recipient_id: input.recipientId ?? null,
      task_id: input.taskId ?? null,
      message: input.message,
      urgency: input.urgency ?? 'Normal',
    })
    .select('*')
    .single();
  if (error) throw error;
  const message = mapMessage(data);

  try {
    const { notifyEmployeeMessage } = await import('./notificationEventService');
    await notifyEmployeeMessage({
      projectId: input.projectId,
      senderId: input.senderId,
      messageId: message.id,
      recipientId: input.recipientId,
      taskId: input.taskId,
      messagePreview: input.message,
    });
  } catch (notificationError) {
    if (import.meta.env.DEV) {
      console.error('[Notifications] Failed after field message send', notificationError);
    }
  }

  return message;
}

export async function markMessageRead(messageId: string) {
  const { error } = await supabase
    .from('field_messages')
    .update({ is_read: true })
    .eq('id', messageId);
  if (error) throw error;
}
