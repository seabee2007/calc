import { describe, expect, it } from 'vitest';
import type { ChangeOrder } from '../types/changeOrder';
import {
  buildChangeOrderFinancialKpis,
  buildChangeOrderPipelineRevenue,
  mergeChangeOrderIntoProposalFinancial,
} from './changeOrderKpis';
import { buildProposalFinancialKpis } from './proposalKpis';

function mockCo(partial: Partial<ChangeOrder> & { status: ChangeOrder['status'] }): ChangeOrder {
  return {
    id: 'co-1',
    projectId: 'p1',
    userId: 'u1',
    linkedFarId: null,
    linkedRfiId: null,
    linkedTaskId: null,
    displayNumber: 'CO-001',
    title: 'Test CO',
    scopeDescription: '',
    reasonForChange: '',
    terms: '',
    laborItems: [{ description: 'Labor', amount: 1000 }],
    materialItems: [{ description: 'Mat', amount: 500 }],
    equipmentItems: [],
    markupPercent: 0,
    feesAmount: 0,
    permitsAmount: 0,
    overheadPercent: 8,
    profitPercent: 8,
    overheadAmount: 0,
    profitAmount: 0,
    subtotal: 1500,
    total: 2000,
    scheduleImpact: null,
    publicToken: 'tok',
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
    createdAt: '',
    updatedAt: '',
    ...partial,
  };
}

describe('changeOrderKpis', () => {
  it('rolls revenue up by pipeline status', () => {
    const revenue = buildChangeOrderPipelineRevenue([
      mockCo({ status: 'sent', total: 3000 }),
      mockCo({ status: 'viewed', total: 4000 }),
      mockCo({ status: 'accepted', total: 5000 }),
    ]);
    expect(revenue.sent).toBe(3000);
    expect(revenue.viewed).toBe(4000);
    expect(revenue.accepted).toBe(5000);
  });

  it('merges into proposal financial snapshot', () => {
    const proposal = buildProposalFinancialKpis([]);
    const co = buildChangeOrderFinancialKpis([
      mockCo({ status: 'sent', total: 1000 }),
      mockCo({ status: 'accepted', total: 2000, acceptedAt: new Date().toISOString() }),
    ]);
    const merged = mergeChangeOrderIntoProposalFinancial(proposal, co);
    expect(merged.pendingRevenue).toBe(1000);
    expect(merged.changeOrderPendingRevenue).toBe(1000);
    expect(merged.changeOrderAcceptedRevenue).toBe(2000);
    expect(merged.acceptedRevenue).toBe(2000);
    expect(merged.laborCostTotal).toBe(1000);
    expect(merged.materialCostTotal).toBe(500);
  });
});
