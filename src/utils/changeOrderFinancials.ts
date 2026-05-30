import type { ChangeOrderLineItem, ChangeOrderLineItemCategory } from '../types/changeOrder';

export const DEFAULT_OVERHEAD_PERCENT = 8;
export const DEFAULT_PROFIT_PERCENT = 8;

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
  return category === 'equipment'
    ? computeEquipmentLineTotal(row)
    : computeLaborMaterialLineTotal(row);
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

export function sumLineItems(
  items: ChangeOrderLineItem[],
  category: ChangeOrderLineItemCategory,
): number {
  return items.reduce((s, row) => s + computeLineItemTotal(row, category), 0);
}

export interface ChangeOrderIndirectInputs {
  feesAmount: number;
  permitsAmount: number;
  overheadPercent: number;
  profitPercent: number;
  markupPercent: number;
}

export interface ChangeOrderPricingBreakdown {
  laborTotal: number;
  materialTotal: number;
  equipmentTotal: number;
  directCost: number;
  feesAmount: number;
  permitsAmount: number;
  overheadPercent: number;
  profitPercent: number;
  overheadAmount: number;
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

export function computeChangeOrderBreakdown(
  laborItems: ChangeOrderLineItem[],
  materialItems: ChangeOrderLineItem[],
  equipmentItems: ChangeOrderLineItem[],
  indirect: ChangeOrderIndirectInputs,
): ChangeOrderPricingBreakdown {
  const laborTotal = sumLineItems(laborItems, 'labor');
  const materialTotal = sumLineItems(materialItems, 'material');
  const equipmentTotal = sumLineItems(equipmentItems, 'equipment');
  const directCost = laborTotal + materialTotal + equipmentTotal;

  const feesAmount = Math.max(0, indirect.feesAmount);
  const permitsAmount = Math.max(0, indirect.permitsAmount);
  const overheadPercent = Math.max(0, indirect.overheadPercent);
  const profitPercent = Math.max(0, indirect.profitPercent);
  const markupPercent = Math.max(0, indirect.markupPercent);

  const overheadAmount = roundMoney(directCost * (overheadPercent / 100));
  const profitAmount = roundMoney(directCost * (profitPercent / 100));
  const markupAmount = roundMoney(materialTotal * (markupPercent / 100));

  const indirectCost =
    feesAmount + permitsAmount + overheadAmount + profitAmount + markupAmount;
  const totalPrice = directCost + indirectCost;

  return {
    laborTotal,
    materialTotal,
    equipmentTotal,
    directCost,
    feesAmount,
    permitsAmount,
    overheadPercent,
    profitPercent,
    overheadAmount,
    profitAmount,
    markupPercent,
    markupAmount,
    indirectCost,
    totalPrice,
  };
}

/** @deprecated Use computeChangeOrderBreakdown — kept for callers passing markup only. */
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
  });
  return { subtotal: b.directCost, total: b.totalPrice };
}

export function emptyLineItem(category: ChangeOrderLineItemCategory): ChangeOrderLineItem {
  return { description: '', amount: 0, ...(category === 'equipment' ? { hours: undefined } : {}) };
}
