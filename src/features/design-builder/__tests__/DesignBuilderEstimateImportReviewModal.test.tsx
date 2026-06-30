import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DesignBuilderEstimateImportReviewModal from '../ui/DesignBuilderEstimateImportReviewModal';
import type { DesignEstimatePreviewLine, DesignQuantityItem } from '../types';
import type { ProductionRateLibraryEntry } from '../../estimating/data/productionRates/productionRateTypes';

const mocks = vi.hoisted(() => ({
  commitDesignActivityDrafts: vi.fn(),
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
  commitDesignActivityDrafts: mocks.commitDesignActivityDrafts,
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
    estimateActivityId: null,
    materialResourceId: null,
    equipmentResourceId: null,
    importDestination: null,
    importStatus: null,
    scopePackageKey: null,
    importReviewReason: null,
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
    manHoursPerUnit: overrides.manHoursPerUnit ?? 0.08,
    crewSize: 4,
    sourceDocumentFull: 'RSMeans Facilities Construction Cost Data',
    sourceEdition: '2026',
    keywords: ['cmu', 'masonry', 'wall'],
    ...overrides,
  };
}

describe('DesignBuilderEstimateImportReviewModal', () => {
  beforeEach(() => {
    mocks.commitDesignActivityDrafts.mockReset();
    mocks.commitDesignActivityDrafts.mockResolvedValue({
      data: { bundles: [], committedQuantityItems: [{ id: 'quantity-1' }], importLinks: [] },
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

  it('lets material usages through and blocks unresolved labor usages until a rate or manual override is set', async () => {
    const onCommitted = vi.fn();
    const onClose = vi.fn();
    const activityLine = {
      ...previewLine(),
      id: 'cmu-wall-net-area',
      quantityType: 'cmu_wall_net_area',
      description: 'CMU wall net area',
      quantity: 1587.64,
      unit: 'SF',
    };

    render(
      <DesignBuilderEstimateImportReviewModal
        isOpen
        projectId="project-1"
        estimateId="estimate-1"
        designModelId="model-1"
        previewLines={[previewLine(), activityLine]}
        persistedQuantityItems={[quantityItem()]}
        onClose={onClose}
        onCommitted={onCommitted}
      />,
    );

    const createButton = await screen.findByRole('button', { name: /create activities/i });
    await waitFor(() => expect(screen.getAllByText(/needs rate/i).length).toBeGreaterThan(0));
    expect(screen.queryByPlaceholderText(/search suggested rates/i)).not.toBeInTheDocument();
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

    await waitFor(() => expect(mocks.commitDesignActivityDrafts).toHaveBeenCalled());
    expect(mocks.commitDesignActivityDrafts).toHaveBeenCalledWith(
      expect.objectContaining({
        activities: expect.arrayContaining([
          expect.objectContaining({
            key: '04-masonry-cmu-wall-system',
            usages: expect.arrayContaining([
              expect.objectContaining({
                sourcePreviewLineId: 'cmu-blocks',
                destination: 'material_resource',
              }),
              expect.objectContaining({
                sourcePreviewLineId: 'cmu-wall-net-area',
                destination: 'activity_line_item',
                manualOverride: {
                  manHoursPerUnit: 0.08,
                  reason: 'No approved rate matched the Design Builder unit.',
                  sourceNote: 'Estimator historical production record.',
                },
              }),
            ]),
          }),
        ]),
      }),
    );
    expect(onCommitted).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('does not close from a backdrop click', async () => {
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

    await screen.findByText(/review design builder scope activities/i);
    const backdrop = document.body.querySelector('[role="presentation"][aria-hidden="true"]');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('filters work elements in a single deduped combobox', async () => {
    const onCommitted = vi.fn();
    const onClose = vi.fn();
    const activityLine = {
      ...previewLine(),
      id: 'cmu-wall-net-area',
      quantityType: 'cmu_wall_net_area',
      description: 'CMU wall net area',
      quantity: 1587.64,
      unit: 'SF',
    };
    mocks.useProductionRateLibrary.mockReturnValue({
      rates: [
        productionRate({
          id: 'rate-pumped-a',
          activityName: 'Concrete masonry wall, pumped',
          manHoursPerUnit: 0.08,
        }),
        productionRate({
          id: 'rate-pumped-b',
          activityName: 'Concrete masonry wall, pumped',
          manHoursPerUnit: 0.08,
        }),
        productionRate({
          id: 'rate-direct',
          activityName: 'Concrete masonry wall, direct placement',
          manHoursPerUnit: 0.12,
        }),
      ],
      totalCount: 3,
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

    render(
      <DesignBuilderEstimateImportReviewModal
        isOpen
        projectId="project-1"
        estimateId="estimate-1"
        designModelId="model-1"
        previewLines={[activityLine]}
        persistedQuantityItems={[quantityItem()]}
        onClose={onClose}
        onCommitted={onCommitted}
      />,
    );

    const combo = await screen.findByRole('combobox', {
      name: /select work element for cmu wall net area/i,
    });
    expect(screen.queryByPlaceholderText(/search suggested rates/i)).not.toBeInTheDocument();

    fireEvent.focus(combo);
    fireEvent.change(combo, { target: { value: 'pumped' } });

    await waitFor(() =>
      expect(screen.getAllByRole('option', {
        name: 'Concrete masonry wall, pumped - 0.080 MH/SF',
      })).toHaveLength(1),
    );
    expect(screen.queryByRole('option', {
      name: 'Concrete masonry wall, direct placement - 0.120 MH/SF',
    })).not.toBeInTheDocument();
  });
});
