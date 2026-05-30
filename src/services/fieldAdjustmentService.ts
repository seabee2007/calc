import { supabase } from '../lib/supabase';
import type { FarStatus, FieldAdjustmentRequest } from '../types/fieldPlanner';

function mapAdjustment(row: Record<string, unknown>): FieldAdjustmentRequest {
  const condition =
    (row.condition_description as string) ??
    (row.description as string) ??
    '';
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    taskId: (row.task_id as string) ?? null,
    submittedBy: row.submitted_by as string,
    displayNumber: (row.display_number as string) ?? null,
    title: row.title as string,
    description: (row.description as string) ?? condition,
    location: (row.location as string) ?? null,
    conditionDescription: condition || null,
    proposedAdjustment: (row.proposed_adjustment as string) ?? null,
    reason: (row.reason as string) ?? null,
    laborImpact: row.labor_impact != null ? Number(row.labor_impact) : null,
    materialImpact: row.material_impact != null ? Number(row.material_impact) : null,
    equipmentCost: row.equipment_cost != null ? Number(row.equipment_cost) : null,
    scheduleImpact: (row.schedule_impact as string) ?? null,
    estimatedCost: row.estimated_cost != null ? Number(row.estimated_cost) : null,
    potentialCostImpact: Boolean(row.potential_cost_impact),
    potentialScheduleImpact: Boolean(row.potential_schedule_impact),
    recommendedAction: (row.recommended_action as string) ?? null,
    requiresChangeOrder: Boolean(row.requires_change_order),
    impactSafety: Boolean(row.impact_safety),
    impactQuality: Boolean(row.impact_quality),
    changeOrderId: (row.change_order_id as string) ?? null,
    convertedToChangeOrder: Boolean(row.converted_to_change_order),
    status: row.status as string,
    ownerResponse: (row.owner_response as string) ?? null,
    approvedBy: (row.approved_by as string) ?? null,
    approvedAt: (row.approved_at as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function fetchAdjustmentsForProject(
  projectId: string,
): Promise<FieldAdjustmentRequest[]> {
  const { data, error } = await supabase
    .from('field_adjustment_requests')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapAdjustment);
}

export async function fetchAdjustmentById(id: string): Promise<FieldAdjustmentRequest | null> {
  const { data, error } = await supabase
    .from('field_adjustment_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapAdjustment(data) : null;
}

export async function createFieldAdjustment(input: {
  projectId: string;
  taskId?: string | null;
  submittedBy: string;
  title: string;
  conditionDescription: string;
  proposedAdjustment?: string;
  reason?: string;
  location?: string;
  scheduleImpact?: string;
  potentialCostImpact?: boolean;
  potentialScheduleImpact?: boolean;
  recommendedAction?: string;
  requiresChangeOrder?: boolean;
  impactSafety?: boolean;
  impactQuality?: boolean;
}) {
  const requiresCo =
    input.requiresChangeOrder ?? Boolean(input.potentialCostImpact);

  const { data, error } = await supabase
    .from('field_adjustment_requests')
    .insert({
      project_id: input.projectId,
      task_id: input.taskId ?? null,
      submitted_by: input.submittedBy,
      title: input.title,
      description: input.conditionDescription,
      condition_description: input.conditionDescription,
      proposed_adjustment: input.proposedAdjustment ?? '',
      reason: input.reason ?? null,
      location: input.location ?? null,
      schedule_impact: input.scheduleImpact ?? null,
      potential_cost_impact: input.potentialCostImpact ?? false,
      potential_schedule_impact: input.potentialScheduleImpact ?? false,
      recommended_action: input.recommendedAction ?? null,
      requires_change_order: requiresCo,
      impact_safety: input.impactSafety ?? false,
      impact_quality: input.impactQuality ?? false,
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapAdjustment(data);
}

export async function updateFieldAdjustment(
  id: string,
  updates: Partial<{
    title: string;
    conditionDescription: string;
    proposedAdjustment: string;
    reason: string;
    location: string;
    scheduleImpact: string;
    recommendedAction: string;
    potentialCostImpact: boolean;
    potentialScheduleImpact: boolean;
    requiresChangeOrder: boolean;
    impactSafety: boolean;
    impactQuality: boolean;
  }>,
) {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.conditionDescription !== undefined) {
    payload.condition_description = updates.conditionDescription;
    payload.description = updates.conditionDescription;
  }
  if (updates.proposedAdjustment !== undefined)
    payload.proposed_adjustment = updates.proposedAdjustment;
  if (updates.reason !== undefined) payload.reason = updates.reason;
  if (updates.location !== undefined) payload.location = updates.location;
  if (updates.scheduleImpact !== undefined) payload.schedule_impact = updates.scheduleImpact;
  if (updates.recommendedAction !== undefined)
    payload.recommended_action = updates.recommendedAction;
  if (updates.potentialCostImpact !== undefined)
    payload.potential_cost_impact = updates.potentialCostImpact;
  if (updates.potentialScheduleImpact !== undefined)
    payload.potential_schedule_impact = updates.potentialScheduleImpact;
  if (updates.requiresChangeOrder !== undefined)
    payload.requires_change_order = updates.requiresChangeOrder;
  if (updates.impactSafety !== undefined) payload.impact_safety = updates.impactSafety;
  if (updates.impactQuality !== undefined) payload.impact_quality = updates.impactQuality;

  const { data, error } = await supabase
    .from('field_adjustment_requests')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return mapAdjustment(data);
}

export async function linkFarToChangeOrder(farId: string, changeOrderId: string) {
  const { data, error } = await supabase
    .from('field_adjustment_requests')
    .update({
      change_order_id: changeOrderId,
      converted_to_change_order: true,
      status: 'Convert to Change Order',
      updated_at: new Date().toISOString(),
    })
    .eq('id', farId)
    .select('*')
    .single();
  if (error) throw error;
  return mapAdjustment(data);
}

export function canEmployeeEditAdjustment(adj: FieldAdjustmentRequest): boolean {
  return !adj.approvedAt && ['Pending', 'Needs More Information'].includes(adj.status);
}

export async function reviewFieldAdjustment(
  id: string,
  ownerId: string,
  status: FarStatus,
  ownerResponse?: string,
  options?: { flagRequiresChangeOrder?: boolean },
) {
  const isApproved = status === 'Approved';
  const payload: Record<string, unknown> = {
    status,
    approved_by: isApproved ? ownerId : null,
    approved_at: isApproved ? new Date().toISOString() : null,
    owner_response: ownerResponse ?? null,
    updated_at: new Date().toISOString(),
  };
  if (isApproved && options?.flagRequiresChangeOrder) {
    payload.requires_change_order = true;
  }

  const { data, error } = await supabase
    .from('field_adjustment_requests')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return mapAdjustment(data);
}

/** Approved FARs that still need a priced change order created. */
export async function fetchApprovedFarsNeedingChangeOrder(
  ownerId: string,
): Promise<FieldAdjustmentRequest[]> {
  const { data: projects } = await supabase.from('projects').select('id').eq('user_id', ownerId);
  const ids = (projects ?? []).map((p) => p.id as string);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('field_adjustment_requests')
    .select('*')
    .in('project_id', ids)
    .eq('status', 'Approved')
    .is('change_order_id', null)
    .or('requires_change_order.eq.true,potential_cost_impact.eq.true')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapAdjustment);
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

export function hasLegacyPricing(adj: FieldAdjustmentRequest): boolean {
  return (
    adj.estimatedCost != null ||
    adj.laborImpact != null ||
    adj.materialImpact != null ||
    adj.equipmentCost != null
  );
}
