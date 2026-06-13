import type { TrackedProposalRow, ProposalStatus } from '../types/proposalTracking';
import { PROPOSAL_PIPELINE_STATUSES } from '../types/proposalTracking';
import {
  resolveProposalGrossProfit,
  resolveTrackedProposalFinancials,
} from './proposalFinancials';

export type ProposalPipelineCounts = Record<ProposalStatus, number>;

export type ProposalPipelineRevenue = Record<ProposalStatus, number>;

export interface ProposalFinancialKpis {
  /** Sent / viewed / opened — awaiting client decision */
  pendingRevenue: number;
  /** All open deals except declined & paid */
  openPipelineRevenue: number;
  /** Probability-weighted open pipeline (matches CRM) */
  weightedForecast: number;
  acceptedRevenue: number;
  monthlyRevenue: number;
  averageJobSize: number;
  winRate: number;
  laborCostTotal: number;
  materialCostTotal: number;
  equipmentCostTotal: number;
  totalEstimatedCost: number;
  grossProfit: number;
  acceptedCount: number;
  declinedCount: number;
  /** Rolled up from projects.current_contract_value */
  currentContractValue: number;
  /** Rolled up from projects.approved_change_order_total */
  approvedChangeOrderTotal: number;
  /** Change orders sent / viewed (client has not accepted yet) */
  changeOrderPendingRevenue: number;
  /** Sum of accepted change order totals (from CO records) */
  changeOrderAcceptedRevenue: number;
  /** Probability-weighted open change orders */
  changeOrderWeightedForecast: number;
}

export interface ProposalDashboardMetrics {
  pipeline: ProposalPipelineCounts;
  pipelineRevenue: ProposalPipelineRevenue;
  financial: ProposalFinancialKpis;
}

const PENDING_STATUSES: ProposalStatus[] = ['sent', 'viewed', 'opened'];
const WON_STATUSES: ProposalStatus[] = ['accepted', 'deposit_paid', 'scheduled', 'paid'];

const WEIGHT_BY_STATUS: Record<ProposalStatus, number> = {
  draft: 0.1,
  sent: 0.25,
  viewed: 0.5,
  opened: 0.5,
  accepted: 1,
  declined: 0,
  deposit_paid: 1,
  scheduled: 1,
  paid: 1,
};

function isOpenPipeline(status: ProposalStatus): boolean {
  return status !== 'declined' && status !== 'paid';
}

