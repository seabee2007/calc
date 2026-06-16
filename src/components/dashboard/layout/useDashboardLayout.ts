import { useCallback, useMemo, useState } from 'react';
import {
  clampCardWidth,
  getDefaultDashboardLayout,
  type DashboardCardId,
  type DashboardLayout,
  type DashboardLayoutItem,
} from '../../../lib/dashboardLayout';

/** A position update coming back from the grid engine (drag/resize stop). */
export interface DashboardItemPosition {
  id: DashboardCardId;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DashboardLayoutController {
  layout: DashboardLayout;
  /** Items sorted by reading order (y, then x). */
  orderedItems: DashboardLayoutItem[];
  customizing: boolean;
  setCustomizing: (value: boolean) => void;
  /** Apply x/y/w from the grid after a drag or resize. Height is owned by the
   * grid's content measurement, so existing heights are preserved. */
  applyPositions: (positions: DashboardItemPosition[]) => void;
  /** Explicit width change from the size controls (in grid columns). */
  setCardWidth: (id: DashboardCardId, w: number) => void;
  /** Measured content height (in grid rows) for a card. */
  setCardHeight: (id: DashboardCardId, h: number) => void;
  resetLayout: () => void;
}

/**
 * Phase 2B: local-only grid layout state (no persistence). Holds the working
 * layout (x/y/w/h per card), the customize-mode flag, and the operations the
 * grid editor needs. Phase 3 will layer loading from and debounced saving to
 * user_preferences on top of this.
 */
export function useDashboardLayout(): DashboardLayoutController {
  const [layout, setLayout] = useState<DashboardLayout>(() => getDefaultDashboardLayout());
  const [customizing, setCustomizing] = useState(false);

  const orderedItems = useMemo(
    () => [...layout.items].sort((a, b) => a.y - b.y || a.x - b.x),
    [layout],
  );

  const applyPositions = useCallback((positions: DashboardItemPosition[]) => {
    if (positions.length === 0) return;
    const byId = new Map(positions.map((p) => [p.id, p]));
    setLayout((prev) => {
      let changed = false;
      const items = prev.items.map((item) => {
        const next = byId.get(item.id);
        if (!next) return item;
        if (next.x === item.x && next.y === item.y && next.w === item.w) {
          return item;
        }
        changed = true;
        // Height is measured by the grid; keep the current value.
        return { ...item, x: next.x, y: next.y, w: next.w };
      });
      return changed ? { ...prev, items } : prev;
    });
  }, []);

  const setCardWidth = useCallback((id: DashboardCardId, w: number) => {
    setLayout((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === id ? { ...item, w: clampCardWidth(id, w) } : item,
      ),
    }));
  }, []);

  const setCardHeight = useCallback((id: DashboardCardId, h: number) => {
    setLayout((prev) => {
      const current = prev.items.find((item) => item.id === id);
      if (!current || current.h === h) return prev;
      return {
        ...prev,
        items: prev.items.map((item) => (item.id === id ? { ...item, h } : item)),
      };
    });
  }, []);

  const resetLayout = useCallback(() => {
    setLayout(getDefaultDashboardLayout());
  }, []);

  return {
    layout,
    orderedItems,
    customizing,
    setCustomizing,
    applyPositions,
    setCardWidth,
    setCardHeight,
    resetLayout,
  };
}
