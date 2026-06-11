import { describe, expect, it } from 'vitest';
import type { ProductionRateLibraryEntry } from '../data/productionRates/productionRateTypes';
import type { ProjectActivityLineItem } from '../domain/constructionActivityTypes';
import type { ProjectLaborRate } from '../domain/laborRateTypes';
import { EMPTY_LABOR_PRICING_SNAPSHOT } from '../domain/constructionActivityTypes';
import {
  applyResolvedLaborRateToLineItem,
  resolveLaborRateForWorkElement,
} from '../application/laborRateResolver';

function sampleRate(overrides: Partial<ProductionRateLibraryEntry> = {}): ProductionRateLibraryEntry {
  return {
    id: '03-11-13.65-0040',
    divisionCode: '03',
    divisionName: 'Concrete',
    figure: null,
    figureTitle: null,
    sourcePage: null,
    sourcePdfPage: null,
    workElementNumber: '03 11 13.65',
    workElementLineNumber: '0040',
    category: 'Place Slab on Grade',
    subcategory: null,
    activityName: 'Install rebar',
    description: 'Install rebar',
    unitOfMeasure: 'LB',
    manHoursPerUnit: 0.01,
    crewSize: 4,
    sourceDocumentFull: 'Test',
    sourceEdition: 'Test',
    referenceNote: null,
    keywords: [],
    ...overrides,
  };
}

const carpenterRate: ProjectLaborRate = {
  id: 'rate-carpenter',
  projectId: 'project-1',
  roleKey: 'carpenter',
  roleName: 'Carpenter',
  tradeCategory: 'Carpentry',
  hourlyRate: 40,
  burdenPercent: 25,
  fullyBurdenedRate: 50,
  billingRate: 75,
  isActive: true,
  isDefault: false,
  isOverride: false,
};

const generalTradeRate: ProjectLaborRate = {
  id: 'rate-general',
  projectId: 'project-1',
  roleKey: 'general_trade',
  roleName: 'General Trade',
  tradeCategory: 'General',
  hourlyRate: 35,
  burdenPercent: 20,
  fullyBurdenedRate: 42,
  billingRate: 60,
  isActive: true,
  isDefault: true,
  isOverride: false,
};

const laborerRate: ProjectLaborRate = {
  id: 'rate-laborer',
  projectId: 'project-1',
  roleKey: 'laborer',
  roleName: 'Laborer',
  tradeCategory: 'General',
  hourlyRate: 30,
  burdenPercent: 20,
  fullyBurdenedRate: 36,
  billingRate: 50,
  isActive: true,
  isDefault: false,
  isOverride: false,
};

function makeLineItem(overrides: Partial<ProjectActivityLineItem> = {}): ProjectActivityLineItem {
  return {
    id: 'li-1',
    projectActivityId: 'act-1',
    projectId: 'project-1',
    name: 'Install rebar',
    unit: 'LB',
    quantity: 100,
    manHoursPerUnit: 0.01,
    productionFactor: 1,
    calculatedManHours: 1,
    laborCost: 0,
    materialCost: 0,
    equipmentCost: 0,
    ...EMPTY_LABOR_PRICING_SNAPSHOT,
    ...overrides,
  };
}

describe('laborRateResolver', () => {
  it('resolves mapped role when active on project schedule', () => {
    const resolved = resolveLaborRateForWorkElement({
      workElement: sampleRate({ activityName: 'Edge forms, plywood', description: 'forming edge' }),
      projectLaborRates: [carpenterRate, generalTradeRate],
    });

    expect(resolved.resolutionSource).toBe('mapped');
    expect(resolved.laborRoleKey).toBe('carpenter');
    expect(resolved.warning).toBeUndefined();
  });

  it('falls back to General Trade when mapped role is missing', () => {
    const resolved = resolveLaborRateForWorkElement({
      workElement: sampleRate(),
      projectLaborRates: [carpenterRate, generalTradeRate],
    });

    expect(resolved.mappedRoleKey).toBe('ironworker');
    expect(resolved.resolutionSource).toBe('fallback_general_trade');
    expect(resolved.laborRoleKey).toBe('general_trade');
    expect(resolved.warning).toBeUndefined();
  });

  it('falls back to default active rate when General Trade is missing', () => {
    const resolved = resolveLaborRateForWorkElement({
      workElement: sampleRate(),
      projectLaborRates: [carpenterRate, { ...laborerRate, isDefault: true }],
    });

    expect(resolved.resolutionSource).toBe('fallback_default_rate');
    expect(resolved.laborRoleKey).toBe('laborer');
    expect(resolved.warning).toBeUndefined();
  });

  it('returns missing warning when no active project rates exist', () => {
    const resolved = resolveLaborRateForWorkElement({
      workElement: sampleRate(),
      projectLaborRates: [],
    });

    expect(resolved.resolutionSource).toBe('missing');
    expect(resolved.warning).toBe('Missing labor rate');
    expect(resolved.projectRate).toBeNull();
  });

  it('prices fallback success as calculatedManHours × fullyBurdenedRateSnapshot', () => {
    const resolved = resolveLaborRateForWorkElement({
      workElement: sampleRate(),
      projectLaborRates: [generalTradeRate],
    });
    const priced = applyResolvedLaborRateToLineItem(
      makeLineItem({ calculatedManHours: 12.5 }),
      resolved,
    );

    expect(priced.laborRoleKey).toBe('general_trade');
    expect(priced.fullyBurdenedRateSnapshot).toBe(42);
    expect(priced.laborCost).toBe(525);
  });

  it('uses explicit preferred role when provided', () => {
    const resolved = resolveLaborRateForWorkElement({
      workElement: sampleRate(),
      projectLaborRates: [carpenterRate, generalTradeRate],
      preferredRoleId: carpenterRate.id,
    });

    expect(resolved.resolutionSource).toBe('explicit');
    expect(resolved.laborRoleKey).toBe('carpenter');
  });

  it('falls back to General Trade for formwork when Carpenter is missing', () => {
    const resolved = resolveLaborRateForWorkElement({
      workElement: {
        activityName: 'Wall, Job-built Plywood, To 8 Feet',
        description: 'Wall, job-built plywood, to 8 feet',
        category: 'Walls, Forms in Place',
        keywords: ['forming', 'production', 'forms', 'plywood'],
      },
      projectLaborRates: [generalTradeRate],
    });

    expect(resolved.mappedRoleKey).toBe('carpenter');
    expect(resolved.resolutionSource).toBe('fallback_general_trade');
    expect(resolved.laborRoleKey).toBe('general_trade');
    expect(resolved.warning).toBeUndefined();
  });

  it('prices formwork fallback as calculatedManHours × fullyBurdenedRateSnapshot', () => {
    const resolved = resolveLaborRateForWorkElement({
      workElement: {
        activityName: 'Wall, Job-built Plywood, To 8 Feet',
        description: 'Wall, job-built plywood, to 8 feet',
        category: 'Walls, Forms in Place',
        keywords: ['forming', 'production', 'forms', 'plywood'],
      },
      projectLaborRates: [generalTradeRate],
    });
    const priced = applyResolvedLaborRateToLineItem(
      makeLineItem({ calculatedManHours: 3.98 }),
      resolved,
    );

    expect(priced.laborRoleKey).toBe('general_trade');
    expect(priced.laborCost).toBeCloseTo(3.98 * 42, 2);
  });
});
