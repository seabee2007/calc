import { describe, expect, it } from 'vitest';
import type { ProposalData } from '../types/proposal';
import { EMPTY_PROPOSAL_DOCUMENT_FIELDS } from '../types/proposal';
import {
  computeProposalFinancials,
  resolveProposalTotalAmount,
  resolveTrackedProposalFinancials,
} from './proposalFinancials';
import { computeProposalBreakdown } from './proposalPricing';
import type { TrackedProposalRow } from '../types/proposalTracking';

describe('proposalFinancials', () => {
  it('uses live line-item pricing instead of stale imported estimate summary totals', () => {
    const data: ProposalData = {
      businessName: 'Acme',
      clientName: 'Client',
      projectTitle: 'Job',
      date: 'Jan 1',
      introduction: '',
      scope: '',
      timeline: [],
      ...EMPTY_PROPOSAL_DOCUMENT_FIELDS,
      laborItems: [{ description: 'Labor', amount: 5000 }],
      materialItems: [{ description: 'Concrete', amount: 1200 }],
      equipmentItems: [],
      subcontractorItems: [],
      importedEstimateSummary: {
        laborTotal: 5000,
        materialTotal: 1200,
        equipmentTotal: 0,
        subcontractorTotal: 0,
        indirectCostTotal: 1551.36,
        directCost: 6200,
        overheadTotal: 620,
        profitTotal: 1550,
        contingencyTotal: 0,
        taxTotal: 0,
        finalSellPrice: 13370.27,
      },
      pricingIndirect: {
        pricingModel: 'standard',
        wasteFactorPercent: 0,
        contingencyPercent: 0,
        overheadPercent: 10,
        targetMarginPercent: 15,
        feesAmount: 0,
        permitsAmount: 0,
        taxSystem: 'none',
        taxRatePercent: 0,
        taxApplication: 'materials_only',
      },
    };

    expect(computeProposalBreakdown(data).totalPrice).not.toBe(13370.27);
    expect(computeProposalFinancials(data).total_amount).toBe(
      computeProposalBreakdown(data).totalPrice,
    );
  });

  it('resolves dashboard totals from proposal data when stored total_amount is stale', () => {
    const data: ProposalData = {
      businessName: 'Acme',
      clientName: 'Client',
      projectTitle: 'Job',
      date: 'Jan 1',
      introduction: '',
      scope: '',
      timeline: [],
      ...EMPTY_PROPOSAL_DOCUMENT_FIELDS,
      laborItems: [{ description: 'Labor', amount: 5000 }],
      materialItems: [{ description: 'Concrete', amount: 1200 }],
      equipmentItems: [],
      subcontractorItems: [],
      pricingIndirect: {
        pricingModel: 'standard',
        wasteFactorPercent: 0,
        contingencyPercent: 0,
        overheadPercent: 10,
        targetMarginPercent: 15,
        feesAmount: 0,
        permitsAmount: 0,
        taxSystem: 'none',
        taxRatePercent: 0,
        taxApplication: 'materials_only',
      },
    };

    const proposal = {
      total_amount: 13370,
      data,
    } as Pick<TrackedProposalRow, 'total_amount' | 'data'>;

    expect(resolveProposalTotalAmount(proposal)).toBe(computeProposalFinancials(data).total_amount);
    expect(resolveProposalTotalAmount(proposal)).not.toBe(13370);
    expect(resolveTrackedProposalFinancials(proposal as TrackedProposalRow).gross_profit).toBe(
      computeProposalFinancials(data).gross_profit,
    );
    expect(resolveTrackedProposalFinancials(proposal as TrackedProposalRow).material_cost).toBe(
      computeProposalFinancials(data).material_cost,
    );
    expect(resolveTrackedProposalFinancials(proposal as TrackedProposalRow).equipment_cost).toBe(
      computeProposalFinancials(data).equipment_cost,
    );
  });
});
