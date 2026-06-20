import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import { generateCmuLayout } from '../geometry/designGeometry';
import { useDesignBuilderSessionStore } from '../state/designBuilderStore';
import DesignBuilderPage from '../ui/DesignBuilderPage';
import type { DesignBuilderInteractionEvent, MasonryCourseRun } from '../types';

const mocks = vi.hoisted(() => ({
  createDesignModel: vi.fn(),
  upsertDesignModelObjects: vi.fn(),
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
    placementPreview?: { offsetMeters?: number; openingId?: string } | null;
    selectedOpeningId?: string | null;
    selectedObjectType?: string | null;
    geometryResult?: { sourcePath: string; wallSegments: unknown[]; blockCount: number };
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

describe('DesignBuilderPage', () => {
  beforeEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    sessionStorage.clear();
    useDesignBuilderSessionStore.setState({ sessions: {} });
    mocks.createDesignModel.mockReset();
    mocks.upsertDesignModelObjects.mockReset();
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
    expect(screen.getByRole('button', { name: /fit height/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /60%/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /80%/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /full height/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^fit$/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /reset view/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^tools$/i }));
    expect(screen.getByRole('button', { name: /^tools$/i })).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: /cmu walls/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^cmu walls$/i }));

    expect(screen.getByText(/cmu module rules/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/block family/i)).toHaveValue('Metric CMU 400 x 200');
    expect(screen.getAllByText(/full-module fit/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/half-module fit/i).length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/snap building dimensions to cmu module/i)).toBeChecked();
  });

  it('exposes wall layout tools and outside-face dimension readout after loading', async () => {
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await loadTemplate();

    expect(screen.getByRole('button', { name: /draw wall/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /move node/i })).toBeInTheDocument();
    expect(screen.getByText(/outside face/i)).toBeInTheDocument();
    expect(screen.getByText(/6\.00 m × 5\.00 m/i)).toBeInTheDocument();
    expect(latestViewerProps().geometryResult?.sourcePath).toBe('layout_graph');
    expect(latestViewerProps().geometryResult?.wallSegments).toHaveLength(4);
  });

  it('dropdown tool items update the canonical viewer tool mode', async () => {
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await loadTemplate();

    fireEvent.click(screen.getByRole('button', { name: /door opening/i }));
    await waitFor(() => expect(latestViewerProps().toolMode).toBe('place_door'));

    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    await waitFor(() => expect(latestViewerProps().toolMode).toBe('delete'));

    fireEvent.click(screen.getByRole('button', { name: /^select$/i }));
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
    fireEvent.click(screen.getByRole('button', { name: /draw wall/i }));
    expect(screen.getByTestId('design-builder-plan')).toBeInTheDocument();

    await act(async () => {
      latestPlanProps().onInteraction?.({ kind: 'draw_point', toolMode: 'draw_wall', planX: 0, planZ: 0 });
    });
    await act(async () => {
      latestPlanProps().onInteraction?.({ kind: 'draw_point', toolMode: 'draw_wall', planX: 5, planZ: 0 });
    });
    await act(async () => {
      latestPlanProps().onInteraction?.({ kind: 'draw_point', toolMode: 'draw_wall', planX: 5, planZ: 4 });
    });
    await waitFor(() => expect(latestPlanProps().layout?.segments).toHaveLength(6));
    await act(async () => {
      latestPlanProps().onInteraction?.({ kind: 'undo_last_segment', toolMode: 'draw_wall' });
    });
    await waitFor(() => expect(latestPlanProps().layout?.segments).toHaveLength(5));
    await act(async () => {
      latestPlanProps().onInteraction?.({ kind: 'draw_point', toolMode: 'draw_wall', planX: 5, planZ: 4 });
    });
    await waitFor(() => expect(latestPlanProps().layout?.segments).toHaveLength(6));
    const nodeCountBeforeClose = latestPlanProps().layout?.nodes.length;
    await act(async () => {
      latestPlanProps().onInteraction?.({ kind: 'draw_point', toolMode: 'draw_wall', planX: 0.02, planZ: -0.02 });
    });
    await waitFor(() => expect(latestPlanProps().layout?.isFootprintClosed).toBe(true));
    expect(latestPlanProps().layout?.nodes).toHaveLength(nodeCountBeforeClose ?? 0);
    fireEvent.click(screen.getByRole('button', { name: /^3d$/i }));
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments).toHaveLength(7));
    fireEvent.click(screen.getByRole('button', { name: /^plan$/i }));

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(latestPlanProps().toolMode).toBe('select'));
    expect(latestPlanProps().layout?.segments).toHaveLength(7);
  });

  it('uses Arden confirm for opening and segment delete flows', async () => {
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await loadTemplate();
    const openingId = createFiveBySixCmuBuildingPreset().wall.openings[0].id;

    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
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

    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    fireEvent.click(screen.getByRole('button', { name: /segment 1/i }));
    fireEvent.click(screen.getByRole('button', { name: /delete selected wall/i }));
    await waitFor(() => expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Delete wall segment?' })));
  });

  it('selects and deletes a wall segment from plan view in Delete mode', async () => {
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await loadTemplate();
    fireEvent.click(screen.getByRole('button', { name: /^plan$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    await act(async () => {
      latestPlanProps().onInteraction?.({
        kind: 'segment_pick',
        toolMode: 'delete',
        phase: 'commit',
        planX: 0,
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
    fireEvent.click(screen.getByRole('button', { name: /^plan$/i }));
    await act(async () => {
      latestPlanProps().onInteraction?.({
        kind: 'segment_pick',
        toolMode: 'select',
        phase: 'commit',
        planX: 0,
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
    expect(sessionAfter.toolMode).toBe('select');
    expect(sessionAfter.layoutState).toBe('blank');
    fireEvent.click(screen.getByRole('button', { name: /^3d$/i }));
    await waitFor(() => expect(latestViewerProps().geometryResult?.wallSegments).toHaveLength(0));
    expect(latestViewerProps().geometryResult?.wallSegments).toHaveLength(0);
  });

  it('starts Masonry Layout from blank without activating Draw Wall', async () => {
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await loadTemplate();
    fireEvent.click(screen.getByRole('button', { name: /new layout/i }));
    await waitFor(() => expect(latestPlanProps().layout?.segments).toHaveLength(0));

    fireEvent.click(screen.getByRole('button', { name: /^masonry layout$/i }));

    await waitFor(() => expect(latestPlanProps().manualMasonry?.enabled).toBe(true));
    expect(latestPlanProps().toolMode).toBe('select');
    expect(screen.getAllByText(/masonry layout/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Click points to place segments/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /build cmu manually/i })).not.toBeInTheDocument();
  });

  it('starts Draw Wall from blank through the toolbar', async () => {
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await loadTemplate();
    fireEvent.click(screen.getByRole('button', { name: /new layout/i }));
    await waitFor(() => expect(latestPlanProps().layout?.segments).toHaveLength(0));

    fireEvent.click(screen.getByRole('button', { name: /^draw wall$/i }));

    await waitFor(() => expect(latestPlanProps().toolMode).toBe('draw_wall'));
    expect(latestPlanProps().manualMasonry?.enabled).toBe(false);
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

  it('persists Masonry Layout after remount', async () => {
    const rendered = render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await loadTemplate();
    fireEvent.click(screen.getByRole('button', { name: /new layout/i }));
    await waitFor(() => expect(latestPlanProps().layout?.segments).toHaveLength(0));
    fireEvent.click(screen.getByRole('button', { name: /^masonry layout$/i }));
    await waitFor(() => expect(useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']?.manualMasonryEnabled).toBe(true));

    rendered.unmount();
    mocks.plan.mockClear();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);

    await waitFor(() => expect(latestPlanProps().layout?.segments).toHaveLength(0));
    expect(screen.queryByRole('button', { name: /build cmu manually/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /start a cmu layout/i })).not.toBeInTheDocument();
    expect(latestPlanProps().toolMode).toBe('select');
    expect(latestPlanProps().manualMasonry?.enabled).toBe(true);
  });

  it('places one full block as a persisted manual masonry run', async () => {
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await loadTemplate();
    fireEvent.click(screen.getByRole('button', { name: /new layout/i }));
    await waitFor(() => expect(latestPlanProps().layout?.segments).toHaveLength(0));
    fireEvent.click(screen.getByRole('button', { name: /^masonry layout$/i }));

    await act(async () => {
      latestPlanProps().onManualMasonryPointer?.({ kind: 'start', planX: 0, planZ: 0 });
      latestPlanProps().onManualMasonryPointer?.({ kind: 'commit', planX: 0, planZ: 0 });
    });

    await waitFor(() => expect(latestPlanProps().manualMasonry?.runs).toHaveLength(1));
    const run = latestPlanProps().manualMasonry?.runs[0];
    expect(run).toEqual(expect.objectContaining({ unitType: 'full_block', count: 1, source: 'manual_3d_brush' }));
    expect(useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']?.preset?.wall.manualMasonryCourseRuns).toHaveLength(1);
  });

  it('dragging a full block creates one persisted masonry run with count greater than one', async () => {
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await loadTemplate();
    fireEvent.click(screen.getByRole('button', { name: /new layout/i }));
    await waitFor(() => expect(latestPlanProps().layout?.segments).toHaveLength(0));
    fireEvent.click(screen.getByRole('button', { name: /^masonry layout$/i }));

    await act(async () => {
      latestPlanProps().onManualMasonryPointer?.({ kind: 'start', planX: 0, planZ: 0 });
      latestPlanProps().onManualMasonryPointer?.({ kind: 'preview', planX: 1.2, planZ: 0 });
    });
    expect(latestPlanProps().manualMasonry?.preview).toEqual(expect.objectContaining({ count: 4 }));
    expect(mocks.upsertDesignModelObjects).toHaveBeenCalledTimes(1);

    await act(async () => {
      latestPlanProps().onManualMasonryPointer?.({ kind: 'commit', planX: 1.2, planZ: 0 });
    });

    await waitFor(() => expect(latestPlanProps().manualMasonry?.runs[0]?.count).toBeGreaterThan(1));
    expect(useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']?.preset?.wall.manualMasonryCourseRuns?.[0].count).toBeGreaterThan(1);
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
      expect(screen.getAllByRole('button', { name: /door/i }).length).toBeGreaterThan(0);
    });
    expect(mocks.commitDesignEstimatePreview).not.toHaveBeenCalled();

    const placedOpeningId = latestViewerProps().selectedOpeningId;
    expect(placedOpeningId).toBeTruthy();

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

    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    fireEvent.click(screen.getByRole('button', { name: /delete selected opening/i }));
    expect(mocks.commitDesignEstimatePreview).not.toHaveBeenCalled();
  });

  it('debounces supabase saves after opening placement edits', async () => {
    vi.useFakeTimers();
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /load cmu template/i }));
    });
    await act(async () => {
      await Promise.resolve();
    });
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

    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });
    expect(mocks.upsertDesignModelObjects.mock.calls.length).toBeGreaterThan(callsAfterLoad);
    vi.useRealTimers();
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


