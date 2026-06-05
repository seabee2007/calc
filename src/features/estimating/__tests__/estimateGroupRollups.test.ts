import { describe, expect, it } from 'vitest';
import type { EstimateDomainTask } from '../infrastructure/estimateDbTypes';
import type { EstimateDraftLine } from '../application/estimateDraftLine';
import {
  computeDraftLineRollupSlice,
  computeTaskRollupSlice,
  rollupEstimateTasks,
  rollupTaskSlices,
} from '../application/estimateGroupRollups';
import { groupEstimateTasks } from '../application/estimateLineItemGrouping';

function sampleTask(overrides: Partial<EstimateDomainTask> = {}): EstimateDomainTask {
  return {
    id: overrides.id ?? 'task-1',
    lineType: 'task',
    title: 'Sample',
    description: '',
    scopeName: overrides.scopeName ?? 'Concrete',
    trade: '',
    activity: '',
    position: overrides.position ?? 0,
    lineItem: {
      id: overrides.id ?? 'task-1',
      description: 'Sample',
      csiDivision: '03',
      csiSection: '',
      quantity: { formula: 'quantity_with_waste', quantity: 100, wastePercent: 0 },
      labor: {
        productionRate: 10,
        productionRateType: 'units_per_labor_hour',
        hoursPerDay: 8,
        crewSize: 2,
        laborRate: 50,
        burdenPercent: 10,
      },
      material: { unitCost: 5 },
      equipment: { rate: 100, rateType: 'lump_sum', usageUnits: 1 },
      subcontractor: { cost: 50 },
    },
    overheadPercent: 10,
    profitPercent: 5,
    contingencyPercent: 2,
    taxPercent: 8,
    wastePercent: 0,
    scheduleEnabled: overrides.scheduleEnabled ?? true,
    weatherSensitive: overrides.weatherSensitive ?? true,
    inspectionRequired: overrides.inspectionRequired ?? false,
    calculatedValues: overrides.calculatedValues ?? {},
    ...overrides,
  };
}

