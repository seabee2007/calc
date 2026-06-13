import { describe, expect, it } from 'vitest';
import {
  buildProposalFinancialKpis,
  buildProposalPipelineCounts,
} from './proposalKpis';
import type { TrackedProposalRow } from '../types/proposalTracking';

function mockProposal(
  partial: Partial<TrackedProposalRow> & { status: TrackedProposalRow['status'] },
): TrackedProposalRow {
  return {
    id: '1',
    user_id: 'u',
    title: 'Test',
    template_type: 'classic',
    data: {
      businessName: 'Co',
      clientName: 'Client',
      projectTitle: 'Job',
      date: '2025-01-01',
      introduction: '',
      scope: '',
      timeline: [],
      pricing: [],
      terms: '',
      preparedBy: '',
    },
    created_at: '2025-05-01T00:00:00Z',
    updated_at: '2025-05-01T00:00:00Z',
    sent_at: null,
    viewed_at: null,
    opened_at: null,
    accepted_at: null,
    declined_at: null,
    deposit_paid_at: null,
    scheduled_at: null,
    deposit_amount: 0,
    public_token: 'token',
    total_amount: 10000,
    labor_cost: 3000,
    material_cost: 4000,
    gross_profit: 3000,
    gross_margin_percent: 30,
    ...partial,
  };
}

describe('proposalKpis', () => {
  it('counts pipeline statuses', () => {
    const counts = buildProposalPipelineCounts([
      mockProposal({ status: 'draft', id: 'a' }),
      mockProposal({ status: 'sent', id: 'b' }),
      mockProposal({ status: 'accepted', id: 'c' }),
    ]);
    expect(counts.draft).toBe(1);
    expect(counts.sent).toBe(1);
    expect(counts.accepted).toBe(1);
  });

  it('computes pending revenue and win rate from pricing breakdown', () => {
    const acceptedData = {
      ...mockProposal({ status: 'accepted' }).data,
      laborItems: [{ description: 'Labor', amount: 3000 }],
      materialItems: [{ description: 'Material', amount: 4000 }],
      equipmentItems: [],
      subcontractorItems: [],
      pricingIndirect: {
        pricingModel: 'standard' as const,
        wasteFactorPercent: 0,
        contingencyPercent: 0,
        overheadPercent: 0,
        targetMarginPercent: 20,
        profitPercent: 20,
        feesAmount: 0,
        permitsAmount: 0,
        taxSystem: 'none' as const,
        taxRatePercent: 0,
        taxApplication: 'materials_only' as const,
      },
    };

    const financial = buildProposalFinancialKpis([
      mockProposal({ status: 'sent', total_amount: 5000 }),
      mockProposal({
        status: 'accepted',
        data: acceptedData,
      }),
      mockProposal({ status: 'declined', total_amount: 8000 }),
    ]);

    expect(financial.pendingRevenue).toBe(5000);
    expect(financial.openPipelineRevenue).toBe(5000 + 8750);
    expect(financial.weightedForecast).toBeCloseTo(5000 * 0.25 + 8750, 0);
    expect(financial.acceptedRevenue).toBeCloseTo(8750, 0);
    expect(financial.winRate).toBeCloseTo(1 / 3);
    expect(financial.grossProfit).toBeCloseTo(1750, 0);
    expect(financial.totalEstimatedCost).toBeCloseTo(7000, 0);
  });
});
