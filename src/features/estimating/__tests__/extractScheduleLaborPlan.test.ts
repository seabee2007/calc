import { describe, expect, it } from 'vitest';
import { buildEstimateSnapshot } from '../application/buildEstimateSnapshot';
import { extractScheduleLaborPlan } from '../application/extractScheduleLaborPlan';
import { sampleEstimateVersion } from '../__fixtures__/sampleEstimateVersion';
import type { EstimateDomainTask } from '../infrastructure/estimateDbTypes';

function buildTask(overrides: Partial<EstimateDomainTask> = {}): EstimateDomainTask {
  const snapshot = buildEstimateSnapshot(sampleEstimateVersion);
  const line = snapshot.lineItems[0];
  const input = sampleEstimateVersion.lineItems[0];

  return {
    id: 'line-1',
    lineType: 'task',
    title: 'Slab pour',
    description: 'Slab pour - sample line',
    scopeName: 'Concrete Scope',
    trade: 'Concrete',
    activity: 'Pour',
    position: 0,
    lineItem: input,
    overheadPercent: 10,
    profitPercent: 5,
    contingencyPercent: 2,
    taxPercent: 8,
    wastePercent: 10,
    scheduleEnabled: true,
    weatherSensitive: false,
    inspectionRequired: false,
    calculatedValues: {
      quantityFormula: line.quantityFormula,
      metrics: line.metrics,
      costs: line.costs,
    },
    ...overrides,
  };
}

function assertFiniteLabor(labor: ReturnType<typeof extractScheduleLaborPlan>['labor']): void {
  for (const value of Object.values(labor)) {
    expect(Number.isFinite(value)).toBe(true);
    expect(value).not.toBe(Number.POSITIVE_INFINITY);
    expect(value).not.toBe(Number.NEGATIVE_INFINITY);
    expect(Number.isNaN(value)).toBe(false);
  }
}

describe('extractScheduleLaborPlan', () => {
  it('extracts labor metrics from calculatedValues', () => {
    const result = extractScheduleLaborPlan(buildTask());

    expect(result.hasLabor).toBe(true);
    expect(result.labor.laborHours).toBeGreaterThan(0);
    expect(result.labor.adjustedLaborHours).toBeGreaterThan(0);
    expect(result.labor.manDays).toBeGreaterThan(0);
    expect(result.labor.crewDays).toBeGreaterThan(0);
    expect(result.labor.durationDays).toBeGreaterThanOrEqual(1);
    assertFiniteLabor(result.labor);
  });

  it('calculates duration from crewDays when durationDays is missing', () => {
    const task = buildTask({
      calculatedValues: {
        metrics: {
          laborHours: 16,
          adjustedLaborHours: 16,
          manDays: 2,
          crewDays: 2,
          durationDays: 0,
        },
        costs: { directCost: 100 },
      },
      lineItem: {
        ...sampleEstimateVersion.lineItems[0],
        labor: {
          ...sampleEstimateVersion.lineItems[0].labor!,
          crewSize: 2,
          hoursPerDay: 8,
          parallelCrews: 1,
        },
      },
    });

    const result = extractScheduleLaborPlan(task);

    expect(result.labor.crewDays).toBeGreaterThan(0);
    expect(result.labor.durationDays).toBeGreaterThanOrEqual(1);
    assertFiniteLabor(result.labor);
  });

  it('calculates crewDays and duration from laborHours, crewSize, and hoursPerDay', () => {
    const task = buildTask({
      calculatedValues: {
        metrics: {
          laborHours: 32,
          adjustedLaborHours: 32,
          manDays: 0,
          crewDays: 0,
          durationDays: 0,
        },
        costs: { directCost: 100 },
      },
      lineItem: {
        ...sampleEstimateVersion.lineItems[0],
        labor: {
          ...sampleEstimateVersion.lineItems[0].labor!,
          crewSize: 4,
          hoursPerDay: 8,
          parallelCrews: 2,
        },
      },
    });

    const result = extractScheduleLaborPlan(task);

    expect(result.labor.crewDays).toBe(1);
    expect(result.labor.durationDays).toBeGreaterThanOrEqual(1);
    assertFiniteLabor(result.labor);
  });

  it('recomputes duration from current crew size instead of stale stored duration', () => {
    const task = buildTask({
      calculatedValues: {
        metrics: {
          laborHours: 80,
          adjustedLaborHours: 80,
          manDays: 10,
          crewDays: 10,
          durationDays: 10,
        },
        costs: { directCost: 100 },
      },
      lineItem: {
        ...sampleEstimateVersion.lineItems[0],
        labor: {
          ...sampleEstimateVersion.lineItems[0].labor!,
          productionRate: 0.25,
          productionRateType: 'labor_hours_per_unit',
          crewSize: 4,
          hoursPerDay: 8,
          parallelCrews: 1,
        },
      },
    });

    const result = extractScheduleLaborPlan(task);

    expect(result.labor.laborHours).toBe(80);
    expect(result.labor.crewDays).toBe(2.5);
    expect(result.labor.durationDays).toBe(3);
    assertFiniteLabor(result.labor);
  });

  it('handles missing crew size safely with default', () => {
    const task = buildTask({
      lineItem: {
        ...sampleEstimateVersion.lineItems[0],
        labor: {
          ...sampleEstimateVersion.lineItems[0].labor!,
          crewSize: undefined,
        },
      },
    });

    const result = extractScheduleLaborPlan(task);

    expect(result.crewSizeProvided).toBe(false);
    expect(result.labor.crewSize).toBe(1);
    assertFiniteLabor(result.labor);
  });

  it('handles missing hours per day safely with default', () => {
    const task = buildTask({
      lineItem: {
        ...sampleEstimateVersion.lineItems[0],
        labor: {
          ...sampleEstimateVersion.lineItems[0].labor!,
          hoursPerDay: undefined,
        },
      },
    });

    const result = extractScheduleLaborPlan(task);

    expect(result.hoursPerDayProvided).toBe(false);
    expect(result.labor.hoursPerDay).toBe(8);
    assertFiniteLabor(result.labor);
  });

  it('handles material-only line safely', () => {
    const task = buildTask({
      calculatedValues: {
        metrics: {
          laborHours: 0,
          adjustedLaborHours: 0,
          manDays: 0,
          crewDays: 0,
          durationDays: 0,
        },
        costs: {
          directCost: 500,
          materialCost: 500,
        },
      },
    });

    const result = extractScheduleLaborPlan(task);

    expect(result.hasLabor).toBe(false);
    expect(result.labor.durationDays).toBe(0);
    assertFiniteLabor(result.labor);
  });

  it('never returns NaN or Infinity', () => {
    const task = buildTask({
      calculatedValues: {
        metrics: {
          laborHours: Number.NaN,
          adjustedLaborHours: Number.POSITIVE_INFINITY,
          manDays: Number.NaN,
          crewDays: Number.POSITIVE_INFINITY,
          durationDays: Number.NaN,
        },
        costs: { directCost: Number.NaN },
      },
      lineItem: {
        ...sampleEstimateVersion.lineItems[0],
        labor: {
          productionRate: 10,
          productionRateType: 'units_per_labor_hour',
          crewSize: Number.NaN as unknown as number,
          hoursPerDay: Number.POSITIVE_INFINITY as unknown as number,
          parallelCrews: 0,
          laborRate: 50,
          burdenPercent: 20,
        },
      },
    });

    const result = extractScheduleLaborPlan(task);
    assertFiniteLabor(result.labor);
  });
});
