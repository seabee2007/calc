import { describe, expect, it } from 'vitest';
import {
  SEABEE_DIVISION_03_CONCRETE_SEED,
  SEABEE_DIVISION_03_PRODUCTION_RATE_MAP,
} from '../data/seabeeConcreteSeeds';
import {
  calculateActivityDurationDays,
  calculateActivityManHours,
  calculateLineItemManHours,
  calculateManDays,
  isScheduleActivityLineItem,
  isSchedulableConstructionActivity,
  manHoursPerUnitFromLineItemTemplate,
  resolveProductionFactor,
  rollupConstructionActivity,
  validateCrewSizeForDuration,
} from '../domain/seabeeActivityCalculations';
import type {
  ProjectActivityLineItem,
  ProjectConstructionActivity,
} from '../domain/seabeeActivityTypes';

function makeLineItem(
  overrides: Partial<ProjectActivityLineItem> & Pick<ProjectActivityLineItem, 'id' | 'name'>,
): ProjectActivityLineItem {
  return {
    constructionActivityId: 'ca-1',
    unit: 'EA',
    quantity: 0,
    manHoursPerUnit: 0,
    productionFactor: 1,
    ...overrides,
  };
}

function makeActivity(
  overrides: Partial<ProjectConstructionActivity> = {},
): ProjectConstructionActivity {
  return {
    id: 'ca-1',
    projectId: 'project-1',
    divisionCode: '03',
    divisionName: 'Concrete',
    code: '03-01-01',
    name: 'Place Slab on Grade',
    scheduleEnabled: true,
    crewSize: 4,
    hoursPerDay: 8,
    productionFactor: 1,
    ...overrides,
  };
}

