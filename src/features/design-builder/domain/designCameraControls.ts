import type { DesignLayoutBounds, DesignSceneBounds } from './designSceneBounds';

/** Close enough to inspect plywood seams, framing, and openings (≈0.25 ft). */
export const DESIGN_ORBIT_MIN_DISTANCE_METERS = 0.08;

/** Default wheel zoom multiplier for OrbitControls. */
export const DESIGN_ORBIT_ZOOM_SPEED = 1;

/** Perspective near plane — low enough for detail inspection without excessive depth fighting. */
export const DESIGN_CAMERA_NEAR_METERS = 0.01;

/** Perspective far plane — large enough for full building views. */
export const DESIGN_CAMERA_FAR_METERS = 5000;

export function resolveOrbitMaxDistanceMeters(
  bounds: DesignSceneBounds | DesignLayoutBounds | null | undefined,
): number {
  if (!bounds) return 500;
  const span = Math.max(bounds.width, bounds.depth, bounds.height, 10);
  return Math.max(150, span * 15);
}

export function clampCameraClipPlanes(params: {
  near?: number;
  far?: number;
}): { near: number; far: number } {
  return {
    near: Math.max(DESIGN_CAMERA_NEAR_METERS, params.near ?? DESIGN_CAMERA_NEAR_METERS),
    far: Math.max(DESIGN_CAMERA_FAR_METERS, params.far ?? DESIGN_CAMERA_FAR_METERS),
  };
}
