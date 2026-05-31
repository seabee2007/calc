import type { ProposalData } from '../types/proposal';
import type { ProposalFinancialFields } from '../types/proposalTracking';
import type { CompanyTaxDefaults } from '../types/pricingParams';
import { computeProposalBreakdown } from './proposalPricing';

export function parseProposalAmount(amount: string): number {
  const n = parseFloat(String(amount).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Financial KPI fields from proposal pricing breakdown. */
export function computeProposalFinancials(
  data: ProposalData,
  depositPercent = 0.5,
  companyTax?: CompanyTaxDefaults,
): ProposalFinancialFields {
  const b = computeProposalBreakdown(data, companyTax);
  const total_amount = Math.round(b.totalPrice * 100) / 100;
  const labor_cost = Math.round(
    (b.laborTotal + b.subcontractorTotal) * 100,
  ) / 100;
  const material_cost =
    Math.round((b.materialCostAdjusted + b.equipmentTotal) * 100) / 100;
  const deposit_amount =
    total_amount > 0 ? Math.round(total_amount * depositPercent * 100) / 100 : 0;
  const gross_profit = Math.round(b.grossProfit * 100) / 100;
  const gross_margin_percent = Math.round(b.grossMarginPercent * 100) / 100;

  return {
    total_amount,
    labor_cost,
    material_cost,
    deposit_amount,
    gross_profit,
    gross_margin_percent,
  };
}
