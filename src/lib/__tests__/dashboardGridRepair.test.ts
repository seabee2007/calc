import { describe, expect, it } from 'vitest';
import {
  buildVisibleDashboardRenderLayout,
  dashboardLayoutHasCollisions,
  dashboardLayoutItemsCollide,
  repairDashboardGridLayout,
} from '../dashboardGridRepair';
import {
  DASHBOARD_CARD_META,
  DASHBOARD_GRID_COLS,
  getDefaultDashboardLayout,
  type DashboardCardId,
  type DashboardLayoutItem,
} from '../dashboardLayout';

function item(
  id: DashboardCardId,
  rect: Partial<DashboardLayoutItem> & Pick<DashboardLayoutItem, 'x' | 'y' | 'w' | 'h'>,
): DashboardLayoutItem {
  return { id, ...rect };
}

describe('dashboardGridRepair', () => {
  it('detects overlapping items', () => {
    const a = item('activeProjects', { x: 0, y: 10, w: 6, h: 3 });
    const b = item('projectControls', { x: 0, y: 10, w: 6, h: 4 });
    expect(dashboardLayoutItemsCollide(a, b)).toBe(true);
  });

  it('repairDashboardGridLayout resolves collisions', () => {
    const overlapping = [
      item('activeProjects', { x: 0, y: 400, w: 6, h: 3 }),
      item('projectControls', { x: 0, y: 400, w: 6, h: 4 }),
    ];
    expect(dashboardLayoutHasCollisions(overlapping)).toBe(true);

    const repaired = repairDashboardGridLayout(overlapping);
    expect(dashboardLayoutHasCollisions(repaired)).toBe(false);
    expect(repaired.find((i) => i.id === 'projectControls')!.y).toBeGreaterThanOrEqual(3);
  });

  it('compacts vertically when hidden widgets are excluded from the render slice', () => {
    const saved = [
      item('todaysOperations', { x: 0, y: 0, w: 12, h: 3 }),
      item('operationsSchedule', { x: 0, y: 100, w: 12, h: 4 }),
      item('businessSnapshot', { x: 0, y: 200, w: 12, h: 3 }),
    ];
    const visibleIds = new Set<DashboardCardId>(['todaysOperations', 'businessSnapshot']);
    const renderLayout = buildVisibleDashboardRenderLayout(saved, visibleIds);

    expect(dashboardLayoutHasCollisions(renderLayout)).toBe(false);
    const snapshot = renderLayout.find((i) => i.id === 'businessSnapshot')!;
    expect(snapshot.y).toBe(3);
  });

  it('clamps x/w within grid columns', () => {
    const repaired = repairDashboardGridLayout([
      item('activeProjects', { x: 10, y: 0, w: 8, h: 3 }),
    ]);
    const active = repaired[0];
    expect(active.x + active.w).toBeLessThanOrEqual(DASHBOARD_GRID_COLS);
    expect(active.w).toBeLessThanOrEqual(DASHBOARD_GRID_COLS);
  });

  it('default dashboard layout is non-overlapping after repair', () => {
    const layout = getDefaultDashboardLayout();
    expect(dashboardLayoutHasCollisions(layout.items)).toBe(false);
  });

  it('reset layout returns non-overlapping defaults', () => {
    const layout = getDefaultDashboardLayout();
    layout.items.forEach((entry) => {
      expect(entry.h).toBeGreaterThanOrEqual(DASHBOARD_CARD_META[entry.id].minH);
      expect(entry.x + entry.w).toBeLessThanOrEqual(DASHBOARD_GRID_COLS);
    });
  });

  it('saved overlapping layout is repaired before render without mutating saved items', () => {
    const saved: DashboardLayoutItem[] = [
      item('proposalPipeline', { x: 6, y: 400, w: 6, h: 4 }),
      item('nextActions', { x: 6, y: 401, w: 6, h: 3 }),
      item('qcDue', { x: 0, y: 900, w: 6, h: 4 }),
    ];
    const visibleIds = new Set<DashboardCardId>(['proposalPipeline', 'nextActions']);
    const renderLayout = buildVisibleDashboardRenderLayout(saved, visibleIds);

    expect(dashboardLayoutHasCollisions(renderLayout)).toBe(false);
    // Hidden qcDue stays in saved layout untouched.
    expect(saved.find((i) => i.id === 'qcDue')!.y).toBe(900);
  });
});
