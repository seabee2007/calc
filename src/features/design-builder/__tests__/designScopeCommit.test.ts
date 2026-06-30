import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProductionRateLibraryEntry } from '../../estimating/data/productionRates/productionRateTypes';
import { constructionActivitiesToScheduleActivities } from '../../estimating/scheduling/adapters/constructionActivitiesToScheduleActivities';
import type { DesignEstimatePreviewLine, DesignQuantityItem } from '../types';
import type { DesignScopePackage } from '../application/designScopeTypes';

const mocks = vi.hoisted(() => ({
  fetchProjectActivities: vi.fn(),
  saveActivityBundleWithResources: vi.fn(),
  markDesignQuantityItemsImported: vi.fn(),
}));

vi.mock('../../estimating/infrastructure/activityRepository', () => ({
  fetchProjectActivities: mocks.fetchProjectActivities,
  saveActivityBundleWithResources: mocks.saveActivityBundleWithResources,
  updateProjectLineItemFromDesignPreview: vi.fn(),
}));

vi.mock('../services/designBuilderService', () => ({
  markDesignQuantityItemsImported: mocks.markDesignQuantityItemsImported,
  markDesignQuantityItemsCommitted: vi.fn(),
  replaceDesignQuantityItems: vi.fn(),
}));

import { commitDesignScopePackages } from '../application/designBuilderToEstimate';

function previewLine(overrides: Partial<DesignEstimatePreviewLine> = {}): DesignEstimatePreviewLine {
  return {
    id: overrides.id ?? overrides.quantityType ?? 'line-1',
    designModelId: 'model-1',
    designObjectId: 'wall-1',
    quantityType: 'cmu_wall_net_area',
    description: 'CMU wall net area',
    quantity: 100,
    unit: 'SF',
    formula: 'formula',
    parameterSnapshot: {},
    source: 'parametric_design_builder',
    confidence: 'calculated_from_parameters',
    divisionCode: '04',
    divisionName: 'Masonry',
    ...overrides,
  };
}

