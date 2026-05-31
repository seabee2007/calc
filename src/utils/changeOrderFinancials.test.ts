import { describe, expect, it } from 'vitest';
import {
  computeChangeOrderBreakdown,
  computeLaborMaterialLineTotal,
  computeLineItemTotal,
  computePricingBreakdown,
  computeStandardPricingBreakdown,
  normalizeLineItems,
} from './changeOrderFinancials';
import { computeProposalBreakdown } from './proposalPricing';
import { defaultPricingParams } from './pricingParams';
import type { ChangeOrderLineItem } from '../types/changeOrder';
import type { ProposalData } from '../types/proposal';
import { calculateGeneralTradeLabor } from './generalTradeLabor';
import { DEFAULT_GENERAL_TRADE_LABOR_INPUT } from '../types/generalTradeLabor';

function standardParams(overrides: Partial<ReturnType<typeof defaultPricingParams>> = {}) {
  return {
    ...defaultPricingParams(),
    pricingModel: 'standard' as const,
    wasteFactorPercent: 0,
    contingencyPercent: 0,
    overheadPercent: 0,
    targetMarginPercent: 0,
    taxSystem: 'none' as const,
    taxRatePercent: 0,
    ...overrides,
  };
}

describe('computeLaborMaterialLineTotal', () => {
  it('uses qty × unit price when both are positive', () => {
    const row: ChangeOrderLineItem = {
      description: 'Crew',
      qty: 40,
      unitPrice: 85.5,
      amount: 0,
    };
    expect(computeLaborMaterialLineTotal(row)).toBe(3420);
  });

  it('falls back to amount when qty or unit price is missing', () => {
    expect(
      computeLaborMaterialLineTotal({
        description: 'Placement labor',
        amount: 12500,
      }),
    ).toBe(12500);
  });
});

describe('computeStandardPricingBreakdown — waste', () => {
  it('0% waste leaves material adjusted equal to base', () => {
    const b = computeStandardPricingBreakdown(
      [],
      [{ description: 'Concrete', amount: 10000 }],
      [],
      [],
      standardParams({ wasteFactorPercent: 0 }),
    );
    expect(b.materialCostBase).toBe(10000);
    expect(b.materialTotal).toBe(10000);
    expect(b.wasteCost).toBe(0);
    expect(b.materialCostAdjusted).toBe(10000);
  });

  it('10% waste on materials', () => {
    const b = computeStandardPricingBreakdown(
      [],
      [{ description: 'Concrete', amount: 10000 }],
      [],
      [],
      standardParams({ wasteFactorPercent: 10 }),
    );
    expect(b.wasteCost).toBe(1000);
    expect(b.materialCostAdjusted).toBe(11000);
    expect(b.materialTotal).toBe(10000);
  });

  it('20% waste on materials', () => {
    const b = computeStandardPricingBreakdown(
      [],
      [{ description: 'Concrete', amount: 5000 }],
      [],
      [],
      standardParams({ wasteFactorPercent: 20 }),
    );
    expect(b.wasteCost).toBe(1000);
    expect(b.materialCostAdjusted).toBe(6000);
  });
});

describe('computeStandardPricingBreakdown — tax', () => {
  it('no tax when tax system is none', () => {
    const b = computeStandardPricingBreakdown(
      [],
      [{ description: 'Mat', amount: 10000 }],
      [],
      [],
      standardParams({ taxSystem: 'none', taxRatePercent: 10 }),
    );
    expect(b.taxCost).toBe(0);
  });

  it('tax on materials only at 10%', () => {
    const b = computeStandardPricingBreakdown(
      [],
      [{ description: 'Mat', amount: 10000 }],
      [{ description: 'Pump', amount: 2000 }],
      [],
      standardParams({
        taxSystem: 'sales_tax',
        taxRatePercent: 10,
        taxApplication: 'materials_only',
      }),
    );
    expect(b.taxCost).toBe(1000);
    expect(b.materialCostAdjusted).toBe(10000);
  });
});

