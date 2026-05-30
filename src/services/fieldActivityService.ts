import { supabase } from '../lib/supabase';
import type { FieldActivityItem } from '../types/fieldPlanner';
import { fetchProfilesByIds, displayNameFor } from './profileService';

async function projectNameMap(projectIds: string[]): Promise<Map<string, string>> {
  if (projectIds.length === 0) return new Map();
  const { data } = await supabase.from('projects').select('id, name').in('id', projectIds);
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    map.set(row.id as string, row.name as string);
  }
  return map;
}

export async function getOwnerFieldActivity(
  ownerId: string,
  limit = 20,
): Promise<FieldActivityItem[]> {
  const { data: projects } = await supabase.from('projects').select('id').eq('user_id', ownerId);
  const projectIds = (projects ?? []).map((p) => p.id as string);
  if (projectIds.length === 0) return [];

  const names = await projectNameMap(projectIds);

  const [comments, submitted, attachments, messages, rfis, adjustments] = await Promise.all([
    supabase
      .from('task_comments')
      .select('id, project_id, user_id, comment, created_at, task_id')
      .in('project_id', projectIds)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('planner_tasks')
      .select('id, project_id, title, assigned_to, status, submitted_at')
      .in('project_id', projectIds)
      .eq('status', 'Submitted')
      .order('submitted_at', { ascending: false })
      .limit(limit),
    supabase
      .from('task_attachments')
      .select('id, project_id, uploaded_by, file_name, created_at, task_id')
      .in('project_id', projectIds)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('field_messages')
      .select('id, project_id, sender_id, message, is_read, created_at')
      .in('project_id', projectIds)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('rfi_requests')
      .select('id, project_id, submitted_by, title, status, created_at')
      .in('project_id', projectIds)
      .eq('status', 'Open')
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('field_adjustment_requests')
      .select('id, project_id, submitted_by, title, status, created_at')
      .in('project_id', projectIds)
      .eq('status', 'Pending')
      .order('created_at', { ascending: false })
      .limit(limit),
  ]);

  const userIds = new Set<string>();
  for (const row of comments.data ?? []) userIds.add(row.user_id as string);
  for (const row of submitted.data ?? []) {
    if (row.assigned_to) userIds.add(row.assigned_to as string);
  }
  for (const row of attachments.data ?? []) userIds.add(row.uploaded_by as string);
  for (const row of messages.data ?? []) userIds.add(row.sender_id as string);
  for (const row of rfis.data ?? []) userIds.add(row.submitted_by as string);
  for (const row of adjustments.data ?? []) userIds.add(row.submitted_by as string);

  const profiles = await fetchProfilesByIds([...userIds]);
  const nameFor = (id: string) => displayNameFor(profiles.get(id), 'Team member');

  const items: FieldActivityItem[] = [];

  for (const row of comments.data ?? []) {
    const pid = row.project_id as string;
    const tid = row.task_id as string;
    items.push({
      id: `comment-${row.id}`,
      type: 'comment',
      projectId: pid,
      projectName: names.get(pid) ?? 'Project',
      employeeName: nameFor(row.user_id as string),
      summary: `${nameFor(row.user_id as string)} posted a field update`,
      timestamp: row.created_at as string,
      status: 'New',
      href: `/projects/${pid}/planner?task=${tid}`,
    });
  }

  for (const row of submitted.data ?? []) {
    const pid = row.project_id as string;
    const aid = row.assigned_to as string | null;
    items.push({
      id: `task-${row.id}`,
      type: 'task_submitted',
      projectId: pid,
      projectName: names.get(pid) ?? 'Project',
      employeeName: aid ? nameFor(aid) : 'Team member',
      summary: `${aid ? nameFor(aid) : 'Someone'} submitted ${row.title as string}`,
      timestamp: (row.submitted_at as string) ?? new Date().toISOString(),
      status: row.status as string,
      href: `/owner/review?task=${row.id}`,
    });
  }

  for (const row of attachments.data ?? []) {
    const pid = row.project_id as string;
    const tid = row.task_id as string;
    items.push({
      id: `attachment-${row.id}`,
      type: 'attachment',
      projectId: pid,
      projectName: names.get(pid) ?? 'Project',
      employeeName: nameFor(row.uploaded_by as string),
      summary: `${nameFor(row.uploaded_by as string)} uploaded ${row.file_name as string}`,
      timestamp: row.created_at as string,
      status: 'Uploaded',
      href: `/projects/${pid}/planner?task=${tid}`,
    });
  }

  for (const row of messages.data ?? []) {
    const pid = row.project_id as string;
    items.push({
      id: `message-${row.id}`,
      type: 'message',
      projectId: pid,
      projectName: names.get(pid) ?? 'Project',
      employeeName: nameFor(row.sender_id as string),
      summary: `Message from ${nameFor(row.sender_id as string)}`,
      timestamp: row.created_at as string,
      status: 'Unread',
      href: `/employee/messages`,
    });
  }

  for (const row of rfis.data ?? []) {
    const pid = row.project_id as string;
    items.push({
      id: `rfi-${row.id}`,
      type: 'rfi',
      projectId: pid,
      projectName: names.get(pid) ?? 'Project',
      employeeName: nameFor(row.submitted_by as string),
      summary: `${nameFor(row.submitted_by as string)} created RFI: ${row.title as string}`,
      timestamp: row.created_at as string,
      status: row.status as string,
      href: `/owner/review?rfi=${row.id}`,
    });
  }

  for (const row of adjustments.data ?? []) {
    const pid = row.project_id as string;
    items.push({
      id: `adjustment-${row.id}`,
      type: 'field_adjustment',
      projectId: pid,
      projectName: names.get(pid) ?? 'Project',
      employeeName: nameFor(row.submitted_by as string),
      summary: `${nameFor(row.submitted_by as string)} requested field adjustment: ${row.title as string}`,
      timestamp: row.created_at as string,
      status: row.status as string,
      href: `/owner/review?adjustment=${row.id}`,
    });
  }

  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return items.slice(0, limit);
}

