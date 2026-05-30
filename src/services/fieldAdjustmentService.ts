import { supabase } from '../lib/supabase';
import type { FieldAdjustmentRequest } from '../types/fieldPlanner';

function mapAdjustment(row: Record<string, unknown>): FieldAdjustmentRequest {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    taskId: (row.task_id as string) ?? null,
    submittedBy: row.submitted_by as string,
    title: row.title as string,
    description: row.description as string,
    reason: (row.reason as string) ?? null,
    laborImpact: row.labor_impact != null ? Number(row.labor_impact) : null,
    materialImpact: row.material_impact != null ? Number(row.material_impact) : null,
    scheduleImpact: (row.schedule_impact as string) ?? null,
    estimatedCost: row.estimated_cost != null ? Number(row.estimated_cost) : null,
    status: row.status as string,
    ownerResponse: (row.owner_response as string) ?? null,
    approvedBy: (row.approved_by as string) ?? null,
    approvedAt: (row.approved_at as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function createFieldAdjustment(input: {
  projectId: string;
  taskId?: string | null;
  submittedBy: string;
  title: string;
  description: string;
  reason?: string;
  laborImpact?: number;
  materialImpact?: number;
  scheduleImpact?: string;
  estimatedCost?: number;
}) {
  const { data, error } = await supabase
    .from('field_adjustment_requests')
    .insert({
      project_id: input.projectId,
      task_id: input.taskId ?? null,
      submitted_by: input.submittedBy,
      title: input.title,
      description: input.description,
      reason: input.reason ?? null,
      labor_impact: input.laborImpact ?? null,
      material_impact: input.materialImpact ?? null,
      schedule_impact: input.scheduleImpact ?? null,
      estimated_cost: input.estimatedCost ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapAdjustment(data);
}

export async function reviewFieldAdjustment(
  id: string,
  ownerId: string,
  decision: 'Approved' | 'Rejected',
  ownerResponse?: string,
) {
  const { data, error } = await supabase
    .from('field_adjustment_requests')
    .update({
      status: decision,
      approved_by: decision === 'Approved' ? ownerId : null,
      approved_at: decision === 'Approved' ? new Date().toISOString() : null,
      owner_response: ownerResponse ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return mapAdjustment(data);
}

export async function fetchPendingAdjustmentsForOwner(
  ownerId: string,
): Promise<FieldAdjustmentRequest[]> {
  const { data: projects } = await supabase.from('projects').select('id').eq('user_id', ownerId);
  const ids = (projects ?? []).map((p) => p.id as string);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('field_adjustment_requests')
    .select('*')
    .in('project_id', ids)
    .eq('status', 'Pending')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapAdjustment);
}

export async function fetchAdjustmentsForEmployee(
  employeeId: string,
): Promise<FieldAdjustmentRequest[]> {
  const { data: assignments } = await supabase
    .from('employee_project_assignments')
    .select('project_id')
    .eq('employee_id', employeeId);

  const ids = (assignments ?? []).map((a) => a.project_id as string);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('field_adjustment_requests')
    .select('*')
    .in('project_id', ids)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapAdjustment);
}