describe('computeStandardPricingBreakdown — margin & waterfall', () => {
  it('true margin: $20k cost at 20% → $25k price', () => {
    const b = computeStandardPricingBreakdown(
      [{ description: 'Labor', amount: 20000 }],
      [],
      [],
      [],
      standardParams({ targetMarginPercent: 20 }),
    );
    expect(b.costWithOverhead).toBe(20000);
    expect(b.totalPrice).toBe(25000);
    expect(b.grossProfit).toBe(5000);
    expect(b.grossMarginPercent).toBe(20);
  });

  it('direct cost includes fees, permits, subs, and adjusted material', () => {
    const b = computeStandardPricingBreakdown(
      [{ description: 'Labor', amount: 1000 }],
      [{ description: 'Mat', amount: 10000 }],
      [{ description: 'Equip', amount: 500 }],
      [{ description: 'Sub', amount: 2000 }],
      standardParams({
        wasteFactorPercent: 10,
        feesAmount: 100,
        permitsAmount: 50,
      }),
    );
    expect(b.directCost).toBe(11000 + 1000 + 500 + 2000 + 100 + 50);
    expect(b.contingencyCost).toBe(0);
    expect(b.preTaxCost).toBe(b.directCost);
  });
});

describe('computePricingBreakdown — change orders', () => {
  it('legacy model uses markup on materials', () => {
    const b = computePricingBreakdown(
      [{ description: 'L', amount: 1000 }],
      [{ description: 'M', amount: 5000 }],
      [],
      [],
      {
        ...defaultPricingParams(),
        pricingModel: 'legacy',
        markupPercent: 5,
        profitPercent: 10,
        overheadPercent: 10,
      },
    );
    expect(b.pricingModel).toBe('legacy');
    expect(b.markupAmount).toBe(250);
    expect(b.materialTotal).toBe(5000);
  });

  it('standard model exposes materialTotal (base materials)', () => {
    const b = computePricingBreakdown(
      [],
      [{ description: 'M', amount: 8000 }],
      [],
      [],
      standardParams(),
    );
    expect(b.pricingModel).toBe('standard');
    expect(b.materialTotal).toBe(8000);
    expect(b.materialCostBase).toBe(8000);
  });
});

describe('computeChangeOrderBreakdown (legacy dispatcher)', () => {
  it('routes to standard when target margin is set', () => {
    const b = computeChangeOrderBreakdown(
      [],
      [{ description: 'M', amount: 10000 }],
      [],
      {
        feesAmount: 0,
        permitsAmount: 0,
        overheadPercent: 0,
        profitPercent: 0,
        markupPercent: 0,
        wasteFactorPercent: 0,
        targetMarginPercent: 20,
      },
    );
    expect(b.pricingModel).toBe('standard');
    expect(b.totalPrice).toBe(12500);
  });
});

describe('proposal pricing integration', () => {
  it('computeProposalBreakdown does not throw and returns materialTotal', () => {
    const data: ProposalData = {
      businessName: 'Co',
      clientName: 'Client',
      projectTitle: 'Job',
      date: 'Jan 1',
      introduction: '',
      scope: '',
      timeline: [],
      laborItems: [{ description: 'Labor', amount: 1000 }],
      materialItems: [{ description: 'Concrete', amount: 5000 }],
      equipmentItems: [],
      pricingIndirect: {
        pricingModel: 'standard',
        wasteFactorPercent: 10,
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
    expect(b.materialTotal).toBe(5000);
    expect(b.materialCostAdjusted).toBe(5500);
    expect(b.directCost).toBe(6500);
  });
});

describe('normalizeLineItems (labor)', () => {
  it('recomputes amount from qty and unit price', () => {
    const [row] = normalizeLineItems(
      [{ description: 'Finishing', qty: 8, unitPrice: 62.5, amount: 0 }],
      'labor',
    );
    expect(row.amount).toBe(500);
    expect(computeLineItemTotal(row, 'labor')).toBe(500);
  });
});

describe('general trade labor → proposal line', () => {
  it('qty × unit price matches stored total labor price', () => {
    const input = {
      ...DEFAULT_GENERAL_TRADE_LABOR_INPUT,
      quantity: 1200,
      productionRate: 1200,
      productionRateType: 'unitsPerLaborDay' as const,
      crewSize: 2,
      hoursPerDay: 8,
      laborRate: 65,
      burdenPercent: 25,
      overheadPercent: 10,
      profitPercent: 15,
    };
    const result = calculateGeneralTradeLabor(input);
    const line: ChangeOrderLineItem = {
      description: 'Sitework — Fine grading',
      qty: input.quantity,
      unitPrice: result.costPerUnit,
      amount: result.totalLaborPrice,
    };
    expect(computeLaborMaterialLineTotal(line)).toBeCloseTo(
      result.totalLaborPrice,
      2,
    );
  });
});
