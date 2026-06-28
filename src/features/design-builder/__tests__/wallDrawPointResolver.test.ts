import { describe, expect, it } from 'vitest';
import { resolveWallDrawPoint } from '../domain/wallDrawPointResolver';
import { EXACT_RECTANGLE_CORNER_SNAP_LABEL, type DesignSnapTarget } from '../domain/designSnapRules';
import { addWallSegment, createEmptyWallLayout } from '../domain/wallLayoutRules';

function buildThreeSides(params: {
  a: { x: number; z: number };
  b: { x: number; z: number };
  c: { x: number; z: number };
}) {
  let layout = createEmptyWallLayout({ nodes: [{ id: 'a', x: params.a.x, z: params.a.z }] });
  layout = addWallSegment(layout, 'a', params.b.x, params.b.z);
  layout = addWallSegment(layout, layout.segments[0]!.endNodeId, params.c.x, params.c.z);
  return layout;
}

describe('resolveWallDrawPoint', () => {
  it('captures the exact rectangle corner without shift and beats grid snap', () => {
    const layout = buildThreeSides({ a: { x: 0, z: 0 }, b: { x: 15, z: 0 }, c: { x: 15, z: 17.7 } });
    const activeNodeId = layout.segments[1]!.endNodeId;

    const resolved = resolveWallDrawPoint({
      layout,
      activeNodeId,
      rawPoint: { x: 0, z: 17.5 },
      snapMode: 'grid',
      moduleLengthMeters: 0.1,
      pixelsPerMeter: 48,
      moduleFitMode: 'exact',
    });

    expect(resolved.snapTarget.type).toBe('guide');
    expect(resolved.snapTarget.label).toBe(EXACT_RECTANGLE_CORNER_SNAP_LABEL);
    expect(resolved.point.x).toBeCloseTo(0, 6);
    expect(resolved.point.z).toBeCloseTo(17.7, 6);
    expect(resolved.closure?.captured).toBe(true);
    expect(resolved.closure?.isExactClosure).toBe(true);
  });

  it('exact rectangle closure beats previous snap stickiness', () => {
    const layout = buildThreeSides({ a: { x: 0, z: 0 }, b: { x: 15, z: 0 }, c: { x: 15, z: 17.7 } });
    const activeNodeId = layout.segments[1]!.endNodeId;
    const previousSnap: DesignSnapTarget = {
      type: 'grid',
      point: { x: 0, z: 17.5 },
      distancePx: 0,
      priority: 8,
      label: 'Grid',
      valid: true,
      captured: true,
    };

    const resolved = resolveWallDrawPoint({
      layout,
      activeNodeId,
      rawPoint: { x: 0, z: 17.5 },
      snapMode: 'grid',
      moduleLengthMeters: 0.1,
      pixelsPerMeter: 48,
      moduleFitMode: 'exact',
      previousSnap,
    });

    expect(resolved.snapTarget.label).toBe(EXACT_RECTANGLE_CORNER_SNAP_LABEL);
    expect(resolved.point.z).toBeCloseTo(17.7, 6);
  });

  it('exact rectangle closure beats CMU module snap', () => {
    const layout = buildThreeSides({ a: { x: 0, z: 0 }, b: { x: 15, z: 0 }, c: { x: 15, z: 17.7 } });
    const activeNodeId = layout.segments[1]!.endNodeId;

    const resolved = resolveWallDrawPoint({
      layout,
      activeNodeId,
      rawPoint: { x: 0, z: 17.5 },
      snapMode: 'cmu_module',
      moduleLengthMeters: 0.5,
      pixelsPerMeter: 48,
      moduleFitMode: 'snap_during_draw',
    });

    expect(resolved.snapTarget.label).toBe(EXACT_RECTANGLE_CORNER_SNAP_LABEL);
    expect(resolved.point.z).toBeCloseTo(17.7, 6);
  });

  it('computes metrics after exact length projection', () => {
    const layout = createEmptyWallLayout({ nodes: [{ id: 'a', x: 0, z: 0 }] });

    const resolved = resolveWallDrawPoint({
      layout,
      activeNodeId: 'a',
      rawPoint: { x: 3, z: 1.25 },
      snapMode: 'off',
      moduleLengthMeters: 0.4,
      pixelsPerMeter: 48,
      exactLengthMeters: 5,
      moduleFitMode: 'exact',
    });

    expect(resolved.point.x).toBeCloseTo(5, 6);
    expect(resolved.point.z).toBeCloseTo(0, 6);
    expect(resolved.metrics.lengthMeters).toBeCloseTo(5, 6);
    expect(resolved.metrics.angleDegrees).toBeCloseTo(0, 6);
  });

  it('labels typed length conflicts when exact closure is captured', () => {
    const layout = buildThreeSides({ a: { x: 0, z: 0 }, b: { x: 15, z: 0 }, c: { x: 15, z: 17.7 } });
    const activeNodeId = layout.segments[1]!.endNodeId;

    const resolved = resolveWallDrawPoint({
      layout,
      activeNodeId,
      rawPoint: { x: 0, z: 17.5 },
      snapMode: 'off',
      moduleLengthMeters: 0.4,
      pixelsPerMeter: 48,
      exactLengthMeters: 14.8,
      moduleFitMode: 'exact',
    });

    expect(resolved.point.z).toBeCloseTo(17.7, 6);
    expect(resolved.constraintLabel).toBe('Closure overrides typed length: exact rectangle corner');
    expect(resolved.closure?.exactLengthConflict).toBe(true);
  });
});
