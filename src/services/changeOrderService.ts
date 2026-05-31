import { supabase } from '../lib/supabase';
import type {
  ChangeOrder,
  ChangeOrderInput,
  ChangeOrderLineItem,
  ChangeOrderStatus,
} from '../types/changeOrder';
import type { PricingParams } from '../types/pricingParams';
import {
  computePricingBreakdown,
  DEFAULT_OVERHEAD_PERCENT,
  DEFAULT_PROFIT_PERCENT,
  DEFAULT_TARGET_MARGIN_PERCENT,
  DEFAULT_WASTE_FACTOR_PERCENT,
  normalizeLineItems,
  type ChangeOrderPricingBreakdown,
} from '../utils/changeOrderFinancials';
import { linkFarToChangeOrder } from './fieldAdjustmentService';
import { fetchAdjustmentById } from './fieldAdjustmentService';
import { fetchRfiById } from './rfiService';

function parseItems(raw: unknown): ChangeOrderLineItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const r = row as Record<string, unknown>;
    const qty = r.qty != null ? Number(r.qty) : undefined;
    const hours = r.hours != null ? Number(r.hours) : undefined;
    const unitPrice =
      r.unitPrice != null
        ? Number(r.unitPrice)
        : r.unit_price != null
          ? Number(r.unit_price)
          : undefined;
    return {
      description: String(r.description ?? ''),
      qty,
      unit: r.unit != null ? String(r.unit) : undefined,
      hours,
      unitPrice,
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
    subcontractorItems: parseItems(row.subcontractor_items),
    markupPercent: Number(row.markup_percent ?? 0),
    pricingModel:
      (row.pricing_model as ChangeOrder['pricingModel']) ?? 'standard',
    wasteFactorPercent: Number(row.waste_factor_percent ?? DEFAULT_WASTE_FACTOR_PERCENT),
    wasteCost: Number(row.waste_cost ?? 0),
    materialCostBase: Number(row.material_cost_base ?? 0),
    materialCostAdjusted: Number(row.material_cost_adjusted ?? 0),
    contingencyPercent: Number(row.contingency_percent ?? 0),
    contingencyCost: Number(row.contingency_cost ?? 0),
    taxSystem: String(row.tax_system ?? 'none'),
    taxRatePercent: Number(row.tax_rate_percent ?? 0),
    taxApplication: String(row.tax_application ?? 'materials_only'),
    taxCost: Number(row.tax_cost ?? 0),
    targetMarginPercent: Number(
      row.target_margin_percent ?? DEFAULT_TARGET_MARGIN_PERCENT,
    ),
    grossProfit: Number(row.gross_profit ?? 0),
    grossMarginPercent: Number(row.gross_margin_percent ?? 0),
    markupPercentReporting: Number(row.markup_percent_reporting ?? 0),
    costWithOverhead: Number(row.cost_with_overhead ?? 0),
    totalEstimatedCost: Number(row.total_estimated_cost ?? 0),
    feesAmount: Number(row.fees_amount ?? 0),
    permitsAmount: Number(row.permits_amount ?? 0),
    overheadPercent: Number(row.overhead_percent ?? DEFAULT_OVERHEAD_PERCENT),
    profitPercent: Number(row.profit_percent ?? DEFAULT_PROFIT_PERCENT),
    overheadAmount: Number(row.overhead_amount ?? 0),
    profitAmount: Number(row.profit_amount ?? 0),
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
    contractorName: (row.contractor_name as string) ?? null,
    contractorSignature: (row.contractor_signature as string) ?? null,
    contractorSignedAt: (row.contractor_signed_at as string) ?? null,
    clientName: (row.client_name as string) ?? null,
    clientSignature: (row.client_signature as string) ?? null,
    clientSignedAt: (row.client_signed_at as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function pricingParamsFromInput(input: ChangeOrderInput): PricingParams {
  return {
    pricingModel: input.pricingModel ?? 'standard',
    wasteFactorPercent: input.wasteFactorPercent ?? DEFAULT_WASTE_FACTOR_PERCENT,
    contingencyPercent: input.contingencyPercent ?? 0,
    overheadPercent: input.overheadPercent ?? DEFAULT_OVERHEAD_PERCENT,
    targetMarginPercent:
      input.targetMarginPercent ?? DEFAULT_TARGET_MARGIN_PERCENT,
    feesAmount: input.feesAmount ?? 0,
    permitsAmount: input.permitsAmount ?? 0,
    taxSystem: (input.taxSystem as PricingParams['taxSystem']) ?? 'none',
    taxRatePercent: input.taxRatePercent ?? 0,
    taxApplication:
      (input.taxApplication as PricingParams['taxApplication']) ??
      'materials_only',
    profitPercent: input.profitPercent ?? DEFAULT_PROFIT_PERCENT,
    markupPercent: input.markupPercent ?? 0,
  };
}

function buildPayload(
  input: ChangeOrderInput,
  breakdown: ChangeOrderPricingBreakdown,
  items: {
    labor: ChangeOrderLineItem[];
    material: ChangeOrderLineItem[];
    equipment: ChangeOrderLineItem[];
    subcontractor: ChangeOrderLineItem[];
  },
) {
  const params = pricingParamsFromInput(input);
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
    labor_items: items.labor,
    material_items: items.material,
    equipment_items: items.equipment,
    subcontractor_items: items.subcontractor,
    markup_percent: params.markupPercent ?? 0,
    fees_amount: params.feesAmount,
    permits_amount: params.permitsAmount,
    overhead_percent: params.overheadPercent,
    profit_percent: params.profitPercent ?? DEFAULT_PROFIT_PERCENT,
    overhead_amount: breakdown.overheadAmount,
    profit_amount: breakdown.profitAmount,
    subtotal: breakdown.directCost,
    total: breakdown.totalPrice,
    pricing_model: breakdown.pricingModel,
    waste_factor_percent: breakdown.wasteFactorPercent,
    waste_cost: breakdown.wasteCost,
    material_cost_base: breakdown.materialCostBase,
    material_cost_adjusted: breakdown.materialCostAdjusted,
    contingency_percent: breakdown.contingencyPercent,
    contingency_cost: breakdown.contingencyCost,
    tax_system: breakdown.taxSystem,
    tax_rate_percent: breakdown.taxRatePercent,
    tax_application: breakdown.taxApplication,
    tax_cost: breakdown.taxCost,
    target_margin_percent: breakdown.targetMarginPercent,
    gross_profit: breakdown.grossProfit,
    gross_margin_percent: breakdown.grossMarginPercent,
    markup_percent_reporting: breakdown.markupPercentReporting,
    cost_with_overhead: breakdown.costWithOverhead,
    total_estimated_cost: breakdown.totalEstimatedCost,
    schedule_impact: input.scheduleImpact ?? null,
    contractor_name: input.contractorName ?? null,
    contractor_signature: input.contractorSignature ?? null,
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

export async function fetchChangeOrdersForProjectIds(
  projectIds: string[],
): Promise<ChangeOrder[]> {
  if (projectIds.length === 0) return [];
  const { data, error } = await supabase
    .from('change_orders')
    .select('*')
    .in('project_id', projectIds)
    .neq('status', 'void')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapChangeOrder);
}

const OWNER_REVIEW_CO_STATUSES = ['draft', 'sent', 'viewed', 'declined'] as const;

/** Change orders needing owner action or follow-up (draft, out for client, declined). */
export async function fetchChangeOrdersForOwnerReview(ownerId: string): Promise<ChangeOrder[]> {
  const { data: projects } = await supabase.from('projects').select('id').eq('user_id', ownerId);
  const projectIds = (projects ?? []).map((p) => p.id as string);
  if (projectIds.length === 0) return [];

  const { data, error } = await supabase
    .from('change_orders')
    .select('*')
    .in('project_id', projectIds)
    .in('status', [...OWNER_REVIEW_CO_STATUSES])
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapChangeOrder);
}

export async function countChangeOrdersForOwnerReview(ownerId: string): Promise<number> {
  const { data: projects } = await supabase.from('projects').select('id').eq('user_id', ownerId);
  const projectIds = (projects ?? []).map((p) => p.id as string);
  if (projectIds.length === 0) return 0;

  const { count, error } = await supabase
    .from('change_orders')
    .select('id', { count: 'exact', head: true })
    .in('project_id', projectIds)
    .in('status', [...OWNER_REVIEW_CO_STATUSES]);
  if (error) throw error;
  return count ?? 0;
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

function normalizeInputItems(input: ChangeOrderInput): {
  labor: ChangeOrderLineItem[];
  material: ChangeOrderLineItem[];
  equipment: ChangeOrderLineItem[];
  subcontractor: ChangeOrderLineItem[];
} {
  return {
    labor: normalizeLineItems(input.laborItems ?? [], 'labor'),
    material: normalizeLineItems(input.materialItems ?? [], 'material'),
    equipment: normalizeLineItems(input.equipmentItems ?? [], 'equipment'),
    subcontractor: normalizeLineItems(
      input.subcontractorItems ?? [],
      'subcontractor',
    ),
  };
}

export async function saveChangeOrder(
  id: string | null,
  input: ChangeOrderInput,
): Promise<ChangeOrder> {
  const { labor, material, equipment, subcontractor } = normalizeInputItems(input);
  const params = pricingParamsFromInput(input);
  const breakdown = computePricingBreakdown(
    labor,
    material,
    equipment,
    subcontractor,
    params,
  );
  const payload = buildPayload(input, breakdown, {
    labor,
    material,
    equipment,
    subcontractor,
  });

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
    overheadPercent: DEFAULT_OVERHEAD_PERCENT,
    profitPercent: DEFAULT_PROFIT_PERCENT,
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
    overheadPercent: DEFAULT_OVERHEAD_PERCENT,
    profitPercent: DEFAULT_PROFIT_PERCENT,
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
    overheadPercent: DEFAULT_OVERHEAD_PERCENT,
    profitPercent: DEFAULT_PROFIT_PERCENT,
  });
}

export async function markChangeOrderSent(
  id: string,
  contractor?: { name: string; signature: string },
): Promise<ChangeOrder> {
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    status: 'sent',
    sent_at: now,
    updated_at: now,
  };
  if (contractor?.name?.trim()) {
    payload.contractor_name = contractor.name.trim();
    payload.contractor_signature = contractor.signature?.trim() || contractor.name.trim();
    payload.contractor_signed_at = now;
  }
  const { data, error } = await supabase
    .from('change_orders')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return mapChangeOrder(data);
}

/** Client email from project record for mailto prefill. */
export async function fetchProjectClientEmail(projectId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('client_info, client_portal_access')
    .eq('id', projectId)
    .maybeSingle();
  if (error || !data) return null;
  const portal = data.client_portal_access as { clientEmail?: string } | null;
  const info = data.client_info as { clientEmail?: string } | null;
  const email = portal?.clientEmail?.trim() || info?.clientEmail?.trim();
  return email || null;
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
