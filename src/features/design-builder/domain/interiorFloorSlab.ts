import type { InteriorFloorSlabSettings, RcFrameFoundationSettings } from '../types';
import { TOP_OF_PLINTH_BEAM_Y } from './foundationElevations';
import { normalizeRcFrameFoundationSettings } from './rcFrameFoundationMigration';

export const DEFAULT_INTERIOR_FLOOR_SLAB_THICKNESS_METERS = 0.125;

export type ResolvedInteriorFloorSlab = {
  enabled: boolean;
  thicknessMeters: number;
  bottomElevationMeters: number;
  topElevationMeters: number;
  areaSquareMeters: number;
  volumeCubicMeters: number;
};

export function defaultInteriorFloorSlabSettings(): InteriorFloorSlabSettings {
  return {
    enabled: true,
    thicknessMeters: DEFAULT_INTERIOR_FLOOR_SLAB_THICKNESS_METERS,
  };
}

export function resolveInteriorFloorSlabSettings(
  foundation: RcFrameFoundationSettings | import('../types').StructuralFoundationSettings | undefined,
): InteriorFloorSlabSettings {
  const normalized = normalizeRcFrameFoundationSettings(foundation);
  return {
    ...defaultInteriorFloorSlabSettings(),
    ...normalized.interiorFloorSlab,
  };
}

export function polygonAreaSquareMeters(polygon: readonly { x: number; z: number }[]): number {
  if (polygon.length < 3) return 0;
  let sum = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]!;
    const next = polygon[(index + 1) % polygon.length]!;
    sum += current.x * next.z - next.x * current.z;
  }
  return Math.abs(sum) / 2;
}

export function resolveInteriorFloorSlab(params: {
  foundation: RcFrameFoundationSettings | import('../types').StructuralFoundationSettings | undefined;
  interiorFacePolygon: readonly { x: number; z: number }[];
}): ResolvedInteriorFloorSlab {
  const settings = resolveInteriorFloorSlabSettings(params.foundation);
  const enabled = settings.enabled && settings.thicknessMeters > 0;
  const thicknessMeters = enabled ? settings.thicknessMeters : 0;
  const areaSquareMeters = enabled ? polygonAreaSquareMeters(params.interiorFacePolygon) : 0;
  return {
    enabled,
    thicknessMeters,
    topElevationMeters: TOP_OF_PLINTH_BEAM_Y,
    bottomElevationMeters: TOP_OF_PLINTH_BEAM_Y - thicknessMeters,
    areaSquareMeters,
    volumeCubicMeters: areaSquareMeters * thicknessMeters,
  };
}
