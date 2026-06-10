import { describe, expect, it } from 'vitest';
import type { ProjectActivityLineItem, ProjectConstructionActivity } from '../domain/constructionActivityTypes';
import { EMPTY_LABOR_PRICING_SNAPSHOT } from '../domain/constructionActivityTypes';
import {
  computeConstructionActivityRollupSlice,
  rollupConstructionActivities,
  rollupConstructionActivityLineItems,
} from '../application/laborCostRollup';
import { getProjectActivityLineItemLaborRateWarning } from '../domain/constructionActivityCalculations';

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
    calculatedManHours: 10,
    laborCost: 500,
    materialCost: 100,
    equipmentCost: 50,
    totalCost: 650,
    sourceProductionRateKey: '03-test',
    ...EMPTY_LABOR_PRICING_SNAPSHOT,
    fullyBurdenedRateSnapshot: 50,
    pricingSource: 'project_rate',
    ...overrides,
  };
}

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
    calculatedDurationDays: 2,
    effectiveDurationDays: 2,
    totalLaborCost: 500,
    totalCost: 650,
    ...overrides,
  };
}

describe('laborCostRollup', () => {
  it('rollupConstructionActivityLineItems sums laborCost separately from directCost', () => {
    const rollup = rollupConstructionActivityLineItems([
      makeLineItem({ laborCost: 500, materialCost: 100, equipmentCost: 50 }),
      makeLineItem({ id: 'li-2', laborCost: 250, materialCost: 0, equipmentCost: 0, calculatedManHours: 5 }),
    ]);

    expect(rollup.laborCost).toBe(750);
    expect(rollup.directCost).toBe(900);
    expect(rollup.laborHours).toBe(15);
  });

  it('rollupConstructionActivities aggregates activity and line item labor costs', () => {
    const rollup = rollupConstructionActivities([
      {
        activity: makeActivity({ totalLaborCost: 500 }),
        lineItems: [makeLineItem()],
      },
      {
        activity: makeActivity({
          id: 'act-2',
          title: 'Footings',
          totalLaborCost: 200,
        }),
        lineItems: [
          makeLineItem({
            id: 'li-3',
            projectActivityId: 'act-2',
            laborCost: 200,
            calculatedManHours: 4,
            materialCost: 0,
            equipmentCost: 0,
            totalCost: 200,
          }),
        ],
      },
    ]);

    expect(rollup.itemCount).toBe(2);
    expect(rollup.laborCost).toBe(700);
    expect(rollup.directCost).toBe(850);
  });

  it('computeConstructionActivityRollupSlice exposes labor cost per activity', () => {
    const slice = computeConstructionActivityRollupSlice(makeActivity(), [makeLineItem()]);
    expect(slice.laborCost).toBe(500);
    expect(slice.directCost).toBe(650);
    expect(slice.scheduleEnabled).toBe(true);
  });

  it('missing labor rate warning when man-hours exist but labor cost is zero', () => {
    const warning = getProjectActivityLineItemLaborRateWarning(
      makeLineItem({ laborCost: 0, calculatedManHours: 12 }),
    );
    expect(warning).toContain('Missing labor rate');
  });
});
