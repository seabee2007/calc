import { describe, expect, it } from 'vitest';
import {
  GRID_INTERVALS_METERS,
  MAX_CELL_PX,
  MIN_CELL_PX,
  computeDisplayMinorSpacing,
  computePlanGridState,
  formatPlanGridSpacingMeters,
  projectCellWidthPx,
  resolveMajorGridSpacing,
} from '../domain/planGridState';
import { createPlanCameraController, fitPlanViewportToBounds } from '../domain/pointerPlanMapping';

const surface = { width: 900, height: 520 };

describe('planGridState', () => {
  it('zooming out increases displayMinorSpacingMeters', () => {
    const zoomedIn = computePlanGridState({ centerX: 0, centerZ: 0, zoom: 120 }, surface, 0.1);
    const zoomedOut = computePlanGridState({ centerX: 0, centerZ: 0, zoom: 4 }, surface, 0.1);

    expect(zoomedOut.displayMinorSpacingMeters).toBeGreaterThan(zoomedIn.displayMinorSpacingMeters);
  });

  it('zooming in decreases displayMinorSpacingMeters', () => {
    const close = computePlanGridState({ centerX: 0, centerZ: 0, zoom: 96 }, surface, 0.1);
    const far = computePlanGridState({ centerX: 0, centerZ: 0, zoom: 8 }, surface, 0.1);

    expect(close.displayMinorSpacingMeters).toBeLessThan(far.displayMinorSpacingMeters);
  });

  it('keeps snapSpacingMeters stable while display spacing adapts to zoom', () => {
    const close = computePlanGridState({ centerX: 0, centerZ: 0, zoom: 96 }, surface, 0.1);
    const far = computePlanGridState({ centerX: 0, centerZ: 0, zoom: 2 }, surface, 0.1);

    expect(close.snapSpacingMeters).toBe(0.1);
    expect(far.snapSpacingMeters).toBe(0.1);
    expect(close.displayMinorSpacingMeters).not.toBe(far.displayMinorSpacingMeters);
  });

  it('matches close-zoom example with 0.1 m view grid', () => {
    const state = computePlanGridState({ centerX: 0, centerZ: 0, zoom: 420 }, surface, 0.1);

    expect(state.displayMinorSpacingMeters).toBe(0.1);
    expect(state.displayMajorSpacingMeters).toBe(0.5);
  });

  it('matches building-layout zoom example with 1 m view grid', () => {
    const state = computePlanGridState({ centerX: 0, centerZ: 0, zoom: 42 }, surface, 0.1);

    expect(state.displayMinorSpacingMeters).toBe(1);
    expect(state.displayMajorSpacingMeters).toBe(5);
  });

  it('matches site-scale zoom example with coarse view grid', () => {
    const state = computePlanGridState({ centerX: 0, centerZ: 0, zoom: 1.5 }, surface, 0.1);

    expect(state.displayMinorSpacingMeters).toBe(20);
    expect(state.displayMajorSpacingMeters).toBe(100);
  });

  it('applies hysteresis so normal wheel zoom does not flicker between adjacent intervals', () => {
    const viewport = { centerX: 0, centerZ: 0, zoom: 42 };
    const first = computeDisplayMinorSpacing(viewport);
    const second = computeDisplayMinorSpacing(
      { ...viewport, zoom: viewport.zoom * 1.14 },
      first,
    );
    const third = computeDisplayMinorSpacing(
      { ...viewport, zoom: viewport.zoom * 1.14 * 1.14 },
      second,
    );

    expect(first).toBe(1);
    expect(second).toBe(1);
    expect(third).toBe(1);
    expect(projectCellWidthPx(second, { ...viewport, zoom: viewport.zoom * 1.14 * 1.14 })).toBeGreaterThanOrEqual(MIN_CELL_PX);
    expect(projectCellWidthPx(second, { ...viewport, zoom: viewport.zoom * 1.14 * 1.14 })).toBeLessThanOrEqual(MAX_CELL_PX);
  });

  it('only changes display spacing once projected cell width leaves the hysteresis band', () => {
    const viewport = { centerX: 0, centerZ: 0, zoom: 42 };
    const initial = computeDisplayMinorSpacing(viewport);
    const stillStable = computeDisplayMinorSpacing({ ...viewport, zoom: 35 }, initial);
    const changed = computeDisplayMinorSpacing({ ...viewport, zoom: 8 }, initial);

    expect(initial).toBe(1);
    expect(stillStable).toBe(1);
    expect(changed).toBeGreaterThan(1);
  });

  it('resolves major spacing from configured intervals', () => {
    expect(resolveMajorGridSpacing(0.1)).toBe(0.5);
    expect(resolveMajorGridSpacing(1)).toBe(5);
    expect(resolveMajorGridSpacing(20)).toBe(100);
    expect(GRID_INTERVALS_METERS).toContain(resolveMajorGridSpacing(0.2));
  });

  it('formats spacing labels for the status chip', () => {
    expect(formatPlanGridSpacingMeters(0.1)).toBe('0.1 m');
    expect(formatPlanGridSpacingMeters(1)).toBe('1 m');
    expect(formatPlanGridSpacingMeters(100)).toBe('100 m');
  });

  it('recalculates display spacing after fit view changes zoom', () => {
    const before = computePlanGridState({ centerX: 0, centerZ: 0, zoom: 120 }, surface, 0.1);
    const fit = fitPlanViewportToBounds({ minX: -20, maxX: 20, minZ: -10, maxZ: 10 }, surface);
    const after = computePlanGridState(fit, surface, 0.1);

    expect(after.displayMinorSpacingMeters).toBeGreaterThan(before.displayMinorSpacingMeters);
    expect(after.snapSpacingMeters).toBe(0.1);
  });

  it('derives display spacing from visible world width via camera controller', () => {
    const zoomedIn = createPlanCameraController({ centerX: 0, centerZ: 0, zoom: 80 }, surface).visibleWorldBounds();
    const zoomedOut = createPlanCameraController({ centerX: 0, centerZ: 0, zoom: 4 }, surface).visibleWorldBounds();
    const closeState = computePlanGridState({ centerX: 0, centerZ: 0, zoom: 80 }, surface, 0.1);
    const farState = computePlanGridState({ centerX: 0, centerZ: 0, zoom: 4 }, surface, 0.1);

    expect(zoomedOut.maxX - zoomedOut.minX).toBeGreaterThan(zoomedIn.maxX - zoomedIn.minX);
    expect(farState.displayMinorSpacingMeters).toBeGreaterThan(closeState.displayMinorSpacingMeters);
  });
});
