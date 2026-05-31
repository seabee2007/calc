import type { ChangeOrderLineItem } from '../types/changeOrder';
import type { ProposalData, ProposalPricingIndirect } from '../types/proposal';
import type { CompanyTaxDefaults } from '../types/pricingParams';
import {
  computePricingBreakdown,
  formatChangeOrderMoney,
  normalizeLineItems,
  type ChangeOrderPricingBreakdown,
} from './changeOrderFinancials';
import { parseProposalAmount } from './proposalFinancials';
import {
  defaultPricingParams,
  hydratePricingParams,
  pricingParamsToIndirect,
} from './pricingParams';

export function defaultProposalPricingIndirect(
  companyTax?: CompanyTaxDefaults,
): ProposalPricingIndirect {
  return pricingParamsToIndirect(defaultPricingParams(companyTax)) as ProposalPricingIndirect;
}

export function hasStructuredProposalPricing(data: ProposalData): boolean {
  return (
    (data.laborItems?.length ?? 0) > 0 ||
    (data.materialItems?.length ?? 0) > 0 ||
    (data.equipmentItems?.length ?? 0) > 0 ||
    (data.subcontractorItems?.length ?? 0) > 0
  );
}

const LABOR_KEYWORDS =
  /\b(labor|labour|crew|finishing|placement|mobilization|supervision|man[- ]?hour|custom estimate — labor)\b/i;
const EQUIPMENT_KEYWORDS =
  /\b(equipment|rental|pump truck fee|custom estimate — equipment)\b/i;
const SUBCONTRACTOR_KEYWORDS =
  /\b(subcontractor|sub[- ]?contract|trade contractor)\b/i;
const PROFIT_KEYWORDS = /\b(profit|markup|mark[- ]?up|margin)\b/i;

function lineFromLegacy(description: string, amount: number): ChangeOrderLineItem {
  return {
    description: description.trim() || 'Line item',
    amount: Math.round(amount * 100) / 100,
  };
}

export function legacyPricingToLineItems(
  pricing: ProposalData['pricing'],
): {
  laborItems: ChangeOrderLineItem[];
  materialItems: ChangeOrderLineItem[];
  equipmentItems: ChangeOrderLineItem[];
  subcontractorItems: ChangeOrderLineItem[];
} {
  const laborItems: ChangeOrderLineItem[] = [];
  const materialItems: ChangeOrderLineItem[] = [];
  const equipmentItems: ChangeOrderLineItem[] = [];
  const subcontractorItems: ChangeOrderLineItem[] = [];

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
    } else if (SUBCONTRACTOR_KEYWORDS.test(desc)) {
      subcontractorItems.push(item);
    } else {
      materialItems.push(item);
    }
  }

  return { laborItems, materialItems, equipmentItems, subcontractorItems };
}

export function resolveProposalLineItems(data: ProposalData): {
  laborItems: ChangeOrderLineItem[];
  materialItems: ChangeOrderLineItem[];
  equipmentItems: ChangeOrderLineItem[];
  subcontractorItems: ChangeOrderLineItem[];
} {
  if (hasStructuredProposalPricing(data)) {
    return {
      laborItems: data.laborItems ?? [],
      materialItems: data.materialItems ?? [],
      equipmentItems: data.equipmentItems ?? [],
      subcontractorItems: data.subcontractorItems ?? [],
    };
  }
  return legacyPricingToLineItems(data.pricing);
}

export function resolveProposalIndirect(
  data: ProposalData,
  companyTax?: CompanyTaxDefaults,
): ProposalPricingIndirect {
  return pricingParamsToIndirect(
    hydratePricingParams(data, companyTax),
  ) as ProposalPricingIndirect;
}

export function computeProposalBreakdown(
  data: ProposalData,
  companyTax?: CompanyTaxDefaults,
): ChangeOrderPricingBreakdown {
  const { laborItems, materialItems, equipmentItems, subcontractorItems } =
    resolveProposalLineItems(data);
  const params = hydratePricingParams(data, companyTax);
  return computePricingBreakdown(
    laborItems,
    materialItems,
    equipmentItems,
    subcontractorItems,
    params,
  );
}

export function formatProposalTotal(data: ProposalData): string {
  return formatChangeOrderMoney(computeProposalBreakdown(data).totalPrice);
}

export function hydrateProposalPricing(
  data: ProposalData,
  companyTax?: CompanyTaxDefaults,
): ProposalData {
  const pricingIndirect = resolveProposalIndirect(data, companyTax);
  if (hasStructuredProposalPricing(data)) {
    return {
      ...data,
      pricingIndirect,
      laborItems: normalizeLineItems(data.laborItems ?? [], 'labor'),
      materialItems: normalizeLineItems(data.materialItems ?? [], 'material'),
      equipmentItems: normalizeLineItems(data.equipmentItems ?? [], 'equipment'),
      subcontractorItems: normalizeLineItems(
        data.subcontractorItems ?? [],
        'subcontractor',
      ),
    };
  }
  const legacy = legacyPricingToLineItems(data.pricing);
  return {
    ...data,
    ...legacy,
    pricingIndirect,
    pricing: data.pricing,
  };
}

export function emptyProposalPricingState(): Pick<
  ProposalData,
  | 'laborItems'
  | 'materialItems'
  | 'equipmentItems'
  | 'subcontractorItems'
  | 'pricingIndirect'
  | 'pricing'
> {
  return {
    laborItems: [],
    materialItems: [],
    equipmentItems: [],
    subcontractorItems: [],
    pricingIndirect: defaultProposalPricingIndirect(),
    pricing: [],
  };
}
