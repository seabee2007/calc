import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDashboardLayout } from './useDashboardLayout';
import {
  DASHBOARD_CARD_IDS,
  getDefaultDashboardLayout,
  type DashboardLayout,
} from '../../../lib/dashboardLayout';

const getUserPreferences = vi.fn();
const updateDashboardLayout = vi.fn();

vi.mock('../../../services/userPreferencesService', () => ({
  getUserPreferences: () => getUserPreferences(),
  updateDashboardLayout: (layout: DashboardLayout) => updateDashboardLayout(layout),
}));

/** Let the mounted load promise (and any chained microtasks) settle. */
async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

/** Advance past the save debounce, then flush the save promise. */
async function advanceAndFlush(ms = 1000) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('useDashboardLayout persistence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getUserPreferences.mockReset();
    updateDashboardLayout.mockReset();
    getUserPreferences.mockResolvedValue({ dashboardLayout: null });
    updateDashboardLayout.mockResolvedValue({ dashboardLayout: null });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('uses the default layout when the user has no saved layout', async () => {
    const { result } = renderHook(() => useDashboardLayout());
    await flush();

    expect(result.current.orderedItems).toEqual(getDefaultDashboardLayout().items);
    // Loading the default must never trigger a save.
    await advanceAndFlush();
    expect(updateDashboardLayout).not.toHaveBeenCalled();
  });

  it('applies a valid saved layout without re-saving it', async () => {
    const saved = getDefaultDashboardLayout();
    saved.items = saved.items.map((item) =>
      item.id === 'activeProjects' ? { ...item, w: 12 } : item,
    );
    getUserPreferences.mockResolvedValue({ dashboardLayout: saved });

    const { result } = renderHook(() => useDashboardLayout());
    await flush();

    expect(result.current.layout.items.find((i) => i.id === 'activeProjects')?.w).toBe(12);
    await advanceAndFlush();
    // Already canonical: no cleanup save.
    expect(updateDashboardLayout).not.toHaveBeenCalled();
  });

  it('migrates an invalid saved layout and persists the cleaned version once', async () => {
    getUserPreferences.mockResolvedValue({
      dashboardLayout: {
        version: 2,
        items: [
          { id: 'businessSnapshot', x: 0, y: 0, w: 12, h: 4 },
          { id: 'totallyUnknownCard', x: 0, y: 1, w: 6, h: 4 },
        ],
      },
    });

    const { result } = renderHook(() => useDashboardLayout());
    await flush();

    // Unknown card dropped, missing registry cards appended.
    const ids = result.current.layout.items.map((i) => i.id) as string[];
    expect(ids).not.toContain('totallyUnknownCard');
    expect(result.current.layout.items).toHaveLength(DASHBOARD_CARD_IDS.length);

    await advanceAndFlush();
    expect(updateDashboardLayout).toHaveBeenCalledTimes(1);
    const savedArg = updateDashboardLayout.mock.calls[0][0] as DashboardLayout;
    expect(savedArg.items).toHaveLength(DASHBOARD_CARD_IDS.length);
  });

  it('saves after a drag/position commit (debounced once)', async () => {
    const { result } = renderHook(() => useDashboardLayout());
    await flush();

    act(() => {
      result.current.applyPositions([{ id: 'activeProjects', x: 6, y: 999, w: 4, h: 4 }]);
    });
    act(() => {
      result.current.applyPositions([{ id: 'activeProjects', x: 0, y: 5, w: 6, h: 4 }]);
    });

    await advanceAndFlush();
    // Two rapid commits collapse into a single debounced save.
    expect(updateDashboardLayout).toHaveBeenCalledTimes(1);
    expect(result.current.saveStatus).toBe('saved');
  });

  it('does not save when only the measured height changes', async () => {
    const { result } = renderHook(() => useDashboardLayout());
    await flush();

    act(() => result.current.setCardHeight('businessSnapshot', 99));

    await advanceAndFlush();
    expect(updateDashboardLayout).not.toHaveBeenCalled();
    expect(result.current.layout.items.find((i) => i.id === 'businessSnapshot')?.h).toBe(99);
  });

  it('persists the default layout on reset', async () => {
    const { result } = renderHook(() => useDashboardLayout());
    await flush();

    act(() => result.current.setCardWidth('proposalPipeline', 12));
    await advanceAndFlush();
    updateDashboardLayout.mockClear();

    act(() => result.current.resetLayout());
    await advanceAndFlush();

    expect(updateDashboardLayout).toHaveBeenCalledTimes(1);
    const savedArg = updateDashboardLayout.mock.calls[0][0] as DashboardLayout;
    expect(savedArg.items).toEqual(getDefaultDashboardLayout().items);
    expect(result.current.orderedItems).toEqual(getDefaultDashboardLayout().items);
  });

  it('keeps the local layout and reports an error when saving fails', async () => {
    updateDashboardLayout.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useDashboardLayout());
    await flush();

    act(() => {
      result.current.applyPositions([{ id: 'activeProjects', x: 6, y: 5, w: 4, h: 4 }]);
    });
    await advanceAndFlush();

    expect(result.current.saveStatus).toBe('error');
    // Local change is preserved despite the failed save.
    const active = result.current.layout.items.find((i) => i.id === 'activeProjects');
    expect(active?.x).toBe(6);
    expect(active?.w).toBe(4);
  });
});
