import { describe, expect, it } from 'vitest';
import {
  calculateGeneralTradeLabor,
  validateGeneralTradeLaborInput,
} from './generalTradeLabor';
import type { GeneralTradeLaborInput } from '../types/generalTradeLabor';
import { DEFAULT_GENERAL_TRADE_LABOR_INPUT } from '../types/generalTradeLabor';

const baseInput: GeneralTradeLaborInput = {
  ...DEFAULT_GENERAL_TRADE_LABOR_INPUT,
  trade: 'Sitework',
  activity: 'Fine grading',
  quantity: 1200,
  unit: 'SF',
  productionRate: 1200,
  productionRateType: 'unitsPerLaborDay',
  crewSize: 2,
  hoursPerDay: 8,
  laborRate: 65,
  burdenPercent: 25,
  overheadPercent: 10,
  profitPercent: 15,
  difficultyFactor: 1,
  locationFactor: 1,
};

describe('validateGeneralTradeLaborInput', () => {
  it('returns no errors for valid input', () => {
    expect(validateGeneralTradeLaborInput(baseInput)).toEqual([]);
  });

  it('flags invalid quantity and factors', () => {
    const errors = validateGeneralTradeLaborInput({
      ...baseInput,
      quantity: 0,
      difficultyFactor: 0,
      locationFactor: 0,
    });
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe('calculateGeneralTradeLabor', () => {
  it('computes hours from units per labor day', () => {
    const result = calculateGeneralTradeLabor(baseInput);
    expect(result.baseLaborHours).toBeCloseTo(8, 2);
    expect(result.adjustedLaborHours).toBeCloseTo(8, 2);
    expect(result.crewDays).toBeCloseTo(0.5, 2);
  });

  it('computes hours from units per labor hour', () => {
    const result = calculateGeneralTradeLabor({
      ...baseInput,
      quantity: 10,
      productionRate: 2,
      productionRateType: 'unitsPerLaborHour',
    });
    expect(result.baseLaborHours).toBeCloseTo(5, 2);
  });

  it('computes hours from labor hours per unit', () => {
    const result = calculateGeneralTradeLabor({
      ...baseInput,
      quantity: 10,
      productionRate: 1.5,
      productionRateType: 'laborHoursPerUnit',
    });
    expect(result.baseLaborHours).toBeCloseTo(15, 2);
  });

  it('applies difficulty and location factors', () => {
    const result = calculateGeneralTradeLabor({
      ...baseInput,
      difficultyFactor: 1.15,
      locationFactor: 1.2,
    });
    expect(result.adjustedLaborHours).toBeCloseTo(
      result.baseLaborHours * 1.15 * 1.2,
      4,
    );
  });

  it('stacks burden, overhead, and profit', () => {
    const result = calculateGeneralTradeLabor(baseInput);
    expect(result.burdenCost).toBeCloseTo(result.baseLaborCost * 0.25, 2);
    expect(result.subtotalLaborCost).toBeCloseTo(
      result.baseLaborCost + result.burdenCost,
      2,
    );
    expect(result.overhead).toBeCloseTo(result.subtotalLaborCost * 0.1, 2);
    expect(result.profit).toBeCloseTo(
      (result.subtotalLaborCost + result.overhead) * 0.15,
      2,
    );
    expect(result.totalLaborPrice).toBeCloseTo(
      result.subtotalLaborCost + result.overhead + result.profit,
      2,
    );
  });

  it('computes per-unit metrics', () => {
    const result = calculateGeneralTradeLabor(baseInput);
    expect(result.costPerUnit).toBeCloseTo(
      result.totalLaborPrice / baseInput.quantity,
      4,
    );
    expect(result.laborHoursPerUnit).toBeCloseTo(
      result.adjustedLaborHours / baseInput.quantity,
      4,
    );
  });
});
