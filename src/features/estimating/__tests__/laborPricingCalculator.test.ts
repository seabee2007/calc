import { describe, expect, it } from 'vitest';
import type { ProjectActivityLineItem } from '../domain/constructionActivityTypes';
import { EMPTY_LABOR_PRICING_SNAPSHOT } from '../domain/constructionActivityTypes';
import type { ProjectLaborRate } from '../domain/laborRateTypes';
import {
  applyLaborRateToLineItem,
  applyManualLaborPricingToLineItem,
  recalculateActivityLaborCosts,
} from '../application/laborPricingCalculator';

const projectRate: ProjectLaborRate = {
  id: 'rate-1',
  projectId: 'project-1',
  roleKey: 'carpenter',
  roleName: 'Carpenter',
  tradeCategory: 'Carpentry',
  hourlyRate: 50,
  burdenPercent: 30,
  fullyBurdenedRate: 65,
  billingRate: 85,
  isActive: true,
  isDefault: false,
  isOverride: false,
};

function makeLineItem(overrides: Partial<ProjectActivityLineItem> = {}): ProjectActivityLineItem {
  return {
    id: 'li-1',
    projectActivityId: 'act-1',
    projectId: 'project-1',
    name: 'Formwork',
    unit: 'SF',
    quantity: 100,
    manHoursPerUnit: 0.05,
    productionFactor: 1,
    calculatedManHours: 5,
    laborCost: 0,
    materialCost: 0,
    equipmentCost: 0,
    ...EMPTY_LABOR_PRICING_SNAPSHOT,
    ...overrides,
  };
}

describe('laborPricingCalculator', () => {
  it('laborCost = calculatedManHours × fullyBurdenedRate rounded to 2 decimals', () => {
    const priced = applyLaborRateToLineItem(makeLineItem({ calculatedManHours: 12.345 }), {
      ...projectRate,
      fullyBurdenedRate: 56.789,
    });

    expect(priced.laborCost).toBe(701.06);
    expect(priced.pricingSource).toBe('project_rate');
    expect(priced.laborRoleId).toBe(projectRate.id);
    expect(priced.fullyBurdenedRateSnapshot).toBe(56.789);
  });

  it('applyLaborRateToLineItem snapshots role metadata immutably on the line item', () => {
    const original = makeLineItem();
    const priced = applyLaborRateToLineItem(original, projectRate);

    expect(priced.laborRoleKey).toBe('carpenter');
    expect(priced.laborRoleName).toBe('Carpenter');
    expect(priced.pricingSnapshotAt).toBeTruthy();
    expect(original.laborCost).toBe(0);
  });

  it('applyManualLaborPricingToLineItem marks pricing source as manual', () => {
    const priced = applyManualLaborPricingToLineItem(makeLineItem(), 40, 20, 70);
    expect(priced.pricingSource).toBe('manual');
    expect(priced.fullyBurdenedRateSnapshot).toBe(48);
    expect(priced.laborCost).toBe(240);
  });

  it('recalculateActivityLaborCosts updates only selected line items', () => {
    const first = applyLaborRateToLineItem(makeLineItem({ id: 'li-1' }), projectRate);
    const second = applyLaborRateToLineItem(
      makeLineItem({ id: 'li-2', calculatedManHours: 8 }),
      projectRate,
    );
    const updatedRate = { ...projectRate, hourlyRate: 70, fullyBurdenedRate: 91 };

    const result = recalculateActivityLaborCosts([first, second], updatedRate, new Set(['li-2']));

    expect(result[0].laborCost).toBe(first.laborCost);
    expect(result[1].laborCost).toBe(728);
  });
});
