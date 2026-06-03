import { describe, expect, it } from 'vitest';
import {
  computeProposalBreakdown,
  hydrateProposalPricing,
  legacyPricingToLineItems,
} from './proposalPricing';
import type { ProposalData } from '../types/proposal';
import { EMPTY_PROPOSAL_DOCUMENT_FIELDS } from '../types/proposal';

describe('proposalPricing', () => {
  it('computes breakdown with overhead and profit on direct cost', () => {
    const data: ProposalData = {
      businessName: 'Co',
      clientName: 'Client',
      projectTitle: 'Job',
      date: 'Jan 1',
      introduction: '',
      scope: '',
      timeline: [],
      ...EMPTY_PROPOSAL_DOCUMENT_FIELDS,
      laborItems: [{ description: 'Labor', amount: 1000 }],
      materialItems: [{ description: 'Concrete', amount: 5000 }],
      equipmentItems: [],
      pricingIndirect: {
        pricingModel: 'legacy',
        feesAmount: 100,
        permitsAmount: 50,
        overheadPercent: 10,
        profitPercent: 10,
        markupPercent: 5,
        wasteFactorPercent: 0,
        contingencyPercent: 0,
        targetMarginPercent: 0,
        taxSystem: 'none',
        taxRatePercent: 0,
        taxApplication: 'materials_only',
      },
    };
    const b = computeProposalBreakdown(data);
    expect(b.directCost).toBe(6000);
    expect(b.overheadAmount).toBe(600);
    expect(b.profitAmount).toBe(600);
    expect(b.markupAmount).toBe(250);
    expect(b.indirectCost).toBe(100 + 50 + 600 + 600 + 250);
    expect(b.totalPrice).toBe(b.directCost + b.indirectCost);
  });

  it('standard model returns materialTotal on breakdown', () => {
    const data: ProposalData = {
      businessName: 'Co',
      clientName: 'Client',
      projectTitle: 'Job',
      date: 'Jan 1',
      introduction: '',
      scope: '',
      timeline: [],
      ...EMPTY_PROPOSAL_DOCUMENT_FIELDS,
      materialItems: [{ description: 'Concrete', amount: 10000 }],
      laborItems: [],
      equipmentItems: [],
      pricingIndirect: {
        pricingModel: 'standard',
        wasteFactorPercent: 0,
        contingencyPercent: 0,
        overheadPercent: 0,
        targetMarginPercent: 0,
        feesAmount: 0,
        permitsAmount: 0,
        taxSystem: 'none',
        taxRatePercent: 0,
        taxApplication: 'materials_only',
      },
    };
    const b = computeProposalBreakdown(data);
    expect(b.materialTotal).toBe(10000);
    expect(b.pricingModel).toBe('standard');
  });

  it('migrates legacy flat pricing lines', () => {
    const hydrated = hydrateProposalPricing({
      businessName: 'Co',
      clientName: 'Client',
      projectTitle: 'Job',
      date: 'Jan 1',
      introduction: '',
      scope: '',
      timeline: [],
      ...EMPTY_PROPOSAL_DOCUMENT_FIELDS,
      pricing: [
        { description: 'Placement labor', amount: '$1,000.00' },
        { description: 'Concrete 3000 PSI', amount: '$5,000.00' },
      ],
    });
    expect(hydrated.laborItems?.length).toBe(1);
    expect(hydrated.materialItems?.length).toBe(1);
    const legacy = legacyPricingToLineItems([
      { description: 'Profit (Markup)', amount: '$500' },
      { description: 'Rebar', amount: '$200' },
    ]);
    expect(legacy.laborItems).toHaveLength(0);
    expect(legacy.materialItems).toHaveLength(1);
  });
});
