import { supabase } from '../lib/supabase';
import {
  DEFAULT_BUCKET_TITLES,
  type PlannerBoard,
  type PlannerBoardBundle,
  type PlannerBucket,
  type PlannerTask,
  type TaskPriority,
  type TaskStatus,
} from '../types/fieldPlanner';
import { buildProfileNameMap, nameFromMap } from './profileService';
import { plannerBoardHref } from '../utils/plannerRoutes';

function mapBoard(row: Record<string, unknown>): PlannerBoard {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    ownerId: row.owner_id as string,
    title: row.title as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapBucket(row: Record<string, unknown>): PlannerBucket {
  return {
    id: row.id as string,
    boardId: row.board_id as string,
    title: row.title as string,
    position: row.position as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapTask(row: Record<string, unknown>): PlannerTask {
  return {
    id: row.id as string,
    boardId: row.board_id as string,
    bucketId: row.bucket_id as string,
    projectId: row.project_id as string,
    title: row.title as string,
    description: (row.description as string) ?? null,
    assignedTo: (row.assigned_to as string) ?? null,
    createdBy: (row.created_by as string) ?? null,
    status: row.status as TaskStatus,
    priority: row.priority as TaskPriority,
    startDate: (row.start_date as string) ?? null,
    dueDate: (row.due_date as string) ?? null,
    position: row.position as number,
    submittedAt: (row.submitted_at as string) ?? null,
    approvedAt: (row.approved_at as string) ?? null,
    completedAt: (row.completed_at as string) ?? null,
    linkedCalculationId: (row.linked_calculation_id as string) ?? null,
    linkedQcRecordId: (row.linked_qc_record_id as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function ensurePlannerBoard(
  projectId: string,
  ownerId: string,
): Promise<PlannerBoard> {
  const { data: existing } = await supabase
    .from('planner_boards')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle();

  if (existing) return mapBoard(existing);

  const { data: board, error: boardError } = await supabase
    .from('planner_boards')
    .insert({
      project_id: projectId,
      owner_id: ownerId,
      title: 'Field Planner',
    })
    .select('*')
    .single();

  if (boardError) throw boardError;

  const buckets = DEFAULT_BUCKET_TITLES.map((title, index) => ({
    board_id: board.id,
    title,
    position: index,
  }));

  const { error: bucketError } = await supabase.from('planner_buckets').insert(buckets);
  if (bucketError) throw bucketError;

  return mapBoard(board);
}

async function enrichTasks(tasks: PlannerTask[]): Promise<PlannerTask[]> {
  if (tasks.length === 0) return tasks;
  const taskIds = tasks.map((t) => t.id);
  const assigneeIds = tasks.map((t) => t.assignedTo).filter(Boolean) as string[];

  const [commentsRes, attachmentsRes, checklistRes, rfiRes, adjRes, profileNames] = await Promise.all([
    supabase.from('task_comments').select('task_id').in('task_id', taskIds),
    supabase
      .from('task_attachments')
      .select('task_id, file_url, file_type, attachment_type, created_at')
      .in('task_id', taskIds)
      .order('created_at', { ascending: true }),
    supabase
      .from('task_checklist_items')
      .select('task_id, title, is_completed, position')
      .in('task_id', taskIds)
      .order('position'),
    supabase.from('rfi_requests').select('task_id').in('task_id', taskIds),
    supabase.from('field_adjustment_requests').select('task_id').in('task_id', taskIds),
    buildProfileNameMap(assigneeIds),
  ]);

  const commentCounts = new Map<string, number>();
  for (const row of commentsRes.data ?? []) {
    const id = row.task_id as string;
    commentCounts.set(id, (commentCounts.get(id) ?? 0) + 1);
  }

  const attachmentCounts = new Map<string, number>();
  const previewByTask = new Map<string, string>();
  for (const row of attachmentsRes.data ?? []) {
    const id = row.task_id as string;
    attachmentCounts.set(id, (attachmentCounts.get(id) ?? 0) + 1);
    if (previewByTask.has(id)) continue;
    const url = row.file_url as string;
    const type = ((row.file_type as string) ?? '').toLowerCase();
    const attType = (row.attachment_type as string) ?? '';
    const isImage =
      attType === 'photo' ||
      type.startsWith('image/') ||
      /\.(jpe?g|png|gif|webp)$/i.test(url);
    if (isImage && url) previewByTask.set(id, url);
  }

  const checklistTotal = new Map<string, number>();
  const checklistDone = new Map<string, number>();
  const checklistPreviewMap = new Map<string, { title: string; isCompleted: boolean }[]>();
  for (const row of checklistRes.data ?? []) {
    const id = row.task_id as string;
    checklistTotal.set(id, (checklistTotal.get(id) ?? 0) + 1);
    if (row.is_completed) {
      checklistDone.set(id, (checklistDone.get(id) ?? 0) + 1);
    }
    if (!row.is_completed) {
      const list = checklistPreviewMap.get(id) ?? [];
      if (list.length < 2) {
        list.push({ title: row.title as string, isCompleted: false });
        checklistPreviewMap.set(id, list);
      }
    }
  }

  const rfiCounts = new Map<string, number>();
  for (const row of rfiRes.data ?? []) {
    const tid = row.task_id as string | null;
    if (!tid) continue;
    rfiCounts.set(tid, (rfiCounts.get(tid) ?? 0) + 1);
  }

  const adjustmentCounts = new Map<string, number>();
  for (const row of adjRes.data ?? []) {
    const tid = row.task_id as string | null;
    if (!tid) continue;
    adjustmentCounts.set(tid, (adjustmentCounts.get(tid) ?? 0) + 1);
  }

  return tasks.map((t) => ({
    ...t,
    commentCount: commentCounts.get(t.id) ?? 0,
    attachmentCount: attachmentCounts.get(t.id) ?? 0,
    checklistTotal: checklistTotal.get(t.id) ?? 0,
    checklistDone: checklistDone.get(t.id) ?? 0,
    previewImageUrl: previewByTask.get(t.id) ?? null,
    checklistPreview: checklistPreviewMap.get(t.id) ?? [],
    rfiCount: rfiCounts.get(t.id) ?? 0,
    adjustmentCount: adjustmentCounts.get(t.id) ?? 0,
    assigneeName: t.assignedTo ? nameFromMap(profileNames, t.assignedTo) : null,
  }));
}

export async function fetchPlannerBoardBundle(projectId: string): Promise<PlannerBoardBundle | null> {
  const { data: board, error } = await supabase
    .from('planner_boards')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle();

  if (error) throw error;
  if (!board) return null;

  const [bucketsRes, tasksRes] = await Promise.all([
    supabase
      .from('planner_buckets')
      .select('*')
      .eq('board_id', board.id)
      .order('position'),
    supabase
      .from('planner_tasks')
      .select('*')
      .eq('board_id', board.id)
      .order('position'),
  ]);

  if (bucketsRes.error) throw bucketsRes.error;
  if (tasksRes.error) throw tasksRes.error;

  const tasks = await enrichTasks((tasksRes.data ?? []).map(mapTask));

  return {
    board: mapBoard(board),
    buckets: (bucketsRes.data ?? []).map(mapBucket),
    tasks,
  };
}

export async function fetchTaskById(taskId: string): Promise<PlannerTask | null> {
  const { data, error } = await supabase
    .from('planner_tasks')
    .select('*')
    .eq('id', taskId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  const [enriched] = await enrichTasks([mapTask(data)]);
  return enriched;
}

export async function createBucket(boardId: string, title: string, position: number) {
  const trimmed = title.trim();
  if (!trimmed) throw new Error('Bucket name is required');

  const { data, error } = await supabase
    .from('planner_buckets')
    .insert({ board_id: boardId, title: trimmed, position })
    .select('*')
    .single();
  if (error) throw error;
  return mapBucket(data);
}

export async function updateBucket(
  bucketId: string,
  patch: Partial<{ title: string; position: number }>,
) {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) {
    const trimmed = patch.title.trim();
    if (!trimmed) throw new Error('Bucket name is required');
    payload.title = trimmed;
  }
  if (patch.position !== undefined) payload.position = patch.position;

  const { data, error } = await supabase
    .from('planner_buckets')
    .update(payload)
    .eq('id', bucketId)
    .select('*')
    .single();

  if (error) throw error;
  return mapBucket(data);
}

export async function deleteBucket(bucketId: string) {
  const { error } = await supabase.from('planner_buckets').delete().eq('id', bucketId);
  if (error) throw error;
}

export async function createTask(input: {
  boardId: string;
  bucketId: string;
  projectId: string;
  title: string;
  description?: string;
  assignedTo?: string | null;
  createdBy: string;
  priority?: TaskPriority;
  dueDate?: string | null;
  position?: number;
}) {
  const { data: maxPos } = await supabase
    .from('planner_tasks')
    .select('position')
    .eq('bucket_id', input.bucketId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  const position = input.position ?? ((maxPos?.position as number) ?? -1) + 1;

  const { data, error } = await supabase
    .from('planner_tasks')
    .insert({
      board_id: input.boardId,
      bucket_id: input.bucketId,
      project_id: input.projectId,
      title: input.title,
      description: input.description ?? null,
      assigned_to: input.assignedTo ?? null,
      created_by: input.createdBy,
      priority: input.priority ?? 'Normal',
      due_date: input.dueDate ?? null,
      position,
    })
    .select('*')
    .single();

  if (error) throw error;
  const [enriched] = await enrichTasks([mapTask(data)]);
  return enriched;
}

export async function updateTask(
  taskId: string,
  patch: Partial<{
    title: string;
    description: string | null;
    bucketId: string;
    assignedTo: string | null;
    status: TaskStatus;
    priority: TaskPriority;
    startDate: string | null;
    dueDate: string | null;
    linkedCalculationId: string | null;
    linkedQcRecordId: string | null;
  }>,
) {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) payload.title = patch.title;
  if (patch.description !== undefined) payload.description = patch.description;
  if (patch.bucketId !== undefined) payload.bucket_id = patch.bucketId;
  if (patch.assignedTo !== undefined) payload.assigned_to = patch.assignedTo;
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.priority !== undefined) payload.priority = patch.priority;
  if (patch.startDate !== undefined) payload.start_date = patch.startDate;
  if (patch.dueDate !== undefined) payload.due_date = patch.dueDate;
  if (patch.linkedCalculationId !== undefined) {
    payload.linked_calculation_id = patch.linkedCalculationId;
  }
  if (patch.linkedQcRecordId !== undefined) payload.linked_qc_record_id = patch.linkedQcRecordId;

  const { data, error } = await supabase
    .from('planner_tasks')
    .update(payload)
    .eq('id', taskId)
    .select('*')
    .single();

  if (error) throw error;
  const [enriched] = await enrichTasks([mapTask(data)]);
  return enriched;
}

export async function deleteTask(taskId: string) {
  const { error } = await supabase.from('planner_tasks').delete().eq('id', taskId);
  if (error) throw error;
}

export async function submitTaskForReview(taskId: string) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('planner_tasks')
    .update({
      status: 'Submitted',
      submitted_at: now,
      updated_at: now,
    })
    .eq('id', taskId)
    .select('*')
    .single();
  if (error) throw error;

  const task = mapTask(data);
  const { data: project } = await supabase
    .from('projects')
    .select('user_id, name')
    .eq('id', task.projectId)
    .maybeSingle();

  if (project?.user_id) {
    const { createNotification } = await import('./notificationService');
    await createNotification({
      userId: project.user_id as string,
      type: 'task_submitted',
      title: 'Task submitted for review',
      body: task.title,
      href: plannerBoardHref(task.projectId, task.id),
      projectId: task.projectId,
      taskId: task.id,
    });
  }

  return task;
}

export async function reviewTask(
  taskId: string,
  decision: 'Approved' | 'Needs Revision' | 'Completed',
) {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: decision,
    updated_at: now,
  };
  if (decision === 'Approved') patch.approved_at = now;
  if (decision === 'Completed') patch.completed_at = now;

  const { data, error } = await supabase
    .from('planner_tasks')
    .update(patch)
    .eq('id', taskId)
    .select('*')
    .single();
  if (error) throw error;
  return mapTask(data);
}

export async function fetchTasksForEmployee(employeeId: string): Promise<PlannerTask[]> {
  const { data, error } = await supabase
    .from('planner_tasks')
    .select('*')
    .eq('assigned_to', employeeId)
    .order('due_date', { ascending: true, nullsFirst: false });

  if (error) throw error;
  return enrichTasks((data ?? []).map(mapTask));
}

export async function fetchTasksForOwner(ownerId: string): Promise<PlannerTask[]> {
  const { data: projects } = await supabase.from('projects').select('id').eq('user_id', ownerId);
  const projectIds = (projects ?? []).map((p) => p.id as string);
  if (projectIds.length === 0) return [];

  const { data, error } = await supabase
    .from('planner_tasks')
    .select('*')
    .in('project_id', projectIds)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return enrichTasks((data ?? []).map(mapTask));
}

export async function countTasksByStatus(
  ownerId: string,
): Promise<Record<string, number>> {
  const tasks = await fetchTasksForOwner(ownerId);
  const counts: Record<string, number> = {
    open: 0,
    submitted: 0,
    completed: 0,
  };
  for (const t of tasks) {
    if (t.status === 'Submitted') counts.submitted += 1;
    else if (t.status === 'Completed' || t.status === 'Approved') counts.completed += 1;
    else if (t.status !== 'Completed') counts.open += 1;
  }
  return counts;
}
