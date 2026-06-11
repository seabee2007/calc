import { describe, expect, it } from 'vitest';
import { buildEstimateSnapshot } from '../application/buildEstimateSnapshot';
import { DEFAULT_ESTIMATE_SETTINGS } from '../application/estimateSettings';
import { sampleEstimateVersion } from '../__fixtures__/sampleEstimateVersion';
import type { EstimateDomainTask, EstimateDomainVersion } from '../infrastructure/estimateDbTypes';
import {
  buildEstimateTotalsReview,
  buildEstimateTotalsReviewFromConstructionActivities,
  buildPercentBreakdown,
  calculatePercentOfFinalPrice,
  extractLaborPlanningMetrics,
  extractTotalsFromJson,
  extractVersionTotals,
  hasEstimateTotalsReview,
  resolveEstimateTotalsReview,
  resolveFinalSellPrice,
  rollupLineItemCosts,
  safeEstimateNumber,
  shouldUseConstructionActivitiesTotalsReview,
} from '../ui/estimateTotalsDisplay';

function buildTaskFromSnapshotLine(
  line: ReturnType<typeof buildEstimateSnapshot>['lineItems'][number],
  id: string,
): EstimateDomainTask {
  return {
    id,
    lineType: 'task',
    title: line.description,
    description: line.description,
    scopeName: 'Scope',
    trade: 'Concrete',
    activity: 'Pour',
    position: 0,
    lineItem: sampleEstimateVersion.lineItems[0],
    overheadPercent: 10,
    profitPercent: 5,
    contingencyPercent: 2,
    taxPercent: 8,
    wastePercent: 10,
    scheduleEnabled: true,
    weatherSensitive: false,
    inspectionRequired: false,
    calculatedValues: {
      metrics: line.metrics,
      costs: line.costs,
    },
  };
}

function buildVersionWithSnapshot(): EstimateDomainVersion {
  const snapshot = buildEstimateSnapshot(sampleEstimateVersion);

  return {
    id: 'ver-1',
    estimateId: 'est-1',
    projectId: 'proj-1',
    versionNumber: 1,
    versionName: 'Initial',
    estimateType: 'detailed',
    status: 'draft',
    snapshot,
    totals: snapshot.totals,
    notes: null,
    createdBy: null,
    createdAt: '2026-06-04T00:00:00.000Z',
    lineItems: snapshot.lineItems.map((line, index) =>
      buildTaskFromSnapshotLine(line, `line-${index}`),
    ),
    warnings: [],
  };
}

