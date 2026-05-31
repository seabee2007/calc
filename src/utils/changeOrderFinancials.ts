import type { ChangeOrderLineItem, ChangeOrderLineItemCategory } from '../types/changeOrder';
import type { PricingParams, TaxApplication } from '../types/pricingParams';
import { normalizePricingParams } from './pricingParams';

export const DEFAULT_OVERHEAD_PERCENT = 8;
export const DEFAULT_PROFIT_PERCENT = 8;
export const DEFAULT_TARGET_MARGIN_PERCENT = 20;
export const DEFAULT_WASTE_FACTOR_PERCENT = 10;

export function computeLaborMaterialLineTotal(row: ChangeOrderLineItem): number {
  const qty = Number(row.qty) || 0;
  const unitPrice = Number(row.unitPrice) || 0;
  if (qty > 0 && unitPrice > 0) {
    return roundMoney(qty * unitPrice);
  }
  return roundMoney(Number(row.amount) || 0);
}

export function computeEquipmentLineTotal(row: ChangeOrderLineItem): number {
  const qty = Number(row.qty) || 0;
  const hours = Number(row.hours) || 0;
  const rate = Number(row.unitPrice) || 0;
  if (qty > 0 && hours > 0 && rate > 0) {
    return roundMoney(qty * hours * rate);
  }
  return roundMoney(Number(row.amount) || 0);
}

export function computeLineItemTotal(
  row: ChangeOrderLineItem,
  category: ChangeOrderLineItemCategory,
): number {
  if (category === 'equipment') {
    return computeEquipmentLineTotal(row);
  }
  return computeLaborMaterialLineTotal(row);
}

export function normalizeLineItems(
  items: ChangeOrderLineItem[],
  category: ChangeOrderLineItemCategory,
): ChangeOrderLineItem[] {
  return items.map((row) => ({
    ...row,
    amount: computeLineItemTotal(row, category),
  }));
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function safeMoney(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? roundMoney(n) : 0;
}

/** Category subtotals from line items (never NaN). */
export function sumCategoryCost(
  items: ChangeOrderLineItem[] | undefined,
  category: ChangeOrderLineItemCategory,
): number {
  return safeMoney(sumLineItems(items ?? [], category));
}

export function sumLineItems(
  items: ChangeOrderLineItem[],
  category: ChangeOrderLineItemCategory,
): number {
  return items.reduce((s, row) => s + computeLineItemTotal(row, category), 0);
}

/** @deprecated Use PricingParams — kept for legacy callers */
export interface ChangeOrderIndirectInputs {
  feesAmount: number;
  permitsAmount: number;
  overheadPercent: number;
  profitPercent: number;
  markupPercent: number;
  pricingModel?: 'legacy' | 'standard';
  wasteFactorPercent?: number;
  contingencyPercent?: number;
  targetMarginPercent?: number;
  taxSystem?: PricingParams['taxSystem'];
  taxRatePercent?: number;
  taxApplication?: TaxApplication;
}

export interface ChangeOrderPricingBreakdown {
  pricingModel: 'legacy' | 'standard';
  laborTotal: number;
  materialTotal: number;
  equipmentTotal: number;
  subcontractorTotal: number;
  materialCostBase: number;
  wasteFactorPercent: number;
  wasteCost: number;
  materialCostAdjusted: number;
  directCost: number;
  feesAmount: number;
  permitsAmount: number;
  contingencyPercent: number;
  contingencyCost: number;
  preTaxCost: number;
  taxSystem: PricingParams['taxSystem'];
  taxRatePercent: number;
  taxApplication: TaxApplication;
  taxCost: number;
  costBeforeOverhead: number;
  overheadPercent: number;
  overheadAmount: number;
  costWithOverhead: number;
  totalEstimatedCost: number;
  targetMarginPercent: number;
  grossProfit: number;
  grossMarginPercent: number;
  markupPercentReporting: number;
  /** Legacy fields */
  profitPercent: number;
  profitAmount: number;
  markupPercent: number;
  markupAmount: number;
  indirectCost: number;
  totalPrice: number;
}

export function formatChangeOrderMoney(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });
}

export function paramsFromLegacyIndirect(
  indirect: ChangeOrderIndirectInputs,
): PricingParams {
  return {
    pricingModel: indirect.pricingModel ?? 'legacy',
    wasteFactorPercent: indirect.wasteFactorPercent ?? DEFAULT_WASTE_FACTOR_PERCENT,
    contingencyPercent: indirect.contingencyPercent ?? 0,
    overheadPercent: indirect.overheadPercent ?? DEFAULT_OVERHEAD_PERCENT,
    targetMarginPercent:
      indirect.targetMarginPercent ?? DEFAULT_TARGET_MARGIN_PERCENT,
    feesAmount: indirect.feesAmount ?? 0,
    permitsAmount: indirect.permitsAmount ?? 0,
    taxSystem: indirect.taxSystem ?? 'none',
    taxRatePercent: indirect.taxRatePercent ?? 0,
    taxApplication: indirect.taxApplication ?? 'materials_only',
    profitPercent: indirect.profitPercent ?? DEFAULT_PROFIT_PERCENT,
    markupPercent: indirect.markupPercent ?? 0,
  };
}

