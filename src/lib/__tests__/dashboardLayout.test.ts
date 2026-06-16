import { describe, expect, it } from 'vitest';
import {
  clampCardWidth,
  DASHBOARD_CARD_IDS,
  DASHBOARD_CARD_META,
  DASHBOARD_GRID_COLS,
  DASHBOARD_LAYOUT_VERSION,
  getDefaultDashboardLayout,
  validateAndMigrateLayout,
  widthLabel,
  type DashboardCardId,
} from '../dashboardLayout';

describe('dashboardLayout', () => {
  it('default layout mirrors the registry metadata', () => {
    const layout = getDefaultDashboardLayout();
    expect(layout.version).toBe(DASHBOARD_LAYOUT_VERSION);
    expect(layout.items).toHaveLength(DASHBOARD_CARD_IDS.length);

    layout.items.forEach((item) => {
      const def = DASHBOARD_CARD_META[item.id].default;
      expect(item).toEqual({ id: item.id, x: def.x, y: def.y, w: def.w, h: def.h });
    });

    // Items are in reading order (top-to-bottom, left-to-right).
    expect(layout.items.map((c) => c.id)).toEqual(DASHBOARD_CARD_IDS);
  });

  it('keeps Next Actions in the default layout (right column under proposals)', () => {
    const layout = getDefaultDashboardLayout();
    const next = layout.items.find((c) => c.id === 'nextActions');
    const pipeline = layout.items.find((c) => c.id === 'proposalPipeline');
    expect(next).toBeDefined();
    expect(pipeline).toBeDefined();
    // Same right column, Next Actions below Proposal Pipeline.
    expect(next?.x).toBe(pipeline?.x);
    expect(next!.y).toBeGreaterThan(pipeline!.y);
  });

  it('returns the default layout for missing or malformed input', () => {
    const fallback = getDefaultDashboardLayout();
    expect(validateAndMigrateLayout(null)).toEqual(fallback);
    expect(validateAndMigrateLayout(undefined)).toEqual(fallback);
    expect(validateAndMigrateLayout('nonsense')).toEqual(fallback);
    expect(validateAndMigrateLayout({})).toEqual(fallback);
    expect(validateAndMigrateLayout({ items: 'not-an-array' })).toEqual(fallback);
  });

  it('drops unknown card ids', () => {
    const result = validateAndMigrateLayout({
      version: 2,
      items: [
        { id: 'totallyUnknownCard', x: 0, y: 0, w: 12, h: 4 },
        { id: 'activeProjects', x: 0, y: 1, w: 6, h: 4 },
      ],
    });
    const ids = result.items.map((c) => c.id) as string[];
    expect(ids).not.toContain('totallyUnknownCard');
    expect(ids).toContain('activeProjects');
    expect(result.items).toHaveLength(DASHBOARD_CARD_IDS.length);
  });

  it('drops duplicate ids, keeping the first occurrence', () => {
    const result = validateAndMigrateLayout({
      version: 2,
      items: [
        { id: 'activeProjects', x: 0, y: 0, w: 12, h: 4 },
        { id: 'activeProjects', x: 6, y: 1, w: 6, h: 4 },
      ],
    });
    const entries = result.items.filter((c) => c.id === 'activeProjects');
    expect(entries).toHaveLength(1);
    expect(entries[0].w).toBe(12);
  });

  it('migrates the legacy `cards` key shape', () => {
    const result = validateAndMigrateLayout({
      version: 1,
      cards: [{ id: 'businessSnapshot', order: 0, size: 'full' }],
    });
    expect(result.version).toBe(DASHBOARD_LAYOUT_VERSION);
    expect(result.items).toHaveLength(DASHBOARD_CARD_IDS.length);
  });

  it('appends registry cards missing from the saved layout using defaults', () => {
    const result = validateAndMigrateLayout({
      version: 2,
      items: [{ id: 'businessSnapshot', x: 0, y: 0, w: 12, h: 4 }],
    });
    expect(result.items).toHaveLength(DASHBOARD_CARD_IDS.length);
    const appended = result.items.find((c) => c.id === 'nextActions');
    expect(appended).toBeDefined();
    expect(appended).toEqual({
      id: 'nextActions',
      x: DASHBOARD_CARD_META.nextActions.default.x,
      y: DASHBOARD_CARD_META.nextActions.default.y,
      w: DASHBOARD_CARD_META.nextActions.default.w,
      h: DASHBOARD_CARD_META.nextActions.default.h,
    });
  });

  it('clamps widths to the card allowed range', () => {
    const result = validateAndMigrateLayout({
      version: 2,
      items: [
        { id: 'todaysOperations', x: 0, y: 0, w: 4, h: 4 },
        { id: 'activeProjects', x: 0, y: 1, w: 99, h: 4 }, // clamps down to 12
      ],
    });
    const hero = result.items.find((c) => c.id === 'todaysOperations');
    const active = result.items.find((c) => c.id === 'activeProjects');
    expect(hero?.w).toBe(4);
    expect(active?.w).toBe(12);
  });

  it('coerces missing coordinates to the card defaults', () => {
    const result = validateAndMigrateLayout({
      version: 2,
      items: [{ id: 'activeProjects' }],
    });
    const active = result.items.find((c) => c.id === 'activeProjects');
    const def = DASHBOARD_CARD_META.activeProjects.default;
    expect(active).toEqual({ id: 'activeProjects', x: def.x, y: def.y, w: def.w, h: def.h });
  });

  it('clampCardWidth respects per-card minimums and the grid max', () => {
    expect(clampCardWidth('activeProjects', 6)).toBe(6);
    expect(clampCardWidth('activeProjects', 2)).toBe(DASHBOARD_CARD_META.activeProjects.minW);
    expect(clampCardWidth('activeProjects', 99)).toBe(DASHBOARD_GRID_COLS);
    expect(clampCardWidth('todaysOperations', 6)).toBe(6);
  });

  it('widthLabel maps standard widths to friendly names', () => {
    expect(widthLabel(12)).toBe('Full');
    expect(widthLabel(8)).toBe('2/3');
    expect(widthLabel(6)).toBe('Half');
    expect(widthLabel(4)).toBe('1/3');
    expect(widthLabel(5)).toBe('5/12');
  });

  it('every registry id has metadata with a permitted default width', () => {
    (DASHBOARD_CARD_IDS as DashboardCardId[]).forEach((id) => {
      const meta = DASHBOARD_CARD_META[id];
      expect(meta.id).toBe(id);
      expect(meta.allowedWidths).toContain(meta.default.w);
      expect(meta.default.w).toBeGreaterThanOrEqual(meta.minW);
    });
  });
});
