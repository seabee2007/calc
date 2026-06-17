import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildAddedWidgetItem,
  clampCardWidth,
  getDefaultDashboardLayout,
  validateAndMigrateLayout,
  type DashboardCardId,
  type DashboardLayout,
  type DashboardLayoutItem,
  type DashboardLayoutItemConfig,
} from '../../../lib/dashboardLayout';
import {
  getUserPreferences,
  updateDashboardLayout,
} from '../../../services/userPreferencesService';

/** A position update coming back from the grid engine (drag/resize stop). */
export interface DashboardItemPosition {
  id: DashboardCardId;
  x: number;
  y: number;
  w: number;
  h: number;
}

export type DashboardSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface DashboardLayoutController {
  layout: DashboardLayout;
  /** Items sorted by reading order (y, then x). */
  orderedItems: DashboardLayoutItem[];
  /** Ids currently placed on the dashboard (presence === active widget). */
  activeIds: Set<DashboardCardId>;
  customizing: boolean;
  /** Persistence feedback for the customize UI. */
  saveStatus: DashboardSaveStatus;
  /**
   * Incremented after layout hydration and on every explicit reset. Pass as part
   * of the grid `key` so RGL discards stale internal position cache on route
   * remount or reset.
   */
  gridKey: number;
  /** False until saved preferences have been loaded (or load failed). */
  isLayoutReady: boolean;
  setCustomizing: (value: boolean) => void;
  /** Apply x/y/w from the grid after a drag or resize. Height is owned by the
   * grid's content measurement, so existing heights are preserved. */
  applyPositions: (positions: DashboardItemPosition[]) => void;
  /** Explicit width change from the size controls (in grid columns). */
  setCardWidth: (id: DashboardCardId, w: number) => void;
  /** Measured content height (in grid rows) for a card. */
  setCardHeight: (id: DashboardCardId, h: number) => void;
  /** Add a catalog widget to the dashboard (no-op if already active). */
  addWidget: (id: DashboardCardId) => void;
  /** Remove a widget from the dashboard (stays available in the catalog). */
  removeWidget: (id: DashboardCardId) => void;
  resetLayout: () => void;
  /** Merge per-widget config onto a layout item and persist. */
  setWidgetConfig: (id: DashboardCardId, config: DashboardLayoutItemConfig) => void;
}

/** Collapse rapid layout commits (RGL can fire several) into one save. */
const SAVE_DEBOUNCE_MS = 800;
/** How long the "Saved" indicator stays visible before fading to idle. */
const SAVED_INDICATOR_MS = 2000;

/**
 * Phase 3: per-user grid layout with Supabase persistence.
 *
 * - Loads the saved layout once on mount (default when absent), validating and
 *   migrating any stored value so a corrupt layout never breaks the dashboard.
 * - Saves only after meaningful user actions (drag/resize stop, size change,
 *   reset), debounced, and never while loading or when nothing changed — which
 *   keeps loading and content-measurement from triggering save loops.
 * - Keeps the local layout if a save fails and surfaces the failure via
 *   `saveStatus` so the user can keep arranging; the next successful save
 *   persists the latest local state.
 *
 * Height changes come from content measurement (not a user action), so they
 * update local state but do not trigger a save; the latest measured height
 * rides along on the next user-action save.
 */
