import { describe, expect, it } from 'vitest';
import type { ProposalData } from '../../types/proposal';
import { EMPTY_PROPOSAL_DOCUMENT_FIELDS } from '../../types/proposal';
import type { TrackedProposalRow } from '../../types/proposalTracking';
import {
  computeProposalFinancials,
  isDirectCostGrossProfitShortcut,
  resolveProposalGrossProfit,
  resolveTrackedProposalFinancials,
} from '../proposalFinancials';
import { computeProposalBreakdown } from '../proposalPricing';
import { buildProposalFinancialKpis } from '../proposalKpis';

/** Canonical sample from Proposal Breakdown source of truth. */
function canonicalProposalData(): ProposalData {
  return {
    businessName: 'Acme',
    clientName: 'Client',
    projectTitle: 'Job',
    date: 'Jan 1',
    introduction: '',
    scope: '',
    timeline: [],
    ...EMPTY_PROPOSAL_DOCUMENT_FIELDS,
    laborItems: [{ description: 'Labor', amount: 4456.28 }],
    materialItems: [{ description: 'Concrete mix', amount: 1688.78 }],
    equipmentItems: [{ description: 'Pump truck', amount: 600 }],
    subcontractorItems: [],
    pricingIndirect: {
      pricingModel: 'standard',
      wasteFactorPercent: 0,
      contingencyPercent: 15,
      overheadPercent: 12,
      targetMarginPercent: 12,
      profitPercent: 12,
      feesAmount: 0,
      permitsAmount: 0,
      taxSystem: 'none',
      taxRatePercent: 0,
      taxApplication: 'materials_only',
    },
  };
}

describe('canonical proposal financials', () => {
  it('matches Proposal Breakdown gross profit and margin', () => {
    const data = canonicalProposalData();
    const breakdown = computeProposalBreakdown(data);
    const financials = computeProposalFinancials(data);

    expect(breakdown.totalPrice).toBeCloseTo(9872.32, 0);
    expect(breakdown.directCost).toBeCloseTo(6745.06, 0);
    expect(breakdown.contingencyCost).toBeCloseTo(1011.76, 0);
    expect(breakdown.overheadAmount).toBeCloseTo(930.82, 0);
    expect(breakdown.totalEstimatedCost).toBeCloseTo(8687.64, 0);
    expect(breakdown.grossProfit).toBeCloseTo(1184.68, 0);
    expect(breakdown.grossMarginPercent).toBeCloseTo(12, 0);

    expect(financials.total_amount).toBeCloseTo(9872.32, 0);
    expect(financials.material_cost).toBeCloseTo(1688.78, 0);
    expect(financials.equipment_cost).toBeCloseTo(600, 0);
    expect(financials.total_estimated_cost).toBeCloseTo(8687.64, 0);
    expect(financials.gross_profit).toBeCloseTo(1184.68, 0);
    expect(financials.gross_margin_percent).toBeCloseTo(12, 0);
    expect(financials.markup_percent).toBeCloseTo(13.64, 0);
    expect(resolveProposalGrossProfit(financials)).toBeCloseTo(1184.68, 0);
  });

  it('dashboard KPIs use total estimated cost, not direct cost', () => {
    const data = canonicalProposalData();
    const proposal = {
      id: 'p1',
      user_id: 'u',
      title: 'Job',
      template_type: 'classic',
      data,
      status: 'accepted',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      sent_at: null,
      viewed_at: null,
      opened_at: null,
      accepted_at: '2026-01-01T00:00:00Z',
      declined_at: null,
      deposit_paid_at: null,
      scheduled_at: null,
      paid_at: null,
      deposit_amount: 0,
      public_token: 'tok',
      total_amount: 9872,
      labor_cost: 4456,
      material_cost: 2289,
      gross_profit: 3127,
      gross_margin_percent: 31.7,
    } as TrackedProposalRow;

    const resolved = resolveTrackedProposalFinancials(proposal);
    expect(resolved.total_amount).toBeCloseTo(9872.32, 0);
    expect(resolved.gross_profit).toBeCloseTo(1184.68, 0);
    expect(resolved.gross_profit).not.toBeCloseTo(3127, 0);

    const kpis = buildProposalFinancialKpis([proposal]);
    expect(kpis.acceptedRevenue).toBeCloseTo(9872.32, 0);
    expect(kpis.weightedForecast).toBeCloseTo(9872.32, 0);
    expect(kpis.grossProfit).toBeCloseTo(1184.68, 0);
    expect(kpis.grossProfit).not.toBeCloseTo(3127, 0);
    expect(kpis.materialCostTotal).toBeCloseTo(1688.78, 0);
    expect(kpis.equipmentCostTotal).toBeCloseTo(600, 0);
  });

  it('rejects stale direct-cost gross profit shortcuts when proposal data is missing', () => {
    expect(
      isDirectCostGrossProfitShortcut(9872.4, 4456.28, 2288.78, 3127.29),
    ).toBe(true);

    const proposal = {
      id: 'p1',
      user_id: 'u',
      title: 'Job',
      template_type: 'classic',
      data: null as unknown as ProposalData,
      status: 'accepted',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      sent_at: null,
      viewed_at: null,
      opened_at: null,
      accepted_at: '2026-01-01T00:00:00Z',
      declined_at: null,
      deposit_paid_at: null,
      scheduled_at: null,
      paid_at: null,
      deposit_amount: 0,
      public_token: 'tok',
      total_amount: 9872.4,
      labor_cost: 4456.28,
      material_cost: 2288.78,
      gross_profit: 3127.29,
      gross_margin_percent: 31.7,
    } as TrackedProposalRow;

    const kpis = buildProposalFinancialKpis([proposal]);
    expect(kpis.grossProfit).toBe(0);
  });
});
