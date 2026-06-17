import { describe, expect, it } from 'vitest';
import {
  buildAddedWidgetItem,
  clampCardWidth,
  DASHBOARD_CARD_IDS,
  DASHBOARD_CARD_META,
  DASHBOARD_GRID_COLS,
  DASHBOARD_LAYOUT_VERSION,
  DEFAULT_VISIBLE_CARD_IDS,
  getDefaultDashboardLayout,
  nextAvailableY,
  validateAndMigrateLayout,
  widthLabel,
  type DashboardCardId,
} from '../dashboardLayout';
import { dashboardLayoutHasCollisions } from '../dashboardGridRepair';

describe('dashboardLayout', () => {
  it('default layout contains the default-visible widgets only', () => {
    const layout = getDefaultDashboardLayout();
    expect(layout.version).toBe(DASHBOARD_LAYOUT_VERSION);
    expect(layout.items).toHaveLength(DEFAULT_VISIBLE_CARD_IDS.length);
    expect([...layout.items].map((c) => c.id).sort()).toEqual(
      [...DEFAULT_VISIBLE_CARD_IDS].sort(),
    );
    expect(dashboardLayoutHasCollisions(layout.items)).toBe(false);

    layout.items.forEach((item) => {
      const meta = DASHBOARD_CARD_META[item.id];
      expect(item.w).toBeGreaterThanOrEqual(meta.minW);
      expect(item.h).toBeGreaterThanOrEqual(meta.minH);
      expect(item.x + item.w).toBeLessThanOrEqual(DASHBOARD_GRID_COLS);
      expect(DASHBOARD_CARD_META[item.id].defaultVisible).toBe(true);
    });
  });

  it('excludes optional catalog widgets from the default layout', () => {
    const ids = getDefaultDashboardLayout().items.map((c) => c.id) as string[];
    expect(ids).not.toContain('quickActions');
    expect(ids).not.toContain('qcDue');
    expect(ids).not.toContain('ardenCalc');
    // ...but they remain registered/available in the catalog.
    expect(DASHBOARD_CARD_IDS).toContain('quickActions' as DashboardCardId);
    expect(DASHBOARD_CARD_IDS).toContain('qcDue' as DashboardCardId);
    expect(DASHBOARD_CARD_IDS).toContain('ardenCalc' as DashboardCardId);
  });

  it('uses the full recommended category taxonomy on registry widgets', () => {
    expect(DASHBOARD_CARD_META.operationsSchedule.category).toBe('Scheduling');
    expect(DASHBOARD_CARD_META.fieldActivity.category).toBe('Field / Crew');
    expect(DASHBOARD_CARD_META.projectRiskReview.category).toBe('Risk / QC');
    expect(DASHBOARD_CARD_META.ardenCalc.category).toBe('Tools / Calculators');
    expect(DASHBOARD_CARD_META.quickEstimateLauncher.category).toBe('Estimating');
    expect(DASHBOARD_CARD_META.supportHelp.category).toBe('Admin / Business');
  });

  it('registers Phase 5A tool widgets with feature metadata', () => {
    expect(DASHBOARD_CARD_META.ardenCalc.requiredFeature).toBe('calculators');
    expect(DASHBOARD_CARD_META.accountingTaxLauncher.requiredFeature).toBe('accounting_exports');
    expect(DASHBOARD_CARD_META.newProjectShortcut.requiredFeature).toBeUndefined();
  });

  it('registers weather forecast widget metadata', () => {
    expect(DASHBOARD_CARD_META.weatherForecast.category).toBe('Weather / Placement');
    expect(DASHBOARD_CARD_META.weatherForecast.defaultVisible).toBe(false);
    expect(DASHBOARD_CARD_META.weatherForecast.requiredPlan).toBe('starter');
  });

  it('registers usage meter widget metadata', () => {
    expect(DASHBOARD_CARD_META.usageMeter.category).toBe('Admin / Business');
    expect(DASHBOARD_CARD_META.usageMeter.defaultVisible).toBe(false);
    expect(DASHBOARD_CARD_META.usageMeter.requiredRole).toBe('owner');
    expect(DASHBOARD_CARD_IDS).toContain('usageMeter');
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
    expect(result.items).toHaveLength(DEFAULT_VISIBLE_CARD_IDS.length);
  });

  it('keeps active optional widgets but does not auto-add inactive ones', () => {
    const result = validateAndMigrateLayout({
      version: 2,
      items: [{ id: 'qcDue', x: 0, y: 50, w: 6, h: 4 }],
    });
    const ids = result.items.map((c) => c.id) as string[];
    // The saved optional widget stays active.
    expect(ids).toContain('qcDue');
    // Missing default-visible widgets are appended.
    expect(ids).toContain('todaysOperations');
    // Other optional widgets are NOT auto-added.
    expect(ids).not.toContain('quickActions');
    expect(result.items).toHaveLength(DEFAULT_VISIBLE_CARD_IDS.length + 1);
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
    expect(result.items).toHaveLength(DEFAULT_VISIBLE_CARD_IDS.length);
  });

  it('appends default-visible cards missing from the saved layout using defaults', () => {
    const result = validateAndMigrateLayout({
      version: 2,
      items: [{ id: 'businessSnapshot', x: 0, y: 0, w: 12, h: 4 }],
    });
    expect(result.items).toHaveLength(DEFAULT_VISIBLE_CARD_IDS.length);
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

  it('preserves per-widget config on layout items', () => {
    const result = validateAndMigrateLayout({
      version: 2,
      items: [
        {
          id: 'weatherForecast',
          x: 0,
          y: 0,
          w: 8,
          h: 6,
          config: {
            weatherForecast: {
              selectedWeatherSource: 'project',
              selectedProjectId: 'proj-42',
            },
          },
        },
      ],
    });
    const weather = result.items.find((c) => c.id === 'weatherForecast');
    expect(weather?.config?.weatherForecast).toEqual({
      selectedWeatherSource: 'project',
      selectedProjectId: 'proj-42',
    });
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
      // Phase 4 catalog metadata must be present on every widget.
      expect(meta.description.length).toBeGreaterThan(0);
      expect(meta.category.length).toBeGreaterThan(0);
      expect(typeof meta.defaultVisible).toBe('boolean');
    });
  });

  it('does not reserve oversized empty-state height for list widgets', () => {
    // Card height is content-measured at runtime, so a widget's minH is only a
    // floor. List-style widgets must keep that floor small enough that their
    // empty state (e.g. Active Projects with no projects) can collapse to a
    // compact card instead of reserving long-list height. Regression guard for
    // the Active Projects empty-state blank-space bug.
    const listWidgets: DashboardCardId[] = [
      'activeProjects',
      'fieldActivity',
      'proposalPipeline',
      'nextActions',
      'projectRiskReview',
      'qcDue',
      'projectsNeedingEstimate',
      'proposalsFollowUp',
    ];
    listWidgets.forEach((id) => {
      const meta = DASHBOARD_CARD_META[id];
      expect(meta.minH).toBeLessThanOrEqual(3);
      expect(meta.default.h).toBeLessThanOrEqual(4);
    });
  });

  it('nextAvailableY returns the row below all items', () => {
    expect(nextAvailableY([])).toBe(0);
    expect(
      nextAvailableY([
        { id: 'businessSnapshot', x: 0, y: 0, w: 12, h: 3 },
        { id: 'activeProjects', x: 0, y: 4, w: 6, h: 10 },
      ]),
    ).toBe(14);
  });

  it('buildAddedWidgetItem places a widget below existing items at x=0', () => {
    const items = getDefaultDashboardLayout().items;
    const added = buildAddedWidgetItem('quickActions', items);
    expect(added.id).toBe('quickActions');
    expect(added.x).toBe(0);
    expect(added.y).toBe(nextAvailableY(items));
    expect(added.w).toBe(DASHBOARD_CARD_META.quickActions.default.w);
  });
});
