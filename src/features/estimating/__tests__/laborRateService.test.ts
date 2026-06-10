import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { CompanyLaborRate, ProjectLaborRate } from '../domain/laborRateTypes';
import type { ProjectActivityLineItem } from '../domain/constructionActivityTypes';
import { EMPTY_LABOR_PRICING_SNAPSHOT } from '../domain/constructionActivityTypes';
import {
  applyLaborRateToLineItem,
  recalculateActivityLaborCosts,
} from '../application/laborPricingCalculator';
import {
  copyCompanyRatesToProject,
  resetProjectLaborRateToCompany,
} from '../application/laborRateService';

vi.mock('../infrastructure/laborRateRepository', () => ({
  fetchProjectLaborRatesFromDb: vi.fn(),
  insertProjectLaborRatesInDb: vi.fn(),
  upsertProjectLaborRateInDb: vi.fn(),
  clearProjectLaborRateDefaultInDb: vi.fn(),
  clearCompanyLaborRateDefaultInDb: vi.fn(),
}));

import {
  fetchProjectLaborRatesFromDb,
  insertProjectLaborRatesInDb,
  upsertProjectLaborRateInDb,
} from '../infrastructure/laborRateRepository';

const companyRate: CompanyLaborRate = {
  id: 'company-1',
  userId: 'user-1',
  roleKey: 'laborer',
  roleName: 'Laborer',
  tradeCategory: 'General',
  hourlyRate: 45,
  burdenPercent: 25,
  fullyBurdenedRate: 56.25,
  billingRate: 75,
  isActive: true,
  isDefault: true,
};

const projectRate: ProjectLaborRate = {
  id: 'project-rate-1',
  projectId: 'project-1',
  companyLaborRateId: companyRate.id,
  roleKey: 'laborer',
  roleName: 'Laborer',
  tradeCategory: 'General',
  hourlyRate: 45,
  burdenPercent: 25,
  fullyBurdenedRate: 56.25,
  billingRate: 75,
  isActive: true,
  isDefault: true,
  isOverride: false,
};

function makeLineItem(overrides: Partial<ProjectActivityLineItem> = {}): ProjectActivityLineItem {
  return {
    id: 'li-1',
    projectActivityId: 'act-1',
    projectId: 'project-1',
    name: 'Place concrete',
    unit: 'CY',
    quantity: 10,
    manHoursPerUnit: 1.2,
    productionFactor: 1,
    calculatedManHours: 12,
    laborCost: 0,
    materialCost: 0,
    equipmentCost: 0,
    ...EMPTY_LABOR_PRICING_SNAPSHOT,
    ...overrides,
  };
}

describe('laborRateService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('copyCompanyRatesToProject inserts company rates when project schedule is empty', async () => {
    vi.mocked(fetchProjectLaborRatesFromDb).mockResolvedValueOnce({ data: [], error: null });
    vi.mocked(insertProjectLaborRatesInDb).mockResolvedValueOnce({ data: [projectRate], error: null });

    const result = await copyCompanyRatesToProject('project-1', [companyRate]);

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(insertProjectLaborRatesInDb).toHaveBeenCalledWith([
      expect.objectContaining({
        projectId: 'project-1',
        roleKey: 'laborer',
        hourlyRate: 45,
        isOverride: false,
      }),
    ]);
  });

  it('copyCompanyRatesToProject returns existing project rates without inserting', async () => {
    vi.mocked(fetchProjectLaborRatesFromDb).mockResolvedValueOnce({
      data: [projectRate],
      error: null,
    });

    const result = await copyCompanyRatesToProject('project-1', [companyRate]);

    expect(result.data).toEqual([projectRate]);
    expect(insertProjectLaborRatesInDb).not.toHaveBeenCalled();
  });

  it('resetProjectLaborRateToCompany clears override flag and restores company values', async () => {
    vi.mocked(upsertProjectLaborRateInDb).mockResolvedValueOnce({
      data: { ...projectRate, isOverride: false, hourlyRate: 45 },
      error: null,
    });

    const result = await resetProjectLaborRateToCompany(
      { ...projectRate, isOverride: true, hourlyRate: 50 },
      companyRate,
    );

    expect(result.error).toBeNull();
    expect(upsertProjectLaborRateInDb).toHaveBeenCalledWith(
      expect.objectContaining({
        hourlyRate: 45,
        burdenPercent: 25,
        isOverride: false,
      }),
    );
  });
});

describe('laborPricingCalculator integration with service expectations', () => {
  it('changing project labor rate does not mutate existing line item until recalculation', () => {
    const original = applyLaborRateToLineItem(makeLineItem(), projectRate);
    const changedRate = { ...projectRate, hourlyRate: 60, fullyBurdenedRate: 75 };

    expect(original.laborCost).toBe(675);
    expect(original.hourlyRateSnapshot).toBe(45);

    const untouched = recalculateActivityLaborCosts([original], changedRate, new Set());
    expect(untouched[0].hourlyRateSnapshot).toBe(45);
    expect(untouched[0].laborCost).toBe(675);

    const recalculated = recalculateActivityLaborCosts([original], changedRate);
    expect(recalculated[0].hourlyRateSnapshot).toBe(60);
    expect(recalculated[0].laborCost).toBe(900);
  });
});