export async function getFieldActivityForProject(
  projectId: string,
  limit = 3,
): Promise<FieldActivityItem[]> {
  const { data: project } = await supabase
    .from('projects')
    .select('user_id, name')
    .eq('id', projectId)
    .maybeSingle();

  if (!project) return [];
  return getOwnerFieldActivity(project.user_id as string, limit).then((items) =>
    items.filter((i) => i.projectId === projectId).slice(0, limit),
  );
}

export async function getOwnerFieldSummary(ownerId: string) {
  const { data: projects } = await supabase.from('projects').select('id').eq('user_id', ownerId);
  const projectIds = (projects ?? []).map((p) => p.id as string);

  const empty = {
    openTasks: 0,
    tasksNeedingReview: 0,
    openRfis: 0,
    pendingAdjustments: 0,
    newMessages: 0,
    recentUploads: 0,
  };

  if (projectIds.length === 0) return empty;

  const [tasks, rfis, adjustments, messages, attachments] = await Promise.all([
    supabase.from('planner_tasks').select('status').in('project_id', projectIds),
    supabase
      .from('rfi_requests')
      .select('id', { count: 'exact', head: true })
      .in('project_id', projectIds)
      .eq('status', 'Open'),
    supabase
      .from('field_adjustment_requests')
      .select('id', { count: 'exact', head: true })
      .in('project_id', projectIds)
      .eq('status', 'Pending'),
    supabase
      .from('field_messages')
      .select('id', { count: 'exact', head: true })
      .in('project_id', projectIds)
      .eq('is_read', false),
    supabase
      .from('task_attachments')
      .select('id', { count: 'exact', head: true })
      .in('project_id', projectIds)
      .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
  ]);

  let openTasks = 0;
  let tasksNeedingReview = 0;
  for (const row of tasks.data ?? []) {
    const s = row.status as string;
    if (s === 'Submitted') tasksNeedingReview += 1;
    else if (s !== 'Completed' && s !== 'Approved') openTasks += 1;
  }

  return {
    openTasks,
    tasksNeedingReview,
    openRfis: rfis.count ?? 0,
    pendingAdjustments: adjustments.count ?? 0,
    newMessages: messages.count ?? 0,
    recentUploads: attachments.count ?? 0,
  };
}