function quantityItem(line: DesignEstimatePreviewLine): DesignQuantityItem {
  return {
    id: `${line.id}-quantity`,
    designModelId: line.designModelId,
    designObjectId: line.designObjectId,
    projectId: 'project-1',
    estimateId: 'estimate-1',
    estimateLineId: null,
    estimateActivityId: null,
    materialResourceId: null,
    equipmentResourceId: null,
    importDestination: null,
    importStatus: null,
    scopePackageKey: null,
    importReviewReason: null,
    quantityType: line.quantityType,
    description: line.description,
    quantity: line.quantity,
    unit: line.unit,
    formula: line.formula,
    source: line.source,
    confidence: line.confidence,
    parameterSnapshot: line.parameterSnapshot,
    metadata: { previewLineId: line.id },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function productionRate(): ProductionRateLibraryEntry {
  return {
    id: 'rate-wall',
    divisionCode: '04',
    divisionName: 'Masonry',
    figure: '04-22-10',
    figureTitle: 'CMU wall',
    sourcePage: '12',
    sourcePdfPage: 12,
    workElementNumber: '0010',
    workElementLineNumber: '0010',
    category: 'CMU Wall System',
    subcategory: 'CMU',
    activityName: 'Concrete masonry unit wall',
    description: 'Install CMU wall',
    unitOfMeasure: 'SF',
    manHoursPerUnit: 0.05,
    crewSize: 4,
    sourceDocumentFull: 'RSMeans Facilities Construction Cost Data',
    sourceEdition: '2026',
    keywords: ['cmu', 'masonry', 'wall'],
  };
}

describe('design scope package commit', () => {
  beforeEach(() => {
    mocks.fetchProjectActivities.mockReset();
    mocks.saveActivityBundleWithResources.mockReset();
    mocks.markDesignQuantityItemsImported.mockReset();
    mocks.fetchProjectActivities.mockResolvedValue({ data: [], error: null });
    mocks.saveActivityBundleWithResources.mockResolvedValue({
      data: {
        activity: {
          id: 'activity-1',
          activityCode: '04-01-01',
          title: '04 Masonry - CMU Wall System',
          divisionCode: '04',
          divisionName: 'Masonry',
          scheduleEnabled: true,
          crewSize: 4,
          hoursPerDay: 8,
          calculatedManHours: 5,
          calculatedManDays: 0.625,
          calculatedDurationDays: 1,
          effectiveDurationDays: 1,
        },
        lineItems: [{ id: 'line-item-1' }],
        materials: [{ id: 'material-1' }],
        equipment: [],
      },
      error: null,
    });
    mocks.markDesignQuantityItemsImported.mockResolvedValue({
      data: [],
      error: null,
    });
  });

  it('creates one activity bundle with labor line items and attached material resources', async () => {
    const labor = previewLine();
    const material = previewLine({
      id: 'cmu-block-count',
      quantityType: 'cmu_block_count',
      description: 'CMU blocks',
      quantity: 770,
      unit: 'EA',
    });
    const rate = productionRate();
    const scopePackage: DesignScopePackage = {
      key: '04-masonry-cmu-wall-system',
      kind: 'masonry_cmu_wall',
      title: '04 Masonry - CMU Wall System',
      divisionCode: '04',
      divisionName: 'Masonry',
      category: 'CMU Wall System',
      scheduleEnabled: true,
      sourceObjectIds: ['wall-1'],
      locationLabel: 'CMU Infill Panels',
      warnings: [],
      status: 'ready',
      quantities: [
        {
          line: labor,
          persistedQuantityItem: quantityItem(labor),
          classification: {
            previewLineId: labor.id,
            quantityType: labor.quantityType,
            destination: 'activity_line_item',
            packageKind: 'masonry_cmu_wall',
            packageKey: '04-masonry-cmu-wall-system',
            role: 'primary_labor_driver',
            includeByDefault: true,
            locked: false,
            reason: null,
            preferredUnit: 'SF',
            keywords: ['cmu', 'masonry'],
          },
          candidates: [{ productionRateId: rate.id, divisionCode: '04', divisionName: 'Masonry', workElementName: rate.activityName, unit: 'SF', manHoursPerUnit: 0.05, confidence: 0.95, matchReason: 'test', unitCompatible: true }],
          selectedProductionRateId: rate.id,
          assignmentStatus: 'verified_rate',
          manualOverride: null,
        },
        {
          line: material,
          persistedQuantityItem: quantityItem(material),
          classification: {
            previewLineId: material.id,
            quantityType: material.quantityType,
            destination: 'material_resource',
            packageKind: 'masonry_cmu_wall',
            packageKey: '04-masonry-cmu-wall-system',
            role: 'material_takeoff',
            includeByDefault: true,
            locked: false,
            reason: null,
            preferredUnit: 'EA',
            keywords: ['cmu', 'block'],
          },
          candidates: [],
          selectedProductionRateId: null,
          assignmentStatus: 'not_required',
          manualOverride: null,
        },
      ],
    };

    const result = await commitDesignScopePackages({
      projectId: 'project-1',
      estimateId: 'estimate-1',
      designModelId: 'model-1',
      packages: [scopePackage],
      existingActivities: [],
      projectLaborRates: [],
      productionRates: [rate],
    });

    expect(result.error).toBeNull();
    const schedule = constructionActivitiesToScheduleActivities(
      result.data!.bundles.map((bundle) => bundle.activity),
    );
    expect(schedule.activities).toHaveLength(1);
    expect(schedule.activities[0]?.runtimeActivityId).toBe('activity-1');
    expect(mocks.saveActivityBundleWithResources).toHaveBeenCalledWith(
      expect.objectContaining({
        activity: expect.objectContaining({
          sourceTemplateKey: 'design_scope:04-masonry-cmu-wall-system',
          location: 'CMU Infill Panels',
        }),
        lineItems: [expect.objectContaining({ quantity: 100, unit: 'SF' })],
        materials: [expect.objectContaining({ name: 'CMU blocks', quantity: 770, unit: 'EA' })],
      }),
    );
    expect(mocks.markDesignQuantityItemsImported).toHaveBeenCalledWith({
      updates: expect.arrayContaining([
        expect.objectContaining({
          estimateLineId: 'line-item-1',
          importDestination: 'activity_line_item',
          scopePackageKey: '04-masonry-cmu-wall-system',
        }),
        expect.objectContaining({
          materialResourceId: 'material-1',
          importDestination: 'material_resource',
          scopePackageKey: '04-masonry-cmu-wall-system',
        }),
      ]),
    });
  });
});
