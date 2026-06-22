import type { WallOpeningParameters } from '../types';

export interface DefaultOpeningDimensions {
  widthMeters: number;
  heightMeters: number;
  sillHeightMeters?: number;
}

export const DEFAULT_DOOR_DIMENSIONS: DefaultOpeningDimensions = {
  widthMeters: 0.9,
  heightMeters: 2.1,
};

export const LEGACY_DEFAULT_WINDOW_SILL_HEIGHT_METERS = 1;

function roundMeters(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function nearlyEqual(left: number, right: number, tolerance = 0.001): boolean {
  return Math.abs(left - right) <= tolerance;
}

export function resolveHeadAlignedWindowSillHeight(windowHeightMeters: number): number {
  return Math.max(0, roundMeters(DEFAULT_DOOR_DIMENSIONS.heightMeters - Math.max(0, windowHeightMeters)));
}

export const DEFAULT_WINDOW_DIMENSIONS: DefaultOpeningDimensions = {
  widthMeters: 1.2,
  heightMeters: 0.9,
  sillHeightMeters: resolveHeadAlignedWindowSillHeight(0.9),
};

export function normalizeWindowOpeningHeadAlignment(opening: WallOpeningParameters): WallOpeningParameters {
  if (opening.type !== 'window') return opening;
  const alignedSillHeightMeters = resolveHeadAlignedWindowSillHeight(opening.heightMeters);
  const sillHeightMeters = opening.sillHeightMeters;
  if (
    sillHeightMeters == null ||
    nearlyEqual(sillHeightMeters, LEGACY_DEFAULT_WINDOW_SILL_HEIGHT_METERS)
  ) {
    return {
      ...opening,
      sillHeightMeters: alignedSillHeightMeters,
    };
  }
  return opening;
}

export function normalizeOpeningHeadAlignment(opening: WallOpeningParameters): WallOpeningParameters {
  return normalizeWindowOpeningHeadAlignment(opening);
}

export function normalizeOpeningsHeadAlignment(
  openings: readonly WallOpeningParameters[],
): WallOpeningParameters[] {
  return openings.map(normalizeOpeningHeadAlignment);
}
