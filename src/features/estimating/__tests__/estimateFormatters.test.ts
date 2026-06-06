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
  quickFeasibilityPlannedDurationDaysFromVersion,
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

  it('returns zero summary values when current version has no activities', () => {
    const version: EstimateDomainVersion = {
      id: 'ver-empty',
      estimateId: 'est-1',
      projectId: 'proj-1',
      versionNumber: 2,
      versionName: 'Reset Draft',
      estimateType: 'detailed',
      status: 'draft',
      snapshot: {},
      totals: {
        directCost: 999,
        indirectCost: 0,
        overhead: 100,
        profit: 50,
        contingency: 0,
        tax: 0,
        finalSellPrice: 1149,
      },
      notes: null,
      createdBy: null,
      createdAt: '2026-06-04T00:00:00.000Z',
      lineItems: [],
      warnings: [],
    };

    const summary = buildWorkspaceSummaryValues(version);
    expect(summary.totalEstimate).toBe('$0.00');
    expect(summary.laborHours).toBe('0.0 hr');
    expect(summary.manDays).toBe('0');
    expect(summary.crewDays).toBe('0');
    expect(summary.materialCost).toBe(ESTIMATE_BLANK);
    expect(summary.equipmentCost).toBe(ESTIMATE_BLANK);
    expect(summary.profit).toBe('$0.00');
  });

  it('uses saved quick feasibility breakdown even though quick versions have no activities', () => {
    const version: EstimateDomainVersion = {
      id: 'ver-quick',
      estimateId: 'est-1',
      projectId: 'proj-1',
      versionNumber: 3,
      versionName: 'Quick Feasibility v3',
      estimateType: 'quick_feasibility',
      status: 'draft',
      snapshot: {
        meta: {
          estimateId: 'est-1',
          projectId: 'proj-1',
          version: 3,
          estimateType: 'quick_feasibility',
          status: 'draft',
          currencyCode: 'USD',
          preparedAtIso: '2026-06-04T00:00:00.000Z',
        },
        quickFeasibility: {
          likelyTotal: 125000,
        },
        totals: {
          totalEstimate: 125000,
          materialCost: 52941.18,
          laborCost: 41176.47,
          equipmentCost: 5882.35,
          overhead: 12500,
          profit: 12500,
        },
        labor: {
          laborHours: 633.48,
          manDays: 79.19,
          crewDays: 9.9,
          estimatedCrewSize: 8,
          hoursPerDay: 8,
          fullyBurdenedLaborRate: 65,
        },
        schedule: {
          plannedDurationDays: 10,
        },
      },
      totals: {
        directCost: 110000,
        indirectCost: 0,
        overhead: 0,
        profit: 0,
        contingency: 15000,
        tax: 0,
        finalSellPrice: 125000,
      },
      notes: null,
      createdBy: null,
      createdAt: '2026-06-04T00:00:00.000Z',
      lineItems: [],
      warnings: [],
    };

    const summary = buildWorkspaceSummaryValues(version);
    expect(summary.totalEstimate).toBe('$125,000.00');
    expect(summary.laborHours).toBe('633.5 hr');
    expect(summary.manDays).toBe('79.19');
    expect(summary.crewDays).toBe('9.90');
    expect(summary.materialCost).toBe('$52,941.18');
    expect(summary.equipmentCost).toBe('$5,882.35');
    expect(summary.profit).toBe('$12,500.00');
    expect(quickFeasibilityPlannedDurationDaysFromVersion(version)).toBe(10);
  });

  it('clears quick feasibility summary values after reset', () => {
    const version: EstimateDomainVersion = {
      id: 'ver-reset-quick',
      estimateId: 'est-1',
      projectId: 'proj-1',
      versionNumber: 4,
      versionName: 'Reset Quick',
      estimateType: 'quick_feasibility',
      status: 'draft',
      snapshot: {
        meta: { reset: true },
      },
      totals: {
        directCost: 0,
        indirectCost: 0,
        overhead: 0,
        profit: 0,
        contingency: 0,
        tax: 0,
        finalSellPrice: 0,
      },
      notes: null,
      createdBy: null,
      createdAt: '2026-06-04T00:00:00.000Z',
      lineItems: [],
      warnings: [],
    };

    const summary = buildWorkspaceSummaryValues(version);
    expect(summary.totalEstimate).toBe('$0.00');
    expect(summary.laborHours).toBe('0.0 hr');
    expect(summary.manDays).toBe('0');
    expect(summary.crewDays).toBe('0');
    expect(summary.materialCost).toBe(ESTIMATE_BLANK);
    expect(summary.equipmentCost).toBe(ESTIMATE_BLANK);
    expect(summary.profit).toBe('$0.00');
  });

  it('exposes empty draft JSON payloads', () => {
    expect(EMPTY_ESTIMATE_SNAPSHOT_JSON).toEqual({});
    expect(EMPTY_ESTIMATE_TOTALS_JSON).toEqual({});
  });
});
