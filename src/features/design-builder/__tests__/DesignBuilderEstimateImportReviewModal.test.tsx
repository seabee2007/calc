import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DesignBuilderEstimateImportReviewModal from '../ui/DesignBuilderEstimateImportReviewModal';
import type { DesignEstimatePreviewLine, DesignQuantityItem } from '../types';
import {
  SOURCE_DOCUMENT_FULL,
  SOURCE_EDITION,
  type ProductionRateLibraryEntry,
} from '../../estimating/data/productionRates/productionRateTypes';

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

function previewLine(overrides: Partial<DesignEstimatePreviewLine> = {}): DesignEstimatePreviewLine {
  return {
    id: overrides.id ?? 'cmu-blocks',
    designModelId: 'model-1',
    designObjectId: overrides.designObjectId ?? 'wall-1',
    quantityType: overrides.quantityType ?? 'cmu_block_count',
    description: overrides.description ?? 'CMU blocks including waste',
    quantity: overrides.quantity ?? 770,
    unit: overrides.unit ?? 'EA',
    formula: 'formula',
    parameterSnapshot: {},
    source: 'parametric_design_builder',
    confidence: 'calculated_from_parameters',
    divisionCode: overrides.divisionCode ?? '04',
    divisionName: overrides.divisionName ?? 'Masonry',
    ...overrides,
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
    sourceDocumentFull: SOURCE_DOCUMENT_FULL,
    sourceEdition: SOURCE_EDITION,
    referenceNote: 'NTRP reference',
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

  it('defaults added usage source to the selected activity source line', async () => {
    const onCommitted = vi.fn();
    const onClose = vi.fn();
    const referenceLine = previewLine({
      id: 'opening-reference-area',
      designObjectId: 'opening-1',
      quantityType: 'opening_actual_area',
      description: 'Door and window opening area',
      quantity: 42,
      unit: 'SF',
      divisionCode: '08',
      divisionName: 'Openings',
    });
    const concreteLine = previewLine({
      id: 'rc-roof-beams-volume',
      designObjectId: 'frame-1',
      quantityType: 'rc_roof_beams_volume',
      description: 'RC Roof Beams',
      quantity: 9.39,
      unit: 'CY',
      divisionCode: '03',
      divisionName: 'Concrete',
    });

    render(
      <DesignBuilderEstimateImportReviewModal
        isOpen
        projectId="project-1"
        estimateId="estimate-1"
        designModelId="model-1"
        previewLines={[referenceLine, concreteLine]}
        persistedQuantityItems={[]}
        onClose={onClose}
        onCommitted={onCommitted}
      />,
    );

    const addUsageButtons = await screen.findAllByRole('button', { name: /add usage/i });
    fireEvent.click(addUsageButtons[1]);
    const panel = screen.getByText(/add usage to/i).parentElement;
    const sourceSelect = panel?.querySelector('select') as HTMLSelectElement | null;
    expect(sourceSelect?.value).toBe('rc-roof-beams-volume');
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

  it('filters interior slab edge-form dropdown to formwork rates', async () => {
    const onCommitted = vi.fn();
    const onClose = vi.fn();
    const slabLine = previewLine({
      id: 'interior-floor-slab-volume',
      designObjectId: 'slab-1',
      quantityType: 'interior_floor_slab_volume',
      description: 'Interior Floor Slab',
      quantity: 12.5,
      unit: 'CY',
      divisionCode: '03',
      divisionName: 'Concrete',
      parameterSnapshot: {
        interiorFloorSlab: { thicknessMeters: 0.125 },
        interiorFloorSlabPerimeterMeters: 114.052,
      },
    });
    mocks.useProductionRateLibrary.mockReturnValue({
      rates: [
        productionRate({
          id: 'sog-bulkhead-keyway',
          divisionCode: '03',
          divisionName: 'Concrete',
          category: 'Concrete Formwork',
          subcategory: 'Slab on grade forms',
          activityName: 'Slab on grade, bulkhead forms with keyway, wood, 6 inches high, one use',
          description: 'Slab on grade, bulkhead forms with keyway, wood, 6 inches high, one use',
          unitOfMeasure: 'LF',
          manHoursPerUnit: 0.084,
          keywords: ['concrete', 'formwork', 'slab-on-grade', 'bulkhead-forms'],
        }),
        productionRate({
          id: 'sog-edge-forms-7-12',
          divisionCode: '03',
          divisionName: 'Concrete',
          category: 'Concrete Formwork',
          subcategory: 'Slab on grade forms',
          activityName: 'Slab on grade, edge forms, wood, 7 to 12 inches high, one use',
          description: 'Slab on grade, edge forms, wood, 7 to 12 inches high, one use',
          unitOfMeasure: 'LF',
          manHoursPerUnit: 0.071,
          keywords: ['concrete', 'formwork', 'slab-on-grade', 'edge-forms'],
        }),
        productionRate({
          id: 'poured-expansion-joint',
          divisionCode: '03',
          divisionName: 'Concrete',
          category: 'Concrete Joints, Curing & Accessories',
          subcategory: 'Expansion joints',
          activityName: 'Poured expansion joint',
          description: 'Poured expansion joint',
          unitOfMeasure: 'LF',
          manHoursPerUnit: 0.05,
          keywords: ['concrete', 'joint', 'expansion'],
        }),
        productionRate({
          id: 'water-stops',
          divisionCode: '03',
          divisionName: 'Concrete',
          category: 'Concrete Joints, Curing & Accessories',
          subcategory: 'Water stops',
          activityName: 'Water stops',
          description: 'Water stops',
          unitOfMeasure: 'LF',
          manHoursPerUnit: 0.04,
          keywords: ['concrete', 'waterstop'],
        }),
        productionRate({
          id: 'saw-cut-control-joint',
          divisionCode: '03',
          divisionName: 'Concrete',
          category: 'Concrete Joints, Curing & Accessories',
          subcategory: 'Saw cut control joints',
          activityName: 'Saw cut in green concrete',
          description: 'Saw cut in green concrete control joints',
          unitOfMeasure: 'LF',
          manHoursPerUnit: 0.02,
          keywords: ['concrete', 'joint', 'sawcut'],
        }),
        productionRate({
          id: 'backer-rod',
          divisionCode: '03',
          divisionName: 'Concrete',
          category: 'Concrete Joints, Curing & Accessories',
          subcategory: 'Polyethylene, backer rod',
          activityName: 'Polyethylene, backer rod',
          description: 'Polyethylene, backer rod',
          unitOfMeasure: 'LF',
          manHoursPerUnit: 0.01,
          keywords: ['concrete', 'joint', 'backer rod'],
        }),
      ],
      totalCount: 6,
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
        previewLines={[slabLine]}
        persistedQuantityItems={[]}
        onClose={onClose}
        onCommitted={onCommitted}
      />,
    );

    const combo = await screen.findByRole('combobox', {
      name: /select work element for slab edge forms, interior floor slab/i,
    });
    fireEvent.focus(combo);

    expect(await screen.findByRole('option', {
      name: 'Slab on grade, edge forms, wood, 7 to 12 inches high, one use - 0.071 MH/LF',
    })).toBeInTheDocument();
    expect(screen.getByRole('option', {
      name: 'Slab on grade, bulkhead forms with keyway, wood, 6 inches high, one use - 0.084 MH/LF',
    })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Poured expansion joint - 0.050 MH/LF' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Water stops - 0.040 MH/LF' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Saw cut in green concrete - 0.020 MH/LF' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Polyethylene, backer rod - 0.010 MH/LF' })).not.toBeInTheDocument();
  });

  it('filters plaster dropdown to plaster work elements instead of all Division 09 SF rates', async () => {
    const onCommitted = vi.fn();
    const onClose = vi.fn();
    const plasterLine = previewLine({
      id: 'infill-plaster-scratch',
      designObjectId: 'wall-1',
      quantityType: 'infill_plaster_scratch_coat_area',
      description: 'Infill plaster scratch coat area',
      quantity: 860,
      unit: 'SF',
      divisionCode: '09',
      divisionName: 'Finishes',
      parameterSnapshot: {
        plasterSide: 'interior',
        finish: 'scratch coat',
      },
    });
    mocks.useProductionRateLibrary.mockReturnValue({
      rates: [
        productionRate({
          id: 'plaster-scratch-coat',
          divisionCode: '09',
          divisionName: 'Finishes',
          category: 'Plaster & Stucco',
          subcategory: 'Scratch coat',
          activityName: 'Portland cement plaster, scratch coat',
          description: 'Portland cement plaster, scratch coat over masonry',
          unitOfMeasure: 'SF',
          manHoursPerUnit: 0.038,
          keywords: ['plaster', 'scratch coat', 'stucco'],
        }),
        productionRate({
          id: 'plaster-base-coat',
          divisionCode: '09',
          divisionName: 'Finishes',
          category: 'Plaster & Stucco',
          subcategory: 'Base coat',
          activityName: 'Portland cement plaster, base coat',
          description: 'Portland cement plaster, base coat over masonry',
          unitOfMeasure: 'SF',
          manHoursPerUnit: 0.042,
          keywords: ['plaster', 'base coat', 'stucco'],
        }),
        productionRate({
          id: 'gypsum-board',
          divisionCode: '09',
          divisionName: 'Finishes',
          category: 'Gypsum Board',
          subcategory: 'Wallboard',
          activityName: 'Gypsum wallboard, 5/8 inch',
          description: 'Gypsum wallboard, 5/8 inch',
          unitOfMeasure: 'SF',
          manHoursPerUnit: 0.021,
          keywords: ['gypsum', 'wallboard'],
        }),
        productionRate({
          id: 'acoustical-ceiling',
          divisionCode: '09',
          divisionName: 'Finishes',
          category: 'Acoustical Ceilings',
          subcategory: 'Ceiling tile',
          activityName: 'Acoustical ceiling tile',
          description: 'Acoustical ceiling tile',
          unitOfMeasure: 'SF',
          manHoursPerUnit: 0.018,
          keywords: ['ceiling', 'tile'],
        }),
        productionRate({
          id: 'paint-finish-coat',
          divisionCode: '09',
          divisionName: 'Finishes',
          category: 'Painting',
          subcategory: 'Finish coat',
          activityName: 'Latex paint, finish coat',
          description: 'Latex paint, finish coat',
          unitOfMeasure: 'SF',
          manHoursPerUnit: 0.012,
          keywords: ['paint', 'finish coat'],
        }),
      ],
      totalCount: 5,
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
        previewLines={[plasterLine]}
        persistedQuantityItems={[]}
        onClose={onClose}
        onCommitted={onCommitted}
      />,
    );

    const activityHeader = await screen.findByText(/09 Finishes - Plaster/i);
    fireEvent.click(activityHeader.closest('button')!);
    const combo = await screen.findByRole('combobox', {
      name: /select work element for infill plaster scratch coat area/i,
    });
    fireEvent.focus(combo);

    expect(await screen.findByRole('option', {
      name: 'Portland cement plaster, scratch coat - 0.038 MH/SF',
    })).toBeInTheDocument();
    expect(screen.getByRole('option', {
      name: 'Portland cement plaster, base coat - 0.042 MH/SF',
    })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Gypsum wallboard, 5/8 inch - 0.021 MH/SF' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Acoustical ceiling tile - 0.018 MH/SF' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Latex paint, finish coat - 0.012 MH/SF' })).not.toBeInTheDocument();
  });
});