export function computeTaxableAmount(input: {
  taxApplication: TaxApplication;
  materialCostAdjusted: number;
  equipmentTotal: number;
  preTaxCost: number;
}): number {
  switch (input.taxApplication) {
    case 'materials_only':
      return input.materialCostAdjusted;
    case 'materials_and_equipment':
      return input.materialCostAdjusted + input.equipmentTotal;
    case 'entire_project':
      return input.preTaxCost;
    default:
      return input.materialCostAdjusted;
  }
}

export function computeLegacyPricingBreakdown(
  laborItems: ChangeOrderLineItem[],
  materialItems: ChangeOrderLineItem[],
  equipmentItems: ChangeOrderLineItem[],
  subcontractorItems: ChangeOrderLineItem[],
  params: PricingParams,
): ChangeOrderPricingBreakdown {
  const p = normalizePricingParams(params);
  const laborTotal = sumCategoryCost(laborItems, 'labor');
  const materialTotal = sumCategoryCost(materialItems, 'material');
  const equipmentTotal = sumCategoryCost(equipmentItems, 'equipment');
  const subcontractorTotal = sumCategoryCost(subcontractorItems, 'subcontractor');
  const directCost =
    laborTotal + materialTotal + equipmentTotal + subcontractorTotal;

  const feesAmount = p.feesAmount;
  const permitsAmount = p.permitsAmount;
  const overheadPercent = p.overheadPercent;
  const profitPercent = p.profitPercent ?? DEFAULT_PROFIT_PERCENT;
  const markupPercent = p.markupPercent ?? 0;

  const overheadAmount = roundMoney(directCost * (overheadPercent / 100));
  const profitAmount = roundMoney(directCost * (profitPercent / 100));
  const markupAmount = roundMoney(materialTotal * (markupPercent / 100));
  const indirectCost =
    feesAmount + permitsAmount + overheadAmount + profitAmount + markupAmount;
  const totalPrice = roundMoney(directCost + indirectCost);

  return {
    pricingModel: 'legacy',
    laborTotal,
    materialTotal,
    equipmentTotal,
    subcontractorTotal,
    materialCostBase: materialTotal,
    wasteFactorPercent: 0,
    wasteCost: 0,
    materialCostAdjusted: materialTotal,
    directCost,
    feesAmount,
    permitsAmount,
    contingencyPercent: 0,
    contingencyCost: 0,
    preTaxCost: directCost,
    taxSystem: 'none',
    taxRatePercent: 0,
    taxApplication: 'materials_only',
    taxCost: 0,
    costBeforeOverhead: directCost,
    overheadPercent,
    overheadAmount,
    costWithOverhead: directCost + overheadAmount,
    totalEstimatedCost: directCost + overheadAmount,
    targetMarginPercent: 0,
    grossProfit: totalPrice - directCost,
    grossMarginPercent:
      totalPrice > 0
        ? roundMoney(((totalPrice - directCost) / totalPrice) * 100)
        : 0,
    markupPercentReporting:
      directCost > 0
        ? roundMoney(((totalPrice - directCost) / directCost) * 100)
        : 0,
    profitPercent,
    profitAmount,
    markupPercent,
    markupAmount,
    indirectCost,
    totalPrice,
  };
}

