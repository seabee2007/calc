import { describe, expect, it } from 'vitest';
import {
  computeActivityReadiness,
  computeEstimateReadiness,
} from './estimateActivityReadiness';
import type {
  ActivityEquipmentResource,
  ActivityMaterialResource,
  ProjectActivityLineItem,
  ProjectConstructionActivity,
} from '../domain/constructionActivityTypes';

function makeActivity(overrides: Partial<ProjectConstructionActivity> = {}): ProjectConstructionActivity {
  return {
    id: 'act-1',
    projectId: 'proj-1',
    divisionCode: '03',
    divisionName: 'Concrete',
    activityCode: '03-01-01',
    title: 'Slab on Grade',
    name: 'Slab on Grade',
    scheduleEnabled: true,
    crewSize: 4,
    hoursPerDay: 8,
    productionFactor: 1,
    calculatedManHours: 10,
    totalLaborCost: 500,
    ...overrides,
  } as ProjectConstructionActivity;
}

function makeLineItem(overrides: Partial<ProjectActivityLineItem> = {}): ProjectActivityLineItem {
  return {
    id: 'li-1',
    projectId: 'proj-1',
    projectActivityId: 'act-1',
    name: 'Place concrete',
    quantity: 100,
    unit: 'SF',
    sourceProductionRateKey: '03-31-05.70-0320',
    manHoursPerUnit: 0.1,
    calculatedManHours: 10,
    laborCost: 500,
    materialCost: 0,
    equipmentCost: 0,
    totalCost: 500,
    fullyBurdenedRateSnapshot: 50,
    pricingSource: 'manual',
    ...overrides,
  } as ProjectActivityLineItem;
}

describe('computeActivityReadiness', () => {
  it('scores all five dimensions at 100% when fully ready', () => {
    const readiness = computeActivityReadiness(
      makeActivity(),
      [makeLineItem()],
      [{ id: 'mat-1' } as ActivityMaterialResource],
      [],
    );

    expect(readiness.score).toBe(100);
    expect(readiness.isConfirmed).toBe(true);
    expect(readiness.hasQuantity).toBe(true);
    expect(readiness.hasLaborPriced).toBe(true);
    expect(readiness.hasMaterialOrEquipment).toBe(true);
    expect(readiness.hasNoWarnings).toBe(true);
  });

  it('scores 40% for confirmed activity with quantity but no pricing or resources', () => {
    const readiness = computeActivityReadiness(
      makeActivity({ calculatedManHours: 0, totalLaborCost: 0 }),
      [makeLineItem({ quantity: 50, laborCost: 0, calculatedManHours: 0 })],
      [],
      [],
    );

    expect(readiness.score).toBe(40);
    expect(readiness.hasQuantity).toBe(true);
    expect(readiness.hasLaborPriced).toBe(false);
    expect(readiness.hasMaterialOrEquipment).toBe(false);
    expect(readiness.hasNoWarnings).toBe(false);
  });
});

describe('computeEstimateReadiness', () => {
  it('rolls up division and overall scores', () => {
    const activities = [
      makeActivity({ id: 'act-1', divisionCode: '03', divisionName: 'Concrete' }),
      makeActivity({
        id: 'act-2',
        divisionCode: '06',
        divisionName: 'Wood Framing',
        calculatedManHours: 0,
        totalLaborCost: 0,
      }),
    ];

    const lineItemsMap = new Map<string, ProjectActivityLineItem[]>([
      ['act-1', [makeLineItem({ projectActivityId: 'act-1' })]],
      ['act-2', [makeLineItem({
        id: 'li-2',
        projectActivityId: 'act-2',
        quantity: 0,
        laborCost: 0,
        calculatedManHours: 0,
        manHoursPerUnit: 0,
        pricingSource: 'manual',
      })]],
    ]);

    const summary = computeEstimateReadiness(
      activities,
      lineItemsMap,
      new Map<string, ActivityMaterialResource[]>(),
      new Map<string, ActivityEquipmentResource[]>(),
    );

    expect(summary.totalActivities).toBe(2);
    expect(summary.divisions).toHaveLength(2);
    expect(summary.needsQuantity).toBe(1);
    expect(summary.needsPricing).toBe(1);
    expect(summary.overallScore).toBeGreaterThan(0);
    expect(summary.overallScore).toBeLessThan(100);
  });

  it('returns zero summary for empty activities', () => {
    const summary = computeEstimateReadiness(
      [],
      new Map(),
      new Map(),
      new Map(),
    );

    expect(summary.overallScore).toBe(0);
    expect(summary.totalActivities).toBe(0);
  });
});
