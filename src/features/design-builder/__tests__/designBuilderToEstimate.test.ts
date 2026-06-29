import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesignEstimatePreviewLine, DesignQuantityItem } from '../types';
import type { ProductionRateLibraryEntry } from '../../estimating/data/productionRates/productionRateTypes';

const mocks = vi.hoisted(() => ({
  replaceDesignQuantityItems: vi.fn(),
  markDesignQuantityItemsCommitted: vi.fn(),
  instantiateAndSaveFromProductionRateAssembly: vi.fn(),
  instantiateAndSaveManualActivity: vi.fn(),
  updateProjectLineItemFromDesignPreview: vi.fn(),
}));

vi.mock('../services/designBuilderService', () => ({
  replaceDesignQuantityItems: mocks.replaceDesignQuantityItems,
  markDesignQuantityItemsCommitted: mocks.markDesignQuantityItemsCommitted,
}));

vi.mock('../../estimating/application/constructionActivityService', () => ({
  instantiateAndSaveFromProductionRateAssembly: mocks.instantiateAndSaveFromProductionRateAssembly,
  instantiateAndSaveManualActivity: mocks.instantiateAndSaveManualActivity,
}));

vi.mock('../../estimating/infrastructure/activityRepository', () => ({
  updateProjectLineItemFromDesignPreview: mocks.updateProjectLineItemFromDesignPreview,
}));

import {
  commitDesignEstimatePreview,
  persistDesignEstimatePreview,
} from '../application/designBuilderToEstimate';

function makePreviewLine(overrides: Partial<DesignEstimatePreviewLine> = {}): DesignEstimatePreviewLine {
  return {
    id: 'cmu-blocks',
    designModelId: 'model-1',
    designObjectId: 'wall-1',
    quantityType: 'cmu_block_count',
    description: 'CMU blocks including waste',
    quantity: 770,
    unit: 'EA',
    formula: 'ceil(((gross_wall_area - openings_area) / block_face_area) * (1 + waste_factor))',
    parameterSnapshot: { heightMeters: 2.8 },
    source: 'parametric_design_builder',
    confidence: 'calculated_from_parameters',
    divisionCode: '04',
    divisionName: 'Masonry',
    ...overrides,
  };
}

