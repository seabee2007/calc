import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DesignBuilderPage from '../ui/DesignBuilderPage';
import { useDesignBuilderSessionStore } from '../state/designBuilderStore';

const mocks = vi.hoisted(() => ({
  plan: vi.fn(),
  confirm: vi.fn(),
  setFocusMode: vi.fn(),
}));

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('../../../contexts/ConfirmContext', () => ({
  useConfirm: () => mocks.confirm,
}));

vi.mock('../../estimating/ui/EstimateWorkspaceHeaderCollapseContext', () => ({
  useEstimateWorkspaceHeaderCollapse: () => ({
    enabled: true,
    focusMode: true,
    setFocusMode: mocks.setFocusMode,
    isMobile: false,
    portalReady: false,
    portalTargetRef: { current: null },
    miniStatus: null,
    setMiniStatus: vi.fn(),
    toggleFocusMode: vi.fn(),
  }),
}));

vi.mock('../ui/DesignBuilderPlanCanvas', () => ({
  default: (props: Record<string, unknown>) => {
    mocks.plan(props);
    return <div data-testid="design-builder-plan">Plan layout</div>;
  },
}));

vi.mock('../ui/DesignBuilderViewer', () => ({
  default: () => <div data-testid="design-builder-viewer">Generated preview</div>,
}));

vi.mock('../services/designBuilderService', () => ({
  createDesignModel: vi.fn(),
  upsertDesignModelObjects: vi.fn(),
}));

vi.mock('../application/designBuilderToEstimate', () => ({
  persistDesignEstimatePreview: vi.fn(),
  commitDesignEstimatePreview: vi.fn(),
}));

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

function latestPlanProps() {
  return (mocks.plan.mock.calls.at(-1)?.[0] ?? {}) as {
    toolMode?: string;
    layout?: { orthogonalLock?: boolean };
  };
}

describe('Design Builder draw wall settings', () => {
  beforeEach(() => {
    mocks.plan.mockClear();
    mocks.setFocusMode.mockClear();
    mocks.confirm.mockReset();
    sessionStorage.clear();
    useDesignBuilderSessionStore.setState({ sessions: {} });
  });

  it('starts Draw Wall with orthogonal guides enabled on a blank layout', async () => {
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    openMenuByKind('tools');
    chooseCommandMenuItem(/^draw wall$/i);
    await waitFor(() => expect(latestPlanProps().toolMode).toBe('draw_wall'));
    expect(latestPlanProps().layout?.orthogonalLock).toBe(true);
  });

  it('returns to Select on Escape without exiting Focus mode', async () => {
    render(<DesignBuilderPage projectId="project-1" estimateId="estimate-1" />);
    openMenuByKind('tools');
    chooseCommandMenuItem(/^draw wall$/i);
    await waitFor(() => expect(latestPlanProps().toolMode).toBe('draw_wall'));

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => expect(latestPlanProps().toolMode).toBe('select'));
    expect(mocks.setFocusMode).not.toHaveBeenCalled();
  });
});
