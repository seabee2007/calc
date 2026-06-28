import { describe, expect, it } from 'vitest';
import { resolveSnap } from '../snapping/snapEngine';
import type { ResolveSnapParams, SnapSettings } from '../snapping/snapTypes';

const settings: SnapSettings = {
  snapMode: 'grid',
  gridSpacingMeters: 0.5,
  moduleLengthMeters: 0.4,
  tolerancePx: 12,
  tolerancePreset: 'normal',
  objectSnap: {
    enabled: true,
    endpoint: true,
    midpoint: true,
    intersection: true,
    nearest: false,
    perpendicular: true,
    extension: false,
  },
  orthogonal: false,
  polar: true,
  polarAnglesDegrees: [0, 15, 30, 45, 60, 90, 135, 180, 225, 270, 315],
};

function planToScreen(point: { x: number; z: number }) {
  return { x: point.x * 100, y: -point.z * 100 };
}

function snap(overrides: Partial<ResolveSnapParams>) {
  const rawWorldPoint = overrides.rawWorldPoint ?? { x: 0.48, z: 0.52 };
  return resolveSnap({
    rawWorldPoint,
    rawScreenPoint: planToScreen(rawWorldPoint),
    planToScreenPoint: planToScreen,
    currentToolMode: 'draw_wall',
    settings,
    ...overrides,
  });
}

describe('snapEngine', () => {
  it('returns the nearest grid point', () => {
    const result = snap({ rawWorldPoint: { x: 0.48, z: 0.52 } });
    expect(result.snapType).toBe('grid');
    expect(result.worldPoint).toEqual({ x: 0.5, z: 0.5 });
  });

  it('lets endpoint snap win over grid inside tolerance', () => {
    const result = snap({
      rawWorldPoint: { x: 0.04, z: 0.03 },
      geometry: { points: [{ id: 'node-a', point: { x: 0, z: 0 }, snapType: 'endpoint' }] },
    });
    expect(result.snapType).toBe('endpoint');
    expect(result.sourceId).toBe('node-a');
  });

  it('does not snap endpoint outside pixel tolerance', () => {
    const result = snap({
      rawWorldPoint: { x: 0.2, z: 0 },
      geometry: { points: [{ id: 'node-a', point: { x: 0, z: 0 }, snapType: 'endpoint' }] },
    });
    expect(result.snapType).toBe('none');
    expect(result.snapped).toBe(false);
  });

  it('snaps midpoint only inside tolerance', () => {
    const result = snap({
      rawWorldPoint: { x: 1.04, z: 0 },
      geometry: { segments: [{ id: 'wall-a', start: { x: 0, z: 0 }, end: { x: 2, z: 0 } }] },
    });
    expect(result.snapType).toBe('midpoint');
    expect(result.worldPoint).toEqual({ x: 1, z: 0 });
  });

  it('finds segment intersections', () => {
    const result = snap({
      rawWorldPoint: { x: 1.03, z: 1.02 },
      geometry: {
        segments: [
          { id: 'a', start: { x: 0, z: 1 }, end: { x: 2, z: 1 } },
          { id: 'b', start: { x: 1, z: 0 }, end: { x: 1, z: 2 } },
        ],
      },
    });
    expect(result.snapType).toBe('intersection');
    expect(result.worldPoint).toEqual({ x: 1, z: 1 });
  });

  it('locks orthogonal from an active point', () => {
    const result = snap({
      rawWorldPoint: { x: 1.3, z: 0.2 },
      commandState: { basePoint: { x: 0, z: 0 } },
      settings: { ...settings, snapMode: 'off', orthogonal: true },
    });
    expect(result.snapType).toBe('ortho');
    expect(result.worldPoint).toEqual({ x: 1.3, z: 0 });
  });

  it('snaps polar to 45 degrees', () => {
    const result = snap({
      rawWorldPoint: { x: 1, z: 0.9 },
      commandState: { basePoint: { x: 0, z: 0 } },
      settings: { ...settings, snapMode: 'off', orthogonal: false, polar: true },
    });
    expect(result.snapType).toBe('polar');
    expect(result.label).toBe('Polar 45°');
  });

  it('returns raw cursor with Alt no-snap', () => {
    const result = snap({
      rawWorldPoint: { x: 0.04, z: 0.03 },
      keyboard: { altHeld: true },
      geometry: { points: [{ id: 'node-a', point: { x: 0, z: 0 }, snapType: 'endpoint' }] },
    });
    expect(result.snapped).toBe(false);
    expect(result.worldPoint).toEqual({ x: 0.04, z: 0.03 });
  });

  it('cycles overlapping candidates with Tab', () => {
    const result = snap({
      rawWorldPoint: { x: 0.04, z: 0 },
      keyboard: { tabCycleIndex: 1 },
      geometry: {
        points: [
          { id: 'node-a', point: { x: 0, z: 0 }, snapType: 'endpoint' },
          { id: 'node-b', point: { x: 0.08, z: 0 }, snapType: 'endpoint' },
        ],
      },
    });
    expect(result.sourceId).toBe('node-b');
  });
});
