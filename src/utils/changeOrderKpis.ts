import type { ChangeOrder, ChangeOrderStatus } from '../types/changeOrder';

/** Statuses shown on the ops dashboard CO pipeline (excludes void). */
export const CHANGE_ORDER_PIPELINE_STATUSES = [
  'draft',
  'sent',
  'viewed',
  'accepted',
  'declined',
] as const;

export type ChangeOrderPipelineStatus = (typeof CHANGE_ORDER_PIPELINE_STATUSES)[number];

export const CHANGE_ORDER_STATUS_LABELS: Record<ChangeOrderPipelineStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  viewed: 'Viewed',
  accepted: 'Accepted',
  declined: 'Declined',
};

export type ChangeOrderPipelineCounts = Record<ChangeOrderPipelineStatus, number>;
export type ChangeOrderPipelineRevenue = Record<ChangeOrderPipelineStatus, number>;

export interface ChangeOrderFinancialKpis {
  /** Sent / viewed — awaiting client decision */
  pendingRevenue: number;
  openPipelineRevenue: number;
  weightedForecast: number;
  acceptedRevenue: number;
  declinedRevenue: number;
  monthlyAcceptedRevenue: number;
  acceptedCount: number;
  declinedCount: number;
  sentCount: number;
  winRate: number;
  directLaborTotal: number;
  directMaterialTotal: number;
  directEquipmentTotal: number;
  totalEstimatedCost: number;
  grossProfit: number;
}

export interface ChangeOrderDashboardMetrics {
  pipeline: ChangeOrderPipelineCounts;
  pipelineRevenue: ChangeOrderPipelineRevenue;
  financial: ChangeOrderFinancialKpis;
}

const PENDING_STATUSES: ChangeOrderStatus[] = ['sent', 'viewed'];
const ACCEPTED_STATUS: ChangeOrderStatus = 'accepted';

const WEIGHT_BY_STATUS: Record<ChangeOrderPipelineStatus, number> = {
  draft: 0.1,
  sent: 0.25,
  viewed: 0.5,
  accepted: 1,
  declined: 0,
};

