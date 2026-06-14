import { describe, expect, it } from 'vitest';
import type { ChangeOrder } from '../types/changeOrder';
import {
  filterVisibleChangeOrders,
  isBlankPlaceholderChangeOrder,
} from '../changeOrderListUtils';

function makeChangeOrder(overrides: Partial<ChangeOrder> = {}): ChangeOrder {
  return {
    id: 'co-1',
    projectId: 'proj-1',
    userId: 'user-1',
    linkedFarId: null,
    linkedRfiId: null,
    linkedTaskId: null,
    title: 'Change order',
    scopeDescription: '',
    reasonForChange: '',
    terms: '',
    scheduleImpact: null,
    laborItems: [],
    materialItems: [],
    equipmentItems: [],
    subcontractorItems: [],
    markupPercent: 0,
    overheadPercent: 0,
    profitPercent: 0,
    subtotal: 0,
    total: 0,
    status: 'draft',
    publicToken: 'token',
    displayNumber: null,
    sentAt: null,
    viewedAt: null,
    openedAt: null,
    acceptedAt: null,
    declinedAt: null,
    contractorName: null,
    contractorSignature: null,
    contractorSignedAt: null,
    clientName: null,
    clientSignature: null,
    clientSignedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('changeOrderListUtils', () => {
  it('detects untouched manual blank drafts', () => {
    expect(isBlankPlaceholderChangeOrder(makeChangeOrder())).toBe(true);
  });

  it('keeps drafts with line items visible', () => {
    expect(
      isBlankPlaceholderChangeOrder(
        makeChangeOrder({
          laborItems: [{ description: 'Labor', amount: 100 }],
          total: 100,
        }),
      ),
    ).toBe(false);
  });

  it('keeps FAR-linked drafts visible even when empty', () => {
    expect(
      isBlankPlaceholderChangeOrder(
        makeChangeOrder({
          linkedFarId: 'far-1',
          title: 'CO — Field issue',
        }),
      ),
    ).toBe(false);
  });

  it('filters blank placeholder rows from list display', () => {
    const visible = filterVisibleChangeOrders([
      makeChangeOrder({ id: 'blank' }),
      makeChangeOrder({ id: 'real', title: 'Add patio', total: 500 }),
    ]);
    expect(visible.map((co) => co.id)).toEqual(['real']);
  });
});