export function computeStandardPricingBreakdown(
  laborItems: ChangeOrderLineItem[],
  materialItems: ChangeOrderLineItem[],
  equipmentItems: ChangeOrderLineItem[],
  subcontractorItems: ChangeOrderLineItem[],
  params: PricingParams,
): ChangeOrderPricingBreakdown {
  const p = normalizePricingParams(params);

  const laborTotal = sumCategoryCost(laborItems, 'labor');
  const materialCostBase = sumCategoryCost(materialItems, 'material');
  const materialTotal = materialCostBase;
  const equipmentTotal = sumCategoryCost(equipmentItems, 'equipment');
  const subcontractorTotal = sumCategoryCost(subcontractorItems, 'subcontractor');

  const wasteFactorPercent = p.wasteFactorPercent;
  const wasteCost = roundMoney(
    materialCostBase * (wasteFactorPercent / 100),
  );
  const materialCostAdjusted = roundMoney(materialCostBase + wasteCost);

  const feesAmount = p.feesAmount;
  const permitsAmount = p.permitsAmount;
  const directCost = roundMoney(
    materialCostAdjusted +
      laborTotal +
      equipmentTotal +
      subcontractorTotal +
      feesAmount +
      permitsAmount,
  );

  const contingencyPercent = p.contingencyPercent;
  const contingencyCost = roundMoney(
    directCost * (contingencyPercent / 100),
  );
  const preTaxCost = roundMoney(directCost + contingencyCost);

  const taxRatePercent = p.taxRatePercent;
  const taxApplication = p.taxApplication;
  const taxableAmount =
    p.taxSystem === 'none'
      ? 0
      : computeTaxableAmount({
          taxApplication,
          materialCostAdjusted,
          equipmentTotal,
          preTaxCost,
        });
  const taxCost = roundMoney(taxableAmount * (taxRatePercent / 100));
  const costBeforeOverhead = roundMoney(preTaxCost + taxCost);

  const overheadPercent = p.overheadPercent;
  const overheadAmount = roundMoney(
    costBeforeOverhead * (overheadPercent / 100),
  );
  const costWithOverhead = roundMoney(costBeforeOverhead + overheadAmount);
  const totalEstimatedCost = costWithOverhead;

  let targetMarginPercent = p.targetMarginPercent;
  if (targetMarginPercent >= 100) {
    targetMarginPercent = 99;
  }
  const marginDivisor = 1 - targetMarginPercent / 100;
  const totalPrice =
    marginDivisor > 0
      ? roundMoney(costWithOverhead / marginDivisor)
      : costWithOverhead;

  const grossProfit = roundMoney(totalPrice - costWithOverhead);
  const grossMarginPercent =
    totalPrice > 0
      ? roundMoney((grossProfit / totalPrice) * 100)
      : 0;
  const markupPercentReporting =
    costWithOverhead > 0
      ? roundMoney((grossProfit / costWithOverhead) * 100)
      : 0;

  return {
    pricingModel: 'standard',
    laborTotal,
    materialTotal,
    equipmentTotal,
    subcontractorTotal,
    materialCostBase,
    wasteFactorPercent,
    wasteCost,
    materialCostAdjusted,
    directCost,
    feesAmount,
    permitsAmount,
    contingencyPercent,
    contingencyCost,
    preTaxCost,
    taxSystem: p.taxSystem,
    taxRatePercent,
    taxApplication,
    taxCost,
    costBeforeOverhead,
    overheadPercent,
    overheadAmount,
    costWithOverhead,
    totalEstimatedCost,
    targetMarginPercent,
    grossProfit,
    grossMarginPercent,
    markupPercentReporting,
    profitPercent: 0,
    profitAmount: 0,
    markupPercent: 0,
    markupAmount: 0,
    indirectCost: grossProfit,
    totalPrice,
  };
}

export function computePricingBreakdown(
  laborItems: ChangeOrderLineItem[],
  materialItems: ChangeOrderLineItem[],
  equipmentItems: ChangeOrderLineItem[],
  subcontractorItems: ChangeOrderLineItem[],
  params: PricingParams,
): ChangeOrderPricingBreakdown {
  const p = normalizePricingParams(params);
  if (p.pricingModel === 'legacy') {
    return computeLegacyPricingBreakdown(
      laborItems,
      materialItems,
      equipmentItems,
      subcontractorItems,
      p,
    );
  }
  return computeStandardPricingBreakdown(
    laborItems,
    materialItems,
    equipmentItems,
    subcontractorItems,
    p,
  );
}

export function computeChangeOrderBreakdown(
  laborItems: ChangeOrderLineItem[],
  materialItems: ChangeOrderLineItem[],
  equipmentItems: ChangeOrderLineItem[],
  indirect: ChangeOrderIndirectInputs,
  subcontractorItems: ChangeOrderLineItem[] = [],
): ChangeOrderPricingBreakdown {
  const params = paramsFromLegacyIndirect(indirect);
  if (!params.pricingModel) {
    params.pricingModel =
      indirect.pricingModel ??
      (indirect.targetMarginPercent != null ? 'standard' : 'legacy');
  }
  return computePricingBreakdown(
    laborItems,
    materialItems,
    equipmentItems,
    subcontractorItems,
    params,
  );
}

/** @deprecated Use computeChangeOrderBreakdown */
export function computeChangeOrderTotals(
  laborItems: ChangeOrderLineItem[],
  materialItems: ChangeOrderLineItem[],
  equipmentItems: ChangeOrderLineItem[],
  markupPercent: number,
): { subtotal: number; total: number } {
  const b = computeChangeOrderBreakdown(laborItems, materialItems, equipmentItems, {
    feesAmount: 0,
    permitsAmount: 0,
    overheadPercent: DEFAULT_OVERHEAD_PERCENT,
    profitPercent: DEFAULT_PROFIT_PERCENT,
    markupPercent,
    pricingModel: 'legacy',
  });
  return { subtotal: b.directCost, total: b.totalPrice };
}

export function emptyLineItem(category: ChangeOrderLineItemCategory): ChangeOrderLineItem {
  return {
    description: '',
    amount: 0,
    ...(category === 'equipment' ? { hours: undefined } : {}),
  };
}
