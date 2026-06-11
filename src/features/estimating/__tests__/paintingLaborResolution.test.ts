import { describe, expect, it } from 'vitest';
import type { ProductionRateLibraryEntry } from '../data/productionRates/productionRateTypes';
import { mapProductionRateToLaborRoleKey } from '../application/laborRoleMapping';
import {
  applyResolvedLaborRateToLineItem,
  resolveLaborRateForWorkElement,
} from '../application/laborRateResolver';
import { previewDraftProductionRateActivity } from '../application/productionRateAssemblyBuilder';
import type { ProjectLaborRate } from '../domain/laborRateTypes';
import { EMPTY_LABOR_PRICING_SNAPSHOT } from '../domain/constructionActivityTypes';
import type { ProjectActivityLineItem } from '../domain/constructionActivityTypes';

function sampleRate(overrides: Partial<ProductionRateLibraryEntry> = {}): ProductionRateLibraryEntry {
  return {
    id: '09-91-13.30-0010',
    divisionCode: '09',
    divisionName: 'Finishes',
    figure: 'Figure 5-J-17',
    figureTitle: null,
    sourcePage: '5-J-17',
    sourcePdfPage: null,
    workElementNumber: '09 91 13.30',
    workElementLineNumber: '0010',
    category: 'Chain Link Or Wire Metal Picket And Stockade One Side Water Base',
    subcategory: null,
    activityName: 'Roll And Brush, First Coat',
    description: 'Roll And Brush, First Coat',
    unitOfMeasure: 'SF',
    manHoursPerUnit: 0.012,
    crewSize: 2,
    sourceDocumentFull: 'Test',
    sourceEdition: 'Test',
    referenceNote: null,
    keywords: [],
    ...overrides,
  };
}

const painterRate: ProjectLaborRate = {
  id: 'rate-painter',
  projectId: 'project-1',
  roleKey: 'painter',
  roleName: 'Painter',
  tradeCategory: 'Finishes',
  hourlyRate: 50,
  burdenPercent: 30,
  fullyBurdenedRate: 65,
  billingRate: 85,
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

describe('painting labor role resolution', () => {
  it.each([
    ['Roll And Brush, First Coat'],
    ['Second Coat'],
    ['Spray, First Coat'],
    ['Spray paint finish coat'],
  ])('maps "%s" to painter', (activityName) => {
    expect(
      mapProductionRateToLaborRoleKey(
        sampleRate({
          activityName,
          description: activityName,
        }),
      ),
    ).toBe('painter');
  });

  it('falls back to General Trade when painter is missing from schedule', () => {
    const resolved = resolveLaborRateForWorkElement({
      workElement: sampleRate(),
      projectLaborRates: [generalTradeRate],
    });

    expect(resolved.mappedRoleKey).toBe('painter');
    expect(resolved.resolutionSource).toBe('fallback_general_trade');
    expect(resolved.laborRoleKey).toBe('general_trade');
    expect(resolved.warning).toBeUndefined();
  });

  it('calculates painting labor cost from fallback rate', () => {
    const resolved = resolveLaborRateForWorkElement({
      workElement: sampleRate(),
      projectLaborRates: [generalTradeRate],
    });
    const lineItem: ProjectActivityLineItem = {
      id: 'li-1',
      projectActivityId: 'act-1',
      projectId: 'project-1',
      name: 'Roll And Brush, First Coat',
      unit: 'SF',
      quantity: 66,
      manHoursPerUnit: 0.012,
      productionFactor: 1,
      calculatedManHours: 0.792,
      laborCost: 0,
      materialCost: 0,
      equipmentCost: 0,
      ...EMPTY_LABOR_PRICING_SNAPSHOT,
    };
    const priced = applyResolvedLaborRateToLineItem(lineItem, resolved);
    expect(priced.laborCost).toBeCloseTo(0.792 * 42, 2);
  });

  it('preview shows labor cost > 0 when project has rates', () => {
    const rate = sampleRate();
    const preview = previewDraftProductionRateActivity(
      {
        divisionCode: '09',
        divisionName: 'Finishes',
        category: rate.category ?? 'Painting',
        sourceTemplateKey: 'production_rate_category:09:painting',
        defaultTitle: 'Painting',
        title: 'Painting',
        crewSize: 4,
        hoursPerDay: 8,
        scheduleEnabled: true,
        lineItems: [
          {
            draftId: 'draft-1',
            rate,
            selected: true,
            quantity: 66,
            lineItem: {
              projectId: 'project-1',
              productionRateId: null,
              sourceProductionRateKey: rate.id,
              sourceProductionRateLabel: rate.activityName,
              sourceFigure: null,
              sourcePage: null,
              sourcePdfPage: null,
              sourceDocumentCode: null,
              name: rate.activityName,
              description: rate.description,
              unit: rate.unitOfMeasure,
              quantity: 66,
              manHoursPerUnit: rate.manHoursPerUnit ?? 0,
              productionFactor: 1,
              calculatedManHours: 0.792,
              ...EMPTY_LABOR_PRICING_SNAPSHOT,
              laborCost: 0,
              materialCost: 0,
              equipmentCost: 0,
              subcontractCost: 0,
              totalCost: 0,
              sortOrder: 1,
            },
          },
        ],
      },
      [painterRate, generalTradeRate],
    );

    expect(preview.rollup.totalLaborCost).toBeGreaterThan(0);
    expect(preview.projectLineItems[0].laborRoleKey).toBe('painter');
    expect(preview.laborRoleWarnings).toHaveLength(0);
  });
});
