import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDesignBuilderSessionStore } from '../state/designBuilderStore';
import DesignBuilderPage from '../ui/DesignBuilderPage';
import {
  seedLoadedDesignBuilderTemplate,
  waitForLoadedDesignBuilderTemplate,
} from './designBuilderPageTestHelpers';

const mocks = vi.hoisted(() => ({
  createDesignModel: vi.fn(),
  upsertDesignModelObjects: vi.fn(),
  findDesignModelByEstimateId: vi.fn(),
  listDesignModelObjects: vi.fn(),
  updateDesignModelMetadata: vi.fn(),
  persistDesignEstimatePreview: vi.fn(),
  commitDesignEstimatePreview: vi.fn(),
  confirm: vi.fn(),
}));

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('../../../contexts/ConfirmContext', () => ({
  useConfirm: () => mocks.confirm,
}));

vi.mock('../ui/DesignBuilderPlanCanvas', () => ({
  default: () => <div data-testid="design-builder-plan">Plan</div>,
}));

vi.mock('../ui/DesignBuilderViewer', () => ({
  default: () => <div data-testid="design-builder-viewer">Viewer</div>,
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

function commandMenus() {
  return Array.from(document.querySelectorAll('[data-design-builder-command-menu]'));
}

function openStructureMenu() {
  const menu = commandMenus().find((element) =>
    within(element as HTMLElement).queryByRole('button', { name: /structure:/i }) != null,
  );
  if (!menu) throw new Error('Structure menu not found');
  fireEvent.click(within(menu as HTMLElement).getByRole('button', { name: /structure:/i }));
}

function structureMenuItems() {
  return screen.getAllByRole('menuitem').map((item) => item.textContent?.trim() ?? '');
}

async function loadTemplate() {
  seedLoadedDesignBuilderTemplate();
  await waitForLoadedDesignBuilderTemplate();
}

function renderLoadedDesignBuilder() {
  seedLoadedDesignBuilderTemplate();
  return render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
}

async function selectRcFrameMode() {
  openStructureMenu();
  fireEvent.click(screen.getByRole('menuitem', { name: 'RC Frame + CMU Infill' }));
  await waitFor(() => {
    expect(
      useDesignBuilderSessionStore.getState().sessions['project-1:estimate-1']?.preset?.buildingSystemMode,
    ).toBe('reinforced_concrete_frame_with_cmu_infill');
  });
}

describe('Structure dropdown — unified frame modal', () => {
  beforeEach(() => {
    vi.useRealTimers();
    sessionStorage.clear();
    useDesignBuilderSessionStore.setState({ sessions: {} });
    mocks.confirm.mockResolvedValue(false);
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
      ],
      error: null,
    });
    mocks.findDesignModelByEstimateId.mockResolvedValue({ data: null, error: null });
    mocks.listDesignModelObjects.mockResolvedValue({ data: [], error: null });
    mocks.updateDesignModelMetadata.mockResolvedValue({ data: null, error: null });
  });

  it('shows only system modes in CMU bearing wall mode', async () => {
    renderLoadedDesignBuilder();
    await waitForLoadedDesignBuilderTemplate();
    openStructureMenu();
    const items = structureMenuItems();
    expect(items).toContain('CMU Bearing Wall');
    expect(items).toContain('RC Frame + CMU Infill');
    expect(items).not.toContain('Add Corner Columns');
    expect(items).not.toContain('Auto Frame Layout');
    expect(items).not.toContain('Add Plinth / Roof / Tie Beams');
    expect(items).not.toContain('Add / Edit Gable End');
    expect(items).not.toContain('Frame, Foundation & Roof Dimensions');
  });

  it('opens unified modal when RC Frame + CMU Infill is selected', async () => {
    renderLoadedDesignBuilder();
    await waitForLoadedDesignBuilderTemplate();
    await selectRcFrameMode();
    await waitFor(() => {
      expect(
        screen.getByRole('dialog', { name: /frame, foundation & roof dimensions/i }),
      ).toBeInTheDocument();
    });
  });

  it('opens unified modal when Frame, Foundation & Roof Dimensions is clicked', async () => {
    renderLoadedDesignBuilder();
    await waitForLoadedDesignBuilderTemplate();
    await selectRcFrameMode();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /frame, foundation & roof dimensions/i })).not.toBeInTheDocument();
    });
    openStructureMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Frame, Foundation & Roof Dimensions' }));
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /frame, foundation & roof dimensions/i })).toBeInTheDocument();
    });
  });

  it('shows Frame, Foundation & Roof Dimensions when RC mode is active', async () => {
    renderLoadedDesignBuilder();
    await waitForLoadedDesignBuilderTemplate();
    await selectRcFrameMode();
    openStructureMenu();
    const items = structureMenuItems();
    expect(items).toContain('Frame, Foundation & Roof Dimensions');
    expect(items).not.toContain('Add Corner Columns');
  });

  it('does not open modal when switching to CMU Bearing Wall', async () => {
    renderLoadedDesignBuilder();
    await waitForLoadedDesignBuilderTemplate();
    await selectRcFrameMode();
    openStructureMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'CMU Bearing Wall' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /frame, foundation & roof dimensions/i })).not.toBeInTheDocument();
    });
  });
});
