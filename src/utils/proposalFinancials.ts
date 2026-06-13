import type { ProposalData } from '../types/proposal';
import type { ProposalFinancialFields } from '../types/proposalTracking';
import type { TrackedProposalRow } from '../types/proposalTracking';
import type { CompanyTaxDefaults } from '../types/pricingParams';
import { computeProposalBreakdown, hasStructuredProposalPricing } from './proposalPricing';

export function parseProposalAmount(amount: string): number {
  const n = parseFloat(String(amount).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function num(v: number | string | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function canComputeProposalFinancials(data: ProposalData): boolean {
  return (
    hasStructuredProposalPricing(data) ||
    Boolean(data.importedEstimateSummary) ||
    (data.pricing?.length ?? 0) > 0
  );
}

/** Detect gross profit stored as final total minus direct cost (labor + material bundle). */
export function isDirectCostGrossProfitShortcut(
  totalAmount: number,
  laborCost: number,
  materialCost: number,
  grossProfit: number,
): boolean {
  if (totalAmount <= 0 || grossProfit <= 0) return false;
  const directCostApprox = laborCost + materialCost;
  return Math.abs(grossProfit - (totalAmount - directCostApprox)) < 1;
}

/** Financial KPI fields from proposal pricing breakdown. */
export function computeProposalFinancials(
  data: ProposalData,
  depositPercent = 0.5,
  companyTax?: CompanyTaxDefaults,
): ProposalFinancialFields {
  const b = computeProposalBreakdown(data, companyTax);
  const total_amount = roundMoney(b.totalPrice);
  const total_estimated_cost = roundMoney(b.totalEstimatedCost);
  const gross_profit = roundMoney(b.totalPrice - b.totalEstimatedCost);
  const gross_margin_percent =
    total_amount > 0 ? roundMoney((gross_profit / total_amount) * 10000) / 100 : 0;
  const markup_percent =
    total_estimated_cost > 0
      ? roundMoney((gross_profit / total_estimated_cost) * 10000) / 100
      : 0;
  const labor_cost = roundMoney(b.laborTotal + b.subcontractorTotal);
  const material_cost = roundMoney(b.materialCostAdjusted);
  const equipment_cost = roundMoney(b.equipmentTotal);
  const deposit_amount =
    total_amount > 0 ? roundMoney(total_amount * depositPercent) : 0;

  return {
    total_amount,
    labor_cost,
    material_cost,
    equipment_cost,
    total_estimated_cost,
    deposit_amount,
    gross_profit,
    gross_margin_percent,
    markup_percent,
  };
}

/** Canonical gross profit from resolved financial fields. */
export function resolveProposalGrossProfit(financials: ProposalFinancialFields): number {
  if (financials.total_amount > 0 && (financials.total_estimated_cost ?? 0) > 0) {
    return roundMoney(financials.total_amount - financials.total_estimated_cost);
  }
  return financials.gross_profit ?? 0;
}

/** Resolve financial fields from live proposal data when available. */
export function resolveTrackedProposalFinancials(
  proposal: Pick<
    TrackedProposalRow,
    | 'data'
    | 'total_amount'
    | 'labor_cost'
    | 'material_cost'
    | 'deposit_amount'
    | 'gross_profit'
    | 'gross_margin_percent'
  >,
  companyTax?: CompanyTaxDefaults,
): ProposalFinancialFields {
  if (proposal.data && canComputeProposalFinancials(proposal.data)) {
    return computeProposalFinancials(proposal.data, 0.5, companyTax);
  }

  const total_amount = num(proposal.total_amount);
  const labor_cost = num(proposal.labor_cost);
  const material_cost = num(proposal.material_cost);
  let gross_profit = num(proposal.gross_profit);
  let gross_margin_percent = num(proposal.gross_margin_percent);

  if (isDirectCostGrossProfitShortcut(total_amount, labor_cost, material_cost, gross_profit)) {
    gross_profit = 0;
    gross_margin_percent = 0;
  }

  return {
    total_amount,
    labor_cost,
    material_cost,
    equipment_cost: 0,
    total_estimated_cost: 0,
    deposit_amount: num(proposal.deposit_amount),
    gross_profit,
    gross_margin_percent,
  };
}

export function resolveProposalTotalAmount(
  proposal: Pick<TrackedProposalRow, 'data' | 'total_amount'>,
  companyTax?: CompanyTaxDefaults,
): number {
  return resolveTrackedProposalFinancials(proposal, companyTax).total_amount;
}
