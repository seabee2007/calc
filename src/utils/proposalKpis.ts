import type { TrackedProposalRow, ProposalStatus } from '../types/proposalTracking';
import { PROPOSAL_PIPELINE_STATUSES } from '../types/proposalTracking';

export type ProposalPipelineCounts = Record<ProposalStatus, number>;

export interface ProposalFinancialKpis {
  pendingRevenue: number;
  acceptedRevenue: number;
  monthlyRevenue: number;
  averageJobSize: number;
  winRate: number;
  laborCostTotal: number;
  materialCostTotal: number;
  grossProfit: number;
  acceptedCount: number;
  declinedCount: number;
}

export interface ProposalDashboardMetrics {
  pipeline: ProposalPipelineCounts;
  financial: ProposalFinancialKpis;
}

const PENDING_STATUSES: ProposalStatus[] = ['sent', 'viewed', 'opened'];

function num(v: number | string | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
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

export function buildProposalFinancialKpis(
  proposals: TrackedProposalRow[],
  now = new Date(),
): ProposalFinancialKpis {
  const acceptedProposals = proposals.filter((p) => p.status === 'accepted');
  const acceptedCount = acceptedProposals.length;
  const declinedCount = proposals.filter((p) => p.status === 'declined').length;

  const totalRevenue = acceptedProposals.reduce(
    (sum, p) => sum + num(p.total_amount),
    0,
  );

  const pendingRevenue = proposals
    .filter((p) => PENDING_STATUSES.includes(p.status))
    .reduce((sum, p) => sum + num(p.total_amount), 0);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyRevenue = acceptedProposals
    .filter((p) => {
      const at = p.accepted_at ?? p.updated_at;
      return at && new Date(at) >= monthStart;
    })
    .reduce((sum, p) => sum + num(p.total_amount), 0);

  const winRate =
    acceptedCount + declinedCount > 0
      ? acceptedCount / (acceptedCount + declinedCount)
      : 0;

  const averageJobSize = acceptedCount > 0 ? totalRevenue / acceptedCount : 0;

  const laborCostTotal = proposals.reduce((sum, p) => sum + num(p.labor_cost), 0);
  const materialCostTotal = proposals.reduce(
    (sum, p) => sum + num(p.material_cost),
    0,
  );

  const grossProfit = totalRevenue - laborCostTotal - materialCostTotal;

  return {
    pendingRevenue,
    acceptedRevenue: totalRevenue,
    monthlyRevenue,
    averageJobSize,
    winRate,
    laborCostTotal,
    materialCostTotal,
    grossProfit,
    acceptedCount,
    declinedCount,
  };
}

export function buildProposalDashboardMetrics(
  proposals: TrackedProposalRow[],
  now = new Date(),
): ProposalDashboardMetrics {
  return {
    pipeline: buildProposalPipelineCounts(proposals),
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
