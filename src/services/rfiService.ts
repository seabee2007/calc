import { supabase } from '../lib/supabase';
import type { RfiRequest } from '../types/fieldPlanner';

function mapRfi(row: Record<string, unknown>): RfiRequest {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    taskId: (row.task_id as string) ?? null,
    submittedBy: row.submitted_by as string,
    title: row.title as string,
    question: row.question as string,
    suggestedSolution: (row.suggested_solution as string) ?? null,
    urgency: row.urgency as string,
    status: row.status as string,
    ownerResponse: (row.owner_response as string) ?? null,
    respondedBy: (row.responded_by as string) ?? null,
    respondedAt: (row.responded_at as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function createRfi(input: {
  projectId: string;
  taskId?: string | null;
  submittedBy: string;
  title: string;
  question: string;
  suggestedSolution?: string;
  urgency?: string;
}) {
  const { data, error } = await supabase
    .from('rfi_requests')
    .insert({
      project_id: input.projectId,
      task_id: input.taskId ?? null,
      submitted_by: input.submittedBy,
      title: input.title,
      question: input.question,
      suggested_solution: input.suggestedSolution ?? null,
      urgency: input.urgency ?? 'Normal',
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapRfi(data);
}

export async function respondToRfi(
  rfiId: string,
  ownerId: string,
  response: string,
  status: 'Answered' | 'Closed' = 'Answered',
) {
  const { data, error } = await supabase
    .from('rfi_requests')
    .update({
      owner_response: response,
      responded_by: ownerId,
      responded_at: new Date().toISOString(),
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', rfiId)
    .select('*')
    .single();
  if (error) throw error;
  return mapRfi(data);
}

export async function fetchOpenRfisForOwner(ownerId: string): Promise<RfiRequest[]> {
  const { data: projects } = await supabase.from('projects').select('id').eq('user_id', ownerId);
  const ids = (projects ?? []).map((p) => p.id as string);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('rfi_requests')
    .select('*')
    .in('project_id', ids)
    .eq('status', 'Open')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapRfi);
}

export async function fetchRfisForEmployee(employeeId: string): Promise<RfiRequest[]> {
  const { data: assignments } = await supabase
    .from('employee_project_assignments')
    .select('project_id')
    .eq('employee_id', employeeId);

  const ids = (assignments ?? []).map((a) => a.project_id as string);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('rfi_requests')
    .select('*')
    .in('project_id', ids)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapRfi);
}

export async function countOpenRfisForProjects(projectIds: string[]): Promise<number> {
  if (projectIds.length === 0) return 0;
  const { count, error } = await supabase
    .from('rfi_requests')
    .select('id', { count: 'exact', head: true })
    .in('project_id', projectIds)
    .eq('status', 'Open');
  if (error) throw error;
  return count ?? 0;
}