function makeQuantityItem(): DesignQuantityItem {
  return {
    id: 'quantity-1',
    designModelId: 'model-1',
    designObjectId: 'wall-1',
    projectId: 'project-1',
    estimateId: 'estimate-1',
    estimateLineId: null,
    quantityType: 'cmu_block_count',
    description: 'CMU blocks including waste',
    quantity: 770,
    unit: 'EA',
    formula: 'formula',
    source: 'parametric_design_builder',
    confidence: 'calculated_from_parameters',
    parameterSnapshot: { heightMeters: 2.8 },
    metadata: { previewLineId: 'cmu-blocks' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function makeProductionRate(overrides: Partial<ProductionRateLibraryEntry> = {}): ProductionRateLibraryEntry {
  return {
    id: 'rate-cmu-blocks',
    divisionCode: '04',
    divisionName: 'Masonry',
    figure: '04-22-10',
    figureTitle: 'CMU block wall',
    sourcePage: '12',
    sourcePdfPage: 12,
    workElementNumber: '0010',
    workElementLineNumber: '0010',
    category: 'Masonry',
    subcategory: 'CMU',
    activityName: 'CMU wall blocks',
    description: 'Install concrete masonry units',
    unitOfMeasure: 'EA',
    manHoursPerUnit: 0.08,
    sourceDocumentFull: 'RSMeans Facilities Construction Cost Data' as ProductionRateLibraryEntry['sourceDocumentFull'],
    sourceEdition: '2026' as ProductionRateLibraryEntry['sourceEdition'],
    referenceNote: 'Figure 04-22-10',
    keywords: ['cmu', 'block', 'masonry'],
    ...overrides,
  };
}

const masonryScheduleGroup = {
  key: '04-masonry-cmu-wall-system',
  title: '04 Masonry - CMU Wall System',
  divisionCode: '04',
  divisionName: 'Masonry',
  category: 'CMU Wall System',
};

describe('Design Builder estimate bridge', () => {
  beforeEach(() => {
    mocks.replaceDesignQuantityItems.mockReset();
    mocks.markDesignQuantityItemsCommitted.mockReset();
    mocks.instantiateAndSaveFromProductionRateAssembly.mockReset();
    mocks.instantiateAndSaveManualActivity.mockReset();
    mocks.updateProjectLineItemFromDesignPreview.mockReset();
  });

  it('persists preview lines with mandatory source metadata', async () => {
    mocks.replaceDesignQuantityItems.mockResolvedValue({ data: [makeQuantityItem()], error: null });

    const result = await persistDesignEstimatePreview({
      projectId: 'project-1',
      estimateId: 'estimate-1',
      designModelId: 'model-1',
      lines: [makePreviewLine()],
    });

    expect(result.error).toBeNull();
    expect(mocks.replaceDesignQuantityItems).toHaveBeenCalledWith('model-1', [
      expect.objectContaining({
        designModelId: 'model-1',
        designObjectId: 'wall-1',
        quantityType: 'cmu_block_count',
        formula: expect.stringContaining('gross_wall_area'),
        parameterSnapshot: { heightMeters: 2.8 },
        metadata: {
          previewLineId: 'cmu-blocks',
          source: 'parametric_design_builder',
          confidence: 'calculated_from_parameters',
        },
      }),
    ]);
  });

  it('commits preview lines only after confirmation and links quantity items to estimate lines', async () => {
    const quantityItem = makeQuantityItem();
    mocks.instantiateAndSaveFromProductionRateAssembly.mockResolvedValue({
      data: {
        activity: { id: 'activity-1' },
        lineItems: [{ id: 'estimate-line-1' }],
      },
      error: null,
    });
    mocks.markDesignQuantityItemsCommitted.mockResolvedValue({
      data: [{ ...quantityItem, estimateLineId: 'estimate-line-1' }],
      error: null,
    });

    const result = await commitDesignEstimatePreview({
      projectId: 'project-1',
      estimateId: 'estimate-1',
      designModelId: 'model-1',
      previewLines: [makePreviewLine()],
      persistedQuantityItems: [quantityItem],
      existingActivities: [],
      projectLaborRates: [],
      productionRates: [makeProductionRate()],
      assignments: [
        {
          previewLineId: 'cmu-blocks',
          status: 'verified_rate',
          productionRateId: 'rate-cmu-blocks',
          scheduleGroup: masonryScheduleGroup,
          matchConfidence: 0.93,
          matchReason: 'Verified by estimator.',
        },
      ],
    });

    expect(result.error).toBeNull();
    expect(mocks.instantiateAndSaveFromProductionRateAssembly).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceTemplateKey: 'design_builder:04-masonry-cmu-wall-system',
        group: expect.objectContaining({
          defaultTitle: '04 Masonry - CMU Wall System',
          divisionCode: '04',
          rates: expect.arrayContaining([
            expect.objectContaining({
              id: 'rate-cmu-blocks',
              manHoursPerUnit: 0.08,
            }),
          ]),
        }),
        selectedLineItems: [
          expect.objectContaining({
            rateId: 'rate-cmu-blocks',
            quantity: 770,
            assignmentStatus: 'verified_rate',
            matchConfidence: 0.93,
            matchReason: 'Verified by estimator.',
          }),
        ],
      }),
    );
    expect(mocks.instantiateAndSaveManualActivity).not.toHaveBeenCalled();
    expect(mocks.markDesignQuantityItemsCommitted).toHaveBeenCalledWith({
      quantityItemIds: ['quantity-1'],
      estimateLineId: 'estimate-line-1',
    });
  });

  it('blocks positive preview rows without a resolved production-rate assignment', async () => {
    const result = await commitDesignEstimatePreview({
      projectId: 'project-1',
      estimateId: 'estimate-1',
      designModelId: 'model-1',
      previewLines: [makePreviewLine()],
      persistedQuantityItems: [makeQuantityItem()],
      existingActivities: [],
      projectLaborRates: [],
      productionRates: [makeProductionRate()],
      assignments: [],
    });

    expect(result.data).toBeNull();
    expect(result.error).toContain('Resolve or exclude');
    expect(mocks.instantiateAndSaveFromProductionRateAssembly).not.toHaveBeenCalled();
    expect(mocks.instantiateAndSaveManualActivity).not.toHaveBeenCalled();
  });

  it('blocks production-rate assignments with incompatible units', async () => {
    const result = await commitDesignEstimatePreview({
      projectId: 'project-1',
      estimateId: 'estimate-1',
      designModelId: 'model-1',
      previewLines: [makePreviewLine()],
      persistedQuantityItems: [makeQuantityItem()],
      existingActivities: [],
      projectLaborRates: [],
      productionRates: [makeProductionRate({ unitOfMeasure: 'SF' })],
      assignments: [
        {
          previewLineId: 'cmu-blocks',
          status: 'verified_rate',
          productionRateId: 'rate-cmu-blocks',
          scheduleGroup: masonryScheduleGroup,
        },
      ],
    });

    expect(result.data).toBeNull();
    expect(result.error).toContain('not compatible');
    expect(mocks.instantiateAndSaveFromProductionRateAssembly).not.toHaveBeenCalled();
    expect(mocks.instantiateAndSaveManualActivity).not.toHaveBeenCalled();
  });

  it('allows manual overrides only when MH/unit, reason, and source note are documented', async () => {
    const quantityItem = makeQuantityItem();

    const invalid = await commitDesignEstimatePreview({
      projectId: 'project-1',
      estimateId: 'estimate-1',
      designModelId: 'model-1',
      previewLines: [makePreviewLine()],
      persistedQuantityItems: [quantityItem],
      existingActivities: [],
      projectLaborRates: [],
      productionRates: [],
      assignments: [
        {
          previewLineId: 'cmu-blocks',
          status: 'manual_override',
          scheduleGroup: masonryScheduleGroup,
          manualOverride: {
            manHoursPerUnit: 0.05,
            reason: '',
            sourceNote: 'Estimator historical record.',
          },
        },
      ],
    });

    expect(invalid.data).toBeNull();
    expect(invalid.error).toContain('requires MH/unit, reason, and source note');
    expect(mocks.instantiateAndSaveManualActivity).not.toHaveBeenCalled();

    mocks.instantiateAndSaveManualActivity.mockResolvedValueOnce({
      data: {
        activity: { id: 'activity-1' },
        lineItems: [{ id: 'estimate-line-1' }],
      },
      error: null,
    });
    mocks.markDesignQuantityItemsCommitted.mockResolvedValueOnce({
      data: [{ ...quantityItem, estimateLineId: 'estimate-line-1' }],
      error: null,
    });

    const valid = await commitDesignEstimatePreview({
      projectId: 'project-1',
      estimateId: 'estimate-1',
      designModelId: 'model-1',
      previewLines: [makePreviewLine()],
      persistedQuantityItems: [quantityItem],
      existingActivities: [],
      projectLaborRates: [],
      productionRates: [],
      assignments: [
        {
          previewLineId: 'cmu-blocks',
          status: 'manual_override',
          scheduleGroup: masonryScheduleGroup,
          manualOverride: {
            manHoursPerUnit: 0.05,
            reason: 'No approved rate matches the current takeoff basis.',
            sourceNote: 'Estimator historical record.',
          },
        },
      ],
    });

    expect(valid.error).toBeNull();
    expect(mocks.instantiateAndSaveManualActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        lineItems: [
          expect.objectContaining({
            manHoursPerUnit: 0.05,
            manualProductionRateReason: 'No approved rate matches the current takeoff basis.',
            manualProductionRateSourceNote: 'Estimator historical record.',
          }),
        ],
      }),
    );
  });

  it('updates linked estimate lines instead of creating duplicate commits', async () => {
    const quantityItem = { ...makeQuantityItem(), estimateLineId: 'estimate-line-1' };
    mocks.updateProjectLineItemFromDesignPreview.mockResolvedValue({
      data: { id: 'estimate-line-1', quantity: 820 },
      error: null,
    });

    const result = await commitDesignEstimatePreview({
      projectId: 'project-1',
      estimateId: 'estimate-1',
      designModelId: 'model-1',
      previewLines: [makePreviewLine({ quantity: 820 })],
      persistedQuantityItems: [quantityItem],
      existingActivities: [],
      projectLaborRates: [],
      productionRates: [],
      assignments: [],
    });

    expect(result.error).toBeNull();
    expect(mocks.updateProjectLineItemFromDesignPreview).toHaveBeenCalledWith('estimate-line-1', {
      description: 'CMU blocks including waste',
      quantity: 820,
      unit: 'EA',
    });
    expect(mocks.instantiateAndSaveManualActivity).not.toHaveBeenCalled();
    expect(result.data?.committedQuantityItems).toEqual([quantityItem]);
  });
});
