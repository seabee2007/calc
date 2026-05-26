import { REBAR_PRICING_2026, getRebarSizePricing } from '../data/rebarPricing2026';
import {
  getRegionalMultiplier,
  REGIONAL_MULTIPLIER_LABELS,
  regionalMultiplierKeyFromAddress,
  type RegionalMultiplierKey,
} from '../data/regionalMultipliers';
import type { ReinforcementPricing, ReinforcementPricingLineItem } from '../types/reinforcementPricing';
import type { USAddress } from '../types/address';
import type { CutListItem, RebarSize } from './reinforcement';

/** Sticks of stock length required for one cut (buy full sticks). */
export function sticksPerCut(lengthFt: number, stockFt: number): number {
  if (lengthFt <= 0) return 0;
  return Math.max(1, Math.ceil(lengthFt / stockFt));
}

export function estimateRebarMaterialCost(params: {
  barSize: RebarSize;
  cutItems: CutListItem[];
  stockFt?: number;
  regionalKey?: RegionalMultiplierKey;
  jobsiteAddress?: USAddress | null;
  totalLinearFt?: number;
}): ReinforcementPricing | null {
  const sizeRow = getRebarSizePricing(params.barSize);
  if (!sizeRow) return null;

  const stockFt = params.stockFt ?? 20;
  const regionalKey =
    params.regionalKey ?? regionalMultiplierKeyFromAddress(params.jobsiteAddress);
  const regionalMultiplier = getRegionalMultiplier(regionalKey);

  const lineItems: ReinforcementPricingLineItem[] = [];
  let sticksRequired = 0;

  for (const item of params.cutItems) {
    const sticksPerPiece = sticksPerCut(item.lengthFt, stockFt);
    const sticksTotal = sticksPerPiece * item.qty;
    const cost = sticksTotal * sizeRow.estimatedCostEach;
    sticksRequired += sticksTotal;
    lineItems.push({
      lengthFt: item.lengthFt,
      qty: item.qty,
      sticksPerPiece,
      sticksTotal,
      cost: Math.round(cost * 100) / 100,
    });
  }

  if (sticksRequired <= 0) return null;

  const subtotalBeforeRegional = sticksRequired * sizeRow.estimatedCostEach;
  const estimatedCost = Math.round(subtotalBeforeRegional * regionalMultiplier);

  return {
    estimatedCost,
    catalog: 'rebarPricing2026',
    currency: REBAR_PRICING_2026.currency,
    unit: REBAR_PRICING_2026.unit,
    grade: REBAR_PRICING_2026.grade,
    barSize: params.barSize,
    regionalKey,
    regionalMultiplier,
    regionalLabel: REGIONAL_MULTIPLIER_LABELS[regionalKey],
    sticksRequired,
    costPerStick: sizeRow.estimatedCostEach,
    subtotalBeforeRegional: Math.round(subtotalBeforeRegional),
    totalLinearFt: params.totalLinearFt,
    lineItems,
    notes: `${params.barSize} @ $${sizeRow.estimatedCostEach.toFixed(2)}/${REBAR_PRICING_2026.unit} × ${sticksRequired} sticks × ${regionalMultiplier} (${REGIONAL_MULTIPLIER_LABELS[regionalKey]})`,
  };
}

/** Flatten slab X/Y or column vertical + tie cut lists. */
export function collectRebarCutItems(
  items: CutListItem[],
  ...more: CutListItem[][]
): CutListItem[] {
  return [...items, ...more.flat()];
}
