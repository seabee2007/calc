import type { ChangeOrderLineItem } from '../types/changeOrder';

export function sumLineItems(items: ChangeOrderLineItem[]): number {
  return items.reduce((s, row) => s + (Number(row.amount) || 0), 0);
}

export function computeChangeOrderTotals(
  laborItems: ChangeOrderLineItem[],
  materialItems: ChangeOrderLineItem[],
  equipmentItems: ChangeOrderLineItem[],
  markupPercent: number,
): { subtotal: number; total: number } {
  const subtotal = sumLineItems(laborItems) + sumLineItems(materialItems) + sumLineItems(equipmentItems);
  const markup = subtotal * (Math.max(0, markupPercent) / 100);
  const total = subtotal + markup;
  return { subtotal, total };
}

export function emptyLineItem(): ChangeOrderLineItem {
  return { description: '', amount: 0 };
}
