import type { EstimateSnapshotInput } from '../domain/estimateTypes';

export const sampleEstimateVersion: EstimateSnapshotInput = {
  meta: {
    estimateId: 'est-sample-001',
    projectId: 'project-sample-001',
    version: 1,
    estimateType: 'detailed',
    status: 'draft',
    currencyCode: 'USD',
    preparedAtIso: '2026-06-04T00:00:00.000Z',
  },
  pricing: {
    indirectCost: 1000,
    overheadPercent: 10,
    profitPercent: 5,
    contingencyPercent: 2,
    taxPercent: 8,
  },
  lineItems: [
    {
      id: 'slab_pour',
      description: 'Slab pour - sample line',
      csiDivision: '03',
      csiSection: '03 30 00',
      quantity: {
        formula: 'area',
        dimensions: {
          length: 10,
          width: 10,
        },
        wastePercent: 10,
      },
      labor: {
        productionRate: 10,
        productionRateType: 'units_per_labor_hour',
        hoursPerDay: 8,
        crewSize: 2,
        parallelCrews: 1,
        difficultyFactor: 1,
        locationFactor: 1,
        laborRate: 50,
        burdenPercent: 20,
      },
      material: {
        unitCost: 5,
      },
      equipment: {
        rate: 100,
        rateType: 'day',
        usageUnits: 2,
      },
      subcontractor: {
        cost: 300,
      },
    },
    {
      id: 'wall_formwork',
      description: 'Wall formwork - sample line',
      csiDivision: '03',
      csiSection: '03 30 00',
      quantity: {
        formula: 'wall_area',
        dimensions: {
          length: 10,
          height: 8,
        },
        wastePercent: 0,
      },
      labor: {
        productionRate: 0.5,
        productionRateType: 'labor_hours_per_unit',
        hoursPerDay: 8,
        crewSize: 4,
        parallelCrews: 1,
        difficultyFactor: 1,
        locationFactor: 1,
        laborRate: 40,
        burdenPercent: 10,
      },
      material: {
        unitCost: 2,
      },
      equipment: {
        rate: 50,
        rateType: 'hour',
        usageUnits: 10,
      },
    },
    {
      id: 'grout_fill',
      description: 'Grout fill - sample line',
      csiDivision: '04',
      csiSection: '04 20 00',
      quantity: {
        formula: 'concrete_cubic_yards',
        quantity: 54,
        wastePercent: 5,
      },
      labor: {
        productionRate: 1,
        productionRateType: 'units_per_labor_day',
        hoursPerDay: 8,
        crewSize: 3,
        parallelCrews: 1,
        difficultyFactor: 1.1,
        locationFactor: 1,
        laborRate: 60,
        burdenPercent: 15,
      },
      material: {
        unitCost: 100,
      },
      equipment: {
        rate: 250,
        rateType: 'lump_sum',
      },
      subcontractor: {
        cost: 400,
      },
    },
  ],
};

export const sampleExpectedLineDirectCosts = {
  slab_pour: 1710,
  wall_formwork: 2420,
  grout_fill: 2135.12,
};

export const sampleExpectedDivisionTotals = {
  '03': 4130,
  '04': 2135.12,
};

export const sampleExpectedScopeTotals = {
  '03 30 00': 4130,
  '04 20 00': 2135.12,
};

export const sampleExpectedSnapshotTotals = {
  directCost: 6265.12,
  indirectCost: 1000,
  overhead: 626.51,
  profit: 394.58,
  contingency: 165.72,
  tax: 676.15,
  finalSellPrice: 9128.08,
};
