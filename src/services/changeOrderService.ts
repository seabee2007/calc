import { supabase } from '../lib/supabase';
import type {
  ChangeOrder,
  ChangeOrderInput,
  ChangeOrderLineItem,
  ChangeOrderStatus,
} from '../types/changeOrder';
import { computeChangeOrderTotals } from '../utils/changeOrderFinancials';
import { linkFarToChangeOrder } from './fieldAdjustmentService';
import { fetchAdjustmentById } from './fieldAdjustmentService';
import { fetchRfiById } from './rfiService';

function parseItems(raw: unknown): ChangeOrderLineItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      description: String(r.description ?? ''),
      qty: r.qty != null ? Number(r.qty) : undefined,
      unit: r.unit != null ? String(r.unit) : undefined,
      amount: Number(r.amount) || 0,
    };
  });
}

export function mapChangeOrder(row: Record<string, unknown>): ChangeOrder {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    userId: row.user_id as string,
    linkedFarId: (row.linked_far_id as string) ?? null,
    linkedRfiId: (row.linked_rfi_id as string) ?? null,
    linkedTaskId: (row.linked_task_id as string) ?? null,
    displayNumber: (row.display_number as string) ?? null,
    title: row.title as string,
    scopeDescription: (row.scope_description as string) ?? '',
    reasonForChange: (row.reason_for_change as string) ?? '',
    terms: (row.terms as string) ?? '',
    laborItems: parseItems(row.labor_items),
    materialItems: parseItems(row.material_items),
    equipmentItems: parseItems(row.equipment_items),
    markupPercent: Number(row.markup_percent ?? 0),
    subtotal: Number(row.subtotal ?? 0),
    total: Number(row.total ?? 0),
    scheduleImpact: (row.schedule_impact as string) ?? null,
    status: row.status as ChangeOrderStatus,
    publicToken: String(row.public_token),
    sentAt: (row.sent_at as string) ?? null,
    viewedAt: (row.viewed_at as string) ?? null,
    openedAt: (row.opened_at as string) ?? null,
    acceptedAt: (row.accepted_at as string) ?? null,
    declinedAt: (row.declined_at as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function buildPayload(input: ChangeOrderInput, totals: { subtotal: number; total: number }) {
  return {
    project_id: input.projectId,
    user_id: input.userId,
    linked_far_id: input.linkedFarId ?? null,
    linked_rfi_id: input.linkedRfiId ?? null,
    linked_task_id: input.linkedTaskId ?? null,
    title: input.title,
    scope_description: input.scopeDescription,
    reason_for_change: input.reasonForChange,
    terms: input.terms ?? '',
    labor_items: input.laborItems ?? [],
    material_items: input.materialItems ?? [],
    equipment_items: input.equipmentItems ?? [],
    markup_percent: input.markupPercent ?? 0,
    subtotal: totals.subtotal,
    total: totals.total,
    schedule_impact: input.scheduleImpact ?? null,
    updated_at: new Date().toISOString(),
  };
}

export async function fetchChangeOrdersForProject(projectId: string): Promise<ChangeOrder[]> {
  const { data, error } = await supabase
    .from('change_orders')
    .select('*')
    .eq('project_id', projectId)
    .neq('status', 'void')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapChangeOrder);
}

export async function fetchChangeOrderById(id: string): Promise<ChangeOrder | null> {
  const { data, error } = await supabase
    .from('change_orders')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapChangeOrder(data) : null;
}

export async function saveChangeOrder(
  id: string | null,
  input: ChangeOrderInput,
): Promise<ChangeOrder> {
  const labor = input.laborItems ?? [];
  const material = input.materialItems ?? [];
  const equipment = input.equipmentItems ?? [];
  const totals = computeChangeOrderTotals(
    labor,
    material,
    equipment,
    input.markupPercent ?? 0,
  );
  const payload = buildPayload(input, totals);

  if (id) {
    const { data, error } = await supabase
      .from('change_orders')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return mapChangeOrder(data);
  }

  const { data, error } = await supabase
    .from('change_orders')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  const co = mapChangeOrder(data);

  if (input.linkedFarId) {
    await linkFarToChangeOrder(input.linkedFarId, co.id);
  }

  return co;
}

export async function createChangeOrderFromFar(
  farId: string,
  userId: string,
): Promise<ChangeOrder> {
  const far = await fetchAdjustmentById(farId);
  if (!far) throw new Error('Field adjustment not found');

  if (far.changeOrderId) {
    const existing = await fetchChangeOrderById(far.changeOrderId);
    if (existing) return existing;
  }

  const scope = [
    far.conditionDescription ?? far.description,
    far.proposedAdjustment ? `Proposed: ${far.proposedAdjustment}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  return saveChangeOrder(null, {
    projectId: far.projectId,
    userId,
    linkedFarId: far.id,
    linkedTaskId: far.taskId,
    title: `CO — ${far.title}`,
    scopeDescription: scope,
    reasonForChange: far.reason ?? 'Field adjustment',
    scheduleImpact: far.scheduleImpact ?? undefined,
    laborItems: [],
    materialItems: [],
    equipmentItems: [],
    markupPercent: 0,
  });
}

export async function createChangeOrderFromRfi(
  rfiId: string,
  userId: string,
): Promise<ChangeOrder> {
  const rfi = await fetchRfiById(rfiId);
  if (!rfi) throw new Error('RFI not found');

  return saveChangeOrder(null, {
    projectId: rfi.projectId,
    userId,
    linkedRfiId: rfi.id,
    linkedTaskId: rfi.taskId,
    title: `CO — ${rfi.title}`,
    scopeDescription: rfi.question,
    reasonForChange: rfi.title,
    scheduleImpact: rfi.impactSchedule ? 'Schedule impact noted on RFI' : undefined,
    laborItems: [],
    materialItems: [],
    equipmentItems: [],
    markupPercent: 0,
  });
}

export async function createChangeOrderManual(
  projectId: string,
  userId: string,
  taskId?: string | null,
): Promise<ChangeOrder> {
  return saveChangeOrder(null, {
    projectId,
    userId,
    linkedTaskId: taskId ?? null,
    title: 'Change order',
    scopeDescription: '',
    reasonForChange: '',
    laborItems: [],
    materialItems: [],
    equipmentItems: [],
    markupPercent: 0,
  });
}

export async function markChangeOrderSent(id: string): Promise<ChangeOrder> {
  const { data, error } = await supabase
    .from('change_orders')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return mapChangeOrder(data);
}

export async function voidChangeOrder(id: string): Promise<void> {
  const existing = await fetchChangeOrderById(id);
  if (!existing) throw new Error('Change order not found');
  if (existing.status === 'accepted') {
    throw new Error('Accepted change orders cannot be deleted. Void is not allowed after client acceptance.');
  }

  const { error } = await supabase
    .from('change_orders')
    .update({
      status: 'void',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw error;

  const { error: farError } = await supabase
    .from('field_adjustment_requests')
    .update({
      change_order_id: null,
      converted_to_change_order: false,
      status: 'Approved',
      updated_at: new Date().toISOString(),
    })
    .eq('change_order_id', id);
  if (farError) throw farError;
}
