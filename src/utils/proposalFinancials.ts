import type { ProposalData } from '../types/proposal';
import type { ProposalFinancialFields } from '../types/proposalTracking';

export function parseProposalAmount(amount: string): number {
  const n = parseFloat(String(amount).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

const LABOR_KEYWORDS =
  /\b(labor|labour|crew|finishing|placement|mobilization|supervision|man[- ]?hour)\b/i;
const MATERIAL_KEYWORDS =
  /\b(concrete|rebar|reinforcement|ready[- ]?mix|material|delivery|pump|steel|wire mesh)\b/i;

/** Split pricing lines into labor vs material totals for KPI storage. */
export function computeProposalFinancials(
  data: ProposalData,
  depositPercent = 0.5,
): ProposalFinancialFields {
  let labor_cost = 0;
  let material_cost = 0;
  let other = 0;

  for (const row of data.pricing ?? []) {
    const amt = parseProposalAmount(row.amount);
    if (amt <= 0) continue;
    const desc = row.description ?? '';
    if (LABOR_KEYWORDS.test(desc)) {
      labor_cost += amt;
    } else if (MATERIAL_KEYWORDS.test(desc)) {
      material_cost += amt;
    } else {
      other += amt;
    }
  }

  if (labor_cost === 0 && material_cost === 0 && other > 0) {
    material_cost = other;
  } else if (other > 0) {
    material_cost += other * 0.7;
    labor_cost += other * 0.3;
  }

  const total_amount = labor_cost + material_cost;
  const deposit_amount =
    total_amount > 0 ? Math.round(total_amount * depositPercent * 100) / 100 : 0;

  return {
    total_amount: Math.round(total_amount * 100) / 100,
    labor_cost: Math.round(labor_cost * 100) / 100,
    material_cost: Math.round(material_cost * 100) / 100,
    deposit_amount,
  };
}
