import { describe, expect, it } from 'vitest';
import { resolveDesignSnapPoint } from '../domain/designSnapRules';
import {
  addWallSegment,
  closeFootprint,
  closingSegmentWouldIntersect,
  createEmptyWallLayout,
  listOrthogonalGuideDirections,
  resolveDrawWallGuidance,
  resolveShiftConstrainedPoint,
} from '../domain/wallLayoutRules';

describe('designDrawWallFreeform', () => {
  it('keeps free-angle preview points when orthogonal guides are on', () => {
    const layout = createEmptyWallLayout({ nodes: [{ id: 'a', x: 0, z: 0 }] });
    const rawPoint = { x: 3.2, z: 1.8 };
    const guidance = resolveDrawWallGuidance({
      layout,
      activeNodeId: 'a',
      rawPoint,
      orthogonalLock: true,
    });

    expect(guidance.point).toEqual(rawPoint);
    expect(guidance.guideLine).toBeTruthy();
  });

  it('allows committing a diagonal wall while orthogonal guides are on', () => {
    let layout = createEmptyWallLayout({ nodes: [{ id: 'a', x: 0, z: 0 }] });
    layout = addWallSegment(layout, 'a', 3.2, 1.8);
    const end = layout.nodes.find((node) => node.id === layout.segments[0]?.endNodeId);
    expect(end?.x).toBeCloseTo(3.2, 6);
    expect(end?.z).toBeCloseTo(1.8, 6);
  });

  it('constrains to a strong guide while shift is held', () => {
    let layout = createEmptyWallLayout({ nodes: [{ id: 'a', x: 0, z: 0 }] });
    layout = addWallSegment(layout, 'a', 5, 0);
    const constrained = resolveShiftConstrainedPoint({
      layout,
      activeNodeId: layout.segments[0].endNodeId,
      rawPoint: { x: 5.8, z: 3.1 },
    });

    expect(constrained.point.x).toBeCloseTo(5, 6);
    expect(constrained.point.z).toBeCloseTo(3.1, 6);
    expect(constrained.label).toMatch(/Locked/);
  });

  it('returns to raw pointer snap when shift is not held', () => {
    const layout = createEmptyWallLayout({ nodes: [{ id: 'a', x: 0, z: 0 }] });
    const raw = { x: 2.37, z: 1.62 };
    const target = resolveDesignSnapPoint({
      layout,
      point: raw,
      snapMode: 'off',
      pixelsPerMeter: 48,
      drawContext: {
        activeNodeId: 'a',
        orthogonalLock: true,
        shiftHeld: false,
      },
    });

    expect(target.type).toBe('raw');
    expect(target.point).toEqual(raw);
  });

  it('shows guide rays without auto-capturing them', () => {
    const layout = createEmptyWallLayout({ nodes: [{ id: 'a', x: 0, z: 0 }] });
    const rays = listOrthogonalGuideDirections({ layout, activeNodeId: 'a' });
    expect(rays.length).toBeGreaterThanOrEqual(4);
    const target = resolveDesignSnapPoint({
      layout,
      point: { x: 3.05, z: 0.04 },
      snapMode: 'off',
      pixelsPerMeter: 48,
      drawContext: {
        activeNodeId: 'a',
        orthogonalLock: true,
        shiftHeld: false,
      },
    });
    expect(target.type).toBe('raw');
  });

  it('captures guide targets only while shift is held', () => {
    const layout = createEmptyWallLayout({ nodes: [{ id: 'a', x: 0, z: 0 }] });
    const withoutShift = resolveDesignSnapPoint({
      layout,
      point: { x: 3.05, z: 0.04 },
      snapMode: 'off',
      pixelsPerMeter: 48,
      drawContext: {
        activeNodeId: 'a',
        orthogonalLock: true,
        shiftHeld: false,
      },
    });
    const withShift = resolveDesignSnapPoint({
      layout,
      point: { x: 3.05, z: 0.04 },
      snapMode: 'off',
      pixelsPerMeter: 48,
      drawContext: {
        activeNodeId: 'a',
        orthogonalLock: true,
        shiftHeld: true,
      },
    });

    expect(withoutShift.type).toBe('raw');
    expect(withShift.type).toBe('guide');
  });

  it('requires at least three committed segments before explicit close footprint', () => {
    let layout = createEmptyWallLayout({ nodes: [{ id: 'a', x: 0, z: 0 }] });
    layout = addWallSegment(layout, 'a', 5, 0);
    layout = addWallSegment(layout, layout.segments[0].endNodeId, 5, 4);
    expect(layout.segments.length).toBe(2);
    layout = addWallSegment(layout, layout.segments[1].endNodeId, 0, 4);
    expect(layout.segments.length).toBe(3);
    const closed = closeFootprint(layout);
    expect(closed.segments.length).toBe(4);
    expect(closed.isFootprintClosed).toBe(true);
  });

  it('adds one final segment to the first node when closing explicitly', () => {
    let layout = createEmptyWallLayout({ nodes: [{ id: 'a', x: 0, z: 0 }] });
    layout = addWallSegment(layout, 'a', 5, 0);
    layout = addWallSegment(layout, layout.segments[0].endNodeId, 5, 4);
    layout = addWallSegment(layout, layout.segments[1].endNodeId, 0, 4);
    const closed = closeFootprint(layout);
    const closing = closed.segments.at(-1);
    expect(closing?.endNodeId).toBe('a');
  });

  it('detects when an explicit closing segment would intersect interior walls', () => {
    let layout = createEmptyWallLayout({ nodes: [{ id: 'a', x: 0, z: 0 }] });
    layout = addWallSegment(layout, 'a', 5, 0);
    layout = addWallSegment(layout, layout.segments[0].endNodeId, 5, 4);
    layout = addWallSegment(layout, layout.segments[1].endNodeId, 0, 4);
    layout = addWallSegment(layout, layout.segments[0].endNodeId, 0, 4);
    expect(closingSegmentWouldIntersect(layout)).toBe(true);
  });
});
