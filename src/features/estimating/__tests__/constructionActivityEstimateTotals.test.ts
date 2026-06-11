import { describe, expect, it } from 'vitest';
import type { ProjectActivityLineItem, ProjectConstructionActivity } from '../domain/constructionActivityTypes';
import { EMPTY_LABOR_PRICING_SNAPSHOT } from '../domain/constructionActivityTypes';
import { calculateEstimateTotalsFromConstructionActivities } from '../application/constructionActivityEstimateTotals';
import { DEFAULT_ESTIMATE_SETTINGS } from '../application/estimateSettings';

function makeActivity(overrides: Partial<ProjectConstructionActivity> = {}): ProjectConstructionActivity {
  return {
    id: 'act-1',
    projectId: 'project-1',
    divisionCode: '03',
    divisionName: 'Concrete',
    activityCode: '03-01-01',
    title: 'Place Slab',
    scheduleEnabled: true,
    crewSize: 4,
    hoursPerDay: 8,
    productionFactor: 1,
    calculatedManHours: 40,
    totalLaborCost: 1000,
    ...overrides,
  };
}

function makeLineItem(overrides: Partial<ProjectActivityLineItem> = {}): ProjectActivityLineItem {
  return {
    id: 'li-1',
    projectActivityId: 'act-1',
    projectId: 'project-1',
    name: 'Work element',
    unit: 'EA',
    quantity: 10,
    manHoursPerUnit: 1,
    productionFactor: 1,
    calculatedManHours: 40,
    laborCost: 1000,
    materialCost: 0,
    equipmentCost: 0,
    ...EMPTY_LABOR_PRICING_SNAPSHOT,
    ...overrides,
  };
}

describe('calculateEstimateTotalsFromConstructionActivities', () => {
  it('sums activity totalLaborCost and totalManHours', () => {
    const totals = calculateEstimateTotalsFromConstructionActivities({
      activities: [
        makeActivity({ id: 'act-1', totalLaborCost: 2500, calculatedManHours: 80 }),
        makeActivity({
          id: 'act-2',
          activityCode: '03-01-02',
          title: 'Footings',
          totalLaborCost: 1830.97,
          calculatedManHours: 59.6,
        }),
      ],
      markupSettings: DEFAULT_ESTIMATE_SETTINGS,
    });

    expect(totals.totalActivities).toBe(2);
    expect(totals.laborCost).toBe(4330.97);
    expect(totals.totalManHours).toBe(139.6);
    expect(totals.materialCost).toBe(0);
    expect(totals.equipmentCost).toBe(0);
    expect(totals.subcontractorCost).toBe(0);
    expect(totals.directCostSubtotal).toBe(4330.97);
    expect(totals.grandTotal).toBe(4330.97);
  });

  it('falls back to line items when activity totals are missing', () => {
    const lineItemsByActivityId = new Map<string, readonly ProjectActivityLineItem[]>([
      ['act-1', [makeLineItem({ laborCost: 500, calculatedManHours: 10 })]],
    ]);

    const totals = calculateEstimateTotalsFromConstructionActivities({
      activities: [makeActivity({ totalLaborCost: undefined, calculatedManHours: undefined })],
      lineItemsByActivityId,
      markupSettings: DEFAULT_ESTIMATE_SETTINGS,
    });

    expect(totals.laborCost).toBe(500);
    expect(totals.totalManHours).toBe(10);
  });

  it('does not block totals when material/equipment/subcontractor are zero', () => {
    const totals = calculateEstimateTotalsFromConstructionActivities({
      activities: [makeActivity()],
      markupSettings: DEFAULT_ESTIMATE_SETTINGS,
    });

    expect(totals.materialCost).toBe(0);
    expect(totals.equipmentCost).toBe(0);
    expect(totals.subcontractorCost).toBe(0);
    expect(totals.grandTotal).toBeGreaterThan(0);
  });

  it('applies overhead, profit, contingency, and tax from markup settings', () => {
    const base = calculateEstimateTotalsFromConstructionActivities({
      activities: [makeActivity({ totalLaborCost: 1000, calculatedManHours: 20 })],
      markupSettings: {
        overheadPercent: 10,
        profitPercent: 5,
        contingencyPercent: 2,
        taxPercent: 8,
      },
    });

    expect(base.overheadAmount).toBe(100);
    expect(base.profitAmount).toBe(55);
    expect(base.contingencyAmount).toBe(23.1);
    expect(base.taxAmount).toBe(94.25);
    expect(base.grandTotal).toBe(1272.35);
  });

  it('recalculates grand total when markup changes', () => {
    const lowOverhead = calculateEstimateTotalsFromConstructionActivities({
      activities: [makeActivity({ totalLaborCost: 1000 })],
      markupSettings: { overheadPercent: 5 },
    });
    const highOverhead = calculateEstimateTotalsFromConstructionActivities({
      activities: [makeActivity({ totalLaborCost: 1000 })],
      markupSettings: { overheadPercent: 15 },
    });

    expect(highOverhead.grandTotal).toBeGreaterThan(lowOverhead.grandTotal);
    expect(highOverhead.overheadAmount).toBe(150);
  });
});
