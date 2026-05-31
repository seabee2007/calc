import { describe, expect, it } from 'vitest';
import {
  computeLaborMaterialLineTotal,
  computeLineItemTotal,
  normalizeLineItems,
} from './changeOrderFinancials';
import type { ChangeOrderLineItem } from '../types/changeOrder';
import { calculateGeneralTradeLabor } from './generalTradeLabor';
import { DEFAULT_GENERAL_TRADE_LABOR_INPUT } from '../types/generalTradeLabor';

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
    expect(
      computeLaborMaterialLineTotal({
        description: 'Partial',
        qty: 10,
        amount: 12500,
      }),
    ).toBe(12500);
    expect(
      computeLaborMaterialLineTotal({
        description: 'Partial',
        unitPrice: 50,
        amount: 12500,
      }),
    ).toBe(12500);
  });

  it('prefers qty × unit price over a stale amount', () => {
    const row: ChangeOrderLineItem = {
      description: 'Labor',
      qty: 10,
      unitPrice: 100,
      amount: 9999,
    };
    expect(computeLaborMaterialLineTotal(row)).toBe(1000);
  });

  it('rounds money to two decimals', () => {
    expect(
      computeLaborMaterialLineTotal({
        description: 'Labor',
        qty: 7,
        unitPrice: 14.285,
        amount: 0,
      }),
    ).toBe(100);
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
