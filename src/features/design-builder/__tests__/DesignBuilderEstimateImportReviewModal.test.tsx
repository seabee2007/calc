import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DesignBuilderEstimateImportReviewModal from '../ui/DesignBuilderEstimateImportReviewModal';
import type { DesignEstimatePreviewLine, DesignQuantityItem } from '../types';

const mocks = vi.hoisted(() => ({
  commitDesignEstimatePreview: vi.fn(),
  useProductionRateLibrary: vi.fn(),
  useProjectLaborRates: vi.fn(),
}));

vi.mock('../../../services/soundService', () => ({
  soundService: { play: vi.fn(), initialize: vi.fn() },
}));

vi.mock('../../../services/hapticService', () => ({
  hapticService: { modal: vi.fn(), button: vi.fn() },
}));

vi.mock('../application/designBuilderToEstimate', () => ({
  commitDesignEstimatePreview: mocks.commitDesignEstimatePreview,
}));

vi.mock('../../estimating/ui/hooks/useProductionRateLibrary', () => ({
  useProductionRateLibrary: mocks.useProductionRateLibrary,
}));

vi.mock('../../estimating/ui/hooks/useProjectLaborRates', () => ({
  useProjectLaborRates: mocks.useProjectLaborRates,
}));

function previewLine(): DesignEstimatePreviewLine {
  return {
    id: 'cmu-blocks',
    designModelId: 'model-1',
    designObjectId: 'wall-1',
    quantityType: 'cmu_block_count',
    description: 'CMU blocks including waste',
    quantity: 770,
    unit: 'EA',
    formula: 'formula',
    parameterSnapshot: {},
    source: 'parametric_design_builder',
    confidence: 'calculated_from_parameters',
    divisionCode: '04',
    divisionName: 'Masonry',
  };
}

function quantityItem(): DesignQuantityItem {
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
    parameterSnapshot: {},
    metadata: { previewLineId: 'cmu-blocks' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('DesignBuilderEstimateImportReviewModal', () => {
  beforeEach(() => {
    mocks.commitDesignEstimatePreview.mockReset();
    mocks.commitDesignEstimatePreview.mockResolvedValue({
      data: { bundles: [], committedQuantityItems: [{ id: 'quantity-1' }] },
      error: null,
    });
    mocks.useProductionRateLibrary.mockReturnValue({
      rates: [],
      totalCount: 0,
      loading: false,
      error: null,
      reload: vi.fn(),
      showSourceRecords: false,
      setShowSourceRecords: vi.fn(),
      isSourceIndex: false,
      filterRates: vi.fn(() => []),
      groupFilteredRates: vi.fn(() => []),
      divisionOptions: vi.fn(() => []),
      categoryOptions: vi.fn(() => []),
      unitOptions: vi.fn(() => []),
      figureOptions: vi.fn(() => []),
    });
    mocks.useProjectLaborRates.mockReturnValue({
      projectRates: [
        {
          id: 'labor-1',
          projectId: 'project-1',
          roleKey: 'mason',
          roleName: 'Mason',
          tradeCategory: 'Masonry',
          hourlyRate: 50,
          burdenPercent: 20,
          fullyBurdenedRate: 60,
          billingRate: 75,
          isActive: true,
          isDefault: true,
          isOverride: false,
        },
      ],
      ensureProjectLaborRatesReady: vi.fn(),
    });
  });

  it('keeps Create Activities disabled until every included row is resolved', async () => {
    const onCommitted = vi.fn();
    const onClose = vi.fn();

    render(
      <DesignBuilderEstimateImportReviewModal
        isOpen
        projectId="project-1"
        estimateId="estimate-1"
        designModelId="model-1"
        previewLines={[previewLine()]}
        persistedQuantityItems={[quantityItem()]}
        onClose={onClose}
        onCommitted={onCommitted}
      />,
    );

    const createButton = await screen.findByRole('button', { name: /create activities/i });
    await waitFor(() => expect(screen.getByText(/need review/i)).toBeInTheDocument());
    expect(createButton).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /use manual mh\/unit override/i }));
    fireEvent.change(screen.getByPlaceholderText(/mh \/ unit/i), { target: { value: '0.08' } });
    fireEvent.change(screen.getByPlaceholderText(/reason required/i), {
      target: { value: 'No approved rate matched the Design Builder unit.' },
    });
    fireEvent.change(screen.getByPlaceholderText(/source note required/i), {
      target: { value: 'Estimator historical production record.' },
    });

    expect(createButton).not.toBeDisabled();
    fireEvent.click(createButton);

    await waitFor(() => expect(mocks.commitDesignEstimatePreview).toHaveBeenCalled());
    expect(mocks.commitDesignEstimatePreview).toHaveBeenCalledWith(
      expect.objectContaining({
        assignments: [
          expect.objectContaining({
            previewLineId: 'cmu-blocks',
            status: 'manual_override',
            manualOverride: {
              manHoursPerUnit: 0.08,
              reason: 'No approved rate matched the Design Builder unit.',
              sourceNote: 'Estimator historical production record.',
            },
          }),
        ],
      }),
    );
    expect(onCommitted).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
