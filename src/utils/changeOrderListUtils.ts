import type { ChangeOrder } from '../types/changeOrder';

/** Hide untouched manual drafts that were never saved with meaningful content. */
export function isBlankPlaceholderChangeOrder(co: ChangeOrder): boolean {
  if (co.status !== 'draft' || co.sentAt) return false;
  if (co.linkedFarId || co.linkedRfiId) return false;

  const items = [
    ...co.laborItems,
    ...co.materialItems,
    ...co.equipmentItems,
    ...(co.subcontractorItems ?? []),
  ];
  if (items.length > 0 || co.total !== 0) return false;
  if (co.scopeDescription.trim() || co.reasonForChange.trim()) return false;

  const title = co.title.trim();
  return title === '' || title === 'Change order';
}

export function filterVisibleChangeOrders(orders: ChangeOrder[]): ChangeOrder[] {
  return orders.filter((co) => !isBlankPlaceholderChangeOrder(co));
}
