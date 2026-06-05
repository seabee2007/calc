import { describe, expect, it } from 'vitest';
import type { EstimateDomainVersion } from '../infrastructure/estimateDbTypes';
import {
  EMPTY_ESTIMATE_SNAPSHOT_JSON,
  EMPTY_ESTIMATE_TOTALS_JSON,
  ESTIMATE_BLANK,
  buildWorkspaceSummaryValues,
  formatEstimateBlank,
  formatEstimateCurrency,
  formatEstimateHours,
  formatEstimateNumber,
  formatEstimatePercent,
  laborHoursFromTask,
  lineDirectCostFromTask,
} from '../ui/estimateFormatters';
import type { EstimateDomainTask } from '../infrastructure/estimateDbTypes';

const baseTask = (overrides: Partial<EstimateDomainTask> = {}): EstimateDomainTask => ({
  id: 'task-1',
  lineType: 'task',
  title: 'Slab pour',
  position: 0,
  lineItem: {
    id: 'task-1',
    description: 'Slab pour',
    csiDivision: '03',
    quantity: { quantity: 100 },
  },
  overheadPercent: 0,
  profitPercent: 0,
  contingencyPercent: 0,
  taxPercent: 0,
  wastePercent: 0,
  scheduleEnabled: true,
  weatherSensitive: false,
  inspectionRequired: false,
  calculatedValues: {
    metrics: {
      adjustedLaborHours: 12.5,
      manDays: 1.5,
      crewDays: 0.75,
    },
    costs: {
      materialCost: 500,
      equipmentCost: 200,
      directCost: 1200,
    },
  },
  ...overrides,
});

describe('estimateFormatters', () => {
  it('formats blank dash fallback', () => {
    expect(formatEstimateBlank(null)).toBe(ESTIMATE_BLANK);
    expect(formatEstimateBlank('')).toBe(ESTIMATE_BLANK);
    expect(formatEstimateBlank('Concrete')).toBe('Concrete');
  });

  it('formats currency and hours safely', () => {
    expect(formatEstimateCurrency(1234.5)).toBe('$1,234.50');
    expect(formatEstimateCurrency(null)).toBe(ESTIMATE_BLANK);
    expect(formatEstimateHours(8)).toBe('8.0 hr');
    expect(formatEstimateHours(undefined)).toBe(ESTIMATE_BLANK);
  });

  it('formats numbers and percents', () => {
    expect(formatEstimateNumber(3.456, { decimals: 2 })).toBe('3.46');
    expect(formatEstimateNumber('bad')).toBe(ESTIMATE_BLANK);
    expect(formatEstimatePercent(12.34)).toBe('12.3%');
  });

  it('extracts labor hours and line totals from calculated values', () => {
    const task = baseTask();
    expect(laborHoursFromTask(task)).toBe(12.5);
    expect(lineDirectCostFromTask(task)).toBe(1200);
    expect(laborHoursFromTask(baseTask({ calculatedValues: {} }))).toBeNull();
  });

  it('builds workspace summary values from version totals and line items', () => {
    const version: EstimateDomainVersion = {
      id: 'ver-1',
      estimateId: 'est-1',
      projectId: 'proj-1',
      versionNumber: 1,
      versionName: 'Initial',
      estimateType: 'detailed',
      status: 'draft',
      snapshot: {},
      totals: {
        directCost: 5000,
        indirectCost: 0,
        overhead: 0,
        profit: 250,
        contingency: 0,
        tax: 0,
        finalSellPrice: 5250,
      },
      notes: null,
      createdBy: null,
      createdAt: '2026-06-04T00:00:00.000Z',
      lineItems: [baseTask()],
      warnings: [],
    };

    const summary = buildWorkspaceSummaryValues(version);
    expect(summary.totalEstimate).toBe('$5,250.00');
    expect(summary.laborHours).toBe('12.5 hr');
    expect(summary.manDays).toBe('1.50');
    expect(summary.crewDays).toBe('0.75');
    expect(summary.materialCost).toBe('$500.00');
    expect(summary.equipmentCost).toBe('$200.00');
    expect(summary.profit).toBe('$250.00');
  });

  it('returns blank summary when version is null', () => {
    const summary = buildWorkspaceSummaryValues(null);
    expect(summary.totalEstimate).toBe(ESTIMATE_BLANK);
    expect(summary.profit).toBe(ESTIMATE_BLANK);
  });

  it('exposes empty draft JSON payloads', () => {
    expect(EMPTY_ESTIMATE_SNAPSHOT_JSON).toEqual({});
    expect(EMPTY_ESTIMATE_TOTALS_JSON).toEqual({});
  });
});
