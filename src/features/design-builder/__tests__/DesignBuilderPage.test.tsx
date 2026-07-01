import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildPresetObjects, createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import { applyAutoFrameLayout } from '../domain/structureActions';
import {
  seedLoadedDesignBuilderTemplate,
} from './designBuilderPageTestHelpers';
import { serializePersistedDesignBuilderState } from '../domain/designBuilderPersistence';
import { generateCmuLayout } from '../geometry/designGeometry';
import { useDesignBuilderSessionStore } from '../state/designBuilderStore';
import DesignBuilderPage from '../ui/DesignBuilderPage';
import { DesignBuilder2DViewTabs } from '../ui/DesignBuilderViewTabs';
import type { DesignBuilderInteractionEvent, MasonryCourseRun } from '../types';

const mocks = vi.hoisted(() => ({
  createDesignModel: vi.fn(),
  upsertDesignModelObjects: vi.fn(),
  findDesignModelByEstimateId: vi.fn(),
  listDesignModelObjects: vi.fn(),
  updateDesignModelMetadata: vi.fn(),
  persistDesignEstimatePreview: vi.fn(),
  commitDesignEstimatePreview: vi.fn(),
  updatePreferences: vi.fn(),
  confirm: vi.fn(),
  plan: vi.fn(),
  viewer: vi.fn(),
}));

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('../../../contexts/ConfirmContext', () => ({
  useConfirm: () => mocks.confirm,
}));

vi.mock('../../../store', () => ({
  usePreferencesStore: (selector?: (state: {
    preferences: Record<string, unknown>;
    updatePreferences: typeof mocks.updatePreferences;
  }) => unknown) => {
    const state = {
      preferences: {
        measurementSystem: 'metric',
        units: 'metric',
        lengthUnit: 'meters',
        volumeUnit: 'cubic_meters',
        soundEnabled: false,
      },
      updatePreferences: mocks.updatePreferences,
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock('../../../services/soundService', () => ({
  soundService: { play: vi.fn(), initialize: vi.fn() },
}));

vi.mock('../ui/DesignBuilderPlanCanvas', () => ({
  default: (props: {
    onInteraction?: (event: DesignBuilderInteractionEvent) => void;
    onManualMasonryPointer?: (event: { kind: 'preview' | 'start' | 'commit' | 'cancel_preview' | 'undo'; planX?: number; planZ?: number }) => void;
    toolMode?: string;
    onComponentPointer?: (event: { phase: 'preview' | 'commit'; xMeters: number; zMeters: number }) => void;
    onSepticTankPointer?: (event: { phase: 'preview' | 'commit'; xMeters: number; zMeters: number; rotationRad: number }) => void;
    onPlumbingPlanPointer?: (event: { phase: 'preview' | 'commit'; xMeters: number; zMeters: number; shiftHeld?: boolean }) => void;
    onPlumbingSelect?: (selection: { kind: 'none' } | { kind: 'fixture'; id: string } | { kind: 'run'; id: string } | { kind: 'run-route-point'; runId: string; pointIndex: number } | { kind: 'fitting'; id: string } | { kind: 'node'; id: string } | { kind: 'equipment'; id: string } | { kind: 'septic-tank'; id: string }) => void;
    plumbingFixtureRotationRad?: number;
    placedComponents?: unknown[];
    designRenderModel?: { rcComponents?: Array<{ type?: string; system?: string; position?: { x?: number; z?: number } }> };
    componentPreview?: unknown;
    openingPreview?: unknown;
    layout?: { nodes: unknown[]; segments: unknown[] };
    manualMasonry?: { enabled: boolean; runs: MasonryCourseRun[]; preview: unknown };
    septicTankPlacementActive?: boolean;
    selectedOpeningId?: string | null;
    selectedObjectType?: string | null;
    selectedSepticTankId?: string | null;
    selectedObjectTreeItemId?: string | null;
    selectedDesignObject?: { kind: string; label: string } | null;
    active2DView?: string;
  }) => {
    mocks.plan(props);
    return <div data-testid="design-builder-plan">Plan layout</div>;
  },
}));

vi.mock('../ui/DesignBuilderViewer', () => ({
  default: (props: {
    onInteraction?: (event: DesignBuilderInteractionEvent) => void;
    toolMode?: string;
    placementPreview?: unknown;
    placedComponents?: unknown[];
    designRenderModel?: { rcComponents?: Array<{ type?: string; system?: string; position?: { x?: number; z?: number } }> };
    selectedObjectType?: string | null;
    selectedObjectTreeItemId?: string | null;
    selectedDesignObject?: { kind: string; label: string } | null;
    geometryResult?: { sourcePath: string; wallSegments: unknown[]; blockCount: number };
  }) => {
    mocks.viewer(props);
    return <div data-testid="design-builder-viewer">Generated preview</div>;
  },
}));

vi.mock('../ui/FrameFoundationDimensionsModal', () => ({
  default: () => null,
}));

vi.mock('../ui/MaterialsColorsModal', () => ({
  default: () => null,
}));

vi.mock('../ui/DesignBuilderEstimateImportReviewModal', () => ({
  default: (props: {
    isOpen: boolean;
    onCommitted: (result: { bundles: unknown[]; committedQuantityItems: Array<{ id: string }> }) => void;
  }) =>
    props.isOpen ? (
      <div role="dialog" aria-label="Review Design Builder Estimate Import">
        <button
          type="button"
          onClick={() => props.onCommitted({ bundles: [], committedQuantityItems: [{ id: 'quantity-1' }] })}
        >
          Create Activities
        </button>
      </div>
    ) : null,
}));

vi.mock('../ui/DraggableDebugOverlay', () => ({
  DraggableDebugOverlay: () => null,
}));

vi.mock('../ui/DebugOverlayLayoutContext', () => ({
  DebugOverlayLayoutProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useDebugOverlayLayout: () => null,
  debugOverlayInitialStyle: () => ({ left: 0, top: 0, opacity: 0 }),
}));

vi.mock('../services/designBuilderService', () => ({
  createDesignModel: mocks.createDesignModel,
  upsertDesignModelObjects: mocks.upsertDesignModelObjects,
  findDesignModelByEstimateId: mocks.findDesignModelByEstimateId,
  listDesignModelObjects: mocks.listDesignModelObjects,
  updateDesignModelMetadata: mocks.updateDesignModelMetadata,
}));

vi.mock('../application/designBuilderToEstimate', () => ({
  persistDesignEstimatePreview: mocks.persistDesignEstimatePreview,
  commitDesignEstimatePreview: mocks.commitDesignEstimatePreview,
}));

function latestViewerProps() {
  const call = mocks.viewer.mock.calls.at(-1);
  return (call?.[0] ?? {}) as {
    onInteraction?: (event: DesignBuilderInteractionEvent) => void;
    toolMode?: string;
    placementPreview?: {
      offsetMeters?: number;
      openingId?: string;
      openingDraft?: { id: string; positionAlongSegment?: number; widthMeters: number };
    } | null;
    selectedOpeningId?: string | null;
    selectedObjectType?: string | null;
    selectedObjectTreeItemId?: string | null;
    selectedDesignObject?: { kind: string; label: string } | null;
    placedComponents?: unknown[];
    designRenderModel?: { rcComponents?: Array<{ type?: string; system?: string; position?: { x?: number; z?: number } }> };
    wall?: { heightMeters?: number; wallThicknessMeters?: number; bondPattern?: string; blockLengthMeters?: number };
    geometryResult?: {
      sourcePath: string;
      wallSegments: Array<{ heightMeters?: number; thicknessMeters?: number }>;
      blockCount: number;
      wallCmuLayout?: {
        courseCount?: number;
        totalBlocks?: number;
        roughOpenings?: Array<{
          id: string;
          actualStartAlongMeters: number;
          actualEndAlongMeters: number;
          roughStartAlongMeters: number;
          roughEndAlongMeters: number;
        }>;
        lintels?: Array<{ lengthMeters: number }>;
      };
      bondPattern?: string;
    };
  };
}

function latestPlanProps() {
  const call = mocks.plan.mock.calls.at(-1);
  return (call?.[0] ?? {}) as {
    onInteraction?: (event: DesignBuilderInteractionEvent) => void;
    onManualMasonryPointer?: (event: { kind: 'preview' | 'start' | 'commit' | 'cancel_preview' | 'undo'; planX?: number; planZ?: number }) => void;
    toolMode?: string;
    onComponentPointer?: (event: { phase: 'preview' | 'commit'; xMeters: number; zMeters: number }) => void;
    onSepticTankPointer?: (event: { phase: 'preview' | 'commit'; xMeters: number; zMeters: number; rotationRad: number }) => void;
    onPlumbingPlanPointer?: (event: { phase: 'preview' | 'commit'; xMeters: number; zMeters: number; shiftHeld?: boolean }) => void;
    onPlumbingSelect?: (selection: { kind: 'none' } | { kind: 'fixture'; id: string } | { kind: 'run'; id: string } | { kind: 'run-route-point'; runId: string; pointIndex: number } | { kind: 'fitting'; id: string } | { kind: 'node'; id: string } | { kind: 'equipment'; id: string } | { kind: 'septic-tank'; id: string }) => void;
    plumbingFixtureRotationRad?: number;
    placedComponents?: unknown[];
    designRenderModel?: { rcComponents?: Array<{ type?: string; system?: string; position?: { x?: number; z?: number } }> };
    componentPreview?: unknown;
    openingPreview?: unknown;
    layout?: { nodes: unknown[]; segments: unknown[]; isFootprintClosed?: boolean };
    manualMasonry?: { enabled: boolean; runs: MasonryCourseRun[]; preview: unknown };
    septicTankPlacementActive?: boolean;
    selectedOpeningId?: string | null;
    selectedObjectType?: string | null;
    selectedSepticTankId?: string | null;
    selectedObjectTreeItemId?: string | null;
    selectedDesignObject?: { kind: string; label: string } | null;
    active2DView?: string;
  };
}

function chooseNewLayout() {
  openMenuByKind('workspace-actions');
  fireEvent.click(screen.getByRole('menuitem', { name: /^new layout$/i }));
}

function expandObjectTreeGroup(label: string) {
  fireEvent.click(screen.getByRole('button', { name: (name) => name === `${label}+` || name === `${label}−` }));
}

function commandBar() {
  return screen.getByRole('toolbar', { name: /design builder command bar/i });
}

function openMenuByKind(kind: string) {
  const menu = commandBar().querySelector(`[data-menu-kind="${kind}"]`);
  if (!menu) throw new Error(`Command menu kind ${kind} not found`);
  fireEvent.click(within(menu as HTMLElement).getByRole('button'));
}

function chooseCommandMenuItem(name: RegExp | string) {
  fireEvent.click(screen.getByRole('menuitem', { name }));
}

function openCommandMenus() {
  return Array.from(document.querySelectorAll('[data-design-builder-command-menu][data-open="true"]'));
}

function selectToolMode(label: RegExp | string) {
  openMenuByKind('tools');
  chooseCommandMenuItem(label);
}

function selectOpeningTool(label: RegExp | string) {
  selectFloorPlan();
  const labelText = String(label).toLowerCase();
  if (labelText.includes('move')) {
    openMenuByKind('tools');
    chooseCommandMenuItem(/move opening/i);
    return;
  }
  openMenuByKind('components');
  chooseCommandMenuItem(labelText.includes('window') ? /^window$/i : /^door$/i);
}

function selectViewMode(mode: 'plan' | '3d') {
  if (mode === '3d') {
    fireEvent.click(screen.getByRole('button', { name: /switch to 3d view/i }));
    return;
  }
  fireEvent.click(screen.getByRole('button', { name: /switch to 2d view/i }));
  const foundationPlan = screen.queryByRole('button', { name: /switch to foundation drawing/i });
  if (foundationPlan) fireEvent.click(foundationPlan);
}

function selectFloorPlan() {
  fireEvent.click(screen.getByRole('button', { name: /switch to 2d view/i }));
  const floorPlan = screen.queryByRole('button', { name: /switch to floor drawing/i });
  if (floorPlan) fireEvent.click(floorPlan);
}

function southWallPlanPoint(positionAlongSegment: number) {
  return { planX: -3 + positionAlongSegment, planZ: -2.5 };
}

const EXISTING_DOOR_PLAN_POINT = southWallPlanPoint(2.4);
const NEW_OPENING_PLAN_POINT = southWallPlanPoint(4.5);
const MOVED_OPENING_PLAN_POINT = { planX: 0, planZ: 2.5 };

function savePreviewButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: /save preview|regenerate preview/i });
}

function commitEstimateButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: /commit to estimate/i });
}

