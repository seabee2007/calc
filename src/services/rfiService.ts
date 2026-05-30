import { supabase } from '../lib/supabase';
import type { RfiRequest, RfiStatus } from '../types/fieldPlanner';

function mapRfi(row: Record<string, unknown>): RfiRequest {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    taskId: (row.task_id as string) ?? null,
    submittedBy: row.submitted_by as string,
    displayNumber: (row.display_number as string) ?? null,
    title: row.title as string,
    question: row.question as string,
    suggestedSolution: (row.suggested_solution as string) ?? null,
    location: (row.location as string) ?? null,
    drawingReference: (row.drawing_reference as string) ?? null,
    specReference: (row.spec_reference as string) ?? null,
    urgency: row.urgency as string,
    impactSchedule: Boolean(row.impact_schedule),
    impactCost: Boolean(row.impact_cost),
    impactQuality: Boolean(row.impact_quality),
    impactSafety: Boolean(row.impact_safety),
    status: row.status as string,
    ownerResponse: (row.owner_response as string) ?? null,
    respondedBy: (row.responded_by as string) ?? null,
    respondedAt: (row.responded_at as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function fetchRfisForProject(projectId: string): Promise<RfiRequest[]> {
  const { data, error } = await supabase
    .from('rfi_requests')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRfi);
}

export async function fetchRfiById(rfiId: string): Promise<RfiRequest | null> {
  const { data, error } = await supabase
    .from('rfi_requests')
    .select('*')
    .eq('id', rfiId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRfi(data) : null;
}

export async function createRfi(input: {
  projectId: string;
  taskId?: string | null;
  submittedBy: string;
  title: string;
  question: string;
  suggestedSolution?: string;
  urgency?: string;
  location?: string;
  drawingReference?: string;
  specReference?: string;
  impactSchedule?: boolean;
  impactCost?: boolean;
  impactQuality?: boolean;
  impactSafety?: boolean;
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
      location: input.location ?? null,
      drawing_reference: input.drawingReference ?? null,
      spec_reference: input.specReference ?? null,
      impact_schedule: input.impactSchedule ?? false,
      impact_cost: input.impactCost ?? false,
      impact_quality: input.impactQuality ?? false,
      impact_safety: input.impactSafety ?? false,
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapRfi(data);
}

export async function updateRfi(
  rfiId: string,
  updates: Partial<{
    title: string;
    question: string;
    suggestedSolution: string;
    urgency: string;
    location: string;
    drawingReference: string;
    specReference: string;
    impactSchedule: boolean;
    impactCost: boolean;
    impactQuality: boolean;
    impactSafety: boolean;
  }>,
) {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.question !== undefined) payload.question = updates.question;
  if (updates.suggestedSolution !== undefined)
    payload.suggested_solution = updates.suggestedSolution;
  if (updates.urgency !== undefined) payload.urgency = updates.urgency;
  if (updates.location !== undefined) payload.location = updates.location;
  if (updates.drawingReference !== undefined)
    payload.drawing_reference = updates.drawingReference;
  if (updates.specReference !== undefined) payload.spec_reference = updates.specReference;
  if (updates.impactSchedule !== undefined) payload.impact_schedule = updates.impactSchedule;
  if (updates.impactCost !== undefined) payload.impact_cost = updates.impactCost;
  if (updates.impactQuality !== undefined) payload.impact_quality = updates.impactQuality;
  if (updates.impactSafety !== undefined) payload.impact_safety = updates.impactSafety;

  const { data, error } = await supabase
    .from('rfi_requests')
    .update(payload)
    .eq('id', rfiId)
    .select('*')
    .single();
  if (error) throw error;
  return mapRfi(data);
}

export function canEmployeeEditRfi(rfi: RfiRequest): boolean {
  return !rfi.respondedAt && ['Open', 'Pending Response', 'Need More Information'].includes(rfi.status);
}

export async function respondToRfi(
  rfiId: string,
  ownerId: string,
  response: string,
  status: RfiStatus = 'Answered',
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
    .in('status', ['Open', 'Pending Response', 'Need More Information'])
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
    .in('status', ['Open', 'Pending Response', 'Need More Information']);
  if (error) throw error;
  return count ?? 0;
}

export function isRfiClosed(status: string): boolean {
  return ['Closed', 'Rejected', 'Answered'].includes(status);
}
