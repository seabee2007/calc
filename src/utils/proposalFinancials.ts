import type { ProposalData } from '../types/proposal';
import type { ProposalFinancialFields } from '../types/proposalTracking';
import { computeProposalBreakdown } from './proposalPricing';

export function parseProposalAmount(amount: string): number {
  const n = parseFloat(String(amount).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Financial KPI fields from change-order-style proposal breakdown. */
export function computeProposalFinancials(
  data: ProposalData,
  depositPercent = 0.5,
): ProposalFinancialFields {
  const b = computeProposalBreakdown(data);
  const total_amount = Math.round(b.totalPrice * 100) / 100;
  const labor_cost = Math.round(b.laborTotal * 100) / 100;
  const material_cost = Math.round((b.materialTotal + b.equipmentTotal) * 100) / 100;
  const deposit_amount =
    total_amount > 0 ? Math.round(total_amount * depositPercent * 100) / 100 : 0;

  return {
    total_amount,
    labor_cost,
    material_cost,
    deposit_amount,
  };
}