export function useDashboardLayout(): DashboardLayoutController {
  const [layout, setLayout] = useState<DashboardLayout>(() => getDefaultDashboardLayout());
  const [customizing, setCustomizing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<DashboardSaveStatus>('idle');
  const [gridKey, setGridKey] = useState(0);
  const [isLayoutReady, setIsLayoutReady] = useState(false);

  const layoutRef = useRef(layout);
  const hydratedRef = useRef(false);
  const mountedRef = useRef(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedJsonRef = useRef<string | null>(null);

  const setLayoutTracked = useCallback((next: DashboardLayout) => {
    layoutRef.current = next;
    setLayout(next);
  }, []);

  const persist = useCallback((next: DashboardLayout) => {
    const json = JSON.stringify(next);
    // Nothing changed since the last successful save — skip the round trip.
    if (json === lastSavedJsonRef.current) return;
    setSaveStatus('saving');
    void updateDashboardLayout(next)
      .then(() => {
        if (!mountedRef.current) return;
        lastSavedJsonRef.current = json;
        setSaveStatus('saved');
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => {
          if (mountedRef.current) setSaveStatus('idle');
        }, SAVED_INDICATOR_MS);
      })
      .catch(() => {
        if (!mountedRef.current) return;
        // Keep the local layout; the latest state persists on the next save.
        setSaveStatus('error');
      });
  }, []);

  const scheduleSave = useCallback(
    (next: DashboardLayout) => {
      // Never save during/before the initial load (avoids load->save loops).
      if (!hydratedRef.current) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => persist(next), SAVE_DEBOUNCE_MS);
    },
    [persist],
  );

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    void (async () => {
      try {
        const prefs = await getUserPreferences();
        if (cancelled) return;
        if (prefs.dashboardLayout) {
          const migrated = validateAndMigrateLayout(prefs.dashboardLayout);
          setLayoutTracked(migrated);
          hydratedRef.current = true;
          setIsLayoutReady(true);
          setGridKey((k) => k + 1);
          const rawJson = JSON.stringify(prefs.dashboardLayout);
          const migratedJson = JSON.stringify(migrated);
          if (rawJson === migratedJson) {
            // Already canonical — remember it so we don't re-save an identical layout.
            lastSavedJsonRef.current = migratedJson;
          } else {
            // Saved layout was invalid/legacy: persist the cleaned version once.
            scheduleSave(migrated);
          }
        } else {
          hydratedRef.current = true;
          setIsLayoutReady(true);
          setGridKey((k) => k + 1);
        }
      } catch {
        // Load failed: keep the default layout and allow customizing/saving.
        if (!cancelled) {
          hydratedRef.current = true;
          setIsLayoutReady(true);
          setGridKey((k) => k + 1);
        }
      }
    })();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, [scheduleSave, setLayoutTracked]);

  const orderedItems = useMemo(
    () => [...layout.items].sort((a, b) => a.y - b.y || a.x - b.x),
    [layout],
  );

  const activeIds = useMemo(
    () => new Set(layout.items.map((item) => item.id)),
    [layout],
  );

  const applyPositions = useCallback(
    (positions: DashboardItemPosition[]) => {
      if (positions.length === 0) return;
      const prev = layoutRef.current;
      const byId = new Map(positions.map((p) => [p.id, p]));
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
      if (!changed) return;
      const next = { ...prev, items };
      setLayoutTracked(next);
      scheduleSave(next);
    },
    [scheduleSave, setLayoutTracked],
  );

  const setCardWidth = useCallback(
    (id: DashboardCardId, w: number) => {
      const prev = layoutRef.current;
      const clamped = clampCardWidth(id, w);
      const current = prev.items.find((item) => item.id === id);
      if (!current || current.w === clamped) return;
      const next = {
        ...prev,
        items: prev.items.map((item) =>
          item.id === id ? { ...item, w: clamped } : item,
        ),
      };
      setLayoutTracked(next);
      scheduleSave(next);
    },
    [scheduleSave, setLayoutTracked],
  );

  const setCardHeight = useCallback(
    (id: DashboardCardId, h: number) => {
      const prev = layoutRef.current;
      const current = prev.items.find((item) => item.id === id);
      if (!current || current.h === h) return;
      const next = {
        ...prev,
        items: prev.items.map((item) => (item.id === id ? { ...item, h } : item)),
      };
      // Measured height: update local state only, never trigger a save.
      setLayoutTracked(next);
    },
    [setLayoutTracked],
  );

  const addWidget = useCallback(
    (id: DashboardCardId) => {
      const prev = layoutRef.current;
      if (prev.items.some((item) => item.id === id)) return;
      const next = {
        ...prev,
        items: [...prev.items, buildAddedWidgetItem(id, prev.items)],
      };
      setLayoutTracked(next);
      scheduleSave(next);
    },
    [scheduleSave, setLayoutTracked],
  );

  const removeWidget = useCallback(
    (id: DashboardCardId) => {
      const prev = layoutRef.current;
      if (!prev.items.some((item) => item.id === id)) return;
      const next = {
        ...prev,
        items: prev.items.filter((item) => item.id !== id),
      };
      setLayoutTracked(next);
      scheduleSave(next);
    },
    [scheduleSave, setLayoutTracked],
  );

  const resetLayout = useCallback(() => {
    const next = getDefaultDashboardLayout();
    setLayoutTracked(next);
    setGridKey((k) => k + 1);
    scheduleSave(next);
  }, [scheduleSave, setLayoutTracked]);

  const setWidgetConfig = useCallback(
    (id: DashboardCardId, configPatch: DashboardLayoutItemConfig) => {
      const prev = layoutRef.current;
      const current = prev.items.find((item) => item.id === id);
      if (!current) return;

      const merged: DashboardLayoutItemConfig = {
        ...current.config,
        ...configPatch,
      };
      if (configPatch.weatherForecast && current.config?.weatherForecast) {
        merged.weatherForecast = {
          ...current.config.weatherForecast,
          ...configPatch.weatherForecast,
        };
      }

      const next = {
        ...prev,
        items: prev.items.map((item) =>
          item.id === id ? { ...item, config: merged } : item,
        ),
      };
      setLayoutTracked(next);
      scheduleSave(next);
    },
    [scheduleSave, setLayoutTracked],
  );

  return {
    layout,
    orderedItems,
    activeIds,
    customizing,
    saveStatus,
    gridKey,
    isLayoutReady,
    setCustomizing,
    applyPositions,
    setCardWidth,
    setCardHeight,
    addWidget,
    removeWidget,
    resetLayout,
    setWidgetConfig,
  };
}
