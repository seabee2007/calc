import { clampPlanZoom, type PlanSurfaceSize, type PlanViewportState } from './pointerPlanMapping';

export type PlanGridState = {
  snapSpacingMeters: number;
  displayMinorSpacingMeters: number;
  displayMajorSpacingMeters: number;
};

export const GRID_INTERVALS_METERS = [
  0.05,
  0.1,
  0.2,
  0.4,
  0.5,
  1,
  2,
  5,
  10,
  20,
  50,
  100,
  200,
] as const;

export const IDEAL_MIN_CELL_PX = 42;
export const MIN_CELL_PX = 26;
export const MAX_CELL_PX = 90;

export function projectCellWidthPx(spacingMeters: number, viewport: PlanViewportState): number {
  return spacingMeters * clampPlanZoom(viewport.zoom);
}

export function formatPlanGridSpacingMeters(spacingMeters: number): string {
  if (spacingMeters < 1) {
    return `${spacingMeters.toFixed(1)} m`;
  }
  return `${spacingMeters} m`;
}

export function resolveMajorGridSpacing(minorSpacingMeters: number): number {
  for (const multiplier of [5, 10]) {
    const target = minorSpacingMeters * multiplier;
    const match = GRID_INTERVALS_METERS.find((interval) => interval >= target - 0.0001);
    if (match != null) return match;
  }
  return GRID_INTERVALS_METERS[GRID_INTERVALS_METERS.length - 1];
}

function pickIdealMinorSpacing(viewport: PlanViewportState): number {
  const viable = GRID_INTERVALS_METERS.filter((interval) => {
    const px = projectCellWidthPx(interval, viewport);
    return px >= MIN_CELL_PX && px <= MAX_CELL_PX;
  });
  if (viable.length > 0) {
    return viable[0];
  }

  const aboveMin = GRID_INTERVALS_METERS.filter((interval) => projectCellWidthPx(interval, viewport) >= MIN_CELL_PX);
  if (aboveMin.length > 0) return aboveMin[0];

  return GRID_INTERVALS_METERS[GRID_INTERVALS_METERS.length - 1];
}

export function computeDisplayMinorSpacing(
  viewport: PlanViewportState,
  previousMinorSpacing?: number,
): number {
  const ideal = pickIdealMinorSpacing(viewport);
  if (previousMinorSpacing == null) return ideal;

  const currentPx = projectCellWidthPx(previousMinorSpacing, viewport);
  if (currentPx >= MIN_CELL_PX && currentPx <= MAX_CELL_PX) {
    return previousMinorSpacing;
  }
  return ideal;
}

export function computePlanGridState(
  viewport: PlanViewportState,
  surface: PlanSurfaceSize,
  snapSpacingMeters: number,
  previousDisplayMinor?: number,
): PlanGridState {
  void surface;
  const displayMinorSpacingMeters = computeDisplayMinorSpacing(viewport, previousDisplayMinor);
  return {
    snapSpacingMeters: Math.max(0.001, snapSpacingMeters),
    displayMinorSpacingMeters,
    displayMajorSpacingMeters: resolveMajorGridSpacing(displayMinorSpacingMeters),
  };
}

/** @deprecated Prefer computePlanGridState; kept for legacy callers using visible world width. */
export function chooseAdaptiveGridSpacing(worldUnitsVisible: number, surfaceWidth = 800): number {
  const safeWidth = Math.max(1, worldUnitsVisible);
  const fakeZoom = Math.max(0.01, surfaceWidth / safeWidth);
  return computeDisplayMinorSpacing({ centerX: 0, centerZ: 0, zoom: fakeZoom });
}