function num(v: number | string | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

function isPending(status: ChangeOrderStatus): boolean {
  return PENDING_STATUSES.includes(status);
}

function sumLabor(co: ChangeOrder): number {
  return co.laborItems.reduce((s, row) => s + num(row.amount), 0);
}

function sumMaterial(co: ChangeOrder): number {
  return co.materialItems.reduce((s, row) => s + num(row.amount), 0);
}

function sumSubcontractor(co: ChangeOrder): number {
  return (co.subcontractorItems ?? []).reduce((s, row) => s + num(row.amount), 0);
}

function sumEquipment(co: ChangeOrder): number {
  return co.equipmentItems.reduce((s, row) => s + num(row.amount), 0);
}

function coGrossProfit(co: ChangeOrder): number {
  if (co.grossProfit > 0) return num(co.grossProfit);
  if (co.totalEstimatedCost > 0) return num(co.total) - num(co.totalEstimatedCost);
  return 0;
}

function acceptedAt(co: ChangeOrder): string | null {
  return co.acceptedAt ?? co.updatedAt ?? null;
}

export function buildChangeOrderPipelineCounts(
  orders: ChangeOrder[],
): ChangeOrderPipelineCounts {
  const counts = Object.fromEntries(
    CHANGE_ORDER_PIPELINE_STATUSES.map((s) => [s, 0]),
  ) as ChangeOrderPipelineCounts;

  for (const co of orders) {
    if (co.status === 'void') continue;
    const status = co.status as ChangeOrderPipelineStatus;
    if (status in counts) counts[status] += 1;
    else counts.draft += 1;
  }

  return counts;
}

export function buildChangeOrderPipelineRevenue(
  orders: ChangeOrder[],
): ChangeOrderPipelineRevenue {
  const revenue = Object.fromEntries(
    CHANGE_ORDER_PIPELINE_STATUSES.map((s) => [s, 0]),
  ) as ChangeOrderPipelineRevenue;

  for (const co of orders) {
    if (co.status === 'void') continue;
    const status = co.status as ChangeOrderPipelineStatus;
    const amount = num(co.total);
    if (status in revenue) revenue[status] += amount;
    else revenue.draft += amount;
  }

  return revenue;
}

export function buildChangeOrderFinancialKpis(
  orders: ChangeOrder[],
  now = new Date(),
): ChangeOrderFinancialKpis {
  const active = orders.filter((co) => co.status !== 'void');
  const accepted = active.filter((co) => co.status === ACCEPTED_STATUS);
  const pending = active.filter((co) => isPending(co.status));
  const declined = active.filter((co) => co.status === 'declined');
  const open = active.filter((co) => co.status !== 'declined');

  const acceptedRevenue = accepted.reduce((s, co) => s + num(co.total), 0);
  const pendingRevenue = pending.reduce((s, co) => s + num(co.total), 0);
  const declinedRevenue = declined.reduce((s, co) => s + num(co.total), 0);
  const openPipelineRevenue = open.reduce((s, co) => s + num(co.total), 0);

  const weightedForecast = open.reduce((s, co) => {
    const status = (co.status === 'void' ? 'draft' : co.status) as ChangeOrderPipelineStatus;
    const weight = WEIGHT_BY_STATUS[status] ?? 0;
    return s + num(co.total) * weight;
  }, 0);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyAcceptedRevenue = accepted
    .filter((co) => {
      const at = acceptedAt(co);
      return at ? new Date(at) >= monthStart : false;
    })
    .reduce((s, co) => s + num(co.total), 0);

  const acceptedCount = accepted.length;
  const declinedCount = declined.length;
  const sentCount = acceptedCount + declinedCount + pending.length;

  const winRate = sentCount > 0 ? acceptedCount / sentCount : 0;

  const directLaborTotal = accepted.reduce(
    (s, co) => s + sumLabor(co) + sumSubcontractor(co),
    0,
  );
  const directMaterialTotal = accepted.reduce((s, co) => s + sumMaterial(co), 0);
  const directEquipmentTotal = accepted.reduce((s, co) => s + sumEquipment(co), 0);
  const totalEstimatedCost = accepted.reduce((s, co) => s + num(co.totalEstimatedCost), 0);
  const grossProfit = accepted.reduce((s, co) => s + coGrossProfit(co), 0);

  return {
    pendingRevenue,
    openPipelineRevenue,
    weightedForecast,
    acceptedRevenue,
    declinedRevenue,
    monthlyAcceptedRevenue,
    acceptedCount,
    declinedCount,
    sentCount,
    winRate,
    directLaborTotal,
    directMaterialTotal,
    directEquipmentTotal,
    totalEstimatedCost,
    grossProfit,
  };
}

export function buildChangeOrderDashboardMetrics(
  orders: ChangeOrder[],
  now = new Date(),
): ChangeOrderDashboardMetrics {
  return {
    pipeline: buildChangeOrderPipelineCounts(orders),
    pipelineRevenue: buildChangeOrderPipelineRevenue(orders),
    financial: buildChangeOrderFinancialKpis(orders, now),
  };
}

import type { ProposalFinancialKpis } from './proposalKpis';

/** Fold change order dollars into the main dashboard financial snapshot. */
export function mergeChangeOrderIntoProposalFinancial(
  proposal: ProposalFinancialKpis,
  co: ChangeOrderFinancialKpis,
): ProposalFinancialKpis {
  const acceptedRevenue = proposal.acceptedRevenue + co.acceptedRevenue;
  const laborCostTotal = proposal.laborCostTotal + co.directLaborTotal;
  const materialCostTotal = proposal.materialCostTotal + co.directMaterialTotal;
  const equipmentCostTotal = proposal.equipmentCostTotal + co.directEquipmentTotal;
  const totalEstimatedCost = proposal.totalEstimatedCost + co.totalEstimatedCost;

  return {
    ...proposal,
    pendingRevenue: proposal.pendingRevenue + co.pendingRevenue,
    openPipelineRevenue: proposal.openPipelineRevenue + co.openPipelineRevenue,
    weightedForecast: proposal.weightedForecast + co.weightedForecast,
    acceptedRevenue,
    laborCostTotal,
    materialCostTotal,
    equipmentCostTotal,
    totalEstimatedCost,
    grossProfit: proposal.grossProfit + co.grossProfit,
    acceptedCount: proposal.acceptedCount + co.acceptedCount,
    declinedCount: proposal.declinedCount + co.declinedCount,
    changeOrderPendingRevenue: co.pendingRevenue,
    changeOrderAcceptedRevenue: co.acceptedRevenue,
    changeOrderWeightedForecast: co.weightedForecast,
  };
}
