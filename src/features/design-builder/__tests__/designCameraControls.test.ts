import { describe, expect, it } from 'vitest';
import {
  clampCameraClipPlanes,
  DESIGN_CAMERA_FAR_METERS,
  DESIGN_CAMERA_NEAR_METERS,
  DESIGN_ORBIT_MIN_DISTANCE_METERS,
  resolveOrbitMaxDistanceMeters,
} from '../domain/designCameraControls';
import { fitPerspectiveCameraToBounds, reset3dView } from '../domain/designSceneBounds';

describe('designCameraControls', () => {
  it('allows close orbit distance for detail inspection', () => {
    expect(DESIGN_ORBIT_MIN_DISTANCE_METERS).toBeLessThanOrEqual(0.1);
  });

  it('scales max orbit distance with model span', () => {
    expect(resolveOrbitMaxDistanceMeters(null)).toBe(500);
    expect(
      resolveOrbitMaxDistanceMeters({
        minX: 0,
        maxX: 20,
        minZ: 0,
        maxZ: 40,
        width: 20,
        depth: 40,
        height: 8,
        center: { x: 10, y: 4, z: 20 },
      }),
    ).toBeGreaterThan(400);
  });

  it('never sets clip planes tighter than the design minimums', () => {
    const clip = clampCameraClipPlanes({ near: 0.001, far: 200 });
    expect(clip.near).toBe(DESIGN_CAMERA_NEAR_METERS);
    expect(clip.far).toBe(DESIGN_CAMERA_FAR_METERS);
  });

  it('reset and fit views use expanded clip planes', () => {
    const reset = reset3dView();
    expect(reset.near).toBe(DESIGN_CAMERA_NEAR_METERS);
    expect(reset.far).toBe(DESIGN_CAMERA_FAR_METERS);

    const fit = fitPerspectiveCameraToBounds({
      bounds: {
        minX: 0,
        maxX: 12,
        minZ: 0,
        maxZ: 8,
        width: 12,
        depth: 8,
        height: 6,
        center: { x: 6, y: 3, z: 4 },
      },
      camera: { fov: 45, aspect: 16 / 9 },
    });
    expect(fit.near).toBeGreaterThanOrEqual(DESIGN_CAMERA_NEAR_METERS);
    expect(fit.far).toBeGreaterThanOrEqual(DESIGN_CAMERA_FAR_METERS);
  });
});
