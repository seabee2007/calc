import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDashboardLayout } from './useDashboardLayout';
import {
  DEFAULT_VISIBLE_CARD_IDS,
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

    // Unknown card dropped, missing default-visible cards appended.
    const ids = result.current.layout.items.map((i) => i.id) as string[];
    expect(ids).not.toContain('totallyUnknownCard');
    expect(result.current.layout.items).toHaveLength(DEFAULT_VISIBLE_CARD_IDS.length);

    await advanceAndFlush();
    expect(updateDashboardLayout).toHaveBeenCalledTimes(1);
    const savedArg = updateDashboardLayout.mock.calls[0][0] as DashboardLayout;
    expect(savedArg.items).toHaveLength(DEFAULT_VISIBLE_CARD_IDS.length);
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

  it('adds an optional widget and persists it', async () => {
    const { result } = renderHook(() => useDashboardLayout());
    await flush();

    expect(result.current.activeIds.has('quickActions')).toBe(false);

    act(() => result.current.addWidget('quickActions'));
    expect(result.current.activeIds.has('quickActions')).toBe(true);

    await advanceAndFlush();
    expect(updateDashboardLayout).toHaveBeenCalledTimes(1);
    const savedArg = updateDashboardLayout.mock.calls[0][0] as DashboardLayout;
    expect(savedArg.items.some((i) => i.id === 'quickActions')).toBe(true);
  });

  it('adds a Phase 5A tool widget and persists it', async () => {
    const { result } = renderHook(() => useDashboardLayout());
    await flush();

    act(() => result.current.addWidget('ardenCalc'));
    expect(result.current.activeIds.has('ardenCalc')).toBe(true);

    await advanceAndFlush();
    const savedArg = updateDashboardLayout.mock.calls[0][0] as DashboardLayout;
    expect(savedArg.items.some((i) => i.id === 'ardenCalc')).toBe(true);
  });

  it('reloads an added tool widget from saved preferences', async () => {
    const saved = getDefaultDashboardLayout();
    saved.items = [...saved.items, { id: 'ardenCalc', x: 0, y: 950, w: 6, h: 4 }];
    getUserPreferences.mockResolvedValue({ dashboardLayout: saved });

    const { result } = renderHook(() => useDashboardLayout());
    await flush();

    expect(result.current.activeIds.has('ardenCalc')).toBe(true);
  });

  it('is a no-op when adding a widget that is already active', async () => {
    const { result } = renderHook(() => useDashboardLayout());
    await flush();

    act(() => result.current.addWidget('businessSnapshot'));
    await advanceAndFlush();
    // businessSnapshot is already in the default layout — nothing to save.
    expect(updateDashboardLayout).not.toHaveBeenCalled();
  });

  it('removes a widget and persists the removal', async () => {
    const { result } = renderHook(() => useDashboardLayout());
    await flush();

    act(() => result.current.addWidget('quickActions'));
    await advanceAndFlush();
    updateDashboardLayout.mockClear();

    act(() => result.current.removeWidget('quickActions'));
    expect(result.current.activeIds.has('quickActions')).toBe(false);

    await advanceAndFlush();
    expect(updateDashboardLayout).toHaveBeenCalledTimes(1);
    const savedArg = updateDashboardLayout.mock.calls[0][0] as DashboardLayout;
    expect(savedArg.items.some((i) => i.id === 'quickActions')).toBe(false);
  });

  it('reset layout removes optional tool widgets', async () => {
    const { result } = renderHook(() => useDashboardLayout());
    await flush();

    act(() => result.current.addWidget('ardenCalc'));
    expect(result.current.activeIds.has('ardenCalc')).toBe(true);

    act(() => result.current.resetLayout());
    expect(result.current.activeIds.has('ardenCalc')).toBe(false);
    expect(result.current.orderedItems).toEqual(getDefaultDashboardLayout().items);
  });

  it('adds weather forecast widget and reset removes it', async () => {
    const { result } = renderHook(() => useDashboardLayout());
    await flush();

    act(() => result.current.addWidget('weatherForecast'));
    expect(result.current.activeIds.has('weatherForecast')).toBe(true);

    act(() => result.current.resetLayout());
    expect(result.current.activeIds.has('weatherForecast')).toBe(false);
  });

  it('adds usage meter widget and reset removes it', async () => {
    const { result } = renderHook(() => useDashboardLayout());
    await flush();

    act(() => result.current.addWidget('usageMeter'));
    expect(result.current.activeIds.has('usageMeter')).toBe(true);

    act(() => result.current.removeWidget('usageMeter'));
    expect(result.current.activeIds.has('usageMeter')).toBe(false);

    act(() => result.current.addWidget('usageMeter'));
    act(() => result.current.resetLayout());
    expect(result.current.activeIds.has('usageMeter')).toBe(false);
  });

  it('reset restores default x/y/w/h coordinates — does not keep stale custom positions', async () => {
    const { result } = renderHook(() => useDashboardLayout());
    await flush();

    // Simulate dragging activeProjects to a non-default position.
    act(() => {
      result.current.applyPositions([{ id: 'activeProjects', x: 6, y: 999, w: 4, h: 8 }]);
    });
    const stale = result.current.layout.items.find((i) => i.id === 'activeProjects');
    expect(stale?.x).toBe(6);
    expect(stale?.y).toBe(999);

    act(() => result.current.resetLayout());

    const defaultMeta = getDefaultDashboardLayout().items.find((i) => i.id === 'activeProjects');
    const restored = result.current.layout.items.find((i) => i.id === 'activeProjects');
    expect(restored?.x).toBe(defaultMeta?.x);
    expect(restored?.y).toBe(defaultMeta?.y);
    expect(restored?.w).toBe(defaultMeta?.w);
    expect(restored?.h).toBe(defaultMeta?.h);
  });

  it('reset restores only defaultVisible widgets', async () => {
    const { result } = renderHook(() => useDashboardLayout());
    await flush();

    // Add several optional widgets.
    act(() => {
      result.current.addWidget('ardenCalc');
      result.current.addWidget('quickActions');
    });
    expect(result.current.activeIds.has('ardenCalc')).toBe(true);
    expect(result.current.activeIds.has('quickActions')).toBe(true);

    act(() => result.current.resetLayout());

    // Only default-visible widgets should be present.
    const ids = [...result.current.activeIds];
    expect(ids).toHaveLength(DEFAULT_VISIBLE_CARD_IDS.length);
    expect(ids).not.toContain('ardenCalc');
    expect(ids).not.toContain('quickActions');
    DEFAULT_VISIBLE_CARD_IDS.forEach((id) => expect(ids).toContain(id));
  });

  it('incrementing gridKey on reset — does not increment on add/remove', async () => {
    const { result } = renderHook(() => useDashboardLayout());
    await flush();

    const initialKey = result.current.gridKey;
    expect(result.current.isLayoutReady).toBe(true);

    // add and remove should not touch the key.
    act(() => result.current.addWidget('ardenCalc'));
    expect(result.current.gridKey).toBe(initialKey);

    act(() => result.current.removeWidget('ardenCalc'));
    expect(result.current.gridKey).toBe(initialKey);

    // Reset must bump the key.
    act(() => result.current.resetLayout());
    expect(result.current.gridKey).toBe(initialKey + 1);

    // Each additional reset increments again.
    act(() => result.current.resetLayout());
    expect(result.current.gridKey).toBe(initialKey + 2);
  });

  it('bumps gridKey after hydration so route remount gets a fresh RGL instance', async () => {
    const { result } = renderHook(() => useDashboardLayout());
    expect(result.current.isLayoutReady).toBe(false);
    await flush();
    expect(result.current.isLayoutReady).toBe(true);
    expect(result.current.gridKey).toBeGreaterThan(0);
  });

  it('reset layout returns non-overlapping default items', async () => {
    const { result } = renderHook(() => useDashboardLayout());
    await flush();

    act(() => {
      result.current.applyPositions([
        { id: 'activeProjects', x: 0, y: 5, w: 6, h: 3 },
        { id: 'projectControls', x: 0, y: 5, w: 6, h: 4 },
      ]);
    });

    act(() => result.current.resetLayout());
    const defaults = getDefaultDashboardLayout();
    expect(result.current.orderedItems).toEqual(defaults.items);
  });
});