function clickDrawWall() {
  selectToolMode(/^draw wall$/i);
}

function openSnapMenu() {
  openMenuByKind('snap');
}

function openDisplayMenu() {
  openMenuByKind('display');
}

describe('DesignBuilderPage', () => {
  beforeEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    sessionStorage.clear();
    useDesignBuilderSessionStore.setState({ sessions: {} });
    mocks.createDesignModel.mockReset();
    mocks.upsertDesignModelObjects.mockReset();
    mocks.findDesignModelByEstimateId.mockReset();
    mocks.listDesignModelObjects.mockReset();
    mocks.updateDesignModelMetadata.mockReset();
    mocks.persistDesignEstimatePreview.mockReset();
    mocks.commitDesignEstimatePreview.mockReset();
    mocks.updatePreferences.mockReset();
    mocks.updatePreferences.mockResolvedValue(undefined);
    mocks.confirm.mockReset();
    mocks.confirm.mockResolvedValue(true);
    mocks.plan.mockReset();
    mocks.viewer.mockReset();
    mocks.createDesignModel.mockResolvedValue({
      data: {
        id: 'model-1',
        projectId: 'project-1',
        estimateId: 'estimate-1',
        name: '5m x 6m CMU Template',
        unitSystem: 'metric',
        modelType: 'cmu_building',
        status: 'draft',
        createdBy: 'user-1',
        metadata: {},
        createdAt: '',
        updatedAt: '',
      },
      error: null,
    });
    mocks.upsertDesignModelObjects.mockResolvedValue({
      data: [
        { id: 'slab-1', objectType: 'thickened_edge_slab' },
        { id: 'wall-1', objectType: 'cmu_wall_system' },
        { id: 'roof-1', objectType: 'gable_roof_system' },
        { id: 'truss-1', objectType: 'steel_truss_system' },
      ],
      error: null,
    });
    mocks.persistDesignEstimatePreview.mockResolvedValue({
      data: [
        {
          id: 'quantity-1',
          estimateLineId: null,
          metadata: { previewLineId: 'cmu-blocks' },
        },
      ],
      error: null,
    });
    mocks.commitDesignEstimatePreview.mockResolvedValue({
      data: { bundles: [], committedQuantityItems: [{ id: 'quantity-1' }] },
      error: null,
    });
    mocks.findDesignModelByEstimateId.mockResolvedValue({ data: null, error: null });
    mocks.listDesignModelObjects.mockResolvedValue({ data: [], error: null });
    mocks.updateDesignModelMetadata.mockImplementation(async (_id, metadata) => ({
      data: {
        id: 'model-1',
        projectId: 'project-1',
        estimateId: 'estimate-1',
        name: '5m x 6m CMU Template',
        unitSystem: 'metric',
        modelType: 'cmu_building',
        status: 'draft',
        createdBy: 'user-1',
        metadata,
        createdAt: '',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      error: null,
    }));
  });

  it('renders 2D drawing tabs in plan order with cyan active styling', () => {
    render(<DesignBuilder2DViewTabs active2DView="floor-plan" onActive2DViewChange={vi.fn()} />);

    const group = screen.getByRole('group', { name: /switch 2d drawing view/i });
    expect(within(group).getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Foundation',
      'Floor',
      'Roof',
      'Electrical',
      'Plumbing',
      'Elevation',
    ]);

    const floorTab = screen.getByRole('button', { name: /switch to floor drawing/i });
    expect(floorTab).toHaveClass('border-cyan-400');
    expect(floorTab).toHaveClass('bg-cyan-50');
    expect(floorTab).toHaveClass('text-cyan-800');
    expect(floorTab).toHaveClass('dark:border-cyan-600');
  });

  it('loads the preset, saves an estimate preview, and commits only after confirmation', async () => {
    const onEstimateCommitted = vi.fn();
    seedLoadedDesignBuilderTemplate();
    render(
      <DesignBuilderPage
        projectId="project-1"
        estimateId="estimate-1"
        onEstimateCommitted={onEstimateCommitted}
      />,
    );

    expect(screen.getByTestId('design-builder-viewer')).toBeInTheDocument();
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));
    expect(mocks.createDesignModel).not.toHaveBeenCalled();
    expect(commitEstimateButton()).toBeDisabled();

    fireEvent.click(savePreviewButton());
    await waitFor(() => expect(mocks.persistDesignEstimatePreview).toHaveBeenCalled());
    expect(screen.getAllByText(/ready to commit/i).length).toBeGreaterThan(0);
    expect(commitEstimateButton()).not.toBeDisabled();
    expect(mocks.commitDesignEstimatePreview).not.toHaveBeenCalled();

    fireEvent.click(commitEstimateButton());
    expect(screen.getByRole('dialog', { name: /review design builder estimate import/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /create activities/i }));
    expect(onEstimateCommitted).toHaveBeenCalled();
  });

  it('shows live preview rows before saving while commit remains disabled', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);

    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));

    expect(screen.getByText(/live preview/i)).toBeInTheDocument();
    expect(screen.getByText(/review live quantities/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /show preview rows/i })).toBeInTheDocument();
    expect(screen.queryByText(/linked quantities/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/activity source quantities/i)).not.toBeInTheDocument();
    expect(screen.queryAllByText(/calculated from parameters/i)).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: /show preview rows/i }));
    expect(screen.getAllByText(/calculated from parameters/i).length).toBeGreaterThan(0);
    expect(commitEstimateButton()).toBeDisabled();
    expect(mocks.persistDesignEstimatePreview).not.toHaveBeenCalled();
  });

  it('keeps commit disabled when preview persistence fails', async () => {
    mocks.persistDesignEstimatePreview.mockResolvedValueOnce({
      data: null,
      error: 'Could not save estimate preview.',
    });
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);

    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));
    fireEvent.click(savePreviewButton());

    await waitFor(() => expect(screen.getAllByText(/needs attention/i).length).toBeGreaterThan(0));
    expect(screen.getAllByText(/could not save estimate preview/i).length).toBeGreaterThan(0);
    expect(commitEstimateButton()).toBeDisabled();
    expect(mocks.commitDesignEstimatePreview).not.toHaveBeenCalled();
  });

  it('shows an error state when saving preview throws unexpectedly', async () => {
    mocks.persistDesignEstimatePreview.mockRejectedValueOnce(new Error('Preview write exploded.'));
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);

    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));
    fireEvent.click(savePreviewButton());

    await waitFor(() => expect(screen.getAllByText(/needs attention/i).length).toBeGreaterThan(0));
    expect(screen.getAllByText(/preview write exploded/i).length).toBeGreaterThan(0);
    expect(commitEstimateButton()).toBeDisabled();
  });

  it('shows local-only preview state when no design model has been saved', async () => {
    seedLoadedDesignBuilderTemplate('project-1:estimate-1', { designModel: null });
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);

    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));
    fireEvent.click(savePreviewButton());

    await waitFor(() => expect(screen.getAllByText(/local preview/i).length).toBeGreaterThan(0));
    expect(screen.getByText(/local preview saved in this browser/i)).toBeInTheDocument();
    expect(mocks.persistDesignEstimatePreview).not.toHaveBeenCalled();
    expect(commitEstimateButton()).toBeDisabled();
  });

  it('exposes 3D Takeoff-style workspace controls without remounting the model for panel toggles', async () => {
    render(
      <DesignBuilderPage
        projectId="project-1"
        estimateId="estimate-1"
      />,
    );

    expect(screen.getByRole('button', { name: /^actions$/i })).toBeInTheDocument();
    openMenuByKind('workspace-actions');
    expect(screen.getByRole('menuitem', { name: /^tools$/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /^estimate$/i })).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    await waitFor(() => expect(openCommandMenus()).toHaveLength(0));

    expect(screen.queryByRole('button', { name: /^view$/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^display$/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^fit$/i }).length).toBeGreaterThan(0);

    openMenuByKind('workspace-actions');
    fireEvent.click(screen.getByRole('menuitem', { name: /^tools$/i }));
    expect(openCommandMenus()).toHaveLength(0);
    expect(screen.getByRole('button', { name: /^actions$/i })).toBeInTheDocument();
  });

  it('opens with Object Tree groups collapsed by default and persists manual expansion', async () => {
    const rendered = render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);

    expect(screen.queryByRole('button', { name: /cmu walls/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /quantity summary/i })).not.toBeInTheDocument();

    expandObjectTreeGroup('Masonry');
    expect(screen.getByRole('button', { name: /cmu walls/i })).toBeInTheDocument();
    await waitFor(() =>
      expect(useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']?.objectTreeExpanded.masonry).toBe(true),
    );

    rendered.unmount();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);

    expect(screen.getByRole('button', { name: /cmu walls/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /quantity summary/i })).not.toBeInTheDocument();
  });

  it('lists generated below-grade foundation components in the Object Tree', async () => {
    const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
    useDesignBuilderSessionStore.getState().saveSession('project-1:estimate-1', {
      preset,
      layoutState: 'demo_loaded',
      designModel: null,
    });

    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);

    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));
    expandObjectTreeGroup('Foundation');

    const foundationSection = screen
      .getByRole('button', { name: (name) => name === 'Foundation-' || name === 'FoundationÃ¢Ë†â€™' })
      .parentElement;
    expect(foundationSection).not.toBeNull();
    expect(within(foundationSection as HTMLElement).getByRole('button', { name: /^isolated footings$/i })).toBeInTheDocument();
    expect(within(foundationSection as HTMLElement).getByRole('button', { name: /^tie beam$/i })).toBeInTheDocument();
    expect(within(foundationSection as HTMLElement).getByRole('button', { name: /^cmu infill below grade$/i })).toBeInTheDocument();
    expect(within(foundationSection as HTMLElement).getByRole('button', { name: /^plinth beam$/i })).toBeInTheDocument();
    expect(within(foundationSection as HTMLElement).getByRole('button', { name: /sog/i })).toBeInTheDocument();

    const tieBeamRow = within(foundationSection as HTMLElement).getByRole('button', { name: /^tie beam$/i });
    const plinthBeamRow = within(foundationSection as HTMLElement).getByRole('button', { name: /^plinth beam$/i });
    fireEvent.click(tieBeamRow);
    expect(tieBeamRow.className).toContain('bg-cyan');
    expect(plinthBeamRow.className).not.toContain('bg-cyan');
    const foundationBadge = screen
      .getByRole('button', { name: (name) => name === 'Foundation-' || name === 'Foundationâˆ’' })
      .querySelector('span:last-child');
    expect(foundationBadge?.className).toContain('bg-cyan');

    expandObjectTreeGroup('Structure');
    const structureSection = screen.getByRole('button', { name: /structure/i }).parentElement;
    expect(structureSection).not.toBeNull();
    expect(within(structureSection as HTMLElement).queryByRole('button', { name: /^tie beams$/i })).not.toBeInTheDocument();
    expect(within(structureSection as HTMLElement).queryByRole('button', { name: /^plinth beams$/i })).not.toBeInTheDocument();
  });

  it('syncs foundation object selection between the plan canvas and Object Tree', async () => {
    const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
    useDesignBuilderSessionStore.getState().saveSession('project-1:estimate-1', {
      preset,
      layoutState: 'demo_loaded',
      designModel: null,
    });

    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);

    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));
    selectViewMode('plan');
    await waitFor(() => expect(latestPlanProps().onInteraction).toBeTruthy());

    await act(async () => {
      latestPlanProps().onInteraction?.({
        kind: 'select_object',
        toolMode: 'select',
        objectType: 'structural_frame_system',
        objectTreeItemId: 'foundation-tie-beam',
      });
    });

    await waitFor(() => expect(latestPlanProps().selectedObjectTreeItemId).toBe('foundation-tie-beam'));
    expect(latestPlanProps().selectedDesignObject).toMatchObject({
      kind: 'object_tree_item',
      label: 'Tie Beam',
    });

    const foundationSection = screen
      .getByRole('button', { name: (name) => name === 'Foundation-' || name === 'FoundationÃ¢Ë†â€™' })
      .parentElement;
    expect(foundationSection).not.toBeNull();
    const tieBeamRow = within(foundationSection as HTMLElement).getByRole('button', { name: /^tie beam$/i });
    const plinthBeamRow = within(foundationSection as HTMLElement).getByRole('button', { name: /^plinth beam$/i });
    expect(tieBeamRow.className).toContain('bg-cyan');

    fireEvent.click(plinthBeamRow);

    await waitFor(() => expect(latestPlanProps().selectedObjectTreeItemId).toBe('foundation-plinth-beam'));
    expect(latestPlanProps().selectedDesignObject).toMatchObject({
      kind: 'object_tree_item',
      label: 'Plinth Beam',
    });
    expect(plinthBeamRow.className).toContain('bg-cyan');
  });

  it('edits project masonry defaults with no selected wall and uses text-based decimal inputs', async () => {
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);

    expect(screen.getByText('Project Masonry Defaults')).toBeInTheDocument();
    expect(document.querySelector('input[type="number"]')).toBeNull();

    const wallHeight = screen.getByLabelText(/^wall height$/i);
    fireEvent.change(wallHeight, { target: { value: '3.45' } });
    fireEvent.blur(wallHeight);

    await waitFor(() => {
      const session = useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1'];
      expect(session?.preset?.wall.heightMeters).toBeCloseTo(3.45);
      expect(session?.preset?.wallLayout.defaultWallHeightMeters).toBeCloseTo(3.45);
    });
    expect(latestViewerProps().geometryResult?.sourcePath).toBe('blank');
    expect(latestViewerProps().geometryResult?.blockCount).toBe(0);
  });

  it('validates decimal masonry inputs without resetting valid typing', async () => {
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);

    const wallHeight = screen.getByLabelText(/^wall height$/i);
    fireEvent.change(wallHeight, { target: { value: '-1' } });
    fireEvent.blur(wallHeight);

    expect(await screen.findByText(/minimum 0\.1 m/i)).toBeInTheDocument();

    fireEvent.change(wallHeight, { target: { value: '2.95' } });
    fireEvent.blur(wallHeight);

    await waitFor(() =>
      expect(useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']?.preset?.wall.heightMeters).toBeCloseTo(2.95),
    );
    expect(screen.queryByText(/minimum 0\.1 m/i)).not.toBeInTheDocument();
  });

  it('updates 3D geometry when project masonry defaults change after loading the template', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));
    expandObjectTreeGroup('Masonry');
    fireEvent.click(screen.getByRole('button', { name: /^cmu walls$/i }));

    const initialSegments = latestViewerProps().geometryResult?.wallSegments ?? [];
    const initialBlockCount = latestViewerProps().geometryResult?.blockCount ?? 0;
    expect(initialSegments[0]?.heightMeters).toBeCloseTo(2.8, 1);

    const wallHeight = screen.getByLabelText(/^wall height$/i);
    fireEvent.change(wallHeight, { target: { value: '4.2' } });
    fireEvent.blur(wallHeight);

    await waitFor(() => {
      expect(latestViewerProps().geometryResult?.wallSegments?.[0]?.heightMeters).toBeCloseTo(4.2, 1);
      expect(latestViewerProps().geometryResult?.blockCount).toBeGreaterThan(initialBlockCount);
    });

    const blockLength = screen.getByLabelText(/^block length$/i);
    fireEvent.change(blockLength, { target: { value: '0.5' } });
    fireEvent.blur(blockLength);

    await waitFor(() => {
      expect(latestViewerProps().wall?.blockLengthMeters).toBeCloseTo(0.5, 2);
      expect(latestViewerProps().geometryResult?.blockCount).not.toBe(initialBlockCount);
    });

    fireEvent.change(screen.getByLabelText(/^waste$/i), { target: { value: '12' } });
    fireEvent.blur(screen.getByLabelText(/^waste$/i));

    await waitFor(() => {
      expect(useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']?.preset?.wall.wasteFactor).toBeCloseTo(0.12, 3);
      expect(latestViewerProps().geometryResult?.blockCount).toBeGreaterThan(initialBlockCount);
    });
  });

  it('updates bond pattern geometry and lintel bearing when openings exist', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));
    expandObjectTreeGroup('Masonry');
    fireEvent.click(screen.getByRole('button', { name: /^cmu walls$/i }));

    const runningBondCount = latestViewerProps().geometryResult?.blockCount ?? 0;
    fireEvent.change(screen.getByLabelText(/^bond pattern$/i), { target: { value: 'stack_bond' } });

    await waitFor(() => {
      expect(latestViewerProps().geometryResult?.bondPattern).toBe('stack_bond');
      expect(latestViewerProps().geometryResult?.blockCount).not.toBe(runningBondCount);
    });

    const beforeLintelLength = latestViewerProps().geometryResult?.wallCmuLayout?.lintels?.reduce(
      (sum, lintel) => sum + lintel.lengthMeters,
      0,
    ) ?? 0;
    const lintelBearing = screen.getByLabelText(/^lintel bearing$/i);
    fireEvent.change(lintelBearing, { target: { value: '0.35' } });
    fireEvent.blur(lintelBearing);

    await waitFor(() => {
      expect(
        useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']?.preset?.wall.lintelBearingMeters,
      ).toBeCloseTo(0.35, 2);
      const afterLintelLength = latestViewerProps().geometryResult?.wallCmuLayout?.lintels?.reduce(
        (sum, lintel) => sum + lintel.lengthMeters,
        0,
      ) ?? 0;
      expect(afterLintelLength).toBeGreaterThan(beforeLintelLength);
    });
  });

  it('updates selected wall segment fields without changing global masonry defaults', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole('button', { name: /segment 1/i }));
    expect(screen.getByText('Edit Wall Segment')).toBeInTheDocument();

    const wallHeight = screen.getByLabelText(/^wall height$/i);
    fireEvent.change(wallHeight, { target: { value: '3.6' } });
    fireEvent.blur(wallHeight);

    await waitFor(() => {
      const session = useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1'];
      expect(session?.preset?.wallLayout.segments[0]?.wallHeightMeters).toBeCloseTo(3.6);
      expect(session?.preset?.wall.heightMeters).toBeCloseTo(2.8);
    });
  });

  it('shows CMU module rules, fit badges, and expanded wall system rows', async () => {
    seedLoadedDesignBuilderTemplate();
    render(
      <DesignBuilderPage
        projectId="project-1"
        estimateId="estimate-1"
      />,
    );
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole('button', { name: /show preview rows/i }));
    expect(screen.getAllByRole('button', { name: /wall segments/i }).length).toBeGreaterThan(0);
    expandObjectTreeGroup('Masonry');
    expect(screen.getByRole('button', { name: /cmu walls/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^cmu walls$/i }));

    expect(screen.getByText(/cmu module rules/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/block family/i)).toHaveValue('Metric CMU 400 x 200');
    expect(screen.getByText(/modular fit/i)).toBeInTheDocument();
    expect(screen.getByText(/fit:/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/snap building dimensions to cmu module/i)).toBeChecked();
  });

  it('exposes wall layout tools after loading', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));

    expect(screen.queryByRole('button', { name: /activate wall drawing/i })).not.toBeInTheDocument();
    openMenuByKind('tools');
    expect(screen.getByRole('menuitem', { name: /draw wall/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /move node/i })).toBeInTheDocument();
    expect(latestViewerProps().geometryResult?.sourcePath).toBe('layout_graph');
    expect(latestViewerProps().geometryResult?.wallSegments).toHaveLength(4);
  });

  it('dropdown tool items update the canonical viewer tool mode', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));

    selectOpeningTool(/door opening/i);
    await waitFor(() => expect(latestPlanProps().toolMode).toBe('place_door'));
    expect(latestPlanProps().active2DView).toBe('floor-plan');
    expect(openCommandMenus()).toHaveLength(0);
    expect(commandBar().querySelector('[data-menu-kind="openings"]')).not.toBeInTheDocument();

    selectToolMode(/^delete$/i);
    await waitFor(() => expect(latestPlanProps().toolMode).toBe('delete'));

    selectToolMode(/^select$/i);
    await waitFor(() => expect(latestPlanProps().toolMode).toBe('select'));
  });

  it('routes Components Door and Window through existing opening placement tools', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));

    selectFloorPlan();
    openMenuByKind('components');
    chooseCommandMenuItem(/^door$/i);
    await waitFor(() => expect(latestPlanProps().toolMode).toBe('place_door'));
    expect(latestPlanProps().active2DView).toBe('floor-plan');
    expect(latestPlanProps().componentPreview).toBeFalsy();

    openMenuByKind('components');
    chooseCommandMenuItem(/^window$/i);
    await waitFor(() => expect(latestPlanProps().toolMode).toBe('place_window'));
    expect(latestPlanProps().active2DView).toBe('floor-plan');
    expect(latestPlanProps().componentPreview).toBeFalsy();
  });

  it('keeps 3D active when Door is activated there and accepts viewer opening placement', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));
    selectViewMode('3d');
    await waitFor(() => expect(screen.getByTestId('design-builder-viewer')).toBeInTheDocument());

    openMenuByKind('components');
    chooseCommandMenuItem(/^door$/i);
    await waitFor(() => expect(latestViewerProps().toolMode).toBe('place_door'));
    expect(screen.getByTestId('design-builder-viewer')).toBeInTheDocument();
    expect(screen.queryByTestId('design-builder-plan')).not.toBeInTheDocument();

    const wallSegmentId =
      useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']?.preset?.wallLayout.segments[0]?.id;
    expect(wallSegmentId).toBeTruthy();
    await act(async () => {
      latestViewerProps().onInteraction?.({
        kind: 'wall_pick',
        toolMode: 'place_door',
        openingType: 'door',
        wallSegmentId: wallSegmentId!,
        positionAlongSegment: 1.8,
      });
    });
    await waitFor(() => expect(latestViewerProps().placementPreview).toBeTruthy());

    const openingCountBeforeCommit =
      useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']?.preset?.wall.openings.length ?? 0;
    await act(async () => {
      latestViewerProps().onInteraction?.({
        kind: 'place_commit',
        toolMode: 'place_door',
        openingType: 'door',
        wallSegmentId: wallSegmentId!,
        positionAlongSegment: 1.8,
      });
    });

    await waitFor(() =>
      expect(useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']?.preset?.wall.openings).toHaveLength(
        openingCountBeforeCommit + 1,
      ),
    );
  });

  it('activating Door and Window from Foundation switches to Floor Plan', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));

    selectViewMode('plan');
    await waitFor(() => expect(latestPlanProps().active2DView).toBe('foundation-plan'));

    openMenuByKind('components');
    chooseCommandMenuItem(/^door$/i);
    await waitFor(() => expect(latestPlanProps().toolMode).toBe('place_door'));
    expect(latestPlanProps().active2DView).toBe('floor-plan');

    fireEvent.click(screen.getByRole('button', { name: /switch to foundation drawing/i }));
    await waitFor(() => expect(latestPlanProps().active2DView).toBe('foundation-plan'));
    openMenuByKind('components');
    chooseCommandMenuItem(/^window$/i);
    await waitFor(() => expect(latestPlanProps().toolMode).toBe('place_window'));
    expect(latestPlanProps().active2DView).toBe('floor-plan');
  });

  it('defaults Draw Wall to partition only on a closed Floor Plan', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));

    selectViewMode('plan');
    fireEvent.click(screen.getByRole('button', { name: /switch to floor drawing/i }));
    await waitFor(() => expect(latestPlanProps().active2DView).toBe('floor-plan'));

    selectToolMode(/^draw wall$/i);
    await waitFor(() => expect(latestPlanProps().toolMode).toBe('draw_wall'));
    expect(latestPlanProps().active2DView).toBe('floor-plan');
    expect(screen.getByLabelText(/^wall type$/i)).toHaveValue('partition');
  });

  it('keeps Draw Wall exterior by default for blank or open footprints', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));

    chooseNewLayout();
    await waitFor(() => expect(latestPlanProps().layout?.segments).toHaveLength(0));
    await waitFor(() => expect(latestPlanProps().active2DView).toBe('foundation-plan'));

    selectToolMode(/^draw wall$/i);
    await waitFor(() => expect(latestPlanProps().toolMode).toBe('draw_wall'));
    expect(latestPlanProps().active2DView).toBe('floor-plan');
    expect(screen.getByLabelText(/^wall type$/i)).toHaveValue('exterior');
  });

  it('previews a structural component before commit and syncs the placed component into 3D', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));

    openMenuByKind('components');
    chooseCommandMenuItem(/^column$/i);
    await waitFor(() => expect(latestPlanProps().toolMode).toBe('place_component'));

    await act(async () => {
      latestPlanProps().onComponentPointer?.({ phase: 'preview', xMeters: 1.24, zMeters: -0.76 });
    });
    await waitFor(() => expect(latestPlanProps().componentPreview).toBeTruthy());
    expect((latestPlanProps().placedComponents ?? [])).toHaveLength(0);

    await act(async () => {
      latestPlanProps().onComponentPointer?.({ phase: 'commit', xMeters: 1.24, zMeters: -0.76 });
    });
    await waitFor(() => expect((latestPlanProps().placedComponents ?? []).length).toBeGreaterThan(0));
    expect(latestPlanProps().componentPreview).toBeFalsy();
    expect(latestPlanProps().designRenderModel?.rcComponents?.[0]).toMatchObject({
      type: 'column',
      system: 'reinforced-concrete',
      position: { x: 1.2, z: -0.8 },
    });

    fireEvent.click(screen.getByRole('button', { name: /switch to 3d view/i }));
    await waitFor(() => expect(screen.getByTestId('design-builder-viewer')).toBeInTheDocument());
    expect(latestViewerProps().toolMode).toBe('select');
    expect((latestViewerProps().placedComponents ?? []).length).toBeGreaterThan(0);
    expect(latestViewerProps().designRenderModel?.rcComponents?.[0]).toMatchObject({
      type: 'column',
      system: 'reinforced-concrete',
      position: { x: 1.2, z: -0.8 },
    });
  });

  it('keeps side panels collapsed while placing and selecting a CMU septic tank', async () => {
    seedLoadedDesignBuilderTemplate();
    useDesignBuilderSessionStore.getState().saveSession('project-1:estimate-1', {
      leftPanelCollapsed: true,
      rightPanelCollapsed: true,
    });

    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));

    openMenuByKind('components');
    chooseCommandMenuItem(/^CMU Septic Tank$/i);
    await waitFor(() => expect(latestPlanProps().septicTankPlacementActive).toBe(true));

    await waitFor(() => {
      const session = useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1'];
      expect(session?.leftPanelCollapsed).toBe(true);
      expect(session?.rightPanelCollapsed).toBe(true);
    });

    await act(async () => {
      latestPlanProps().onSepticTankPointer?.({
        phase: 'commit',
        xMeters: 1.5,
        zMeters: 2,
        rotationRad: 0,
      });
    });

    await waitFor(() => {
      const session = useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1'];
      expect(session?.plumbingSystem.septicTanks).toHaveLength(1);
      expect(session?.leftPanelCollapsed).toBe(true);
      expect(session?.rightPanelCollapsed).toBe(true);
    });
    await waitFor(() => {
      expect(latestPlanProps().selectedSepticTankId).toBe(
        useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']?.plumbingSystem.septicTanks[0]?.id,
      );
    });
  });

  it('rotates the selected plumbing fixture by 90 degrees from the plumbing inspector', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole('button', { name: /switch to 2d view/i }));
    fireEvent.click(screen.getByRole('button', { name: /switch to plumbing drawing/i }));

    await act(async () => {
      latestPlanProps().onPlumbingFixturePointer?.({ phase: 'commit', xMeters: 1, zMeters: 1 });
    });
    await waitFor(() => {
      expect(useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']?.plumbingSystem.fixtures).toHaveLength(1);
    });
    fireEvent.click(screen.getByRole('button', { name: /collapse fixture schedule/i }));
    expect(screen.getByRole('button', { name: /open fixture schedule/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /open fixture schedule/i }));
    expect(screen.getByRole('button', { name: /collapse fixture schedule/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /open plumbing legend/i }));
    expect(screen.getByText(/cold water supply/i)).toBeInTheDocument();
    expect(screen.getByText(/sanitary waste line/i)).toBeInTheDocument();

    const fixtureId = useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']!.plumbingSystem.fixtures[0]!.id;
    await act(async () => {
      latestPlanProps().onPlumbingSelect?.({ kind: 'fixture', id: fixtureId });
    });

    const commandBar = within(screen.getByRole('toolbar', { name: /design builder command bar/i }));
    expect(commandBar.queryByRole('button', { name: /rotate selected fixture/i })).not.toBeInTheDocument();

    const rotateClockwise = screen.getByRole('button', { name: /^rotate fixture clockwise 90 degrees$/i });
    const rotateCounterClockwise = screen.getByRole('button', { name: /^rotate fixture counterclockwise 90 degrees$/i });
    await waitFor(() => expect(rotateClockwise).toBeEnabled());

    fireEvent.click(rotateClockwise);
    await waitFor(() => {
      const fixture = useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']?.plumbingSystem.fixtures[0];
      expect(fixture?.rotationRadians).toBeCloseTo(Math.PI / 2);
    });

    fireEvent.click(rotateCounterClockwise);
    await waitFor(() => {
      const fixture = useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']?.plumbingSystem.fixtures[0];
      expect(fixture?.rotationRadians).toBeCloseTo(0);
    });
  });

  it('shows plumbing fixture context row and fixture defaults inspector', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole('button', { name: /switch to 2d view/i }));
    fireEvent.click(screen.getByRole('button', { name: /switch to plumbing drawing/i }));

    fireEvent.click(screen.getByRole('button', { name: /^fixture$/i }));

    expect(screen.getByText(/^Fixture Defaults$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^WC$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Lav$/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^rotation$/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^rotate fixture preview clockwise 90 degrees$/i })).toBeInTheDocument();
    expect(screen.getByText(/Fixture Tool - WC selected - Press R to rotate - Click to place/i)).toBeInTheDocument();
  });

  it('rotates plumbing fixture preview before placement from the inspector and R key', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole('button', { name: /switch to 2d view/i }));
    fireEvent.click(screen.getByRole('button', { name: /switch to plumbing drawing/i }));
    fireEvent.click(screen.getByRole('button', { name: /^fixture$/i }));

    fireEvent.click(screen.getByRole('button', { name: /^rotate fixture preview clockwise 90 degrees$/i }));
    await waitFor(() => expect(latestPlanProps().plumbingFixtureRotationRad).toBeCloseTo(Math.PI / 2));

    fireEvent.keyDown(window, { key: 'r' });
    await waitFor(() => expect(latestPlanProps().plumbingFixtureRotationRad).toBeCloseTo(Math.PI));

    await act(async () => {
      latestPlanProps().onPlumbingFixturePointer?.({ phase: 'commit', xMeters: 1, zMeters: 1 });
    });

    await waitFor(() => {
      const fixture = useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']?.plumbingSystem.fixtures[0];
      expect(fixture?.rotationRadians).toBeCloseTo(Math.PI);
    });
  });

  it('shows plumbing pipe context row and pipe defaults inspector', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole('button', { name: /switch to 2d view/i }));
    fireEvent.click(screen.getByRole('button', { name: /switch to plumbing drawing/i }));

    fireEvent.click(screen.getByRole('button', { name: /^pipe$/i }));

    expect(screen.getByText(/^Pipe Defaults$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Sanitary$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Vent$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Cold Water$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Hot Water$/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue('SCH 40')).toBeInTheDocument();
    expect(screen.getByLabelText(/pipe length/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('10 ft stick')).toBeInTheDocument();
    expect(screen.getByText(/Pipe Tool - Sanitary - Click start node, route points, then end node - Shift snaps angle - Esc finishes/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Cold Water$/i }));
    expect(screen.getByDisplayValue('100 ft coil')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /^10 ft stick$/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /^20 ft stick$/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /^300 ft coil$/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /^1000 ft coil$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Drop Ear Elbow/i })).toBeInTheDocument();
  });

  it('shift-snaps plumbing run points and finishes the visible draft on Escape', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole('button', { name: /switch to 2d view/i }));
    fireEvent.click(screen.getByRole('button', { name: /switch to plumbing drawing/i }));

    await act(async () => {
      latestPlanProps().onPlumbingFixturePointer?.({ phase: 'commit', xMeters: 1, zMeters: 1 });
    });
    await waitFor(() => {
      expect(useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']?.plumbingSystem.fixtures).toHaveLength(1);
    });

    fireEvent.click(screen.getByRole('button', { name: /^pipe$/i }));
    const startNode = useDesignBuilderSessionStore
      .getState()
      .sessions['project-1:estimate-1']!
      .plumbingSystem.nodes.find((node) => node.system === 'sanitary' && node.fixtureId);
    expect(startNode).toBeTruthy();

    await act(async () => {
      latestPlanProps().onPlumbingPlanPointer?.({
        phase: 'commit',
        xMeters: startNode!.position.x,
        zMeters: startNode!.position.z,
      });
    });

    await act(async () => {
      latestPlanProps().onPlumbingPlanPointer?.({
        phase: 'commit',
        xMeters: startNode!.position.x + 1,
        zMeters: startNode!.position.z + 0.58,
        shiftHeld: true,
      });
    });
    await act(async () => {
      latestPlanProps().onPlumbingPlanPointer?.({
        phase: 'preview',
        xMeters: startNode!.position.x + 2,
        zMeters: startNode!.position.z + 1.16,
        shiftHeld: true,
      });
    });
    await waitFor(() => {
      const draft = useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']?.plumbingSystem.runs;
      expect(draft).toHaveLength(0);
    });

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      const run = useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']?.plumbingSystem.runs[0];
      expect(run).toBeTruthy();
      expect(run).toMatchObject({
        system: 'sanitary',
        diameterInches: 3,
        material: 'pvc',
        schedule: 'SCH 40',
        slopeInPerFt: 0.25,
        labelVisible: true,
      });
      expect(run!.path).toHaveLength(3);
      const end = run!.path.at(-1)!;
      expect(end.x).toBeGreaterThan(startNode!.position.x + 1.5);
      const angle = ((Math.atan2(end.z - startNode!.position.z, end.x - startNode!.position.x) * 180) / Math.PI + 360) % 360;
      expect(angle).toBeCloseTo(30, 0);
    });
  });

  it('snaps sanitary branches to existing pipe runs with a wye fitting', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole('button', { name: /switch to 2d view/i }));
    fireEvent.click(screen.getByRole('button', { name: /switch to plumbing drawing/i }));

    await act(async () => {
      latestPlanProps().onPlumbingFixturePointer?.({ phase: 'commit', xMeters: 1, zMeters: 1 });
    });
    await waitFor(() => {
      expect(useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']?.plumbingSystem.fixtures).toHaveLength(1);
    });
    await act(async () => {
      latestPlanProps().onPlumbingFixturePointer?.({ phase: 'commit', xMeters: 1, zMeters: 3 });
    });
    await waitFor(() => {
      expect(useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']?.plumbingSystem.fixtures).toHaveLength(2);
    });

    const sanitaryNodes = useDesignBuilderSessionStore
      .getState()
      .sessions['project-1:estimate-1']!
      .plumbingSystem.nodes.filter((node) => node.system === 'sanitary' && node.fixtureId)
      .sort((a, b) => a.position.z - b.position.z);
    const mainStart = sanitaryNodes[0]!;
    const branchStart = sanitaryNodes[1]!;
    const mainEnd = { x: mainStart.position.x + 4, z: mainStart.position.z };
    const branchTieIn = { x: mainStart.position.x + 2, z: mainStart.position.z };

    fireEvent.click(screen.getByRole('button', { name: /^pipe$/i }));
    await act(async () => {
      latestPlanProps().onPlumbingPlanPointer?.({
        phase: 'commit',
        xMeters: mainStart.position.x,
        zMeters: mainStart.position.z,
      });
    });
    await act(async () => {
      latestPlanProps().onPlumbingPlanPointer?.({
        phase: 'preview',
        xMeters: mainEnd.x,
        zMeters: mainEnd.z,
      });
    });
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']?.plumbingSystem.runs).toHaveLength(1);
    });

    fireEvent.click(screen.getByRole('button', { name: /^pipe$/i }));
    await act(async () => {
      latestPlanProps().onPlumbingPlanPointer?.({
        phase: 'commit',
        xMeters: branchStart.position.x,
        zMeters: branchStart.position.z,
      });
    });
    await act(async () => {
      latestPlanProps().onPlumbingPlanPointer?.({
        phase: 'commit',
        xMeters: branchTieIn.x,
        zMeters: branchTieIn.z + 0.03,
      });
    });

    await waitFor(() => {
      const plumbingSystem = useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']!.plumbingSystem;
      const wye = plumbingSystem.nodes.find((node) => node.kind === 'wye');
      expect(wye).toBeTruthy();
      expect(Math.hypot(wye!.position.x - branchTieIn.x, wye!.position.z - branchTieIn.z)).toBeLessThan(0.05);
      expect(plumbingSystem.runs).toHaveLength(4);
      expect(plumbingSystem.roughIns).toHaveLength(1);
      expect(plumbingSystem.roughIns[0]).toMatchObject({ fixtureId: branchStart.fixtureId, tapNodeId: wye?.id });
      expect(plumbingSystem.runs.some((run) => run.startNodeId === branchStart.id || run.endNodeId === branchStart.id)).toBe(false);
      expect(plumbingSystem.runs.filter((run) => run.startNodeId === wye?.id || run.endNodeId === wye?.id)).toHaveLength(3);
      expect(plumbingSystem.fittings.some((fitting) => fitting.type === 'wye' && fitting.nodeId === wye?.id)).toBe(true);
      expect(plumbingSystem.fittings.some((fitting) => fitting.type === 'closet_bend')).toBe(true);
    });
  });

  it('connects a selected fixture to a run with a model-backed rough-in assembly', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole('button', { name: /switch to 2d view/i }));
    fireEvent.click(screen.getByRole('button', { name: /switch to plumbing drawing/i }));

    await act(async () => {
      latestPlanProps().onPlumbingFixturePointer?.({ phase: 'commit', xMeters: 1, zMeters: 1 });
      latestPlanProps().onPlumbingFixturePointer?.({ phase: 'commit', xMeters: 4, zMeters: 1 });
    });
    await waitFor(() => {
      expect(useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']?.plumbingSystem.fixtures).toHaveLength(2);
    });

    let plumbingSystem = useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']!.plumbingSystem;
    const sanitaryNodes = plumbingSystem.nodes.filter((node) => node.system === 'sanitary' && node.fixtureId);
    fireEvent.click(screen.getByRole('button', { name: /^pipe$/i }));
    await act(async () => {
      latestPlanProps().onPlumbingPlanPointer?.({
        phase: 'commit',
        xMeters: sanitaryNodes[0]!.position.x,
        zMeters: sanitaryNodes[0]!.position.z,
      });
    });
    await act(async () => {
      latestPlanProps().onPlumbingPlanPointer?.({
        phase: 'commit',
        xMeters: sanitaryNodes[1]!.position.x,
        zMeters: sanitaryNodes[1]!.position.z,
      });
    });
    await waitFor(() => {
      expect(useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']?.plumbingSystem.runs).toHaveLength(1);
    });

    plumbingSystem = useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']!.plumbingSystem;
    await act(async () => {
      latestPlanProps().onPlumbingSelect?.({ kind: 'fixture', id: plumbingSystem.fixtures[0]!.id });
    });
    fireEvent.click(screen.getByRole('button', { name: /^Connect Fixture$/i }));

    const run = plumbingSystem.runs[0]!;
    const midpoint = {
      x: (run.path[0]!.x + run.path[1]!.x) / 2,
      z: (run.path[0]!.z + run.path[1]!.z) / 2,
    };
    await act(async () => {
      latestPlanProps().onPlumbingPlanPointer?.({ phase: 'commit', xMeters: midpoint.x, zMeters: midpoint.z });
    });

    await waitFor(() => {
      const next = useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']!.plumbingSystem;
      expect(next.roughIns).toHaveLength(1);
      expect(next.runs.some((item) => item.id === next.roughIns[0]!.riserRunId && item.elevationMode === 'vertical')).toBe(true);
      expect(next.fittings.some((item) => item.type === 'closet_flange')).toBe(true);
    });
  });

  it('auto-generates a WC sweep and stub-up when drawing a sanitary pipe to a fixture', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole('button', { name: /switch to 2d view/i }));
    fireEvent.click(screen.getByRole('button', { name: /switch to plumbing drawing/i }));

    await act(async () => {
      latestPlanProps().onPlumbingFixturePointer?.({ phase: 'commit', xMeters: 1, zMeters: 1 });
      latestPlanProps().onPlumbingFixturePointer?.({ phase: 'commit', xMeters: 4, zMeters: 1 });
      latestPlanProps().onPlumbingFixturePointer?.({ phase: 'commit', xMeters: 2.5, zMeters: 2.2 });
    });
    await waitFor(() => {
      expect(useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']?.plumbingSystem.fixtures).toHaveLength(3);
    });

    let plumbingSystem = useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']!.plumbingSystem;
    const sanitaryNodes = plumbingSystem.nodes.filter((node) => node.system === 'sanitary' && node.fixtureId);
    fireEvent.click(screen.getByRole('button', { name: /^pipe$/i }));
    await act(async () => {
      latestPlanProps().onPlumbingPlanPointer?.({
        phase: 'commit',
        xMeters: sanitaryNodes[0]!.position.x,
        zMeters: sanitaryNodes[0]!.position.z,
      });
    });
    await act(async () => {
      latestPlanProps().onPlumbingPlanPointer?.({
        phase: 'commit',
        xMeters: sanitaryNodes[1]!.position.x,
        zMeters: sanitaryNodes[1]!.position.z,
      });
    });
    await waitFor(() => {
      expect(useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']?.plumbingSystem.runs).toHaveLength(1);
    });

    plumbingSystem = useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']!.plumbingSystem;
    const mainRun = plumbingSystem.runs[0]!;
    const fixtureNode = sanitaryNodes[2]!;
    const midpoint = {
      x: (mainRun.path[0]!.x + mainRun.path[1]!.x) / 2,
      z: (mainRun.path[0]!.z + mainRun.path[1]!.z) / 2,
    };
    await act(async () => {
      latestPlanProps().onPlumbingPlanPointer?.({ phase: 'commit', xMeters: midpoint.x, zMeters: midpoint.z });
    });
    await act(async () => {
      latestPlanProps().onPlumbingPlanPointer?.({
        phase: 'commit',
        xMeters: fixtureNode.position.x,
        zMeters: fixtureNode.position.z,
      });
    });

    await waitFor(() => {
      const next = useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']!.plumbingSystem;
      expect(next.roughIns).toHaveLength(1);
      const roughIn = next.roughIns[0]!;
      expect(roughIn.fixtureId).toBe(fixtureNode.fixtureId);
      expect(next.runs.some((item) => item.id === roughIn.riserRunId && item.elevationMode === 'vertical')).toBe(true);
      expect(next.fittings.some((item) => item.type === 'closet_bend' && roughIn.fittingIds.includes(item.id))).toBe(true);
      expect(next.fittings.some((item) => item.type === 'closet_flange' && roughIn.fittingIds.includes(item.id))).toBe(true);
      expect(next.runs.some((run) => run.startNodeId === fixtureNode.id || run.endNodeId === fixtureNode.id)).toBe(false);
    });
  });

  it('edits selected plumbing pipe properties from the inspector', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole('button', { name: /switch to 2d view/i }));
    fireEvent.click(screen.getByRole('button', { name: /switch to plumbing drawing/i }));

    await act(async () => {
      latestPlanProps().onPlumbingFixturePointer?.({ phase: 'commit', xMeters: 1, zMeters: 1 });
    });
    await waitFor(() => {
      expect(useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']?.plumbingSystem.fixtures).toHaveLength(1);
    });
    await act(async () => {
      latestPlanProps().onPlumbingFixturePointer?.({ phase: 'commit', xMeters: 3, zMeters: 1 });
    });
    await waitFor(() => {
      expect(useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']?.plumbingSystem.fixtures).toHaveLength(2);
    });

    const session = useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']!;
    const sanitaryNodes = session.plumbingSystem.nodes.filter((node) => node.system === 'sanitary' && node.fixtureId);
    expect(sanitaryNodes).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: /^pipe$/i }));
    await act(async () => {
      latestPlanProps().onPlumbingPlanPointer?.({
        phase: 'commit',
        xMeters: sanitaryNodes[0]!.position.x,
        zMeters: sanitaryNodes[0]!.position.z,
      });
    });
    await act(async () => {
      latestPlanProps().onPlumbingPlanPointer?.({
        phase: 'commit',
        xMeters: sanitaryNodes[1]!.position.x,
        zMeters: sanitaryNodes[1]!.position.z,
      });
    });

    await waitFor(() => {
      expect(useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']?.plumbingSystem.runs).toHaveLength(1);
    });
    const runId = useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']!.plumbingSystem.runs[0]!.id;

    await act(async () => {
      latestPlanProps().onPlumbingSelect?.({ kind: 'run', id: runId });
    });

    expect(screen.getByText(/^Pipe Properties$/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/diameter in\./i), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText(/^schedule$/i), { target: { value: 'SCH 80' } });
    fireEvent.change(screen.getByLabelText(/slope in\/ft/i), { target: { value: '0.125' } });
    fireEvent.click(screen.getByLabelText(/show label/i));

    await waitFor(() => {
      const run = useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']?.plumbingSystem.runs[0];
      expect(run).toMatchObject({
        diameterInches: 4,
        schedule: 'SCH 80',
        slopeInPerFt: 0.125,
        labelVisible: false,
      });
    });
  });

  it('deletes selected plumbing equipment and septic tanks from the inspector', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole('button', { name: /switch to 2d view/i }));
    fireEvent.click(screen.getByRole('button', { name: /switch to plumbing drawing/i }));

    await act(async () => {
      latestPlanProps().onPlumbingFixturePointer?.({ phase: 'commit', xMeters: 0, zMeters: 0 });
      latestPlanProps().onPlumbingFixturePointer?.({ phase: 'commit', xMeters: 3, zMeters: 0 });
    });
    let plumbingSystem = useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']!.plumbingSystem;
    let sanitaryNodes = plumbingSystem.nodes.filter((node) => node.system === 'sanitary');
    expect(sanitaryNodes.length).toBeGreaterThanOrEqual(2);

    fireEvent.click(screen.getByRole('button', { name: /^pipe$/i }));
    await act(async () => {
      latestPlanProps().onPlumbingPlanPointer?.({
        phase: 'commit',
        xMeters: sanitaryNodes[0]!.position.x,
        zMeters: sanitaryNodes[0]!.position.z,
      });
    });
    await act(async () => {
      latestPlanProps().onPlumbingPlanPointer?.({
        phase: 'commit',
        xMeters: sanitaryNodes[1]!.position.x,
        zMeters: sanitaryNodes[1]!.position.z,
      });
    });
    await waitFor(() => {
      expect(useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']?.plumbingSystem.runs).toHaveLength(1);
    });
    plumbingSystem = useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']!.plumbingSystem;
    sanitaryNodes = plumbingSystem.nodes.filter((node) => node.system === 'sanitary');
    const midpoint = {
      x: (sanitaryNodes[0]!.position.x + sanitaryNodes[1]!.position.x) / 2,
      z: (sanitaryNodes[0]!.position.z + sanitaryNodes[1]!.position.z) / 2,
    };

    fireEvent.change(screen.getByLabelText(/plumbing action menu/i), { target: { value: 'cleanout' } });
    await act(async () => {
      latestPlanProps().onPlumbingPlanPointer?.({ phase: 'commit', xMeters: midpoint.x, zMeters: midpoint.z });
    });
    await waitFor(() => {
      expect(useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']?.plumbingSystem.equipment).toHaveLength(1);
    });
    const equipmentId = useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']!.plumbingSystem.equipment[0]!.id;

    await act(async () => {
      latestPlanProps().onPlumbingSelect?.({ kind: 'equipment', id: equipmentId });
    });
    expect(screen.getByText(/^Equipment Properties$/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    await waitFor(() => {
      expect(useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']?.plumbingSystem.equipment).toHaveLength(0);
    });

    openMenuByKind('components');
    chooseCommandMenuItem(/^CMU Septic Tank$/i);
    await waitFor(() => expect(latestPlanProps().septicTankPlacementActive).toBe(true));
    await act(async () => {
      latestPlanProps().onSepticTankPointer?.({
        phase: 'commit',
        xMeters: 2,
        zMeters: 2,
        rotationRad: 0,
      });
    });
    await waitFor(() => {
      expect(useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']?.plumbingSystem.septicTanks).toHaveLength(1);
    });

    expect(screen.getByText(/^Septic Tank$/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    await waitFor(() => {
      expect(useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']?.plumbingSystem.septicTanks).toHaveLength(0);
    });
  });

  it('renders one command bar without duplicate save, close footprint, or cut-block chips', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));
    const commandBar = within(screen.getByRole('toolbar', { name: /design builder command bar/i }));

    expect(commandBar.getAllByRole('button', { name: /save design/i })).toHaveLength(1);
    expect(commandBar.queryAllByRole('button', { name: /close footprint/i })).toHaveLength(0);
    expect(commandBar.queryAllByText(/cut-block condition/i).length).toBe(0);
  });

  it('selects objects once and clears selection from empty canvas or ESC', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));

    await act(async () => {
      latestViewerProps().onInteraction?.({
        kind: 'select_object',
        toolMode: 'select',
        objectType: 'cmu_wall_system',
      });
    });
    await waitFor(() => expect(latestViewerProps().selectedObjectType).toBe('cmu_wall_system'));

    await act(async () => {
      latestViewerProps().onInteraction?.({ kind: 'clear_selection', toolMode: 'select' });
    });
    await waitFor(() => expect(latestViewerProps().selectedObjectType).toBeNull());

    expandObjectTreeGroup('Masonry');
    fireEvent.click(screen.getByRole('button', { name: /^cmu walls$/i }));
    await waitFor(() => expect(latestViewerProps().selectedObjectType).toBe('cmu_wall_system'));

    await act(async () => {
      latestViewerProps().onInteraction?.({ kind: 'cancel', toolMode: 'select' });
    });
    await waitFor(() => expect(latestViewerProps().selectedObjectType).toBeNull());
  });

  it('draws connected wall segments, stops with ESC, and undoes the last segment', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));
    chooseNewLayout();
    await waitFor(() => expect(latestPlanProps().layout?.segments).toHaveLength(0));
    clickDrawWall();
    expect(screen.getByTestId('design-builder-plan')).toBeInTheDocument();

    await act(async () => {
      latestPlanProps().onInteraction?.({ kind: 'draw_point', toolMode: 'draw_wall', planX: 0, planZ: 0 });
    });
    await act(async () => {
      latestPlanProps().onInteraction?.({ kind: 'draw_point', toolMode: 'draw_wall', planX: 5, planZ: 0 });
    });
    await waitFor(() => expect(latestPlanProps().layout?.segments).toHaveLength(1));
    await act(async () => {
      latestPlanProps().onInteraction?.({ kind: 'draw_point', toolMode: 'draw_wall', planX: 5, planZ: 4, altHeld: true });
    });
    await waitFor(() => expect(latestPlanProps().layout?.segments).toHaveLength(2));
    await act(async () => {
      latestPlanProps().onInteraction?.({ kind: 'undo_last_segment', toolMode: 'draw_wall' });
    });
    await waitFor(() => expect(latestPlanProps().layout?.segments).toHaveLength(1));
    expect(latestPlanProps().toolMode).toBe('draw_wall');
    await act(async () => {
      latestPlanProps().onInteraction?.({ kind: 'draw_point', toolMode: 'draw_wall', planX: 5, planZ: 4, altHeld: true });
    });
    await waitFor(() => expect(latestPlanProps().layout?.segments).toHaveLength(2));
    await act(async () => {
      latestPlanProps().onInteraction?.({ kind: 'draw_point', toolMode: 'draw_wall', planX: 1.5, planZ: 2.2, altHeld: true });
    });
    await waitFor(() => expect(latestPlanProps().layout?.segments).toHaveLength(3));
    selectViewMode('3d');
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments).toHaveLength(3));
    selectViewMode('plan');

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(latestPlanProps().toolMode).toBe('select'));
    expect(latestPlanProps().layout?.segments).toHaveLength(3);
  });

  it('clears Draw Wall command state when switching tools and starts clean on return', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));
    chooseNewLayout();
    await waitFor(() => expect(latestPlanProps().layout?.segments).toHaveLength(0));
    clickDrawWall();

    await act(async () => {
      latestPlanProps().onInteraction?.({ kind: 'draw_point', toolMode: 'draw_wall', planX: 0, planZ: 0 });
    });
    await act(async () => {
      latestPlanProps().onInteraction?.({ kind: 'draw_point', toolMode: 'draw_wall', planX: 5, planZ: 0 });
    });
    await waitFor(() => expect(latestPlanProps().layout?.segments).toHaveLength(1));

    selectToolMode(/^select$/i);
    await waitFor(() => expect(latestPlanProps().toolMode).toBe('select'));
    clickDrawWall();
    await waitFor(() => expect(latestPlanProps().toolMode).toBe('draw_wall'));

    await act(async () => {
      latestPlanProps().onInteraction?.({ kind: 'draw_point', toolMode: 'draw_wall', planX: 2, planZ: 2, altHeld: true });
    });

    await waitFor(() => {
      expect(latestPlanProps().layout?.segments).toHaveLength(1);
      expect(latestPlanProps().layout?.nodes).toHaveLength(3);
    });
  });

  it('uses Arden confirm for opening and segment delete flows', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));
    const openingId = createFiveBySixCmuBuildingPreset().wall.openings[0].id;

    selectFloorPlan();
    await waitFor(() => expect(latestPlanProps().active2DView).toBe('floor-plan'));
    selectToolMode(/^select$/i);
    await act(async () => {
      latestPlanProps().onInteraction?.({
        kind: 'segment_pick',
        toolMode: 'select',
        phase: 'commit',
        ...EXISTING_DOOR_PLAN_POINT,
      });
    });
    await waitFor(() => expect(latestPlanProps().selectedOpeningId).toBe(openingId));
    selectToolMode(/^delete$/i);
    fireEvent.click(screen.getByRole('button', { name: /delete selected opening/i }));
    await waitFor(() => expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Delete opening?' })));

    selectToolMode(/^delete$/i);
    fireEvent.click(screen.getByRole('button', { name: /segment 1/i }));
    fireEvent.click(screen.getByRole('button', { name: /delete selected wall/i }));
    await waitFor(() => expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Delete wall segment?' })));
  });

  it('selects and deletes a wall segment from plan view in Delete mode', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));
    selectViewMode('plan');
    selectToolMode(/^delete$/i);

    await act(async () => {
      latestPlanProps().onInteraction?.({
        kind: 'segment_pick',
        toolMode: 'delete',
        phase: 'commit',
        planX: -2,
        planZ: -2.5,
      });
    });

    await waitFor(() => expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Delete wall segment?' })));
    await waitFor(() => expect(latestPlanProps().layout?.segments).toHaveLength(3));
    expect(screen.getByText(/design revision pending/i)).toBeInTheDocument();
  });

  it('keyboard Delete opens wall delete confirmation only when a segment is selected', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));
    selectViewMode('plan');
    await act(async () => {
      latestPlanProps().onInteraction?.({
        kind: 'segment_pick',
        toolMode: 'select',
        phase: 'commit',
        planX: -2,
        planZ: -2.5,
      });
    });

    fireEvent.keyDown(window, { key: 'Delete' });

    await waitFor(() => expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Delete wall segment?' })));
  });

  it('starts blank layout, clears geometry state, and preserves CMU defaults', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));
    const sessionBefore = useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1'];
    expect(sessionBefore.preset?.wall.blockModule?.moduleLengthMeters).toBeCloseTo(0.4);
    expect(sessionBefore.preset?.wall.bondPattern).toBe('running_bond');

    chooseNewLayout();

    await waitFor(() => expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'New layout?' })));
    await waitFor(() => expect(latestPlanProps().layout?.segments).toHaveLength(0));
    expect(latestPlanProps().layout?.nodes).toHaveLength(0);
    expect(latestPlanProps().toolMode).toBe('select');
    expect(screen.getByTestId('design-builder-plan')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /start a cmu layout/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /build cmu manually|create auto wall layout/i })).not.toBeInTheDocument();
    const sessionAfter = useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1'];
    expect(sessionAfter.preset?.wall.blockModule?.moduleLengthMeters).toBeCloseTo(0.4);
    expect(sessionAfter.preset?.wall.bondPattern).toBe('running_bond');
    expect(sessionAfter.preset?.wall.openings).toHaveLength(0);
    expect(sessionAfter.preset?.wall.manualMasonryCourseRuns).toHaveLength(0);
    expect(sessionAfter.preset?.wall.manualMasonryCellOverrides).toHaveLength(0);
    expect(sessionAfter.preset?.wallLayout.nodes).toHaveLength(0);
    expect(sessionAfter.preset?.wallLayout.segments).toHaveLength(0);
    expect(sessionAfter.objectTreeExpanded).toEqual({
      foundation: false,
      layout: false,
      masonry: false,
      structure: false,
      estimate: false,
      openings: false,
      roofGable: false,
    });
    expect(sessionAfter.toolMode).toBe('select');
    expect(sessionAfter.layoutState).toBe('blank');
    selectViewMode('3d');
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments).toHaveLength(0));
    expect(latestViewerProps().geometryResult?.sourcePath).toBe('blank');
    expect(latestViewerProps().geometryResult?.blockCount).toBe(0);
    expect(latestViewerProps().geometryResult?.wallSegments).toHaveLength(0);
  });

  it('does not expose manual masonry drawing controls in the production toolbar', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));
    chooseNewLayout();
    await waitFor(() => expect(latestPlanProps().layout?.segments).toHaveLength(0));

    expect(screen.queryByRole('button', { name: /^masonry layout$/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/^Full CMU$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Half CMU$/i)).not.toBeInTheDocument();
    expect(latestPlanProps().manualMasonry).toBeUndefined();
  });

  it('loads persisted manual masonry runs without exposing paint controls', async () => {
    const manualRun: MasonryCourseRun = {
      id: 'manual-run-1',
      unitType: 'full_block',
      count: 2,
      originX: 0,
      originZ: 0,
      courseIndex: 0,
      orientation: 'east',
      source: 'manual_3d_brush',
    };
    useDesignBuilderSessionStore.getState().saveSession('project-1:estimate-1', {
      preset: {
        ...createFiveBySixCmuBuildingPreset(),
        wall: {
          ...createFiveBySixCmuBuildingPreset().wall,
          manualMasonryCourseRuns: [manualRun],
        },
      },
      layoutState: 'editing',
    });

    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() =>
      expect(useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']?.preset?.wall.manualMasonryCourseRuns).toHaveLength(1),
    );
    expect(screen.queryByRole('button', { name: /^masonry layout$/i })).not.toBeInTheDocument();
  });

  it('starts Draw Wall from blank through the tools menu', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));
    chooseNewLayout();
    await waitFor(() => expect(latestPlanProps().layout?.segments).toHaveLength(0));

    clickDrawWall();

    await waitFor(() => expect(latestPlanProps().toolMode).toBe('draw_wall'));
    expect(screen.getAllByText(/Click points to place segments/i)).toHaveLength(1);
    expect(screen.queryByText(/draw wall: click to place points/i)).not.toBeInTheDocument();
  });

  it('does not auto-load demo after a blank layout remount', async () => {
    seedLoadedDesignBuilderTemplate();
    const rendered = render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));
    chooseNewLayout();
    await waitFor(() => expect(latestPlanProps().layout?.segments).toHaveLength(0));

    rendered.unmount();
    mocks.plan.mockClear();
    mocks.viewer.mockClear();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);

    await waitFor(() => expect(latestPlanProps().layout?.segments).toHaveLength(0));
    expect(latestPlanProps().toolMode).toBe('select');
    expect(screen.queryByRole('heading', { name: /start a cmu layout/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /build cmu manually|create auto wall layout/i })).not.toBeInTheDocument();
  });

  it('places, moves, and deletes openings through viewer interactions without auto-committing estimates', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));

    selectOpeningTool(/door opening/i);
    await waitFor(() => expect(latestPlanProps().toolMode).toBe('place_door'));
    await act(async () => {
      latestPlanProps().onInteraction?.({
        kind: 'segment_pick',
        toolMode: 'place_door',
        phase: 'commit',
        ...NEW_OPENING_PLAN_POINT,
      });
    });

    await waitFor(() => {
      expect(latestPlanProps().toolMode).toBe('select');
      expect(latestPlanProps().openingPreview).toBeNull();
    });
    const placedOpeningId = latestPlanProps().selectedOpeningId ?? sessionPreset()?.wall.openings.at(-1)?.id;
    expect(placedOpeningId).toBeTruthy();

    selectOpeningTool(/move opening/i);
    await waitFor(() => expect(latestPlanProps().toolMode).toBe('move_opening'));
    await act(async () => {
      latestPlanProps().onInteraction?.({
        kind: 'segment_pick',
        toolMode: 'move_opening',
        phase: 'commit',
        ...NEW_OPENING_PLAN_POINT,
      });
    });
    await waitFor(() => expect(latestPlanProps().selectedOpeningId).toBe(placedOpeningId));
    const movedOpeningPoint = MOVED_OPENING_PLAN_POINT;
    await act(async () => {
      latestPlanProps().onInteraction?.({
        kind: 'segment_pick',
        toolMode: 'move_opening',
        phase: 'preview',
        ...movedOpeningPoint,
      });
    });
    await waitFor(() => expect(latestPlanProps().openingPreview).toBeTruthy());

    await act(async () => {
      latestPlanProps().onInteraction?.({
        kind: 'segment_pick',
        toolMode: 'move_opening',
        phase: 'commit',
        ...movedOpeningPoint,
      });
    });
    await waitFor(() => {
      expect(latestPlanProps().toolMode).toBe('select');
      expect(latestPlanProps().openingPreview).toBeNull();
      expect(latestPlanProps().selectedOpeningId).toBe(placedOpeningId);
    });

    selectToolMode(/^delete$/i);
    fireEvent.click(screen.getByRole('button', { name: /delete selected opening/i }));
    await waitFor(() => expect(sessionPreset()?.wall.openings.some((opening) => opening.id === placedOpeningId)).toBe(false));
    expect(mocks.commitDesignEstimatePreview).not.toHaveBeenCalled();
  });

  it('commits matching opening centers from Floor Plan placements', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));
    let session = useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1'];

    selectViewMode('plan');
    selectOpeningTool(/door opening/i);
    await waitFor(() => expect(latestPlanProps().toolMode).toBe('place_door'));
    const openingCountBeforePlanCommit = session?.preset?.wall.openings.length ?? 0;
    await act(async () => {
      latestPlanProps().onInteraction?.({
        kind: 'segment_pick',
        toolMode: 'place_door',
        phase: 'preview',
        ...NEW_OPENING_PLAN_POINT,
      });
    });
    await act(async () => {
      latestPlanProps().onInteraction?.({
        kind: 'segment_pick',
        toolMode: 'place_door',
        phase: 'commit',
        ...NEW_OPENING_PLAN_POINT,
      });
    });

    await waitFor(() =>
      expect(useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']?.preset?.wall.openings).toHaveLength(
        openingCountBeforePlanCommit + 1,
      ),
    );
    session = useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1'];
    const planOpening = session?.preset?.wall.openings.at(-1);
    selectViewMode('3d');
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallCmuLayout?.roughOpenings).toBeTruthy());
    let planRough = latestViewerProps().geometryResult?.wallCmuLayout?.roughOpenings?.find((opening) => opening.id === planOpening?.id);
    expect((planRough!.actualStartAlongMeters + planRough!.actualEndAlongMeters) / 2).toBeCloseTo(
      planOpening!.positionAlongSegment!,
      6,
    );

    selectOpeningTool(/window opening/i);
    await waitFor(() => expect(latestPlanProps().toolMode).toBe('place_window'));
    await act(async () => {
      latestPlanProps().onInteraction?.({
        kind: 'segment_pick',
        toolMode: 'place_window',
        phase: 'preview',
        ...southWallPlanPoint(1),
      });
    });
    await waitFor(() => expect(latestPlanProps().openingPreview).toBeTruthy());
    const floorPreview = latestPlanProps().openingPreview as
      | { resolvedPlacement?: { positionAlongSegmentMeters?: number } }
      | null
      | undefined;
    const viewerPreviewPosition = floorPreview?.resolvedPlacement?.positionAlongSegmentMeters ?? 4.8;
    const openingCountBeforeViewerCommit =
      useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']?.preset?.wall.openings.length ?? 0;
    const openingIdsBeforeViewerCommit = new Set(
      useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']?.preset?.wall.openings.map((opening) => opening.id) ?? [],
    );

    await act(async () => {
      latestPlanProps().onInteraction?.({
        kind: 'segment_pick',
        toolMode: 'place_window',
        phase: 'commit',
        ...southWallPlanPoint(1),
      });
    });

    await waitFor(() =>
      expect(useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']?.preset?.wall.openings).toHaveLength(
        openingCountBeforeViewerCommit + 1,
      ),
    );
    session = useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1'];
    const viewerOpening =
      session?.preset?.wall.openings.find((opening) => !openingIdsBeforeViewerCommit.has(opening.id)) ??
      session?.preset?.wall.openings.at(-1);
    selectViewMode('3d');
    await waitFor(() =>
      expect(latestViewerProps().geometryResult?.wallCmuLayout?.roughOpenings?.some((opening) => opening.id === viewerOpening?.id)).toBe(
        true,
      ),
    );
    planRough = latestViewerProps().geometryResult?.wallCmuLayout?.roughOpenings?.find((opening) => opening.id === viewerOpening?.id);
    expect(viewerOpening?.positionAlongSegment).toBeCloseTo(viewerPreviewPosition, 6);
    expect((planRough!.actualStartAlongMeters + planRough!.actualEndAlongMeters) / 2).toBeCloseTo(
      viewerOpening!.positionAlongSegment!,
      6,
    );
  });

  it('debounces supabase saves after opening placement edits', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));
    const callsAfterLoad = mocks.upsertDesignModelObjects.mock.calls.length;

    selectOpeningTool(/door opening/i);
    await waitFor(() => expect(latestPlanProps().toolMode).toBe('place_door'));
    await act(async () => {
      latestPlanProps().onInteraction?.({
        kind: 'segment_pick',
        toolMode: 'place_door',
        phase: 'commit',
        ...southWallPlanPoint(1.2),
      });
    });
    expect(mocks.upsertDesignModelObjects.mock.calls.length).toBe(callsAfterLoad);
  });

  it('shows stale committed preview warning after editing a design with committed estimate lines', async () => {
    mocks.persistDesignEstimatePreview.mockResolvedValue({
      data: [
        {
          id: 'quantity-1',
          estimateLineId: 'estimate-line-1',
          metadata: { previewLineId: 'cmu-blocks' },
        },
      ],
      error: null,
    });

    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));

    fireEvent.click(savePreviewButton());
    await waitFor(() => expect(mocks.persistDesignEstimatePreview).toHaveBeenCalled());
    expect(commitEstimateButton()).not.toBeDisabled();

    expandObjectTreeGroup('Masonry');
    fireEvent.click(screen.getByRole('button', { name: /^cmu walls$/i }));

    const wallHeight = screen.getByLabelText(/^wall height$/i);
    fireEvent.change(wallHeight, { target: { value: '4.2' } });
    fireEvent.blur(wallHeight);

    await waitFor(() => {
      expect(latestViewerProps().geometryResult?.wallSegments?.[0]?.heightMeters).toBeCloseTo(4.2, 1);
      expect(screen.getByText(/design revision pending/i)).toBeInTheDocument();
    });
    await waitFor(() => expect(screen.getByText(/out of date/i)).toBeInTheDocument());
    expect(commitEstimateButton()).toBeDisabled();
    expect(mocks.commitDesignEstimatePreview).not.toHaveBeenCalled();
  });

  it('shows open footprint message when layout is not closed', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));
    expect(screen.queryByText(/close footprint to generate slab and roof/i)).not.toBeInTheDocument();
  });

  it('closes single-action opening and tool menus after selection', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));

    selectOpeningTool(/window opening/i);
    await waitFor(() => expect(latestPlanProps().toolMode).toBe('place_window'));
    expect(latestPlanProps().active2DView).toBe('floor-plan');
    expect(openCommandMenus()).toHaveLength(0);

    selectOpeningTool(/move opening/i);
    await waitFor(() => expect(latestPlanProps().toolMode).toBe('move_opening'));
    expect(latestPlanProps().active2DView).toBe('floor-plan');
    expect(openCommandMenus()).toHaveLength(0);

    selectToolMode(/^draw wall$/i);
    await waitFor(() => expect(latestPlanProps().toolMode).toBe('draw_wall'));
    expect(openCommandMenus()).toHaveLength(0);
  });

  it('keeps multi-setting Snap and Display menus open while toggles change', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));

    openSnapMenu();
    expect(openCommandMenus()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /^off$/i }));
    expect(openCommandMenus()).toHaveLength(1);

    fireEvent.pointerDown(document.body);
    await waitFor(() => expect(openCommandMenus()).toHaveLength(0));

    openDisplayMenu();
    expect(openCommandMenus()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /wall overlays/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /show opening layout/i }));
    expect(openCommandMenus()).toHaveLength(1);
  });

  it('updates the global measurement preference from the Display menu', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));

    openDisplayMenu();
    fireEvent.click(screen.getByRole('radio', { name: /imperial/i }));

    await waitFor(() => {
      expect(mocks.updatePreferences).toHaveBeenCalledWith({
        measurementSystem: 'imperial',
        units: 'imperial',
        lengthUnit: 'feet',
        volumeUnit: 'cubic_yards',
      });
    });
  });

  it('closes command menus on click outside and Escape', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));

    openMenuByKind('components');
    expect(openCommandMenus()).toHaveLength(1);

    fireEvent.pointerDown(document.body);
    await waitFor(() => expect(openCommandMenus()).toHaveLength(0));

    openDisplayMenu();
    expect(openCommandMenus()).toHaveLength(1);
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(openCommandMenus()).toHaveLength(0));
  });

  it('returns to Select after committing a window opening and keeps it selected', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));

    selectOpeningTool(/window opening/i);
    await waitFor(() => expect(latestPlanProps().toolMode).toBe('place_window'));
    await act(async () => {
      latestPlanProps().onInteraction?.({
        kind: 'segment_pick',
        toolMode: 'place_window',
        phase: 'commit',
        ...southWallPlanPoint(1),
      });
    });

    await waitFor(() => {
      expect(latestPlanProps().toolMode).toBe('select');
      expect(latestPlanProps().openingPreview).toBeNull();
      expect(latestPlanProps().selectedOpeningId).toBeTruthy();
      expect(latestPlanProps().selectedObjectType).toBe('window_opening');
    });
  });

  it('cancels move opening preview with Escape and returns to Select', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));

    selectOpeningTool(/move opening/i);
    await waitFor(() => expect(latestPlanProps().toolMode).toBe('move_opening'));
    await act(async () => {
      latestPlanProps().onInteraction?.({
        kind: 'segment_pick',
        toolMode: 'move_opening',
        phase: 'commit',
        ...EXISTING_DOOR_PLAN_POINT,
      });
    });
    await waitFor(() => expect(latestPlanProps().selectedOpeningId).toBe(createFiveBySixCmuBuildingPreset().wall.openings[0].id));
    await act(async () => {
      latestPlanProps().onInteraction?.({
        kind: 'segment_pick',
        toolMode: 'move_opening',
        phase: 'preview',
        ...NEW_OPENING_PLAN_POINT,
      });
    });
    await waitFor(() => expect(latestPlanProps().openingPreview).not.toBeNull());

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(latestPlanProps().toolMode).toBe('select');
      expect(latestPlanProps().openingPreview).toBeNull();
    });
  });

  function sessionPreset() {
    return useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']?.preset;
  }

  function clickUndo() {
    fireEvent.click(screen.getByRole('button', { name: (_name, element) => element.textContent?.trim() === 'Undo' }));
  }

  function clickRedo() {
    fireEvent.click(screen.getByRole('button', { name: (_name, element) => element.textContent?.trim() === 'Redo' }));
  }

  async function placeCommittedDoor(offsetMeters = 4.5) {
    selectOpeningTool(/door opening/i);
    await waitFor(() => expect(latestPlanProps().toolMode).toBe('place_door'));
    await act(async () => {
      latestPlanProps().onInteraction?.({
        kind: 'segment_pick',
        toolMode: 'place_door',
        phase: 'commit',
        ...southWallPlanPoint(offsetMeters),
      });
    });
  }

  async function placeCommittedWindow(offsetMeters = 4.5) {
    selectOpeningTool(/window opening/i);
    await waitFor(() => expect(latestPlanProps().toolMode).toBe('place_window'));
    await act(async () => {
      latestPlanProps().onInteraction?.({
        kind: 'segment_pick',
        toolMode: 'place_window',
        phase: 'commit',
        ...southWallPlanPoint(offsetMeters),
      });
    });
  }

  async function startBlankLayout() {
    chooseNewLayout();
    await waitFor(() => expect(latestPlanProps().layout?.segments).toHaveLength(0));
  }

  async function drawSingleWallSegment() {
    clickDrawWall();
    await act(async () => {
      latestPlanProps().onInteraction?.({ kind: 'draw_point', toolMode: 'draw_wall', planX: 0, planZ: 0 });
    });
    await act(async () => {
      latestPlanProps().onInteraction?.({ kind: 'draw_point', toolMode: 'draw_wall', planX: 5, planZ: 0 });
    });
    await waitFor(() => expect(latestPlanProps().layout?.segments).toHaveLength(1));
  }

  it('global undo removes a placed door without deleting prior wall segments', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));
    const segmentCountBefore = sessionPreset()?.wallLayout.segments.length ?? 0;
    const openingCountBefore = sessionPreset()?.wall.openings.length ?? 0;

    await placeCommittedDoor();
    await waitFor(() => expect(sessionPreset()?.wall.openings).toHaveLength(openingCountBefore + 1));

    clickUndo();
    await waitFor(() => {
      expect(sessionPreset()?.wall.openings).toHaveLength(openingCountBefore);
      expect(sessionPreset()?.wallLayout.segments).toHaveLength(segmentCountBefore);
      expect(screen.getByText(/undid: place door/i)).toBeInTheDocument();
    });
  });

  it('global undo removes a placed window without deleting wall segments', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));
    const segmentCountBefore = sessionPreset()?.wallLayout.segments.length ?? 0;
    const openingCountBefore = sessionPreset()?.wall.openings.length ?? 0;

    await placeCommittedWindow();
    await waitFor(() => expect(sessionPreset()?.wall.openings).toHaveLength(openingCountBefore + 1));

    clickUndo();
    await waitFor(() => {
      expect(sessionPreset()?.wall.openings).toHaveLength(openingCountBefore);
      expect(sessionPreset()?.wallLayout.segments).toHaveLength(segmentCountBefore);
    });
  });

  it('global undo restores a moved opening to its original location', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));
    const openingId = createFiveBySixCmuBuildingPreset().wall.openings[0].id;
    const originalOffset = sessionPreset()?.wall.openings.find((item) => item.id === openingId)?.offsetMeters;

    selectOpeningTool(/move opening/i);
    await waitFor(() => expect(latestPlanProps().toolMode).toBe('move_opening'));
    await act(async () => {
      latestPlanProps().onInteraction?.({
        kind: 'segment_pick',
        toolMode: 'move_opening',
        phase: 'commit',
        ...EXISTING_DOOR_PLAN_POINT,
      });
    });
    await waitFor(() => expect(latestPlanProps().selectedOpeningId).toBe(openingId));
    await act(async () => {
      latestPlanProps().onInteraction?.({
        kind: 'segment_pick',
        toolMode: 'move_opening',
        phase: 'commit',
        ...MOVED_OPENING_PLAN_POINT,
      });
    });
    await waitFor(() =>
      expect(sessionPreset()?.wall.openings.find((item) => item.id === openingId)?.positionAlongSegment).toBeCloseTo(2.9, 2),
    );

    clickUndo();
    await waitFor(() =>
      expect(sessionPreset()?.wall.openings.find((item) => item.id === openingId)?.offsetMeters).toBeCloseTo(
        originalOffset ?? 0,
        2,
      ),
    );
  });

  it('global undo restores a deleted opening', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));
    mocks.confirm.mockResolvedValueOnce(true);
    const openingId = createFiveBySixCmuBuildingPreset().wall.openings[0].id;
    const openingCountBefore = sessionPreset()?.wall.openings.length ?? 0;

    selectFloorPlan();
    await waitFor(() => expect(latestPlanProps().active2DView).toBe('floor-plan'));
    selectToolMode(/^select$/i);
    await act(async () => {
      latestPlanProps().onInteraction?.({
        kind: 'segment_pick',
        toolMode: 'select',
        phase: 'commit',
        ...EXISTING_DOOR_PLAN_POINT,
      });
    });
    await waitFor(() => expect(latestPlanProps().selectedOpeningId).toBe(openingId));
    selectToolMode(/^delete$/i);
    fireEvent.click(screen.getByRole('button', { name: /delete selected opening/i }));
    await waitFor(() => expect(sessionPreset()?.wall.openings).toHaveLength(openingCountBefore - 1));

    clickUndo();
    await waitFor(() => expect(sessionPreset()?.wall.openings).toHaveLength(openingCountBefore));
  });

  it('global undo removes only the most recently drawn wall segment', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));
    await startBlankLayout();
    await drawSingleWallSegment();

    clickUndo();
    await waitFor(() => expect(latestPlanProps().layout?.segments).toHaveLength(0));
  });

  it('reverses mixed wall, opening, and masonry actions in chronological order', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));
    const openingCountBefore = sessionPreset()?.wall.openings.length ?? 0;
    const segmentCountBefore = sessionPreset()?.wallLayout.segments.length ?? 0;

    await placeCommittedDoor();
    await waitFor(() => expect(sessionPreset()?.wall.openings).toHaveLength(openingCountBefore + 1));

    expandObjectTreeGroup('Masonry');
    fireEvent.click(screen.getByRole('button', { name: /^cmu walls$/i }));
    const bondPattern = screen.getByLabelText(/^bond pattern$/i);
    fireEvent.change(bondPattern, { target: { value: 'stack_bond' } });
    await waitFor(() =>
      expect(useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']?.preset?.wall.bondPattern).toBe(
        'stack_bond',
      ),
    );

    clickUndo();
    await waitFor(() =>
      expect(useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']?.preset?.wall.bondPattern).toBe(
        'running_bond',
      ),
    );

    clickUndo();
    await waitFor(() => expect(sessionPreset()?.wall.openings).toHaveLength(openingCountBefore));

    expect(sessionPreset()?.wallLayout.segments).toHaveLength(segmentCountBefore);
  });

  it('redo restores undone actions in chronological order and clears after a new mutation', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));
    const openingCountBefore = sessionPreset()?.wall.openings.length ?? 0;

    await placeCommittedDoor();
    await waitFor(() => expect(sessionPreset()?.wall.openings).toHaveLength(openingCountBefore + 1));

    clickUndo();
    await waitFor(() => expect(sessionPreset()?.wall.openings).toHaveLength(openingCountBefore));

    clickRedo();
    await waitFor(() => expect(sessionPreset()?.wall.openings).toHaveLength(openingCountBefore + 1));

    expandObjectTreeGroup('Masonry');
    fireEvent.click(screen.getByRole('button', { name: /^cmu walls$/i }));
    fireEvent.change(screen.getByLabelText(/^bond pattern$/i), { target: { value: 'stack_bond' } });
    await waitFor(() =>
      expect(useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']?.preset?.wall.bondPattern).toBe(
        'stack_bond',
      ),
    );

    expect(screen.getByRole('button', { name: (_name, element) => element.textContent?.trim() === 'Redo' })).toBeDisabled();
  });

  it('opening move preview does not create a new undo step', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));
    await placeCommittedDoor(1.2);

    const openingId = sessionPreset()?.wall.openings.find((opening) => opening.type === 'door' && opening.id !== 'door-west-01')?.id
      ?? sessionPreset()?.wall.openings.at(-1)?.id;
    expect(openingId).toBeTruthy();

    selectOpeningTool(/move opening/i);
    await waitFor(() => expect(latestPlanProps().toolMode).toBe('move_opening'));
    await act(async () => {
      latestPlanProps().onInteraction?.({
        kind: 'segment_pick',
        toolMode: 'move_opening',
        phase: 'preview',
        ...MOVED_OPENING_PLAN_POINT,
      });
    });

    expect(screen.getByRole('button', { name: /undo place door/i })).toBeInTheDocument();
  });

  it('undo and redo regenerate derived geometry quantities', async () => {
    seedLoadedDesignBuilderTemplate();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments?.length).toBeGreaterThan(0));
    expandObjectTreeGroup('Masonry');
    fireEvent.click(screen.getByRole('button', { name: /^cmu walls$/i }));
    const runningBondCount = latestViewerProps().geometryResult?.blockCount ?? 0;

    fireEvent.change(screen.getByLabelText(/^bond pattern$/i), { target: { value: 'stack_bond' } });
    await waitFor(() => expect(latestViewerProps().geometryResult?.blockCount).not.toBe(runningBondCount));

    clickUndo();
    await waitFor(() => expect(latestViewerProps().geometryResult?.blockCount).toBe(runningBondCount));

    clickRedo();
    await waitFor(() => expect(latestViewerProps().geometryResult?.blockCount).not.toBe(runningBondCount));
  });

  it('undo preserves the current 3D camera snapshot', async () => {
    const camera = {
      position: [4, 6, 8] as [number, number, number],
      target: [0, 1, 0] as [number, number, number],
    };
    useDesignBuilderSessionStore.getState().saveSession('project-1:estimate-1', {
      preset: createFiveBySixCmuBuildingPreset(),
      layoutState: 'demo_loaded',
      camera,
    });

    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments.length).toBeGreaterThan(0));

    await placeCommittedDoor();
    clickUndo();

    await waitFor(() =>
      expect(useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']?.camera).toEqual(camera),
    );
  });

  it('shows project-bound persistence copy instead of demo sign-in messaging', async () => {
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() =>
      expect(screen.getByText(/design is linked to this detailed estimate/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText(/sign in and load the example/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/load the example to generate estimate-ready quantities/i)).not.toBeInTheDocument();
  });

  it('saves blank design state to the active estimate without requiring a template load', async () => {
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(mocks.findDesignModelByEstimateId).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /save design/i }));
    await waitFor(() => expect(mocks.createDesignModel).toHaveBeenCalled());
    await waitFor(() => expect(mocks.updateDesignModelMetadata).toHaveBeenCalled());
    expect(mocks.upsertDesignModelObjects).toHaveBeenCalled();
    expect(screen.getByText(/design saved to this estimate/i)).toBeInTheDocument();
  });

  it('reloads persisted RC settings when opening from a saved estimate', async () => {
    const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
    preset.buildingSystemMode = 'reinforced_concrete_frame_with_cmu_infill';
    preset.foundationSettings.isolatedFootings.enabled = true;
    preset.foundationSettings.isolatedFootings.autoCreateAtStructuralColumns = true;
    preset.foundationSettings.isolatedFootings.widthMeters = 1.5;
    preset.foundationSettings.isolatedFootings.lengthMeters = 1.6;
    preset.foundationSettings.isolatedFootings.thicknessMeters = 0.45;
    const savedObjects = buildPresetObjects({
      designModelId: 'model-1',
      projectId: 'project-1',
      preset,
      includeStableIds: false,
    }).map((object, index) => ({
      ...object,
      id: `object-${index}`,
      parentObjectId: null,
      quantitySummary: {},
      estimateMapping: {},
      geometryCache: null,
      createdAt: '',
      updatedAt: '',
    }));
    mocks.findDesignModelByEstimateId.mockResolvedValue({
      data: {
        id: 'model-1',
        projectId: 'project-1',
        estimateId: 'estimate-1',
        name: 'Saved RC design',
        unitSystem: 'metric',
        modelType: 'cmu_building',
        status: 'draft',
        createdBy: 'user-1',
        metadata: {
          designBuilderState: serializePersistedDesignBuilderState(preset),
        },
        createdAt: '',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      error: null,
    });
    mocks.listDesignModelObjects.mockResolvedValue({ data: savedObjects, error: null });

    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(mocks.listDesignModelObjects).toHaveBeenCalled());
    await waitFor(() =>
      expect(latestViewerProps().geometryResult?.isolatedFootings?.[0]?.widthMeters).toBe(1.5),
    );
    expect(latestViewerProps().geometryResult?.isolatedFootings?.[0]?.lengthMeters).toBe(1.6);
    expect(latestViewerProps().geometryResult?.isolatedFootings?.[0]?.thicknessMeters).toBe(0.45);
  });

  it('keeps local unsaved state when save fails', async () => {
    mocks.updateDesignModelMetadata.mockResolvedValueOnce({ data: null, error: 'Network unavailable' });
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await waitFor(() => expect(mocks.findDesignModelByEstimateId).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /save design/i }));
    await waitFor(() =>
      expect(screen.getByText(/unable to save design/i)).toBeInTheDocument(),
    );
    expect(screen.getByTestId('design-builder-viewer')).toBeInTheDocument();
  });
});

describe('layout quantity effects', () => {
  it('updates CMU layout quantities when an opening is moved on a wall', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const opening = preset.wall.openings[0];
    const beforeLayout = generateCmuLayout(preset.wall);
    const movedWall = {
      ...preset.wall,
      openings: preset.wall.openings.map((item) =>
        item.id === opening.id ? { ...item, offsetMeters: 1.0 } : item,
      ),
    };
    const afterLayout = generateCmuLayout(movedWall);
    const beforeCells = beforeLayout.jambGroutCells.filter((cell) => cell.openingId === opening.id);
    const afterCells = afterLayout.jambGroutCells.filter((cell) => cell.openingId === opening.id);
    expect(beforeCells.length).toBeGreaterThan(0);
    expect(afterCells.some((cell, index) => cell.x !== beforeCells[index]?.x || cell.z !== beforeCells[index]?.z)).toBe(true);
  });
});


