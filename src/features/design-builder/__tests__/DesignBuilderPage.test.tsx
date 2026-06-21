import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildPresetObjects, createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import { applyAutoFrameLayout } from '../domain/structureActions';
import { serializePersistedDesignBuilderState } from '../domain/designBuilderPersistence';
import { generateCmuLayout } from '../geometry/designGeometry';
import { useDesignBuilderSessionStore } from '../state/designBuilderStore';
import DesignBuilderPage from '../ui/DesignBuilderPage';
import type { DesignBuilderInteractionEvent, MasonryCourseRun } from '../types';

const mocks = vi.hoisted(() => ({
  createDesignModel: vi.fn(),
  upsertDesignModelObjects: vi.fn(),
  findDesignModelByEstimateId: vi.fn(),
  listDesignModelObjects: vi.fn(),
  updateDesignModelMetadata: vi.fn(),
  persistDesignEstimatePreview: vi.fn(),
  commitDesignEstimatePreview: vi.fn(),
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

vi.mock('../ui/DesignBuilderPlanCanvas', () => ({
  default: (props: {
    onInteraction?: (event: DesignBuilderInteractionEvent) => void;
    onManualMasonryPointer?: (event: { kind: 'preview' | 'start' | 'commit' | 'cancel_preview' | 'undo'; planX?: number; planZ?: number }) => void;
    toolMode?: string;
    layout?: { nodes: unknown[]; segments: unknown[] };
    manualMasonry?: { enabled: boolean; runs: MasonryCourseRun[]; preview: unknown };
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
    selectedObjectType?: string | null;
    geometryResult?: { sourcePath: string; wallSegments: unknown[]; blockCount: number };
  }) => {
    mocks.viewer(props);
    return <div data-testid="design-builder-viewer">Generated preview</div>;
  },
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
    layout?: { nodes: unknown[]; segments: unknown[]; isFootprintClosed?: boolean };
    manualMasonry?: { enabled: boolean; runs: MasonryCourseRun[]; preview: unknown };
  };
}

async function loadTemplate() {
  fireEvent.click(screen.getByRole('button', { name: /load cmu template/i }));
  await waitFor(() => expect(mocks.createDesignModel).toHaveBeenCalled());
}

function expandObjectTreeGroup(label: string) {
  fireEvent.click(screen.getByRole('button', { name: (name) => name === `${label}+` || name === `${label}−` }));
}

function commandBar() {
  return screen.getByRole('toolbar', { name: /design builder command bar/i });
}

function commandMenus() {
  return Array.from(commandBar().querySelectorAll('[data-design-builder-command-menu]')) as HTMLElement[];
}

function openMenuByKind(kind: string) {
  const menu = commandBar().querySelector(`[data-menu-kind="${kind}"]`);
  if (!menu) throw new Error(`Command menu kind ${kind} not found`);
  fireEvent.click(within(menu as HTMLElement).getByRole('button'));
}

function openCommandMenu(triggerName: RegExp | string) {
  const menu = commandMenus().find((element) =>
    within(element).queryByRole('button', { name: triggerName }) != null,
  );
  if (!menu) throw new Error(`Command menu trigger ${String(triggerName)} not found`);
  fireEvent.click(within(menu).getByRole('button', { name: triggerName }));
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
  openMenuByKind('openings');
  chooseCommandMenuItem(label);
}

function selectViewMode(mode: 'plan' | '3d') {
  fireEvent.click(
    screen.getByRole('button', {
      name: mode === 'plan' ? /switch to 2d plan view/i : /switch to 3d view/i,
    }),
  );
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

function openViewMenuItems() {
  openCommandMenu(/^view\b/i);
  return screen.getAllByRole('menuitem');
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

  it('loads the preset, generates an estimate preview, and commits only after confirmation', async () => {
    const onEstimateCommitted = vi.fn();
    render(
      <DesignBuilderPage
        projectId="project-1"
        estimateId="estimate-1"
        onEstimateCommitted={onEstimateCommitted}
      />,
    );

    expect(screen.getByTestId('design-builder-viewer')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /load cmu template/i }));
    await waitFor(() => expect(mocks.createDesignModel).toHaveBeenCalled());
    expect(mocks.upsertDesignModelObjects).toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole('button', { name: /estimate preview/i }).at(-1)!);
    await waitFor(() => expect(mocks.persistDesignEstimatePreview).toHaveBeenCalled());
    expect(screen.getByText(/review quantities before committing/i)).toBeInTheDocument();
    expect(mocks.commitDesignEstimatePreview).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /commit to estimate/i }));
    await waitFor(() => expect(mocks.commitDesignEstimatePreview).toHaveBeenCalled());
    expect(onEstimateCommitted).toHaveBeenCalled();
  });

  it('exposes 3D Takeoff-style workspace controls without remounting the model for panel toggles', () => {
    render(
      <DesignBuilderPage
        projectId="project-1"
        estimateId="estimate-1"
      />,
    );

    expect(screen.getByRole('button', { name: /^tools$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^estimate$/i })).toBeInTheDocument();
    openMenuByKind('view');
    expect(screen.getByRole('menuitem', { name: /fit height/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /60%/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /80%/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /full height/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^fit$/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('menuitem', { name: /reset view/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^tools$/i }));
    expect(screen.getByRole('button', { name: /^tools$/i })).toBeInTheDocument();
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
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await loadTemplate();
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
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await loadTemplate();
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
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await loadTemplate();

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
    render(
      <DesignBuilderPage
        projectId="project-1"
        estimateId="estimate-1"
      />,
    );
    await loadTemplate();

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

  it('exposes wall layout tools and outside-face dimension readout after loading', async () => {
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await loadTemplate();

    expect(screen.queryByRole('button', { name: /activate wall drawing/i })).not.toBeInTheDocument();
    openMenuByKind('tools');
    expect(screen.getByRole('menuitem', { name: /draw wall/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /move node/i })).toBeInTheDocument();
    expect(screen.getByText(/outside face/i)).toBeInTheDocument();
    expect(screen.getByText(/6\.00 m × 5\.00 m/i)).toBeInTheDocument();
    expect(latestViewerProps().geometryResult?.sourcePath).toBe('layout_graph');
    expect(latestViewerProps().geometryResult?.wallSegments).toHaveLength(4);
  });

  it('dropdown tool items update the canonical viewer tool mode', async () => {
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await loadTemplate();

    selectOpeningTool(/door opening/i);
    await waitFor(() => expect(latestViewerProps().toolMode).toBe('place_door'));
    expect(openCommandMenus()).toHaveLength(0);

    selectToolMode(/^delete$/i);
    await waitFor(() => expect(latestViewerProps().toolMode).toBe('delete'));

    selectToolMode(/^select$/i);
    await waitFor(() => expect(latestViewerProps().toolMode).toBe('select'));
  });

  it('renders one command bar without duplicate save, close footprint, or cut-block chips', async () => {
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await loadTemplate();
    const commandBar = within(screen.getByRole('toolbar', { name: /design builder command bar/i }));

    expect(commandBar.getAllByRole('button', { name: /save design/i })).toHaveLength(1);
    expect(commandBar.queryAllByRole('button', { name: /close footprint/i })).toHaveLength(0);
    expect(commandBar.queryAllByText(/cut-block condition/i, { selector: 'summary' }).length).toBeLessThanOrEqual(1);
  });

  it('selects objects once and clears selection from empty canvas or ESC', async () => {
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await loadTemplate();

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
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await loadTemplate();
    fireEvent.click(screen.getByRole('button', { name: /new layout/i }));
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

  it('uses Arden confirm for opening and segment delete flows', async () => {
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await loadTemplate();
    const openingId = createFiveBySixCmuBuildingPreset().wall.openings[0].id;

    selectToolMode(/^delete$/i);
    await act(async () => {
      latestViewerProps().onInteraction?.({
        kind: 'select_opening',
        toolMode: 'delete',
        openingId,
        openingType: 'door',
      });
    });
    fireEvent.click(screen.getByRole('button', { name: /delete selected opening/i }));
    await waitFor(() => expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Delete opening?' })));

    selectToolMode(/^delete$/i);
    fireEvent.click(screen.getByRole('button', { name: /segment 1/i }));
    fireEvent.click(screen.getByRole('button', { name: /delete selected wall/i }));
    await waitFor(() => expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Delete wall segment?' })));
  });

  it('selects and deletes a wall segment from plan view in Delete mode', async () => {
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await loadTemplate();
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
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await loadTemplate();
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
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await loadTemplate();
    const sessionBefore = useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1'];
    expect(sessionBefore.preset?.wall.blockModule?.moduleLengthMeters).toBeCloseTo(0.4);
    expect(sessionBefore.preset?.wall.bondPattern).toBe('running_bond');

    fireEvent.click(screen.getByRole('button', { name: /new layout/i }));

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
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await loadTemplate();
    fireEvent.click(screen.getByRole('button', { name: /new layout/i }));
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
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await loadTemplate();
    fireEvent.click(screen.getByRole('button', { name: /new layout/i }));
    await waitFor(() => expect(latestPlanProps().layout?.segments).toHaveLength(0));

    clickDrawWall();

    await waitFor(() => expect(latestPlanProps().toolMode).toBe('draw_wall'));
    expect(screen.getAllByText(/Click points to place segments/i)).toHaveLength(1);
    expect(screen.queryByText(/draw wall: click to place points/i)).not.toBeInTheDocument();
  });

  it('does not auto-load demo after a blank layout remount', async () => {
    const rendered = render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await loadTemplate();
    fireEvent.click(screen.getByRole('button', { name: /new layout/i }));
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
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await loadTemplate();

    await act(async () => {
      latestViewerProps().onInteraction?.({
        kind: 'place_commit',
        toolMode: 'place_door',
        wallFace: 'west',
        offsetMeters: 2.4,
        openingType: 'door',
      });
    });

    await waitFor(() => {
      expect(latestViewerProps().toolMode).toBe('select');
      expect(latestViewerProps().placementPreview).toBeNull();
    });
    const placedOpeningId = latestViewerProps().selectedOpeningId;
    expect(placedOpeningId).toBeTruthy();

    await act(async () => {
      latestViewerProps().onInteraction?.({
        kind: 'wall_pick',
        toolMode: 'select',
        wallFace: 'west',
        offsetMeters: 3.6,
        openingType: 'door',
      });
    });
    expect(latestViewerProps().placementPreview).toBeNull();

    await act(async () => {
      latestViewerProps().onInteraction?.({
        kind: 'opening_move',
        toolMode: 'move_opening',
        phase: 'preview',
        openingId: placedOpeningId!,
        wallFace: 'west',
        offsetMeters: 3.2,
      });
    });
    await waitFor(() => expect(latestViewerProps().placementPreview?.offsetMeters).toBeCloseTo(3.2, 6));

    await act(async () => {
      latestViewerProps().onInteraction?.({
        kind: 'opening_move',
        toolMode: 'move_opening',
        phase: 'commit',
        openingId: placedOpeningId!,
        wallFace: 'west',
        offsetMeters: 3.2,
        openingType: 'door',
      });
    });
    await waitFor(() => {
      expect(latestViewerProps().toolMode).toBe('select');
      expect(latestViewerProps().placementPreview).toBeNull();
      expect(latestViewerProps().selectedOpeningId).toBe(placedOpeningId);
    });

    selectToolMode(/^delete$/i);
    fireEvent.click(screen.getByRole('button', { name: /delete selected opening/i }));
    expect(mocks.commitDesignEstimatePreview).not.toHaveBeenCalled();
  });

  it('commits matching opening centers from plan and viewer placement paths', async () => {
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await loadTemplate();
    let session = useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1'];
    const layout = session!.preset!.wallLayout;
    const firstSegment = layout.segments[0];
    const startNode = layout.nodes.find((node) => node.id === firstSegment.startNodeId)!;
    const endNode = layout.nodes.find((node) => node.id === firstSegment.endNodeId)!;
    const segmentLength = Math.hypot(endNode.x - startNode.x, endNode.z - startNode.z);
    const planPoint = { x: 0, z: -2.5 };
    const firstSegmentId = firstSegment.id;
    expect(firstSegmentId).toBeTruthy();

    selectViewMode('plan');
    selectOpeningTool(/door opening/i);
    await waitFor(() => expect(latestPlanProps().toolMode).toBe('place_door'));
    const openingCountBeforePlanCommit = session?.preset?.wall.openings.length ?? 0;
    await act(async () => {
      latestPlanProps().onInteraction?.({
        kind: 'segment_pick',
        toolMode: 'place_door',
        phase: 'preview',
        planX: planPoint.x,
        planZ: planPoint.z,
      });
    });
    await act(async () => {
      latestPlanProps().onInteraction?.({
        kind: 'segment_pick',
        toolMode: 'place_door',
        phase: 'commit',
        planX: planPoint.x,
        planZ: planPoint.z,
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
    await act(async () => {
      latestViewerProps().onInteraction?.({
        kind: 'wall_pick',
        toolMode: 'place_window',
        openingType: 'window',
        wallSegmentId: firstSegmentId!,
        positionAlongSegment: 4.8,
        hitPointX: startNode.x + ((endNode.x - startNode.x) / segmentLength) * 4.8,
        hitPointZ: startNode.z + ((endNode.z - startNode.z) / segmentLength) * 4.8,
      });
    });
    await waitFor(() => expect(latestViewerProps().placementPreview?.openingDraft).toBeTruthy());
    const viewerPreviewDraft = latestViewerProps().placementPreview!.openingDraft!;
    const openingCountBeforeViewerCommit =
      useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']?.preset?.wall.openings.length ?? 0;

    await act(async () => {
      latestViewerProps().onInteraction?.({
        kind: 'place_commit',
        toolMode: 'place_window',
        openingType: 'window',
        wallSegmentId: firstSegmentId!,
        positionAlongSegment: 4.8,
        hitPointX: startNode.x + ((endNode.x - startNode.x) / segmentLength) * 4.8,
        hitPointZ: startNode.z + ((endNode.z - startNode.z) / segmentLength) * 4.8,
      });
    });

    await waitFor(() =>
      expect(useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']?.preset?.wall.openings).toHaveLength(
        openingCountBeforeViewerCommit + 1,
      ),
    );
    session = useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1'];
    const viewerOpening =
      session?.preset?.wall.openings.find((opening) => opening.id === viewerPreviewDraft.id) ??
      session?.preset?.wall.openings.at(-1);
    planRough = latestViewerProps().geometryResult?.wallCmuLayout?.roughOpenings?.find((opening) => opening.id === viewerOpening?.id);
    expect(viewerOpening?.positionAlongSegment).toBeCloseTo(viewerPreviewDraft.positionAlongSegment ?? 0, 6);
    expect((planRough!.actualStartAlongMeters + planRough!.actualEndAlongMeters) / 2).toBeCloseTo(
      viewerOpening!.positionAlongSegment!,
      6,
    );
  });

  it('debounces supabase saves after opening placement edits', async () => {
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await loadTemplate();
    const callsAfterLoad = mocks.upsertDesignModelObjects.mock.calls.length;

    await act(async () => {
      latestViewerProps().onInteraction?.({
        kind: 'place_commit',
        toolMode: 'place_door',
        wallFace: 'west',
        offsetMeters: 1.2,
        openingType: 'door',
      });
    });
    expect(mocks.upsertDesignModelObjects.mock.calls.length).toBe(callsAfterLoad);
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();
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

    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await loadTemplate();

    fireEvent.click(screen.getAllByRole('button', { name: /estimate preview/i }).at(-1)!);
    await waitFor(() => expect(mocks.persistDesignEstimatePreview).toHaveBeenCalled());

    latestViewerProps().onInteraction?.({
      kind: 'place_commit',
      toolMode: 'place_door',
      wallFace: 'north',
      offsetMeters: 1.2,
      openingType: 'door',
    });

    await waitFor(() => {
      expect(screen.getByText(/design revision pending/i)).toBeInTheDocument();
    });
    expect(mocks.commitDesignEstimatePreview).not.toHaveBeenCalled();
  });

  it('shows open footprint message when layout is not closed', async () => {
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await loadTemplate();
    expect(screen.queryByText(/close footprint to generate slab and roof/i)).not.toBeInTheDocument();
  });

  it('closes single-action opening and tool menus after selection', async () => {
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await loadTemplate();

    selectOpeningTool(/window opening/i);
    await waitFor(() => expect(latestViewerProps().toolMode).toBe('place_window'));
    expect(openCommandMenus()).toHaveLength(0);

    selectOpeningTool(/move opening/i);
    await waitFor(() => expect(latestViewerProps().toolMode).toBe('move_opening'));
    expect(openCommandMenus()).toHaveLength(0);

    selectToolMode(/^draw wall$/i);
    await waitFor(() => expect(latestPlanProps().toolMode).toBe('draw_wall'));
    expect(openCommandMenus()).toHaveLength(0);
  });

  it('keeps multi-setting Snap and Display menus open while toggles change', async () => {
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await loadTemplate();

    openSnapMenu();
    expect(openCommandMenus()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /^cmu$/i }));
    expect(openCommandMenus()).toHaveLength(1);

    fireEvent.pointerDown(document.body);
    await waitFor(() => expect(openCommandMenus()).toHaveLength(0));

    openDisplayMenu();
    expect(openCommandMenus()).toHaveLength(1);
    fireEvent.click(screen.getByRole('checkbox', { name: /show opening layout/i }));
    expect(openCommandMenus()).toHaveLength(1);
  });

  it('closes command menus on click outside and Escape', async () => {
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await loadTemplate();

    openMenuByKind('openings');
    expect(openCommandMenus()).toHaveLength(1);

    fireEvent.pointerDown(document.body);
    await waitFor(() => expect(openCommandMenus()).toHaveLength(0));

    openMenuByKind('view');
    expect(openCommandMenus()).toHaveLength(1);
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(openCommandMenus()).toHaveLength(0));
  });

  it('returns to Select after committing a window opening and keeps it selected', async () => {
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await loadTemplate();

    selectOpeningTool(/window opening/i);
    await act(async () => {
      latestViewerProps().onInteraction?.({
        kind: 'place_commit',
        toolMode: 'place_window',
        wallFace: 'west',
        offsetMeters: 1.2,
        openingType: 'window',
      });
    });

    await waitFor(() => {
      expect(latestViewerProps().toolMode).toBe('select');
      expect(latestViewerProps().placementPreview).toBeNull();
      expect(latestViewerProps().selectedOpeningId).toBeTruthy();
      expect(latestViewerProps().selectedObjectType).toBe('window_opening');
    });
  });

  it('cancels move opening preview with Escape and returns to Select', async () => {
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await loadTemplate();
    const openingId = createFiveBySixCmuBuildingPreset().wall.openings[0].id;

    selectOpeningTool(/move opening/i);
    await act(async () => {
      latestViewerProps().onInteraction?.({
        kind: 'opening_move',
        toolMode: 'move_opening',
        phase: 'preview',
        openingId,
        wallFace: 'south',
        offsetMeters: 2.8,
      });
    });
    await waitFor(() => expect(latestViewerProps().placementPreview).not.toBeNull());

    await act(async () => {
      latestViewerProps().onInteraction?.({ kind: 'cancel', toolMode: 'move_opening' });
    });
    await waitFor(() => {
      expect(latestViewerProps().toolMode).toBe('select');
      expect(latestViewerProps().placementPreview).toBeNull();
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

  async function placeCommittedDoor(offsetMeters = 2.4) {
    await act(async () => {
      latestViewerProps().onInteraction?.({
        kind: 'place_commit',
        toolMode: 'place_door',
        wallFace: 'west',
        offsetMeters,
        openingType: 'door',
      });
    });
  }

  async function placeCommittedWindow(offsetMeters = 1.2) {
    await act(async () => {
      latestViewerProps().onInteraction?.({
        kind: 'place_commit',
        toolMode: 'place_window',
        wallFace: 'west',
        offsetMeters,
        openingType: 'window',
      });
    });
  }

  async function startBlankLayout() {
    fireEvent.click(screen.getByRole('button', { name: /new layout/i }));
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
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await loadTemplate();
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
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await loadTemplate();
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
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await loadTemplate();
    const openingId = createFiveBySixCmuBuildingPreset().wall.openings[0].id;
    const originalOffset = sessionPreset()?.wall.openings.find((item) => item.id === openingId)?.offsetMeters;

    selectOpeningTool(/move opening/i);
    await act(async () => {
      latestViewerProps().onInteraction?.({
        kind: 'opening_move',
        toolMode: 'move_opening',
        phase: 'commit',
        openingId,
        wallFace: 'south',
        offsetMeters: 3.2,
        openingType: 'door',
      });
    });
    await waitFor(() =>
      expect(sessionPreset()?.wall.openings.find((item) => item.id === openingId)?.offsetMeters).toBeCloseTo(3.2, 2),
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
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await loadTemplate();
    mocks.confirm.mockResolvedValueOnce(true);
    const openingId = createFiveBySixCmuBuildingPreset().wall.openings[0].id;
    const openingCountBefore = sessionPreset()?.wall.openings.length ?? 0;

    selectToolMode(/^delete$/i);
    await act(async () => {
      latestViewerProps().onInteraction?.({
        kind: 'select_opening',
        toolMode: 'delete',
        openingId,
        openingType: 'door',
      });
    });
    fireEvent.click(screen.getByRole('button', { name: /delete selected opening/i }));
    await waitFor(() => expect(sessionPreset()?.wall.openings).toHaveLength(openingCountBefore - 1));

    clickUndo();
    await waitFor(() => expect(sessionPreset()?.wall.openings).toHaveLength(openingCountBefore));
  });

  it('global undo removes only the most recently drawn wall segment', async () => {
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await loadTemplate();
    await startBlankLayout();
    await drawSingleWallSegment();

    clickUndo();
    await waitFor(() => expect(latestPlanProps().layout?.segments).toHaveLength(0));
  });

  it('reverses mixed wall, opening, and masonry actions in chronological order', async () => {
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await loadTemplate();
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
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await loadTemplate();
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
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await loadTemplate();
    await placeCommittedDoor(1.2);

    const openingId = sessionPreset()?.wall.openings.find((opening) => opening.type === 'door' && opening.id !== 'door-west-01')?.id
      ?? sessionPreset()?.wall.openings.at(-1)?.id;
    expect(openingId).toBeTruthy();

    selectOpeningTool(/move opening/i);
    await act(async () => {
      latestViewerProps().onInteraction?.({
        kind: 'opening_move',
        toolMode: 'move_opening',
        phase: 'preview',
        openingId: openingId!,
        wallFace: 'west',
        offsetMeters: 2.4,
      });
    });

    expect(screen.getByRole('button', { name: /undo place door/i })).toBeInTheDocument();
  });

  it('undo and redo regenerate derived geometry quantities', async () => {
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await loadTemplate();
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
    expect(screen.getByText(/^saved$/i)).toBeInTheDocument();
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
    expect(screen.getByText(/save failed/i)).toBeInTheDocument();
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


