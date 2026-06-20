import { describe, expect, it } from 'vitest';
import { resolveDesignSnapPoint } from '../domain/designSnapRules';
import { createOutsideFaceRectangleLayout } from '../domain/wallLayoutRules';

describe('designSnapRules', () => {
  it('chooses an existing node over grid snap when both are nearby', () => {
    const layout = createOutsideFaceRectangleLayout({ lengthMeters: 6, widthMeters: 5 });
    const sw = layout.nodes[0];
    const target = resolveDesignSnapPoint({
      layout,
      point: { x: sw.x + 0.04, z: sw.z + 0.04 },
      snapMode: 'grid',
      moduleLengthMeters: 0.4,
    });

    expect(target.type).toBe('node');
    expect(target.sourceId).toBe(sw.id);
    expect(target.point).toEqual({ x: sw.x, z: sw.z });
  });

  it('projects to the nearest wall segment line', () => {
    const layout = createOutsideFaceRectangleLayout({ lengthMeters: 6, widthMeters: 5 });
    const southSegment = layout.segments[0];
    const target = resolveDesignSnapPoint({
      layout,
      point: { x: 0.7, z: -2.38 },
      snapMode: 'off',
    });

    expect(target.type).toBe('line');
    expect(target.sourceId).toBe(southSegment.id);
    expect(target.point.x).toBeCloseTo(0.7, 6);
    expect(target.point.z).toBeCloseTo(-2.5, 6);
  });

  it('uses CMU module snap only when CMU snap is enabled', () => {
    const layout = createOutsideFaceRectangleLayout({ lengthMeters: 6, widthMeters: 5 });
    const cmu = resolveDesignSnapPoint({
      layout,
      point: { x: 0.33, z: 0.77 },
      snapMode: 'cmu_module',
      moduleLengthMeters: 0.4,
    });
    const grid = resolveDesignSnapPoint({
      layout,
      point: { x: 0.33, z: 0.77 },
      snapMode: 'grid',
      moduleLengthMeters: 0.4,
    });

    expect(cmu.type).toBe('cmu_module');
    expect(cmu.point).toEqual({ x: 0.4, z: 0.8 });
    expect(grid.type).toBe('grid');
    expect(grid.point.x).toBeCloseTo(0.3, 6);
    expect(grid.point.z).toBeCloseTo(0.8, 6);
  });

  it('uses raw cursor point when snap is off and no existing geometry is nearby', () => {
    const layout = createOutsideFaceRectangleLayout({ lengthMeters: 6, widthMeters: 5 });
    const target = resolveDesignSnapPoint({
      layout,
      point: { x: 0.33, z: 0.77 },
      snapMode: 'off',
      moduleLengthMeters: 0.4,
    });

    expect(target.type).toBe('raw');
    expect(target.point).toEqual({ x: 0.33, z: 0.77 });
  });
});
