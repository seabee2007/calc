import { supabase } from '../lib/supabase';
import type { FieldActivityItem } from '../types/fieldPlanner';
import { fetchProfilesByIds, displayNameFor } from './profileService';
import {
  plannerAdjustmentHref,
  plannerBoardHref,
  plannerDocumentsHref,
  plannerRfiHref,
} from '../utils/plannerRoutes';

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
      .select(
        'id, project_id, submitted_by, title, status, created_at, owner_response, responded_at',
      )
      .in('project_id', projectIds)
      .order('created_at', { ascending: false })
      .limit(limit * 2),
    supabase
      .from('field_adjustment_requests')
      .select(
        'id, project_id, submitted_by, title, status, created_at, updated_at, owner_response, approved_at, approved_by',
      )
      .in('project_id', projectIds)
      .order('created_at', { ascending: false })
      .limit(limit * 2),
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
      href: plannerBoardHref(pid, tid),
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
      href: plannerBoardHref(pid, tid),
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
    const rid = row.id as string;
    const submitter = nameFor(row.submitted_by as string);
    items.push({
      id: `rfi-${rid}`,
      type: 'rfi',
      projectId: pid,
      projectName: names.get(pid) ?? 'Project',
      employeeName: submitter,
      summary: `RFI submitted — ${row.title as string}`,
      timestamp: row.created_at as string,
      status: row.status as string,
      href: plannerRfiHref(pid, rid),
    });
    if (row.owner_response && row.responded_at) {
      items.push({
        id: `rfi-response-${rid}`,
        type: 'owner_response',
        projectId: pid,
        projectName: names.get(pid) ?? 'Project',
        employeeName: 'Owner',
        summary: `Owner responded to RFI — ${row.title as string}`,
        timestamp: row.responded_at as string,
        status: row.status as string,
        href: plannerRfiHref(pid, rid),
      });
    }
  }

  for (const row of adjustments.data ?? []) {
    const pid = row.project_id as string;
    const aid = row.id as string;
    const submitter = nameFor(row.submitted_by as string);
    items.push({
      id: `adjustment-${aid}`,
      type: 'field_adjustment',
      projectId: pid,
      projectName: names.get(pid) ?? 'Project',
      employeeName: submitter,
      summary: `Field adjustment submitted — ${row.title as string}`,
      timestamp: row.created_at as string,
      status: row.status as string,
      href: plannerAdjustmentHref(pid, aid),
    });
    if (row.status !== 'Pending') {
      const reviewTs =
        (row.approved_at as string) ??
        (row.updated_at as string) ??
        (row.created_at as string);
      items.push({
        id: `adjustment-review-${aid}`,
        type: 'owner_response',
        projectId: pid,
        projectName: names.get(pid) ?? 'Project',
        employeeName: 'Owner',
        summary: `Owner ${(row.status as string).toLowerCase()} field adjustment — ${row.title as string}`,
        timestamp: reviewTs,
        status: row.status as string,
        href: plannerAdjustmentHref(pid, aid),
      });
    }
  }

  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return items.slice(0, limit);
}

export async function getFieldActivityForProject(
  projectId: string,
  limit = 3,
): Promise<FieldActivityItem[]> {
  return buildProjectActivityFeed(projectId, limit);
}

