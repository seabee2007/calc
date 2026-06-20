import { describe, expect, it } from 'vitest';
import {
  formatDrawWallSnapTargetFeedback,
  formatDrawWallStatusChip,
} from '../domain/designDrawWallFeedback';
import { resolveDesignSnapPoint } from '../domain/designSnapRules';
import { createBlankWallLayout } from '../domain/wallLayoutRules';

describe('designDrawWallFeedback', () => {
  it('formats the draw-wall status chip from active behavior', () => {
    expect(
      formatDrawWallStatusChip({
        snapMode: 'grid',
        gridSpacingMeters: 0.1,
        orthogonalLock: true,
      }),
    ).toBe('Free angle');

    expect(
      formatDrawWallStatusChip({
        snapMode: 'grid',
        gridSpacingMeters: 0.1,
        orthogonalLock: true,
        snapTarget: {
          type: 'grid',
          point: { x: 0.1, z: 0.2 },
          distancePx: 4,
          priority: 8,
          label: 'Grid',
          valid: true,
          captured: true,
        },
      }),
    ).toBe('Snap: Grid 0.1 m');

    expect(
      formatDrawWallStatusChip({
        snapMode: 'grid',
        gridSpacingMeters: 0.1,
        orthogonalLock: true,
        shiftConstraintLabel: 'Locked 90°',
      }),
    ).toBe('Locked: 90°');
  });

  it('formats live snap-target feedback for grid and guide captures', () => {
    expect(
      formatDrawWallSnapTargetFeedback({
        snapTarget: {
          type: 'grid',
          point: { x: 0.1, z: 0.2 },
          distancePx: 4,
          priority: 8,
          label: 'Grid',
          valid: true,
          captured: true,
        },
        snapMode: 'grid',
        gridSpacingMeters: 0.1,
        lengthMeters: 6.42,
        angleDegrees: 37,
      }),
    ).toBe('Snap: Grid 0.1 m · Length: 6.42 m · Angle: 37°');

    expect(
      formatDrawWallSnapTargetFeedback({
        snapTarget: {
          type: 'guide',
          point: { x: 5, z: 3 },
          distancePx: 3,
          priority: 4,
          label: 'Locked 90°',
          valid: true,
          captured: true,
        },
        snapMode: 'grid',
        gridSpacingMeters: 0.1,
        shiftConstraintLabel: 'Locked 90°',
      }),
    ).toBe('Locked 90°');
  });
});

describe('draw wall snap settings integration', () => {
  it('honors selected grid spacing in grid mode', () => {
    const layout = { ...createBlankWallLayout(), gridSpacingMeters: 0.1 };
    const target = resolveDesignSnapPoint({
      layout,
      point: { x: 0.11, z: 0.19 },
      snapMode: 'grid',
      pixelsPerMeter: 48,
    });
    expect(target.type).toBe('grid');
    expect(target.point.x).toBeCloseTo(0.1, 6);
    expect(target.point.z).toBeCloseTo(0.2, 6);
  });

  it('uses CMU module stations in CMU mode', () => {
    const layout = createBlankWallLayout();
    const target = resolveDesignSnapPoint({
      layout,
      point: { x: 0.39, z: 0.79 },
      snapMode: 'cmu_module',
      moduleLengthMeters: 0.4,
      pixelsPerMeter: 48,
    });
    expect(target.type).toBe('cmu_module');
    expect(target.point).toEqual({ x: 0.4, z: 0.8 });
  });

  it('returns raw pointer coordinates when snap is off', () => {
    const layout = createBlankWallLayout();
    const target = resolveDesignSnapPoint({
      layout,
      point: { x: 0.27, z: 0.27 },
      snapMode: 'off',
      pixelsPerMeter: 200,
    });
    expect(target.type).toBe('raw');
    expect(target.point).toEqual({ x: 0.27, z: 0.27 });
  });
});
