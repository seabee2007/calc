import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { resolveDesignSnapPoint } from '../domain/designSnapRules';
import {
  addWallSegment,
  closeFootprint,
  createEmptyWallLayout,
  resolveOrthogonalClosureAssist,
  resolveOrthogonalCornerPoint,
  areDirectionsPerpendicular,
} from '../domain/wallLayoutRules';
import DesignBuilderPlanCanvas from '../ui/DesignBuilderPlanCanvas';

function buildThreeSides(params: {
  a: { x: number; z: number };
  b: { x: number; z: number };
  c: { x: number; z: number };
}) {
  let layout = createEmptyWallLayout({ nodes: [{ id: 'a', x: params.a.x, z: params.a.z }] });
  layout = addWallSegment(layout, 'a', params.b.x, params.b.z);
  layout = addWallSegment(layout, layout.segments[0].endNodeId, params.c.x, params.c.z);
  return layout;
}

describe('orthogonalClosureAssist', () => {
  it('shows the fourth-side helper for a three-sided orthogonal rectangle', () => {
    const layout = buildThreeSides({ a: { x: 0, z: 0 }, b: { x: 5, z: 0 }, c: { x: 5, z: 4 } });
    const activeNodeId = layout.segments[1].endNodeId;
    const assist = resolveOrthogonalClosureAssist({
      layout,
      activeNodeId,
      candidatePoint: { x: 0, z: 4 },
    });

    expect(assist?.isEligible).toBe(true);
    expect(assist?.closingLengthMeters).toBeCloseTo(4, 6);
    expect(assist?.closingAngleDegrees).toBe(90);
  });

  it('connects the candidate endpoint to the first node', () => {
    const layout = buildThreeSides({ a: { x: 0, z: 0 }, b: { x: 5, z: 0 }, c: { x: 5, z: 4 } });
    const activeNodeId = layout.segments[1].endNodeId;
    const assist = resolveOrthogonalClosureAssist({
      layout,
      activeNodeId,
      candidatePoint: { x: 0, z: 4 },
    });

    expect(assist?.firstNode).toEqual({ id: 'a', x: 0, z: 0 });
    expect(assist?.candidatePoint).toEqual({ x: 0, z: 4 });
  });

  it('does not auto-close the footprint when committing the active segment', () => {
    let layout = buildThreeSides({ a: { x: 0, z: 0 }, b: { x: 5, z: 0 }, c: { x: 5, z: 4 } });
    layout = addWallSegment(layout, layout.segments[1].endNodeId, 0, 4);
    expect(layout.segments).toHaveLength(3);
    expect(layout.isFootprintClosed).toBe(false);
    const closed = closeFootprint(layout);
    expect(closed.segments).toHaveLength(4);
    expect(closed.isFootprintClosed).toBe(true);
  });

  it('keeps free-angle drawing possible while orthogonal guides are on', () => {
    const layout = buildThreeSides({ a: { x: 0, z: 0 }, b: { x: 5, z: 0 }, c: { x: 5, z: 4 } });
    const activeNodeId = layout.segments[1].endNodeId;
    const assist = resolveOrthogonalClosureAssist({
      layout,
      activeNodeId,
      candidatePoint: { x: 1.5, z: 5.2 },
    });

    expect(assist).toBeNull();
  });

  it('hides the helper when the active segment is no longer perpendicular', () => {
    const layout = buildThreeSides({ a: { x: 0, z: 0 }, b: { x: 5, z: 0 }, c: { x: 5, z: 4 } });
    const activeNodeId = layout.segments[1].endNodeId;
    const assist = resolveOrthogonalClosureAssist({
      layout,
      activeNodeId,
      candidatePoint: { x: 6.5, z: 4.8 },
    });

    expect(assist).toBeNull();
  });

  it('works for clockwise and counterclockwise rectangles', () => {
    const clockwise = buildThreeSides({ a: { x: 0, z: 0 }, b: { x: 5, z: 0 }, c: { x: 5, z: 4 } });
    const clockwiseAssist = resolveOrthogonalClosureAssist({
      layout: clockwise,
      activeNodeId: clockwise.segments[1].endNodeId,
      candidatePoint: { x: 0, z: 4 },
    });

    const counter = buildThreeSides({ a: { x: 0, z: 0 }, b: { x: 0, z: 4 }, c: { x: 5, z: 4 } });
    const counterAssist = resolveOrthogonalClosureAssist({
      layout: counter,
      activeNodeId: counter.segments[1].endNodeId,
      candidatePoint: { x: 5, z: 0 },
    });

    expect(clockwiseAssist?.isEligible).toBe(true);
    expect(counterAssist?.isEligible).toBe(true);
    expect(counterAssist?.closingLengthMeters).toBeCloseTo(5, 6);
  });

  it('uses snapped world coordinates for the candidate endpoint', () => {
    const layout = buildThreeSides({ a: { x: 10, z: 20 }, b: { x: 15, z: 20 }, c: { x: 15, z: 24 } });
    const activeNodeId = layout.segments[1].endNodeId;
    const snappedCandidate = { x: 10, z: 24 };
    const assist = resolveOrthogonalClosureAssist({
      layout,
      activeNodeId,
      candidatePoint: snappedCandidate,
    });

    expect(assist?.candidatePoint).toEqual(snappedCandidate);
    expect(assist?.firstNode).toEqual({ id: 'a', x: 10, z: 20 });
  });

  it('captures the rectangle corner without requiring shift', () => {
    const layout = buildThreeSides({ a: { x: 0, z: 0 }, b: { x: 5, z: 0 }, c: { x: 5, z: 4 } });
    const activeNodeId = layout.segments[1].endNodeId;
    const corner = resolveOrthogonalCornerPoint({ layout, activeNodeId });
    expect(corner).toEqual({ x: 0, z: 4 });

    const withoutShift = resolveDesignSnapPoint({
      layout,
      point: { x: 0.04, z: 4.02 },
      snapMode: 'off',
      pixelsPerMeter: 48,
      drawContext: {
        activeNodeId,
        orthogonalLock: true,
        shiftHeld: false,
        closureCornerCandidate: corner,
      },
    });
    const withShift = resolveDesignSnapPoint({
      layout,
      point: { x: 0, z: 4 },
      snapMode: 'off',
      pixelsPerMeter: 48,
      drawContext: {
        activeNodeId,
        orthogonalLock: true,
        shiftHeld: true,
        closureCornerCandidate: corner,
      },
    });

    expect(withoutShift.type).toBe('guide');
    expect(withoutShift.label).toBe('Exact rectangle corner');
    expect(withoutShift.point).toEqual(corner);
    expect(withShift.type).toBe('guide');
    expect(withShift.label).toBe('Exact rectangle corner');
    expect(withShift.point).toEqual(corner);
  });

  it('does not show a helper for self-intersecting closure geometry', () => {
    const layout = {
      ...createEmptyWallLayout(),
      nodes: [
        { id: 'a', x: 0, z: 0 },
        { id: 'b', x: 5, z: 0 },
        { id: 'c', x: 5, z: 4 },
        { id: 'i', x: 0, z: 2 },
      ],
      segments: [
        {
          id: 's1',
          startNodeId: 'a',
          endNodeId: 'b',
          wallHeightMeters: 2.8,
          wallThicknessMeters: 0.19,
        },
        {
          id: 's2',
          startNodeId: 'b',
          endNodeId: 'i',
          wallHeightMeters: 2.8,
          wallThicknessMeters: 0.19,
        },
        {
          id: 's3',
          startNodeId: 'b',
          endNodeId: 'c',
          wallHeightMeters: 2.8,
          wallThicknessMeters: 0.19,
        },
      ],
    };
    const assist = resolveOrthogonalClosureAssist({
      layout,
      activeNodeId: 'c',
      candidatePoint: { x: 0, z: 4 },
    });

    expect(assist).toBeNull();
  });

  it('renders the closure helper line in plan view', () => {
    const layout = buildThreeSides({ a: { x: 0, z: 0 }, b: { x: 5, z: 0 }, c: { x: 5, z: 4 } });
    const assist = resolveOrthogonalClosureAssist({
      layout,
      activeNodeId: layout.segments[1].endNodeId,
      candidatePoint: { x: 0, z: 4 },
    });
    const { container } = render(
      <DesignBuilderPlanCanvas
        layout={layout}
        toolMode="draw_wall"
        draftEnd={{ x: 0, z: 4 }}
        activeNodeId={layout.segments[1].endNodeId}
        orthogonalClosureAssist={assist}
        viewport={{ centerX: 2.5, centerZ: 2, zoom: 48 }}
        onInteraction={() => undefined}
      />,
    );

    expect(container.querySelector('[data-orthogonal-closure-assist="true"]')).toBeTruthy();
    expect(container.querySelector('[data-orthogonal-closure-label="true"]')?.textContent).toMatch(/Final leg: 4\.00 m · 90°/);
  });
});

describe('areDirectionsPerpendicular', () => {
  it('uses angular tolerance instead of exact floating-point equality', () => {
    expect(areDirectionsPerpendicular({ x: 5, z: 0 }, { x: 0, z: 5.001 })).toBe(true);
    expect(areDirectionsPerpendicular({ x: 5, z: 0 }, { x: 1, z: 5 })).toBe(false);
  });
});
