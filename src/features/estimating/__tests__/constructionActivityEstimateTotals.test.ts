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

  it('includes project material and equipment resources in direct cost and grand total', () => {
    const totals = calculateEstimateTotalsFromConstructionActivities({
      activities: [makeActivity({ totalLaborCost: 1000, calculatedManHours: 20 })],
      markupSettings: DEFAULT_ESTIMATE_SETTINGS,
      projectMaterialResources: [
        {
          id: 'mat-1',
          activityId: 'act-1',
          projectId: 'project-1',
          name: 'Concrete',
          quantity: 2,
          unit: 'CY',
          unitCost: 100,
          totalCost: 200,
          sourceProvider: 'manual',
        },
      ],
      projectEquipmentResources: [
        {
          id: 'equip-1',
          activityId: 'act-1',
          projectId: 'project-1',
          name: 'Excavator',
          quantity: 1,
          unit: 'day',
          unitCost: 300,
          totalCost: 300,
          sourceProvider: 'manual',
        },
      ],
    });

    expect(totals.laborCost).toBe(1000);
    expect(totals.materialCost).toBe(200);
    expect(totals.equipmentCost).toBe(300);
    expect(totals.directCostSubtotal).toBe(1500);
    expect(totals.grandTotal).toBe(1500);
  });

  it('labor-only estimate is unchanged when project resource arrays are omitted', () => {
    const baseline = calculateEstimateTotalsFromConstructionActivities({
      activities: [makeActivity({ totalLaborCost: 4330.97, calculatedManHours: 40 })],
      markupSettings: DEFAULT_ESTIMATE_SETTINGS,
    });
    const withEmptyResources = calculateEstimateTotalsFromConstructionActivities({
      activities: [makeActivity({ totalLaborCost: 4330.97, calculatedManHours: 40 })],
      markupSettings: DEFAULT_ESTIMATE_SETTINGS,
      projectMaterialResources: undefined,
      projectEquipmentResources: undefined,
    });

    expect(withEmptyResources.laborCost).toBe(baseline.laborCost);
    expect(withEmptyResources.materialCost).toBe(0);
    expect(withEmptyResources.equipmentCost).toBe(0);
    expect(withEmptyResources.directCostSubtotal).toBe(baseline.directCostSubtotal);
    expect(withEmptyResources.grandTotal).toBe(baseline.grandTotal);
  });

  it('applies markup to direct cost that includes materials and equipment', () => {
    const totals = calculateEstimateTotalsFromConstructionActivities({
      activities: [makeActivity({ totalLaborCost: 1000 })],
      markupSettings: { overheadPercent: 10, profitPercent: 0, contingencyPercent: 0, taxPercent: 0 },
      projectMaterialResources: [
        {
          id: 'mat-1',
          activityId: 'act-1',
          projectId: 'project-1',
          name: 'Drywall',
          quantity: 1,
          unit: 'SF',
          unitCost: 500,
          totalCost: 500,
          sourceProvider: 'manual',
        },
      ],
      projectEquipmentResources: [],
    });

    expect(totals.directCostSubtotal).toBe(1500);
    expect(totals.overheadAmount).toBe(150);
    expect(totals.grandTotal).toBe(1650);
  });
});
