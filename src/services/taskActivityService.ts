import { supabase } from '../lib/supabase';
import { plannerBoardHref } from '../utils/plannerRoutes';
import type { TaskAttachment, TaskChecklistItem, TaskComment } from '../types/fieldPlanner';
import { buildProfileNameMap, nameFromMap } from './profileService';

function mapComment(row: Record<string, unknown>): TaskComment {
  return {
    id: row.id as string,
    taskId: row.task_id as string,
    projectId: row.project_id as string,
    userId: row.user_id as string,
    comment: row.comment as string,
    isOwnerVisible: row.is_owner_visible as boolean,
    createdAt: row.created_at as string,
  };
}

function mapChecklist(row: Record<string, unknown>): TaskChecklistItem {
  return {
    id: row.id as string,
    taskId: row.task_id as string,
    title: row.title as string,
    isCompleted: row.is_completed as boolean,
    position: row.position as number,
    completedBy: (row.completed_by as string) ?? null,
    completedAt: (row.completed_at as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function mapAttachment(row: Record<string, unknown>): TaskAttachment {
  return {
    id: row.id as string,
    taskId: row.task_id as string,
    projectId: row.project_id as string,
    uploadedBy: row.uploaded_by as string,
    fileName: row.file_name as string,
    fileUrl: row.file_url as string,
    fileType: (row.file_type as string) ?? null,
    attachmentType: (row.attachment_type as string) ?? 'photo',
    createdAt: row.created_at as string,
  };
}

export async function fetchTaskComments(taskId: string): Promise<TaskComment[]> {
  const { data, error } = await supabase
    .from('task_comments')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at');

  if (error) throw error;
  const comments = (data ?? []).map(mapComment);
  const nameMap = await buildProfileNameMap(comments.map((c) => c.userId));
  return comments.map((c) => ({
    ...c,
    authorName: nameFromMap(nameMap, c.userId),
  }));
}

export async function addTaskComment(
  taskId: string,
  projectId: string,
  userId: string,
  comment: string,
) {
  const { data, error } = await supabase
    .from('task_comments')
    .insert({
      task_id: taskId,
      project_id: projectId,
      user_id: userId,
      comment,
    })
    .select('*')
    .single();
  if (error) throw error;
  const savedComment = mapComment(data);

  try {
    const { notifyFieldActivity } = await import('./notificationEventService');
    await notifyFieldActivity({
      projectId,
      employeeUserId: userId,
      summary: savedComment.comment,
      sourceType: 'task_comment',
      sourceId: savedComment.id,
      taskId,
      actionUrl: plannerBoardHref(projectId, taskId),
    });
  } catch (notificationError) {
    if (import.meta.env.DEV) {
      console.error('[Notifications] Failed after task comment', notificationError);
    }
  }

  return savedComment;
}

export async function fetchChecklistItems(taskId: string): Promise<TaskChecklistItem[]> {
  const { data, error } = await supabase
    .from('task_checklist_items')
    .select('*')
    .eq('task_id', taskId)
    .order('position');
  if (error) throw error;
  return (data ?? []).map(mapChecklist);
}

export async function addChecklistItem(taskId: string, title: string, position: number) {
  const { data, error } = await supabase
    .from('task_checklist_items')
    .insert({ task_id: taskId, title, position })
    .select('*')
    .single();
  if (error) throw error;
  return mapChecklist(data);
}

export async function toggleChecklistItem(
  itemId: string,
  isCompleted: boolean,
  userId: string,
) {
  const { data, error } = await supabase
    .from('task_checklist_items')
    .update({
      is_completed: isCompleted,
      completed_by: isCompleted ? userId : null,
      completed_at: isCompleted ? new Date().toISOString() : null,
    })
    .eq('id', itemId)
    .select('*')
    .single();
  if (error) throw error;
  return mapChecklist(data);
}

export async function deleteChecklistItem(itemId: string) {
  const { error } = await supabase.from('task_checklist_items').delete().eq('id', itemId);
  if (error) throw error;
}

export async function fetchTaskAttachments(taskId: string): Promise<TaskAttachment[]> {
  const { data, error } = await supabase
    .from('task_attachments')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapAttachment);
}

export async function addTaskAttachmentRecord(input: {
  taskId: string;
  projectId: string;
  uploadedBy: string;
  fileName: string;
  fileUrl: string;
  fileType?: string;
  attachmentType?: string;
}) {
  const { data, error } = await supabase
    .from('task_attachments')
    .insert({
      task_id: input.taskId,
      project_id: input.projectId,
      uploaded_by: input.uploadedBy,
      file_name: input.fileName,
      file_url: input.fileUrl,
      file_type: input.fileType ?? null,
      attachment_type: input.attachmentType ?? 'photo',
    })
    .select('*')
    .single();
  if (error) throw error;
  const attachment = mapAttachment(data);

  try {
    const { notifyFieldActivity } = await import('./notificationEventService');
    await notifyFieldActivity({
      projectId: input.projectId,
      employeeUserId: input.uploadedBy,
      summary: input.fileName,
      sourceType: 'task_attachment',
      sourceId: attachment.id,
      taskId: input.taskId,
    });
  } catch (notificationError) {
    if (import.meta.env.DEV) {
      console.error('[Notifications] Failed after task attachment', notificationError);
    }
  }

  return attachment;
}
