import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { ProductionRateLibraryEntry } from '../../estimating/data/productionRates/productionRateTypes';
import { constructionActivitiesToScheduleActivities } from '../../estimating/scheduling/adapters/constructionActivitiesToScheduleActivities';
import type { DesignEstimatePreviewLine, DesignQuantityItem } from '../types';
import type { DesignActivityDraft, DesignQuantityUsage, DesignScopePackage } from '../application/designScopeTypes';

const mocks = vi.hoisted(() => ({
  deleteProjectActivity: vi.fn(),
  fetchProjectActivities: vi.fn(),
  saveActivityBundleWithResources: vi.fn(),
  createDesignQuantityImportLinks: vi.fn(),
  deleteDesignQuantityImportLinks: vi.fn(),
  listDesignQuantityImportLinksByActivityKeys: vi.fn(),
  markDesignQuantityItemsImported: vi.fn(),
}));

vi.mock('../../estimating/infrastructure/activityRepository', () => ({
  deleteProjectActivity: mocks.deleteProjectActivity,
  fetchProjectActivities: mocks.fetchProjectActivities,
  saveActivityBundleWithResources: mocks.saveActivityBundleWithResources,
  updateProjectLineItemFromDesignPreview: vi.fn(),
}));

vi.mock('../services/designBuilderService', () => ({
  createDesignQuantityImportLinks: mocks.createDesignQuantityImportLinks,
  deleteDesignQuantityImportLinks: mocks.deleteDesignQuantityImportLinks,
  listDesignQuantityImportLinksByActivityKeys: mocks.listDesignQuantityImportLinksByActivityKeys,
  markDesignQuantityItemsImported: mocks.markDesignQuantityItemsImported,
  markDesignQuantityItemsCommitted: vi.fn(),
  replaceDesignQuantityItems: vi.fn(),
}));

import {
  commitDesignActivityDrafts,
  commitDesignScopePackages,
} from '../application/designBuilderToEstimate';

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

function productionRate(overrides: Partial<ProductionRateLibraryEntry> = {}): ProductionRateLibraryEntry {
  return {
    id: overrides.id ?? 'rate-wall',
    divisionCode: overrides.divisionCode ?? '04',
    divisionName: overrides.divisionName ?? 'Masonry',
    figure: '04-22-10',
    figureTitle: 'CMU wall',
    sourcePage: '12',
    sourcePdfPage: 12,
    workElementNumber: '0010',
    workElementLineNumber: '0010',
    category: overrides.category ?? 'CMU Wall System',
    subcategory: 'CMU',
    activityName: overrides.activityName ?? 'Concrete masonry unit wall',
    description: overrides.description ?? 'Install CMU wall',
    unitOfMeasure: overrides.unitOfMeasure ?? 'SF',
    manHoursPerUnit: overrides.manHoursPerUnit ?? 0.05,
    crewSize: 4,
    sourceDocumentFull: 'RSMeans Facilities Construction Cost Data',
    sourceEdition: '2026',
    keywords: ['cmu', 'masonry', 'wall'],
    ...overrides,
  };
}

function usage(
  line: DesignEstimatePreviewLine,
  item: DesignQuantityItem | undefined,
  overrides: Partial<DesignQuantityUsage> = {},
): DesignQuantityUsage {
  return {
    id: overrides.id ?? `usage-${line.id}`,
    sourcePreviewLineId: line.id,
    sourceQuantityType: line.quantityType,
    persistedQuantityItem: item,
    sourceLine: line,
    enabled: true,
    locked: false,
    destination: 'activity_line_item',
    role: 'place_concrete_labor',
    activityKey: 'concrete:rc-roof-beams:place',
    activityTitle: '03 Concrete - RC Roof Beams - Place Concrete',
    description: line.description,
    quantity: line.quantity,
    unit: line.unit,
    formula: line.formula,
    derived: false,
    reviewStatus: 'ready',
    reviewReason: null,
    productionRateId: null,
    candidates: [],
    matchConfidence: null,
    matchReason: null,
    manualOverride: null,
    metadata: {
      designObjectId: line.designObjectId,
      divisionCode: line.divisionCode,
      divisionName: line.divisionName,
      componentName: 'RC Roof Beams',
    },
    ...overrides,
  };
}

function activityDraft(overrides: Partial<DesignActivityDraft> = {}): DesignActivityDraft {
  return {
    key: 'concrete:rc-roof-beams:place',
    title: '03 Concrete - RC Roof Beams - Place Concrete',
    divisionCode: '03',
    divisionName: 'Concrete',
    category: 'RC Roof Beams',
    scheduleEnabled: true,
    sourceObjectIds: ['frame-1'],
    sourcePreviewLineIds: ['rc-roof-beams-volume'],
    operation: 'place_concrete',
    defaultSequenceGroup: 'concrete:rc-roof-beams:place',
    usages: [],
    warnings: [],
    status: 'ready',
    ...overrides,
  };
}

