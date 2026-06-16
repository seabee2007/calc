import {
  clampCardWidth,
  DASHBOARD_CARD_META,
  DASHBOARD_GRID_COLS,
  type DashboardCardId,
  type DashboardLayoutItem,
} from './dashboardLayout';

/** True when two grid items occupy overlapping cells. */
export function dashboardLayoutItemsCollide(
  a: DashboardLayoutItem,
  b: DashboardLayoutItem,
): boolean {
  if (a.id === b.id) return false;
  const xOverlap = a.x < b.x + b.w && a.x + a.w > b.x;
  const yOverlap = a.y < b.y + b.h && a.y + a.h > b.y;
  return xOverlap && yOverlap;
}

/** True when any pair in the list overlaps. */
export function dashboardLayoutHasCollisions(items: DashboardLayoutItem[]): boolean {
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (dashboardLayoutItemsCollide(items[i], items[j])) return true;
    }
  }
  return false;
}

function clampLayoutItem(
  item: DashboardLayoutItem,
  cols: number,
): DashboardLayoutItem {
  const meta = DASHBOARD_CARD_META[item.id];
  const w = clampCardWidth(item.id, item.w);
  const maxX = Math.max(0, cols - w);
  const x = Math.max(0, Math.min(Math.round(item.x), maxX));
  const y = Math.max(0, Math.round(item.y));
  const h = Math.max(meta.minH, Math.round(item.h));
  return { ...item, x, y, w, h };
}

/**
 * Repair a layout slice so every item fits the grid and no two items overlap.
 * Items are vertically compacted (moved up when possible) after collision
 * resolution. Intended for **render-only** use on visible widgets — do not
 * persist the result unless the user intentionally changed the layout.
 */
export function repairDashboardGridLayout(
  items: DashboardLayoutItem[],
  cols: number = DASHBOARD_GRID_COLS,
): DashboardLayoutItem[] {
  if (items.length === 0) return [];

  const sorted = [...items]
    .map((item) => clampLayoutItem(item, cols))
    .sort((a, b) => a.y - b.y || a.x - b.x);

  const placed: DashboardLayoutItem[] = [];

  for (const raw of sorted) {
    let candidate = { ...raw };

    // Resolve collisions by pushing down one row at a time.
    while (placed.some((p) => dashboardLayoutItemsCollide(candidate, p))) {
      candidate = { ...candidate, y: candidate.y + 1 };
    }

    // Compact upward to the highest row with no collision.
    for (let y = 0; y < candidate.y; y++) {
      const test = { ...candidate, y };
      if (!placed.some((p) => dashboardLayoutItemsCollide(test, p))) {
        candidate = test;
        break;
      }
    }

    placed.push(candidate);
  }

  return placed.sort((a, b) => a.y - b.y || a.x - b.x);
}

/**
 * Build a collision-free render layout from saved items and the ids that are
 * visible for the current user/data context. Hidden/gated widgets stay in
 * saved layout but are excluded from the render slice.
 */
export function buildVisibleDashboardRenderLayout(
  items: DashboardLayoutItem[],
  visibleIds: ReadonlySet<DashboardCardId>,
  cols: number = DASHBOARD_GRID_COLS,
): DashboardLayoutItem[] {
  const visible = items.filter((item) => visibleIds.has(item.id));
  return repairDashboardGridLayout(visible, cols);
}