function num(v: number | string | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

function proposalAmount(p: TrackedProposalRow): number {
  return resolveTrackedProposalFinancials(p).total_amount;
}

function proposalGrossProfit(p: TrackedProposalRow): number {
  return resolveProposalGrossProfit(resolveTrackedProposalFinancials(p));
}

function proposalLaborCost(p: TrackedProposalRow): number {
  return resolveTrackedProposalFinancials(p).labor_cost;
}

function proposalMaterialCost(p: TrackedProposalRow): number {
  return resolveTrackedProposalFinancials(p).material_cost;
}

function proposalEquipmentCost(p: TrackedProposalRow): number {
  return resolveTrackedProposalFinancials(p).equipment_cost ?? 0;
}

function proposalTotalEstimatedCost(p: TrackedProposalRow): number {
  return resolveTrackedProposalFinancials(p).total_estimated_cost ?? 0;
}

function isPending(status: ProposalStatus): boolean {
  return PENDING_STATUSES.includes(status);
}

function isWon(status: ProposalStatus): boolean {
  return WON_STATUSES.includes(status);
}

function wonAt(p: TrackedProposalRow): string | null {
  // Use the most meaningful "won" timestamp available for monthly rollups.
  // Fall back to updated_at if we have no stage timestamp (older rows).
  return (
    (p.paid_at as any) ??
    p.scheduled_at ??
    p.deposit_paid_at ??
    p.accepted_at ??
    p.updated_at ??
    null
  );
}

export function buildProposalPipelineCounts(
  proposals: TrackedProposalRow[],
): ProposalPipelineCounts {
  const counts = Object.fromEntries(
    PROPOSAL_PIPELINE_STATUSES.map((s) => [s, 0]),
  ) as ProposalPipelineCounts;

  for (const p of proposals) {
    const status = p.status ?? 'draft';
    if (status in counts) counts[status as ProposalStatus] += 1;
    else counts.draft += 1;
  }

  return counts;
}

export function buildProposalPipelineRevenue(
  proposals: TrackedProposalRow[],
): ProposalPipelineRevenue {
  const revenue = Object.fromEntries(
    PROPOSAL_PIPELINE_STATUSES.map((s) => [s, 0]),
  ) as ProposalPipelineRevenue;

  for (const p of proposals) {
    const status = (p.status ?? 'draft') as ProposalStatus;
    const amount = proposalAmount(p);
    if (status in revenue) revenue[status as ProposalStatus] += amount;
    else revenue.draft += amount;
  }

  return revenue;
}

export function buildProposalFinancialKpis(
  proposals: TrackedProposalRow[],
  now = new Date(),
): ProposalFinancialKpis {
  const wonProposals = proposals.filter((p) => isWon(p.status));
  const pendingProposals = proposals.filter((p) => isPending(p.status));
  const declinedProposals = proposals.filter((p) => p.status === 'declined');

  const wonCount = wonProposals.length;
  const declinedCount = declinedProposals.length;
  const sentCount = wonCount + declinedCount + pendingProposals.length;

  const totalRevenue = wonProposals.reduce(
    (sum, p) => sum + proposalAmount(p),
    0,
  );

  const pendingRevenue = pendingProposals.reduce(
    (sum, p) => sum + proposalAmount(p),
    0,
  );

  const openProposals = proposals.filter((p) => isOpenPipeline(p.status ?? 'draft'));
  const openPipelineRevenue = openProposals.reduce(
    (sum, p) => sum + proposalAmount(p),
    0,
  );
  const weightedForecast = openProposals.reduce((sum, p) => {
    const status = (p.status ?? 'draft') as ProposalStatus;
    return sum + proposalAmount(p) * (WEIGHT_BY_STATUS[status] ?? 0);
  }, 0);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyRevenue = wonProposals
    .filter((p) => {
      const at = wonAt(p);
      return at ? new Date(at) >= monthStart : false;
    })
    .reduce((sum, p) => sum + proposalAmount(p), 0);

  // Win rate = won / sent (excluding drafts)
  const winRate = sentCount > 0 ? wonCount / sentCount : 0;

  const averageJobSize = wonCount > 0 ? totalRevenue / wonCount : 0;

  // Costs should be compared to revenue for the same cohort (won).
  const laborCostTotal = wonProposals.reduce(
    (sum, p) => sum + proposalLaborCost(p),
    0,
  );
  const materialCostTotal = wonProposals.reduce(
    (sum, p) => sum + proposalMaterialCost(p),
    0,
  );
  const equipmentCostTotal = wonProposals.reduce(
    (sum, p) => sum + proposalEquipmentCost(p),
    0,
  );
  const totalEstimatedCost = wonProposals.reduce(
    (sum, p) => sum + proposalTotalEstimatedCost(p),
    0,
  );

  const grossProfit = wonProposals.reduce(
    (sum, p) => sum + proposalGrossProfit(p),
    0,
  );

  return {
    pendingRevenue,
    openPipelineRevenue,
    weightedForecast,
    acceptedRevenue: totalRevenue,
    monthlyRevenue,
    averageJobSize,
    winRate,
    laborCostTotal,
    materialCostTotal,
    equipmentCostTotal,
    totalEstimatedCost,
    grossProfit,
    acceptedCount: wonCount,
    declinedCount,
    currentContractValue: 0,
    approvedChangeOrderTotal: 0,
    changeOrderPendingRevenue: 0,
    changeOrderAcceptedRevenue: 0,
    changeOrderWeightedForecast: 0,
  };
}

export function mergeProjectContractRollup(
  financial: ProposalFinancialKpis,
  projects: { currentContractValue?: number; approvedChangeOrderTotal?: number }[],
): ProposalFinancialKpis {
  let currentContractValue = 0;
  let approvedChangeOrderTotal = 0;
  for (const p of projects) {
    currentContractValue += num(p.currentContractValue);
    approvedChangeOrderTotal += num(p.approvedChangeOrderTotal);
  }
  return { ...financial, currentContractValue, approvedChangeOrderTotal };
}

export function buildProposalDashboardMetrics(
  proposals: TrackedProposalRow[],
  now = new Date(),
): ProposalDashboardMetrics {
  return {
    pipeline: buildProposalPipelineCounts(proposals),
    pipelineRevenue: buildProposalPipelineRevenue(proposals),
    financial: buildProposalFinancialKpis(proposals, now),
  };
}

export function formatProposalMoney(n: number): string {
  return n.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

export function formatWinRate(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}
