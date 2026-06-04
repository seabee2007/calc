import { describe, expect, it } from 'vitest';
import type { EstimateLineItemInput, EstimateSnapshotInput } from '../domain/estimateTypes';
import {
  validateEstimateLineItemInput,
  validateEstimateSnapshotInput,
} from '../domain/estimateValidation';
import { sampleEstimateVersion } from '../__fixtures__/sampleEstimateVersion';

const validLineItem: EstimateLineItemInput = {
  id: 'line-valid-001',
  description: 'Valid sample line',
  csiDivision: '03',
  csiSection: '03 30 00',
  quantity: {
    formula: 'quantity_with_waste',
    quantity: 100,
    wastePercent: 5,
  },
  labor: {
    productionRate: 10,
    productionRateType: 'units_per_labor_hour',
    laborRate: 55,
    burdenPercent: 20,
    crewSize: 2,
    hoursPerDay: 8,
  },
  material: {
    unitCost: 4,
  },
  equipment: {
    rate: 120,
    rateType: 'day',
    usageUnits: 1,
  },
  subcontractor: {
    cost: 250,
  },
};

function getWarningCodes(lineItem: EstimateLineItemInput): string[] {
  return validateEstimateLineItemInput(lineItem).map((warning) => warning.code);
}

describe('estimateValidation line-level warnings', () => {
  it('returns no warnings for a fully valid line item', () => {
    expect(validateEstimateLineItemInput(validLineItem)).toEqual([]);
  });

  it('creates a warning when production rate is missing', () => {
    const warningCodes = getWarningCodes({
      ...validLineItem,
      labor: {
        ...validLineItem.labor!,
        productionRate: undefined,
      },
    });

    expect(warningCodes).toContain('missing_production_rate');
  });

  it('creates a warning when crew size is missing for units_per_crew_day', () => {
    const warningCodes = getWarningCodes({
      ...validLineItem,
      labor: {
        ...validLineItem.labor!,
        productionRateType: 'units_per_crew_day',
        productionRate: 25,
        crewSize: undefined,
        hoursPerDay: 8,
      },
    });

    expect(warningCodes).toContain('missing_crew_size');
  });

  it('creates a warning when hours per day is missing for day-based rates', () => {
    const warningCodes = getWarningCodes({
      ...validLineItem,
      labor: {
        ...validLineItem.labor!,
        productionRateType: 'units_per_labor_day',
        productionRate: 20,
        hoursPerDay: undefined,
      },
    });

    expect(warningCodes).toContain('missing_hours_per_day');
  });
});

describe('estimateValidation snapshot-level warnings', () => {
  it('flags percent clamping and negative cost normalization warnings', () => {
    const input: EstimateSnapshotInput = {
      ...sampleEstimateVersion,
      pricing: {
        indirectCost: -100,
        overheadPercent: 120,
        profitPercent: -10,
        contingencyPercent: 250,
        taxPercent: Number.POSITIVE_INFINITY,
      },
      lineItems: [
        {
          ...validLineItem,
          quantity: {
            ...validLineItem.quantity,
            wastePercent: 150,
          },
          labor: {
            ...validLineItem.labor!,
            burdenPercent: -5,
            laborRate: -10,
          },
          material: {
            unitCost: -2,
          },
          equipment: {
            rate: -10,
            rateType: 'hour',
            usageUnits: 1,
          },
          subcontractor: {
            cost: Number.NaN,
          },
        },
      ],
    };

    const warningCodes = validateEstimateSnapshotInput(input).map((warning) => warning.code);

    expect(warningCodes).toContain('invalid_percent_clamped');
    expect(warningCodes).toContain('negative_cost_clamped');
    expect(warningCodes).toContain('non_finite_number_normalized');
    expect(warningCodes).toContain('missing_subcontractor_cost');
  });
});