/** Single-project activity feed for planner sidebar. */
export async function buildProjectActivityFeed(
  projectId: string,
  limit = 30,
): Promise<FieldActivityItem[]> {
  const { data: project } = await supabase
    .from('projects')
    .select('name')
    .eq('id', projectId)
    .maybeSingle();

  const projectName = (project?.name as string) ?? 'Project';

  const [comments, tasks, attachments, rfis, adjustments] = await Promise.all([
    supabase
      .from('task_comments')
      .select('id, user_id, comment, created_at, task_id')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('planner_tasks')
      .select(
        'id, title, status, assigned_to, created_by, created_at, submitted_at, approved_at, completed_at',
      )
      .eq('project_id', projectId)
      .order('updated_at', { ascending: false })
      .limit(limit),
    supabase
      .from('task_attachments')
      .select('id, uploaded_by, file_name, created_at, task_id')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('rfi_requests')
      .select('id, submitted_by, title, status, owner_response, responded_at, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('field_adjustment_requests')
      .select('id, submitted_by, title, status, owner_response, approved_at, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(limit),
  ]);

  const userIds = new Set<string>();
  for (const row of comments.data ?? []) userIds.add(row.user_id as string);
  for (const row of tasks.data ?? []) {
    if (row.assigned_to) userIds.add(row.assigned_to as string);
    if (row.created_by) userIds.add(row.created_by as string);
  }
  for (const row of attachments.data ?? []) userIds.add(row.uploaded_by as string);
  for (const row of rfis.data ?? []) userIds.add(row.submitted_by as string);
  for (const row of adjustments.data ?? []) userIds.add(row.submitted_by as string);

  const profiles = await fetchProfilesByIds([...userIds]);
  const nameFor = (id: string) => displayNameFor(profiles.get(id), 'Team member');

  const items: FieldActivityItem[] = [];

  for (const row of comments.data ?? []) {
    const tid = row.task_id as string;
    items.push({
      id: `comment-${row.id}`,
      type: 'comment',
      projectId,
      projectName,
      employeeName: nameFor(row.user_id as string),
      summary: `${nameFor(row.user_id as string)} commented on a task`,
      timestamp: row.created_at as string,
      status: 'Update',
      href: plannerBoardHref(projectId, tid),
    });
  }

  for (const row of tasks.data ?? []) {
    const tid = row.id as string;
    const title = row.title as string;
    const status = row.status as string;
    const assignee = row.assigned_to as string | null;

    if (status === 'Submitted' && row.submitted_at) {
      items.push({
        id: `submitted-${tid}`,
        type: 'task_submitted',
        projectId,
        projectName,
        employeeName: assignee ? nameFor(assignee) : 'Team member',
        summary: `Task submitted for review: ${title}`,
        timestamp: row.submitted_at as string,
        status,
        href: plannerBoardHref(projectId, tid),
      });
    }
    if (status === 'Approved' && row.approved_at) {
      items.push({
        id: `approved-${tid}`,
        type: 'task_approved',
        projectId,
        projectName,
        employeeName: 'Owner',
        summary: `Task approved: ${title}`,
        timestamp: row.approved_at as string,
        status,
        href: plannerBoardHref(projectId, tid),
      });
    }
    if (status === 'Completed' && row.completed_at) {
      items.push({
        id: `completed-${tid}`,
        type: 'task_completed',
        projectId,
        projectName,
        employeeName: assignee ? nameFor(assignee) : 'Team member',
        summary: `Task completed: ${title}`,
        timestamp: row.completed_at as string,
        status,
        href: plannerBoardHref(projectId, tid),
      });
    }
    if (row.created_at) {
      items.push({
        id: `created-${tid}-${row.created_at}`,
        type: 'task_created',
        projectId,
        projectName,
        employeeName: row.created_by ? nameFor(row.created_by as string) : 'Owner',
        summary: `Task created: ${title}`,
        timestamp: row.created_at as string,
        status: 'New',
        href: plannerBoardHref(projectId, tid),
      });
    }
  }

  for (const row of attachments.data ?? []) {
    const tid = row.task_id as string;
    items.push({
      id: `attachment-${row.id}`,
      type: 'attachment',
      projectId,
      projectName,
      employeeName: nameFor(row.uploaded_by as string),
      summary: `${nameFor(row.uploaded_by as string)} uploaded ${row.file_name as string}`,
      timestamp: row.created_at as string,
      status: 'Uploaded',
      href: plannerDocumentsHref(projectId, row.id as string),
    });
  }

  for (const row of rfis.data ?? []) {
    const rid = row.id as string;
    items.push({
      id: `rfi-${rid}`,
      type: 'rfi',
      projectId,
      projectName,
      employeeName: nameFor(row.submitted_by as string),
      summary: `RFI: ${row.title as string}`,
      timestamp: row.created_at as string,
      status: row.status as string,
      href: plannerRfiHref(projectId, rid),
    });
    if (row.owner_response && row.responded_at) {
      items.push({
        id: `rfi-response-${rid}`,
        type: 'owner_response',
        projectId,
        projectName,
        employeeName: 'Owner',
        summary: `Owner responded to RFI: ${row.title as string}`,
        timestamp: row.responded_at as string,
        status: 'Answered',
        href: plannerRfiHref(projectId, rid),
      });
    }
  }

  for (const row of adjustments.data ?? []) {
    const aid = row.id as string;
    items.push({
      id: `adjustment-${aid}`,
      type: 'field_adjustment',
      projectId,
      projectName,
      employeeName: nameFor(row.submitted_by as string),
      summary: `Field adjustment: ${row.title as string}`,
      timestamp: row.created_at as string,
      status: row.status as string,
      href: plannerAdjustmentHref(projectId, aid),
    });
    if (row.owner_response && row.approved_at) {
      items.push({
        id: `adjustment-response-${aid}`,
        type: 'owner_response',
        projectId,
        projectName,
        employeeName: 'Owner',
        summary: `Owner reviewed adjustment: ${row.title as string}`,
        timestamp: row.approved_at as string,
        status: row.status as string,
        href: plannerAdjustmentHref(projectId, aid),
      });
    }
  }

  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return items.slice(0, limit);
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
      .in('status', ['Open', 'Pending Response', 'Need More Information']),
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
