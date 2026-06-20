import { describe, expect, it } from 'vitest';
import {
  SNAP_CAPTURE_RADIUS_PX,
  resolveDesignSnapPoint,
} from '../domain/designSnapRules';
import { createOutsideFaceRectangleLayout, createBlankWallLayout, createEmptyWallLayout } from '../domain/wallLayoutRules';

describe('designSnapRules', () => {
  it('chooses an existing node over grid snap when both are nearby', () => {
    const layout = createOutsideFaceRectangleLayout({ lengthMeters: 6, widthMeters: 5 });
    const sw = layout.nodes[0];
    const target = resolveDesignSnapPoint({
      layout,
      point: { x: sw.x + 0.04, z: sw.z + 0.04 },
      snapMode: 'grid',
      moduleLengthMeters: 0.4,
      pixelsPerMeter: 48,
    });

    expect(target.type).toBe('node');
    expect(target.sourceId).toBe(sw.id);
    expect(target.point).toEqual({ x: sw.x, z: sw.z });
    expect(target.captured).toBe(true);
  });

  it('snaps to grid intersections within the screen-space capture radius', () => {
    const layout = createOutsideFaceRectangleLayout({ lengthMeters: 6, widthMeters: 5 });
    const target = resolveDesignSnapPoint({
      layout,
      point: { x: 0.31, z: 0.79 },
      snapMode: 'grid',
      pixelsPerMeter: 48,
    });

    expect(target.type).toBe('grid');
    expect(target.point.x).toBeCloseTo(0.3, 6);
    expect(target.point.z).toBeCloseTo(0.8, 6);
    expect(target.distancePx).toBeLessThanOrEqual(SNAP_CAPTURE_RADIUS_PX + 0.01);
  });

  it('projects to the nearest wall segment line within capture distance', () => {
    const layout = createOutsideFaceRectangleLayout({ lengthMeters: 6, widthMeters: 5 });
    const southSegment = layout.segments[0];
    const target = resolveDesignSnapPoint({
      layout,
      point: { x: 0.7, z: -2.38 },
      snapMode: 'off',
      pixelsPerMeter: 48,
    });

    expect(target.type).toBe('line');
    expect(target.sourceId).toBe(southSegment.id);
    expect(target.point.x).toBeCloseTo(0.7, 6);
    expect(target.point.z).toBeCloseTo(-2.5, 6);
  });

  it('uses CMU module snap only when CMU snap is enabled and pointer is within capture radius', () => {
    const layout = createOutsideFaceRectangleLayout({ lengthMeters: 6, widthMeters: 5 });
    const cmu = resolveDesignSnapPoint({
      layout,
      point: { x: 0.39, z: 0.79 },
      snapMode: 'cmu_module',
      moduleLengthMeters: 0.4,
      pixelsPerMeter: 48,
    });
    const blankLayout = createBlankWallLayout();
    const far = resolveDesignSnapPoint({
      layout: blankLayout,
      point: { x: 0.2, z: 0.2 },
      snapMode: 'cmu_module',
      moduleLengthMeters: 0.4,
      pixelsPerMeter: 200,
    });

    expect(cmu.type).toBe('cmu_module');
    expect(cmu.point).toEqual({ x: 0.4, z: 0.8 });
    expect(far.type).toBe('raw');
  });

  it('uses raw cursor point when snap is off and no existing geometry is nearby', () => {
    const layout = createOutsideFaceRectangleLayout({ lengthMeters: 6, widthMeters: 5 });
    const target = resolveDesignSnapPoint({
      layout,
      point: { x: 0.33, z: 0.77 },
      snapMode: 'off',
      moduleLengthMeters: 0.4,
      pixelsPerMeter: 48,
    });

    expect(target.type).toBe('raw');
    expect(target.point).toEqual({ x: 0.33, z: 0.77 });
    expect(target.captured).toBe(false);
  });

  it('does not auto-capture orthogonal guides without shift', () => {
    const layout = createEmptyWallLayout({ nodes: [{ id: 'a', x: 0, z: 0 }] });
    const target = resolveDesignSnapPoint({
      layout,
      point: { x: 3.05, z: 0.04 },
      snapMode: 'off',
      pixelsPerMeter: 48,
      drawContext: {
        activeNodeId: 'a',
        drawStartNodeId: 'a',
        orthogonalLock: true,
        shiftHeld: false,
      },
    });

    expect(target.type).toBe('raw');
    expect(target.point.x).toBeCloseTo(3.05, 6);
    expect(target.point.z).toBeCloseTo(0.04, 6);
  });

  it('captures constrained guide targets while shift is held', () => {
    const layout = createEmptyWallLayout({ nodes: [{ id: 'a', x: 0, z: 0 }] });
    const target = resolveDesignSnapPoint({
      layout,
      point: { x: 3.05, z: 0.04 },
      snapMode: 'off',
      pixelsPerMeter: 48,
      drawContext: {
        activeNodeId: 'a',
        drawStartNodeId: 'a',
        orthogonalLock: true,
        shiftHeld: true,
      },
    });

    expect(target.type).toBe('guide');
    expect(target.label).toMatch(/Locked/);
    expect(target.point.x).toBeCloseTo(3.05, 6);
    expect(target.point.z).toBe(0);
  });
});
