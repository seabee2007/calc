import type { ChangeOrderLineItem } from '../types/changeOrder';
import type { ProposalData, ProposalPricingIndirect } from '../types/proposal';
import {
  computeChangeOrderBreakdown,
  DEFAULT_OVERHEAD_PERCENT,
  DEFAULT_PROFIT_PERCENT,
  formatChangeOrderMoney,
  normalizeLineItems,
  type ChangeOrderPricingBreakdown,
} from './changeOrderFinancials';
import { parseProposalAmount } from './proposalFinancials';

export function defaultProposalPricingIndirect(): ProposalPricingIndirect {
  return {
    feesAmount: 0,
    permitsAmount: 0,
    overheadPercent: DEFAULT_OVERHEAD_PERCENT,
    profitPercent: DEFAULT_PROFIT_PERCENT,
    markupPercent: 0,
  };
}

export function hasStructuredProposalPricing(data: ProposalData): boolean {
  return (
    (data.laborItems?.length ?? 0) > 0 ||
    (data.materialItems?.length ?? 0) > 0 ||
    (data.equipmentItems?.length ?? 0) > 0
  );
}

const LABOR_KEYWORDS =
  /\b(labor|labour|crew|finishing|placement|mobilization|supervision|man[- ]?hour|custom estimate — labor)\b/i;
const EQUIPMENT_KEYWORDS =
  /\b(equipment|rental|pump truck fee|custom estimate — equipment)\b/i;
const PROFIT_KEYWORDS = /\b(profit|markup|mark[- ]?up|margin)\b/i;

function lineFromLegacy(description: string, amount: number): ChangeOrderLineItem {
  return {
    description: description.trim() || 'Line item',
    amount: Math.round(amount * 100) / 100,
  };
}

/** Map legacy flat pricing rows into labor / material / equipment buckets. */
export function legacyPricingToLineItems(
  pricing: ProposalData['pricing'],
): {
  laborItems: ChangeOrderLineItem[];
  materialItems: ChangeOrderLineItem[];
  equipmentItems: ChangeOrderLineItem[];
} {
  const laborItems: ChangeOrderLineItem[] = [];
  const materialItems: ChangeOrderLineItem[] = [];
  const equipmentItems: ChangeOrderLineItem[] = [];

  for (const row of pricing ?? []) {
    const desc = row.description ?? '';
    const amt = parseProposalAmount(row.amount);
    if (amt <= 0) continue;
    if (PROFIT_KEYWORDS.test(desc)) continue;

    const item = lineFromLegacy(desc, amt);
    if (LABOR_KEYWORDS.test(desc)) {
      laborItems.push(item);
    } else if (EQUIPMENT_KEYWORDS.test(desc)) {
      equipmentItems.push(item);
    } else {
      materialItems.push(item);
    }
  }

  return { laborItems, materialItems, equipmentItems };
}

export function resolveProposalLineItems(data: ProposalData): {
  laborItems: ChangeOrderLineItem[];
  materialItems: ChangeOrderLineItem[];
  equipmentItems: ChangeOrderLineItem[];
} {
  if (hasStructuredProposalPricing(data)) {
    return {
      laborItems: data.laborItems ?? [],
      materialItems: data.materialItems ?? [],
      equipmentItems: data.equipmentItems ?? [],
    };
  }
  return legacyPricingToLineItems(data.pricing);
}

export function resolveProposalIndirect(data: ProposalData): ProposalPricingIndirect {
  return {
    ...defaultProposalPricingIndirect(),
    ...data.pricingIndirect,
  };
}

export function computeProposalBreakdown(data: ProposalData): ChangeOrderPricingBreakdown {
  const { laborItems, materialItems, equipmentItems } = resolveProposalLineItems(data);
  const indirect = resolveProposalIndirect(data);
  return computeChangeOrderBreakdown(
    laborItems,
    materialItems,
    equipmentItems,
    indirect,
  );
}

export function formatProposalTotal(data: ProposalData): string {
  return formatChangeOrderMoney(computeProposalBreakdown(data).totalPrice);
}

/** Ensure structured line items exist (migrate legacy pricing once). */
export function hydrateProposalPricing(data: ProposalData): ProposalData {
  if (hasStructuredProposalPricing(data)) {
    return {
      ...data,
      pricingIndirect: resolveProposalIndirect(data),
      laborItems: normalizeLineItems(data.laborItems ?? [], 'labor'),
      materialItems: normalizeLineItems(data.materialItems ?? [], 'material'),
      equipmentItems: normalizeLineItems(data.equipmentItems ?? [], 'equipment'),
    };
  }
  const legacy = legacyPricingToLineItems(data.pricing);
  return {
    ...data,
    ...legacy,
    pricingIndirect: resolveProposalIndirect(data),
    pricing: data.pricing,
  };
}

export function emptyProposalPricingState(): Pick<
  ProposalData,
  'laborItems' | 'materialItems' | 'equipmentItems' | 'pricingIndirect' | 'pricing'
> {
  return {
    laborItems: [],
    materialItems: [],
    equipmentItems: [],
    pricingIndirect: defaultProposalPricingIndirect(),
    pricing: [],
  };
}