describe('seabeeActivityCalculations', () => {
  it('calculateLineItemManHours uses quantity × manHoursPerUnit × productionFactor', () => {
    expect(calculateLineItemManHours(100, 0.25, 1)).toBe(25);
    expect(calculateLineItemManHours(50, 0.12)).toBe(6);
  });

  it('defaults production factor to 1 when omitted', () => {
    expect(resolveProductionFactor(undefined)).toBe(1);
    expect(resolveProductionFactor(0)).toBe(1);
    expect(calculateLineItemManHours(10, 2)).toBe(20);
  });

  it('production factor greater than 1 increases labor', () => {
    const baseline = calculateLineItemManHours(100, 0.1, 1);
    const increased = calculateLineItemManHours(100, 0.1, 1.25);
    expect(increased).toBeGreaterThan(baseline);
    expect(increased).toBe(12.5);
  });

  it('production factor less than 1 decreases labor', () => {
    const baseline = calculateLineItemManHours(100, 0.1, 1);
    const decreased = calculateLineItemManHours(100, 0.1, 0.75);
    expect(decreased).toBeLessThan(baseline);
    expect(decreased).toBe(7.5);
  });

  it('calculateActivityManHours rolls up line items into parent activity', () => {
    const lineItems: ProjectActivityLineItem[] = [
      makeLineItem({ id: 'li-1', name: 'Form edge', unit: 'LF', quantity: 200, manHoursPerUnit: 0.12 }),
      makeLineItem({ id: 'li-2', name: 'Place concrete', unit: 'CY', quantity: 32, manHoursPerUnit: 0.286 }),
    ];

    expect(calculateActivityManHours(lineItems)).toBeCloseTo(24 + 9.152, 3);
  });

  it('calculateManDays divides man-hours by 8', () => {
    expect(calculateManDays(80)).toBe(10);
    expect(calculateManDays(80, 8)).toBe(10);
    expect(calculateManDays(0)).toBe(0);
  });

  it('calculateActivityDurationDays uses manHours / crewSize / hoursPerDay rounded up', () => {
    expect(calculateActivityDurationDays(80, 4, 8)).toBe(3);
    expect(calculateActivityDurationDays(80, 2, 8)).toBe(5);
    expect(calculateActivityDurationDays(32, 4, 8)).toBe(1);
  });

  it('handles invalid crew size safely for duration calculation', () => {
    expect(validateCrewSizeForDuration(0)).toBe(false);
    expect(validateCrewSizeForDuration(-2)).toBe(false);
    expect(calculateActivityDurationDays(80, 0, 8)).toBe(0);

    const rollup = rollupConstructionActivity(makeActivity({ crewSize: 0 }), [
      makeLineItem({ id: 'li-1', name: 'Test', quantity: 10, manHoursPerUnit: 1 }),
    ]);
    expect(rollup.calculatedDurationDays).toBe(0);
    expect(rollup.warnings.some((w) => w.includes('Crew size'))).toBe(true);
  });

  it('rollupConstructionActivity aggregates labor, costs, and duration', () => {
    const activity = makeActivity({ crewSize: 4 });
    const lineItems: ProjectActivityLineItem[] = [
      makeLineItem({
        id: 'li-1',
        name: 'Place concrete',
        unit: 'CY',
        quantity: 32,
        manHoursPerUnit: 0.286,
        laborCost: 500,
        materialCost: 8000,
      }),
      makeLineItem({
        id: 'li-2',
        name: 'Finish concrete',
        unit: 'SF',
        quantity: 3200,
        manHoursPerUnit: 0.016,
        laborCost: 300,
        equipmentCost: 150,
      }),
    ];

    const rollup = rollupConstructionActivity(activity, lineItems);

    expect(rollup.totalManHours).toBeCloseTo(9.152 + 51.2, 2);
    expect(rollup.totalManDays).toBeCloseTo(rollup.totalManHours / 8, 5);
    expect(rollup.totalLaborCost).toBe(800);
    expect(rollup.totalMaterialCost).toBe(8000);
    expect(rollup.totalEquipmentCost).toBe(150);
    expect(rollup.totalDirectCost).toBe(8950);
    expect(rollup.lineItemCount).toBe(2);
    expect(rollup.durationDays).toBeGreaterThanOrEqual(1);
  });

  it('construction activity can be schedule-enabled while line items are not schedule activities', () => {
    const activity = makeActivity({ scheduleEnabled: true });
    const lineItem = makeLineItem({ id: 'li-1', name: 'Form edge', quantity: 1, manHoursPerUnit: 1 });

    expect(isSchedulableConstructionActivity(activity)).toBe(true);
    expect(isScheduleActivityLineItem(lineItem)).toBe(false);

    const disabled = makeActivity({ scheduleEnabled: false });
    expect(isSchedulableConstructionActivity(disabled)).toBe(false);
  });

  it('Division 03 seed includes Place Slab on Grade with seven child line items', () => {
    const { division, constructionActivity, lineItemTemplates, productionRates } =
      SEABEE_DIVISION_03_CONCRETE_SEED;

    expect(division.code).toBe('03');
    expect(division.name).toBe('Concrete');
    expect(constructionActivity.name).toBe('Place Slab on Grade');
    expect(constructionActivity.scheduleEnabled).toBe(true);
    expect(lineItemTemplates).toHaveLength(7);
    expect(productionRates.length).toBeGreaterThanOrEqual(7);

    const names = lineItemTemplates.map((t) => t.name);
    expect(names).toContain('Form slab edge');
    expect(names).toContain('Place vapor barrier');
    expect(names).toContain('Place welded wire fabric');
    expect(names).toContain('Place concrete');
    expect(names).toContain('Finish concrete');
    expect(names).toContain('Cure concrete');
    expect(names).toContain('Sawcut control joints');
  });

  it('seed line item templates resolve man-hours from linked production rates', () => {
    for (const template of SEABEE_DIVISION_03_CONCRETE_SEED.lineItemTemplates) {
      const rate = manHoursPerUnitFromLineItemTemplate(
        template,
        SEABEE_DIVISION_03_PRODUCTION_RATE_MAP,
      );
      expect(rate).toBeGreaterThan(0);
      expect(template.unit.length).toBeGreaterThan(0);
    }
  });
});