describe('safeEstimateNumber', () => {
  it('returns finite numbers and safe zero for invalid values', () => {
    expect(safeEstimateNumber(12.5)).toBe(12.5);
    expect(safeEstimateNumber('8')).toBe(8);
    expect(safeEstimateNumber(null)).toBe(0);
    expect(safeEstimateNumber(undefined)).toBe(0);
    expect(safeEstimateNumber(Number.NaN)).toBe(0);
    expect(safeEstimateNumber(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('extractTotalsFromJson', () => {
  it('safely extracts totals fields', () => {
    expect(
      extractTotalsFromJson({
        directCost: 1000,
        indirectCost: 100,
        overhead: 50,
        profit: 75,
        contingency: 25,
        tax: 30,
        finalSellPrice: 1280,
      }),
    ).toEqual({
      directCost: 1000,
      indirectCost: 100,
      overhead: 50,
      profit: 75,
      contingency: 25,
      tax: 30,
      finalSellPrice: 1280,
    });
  });

  it('returns zero totals when totals are missing', () => {
    expect(extractTotalsFromJson(null)).toEqual({
      directCost: 0,
      indirectCost: 0,
      overhead: 0,
      profit: 0,
      contingency: 0,
      tax: 0,
      finalSellPrice: 0,
    });
    expect(extractTotalsFromJson({})).toEqual({
      directCost: 0,
      indirectCost: 0,
      overhead: 0,
      profit: 0,
      contingency: 0,
      tax: 0,
      finalSellPrice: 0,
    });
  });
});

describe('resolveFinalSellPrice', () => {
  it('prefers finalSellPrice when present', () => {
    expect(
      resolveFinalSellPrice({
        directCost: 500,
        indirectCost: 0,
        overhead: 0,
        profit: 0,
        contingency: 0,
        tax: 0,
        finalSellPrice: 900,
      }),
    ).toBe(900);
  });

  it('falls back to directCost when finalSellPrice is zero', () => {
    expect(
      resolveFinalSellPrice({
        directCost: 500,
        indirectCost: 0,
        overhead: 0,
        profit: 0,
        contingency: 0,
        tax: 0,
        finalSellPrice: 0,
      }),
    ).toBe(500);
  });
});

describe('calculatePercentOfFinalPrice', () => {
  it('calculates percentage shares without NaN or Infinity', () => {
    expect(calculatePercentOfFinalPrice(250, 1000)).toBe(25);
    expect(calculatePercentOfFinalPrice(0, 1000)).toBe(0);
    expect(calculatePercentOfFinalPrice(100, 0)).toBeNull();
    expect(calculatePercentOfFinalPrice(Number.NaN, 1000)).toBeNull();
    expect(calculatePercentOfFinalPrice(100, Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('buildPercentBreakdown', () => {
  it('builds percent shares from rollups and totals', () => {
    const breakdown = buildPercentBreakdown(
      { labor: 400, materials: 200, equipment: 100, subcontractors: 50 },
      {
        directCost: 750,
        indirectCost: 0,
        overhead: 0,
        profit: 150,
        contingency: 0,
        tax: 0,
        finalSellPrice: 1000,
      },
      1000,
    );

    expect(breakdown).toEqual({
      laborPercent: 40,
      materialsPercent: 20,
      equipmentPercent: 10,
      subcontractorPercent: 5,
      profitPercent: 15,
    });
  });
});

describe('extractLaborPlanningMetrics', () => {
  it('extracts labor metrics safely from line items', () => {
    const version = buildVersionWithSnapshot();
    const metrics = extractLaborPlanningMetrics(version);

    expect(metrics.laborHours).toBeGreaterThan(0);
    expect(metrics.manDays).toBeGreaterThan(0);
    expect(metrics.crewDays).toBeGreaterThan(0);
    expect(Number.isFinite(metrics.laborHours)).toBe(true);
    expect(Number.isFinite(metrics.manDays)).toBe(true);
    expect(Number.isFinite(metrics.crewDays)).toBe(true);
  });

  it('returns null duration when no duration metrics exist', () => {
    const version = buildVersionWithSnapshot();
    version.lineItems = version.lineItems.map((task) => ({
      ...task,
      calculatedValues: {
        ...task.calculatedValues,
        metrics: {
          ...(task.calculatedValues.metrics as Record<string, unknown>),
          durationDays: undefined,
        },
      },
    }));

    expect(extractLaborPlanningMetrics(version).durationDays).toBeNull();
  });
});

describe('rollupLineItemCosts', () => {
  it('rolls up line item cost groups from the current version', () => {
    const version = buildVersionWithSnapshot();
    const rollups = rollupLineItemCosts(version);

    expect(rollups.labor).toBeGreaterThan(0);
    expect(rollups.materials).toBeGreaterThan(0);
    expect(rollups.equipment).toBeGreaterThan(0);
    expect(rollups.subcontractors).toBeGreaterThan(0);
    expect(Number.isNaN(rollups.labor)).toBe(false);
  });
});

describe('buildEstimateTotalsReview', () => {
  it('builds a complete review from the current version', () => {
    const version = buildVersionWithSnapshot();
    const review = buildEstimateTotalsReview(version);

    expect(review.hasTotals).toBe(true);
    expect(review.costGroups.finalSellPrice).toBeGreaterThan(0);
    expect(extractVersionTotals(version).finalSellPrice).toBeGreaterThan(0);
    expect(review.percentBreakdown.laborPercent).not.toBeNull();
    expect(Number.isFinite(review.percentBreakdown.laborPercent ?? 0)).toBe(true);
  });

  it('reports no totals for an empty version', () => {
    const review = buildEstimateTotalsReview(null);
    expect(review.hasTotals).toBe(false);
    expect(hasEstimateTotalsReview(null)).toBe(false);
  });
});

describe('resolveEstimateTotalsReview', () => {
  it('prefers construction activities for detailed estimates', () => {
    const review = resolveEstimateTotalsReview({
      version: null,
      estimateType: 'detailed',
      constructionActivities: [
        {
          id: 'act-1',
          projectId: 'project-1',
          divisionCode: '03',
          divisionName: 'Concrete',
          activityCode: '03-01-01',
          title: 'Slab',
          scheduleEnabled: true,
          crewSize: 4,
          hoursPerDay: 8,
          productionFactor: 1,
          totalLaborCost: 1500,
          calculatedManHours: 30,
        },
      ],
      markupSettings: DEFAULT_ESTIMATE_SETTINGS,
    });

    expect(review.hasTotals).toBe(true);
    expect(review.costGroups.labor).toBe(1500);
    expect(review.laborMetrics.laborHours).toBe(30);
    expect(shouldUseConstructionActivitiesTotalsReview('detailed', [{ id: 'act-1' } as never])).toBe(
      true,
    );
  });

  it('builds construction activity review with direct subtotal equal to labor when no other costs exist', () => {
    const review = buildEstimateTotalsReviewFromConstructionActivities(
      [
        {
          id: 'act-1',
          projectId: 'project-1',
          divisionCode: '03',
          divisionName: 'Concrete',
          activityCode: '03-01-01',
          title: 'Slab',
          scheduleEnabled: true,
          crewSize: 4,
          hoursPerDay: 8,
          productionFactor: 1,
          totalLaborCost: 4330.97,
          calculatedManHours: 139.6,
        },
      ],
      DEFAULT_ESTIMATE_SETTINGS,
    );

    expect(review.costGroups.labor).toBe(4330.97);
    expect(review.costGroups.directCost).toBe(4330.97);
  });
});