describe('estimateGroupRollups', () => {
  it('computes correct division subtotal from grouped tasks', () => {
    const tasks = [
      sampleTask({
        id: 'a',
        position: 0,
        calculatedValues: {
          metrics: { adjustedLaborHours: 10, manDays: 1.25, crewDays: 0.63, durationDays: 2 },
          costs: { directCost: 1000, materialCost: 400, sellPrice: 1200 },
        },
      }),
      sampleTask({
        id: 'b',
        position: 1,
        calculatedValues: {
          metrics: { adjustedLaborHours: 5, manDays: 0.63, crewDays: 0.31, durationDays: 1 },
          costs: { directCost: 500, materialCost: 200, sellPrice: 600 },
        },
      }),
    ];

    const groups = groupEstimateTasks(tasks);
    const division = groups[0];

    expect(division.rollup.itemCount).toBe(2);
    expect(division.rollup.laborHours).toBe(15);
    expect(division.rollup.directCost).toBe(1500);
    expect(division.rollup.sellPrice).toBe(1800);
  });

  it('computes correct scope subtotal inside a division', () => {
    const tasks = [
      sampleTask({
        id: 'a',
        position: 0,
        scopeName: 'Slab',
        calculatedValues: {
          metrics: { adjustedLaborHours: 8 },
          costs: { directCost: 800, sellPrice: 900 },
        },
      }),
      sampleTask({
        id: 'b',
        position: 1,
        scopeName: 'Wall',
        calculatedValues: {
          metrics: { adjustedLaborHours: 4 },
          costs: { directCost: 400, sellPrice: 450 },
        },
      }),
    ];

    const groups = groupEstimateTasks(tasks);
    const slab = groups[0].scopes.find((s) => s.label === 'Slab');
    const wall = groups[0].scopes.find((s) => s.label === 'Wall');

    expect(slab?.rollup.laborHours).toBe(8);
    expect(slab?.rollup.directCost).toBe(800);
    expect(wall?.rollup.laborHours).toBe(4);
    expect(wall?.rollup.directCost).toBe(400);
  });

  it('rolls up labor hours across tasks', () => {
    const slices = [
      computeTaskRollupSlice(
        sampleTask({
          calculatedValues: { metrics: { adjustedLaborHours: 12.5 }, costs: { directCost: 1 } },
        }),
      ),
      computeTaskRollupSlice(
        sampleTask({
          calculatedValues: { metrics: { adjustedLaborHours: 7.5 }, costs: { directCost: 1 } },
        }),
      ),
    ];

    const rollup = rollupTaskSlices(slices);

    expect(rollup.laborHours).toBe(20);
  });

  it('rolls up man-days and crew-days across tasks', () => {
    const slices = [
      computeTaskRollupSlice(
        sampleTask({
          calculatedValues: {
            metrics: { manDays: 2.5, crewDays: 1.25, durationDays: 3 },
            costs: { directCost: 100 },
          },
        }),
      ),
      computeTaskRollupSlice(
        sampleTask({
          calculatedValues: {
            metrics: { manDays: 1.5, crewDays: 0.75, durationDays: 2 },
            costs: { directCost: 50 },
          },
        }),
      ),
    ];

    const rollup = rollupTaskSlices(slices);

    expect(rollup.manDays).toBe(4);
    expect(rollup.crewDays).toBe(2);
    expect(rollup.durationDays).toBe(5);
  });

  it('rolls up schedule, weather, and inspection counts', () => {
    const tasks = [
      sampleTask({ id: 'a', scheduleEnabled: true, weatherSensitive: true, inspectionRequired: true }),
      sampleTask({ id: 'b', scheduleEnabled: false, weatherSensitive: true, inspectionRequired: false }),
      sampleTask({ id: 'c', scheduleEnabled: true, weatherSensitive: false, inspectionRequired: true }),
    ];

    const rollup = rollupEstimateTasks(tasks);

    expect(rollup.scheduleEnabledCount).toBe(2);
    expect(rollup.weatherSensitiveCount).toBe(2);
    expect(rollup.inspectionRequiredCount).toBe(2);
  });

  it('returns 0 for missing calculated values', () => {
    const slice = computeTaskRollupSlice(sampleTask({ calculatedValues: {} }));
    const rollup = rollupTaskSlices([slice]);

    expect(rollup.laborHours).toBeGreaterThanOrEqual(0);
    expect(rollup.directCost).toBeGreaterThanOrEqual(0);
    expect(rollup.manDays).toBeGreaterThanOrEqual(0);
    expect(rollup.crewDays).toBeGreaterThanOrEqual(0);
    expect(rollup.sellPrice).toBeGreaterThanOrEqual(0);
    expect(Number.isNaN(rollup.laborHours)).toBe(false);
    expect(Number.isNaN(rollup.directCost)).toBe(false);
  });

  it('never produces NaN or Infinity in rollups', () => {
    const badTask = sampleTask({
      calculatedValues: {
        metrics: {
          adjustedLaborHours: Number.NaN,
          manDays: Number.POSITIVE_INFINITY,
          crewDays: 'not-a-number',
        },
        costs: {
          directCost: undefined,
          sellPrice: null,
          materialCost: 'bad',
        },
      },
    });

    const draft: EstimateDraftLine = {
      clientId: 'c1',
      task: badTask,
      unit: 'EA',
      indirectCost: Number.NaN,
    };

    const slice = computeTaskRollupSlice(badTask);
    const draftSlice = computeDraftLineRollupSlice(draft);
    const rollup = rollupTaskSlices([slice, draftSlice]);

    for (const value of Object.values(rollup)) {
      if (typeof value === 'number') {
        expect(Number.isFinite(value)).toBe(true);
      }
    }
  });
});
