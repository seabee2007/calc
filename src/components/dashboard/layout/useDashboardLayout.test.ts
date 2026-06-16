import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDashboardLayout } from './useDashboardLayout';
import {
  DASHBOARD_CARD_META,
  DASHBOARD_LAYOUT_VERSION,
  getDefaultDashboardLayout,
} from '../../../lib/dashboardLayout';

describe('useDashboardLayout', () => {
  it('starts from the default layout in customize-off mode', () => {
    const { result } = renderHook(() => useDashboardLayout());

    expect(result.current.customizing).toBe(false);
    expect(result.current.layout.version).toBe(DASHBOARD_LAYOUT_VERSION);
    expect(result.current.orderedItems).toEqual(getDefaultDashboardLayout().items);

    // orderedItems is sorted by reading order (y, then x).
    const items = result.current.orderedItems;
    for (let i = 1; i < items.length; i += 1) {
      const prev = items[i - 1];
      const cur = items[i];
      expect(prev.y < cur.y || (prev.y === cur.y && prev.x <= cur.x)).toBe(true);
    }
  });

  it('toggles customize mode', () => {
    const { result } = renderHook(() => useDashboardLayout());

    act(() => result.current.setCustomizing(true));
    expect(result.current.customizing).toBe(true);

    act(() => result.current.setCustomizing(false));
    expect(result.current.customizing).toBe(false);
  });

  it('applies x/y/w positions from the grid but preserves measured height', () => {
    const { result } = renderHook(() => useDashboardLayout());
    const before = result.current.layout.items.find((i) => i.id === 'activeProjects')!;

    act(() =>
      result.current.applyPositions([
        { id: 'activeProjects', x: 6, y: 999, w: 4, h: before.h + 5 },
      ]),
    );

    const after = result.current.layout.items.find((i) => i.id === 'activeProjects')!;
    expect(after.x).toBe(6);
    expect(after.y).toBe(999);
    expect(after.w).toBe(4);
    // Height is owned by content measurement, not the grid drag/resize stop.
    expect(after.h).toBe(before.h);
  });

  it('changes width via the size controls (clamped to allowed range)', () => {
    const { result } = renderHook(() => useDashboardLayout());

    act(() => result.current.setCardWidth('activeProjects', 12));
    expect(result.current.layout.items.find((i) => i.id === 'activeProjects')?.w).toBe(12);

    // todaysOperations is full-only; any width clamps to 12.
    act(() => result.current.setCardWidth('todaysOperations', 4));
    expect(result.current.layout.items.find((i) => i.id === 'todaysOperations')?.w).toBe(12);
  });

  it('updates measured height for a card', () => {
    const { result } = renderHook(() => useDashboardLayout());

    act(() => result.current.setCardHeight('businessSnapshot', 42));
    expect(result.current.layout.items.find((i) => i.id === 'businessSnapshot')?.h).toBe(42);
  });

  it('resets back to the default layout', () => {
    const { result } = renderHook(() => useDashboardLayout());

    act(() =>
      result.current.applyPositions([{ id: 'activeProjects', x: 6, y: 999, w: 4, h: 4 }]),
    );
    act(() => result.current.setCardWidth('proposalPipeline', 12));

    act(() => result.current.resetLayout());

    expect(result.current.orderedItems).toEqual(getDefaultDashboardLayout().items);
    expect(result.current.layout.items.find((i) => i.id === 'proposalPipeline')?.w).toBe(
      DASHBOARD_CARD_META.proposalPipeline.default.w,
    );
  });
});
