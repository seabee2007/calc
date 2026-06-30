import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  SOURCE_DOCUMENT_FULL,
  SOURCE_EDITION,
  type ProductionRateLibraryEntry,
} from '../../estimating/data/productionRates/productionRateTypes';
import { constructionActivitiesToScheduleActivities } from '../../estimating/scheduling/adapters/constructionActivitiesToScheduleActivities';
import type { DesignEstimatePreviewLine, DesignQuantityItem } from '../types';
import type { DesignActivityDraft, DesignQuantityUsage, DesignScopePackage } from '../application/designScopeTypes';

const mocks = vi.hoisted(() => ({
  deleteProjectActivity: vi.fn(),
  fetchProjectActivities: vi.fn(),
  saveActivityBundleWithResources: vi.fn(),
  finalizeDesignBuilderImportLinks: vi.fn(),
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
  finalizeDesignBuilderImportLinks: mocks.finalizeDesignBuilderImportLinks,
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
    sourceDocumentFull: SOURCE_DOCUMENT_FULL,
    sourceEdition: SOURCE_EDITION,
    referenceNote: 'NTRP reference',
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
    mocks.finalizeDesignBuilderImportLinks.mockReset();
    mocks.listDesignQuantityImportLinksByActivityKeys.mockReset();
    mocks.markDesignQuantityItemsImported.mockReset();
    mocks.deleteProjectActivity.mockResolvedValue({ data: null, error: null });
    mocks.fetchProjectActivities.mockResolvedValue({ data: [], error: null });
    mocks.saveActivityBundleWithResources.mockImplementation(async (bundle) => ({
      data: {
        activity: {
          id: bundle.activityId ?? 'activity-1',
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
    mocks.finalizeDesignBuilderImportLinks.mockImplementation(async (input) => ({
      data: {
        importLinks: input.links.map((link: Record<string, unknown>, index: number) => ({
          id: `link-${index + 1}`,
          ...link,
          createdAt: '2026-01-01T00:00:00.000Z',
        })),
        quantityItems: [],
      },
      error: null,
    }));
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
    const links = mocks.finalizeDesignBuilderImportLinks.mock.calls[0][0].links;
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
      data: [{
        id: 'prior-link',
        activityKey: 'concrete:rc-roof-beams:place',
        projectActivityId: 'old-activity',
      }],
      error: null,
    });
    mocks.fetchProjectActivities.mockResolvedValue({
      data: [{
        id: 'old-activity',
        projectId: 'project-1',
        estimateId: 'estimate-1',
        activityCode: '03-01-01',
        title: '03 Concrete - RC Roof Beams - Place Concrete',
        divisionCode: '03',
        divisionName: 'Concrete',
        sourceTemplateKey: 'design_activity:concrete:rc-roof-beams:place',
        scheduleEnabled: true,
        crewSize: 4,
        hoursPerDay: 8,
        productionFactor: 1,
        calculatedManHours: 1,
        calculatedManDays: 0.125,
        calculatedDurationDays: 1,
        effectiveDurationDays: 1,
      }],
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

    expect(mocks.deleteProjectActivity).not.toHaveBeenCalled();
    expect(mocks.saveActivityBundleWithResources).toHaveBeenCalledWith(
      expect.objectContaining({
        activityId: 'old-activity',
        activity: expect.objectContaining({ activityCode: '03-01-01' }),
      }),
    );
    expect(mocks.finalizeDesignBuilderImportLinks).toHaveBeenCalledWith(
      expect.objectContaining({
        activityKeys: ['concrete:rc-roof-beams:place'],
      }),
    );
  });

  it('recommitting a fully disabled generated activity preserves the activity and clears generated children', async () => {
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
    mocks.listDesignQuantityImportLinksByActivityKeys.mockResolvedValue({
      data: [{
        id: 'prior-link',
        activityKey: 'concrete:rc-roof-beams:place',
        projectActivityId: 'old-activity',
      }],
      error: null,
    });
    mocks.fetchProjectActivities.mockResolvedValue({
      data: [{
        id: 'old-activity',
        projectId: 'project-1',
        estimateId: 'estimate-1',
        activityCode: '03-01-01',
        title: '03 Concrete - RC Roof Beams - Place Concrete',
        divisionCode: '03',
        divisionName: 'Concrete',
        sourceTemplateKey: 'design_activity:concrete:rc-roof-beams:place',
        scheduleEnabled: true,
        crewSize: 4,
        hoursPerDay: 8,
        productionFactor: 1,
      }],
      error: null,
    });

    await commitDesignActivityDrafts({
      projectId: 'project-1',
      estimateId: 'estimate-1',
      designModelId: 'model-1',
      activities: [
        activityDraft({
          usages: [
            usage(concrete, item, {
              enabled: false,
              reviewStatus: 'ready',
            }),
          ],
        }),
      ],
      existingActivities: [],
      projectLaborRates: [],
      productionRates: [],
    });

    expect(mocks.deleteProjectActivity).not.toHaveBeenCalled();
    expect(mocks.saveActivityBundleWithResources).toHaveBeenCalledWith(
      expect.objectContaining({
        activityId: 'old-activity',
        activity: expect.objectContaining({
          activityCode: '03-01-01',
          scheduleEnabled: false,
        }),
        lineItems: [],
        materials: [],
        equipment: [],
        generatedChildSource: expect.objectContaining({
          sourceProvider: 'arden_design_builder',
          designModelId: 'model-1',
          activityKey: 'concrete:rc-roof-beams:place',
        }),
      }),
    );
    expect(mocks.finalizeDesignBuilderImportLinks).toHaveBeenCalledWith(
      expect.objectContaining({
        links: [
          expect.objectContaining({
            designQuantityItemId: item.id,
            targetType: 'reference',
            projectActivityId: 'old-activity',
          }),
        ],
      }),
    );
  });

  it('keeps prior import state active when the import finalizer fails during recommit', async () => {
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
      data: [{
        id: 'prior-link',
        activityKey: 'concrete:rc-roof-beams:place',
        projectActivityId: 'old-activity',
      }],
      error: null,
    });
    mocks.fetchProjectActivities.mockResolvedValue({
      data: [{
        id: 'old-activity',
        projectId: 'project-1',
        estimateId: 'estimate-1',
        activityCode: '03-01-01',
        title: '03 Concrete - RC Roof Beams - Place Concrete',
        divisionCode: '03',
        divisionName: 'Concrete',
        sourceTemplateKey: 'design_activity:concrete:rc-roof-beams:place',
        scheduleEnabled: true,
        crewSize: 4,
        hoursPerDay: 8,
        productionFactor: 1,
      }],
      error: null,
    });
    mocks.finalizeDesignBuilderImportLinks.mockResolvedValueOnce({
      data: null,
      error: 'finalizer failed',
    });

    const result = await commitDesignActivityDrafts({
      projectId: 'project-1',
      estimateId: 'estimate-1',
      designModelId: 'model-1',
      activities: [activityDraft({ usages: [usage(concrete, item, { productionRateId: rate.id })] })],
      existingActivities: [],
      projectLaborRates: [],
      productionRates: [rate],
    });

    expect(result.data).toBeNull();
    expect(result.error).toContain('finalizer failed');
    expect(mocks.deleteProjectActivity).not.toHaveBeenCalled();
    expect(mocks.finalizeDesignBuilderImportLinks).toHaveBeenCalledWith(
      expect.objectContaining({
        activityKeys: ['concrete:rc-roof-beams:place'],
        sourcePreviewLineIds: ['rc-roof-beams-volume'],
      }),
    );
  });

  it('passes generated source markers so recommit replaces only Design Builder children', async () => {
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

    await commitDesignActivityDrafts({
      projectId: 'project-1',
      estimateId: 'estimate-1',
      designModelId: 'model-1',
      activities: [
        activityDraft({
          usages: [
            usage(concrete, item, { id: 'place', productionRateId: rate.id }),
            usage(concrete, item, {
              id: 'ready-mix',
              destination: 'material_resource',
              role: 'concrete_material',
              reviewStatus: 'material_only',
            }),
          ],
        }),
      ],
      existingActivities: [],
      projectLaborRates: [],
      productionRates: [rate],
    });

    expect(mocks.saveActivityBundleWithResources).toHaveBeenCalledWith(
      expect.objectContaining({
        generatedChildSource: expect.objectContaining({
          sourceProvider: 'arden_design_builder',
          designModelId: 'model-1',
          activityKey: 'concrete:rc-roof-beams:place',
        }),
        lineItems: [
          expect.objectContaining({
            sourceProvider: 'arden_design_builder',
            sourceSnapshot: expect.objectContaining({
              designModelId: 'model-1',
              activityKey: 'concrete:rc-roof-beams:place',
              usageId: 'place',
              sourcePreviewLineId: 'rc-roof-beams-volume',
            }),
          }),
        ],
        materials: [
          expect.objectContaining({
            sourceProvider: 'arden_design_builder',
            sourceSnapshot: expect.objectContaining({
              usageId: 'ready-mix',
              sourcePreviewLineId: 'rc-roof-beams-volume',
            }),
          }),
        ],
      }),
    );
  });

  it('writes disabled and needs-review usages as audit links', async () => {
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
    const formwork = previewLine({
      id: 'rc-roof-beams-formwork',
      designObjectId: 'frame-1',
      quantityType: 'rc_roof_beams_formwork',
      description: 'RC Roof Beams formwork',
      quantity: 0,
      unit: 'SF',
      divisionCode: '03',
      divisionName: 'Concrete',
    });
    const concreteItem = quantityItem(concrete);
    const formworkItem = quantityItem(formwork);
    const rate = productionRate({
      id: 'rate-concrete',
      divisionCode: '03',
      divisionName: 'Concrete',
      activityName: 'Place concrete',
      unitOfMeasure: 'CY',
      manHoursPerUnit: 0.7,
    });

    await commitDesignActivityDrafts({
      projectId: 'project-1',
      estimateId: 'estimate-1',
      designModelId: 'model-1',
      activities: [
        activityDraft({
          usages: [
            usage(concrete, concreteItem, { id: 'place', productionRateId: rate.id }),
            usage(formwork, formworkItem, {
              id: 'missing-formwork',
              enabled: false,
              destination: 'activity_line_item',
              role: 'formwork_labor',
              reviewStatus: 'needs_review',
              reviewReason: 'Missing geometry for formwork.',
            }),
          ],
        }),
      ],
      existingActivities: [],
      projectLaborRates: [],
      productionRates: [rate],
    });

    const finalizeInput = mocks.finalizeDesignBuilderImportLinks.mock.calls[0][0];
    expect(finalizeInput.links).toEqual(expect.arrayContaining([
      expect.objectContaining({
        designQuantityItemId: formworkItem.id,
        targetType: 'reference',
        activityKey: 'concrete:rc-roof-beams:place',
        sourcePreviewLineId: 'rc-roof-beams-formwork',
      }),
    ]));
    expect(finalizeInput.quantityUpdates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        quantityItemId: formworkItem.id,
        importStatus: 'review_required',
      }),
    ]));
  });

  it('preserves mixed manual and verified-rate labor provenance in one activity', async () => {
    const placeLine = previewLine({
      id: 'rc-roof-beams-volume',
      designObjectId: 'frame-1',
      quantityType: 'rc_roof_beams_volume',
      description: 'RC Roof Beams',
      quantity: 9.39,
      unit: 'CY',
      divisionCode: '03',
      divisionName: 'Concrete',
    });
    const finishLine = previewLine({
      id: 'rc-roof-beams-finish',
      designObjectId: 'frame-1',
      quantityType: 'rc_roof_beams_finish',
      description: 'Finish beam top',
      quantity: 120,
      unit: 'SF',
      divisionCode: '03',
      divisionName: 'Concrete',
    });
    const placeItem = quantityItem(placeLine);
    const finishItem = quantityItem(finishLine);
    const rate = productionRate({
      id: 'rate-concrete',
      divisionCode: '03',
      divisionName: 'Concrete',
      activityName: 'Place concrete',
      unitOfMeasure: 'CY',
      manHoursPerUnit: 0.7,
    });

    await commitDesignActivityDrafts({
      projectId: 'project-1',
      estimateId: 'estimate-1',
      designModelId: 'model-1',
      activities: [
        activityDraft({
          usages: [
            usage(placeLine, placeItem, {
              id: 'verified-place',
              productionRateId: rate.id,
              matchConfidence: null,
            }),
            usage(finishLine, finishItem, {
              id: 'manual-finish',
              productionRateId: null,
              manualOverride: {
                manHoursPerUnit: 0.05,
                reason: 'No approved rate matches the formwork basis.',
                sourceNote: 'Estimator historical record.',
              },
            }),
          ],
        }),
      ],
      existingActivities: [],
      projectLaborRates: [],
      productionRates: [rate],
    });

    expect(mocks.saveActivityBundleWithResources).toHaveBeenCalledWith(
      expect.objectContaining({
        lineItems: [
          expect.objectContaining({
            productionRateAssignmentStatus: 'verified_rate',
            sourceProductionRateKey: 'rate-concrete',
            manualProductionRateReason: null,
          }),
          expect.objectContaining({
            productionRateAssignmentStatus: 'manual_override',
            manualProductionRateReason: 'No approved rate matches the formwork basis.',
            manualProductionRateSourceNote: 'Estimator historical record.',
          }),
        ],
      }),
    );
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

    expect(mocks.finalizeDesignBuilderImportLinks).toHaveBeenCalledWith(
      expect.objectContaining({ links: [] }),
    );
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

  it('hardening migration creates import links table before extending it', () => {
    const sql = readFileSync(
      'supabase/migrations/20260726130000_design_builder_update_only_recommit.sql',
      'utf8',
    );
    const createIndex = sql.indexOf('CREATE TABLE IF NOT EXISTS public.design_quantity_import_links');
    const alterIndex = sql.indexOf('ALTER TABLE public.design_quantity_import_links');

    expect(createIndex).toBeGreaterThanOrEqual(0);
    expect(alterIndex).toBeGreaterThan(createIndex);
    expect(sql).toContain('source_preview_line_id');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.finalize_design_builder_import_links');
    expect(sql).toContain('DROP INDEX IF EXISTS public.design_quantity_items_model_preview_line_uidx');
    expect(sql).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS design_quantity_items_model_preview_line_uidx',
    );
    expect(sql).not.toContain(
      'ON public.design_quantity_items(design_model_id, preview_line_id)\n  WHERE preview_line_id IS NOT NULL',
    );
  });

  it('repair migration makes preview line upsert conflict target non-partial', () => {
    const sql = readFileSync(
      'supabase/migrations/20260726131000_design_quantity_items_preview_line_upsert_constraint.sql',
      'utf8',
    );

    expect(sql).toContain('DROP INDEX IF EXISTS public.design_quantity_items_model_preview_line_uidx');
    expect(sql).toContain('CREATE UNIQUE INDEX design_quantity_items_model_preview_line_uidx');
    expect(sql).toContain('ON public.design_quantity_items(design_model_id, preview_line_id)');
    expect(sql).not.toContain(
      'ON public.design_quantity_items(design_model_id, preview_line_id)\n  WHERE preview_line_id IS NOT NULL',
    );
  });
});