describe('design scope package commit', () => {
  beforeEach(() => {
    mocks.deleteProjectActivity.mockReset();
    mocks.fetchProjectActivities.mockReset();
    mocks.saveActivityBundleWithResources.mockReset();
    mocks.createDesignQuantityImportLinks.mockReset();
    mocks.deleteDesignQuantityImportLinks.mockReset();
    mocks.listDesignQuantityImportLinksByActivityKeys.mockReset();
    mocks.markDesignQuantityItemsImported.mockReset();
    mocks.deleteProjectActivity.mockResolvedValue({ data: null, error: null });
    mocks.fetchProjectActivities.mockResolvedValue({ data: [], error: null });
    mocks.saveActivityBundleWithResources.mockImplementation(async (bundle) => ({
      data: {
        activity: {
          id: 'activity-1',
          activityCode: bundle.activity.activityCode ?? '04-01-01',
          title: bundle.activity.title ?? '04 Masonry - CMU Wall System',
          divisionCode: bundle.activity.divisionCode ?? '04',
          divisionName: bundle.activity.divisionName ?? 'Masonry',
          scheduleEnabled: bundle.activity.scheduleEnabled,
          crewSize: bundle.activity.crewSize ?? 4,
          hoursPerDay: bundle.activity.hoursPerDay ?? 8,
          calculatedManHours: bundle.activity.calculatedManHours ?? 5,
          calculatedManDays: bundle.activity.calculatedManDays ?? 0.625,
          calculatedDurationDays: bundle.activity.calculatedDurationDays ?? 1,
          effectiveDurationDays: bundle.activity.effectiveDurationDays ?? 1,
        },
        lineItems: bundle.lineItems.map((lineItem: Record<string, unknown>, index: number) => ({
          id: `line-item-${index + 1}`,
          ...lineItem,
        })),
        materials: bundle.materials.map((material: Record<string, unknown>, index: number) => ({
          id: `material-${index + 1}`,
          ...material,
        })),
        equipment: bundle.equipment.map((equipment: Record<string, unknown>, index: number) => ({
          id: `equipment-${index + 1}`,
          ...equipment,
        })),
      },
      error: null,
    }));
    mocks.createDesignQuantityImportLinks.mockImplementation(async (links) => ({
      data: links.map((link: Record<string, unknown>, index: number) => ({
        id: `link-${index + 1}`,
        ...link,
        createdAt: '2026-01-01T00:00:00.000Z',
      })),
      error: null,
    }));
    mocks.deleteDesignQuantityImportLinks.mockResolvedValue({ data: null, error: null });
    mocks.listDesignQuantityImportLinksByActivityKeys.mockResolvedValue({ data: [], error: null });
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

  it('stores multiple design quantity import links for one source quantity and attaches material to the labor activity', async () => {
    const concrete = previewLine({
      id: 'rc-roof-beams-volume',
      designObjectId: 'frame-1',
      quantityType: 'rc_roof_beams_volume',
      description: 'RC Roof Beams',
      quantity: 9.39,
      unit: 'CY',
      divisionCode: '03',
      divisionName: 'Concrete',
    });
    const item = quantityItem(concrete);
    const rate = productionRate({
      id: 'rate-concrete',
      divisionCode: '03',
      divisionName: 'Concrete',
      activityName: 'Place concrete',
      description: 'Place concrete',
      unitOfMeasure: 'CY',
      manHoursPerUnit: 0.7,
      category: 'RC Roof Beams',
    });
    mocks.markDesignQuantityItemsImported.mockResolvedValue({ data: [item], error: null });

    const result = await commitDesignActivityDrafts({
      projectId: 'project-1',
      estimateId: 'estimate-1',
      designModelId: 'model-1',
      activities: [
        activityDraft({
          usages: [
            usage(concrete, item, {
              id: 'roof-place-labor',
              productionRateId: rate.id,
              matchConfidence: 0.9,
              matchReason: 'Concrete placement',
            }),
            usage(concrete, item, {
              id: 'roof-ready-mix',
              destination: 'material_resource',
              role: 'concrete_material',
              description: 'Ready-mix concrete, RC Roof Beams',
              reviewStatus: 'material_only',
              productionRateId: null,
            }),
          ],
        }),
      ],
      referenceUsages: [],
      excludedUsages: [],
      rollupUsages: [],
      existingActivities: [],
      projectLaborRates: [],
      productionRates: [rate],
    });

    expect(result.error).toBeNull();
    expect(mocks.saveActivityBundleWithResources).toHaveBeenCalledWith(
      expect.objectContaining({
        activity: expect.objectContaining({ scheduleEnabled: true }),
        lineItems: [expect.objectContaining({ quantity: 9.39, unit: 'CY' })],
        materials: [expect.objectContaining({ name: 'Ready-mix concrete, RC Roof Beams', quantity: 9.39, unit: 'CY' })],
      }),
    );
    const links = mocks.createDesignQuantityImportLinks.mock.calls[0][0];
    expect(links).toEqual(expect.arrayContaining([
      expect.objectContaining({
        designQuantityItemId: item.id,
        targetType: 'project_activity_line_item',
        activityKey: 'concrete:rc-roof-beams:place',
      }),
      expect.objectContaining({
        designQuantityItemId: item.id,
        targetType: 'project_activity_material_resource',
        activityKey: 'concrete:rc-roof-beams:place',
      }),
    ]));
    const schedule = constructionActivitiesToScheduleActivities(
      result.data!.bundles.map((bundle) => bundle.activity),
    );
    expect(schedule.activities).toHaveLength(1);
  });

  it('does not duplicate a Design Builder activity when recommitting the same activity key', async () => {
    const concrete = previewLine({
      id: 'rc-roof-beams-volume',
      designObjectId: 'frame-1',
      quantityType: 'rc_roof_beams_volume',
      description: 'RC Roof Beams',
      quantity: 9.39,
      unit: 'CY',
      divisionCode: '03',
      divisionName: 'Concrete',
    });
    const item = quantityItem(concrete);
    const rate = productionRate({
      id: 'rate-concrete',
      divisionCode: '03',
      divisionName: 'Concrete',
      activityName: 'Place concrete',
      unitOfMeasure: 'CY',
      manHoursPerUnit: 0.7,
    });
    mocks.listDesignQuantityImportLinksByActivityKeys.mockResolvedValue({
      data: [{ id: 'prior-link', projectActivityId: 'old-activity' }],
      error: null,
    });

    await commitDesignActivityDrafts({
      projectId: 'project-1',
      estimateId: 'estimate-1',
      designModelId: 'model-1',
      activities: [activityDraft({ usages: [usage(concrete, item, { productionRateId: rate.id })] })],
      existingActivities: [],
      projectLaborRates: [],
      productionRates: [rate],
    });

    expect(mocks.deleteDesignQuantityImportLinks).toHaveBeenCalledWith(['prior-link']);
    expect(mocks.deleteProjectActivity).toHaveBeenCalledWith('old-activity');
    expect(mocks.saveActivityBundleWithResources).toHaveBeenCalledTimes(1);
  });

  it('creates material-only fallback activities as non-scheduled', async () => {
    const concrete = previewLine({
      id: 'rc-roof-beams-volume',
      designObjectId: 'frame-1',
      quantityType: 'rc_roof_beams_volume',
      description: 'RC Roof Beams',
      quantity: 9.39,
      unit: 'CY',
      divisionCode: '03',
      divisionName: 'Concrete',
    });
    const item = quantityItem(concrete);

    const result = await commitDesignActivityDrafts({
      projectId: 'project-1',
      estimateId: 'estimate-1',
      designModelId: 'model-1',
      activities: [
        activityDraft({
          scheduleEnabled: false,
          status: 'material_only',
          usages: [
            usage(concrete, item, {
              id: 'roof-ready-mix',
              destination: 'material_resource',
              role: 'concrete_material',
              description: 'Ready-mix concrete, RC Roof Beams',
              reviewStatus: 'material_only',
            }),
          ],
        }),
      ],
      existingActivities: [],
      projectLaborRates: [],
      productionRates: [],
    });

    expect(result.error).toBeNull();
    expect(mocks.saveActivityBundleWithResources).toHaveBeenCalledWith(
      expect.objectContaining({
        activity: expect.objectContaining({ scheduleEnabled: false }),
        lineItems: [],
        materials: [expect.objectContaining({ name: 'Ready-mix concrete, RC Roof Beams' })],
      }),
    );
    const schedule = constructionActivitiesToScheduleActivities(
      result.data!.bundles.map((bundle) => bundle.activity),
    );
    expect(schedule.activities).toHaveLength(0);
  });

  it('does not write manual added usages without a source quantity to design quantity import links', async () => {
    const manualLine = previewLine({
      id: 'manual-material',
      quantityType: 'manual_material',
      description: 'Manual material',
      quantity: 1,
      unit: 'EA',
      divisionCode: '03',
      divisionName: 'Concrete',
    });

    await commitDesignActivityDrafts({
      projectId: 'project-1',
      estimateId: 'estimate-1',
      designModelId: 'model-1',
      activities: [
        activityDraft({
          status: 'material_only',
          usages: [
            usage(manualLine, undefined, {
              destination: 'material_resource',
              role: 'material_takeoff',
              reviewStatus: 'material_only',
            }),
          ],
        }),
      ],
      existingActivities: [],
      projectLaborRates: [],
      productionRates: [],
    });

    expect(mocks.createDesignQuantityImportLinks).toHaveBeenCalledWith([]);
  });

  it('migration enables RLS policies for design quantity import links', () => {
    const sql = readFileSync(
      'supabase/migrations/20260726123000_design_quantity_import_links.sql',
      'utf8',
    );
    expect(sql).toContain('ALTER TABLE public.design_quantity_import_links ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('Project members view design quantity import links');
    expect(sql).toContain('Project owners insert design quantity import links');
    expect(sql).toContain('Project owners update design quantity import links');
    expect(sql).toContain('Project owners delete design quantity import links');
  });
});
