import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesignEstimatePreviewLine, DesignQuantityItem } from '../types';

const mocks = vi.hoisted(() => ({
  replaceDesignQuantityItems: vi.fn(),
  markDesignQuantityItemsCommitted: vi.fn(),
  instantiateAndSaveManualActivity: vi.fn(),
  updateProjectLineItemFromDesignPreview: vi.fn(),
}));

vi.mock('../services/designBuilderService', () => ({
  replaceDesignQuantityItems: mocks.replaceDesignQuantityItems,
  markDesignQuantityItemsCommitted: mocks.markDesignQuantityItemsCommitted,
}));

vi.mock('../../estimating/application/constructionActivityService', () => ({
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

describe('Design Builder estimate bridge', () => {
  beforeEach(() => {
    mocks.replaceDesignQuantityItems.mockReset();
    mocks.markDesignQuantityItemsCommitted.mockReset();
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
    mocks.instantiateAndSaveManualActivity.mockResolvedValue({
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
    });

    expect(result.error).toBeNull();
    expect(mocks.instantiateAndSaveManualActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        divisionCode: '04',
        divisionName: 'Masonry',
        sourceTemplateKey: 'design_builder_04',
        lineItems: [
          {
            description: 'CMU blocks including waste',
            unit: 'EA',
            quantity: 770,
            manHoursPerUnit: 0,
          },
        ],
      }),
    );
    expect(mocks.markDesignQuantityItemsCommitted).toHaveBeenCalledWith({
      quantityItemIds: ['quantity-1'],
      estimateLineId: 'estimate-line-1',
    });
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
