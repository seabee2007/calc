import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import { resolveOpeningPlacementFromPlanPoint } from '../domain/openingPlacementResolver';
import { createEmptyWallLayout, createOutsideFaceRectangleLayout } from '../domain/wallLayoutRules';
import { getSegmentFramesForWallLayout, type SegmentFrame } from '../geometry/designGeometry';
import { projectCellWidthPx } from '../domain/planGridState';
import { DoorConfigurationControls } from '../ui/DoorConfigurationControls';
import DesignBuilderPlanCanvas from '../ui/DesignBuilderPlanCanvas';
import type { PlacedDesignComponent, ResolvedRoofSystem, StructuralFrameSystemParameters } from '../types';

function collectWallEndpointScreenPoints(container: HTMLElement): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  container.querySelectorAll('line[data-plan-wall-visible="true"]').forEach((line) => {
    points.push({ x: Number(line.getAttribute('x1')), y: Number(line.getAttribute('y1')) });
    points.push({ x: Number(line.getAttribute('x2')), y: Number(line.getAttribute('y2')) });
  });
  return points;
}

function assertRenderedCornersMeet(
  container: HTMLElement,
  _layout: ReturnType<typeof createOutsideFaceRectangleLayout>,
) {
  const wallPoints = collectWallEndpointScreenPoints(container);
  const continuousEndpointCount = wallPoints.filter((point) => {
    const matching = wallPoints.filter((candidate) => Math.hypot(point.x - candidate.x, point.y - candidate.y) < 0.75);
    return matching.length >= 2;
  }).length;
  expect(continuousEndpointCount).toBeGreaterThanOrEqual(8);
}

function expectRoughOpeningCutToBeSquare(
  cut: Element | null,
  frame: SegmentFrame,
  stationMeters: number,
  viewport = { centerX: 0, centerZ: 0, zoom: 100 },
) {
  expect(cut).toBeTruthy();
  const halfWallThickness = frame.wallThicknessMeters / 2;
  const center = {
    x: frame.centerlineStart.x + frame.tangent.x * stationMeters,
    z: frame.centerlineStart.z + frame.tangent.z * stationMeters,
  };
  const exterior = {
    x: center.x - frame.inwardNormal.x * halfWallThickness,
    z: center.z - frame.inwardNormal.z * halfWallThickness,
  };
  const interior = {
    x: center.x + frame.inwardNormal.x * halfWallThickness,
    z: center.z + frame.inwardNormal.z * halfWallThickness,
  };
  expect(Number(cut?.getAttribute('x1'))).toBeCloseTo(450 + (exterior.x - viewport.centerX) * viewport.zoom, 6);
  expect(Number(cut?.getAttribute('y1'))).toBeCloseTo(260 - (exterior.z - viewport.centerZ) * viewport.zoom, 6);
  expect(Number(cut?.getAttribute('x2'))).toBeCloseTo(450 + (interior.x - viewport.centerX) * viewport.zoom, 6);
  expect(Number(cut?.getAttribute('y2'))).toBeCloseTo(260 - (interior.z - viewport.centerZ) * viewport.zoom, 6);
}

function mockPlanSurface(svg: SVGSVGElement) {
  (svg as unknown as { setPointerCapture: ReturnType<typeof vi.fn> }).setPointerCapture = vi.fn();
  (svg as unknown as { releasePointerCapture: ReturnType<typeof vi.fn> }).releasePointerCapture = vi.fn();
  vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 800,
    height: 400,
    right: 800,
    bottom: 400,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
}

function createColumnDragFixture() {
  const layout = createEmptyWallLayout({
    nodes: [
      { id: 'node-a', x: 0, z: 0 },
      { id: 'node-b', x: 4, z: 0 },
    ],
  });
  const frameSystem = {
    kind: 'structural_frame_system',
    buildingSystemMode: 'reinforced_concrete_frame_with_cmu_infill',
    defaultColumnWidthMeters: 0.3,
    defaultColumnDepthMeters: 0.3,
    defaultGradeBeamWidthMeters: 0.2,
    defaultGradeBeamDepthMeters: 0.3,
    defaultRingBeamWidthMeters: 0.2,
    defaultRingBeamDepthMeters: 0.3,
    columns: [
      {
        id: 'column-a',
        name: 'Column A',
        kind: 'rc_column',
        position: { x: 0, z: 0 },
        widthMeters: 0.3,
        depthMeters: 0.3,
        heightMeters: 3,
        baseElevationMeters: 0,
        topElevationMeters: 3,
        hostNodeId: 'node-a',
        source: 'auto_frame_layout',
      },
      {
        id: 'column-b',
        name: 'Column B',
        kind: 'rc_column',
        position: { x: 4, z: 0 },
        widthMeters: 0.3,
        depthMeters: 0.3,
        heightMeters: 3,
        baseElevationMeters: 0,
        topElevationMeters: 3,
        hostNodeId: 'node-b',
        source: 'auto_frame_layout',
      },
    ],
    beams: [
      {
        id: 'beam-a-b',
        name: 'Beam A-B',
        kind: 'plinth_beam',
        startColumnId: 'column-a',
        endColumnId: 'column-b',
        startPoint: { x: 0, y: 0, z: 0 },
        endPoint: { x: 4, y: 0, z: 0 },
        widthMeters: 0.22,
        depthMeters: 0.3,
        baseElevationMeters: 0,
        topElevationMeters: 0.3,
        source: 'auto_frame_layout',
      },
      {
        id: 'tie-beam-a-b',
        name: 'Tie Beam A-B',
        kind: 'tie_beam',
        startColumnId: 'column-a',
        endColumnId: 'column-b',
        startPoint: { x: 0, y: 1.2, z: 0 },
        endPoint: { x: 4, y: 1.2, z: 0 },
        widthMeters: 0.2,
        depthMeters: 0.25,
        baseElevationMeters: 1,
        topElevationMeters: 1.25,
        source: 'auto_frame_layout',
      },
      {
        id: 'roof-beam-a-b',
        name: 'Roof Beam A-B',
        kind: 'roof_beam',
        startColumnId: 'column-a',
        endColumnId: 'column-b',
        startPoint: { x: 0, y: 2.8, z: 0 },
        endPoint: { x: 4, y: 2.8, z: 0 },
        widthMeters: 0.2,
        depthMeters: 0.25,
        baseElevationMeters: 2.55,
        topElevationMeters: 2.8,
        source: 'auto_frame_layout',
      },
    ],
  } as const;
  const isolatedFootings = [
    {
      id: 'footing-a',
      name: 'Footing A',
      columnId: 'column-a',
      position: { x: 0, z: 0 },
      widthMeters: 0.9,
      lengthMeters: 0.9,
      thicknessMeters: 0.3,
      topElevationMeters: -0.3,
      bottomElevationMeters: -0.6,
      centerElevationMeters: -0.45,
      source: 'auto_at_column',
    },
  ] as const;
  return { layout, frameSystem, isolatedFootings };
}

function createResolvedRoofFixture(): ResolvedRoofSystem {
  const perimeter = [
    { x: -0.6, y: 3, z: -0.6 },
    { x: 4.6, y: 3, z: -0.6 },
    { x: 4.6, y: 3, z: 2.6 },
    { x: -0.6, y: 3, z: 2.6 },
  ];
  const ridgeStart = { x: 0.4, y: 3.8, z: 1 };
  const ridgeEnd = { x: 3.6, y: 3.8, z: 1 };
  const trussPlacements: ResolvedRoofSystem['trussPlacements'] = [0.4, 2, 3.6].map((x, index) => {
    const bearingLeft = { x, y: 3, z: -0.6 };
    const bearingRight = { x, y: 3, z: 2.6 };
    const apex = { x, y: 3.8, z: 1 };
    return {
      id: `truss-${index + 1}`,
      stationMeters: index * 1.6,
      bearingLeft,
      bearingRight,
      apex,
      ridgeAxis: 'x',
      planeNormal: { x: 1, y: 0, z: 0 },
      members: [
        { id: `truss-${index + 1}-bottom`, memberKind: 'bottom_chord', start: bearingLeft, end: bearingRight },
        { id: `truss-${index + 1}-top-left`, memberKind: 'top_chord_left', start: bearingLeft, end: apex },
        { id: `truss-${index + 1}-top-right`, memberKind: 'top_chord_right', start: apex, end: bearingRight },
        { id: `truss-${index + 1}-web-vertical`, memberKind: 'vertical_web', start: { x, y: 3, z: 1 }, end: apex },
        { id: `truss-${index + 1}-web-left`, memberKind: 'diagonal_web', start: { x, y: 3, z: 0.1 }, end: apex },
        { id: `truss-${index + 1}-web-right`, memberKind: 'diagonal_web', start: { x, y: 3, z: 1.9 }, end: apex },
      ],
    };
  });
  const purlinPlacements: ResolvedRoofSystem['purlinPlacements'] = [
    { id: 'north-eave-purlin', slopePlaneId: 'north-slope', rowIndex: 0, start: { x: -0.6, y: 3.05, z: -0.45 }, end: { x: 4.6, y: 3.05, z: -0.45 }, planeNormal: { x: 0, y: 1, z: -0.25 } },
    { id: 'north-mid-purlin', slopePlaneId: 'north-slope', rowIndex: 1, start: { x: -0.2, y: 3.42, z: 0.35 }, end: { x: 4.2, y: 3.42, z: 0.35 }, planeNormal: { x: 0, y: 1, z: -0.25 } },
    { id: 'south-mid-purlin', slopePlaneId: 'south-slope', rowIndex: 1, start: { x: -0.2, y: 3.42, z: 1.65 }, end: { x: 4.2, y: 3.42, z: 1.65 }, planeNormal: { x: 0, y: 1, z: 0.25 } },
    { id: 'south-eave-purlin', slopePlaneId: 'south-slope', rowIndex: 0, start: { x: -0.6, y: 3.05, z: 2.45 }, end: { x: 4.6, y: 3.05, z: 2.45 }, planeNormal: { x: 0, y: 1, z: 0.25 } },
  ];
  return {
    supported: true,
    roofType: 'gable',
    roofBearingSource: 'roof_beam_outer_faces',
    exteriorRoofBeamBounds: {
      footprint: perimeter,
      center: { x: 2, y: 3, z: 1 },
      widthMeters: 4,
      depthMeters: 2,
    },
    structuralBearingPerimeter: [
      { x: 0, y: 3, z: 0 },
      { x: 4, y: 3, z: 0 },
      { x: 4, y: 3, z: 2 },
      { x: 0, y: 3, z: 2 },
    ],
    claddingPerimeter: perimeter,
    roofSheetPerimeter: perimeter,
    eaveFootprint: perimeter,
    ridgeStart,
    ridgeEnd,
    structuralRidgeStart: ridgeStart,
    structuralRidgeEnd: ridgeEnd,
    claddingRidgeStart: ridgeStart,
    claddingRidgeEnd: ridgeEnd,
    structuralRidgeLengthMeters: 3.2,
    claddingRidgeLengthMeters: 3.2,
    gableEndOverhangMeters: 0.6,
    ridgeCapPlacement: null,
    ridgeCapPlacements: [],
    roofBeamTopElevationMeters: 3,
    roofBeamTopY: 3,
    peakElevationMeters: 3.8,
    roofPeakY: 3.8,
    roofAssemblyThicknessMeters: 0.15,
    roofTopPlanes: [
      {
        id: 'north-slope',
        corners: [perimeter[0]!, perimeter[1]!, ridgeEnd, ridgeStart],
        normal: { x: 0, y: 1, z: -0.25 },
      },
      {
        id: 'south-slope',
        corners: [ridgeStart, ridgeEnd, perimeter[2]!, perimeter[3]!],
        normal: { x: 0, y: 1, z: 0.25 },
      },
    ],
    claddingDisplayPlanes: [],
    roofUndersidePlanes: [],
    gableEndSegmentIds: [],
    rafterRunMeters: 1,
    rafterRiseMeters: 0.8,
    rafterLengthMeters: 1.28,
    structuralRafterRunMeters: 1,
    claddingRafterRunMeters: 1.6,
    claddingRafterLengthMeters: 1.79,
    roofPitchRadians: Math.atan(0.8),
    roofRunMeters: 1,
    roofRiseMeters: 0.8,
    roofMemberReferenceLengthMeters: 1.28,
    ridgeLengthMeters: 3.2,
    roofSurfaceAreaSquareMeters: 12,
    trussCount: trussPlacements.length,
    actualTrussSpacingMeters: 1.6,
    trussStations: trussPlacements.map((truss) => truss.stationMeters),
    trussPlacements,
    purlinRowsPerSlope: 2,
    actualPurlinSpacingMeters: 0.8,
    purlinPlacements,
    hipFramingMembers: [],
    gableCmuAreaSquareMeters: 0,
    rakedCapVolumeCubicMeters: 0,
    gableEnds: [],
    gableEndRoofingClosures: [],
    fasciaPlacements: [],
    soffitPlacements: [],
    warnings: [],
  };
}

function createHipResolvedRoofFixture(): ResolvedRoofSystem {
  const base = createResolvedRoofFixture();
  const member = (
    id: string,
    memberKind: ResolvedRoofSystem['hipFramingMembers'][number]['memberKind'],
    start: { x: number; y: number; z: number },
    end: { x: number; y: number; z: number },
    slopePlaneId?: string,
  ): ResolvedRoofSystem['hipFramingMembers'][number] => ({
    id,
    memberKind,
    start,
    end,
    slopePlaneId,
    lengthMeters: Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z),
    source: 'hip_roof_framing_solver',
  });

  const ridgeStart = base.ridgeStart!;
  const ridgeEnd = base.ridgeEnd!;
  const northWest = { x: -0.6, y: 3, z: -0.6 };
  const northEast = { x: 4.6, y: 3, z: -0.6 };
  const southEast = { x: 4.6, y: 3, z: 2.6 };
  const southWest = { x: -0.6, y: 3, z: 2.6 };

  return {
    ...base,
    roofType: 'hip',
    roofTopPlanes: [
      {
        id: 'hip-north',
        corners: [northWest, northEast, ridgeEnd, ridgeStart],
        normal: { x: 0, y: 1, z: -0.25 },
      },
      {
        id: 'hip-east',
        corners: [northEast, southEast, ridgeEnd],
        normal: { x: 0.25, y: 1, z: 0 },
      },
      {
        id: 'hip-south',
        corners: [ridgeStart, ridgeEnd, southEast, southWest],
        normal: { x: 0, y: 1, z: 0.25 },
      },
      {
        id: 'hip-west',
        corners: [southWest, northWest, ridgeStart],
        normal: { x: -0.25, y: 1, z: 0 },
      },
    ],
    ridgeCapPlacements: [
      {
        id: 'hip-top-ridge-cap',
        start: ridgeStart,
        end: ridgeEnd,
        widthMeters: 0.3,
        thicknessMeters: 0.02,
        roofAngleRadians: Math.PI / 2,
      },
    ],
    hipFramingMembers: [
      member('hip-ridge', 'ridge', ridgeStart, ridgeEnd),
      member('hip-rafter-nw', 'hip', northWest, ridgeStart),
      member('hip-rafter-ne', 'hip', northEast, ridgeEnd),
      member('hip-jack-north', 'jack', { x: 1.2, y: 3, z: -0.6 }, { x: 0.8, y: 3.4, z: 0.2 }, 'north-hip'),
      member('hip-common-south', 'common', { x: 2, y: 3, z: 2.6 }, { x: 2, y: 3.8, z: 1 }, 'south-hip'),
      member('hip-corner-support', 'hip_corner_support', southWest, { x: 0.4, y: 3.3, z: 1 }),
      member('hip-jack-bottom', 'hip_jack_bottom_chord', { x: 1.1, y: 3, z: 2.2 }, { x: 2.6, y: 3, z: 2.2 }),
      member('hip-ridge-end-frame', 'ridge_end_frame', { x: 0.4, y: 3, z: -0.6 }, ridgeStart),
      member('hip-ridge-end-web', 'ridge_end_frame_web', { x: 0.4, y: 3, z: 0.2 }, ridgeStart),
      member('hip-ridge-end-bottom', 'ridge_end_frame_bottom', { x: 0.2, y: 3, z: -0.3 }, { x: 0.6, y: 3, z: -0.3 }),
      member('hip-rafter-se', 'hip', southEast, ridgeEnd),
    ],
  };
}

function createPlacedColumn(id = 'placed-column-a', xMeters = 0, zMeters = 0): PlacedDesignComponent {
  return {
    id,
    type: 'column',
    division: 'Structure',
    category: 'structure',
    viewPlacement: {
      plan: { xMeters, zMeters },
    },
    parameters: {
      widthMeters: 0.3,
      depthMeters: 0.3,
      heightMeters: 3,
      baseElevationMeters: 0,
      autoFooter: true,
      footerWidthMeters: 0.9,
      footerLengthMeters: 0.9,
      footerThicknessMeters: 0.3,
      footerBottomElevationMeters: -0.6,
      footerTopElevationMeters: -0.3,
    },
    derived: { topElevationMeters: 3 },
    metadata: {
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  };
}

function createPlacedFooter(id = 'placed-footer-a', xMeters = 0, zMeters = 0): PlacedDesignComponent {
  return {
    id,
    type: 'footer',
    division: 'Structure',
    category: 'structure',
    viewPlacement: {
      plan: { xMeters, zMeters },
    },
    parameters: {
      widthMeters: 0.9,
      lengthMeters: 0.9,
      thicknessMeters: 0.3,
      bottomElevationMeters: -0.6,
      topElevationMeters: -0.3,
    },
    derived: { topElevationMeters: -0.3 },
    metadata: {
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  };
}

describe('DesignBuilderPlanCanvas', () => {
  it('shows adaptive view grid and persistent snap spacing in the status chip', () => {
    const { container } = render(
      <DesignBuilderPlanCanvas
        layout={createEmptyWallLayout()}
        toolMode="select"
        snapSpacingMeters={0.1}
        snapMode="grid"
        viewport={{ centerX: 0, centerZ: 0, zoom: 42 }}
        onInteraction={vi.fn()}
      />,
    );

    const chip = container.querySelector('[data-view-grid-meters]');
    expect(chip).toHaveAttribute('data-view-grid-meters', '1');
    expect(chip).toHaveAttribute('data-snap-spacing-meters', '0.1');
    expect(chip?.textContent).toMatch(/View grid 1 m/);
    expect(chip?.textContent).toMatch(/Snap 0\.1 m/);
  });

  it('renders grid lines using the same display spacing reported in the status chip', () => {
    const { container } = render(
      <DesignBuilderPlanCanvas
        layout={createEmptyWallLayout()}
        toolMode="select"
        snapSpacingMeters={0.1}
        snapMode="grid"
        viewport={{ centerX: 0, centerZ: 0, zoom: 420 }}
        onInteraction={vi.fn()}
      />,
    );

    const chip = container.querySelector('[data-view-grid-meters]');
    const svg = screen.getByLabelText(/design builder wall layout plan view/i);
    const minorLines = Array.from(svg.querySelectorAll('line[data-grid-kind="minor"]'));
    const spacing = Number(minorLines[0]?.getAttribute('data-grid-spacing-meters'));

    expect(chip).toHaveAttribute('data-view-grid-meters', '0.1');
    expect(spacing).toBeCloseTo(0.1, 6);
    expect(projectCellWidthPx(spacing, { centerX: 0, centerZ: 0, zoom: 420 })).toBeGreaterThanOrEqual(26);
  });

  it('keeps snap spacing unchanged when wheel zoom changes the viewport', () => {
    const onViewportChange = vi.fn();
    const { container, rerender } = render(
      <DesignBuilderPlanCanvas
        layout={createEmptyWallLayout()}
        toolMode="select"
        snapSpacingMeters={0.1}
        snapMode="grid"
        viewport={{ centerX: 0, centerZ: 0, zoom: 420 }}
        onViewportChange={onViewportChange}
        onInteraction={vi.fn()}
      />,
    );

    expect(container.querySelector('[data-snap-spacing-meters]')).toHaveAttribute('data-snap-spacing-meters', '0.1');
    expect(container.querySelector('[data-view-grid-meters]')).toHaveAttribute('data-view-grid-meters', '0.1');

    rerender(
      <DesignBuilderPlanCanvas
        layout={createEmptyWallLayout()}
        toolMode="select"
        snapSpacingMeters={0.1}
        snapMode="grid"
        viewport={{ centerX: 0, centerZ: 0, zoom: 4 }}
        onViewportChange={onViewportChange}
        onInteraction={vi.fn()}
      />,
    );

    expect(container.querySelector('[data-snap-spacing-meters]')).toHaveAttribute('data-snap-spacing-meters', '0.1');
    expect(Number(container.querySelector('[data-view-grid-meters]')?.getAttribute('data-view-grid-meters'))).toBeGreaterThan(0.1);
  });

  it('renders a hollow snap marker before click and solid placed nodes', () => {
    const layout = createOutsideFaceRectangleLayout({ lengthMeters: 6, widthMeters: 5 });
    render(
      <DesignBuilderPlanCanvas
        layout={layout}
        toolMode="draw_wall"
        active2DView="floor-plan"
        draftEnd={{ x: 0, z: 0 }}
        activeNodeId={layout.nodes[0].id}
        drawStartNodeId={layout.nodes[0].id}
        onInteraction={vi.fn()}
      />,
    );

    const svg = screen.getByLabelText(/design builder wall layout plan view/i);
    const circles = Array.from(svg.querySelectorAll('circle'));

    expect(circles.some((circle) => circle.getAttribute('fill') === 'none')).toBe(true);
    expect(circles.some((circle) => circle.getAttribute('fill') === '#22d3ee')).toBe(true);
  });

  it('maps pointer movement from the rendered plan surface after resize', () => {
    const onInteraction = vi.fn();
    render(
      <DesignBuilderPlanCanvas
        layout={createEmptyWallLayout()}
        toolMode="draw_wall"
        active2DView="floor-plan"
        onInteraction={onInteraction}
      />,
    );

    const svg = screen.getByLabelText(/design builder wall layout plan view/i) as SVGSVGElement;
    Object.defineProperty(svg, 'viewBox', {
      configurable: true,
      value: { baseVal: { x: 0, y: 0, width: 384, height: 288 } },
    });
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 768,
      height: 576,
      right: 768,
      bottom: 576,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    fireEvent.pointerMove(svg, { clientX: 384, clientY: 288 });

    expect(onInteraction).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'draw_preview',
      planX: 0,
      planZ: 0,
    }));
  });

  it('emits committed draw point from the same plan surface transform', () => {
    const onInteraction = vi.fn();
    render(
      <DesignBuilderPlanCanvas
        layout={createEmptyWallLayout()}
        toolMode="draw_wall"
        active2DView="floor-plan"
        onInteraction={onInteraction}
      />,
    );

    const svg = screen.getByLabelText(/design builder wall layout plan view/i) as SVGSVGElement;
    Object.defineProperty(svg, 'viewBox', {
      configurable: true,
      value: { baseVal: { x: 0, y: 0, width: 384, height: 288 } },
    });
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
      left: 240,
      top: 120,
      width: 768,
      height: 576,
      right: 1008,
      bottom: 696,
      x: 240,
      y: 120,
      toJSON: () => ({}),
    } as DOMRect);

    fireEvent.pointerDown(svg, { button: 0, clientX: 624, clientY: 408 });

    expect(onInteraction).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'draw_point',
      planX: 0,
      planZ: 0,
    }));
  });

  it('draws using world coordinates after pan and zoom viewport changes', () => {
    const onInteraction = vi.fn();
    render(
      <DesignBuilderPlanCanvas
        layout={createEmptyWallLayout()}
        toolMode="draw_wall"
        active2DView="floor-plan"
        viewport={{ centerX: 10, centerZ: -5, zoom: 24 }}
        onInteraction={onInteraction}
      />,
    );

    const svg = screen.getByLabelText(/design builder wall layout plan view/i) as SVGSVGElement;
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 50,
      width: 800,
      height: 400,
      right: 900,
      bottom: 450,
      x: 100,
      y: 50,
      toJSON: () => ({}),
    } as DOMRect);

    fireEvent.pointerDown(svg, { button: 0, clientX: 500, clientY: 250 });

    expect(onInteraction).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'draw_point',
      planX: 10,
      planZ: -5,
    }));
  });

  it('wheel zoom emits a wider viewport when zooming out', () => {
    const onViewportChange = vi.fn();
    render(
      <DesignBuilderPlanCanvas
        layout={createEmptyWallLayout()}
        toolMode="select"
        viewport={{ centerX: 0, centerZ: 0, zoom: 48 }}
        onViewportChange={onViewportChange}
        onInteraction={vi.fn()}
      />,
    );

    const svg = screen.getByLabelText(/design builder wall layout plan view/i) as SVGSVGElement;
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 800,
      height: 400,
      right: 800,
      bottom: 400,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    const event = createEvent.wheel(svg, { clientX: 400, clientY: 200, deltaY: 100 });
    fireEvent(svg, event);

    expect(event.defaultPrevented).toBe(true);
    expect(onViewportChange).toHaveBeenCalledWith(expect.objectContaining({ zoom: expect.any(Number) }));
    expect(onViewportChange.mock.calls[0][0].zoom).toBeLessThan(48);
  });

  it('does not intercept wheel events outside the plan surface', () => {
    const onViewportChange = vi.fn();
    render(
      <DesignBuilderPlanCanvas
        layout={createEmptyWallLayout()}
        toolMode="select"
        viewport={{ centerX: 0, centerZ: 0, zoom: 48 }}
        onViewportChange={onViewportChange}
        onInteraction={vi.fn()}
      />,
    );

    const event = createEvent.wheel(document.body, { clientX: 10, clientY: 10, deltaY: 100 });
    fireEvent(document.body, event);

    expect(event.defaultPrevented).toBe(false);
    expect(onViewportChange).not.toHaveBeenCalled();
  });

  it('does not create draw events for clicks outside the plan surface', () => {
    const onInteraction = vi.fn();
    render(
      <DesignBuilderPlanCanvas
        layout={createEmptyWallLayout()}
        toolMode="draw_wall"
        active2DView="floor-plan"
        onInteraction={onInteraction}
      />,
    );

    const svg = screen.getByLabelText(/design builder wall layout plan view/i) as SVGSVGElement;
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 100,
      width: 400,
      height: 300,
      right: 500,
      bottom: 400,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    } as DOMRect);

    fireEvent.pointerDown(svg, { button: 0, clientX: 80, clientY: 200 });

    expect(onInteraction).not.toHaveBeenCalled();
  });

  it('renders preview endpoint and snap marker at the same projected point', () => {
    const layout = createEmptyWallLayout({
      nodes: [{ id: 'node-1', x: 0, z: 0 }],
    });
    render(
      <DesignBuilderPlanCanvas
        layout={layout}
        toolMode="draw_wall"
        active2DView="floor-plan"
        activeNodeId="node-1"
        draftEnd={{ x: 2, z: 1 }}
        onInteraction={vi.fn()}
      />,
    );

    const svg = screen.getByLabelText(/design builder wall layout plan view/i);
    const previewLine = Array.from(svg.querySelectorAll('line')).find((line) => line.getAttribute('stroke-width') === '3');
    const snapCircle = Array.from(svg.querySelectorAll('circle')).find((circle) => circle.getAttribute('fill') === 'none');

    expect(previewLine?.getAttribute('x2')).toBe(snapCircle?.getAttribute('cx'));
    expect(previewLine?.getAttribute('y2')).toBe(snapCircle?.getAttribute('cy'));
  });

  it('prevents context menu and undoes the last draw segment on right-click', () => {
    const onInteraction = vi.fn();
    render(
      <DesignBuilderPlanCanvas
        layout={createOutsideFaceRectangleLayout({ lengthMeters: 6, widthMeters: 5 })}
        toolMode="draw_wall"
        active2DView="floor-plan"
        onInteraction={onInteraction}
      />,
    );

    const svg = screen.getByLabelText(/design builder wall layout plan view/i);
    const event = createEvent.contextMenu(svg);
    fireEvent(svg, event);

    expect(event.defaultPrevented).toBe(true);
    expect(onInteraction).toHaveBeenCalledWith(expect.objectContaining({ kind: 'undo_last_segment' }));
  });

  it('renders door and window placement previews on the wall line', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const frames = getSegmentFramesForWallLayout(preset.wallLayout, preset.wall);
    const frame = frames[0]!;
    const resolved = resolveOpeningPlacementFromPlanPoint({
      planX: frame.exteriorStart.x + frame.tangent.x * (frame.lengthMeters * 0.5),
      planZ: frame.exteriorStart.z + frame.tangent.z * (frame.lengthMeters * 0.5),
      hostSegmentId: frame.segmentId,
      segmentFrame: frame,
      openingDefinition: {
        type: 'door',
        widthMeters: 0.9,
        heightMeters: 2.1,
        roughOpeningAllowanceMeters: 0.05,
      },
      snapMode: 'grid',
      gridSpacingMeters: 0.1,
      wall: { ...preset.wall, snapToModule: false },
    });

    const { container } = render(
      <DesignBuilderPlanCanvas
        layout={preset.wallLayout}
        toolMode="place_door"
        active2DView="floor-plan"
        segmentFrames={frames}
        openingPreview={{
          resolvedPlacement: resolved,
          openingType: 'door',
          isValid: true,
          statusKind: 'clean',
        }}
        onInteraction={vi.fn()}
      />,
    );

    expect(container.querySelector('[data-plan-opening="door"]')).toBeTruthy();
    expect(container.querySelector('[data-plan-opening-state="valid"]')).toBeTruthy();
  });

  it('renders Floor Plan as the active plan title', () => {
    const { container } = render(
      <DesignBuilderPlanCanvas
        layout={createOutsideFaceRectangleLayout({ lengthMeters: 6, widthMeters: 5 })}
        toolMode="select"
        active2DView="floor-plan"
        onInteraction={vi.fn()}
      />,
    );

    expect(container.querySelector('[data-drawing-annotation="plan-title"]')?.textContent).toContain('Floor Plan');
  });

  it('keeps Foundation Plan free of opening symbols and opening wall runs', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const frames = getSegmentFramesForWallLayout(preset.wallLayout, preset.wall);
    const frame = frames[0]!;
    const resolved = resolveOpeningPlacementFromPlanPoint({
      planX: frame.exteriorStart.x + frame.tangent.x * 2.5,
      planZ: frame.exteriorStart.z + frame.tangent.z * 2.5,
      hostSegmentId: frame.segmentId,
      segmentFrame: frame,
      openingDefinition: {
        type: 'window',
        widthMeters: 1.2,
        heightMeters: 0.9,
        sillHeightMeters: 1,
        roughOpeningAllowanceMeters: 0.05,
      },
      snapMode: 'grid',
      gridSpacingMeters: 0.1,
      wall: { ...preset.wall, snapToModule: false },
    });

    const { container } = render(
      <DesignBuilderPlanCanvas
        layout={preset.wallLayout}
        toolMode="select"
        active2DView="foundation-plan"
        segmentFrames={frames}
        openingItems={[{
          openingId: 'window-1',
          openingType: 'window',
          resolved,
          isValid: true,
          statusKind: 'clean',
        }]}
        onInteraction={vi.fn()}
      />,
    );

    const canvasRoot = container.querySelector('[data-active-2d-view="foundation-plan"]');
    expect(canvasRoot).toBeTruthy();
    expect(canvasRoot).toHaveAttribute('data-show-opening-plan-geometry', 'false');
    expect(canvasRoot).toHaveAttribute('data-show-wall-plan-geometry', 'false');
    expect(canvasRoot?.querySelector('[data-plan-opening]')).toBeFalsy();
    expect(canvasRoot?.querySelector('[data-wall-run="true"]')).toBeFalsy();
  });

  it('renders opening previews above permanent wall geometry', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const frames = getSegmentFramesForWallLayout(preset.wallLayout, preset.wall);
    const frame = frames[0]!;
    const resolved = resolveOpeningPlacementFromPlanPoint({
      planX: frame.exteriorStart.x + frame.tangent.x * (frame.lengthMeters * 0.5),
      planZ: frame.exteriorStart.z + frame.tangent.z * (frame.lengthMeters * 0.5),
      hostSegmentId: frame.segmentId,
      segmentFrame: frame,
      openingDefinition: {
        type: 'door',
        widthMeters: 0.9,
        heightMeters: 2.1,
        roughOpeningAllowanceMeters: 0.05,
      },
      snapMode: 'grid',
      gridSpacingMeters: 0.1,
      wall: { ...preset.wall, snapToModule: false },
    });

    const { container } = render(
      <DesignBuilderPlanCanvas
        layout={preset.wallLayout}
        toolMode="place_door"
        active2DView="floor-plan"
        segmentFrames={frames}
        openingPreview={{
          resolvedPlacement: resolved,
          openingType: 'door',
          isValid: true,
          statusKind: 'clean',
        }}
        onInteraction={vi.fn()}
      />,
    );

    const wall = container.querySelector('[data-plan-wall-visible="true"]');
    const preview = container.querySelector('[data-canvas-layer="active-opening-preview"]');
    expect(wall).toBeTruthy();
    expect(preview).toBeTruthy();
    expect(Boolean(wall?.compareDocumentPosition(preview!) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });

  it('renders partition walls as physical plan footprints instead of a single centerline', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const startNode = preset.wallLayout.nodes[0]!;
    const partitionEnd = { id: 'partition-end', x: startNode.x + 2, z: startNode.z + 1.5 };
    const layout = {
      ...preset.wallLayout,
      nodes: [...preset.wallLayout.nodes, partitionEnd],
      segments: [
        ...preset.wallLayout.segments,
        {
          id: 'partition-wall',
          startNodeId: startNode.id,
          endNodeId: partitionEnd.id,
          wallHeightMeters: preset.wallLayout.defaultWallHeightMeters,
          wallThicknessMeters: 0.15,
          wallRole: 'partition' as const,
        },
      ],
    };
    const frames = getSegmentFramesForWallLayout(layout, preset.wall);

    const { container } = render(
      <DesignBuilderPlanCanvas
        layout={layout}
        toolMode="select"
        active2DView="floor-plan"
        segmentFrames={frames}
        onInteraction={vi.fn()}
      />,
    );

    const partitionFootprint = container.querySelector(
      'polygon[data-plan-wall-footprint="true"][data-segment-id="partition-wall"]',
    );
    const partitionFaces = container.querySelectorAll(
      'line[data-plan-wall-face="true"][data-segment-id="partition-wall"]',
    );

    expect(partitionFootprint).toBeTruthy();
    expect(partitionFootprint?.getAttribute('points')?.trim().split(/\s+/)).toHaveLength(4);
    expect(partitionFaces).toHaveLength(2);
  });

  it('renders exterior CMU walls with both outside and inside face lines', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const frames = getSegmentFramesForWallLayout(preset.wallLayout, preset.wall);
    const segmentId = preset.wallLayout.segments[0]!.id;

    const { container } = render(
      <DesignBuilderPlanCanvas
        layout={preset.wallLayout}
        toolMode="select"
        active2DView="floor-plan"
        segmentFrames={frames}
        onInteraction={vi.fn()}
      />,
    );

    const exteriorFace = container.querySelector(
      `line[data-plan-wall-face-kind="exterior"][data-segment-id="${segmentId}"]`,
    );
    const interiorFace = container.querySelector(
      `line[data-plan-wall-face-kind="interior"][data-segment-id="${segmentId}"]`,
    );

    expect(exteriorFace).toBeTruthy();
    expect(interiorFace).toBeTruthy();
    expect(exteriorFace?.getAttribute('y1')).not.toBe(interiorFace?.getAttribute('y1'));
  });

  it('draws the Floor Plan exterior wall face on the actual exterior footprint', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const frames = getSegmentFramesForWallLayout(preset.wallLayout, preset.wall);
    const frame = frames[0]!;
    const { container } = render(
      <DesignBuilderPlanCanvas
        layout={preset.wallLayout}
        toolMode="select"
        active2DView="floor-plan"
        viewport={{ centerX: 0, centerZ: 0, zoom: 100 }}
        segmentFrames={frames}
        onInteraction={vi.fn()}
      />,
    );

    const exteriorFace = container.querySelector(
      `line[data-plan-wall-face-kind="exterior"][data-segment-id="${frame.segmentId}"]`,
    );
    expect(exteriorFace).toBeTruthy();
    expect(Number(exteriorFace?.getAttribute('x1'))).toBeCloseTo(450 + frame.exteriorStart.x * 100, 6);
    expect(Number(exteriorFace?.getAttribute('y1'))).toBeCloseTo(260 - frame.exteriorStart.z * 100, 6);
    expect(Number(exteriorFace?.getAttribute('x2'))).toBeCloseTo(450 + frame.exteriorEnd.x * 100, 6);
    expect(Number(exteriorFace?.getAttribute('y2'))).toBeCloseTo(260 - frame.exteriorEnd.z * 100, 6);
  });

  it('breaks wall lines at committed rough openings and renders opening symbols', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const frames = getSegmentFramesForWallLayout(preset.wallLayout, preset.wall);
    const frame = frames[0]!;
    const resolved = resolveOpeningPlacementFromPlanPoint({
      planX: frame.exteriorStart.x + frame.tangent.x * 2.5,
      planZ: frame.exteriorStart.z + frame.tangent.z * 2.5,
      hostSegmentId: frame.segmentId,
      segmentFrame: frame,
      openingDefinition: {
        type: 'window',
        widthMeters: 1.2,
        heightMeters: 0.9,
        sillHeightMeters: 1,
        roughOpeningAllowanceMeters: 0.05,
      },
      snapMode: 'grid',
      gridSpacingMeters: 0.1,
      wall: { ...preset.wall, snapToModule: false },
    });

    const { container } = render(
      <DesignBuilderPlanCanvas
        layout={preset.wallLayout}
        toolMode="select"
        active2DView="floor-plan"
        segmentFrames={frames}
        selectedOpeningId="window-1"
        openingItems={[{
          openingId: 'window-1',
          openingType: 'window',
          resolved,
          isValid: true,
          statusKind: 'clean',
        }]}
        onInteraction={vi.fn()}
      />,
    );

    expect(container.querySelectorAll('[data-wall-run="true"]').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[data-plan-rough-opening-cut="true"]')).toHaveLength(2);
    expect(container.querySelector('[data-plan-opening="window"]')).toBeTruthy();
  });

  it('renders placed doors as neutral architectural swing symbols without construction labels', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const frames = getSegmentFramesForWallLayout(preset.wallLayout, preset.wall);
    const frame = frames[0]!;
    const resolved = resolveOpeningPlacementFromPlanPoint({
      planX: frame.exteriorStart.x + frame.tangent.x * 2.5,
      planZ: frame.exteriorStart.z + frame.tangent.z * 2.5,
      hostSegmentId: frame.segmentId,
      segmentFrame: frame,
      openingDefinition: {
        type: 'door',
        widthMeters: 0.9,
        heightMeters: 2.1,
        roughOpeningAllowanceMeters: 0.05,
      },
      snapMode: 'grid',
      gridSpacingMeters: 0.1,
      wall: { ...preset.wall, snapToModule: false },
    });

    const { container } = render(
      <DesignBuilderPlanCanvas
        layout={preset.wallLayout}
        toolMode="select"
        active2DView="floor-plan"
        viewport={{ centerX: 0, centerZ: 0, zoom: 100 }}
        segmentFrames={frames}
        openingItems={[{
          openingId: 'door-1',
          openingType: 'door',
          resolved,
          isValid: true,
          statusKind: 'clean',
        }]}
        onInteraction={vi.fn()}
      />,
    );

    const door = container.querySelector('[data-plan-opening="door"]');
    const roughCuts = container.querySelectorAll(
      `[data-plan-rough-opening-cut="true"][data-segment-id="${frame.segmentId}"]`,
    );
    expect(door).toBeTruthy();
    expect(roughCuts).toHaveLength(2);
    expectRoughOpeningCutToBeSquare(
      container.querySelector(
        `[data-plan-rough-opening-cut="true"][data-plan-rough-opening-edge="start"][data-segment-id="${frame.segmentId}"]`,
      ),
      frame,
      resolved.roughOpeningStartMeters,
    );
    expectRoughOpeningCutToBeSquare(
      container.querySelector(
        `[data-plan-rough-opening-cut="true"][data-plan-rough-opening-edge="end"][data-segment-id="${frame.segmentId}"]`,
      ),
      frame,
      resolved.roughOpeningEndMeters,
    );
    expect(door?.querySelector('[data-plan-door-leaf="true"]')).toBeTruthy();
    expect(door?.querySelector('[data-plan-door-swing-arc="true"]')).toBeTruthy();
    expect(door?.querySelector('[data-plan-opening-jamb="true"]')).toBeFalsy();
    expect(door?.querySelector('text')).toBeFalsy();
    expect(door?.querySelector('[stroke-dasharray]')).toBeFalsy();
  });

  it('keeps selected door rough-opening wall cuts neutral and separate from the door symbol', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const frames = getSegmentFramesForWallLayout(preset.wallLayout, preset.wall);
    const frame = frames[0]!;
    const resolved = resolveOpeningPlacementFromPlanPoint({
      planX: frame.exteriorStart.x + frame.tangent.x * 2.5,
      planZ: frame.exteriorStart.z + frame.tangent.z * 2.5,
      hostSegmentId: frame.segmentId,
      segmentFrame: frame,
      openingDefinition: {
        type: 'door',
        widthMeters: 0.9,
        heightMeters: 2.1,
        roughOpeningAllowanceMeters: 0.05,
      },
      snapMode: 'grid',
      gridSpacingMeters: 0.1,
      wall: { ...preset.wall, snapToModule: false },
    });

    const { container } = render(
      <DesignBuilderPlanCanvas
        layout={preset.wallLayout}
        toolMode="select"
        active2DView="floor-plan"
        viewport={{ centerX: 0, centerZ: 0, zoom: 100 }}
        drawingStyleMode="architectural"
        segmentFrames={frames}
        selectedOpeningId="door-1"
        openingItems={[{
          openingId: 'door-1',
          openingType: 'door',
          resolved,
          isValid: true,
          statusKind: 'clean',
        }]}
        onInteraction={vi.fn()}
      />,
    );

    const roughCuts = container.querySelectorAll(
      `[data-plan-rough-opening-cut="true"][data-segment-id="${frame.segmentId}"]`,
    );
    const doorLeaf = container.querySelector('[data-plan-door-leaf="true"]');
    expect(roughCuts).toHaveLength(2);
    roughCuts.forEach((cut) => {
      expect(cut.getAttribute('stroke')).toBe('#111827');
      expect(cut.getAttribute('stroke')).not.toBe('#0891b2');
    });
    expect(doorLeaf?.getAttribute('stroke')).toBe('#0891b2');
  });

  it('renders placed windows with architectural sash lines', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const frames = getSegmentFramesForWallLayout(preset.wallLayout, preset.wall);
    const frame = frames[0]!;
    const resolved = resolveOpeningPlacementFromPlanPoint({
      planX: frame.exteriorStart.x + frame.tangent.x * 2.5,
      planZ: frame.exteriorStart.z + frame.tangent.z * 2.5,
      hostSegmentId: frame.segmentId,
      segmentFrame: frame,
      openingDefinition: {
        type: 'window',
        widthMeters: 1.2,
        heightMeters: 0.9,
        sillHeightMeters: 1,
        roughOpeningAllowanceMeters: 0.05,
      },
      snapMode: 'grid',
      gridSpacingMeters: 0.1,
      wall: { ...preset.wall, snapToModule: false },
    });

    const { container } = render(
      <DesignBuilderPlanCanvas
        layout={preset.wallLayout}
        toolMode="select"
        active2DView="floor-plan"
        viewport={{ centerX: 0, centerZ: 0, zoom: 100 }}
        segmentFrames={frames}
        openingItems={[{
          openingId: 'window-1',
          openingType: 'window',
          resolved,
          isValid: true,
          statusKind: 'clean',
        }]}
        onInteraction={vi.fn()}
      />,
    );

    const window = container.querySelector('[data-plan-opening="window"]');
    const roughCuts = container.querySelectorAll(
      `[data-plan-rough-opening-cut="true"][data-segment-id="${frame.segmentId}"]`,
    );
    expect(window).toBeTruthy();
    expect(roughCuts).toHaveLength(2);
    expect(window?.querySelectorAll('[data-plan-window-sash="true"]')).toHaveLength(3);
    expect(window?.querySelector('[data-plan-opening-jamb="true"]')).toBeFalsy();
    expect(window?.querySelector('text')).toBeFalsy();
  });

  it('emits segment preview while hovering during place door', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const onInteraction = vi.fn();
    render(
      <DesignBuilderPlanCanvas
        layout={preset.wallLayout}
        toolMode="place_door"
        active2DView="floor-plan"
        segmentFrames={getSegmentFramesForWallLayout(preset.wallLayout, preset.wall)}
        onInteraction={onInteraction}
      />,
    );

    const svg = screen.getByLabelText(/design builder wall layout plan view/i) as SVGSVGElement;
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 900,
      height: 520,
      right: 900,
      bottom: 520,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    fireEvent.pointerMove(svg, { clientX: 450, clientY: 260 });

    expect(onInteraction).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'segment_pick',
      phase: 'preview',
      toolMode: 'place_door',
    }));
  });

  it('renders continuous rectangle corners with no opening', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = createOutsideFaceRectangleLayout({ lengthMeters: 6, widthMeters: 5 });
    const frames = getSegmentFramesForWallLayout(layout, preset.wall);
    const { container } = render(
      <DesignBuilderPlanCanvas
        layout={layout}
        toolMode="select"
        active2DView="floor-plan"
        segmentFrames={frames}
        onInteraction={vi.fn()}
      />,
    );

    assertRenderedCornersMeet(container, layout);
  });

  it('renders continuous rectangle corners while previewing a door', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = createOutsideFaceRectangleLayout({ lengthMeters: 6, widthMeters: 5 });
    const frames = getSegmentFramesForWallLayout(layout, preset.wall);
    const frame = frames[0]!;
    const station = frame.lengthMeters * 0.5;
    const resolved = resolveOpeningPlacementFromPlanPoint({
      planX: frame.exteriorStart.x + frame.tangent.x * station,
      planZ: frame.exteriorStart.z + frame.tangent.z * station,
      hostSegmentId: frame.segmentId,
      segmentFrame: frame,
      openingDefinition: {
        type: 'door',
        widthMeters: 0.9,
        heightMeters: 2.1,
        roughOpeningAllowanceMeters: 0.05,
      },
      snapMode: 'grid',
      gridSpacingMeters: 0.1,
      wall: { ...preset.wall, snapToModule: false },
    });
    const { container } = render(
      <DesignBuilderPlanCanvas
        layout={layout}
        toolMode="place_door"
        active2DView="floor-plan"
        selectedSegmentId={frame.segmentId}
        segmentFrames={frames}
        openingPreview={{
          resolvedPlacement: resolved,
          openingType: 'door',
          isValid: true,
          statusKind: 'clean',
          swingType: 'outswing',
          swingDirection: 'right',
        }}
        onInteraction={vi.fn()}
      />,
    );

    assertRenderedCornersMeet(container, layout);
    expect(container.querySelectorAll('[data-wall-run="true"]').length).toBe(4);
  });

  it('renders continuous corners for centerline-basis layouts during door preview', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = {
      ...createOutsideFaceRectangleLayout({ lengthMeters: 6, widthMeters: 5 }),
      dimensionBasis: 'wall_centerline' as const,
    };
    const frames = getSegmentFramesForWallLayout(layout, preset.wall);
    const frame = frames[1]!;
    const station = frame.lengthMeters * 0.5;
    const resolved = resolveOpeningPlacementFromPlanPoint({
      planX: frame.exteriorStart.x + frame.tangent.x * station,
      planZ: frame.exteriorStart.z + frame.tangent.z * station,
      hostSegmentId: frame.segmentId,
      segmentFrame: frame,
      openingDefinition: {
        type: 'door',
        widthMeters: 0.9,
        heightMeters: 2.1,
        roughOpeningAllowanceMeters: 0.05,
      },
      snapMode: 'grid',
      gridSpacingMeters: 0.1,
      wall: { ...preset.wall, snapToModule: false },
    });
    const { container } = render(
      <DesignBuilderPlanCanvas
        layout={layout}
        toolMode="place_door"
        active2DView="floor-plan"
        selectedSegmentId={frame.segmentId}
        segmentFrames={frames}
        openingPreview={{
          resolvedPlacement: resolved,
          openingType: 'door',
          isValid: true,
          statusKind: 'clean',
        }}
        onInteraction={vi.fn()}
      />,
    );

    assertRenderedCornersMeet(container, layout);
  });

  it('drags existing RC columns with a local ghost and commits the node move on pointer up', () => {
    const { layout, frameSystem, isolatedFootings } = createColumnDragFixture();
    const onInteraction = vi.fn();
    const { container } = render(
      <DesignBuilderPlanCanvas
        layout={layout}
        toolMode="select"
        snapMode="off"
        viewport={{ centerX: 0, centerZ: 0, zoom: 100 }}
        frameSystem={frameSystem as unknown as StructuralFrameSystemParameters}
        isolatedFootings={isolatedFootings}
        onInteraction={onInteraction}
      />,
    );

    const svg = screen.getByLabelText(/design builder wall layout plan view/i) as SVGSVGElement;
    mockPlanSurface(svg);

    fireEvent.pointerDown(svg, { button: 0, pointerId: 11, clientX: 400, clientY: 200 });
    fireEvent.pointerMove(svg, { pointerId: 11, clientX: 500, clientY: 200 });

    expect(container.querySelector('[data-column-drag-preview="true"]')).toBeTruthy();
    expect(container.querySelector('[data-column-drag-column-id="column-a"]')).toBeTruthy();
    expect(container.querySelector('[data-column-drag-beam-preview="beam-a-b"]')).toBeTruthy();
    expect(container.querySelector('[data-column-drag-footer-preview="footing-a"]')).toBeTruthy();
    expect(onInteraction).toHaveBeenCalledWith(expect.objectContaining({ kind: 'select_node', nodeId: 'node-a' }));
    expect(onInteraction).not.toHaveBeenCalledWith(expect.objectContaining({ kind: 'move_node', phase: 'preview' }));

    fireEvent.pointerUp(svg, { pointerId: 11, clientX: 500, clientY: 200 });

    expect(container.querySelector('[data-column-drag-preview="true"]')).toBeFalsy();
    expect(onInteraction).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'move_node',
      phase: 'commit',
      nodeId: 'node-a',
      planX: 1,
      planZ: 0,
    }));
  });

  it('normalizes placed columns into permanent concrete style and commits component drag from the same hit target', () => {
    const { layout } = createColumnDragFixture();
    const onInteraction = vi.fn();
    const { container } = render(
      <DesignBuilderPlanCanvas
        layout={layout}
        toolMode="select"
        snapMode="off"
        viewport={{ centerX: 0, centerZ: 0, zoom: 100 }}
        placedComponents={[createPlacedColumn()]}
        drawingStyleMode="architectural"
        onInteraction={onInteraction}
      />,
    );

    const placedColumn = container.querySelector('[data-component-column-body-id]');
    expect(placedColumn).toBeTruthy();
    expect(placedColumn?.getAttribute('fill')).toBe('#e5e7eb');
    expect(placedColumn?.getAttribute('stroke')).toBe('#111827');
    const placedFooter = container.querySelector('[data-component-footer-id]');
    expect(placedFooter).toBeTruthy();
    expect(placedFooter?.getAttribute('fill')).toBe('#f1f5f9');
    expect(placedFooter?.getAttribute('stroke')).toBe('#4b5563');
    expect(placedFooter?.getAttribute('stroke-dasharray')).toBeNull();

    const svg = screen.getByLabelText(/design builder wall layout plan view/i) as SVGSVGElement;
    mockPlanSurface(svg);

    fireEvent.pointerDown(svg, { button: 0, pointerId: 14, clientX: 400, clientY: 200 });
    fireEvent.pointerMove(svg, { pointerId: 14, clientX: 500, clientY: 200 });

    expect(container.querySelector('[data-column-drag-preview="true"]')).toBeTruthy();
    expect(onInteraction).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'component_select',
      componentId: 'placed-column-a',
    }));

    fireEvent.pointerUp(svg, { pointerId: 14, clientX: 500, clientY: 200 });

    expect(onInteraction).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'component_move',
      phase: 'commit',
      componentId: 'placed-column-a',
      planX: 1,
      planZ: 0,
    }));
  });

  it('renders placed footers as solid footing symbols with centered column markers', () => {
    const { layout } = createColumnDragFixture();
    const { container } = render(
      <DesignBuilderPlanCanvas
        layout={layout}
        toolMode="select"
        viewport={{ centerX: 0, centerZ: 0, zoom: 100 }}
        placedComponents={[createPlacedFooter()]}
        drawingStyleMode="architectural"
        onInteraction={vi.fn()}
      />,
    );

    const placedFooter = container.querySelector('[data-component-id="placed-footer-a"][data-component-type="footer"]');
    expect(placedFooter).toBeTruthy();
    expect(placedFooter?.getAttribute('fill')).toBe('#f1f5f9');
    expect(placedFooter?.getAttribute('stroke')).toBe('#4b5563');
    expect(placedFooter?.getAttribute('stroke-dasharray')).toBeNull();

    const columnMarker = container.querySelector('[data-component-footer-column-marker-id="placed-footer-a"]');
    expect(columnMarker).toBeTruthy();
    expect(columnMarker?.getAttribute('fill')).toBe('#d4d4d4');
    expect(columnMarker?.getAttribute('stroke')).toBe('#111827');
  });

  it('renders architectural foundation columns without node circles and beams as outlined material strips', () => {
    const { layout, frameSystem, isolatedFootings } = createColumnDragFixture();
    const { container } = render(
      <DesignBuilderPlanCanvas
        layout={layout}
        toolMode="select"
        viewport={{ centerX: 2, centerZ: 1, zoom: 100 }}
        frameSystem={frameSystem as unknown as StructuralFrameSystemParameters}
        isolatedFootings={isolatedFootings}
        drawingStyleMode="architectural"
        onInteraction={vi.fn()}
      />,
    );

    expect(container.querySelector('circle[data-plan-node-id]')).toBeFalsy();
    const beam = container.querySelector('[data-foundation-beam-id="beam-a-b"]');
    expect(beam).toBeTruthy();
    expect(beam?.tagName.toLowerCase()).toBe('polygon');
    expect(beam?.getAttribute('fill')).toBe('none');
    expect(beam?.getAttribute('stroke')).toBe('#111827');
    expect(container.querySelector('[data-foundation-beam-id="tie-beam-a-b"]')).toBeTruthy();
    expect(container.querySelector('[data-foundation-beam-id="roof-beam-a-b"]')).toBeFalsy();
  });

  it('renders structural columns on Floor Plan without foundation footings', () => {
    const { layout, frameSystem, isolatedFootings } = createColumnDragFixture();
    const { container } = render(
      <DesignBuilderPlanCanvas
        layout={layout}
        toolMode="select"
        active2DView="floor-plan"
        viewport={{ centerX: 2, centerZ: 1, zoom: 100 }}
        frameSystem={frameSystem}
        isolatedFootings={isolatedFootings}
        drawingStyleMode="architectural"
        onInteraction={vi.fn()}
      />,
    );

    expect(container.querySelector('[data-floor-column-id="column-a"]')).toBeTruthy();
    expect(container.querySelector('[data-plan-column-id="column-a"]')).toBeTruthy();
    expect(container.querySelector('[data-foundation-column-id="column-a"]')).toBeFalsy();
    expect(container.querySelector('[data-foundation-footing-id="footing-a"]')).toBeFalsy();
  });

  it('layers foundation footings below foundation beams', () => {
    const { layout, frameSystem, isolatedFootings } = createColumnDragFixture();
    const { container } = render(
      <DesignBuilderPlanCanvas
        layout={layout}
        toolMode="select"
        viewport={{ centerX: 2, centerZ: 1, zoom: 100 }}
        frameSystem={frameSystem as unknown as StructuralFrameSystemParameters}
        isolatedFootings={isolatedFootings}
        drawingStyleMode="architectural"
        onInteraction={vi.fn()}
      />,
    );

    const canvasRoot = container.querySelector('[data-active-2d-view="foundation-plan"]');
    expect(canvasRoot).toBeTruthy();
    const footing = container.querySelector('[data-foundation-footing-id="footing-a"]');
    const beam = container.querySelector('[data-foundation-beam-id="beam-a-b"]');

    expect(footing).toBeTruthy();
    expect(beam).toBeTruthy();
    expect(footing?.compareDocumentPosition(beam) ?? 0).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('renders below-grade CMU infill instead of above-grade wall faces on frame foundation plans', () => {
    const { layout, frameSystem, isolatedFootings } = createColumnDragFixture();
    const wallLayout = {
      ...layout,
      segments: [
        {
          id: 'segment-a-b',
          startNodeId: 'node-a',
          endNodeId: 'node-b',
          wallHeightMeters: 2.8,
          wallThicknessMeters: 0.19,
          wallRole: 'exterior' as const,
        },
      ],
    };
    const preset = createFiveBySixCmuBuildingPreset();
    const segmentFrames = getSegmentFramesForWallLayout(wallLayout, preset.wall);
    const frame = segmentFrames[0]!;
    const { container } = render(
      <DesignBuilderPlanCanvas
        layout={wallLayout}
        toolMode="select"
        viewport={{ centerX: 2, centerZ: 1, zoom: 100 }}
        frameSystem={frameSystem}
        segmentFrames={segmentFrames}
        isolatedFootings={isolatedFootings}
        foundationBlockInstances={[{
          id: 'below-grade-cmu-a-b',
          segmentId: 'segment-a-b',
          course: 0,
          courseIndex: 0,
          blockType: 'full',
          source: 'below_grade_rc_infill',
          x: 2,
          y: -0.3,
          z: 0,
          rotationY: frame.rotationY,
          lengthMeters: 4,
          depthMeters: 0.19,
          startAlongMeters: 0,
          endAlongMeters: 4,
          infillBand: 'below_grade',
        }]}
        interiorFloorSlab={{
          enabled: true,
          thicknessMeters: 0.125,
          footprintPolygon: [
            { x: 0, z: 0.25 },
            { x: 4, z: 0.25 },
            { x: 4, z: 1.25 },
            { x: 0, z: 1.25 },
          ],
          topElevationMeters: 0,
          bottomElevationMeters: -0.125,
          areaSquareMeters: 4,
          volumeCubicMeters: 0.5,
        }}
        interiorFloorSlabFootprint={[
          { x: 0, z: 0.25 },
          { x: 4, z: 0.25 },
          { x: 4, z: 1.25 },
          { x: 0, z: 1.25 },
        ]}
        drawingStyleMode="architectural"
        onInteraction={vi.fn()}
      />,
    );

    const canvasRoot = container.querySelector('[data-active-2d-view="foundation-plan"]');
    const footing = canvasRoot?.querySelector('[data-foundation-footing-id="footing-a"]');
    const beam = canvasRoot?.querySelector('[data-foundation-beam-id="beam-a-b"]');
    const infill = canvasRoot?.querySelector('[data-foundation-below-grade-cmu-infill="segment-a-b"]');
    const column = canvasRoot?.querySelector('[data-foundation-column-id="column-a"]');

    expect(canvasRoot).toBeTruthy();
    expect(footing).toBeTruthy();
    expect(beam).toBeTruthy();
    expect(infill).toBeTruthy();
    expect(column).toBeTruthy();
    expect(canvasRoot?.querySelector('[data-plan-wall-face-kind="interior"]')).toBeFalsy();
    expect(container.querySelector('[data-foundation-floor-slab="true"]')).toBeTruthy();
    expect((footing?.compareDocumentPosition(infill) ?? 0) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect((infill?.compareDocumentPosition(beam) ?? 0) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect((infill?.compareDocumentPosition(column) ?? 0) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('selects foundation beams, below-grade CMU infill, and SOG from plan clicks', () => {
    const { layout, frameSystem } = createColumnDragFixture();
    const onBeamInteraction = vi.fn();
    const { unmount } = render(
      <DesignBuilderPlanCanvas
        layout={layout}
        toolMode="select"
        snapMode="off"
        viewport={{ centerX: 0, centerZ: 0, zoom: 100 }}
        frameSystem={frameSystem}
        drawingStyleMode="architectural"
        onInteraction={onBeamInteraction}
      />,
    );

    let svg = screen.getByLabelText(/design builder wall layout plan view/i) as SVGSVGElement;
    mockPlanSurface(svg);
    fireEvent.pointerDown(svg, { button: 0, pointerId: 31, clientX: 600, clientY: 200 });
    expect(onBeamInteraction).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'select_object',
      objectType: 'structural_frame_system',
      objectTreeItemId: 'foundation-tie-beam',
    }));
    unmount();

    const wallLayout = {
      ...layout,
      segments: [
        {
          id: 'segment-a-b',
          startNodeId: 'node-a',
          endNodeId: 'node-b',
          wallHeightMeters: 2.8,
          wallThicknessMeters: 0.19,
          wallRole: 'exterior' as const,
        },
      ],
    };
    const preset = createFiveBySixCmuBuildingPreset();
    const segmentFrames = getSegmentFramesForWallLayout(wallLayout, preset.wall);
    const frame = segmentFrames[0]!;
    const onCmuInteraction = vi.fn();
    const cmuRender = render(
      <DesignBuilderPlanCanvas
        layout={wallLayout}
        toolMode="select"
        snapMode="off"
        viewport={{ centerX: 0, centerZ: 0, zoom: 100 }}
        frameSystem={{ ...frameSystem, beams: [] }}
        segmentFrames={segmentFrames}
        foundationBlockInstances={[{
          id: 'below-grade-cmu-a-b',
          segmentId: 'segment-a-b',
          course: 0,
          courseIndex: 0,
          blockType: 'full',
          source: 'below_grade_rc_infill',
          x: 2,
          y: -0.3,
          z: 0,
          rotationY: frame.rotationY,
          lengthMeters: 4,
          depthMeters: 0.19,
          startAlongMeters: 0,
          endAlongMeters: 4,
          infillBand: 'below_grade',
        }]}
        drawingStyleMode="architectural"
        onInteraction={onCmuInteraction}
      />,
    );
    svg = screen.getByLabelText(/design builder wall layout plan view/i) as SVGSVGElement;
    mockPlanSurface(svg);
    fireEvent.pointerDown(svg, { button: 0, pointerId: 32, clientX: 600, clientY: 200 });
    expect(onCmuInteraction).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'select_object',
      objectType: 'cmu_infill_system',
      objectTreeItemId: 'foundation-cmu-infill-below-grade',
    }));
    cmuRender.unmount();

    const onSogInteraction = vi.fn();
    render(
      <DesignBuilderPlanCanvas
        layout={layout}
        toolMode="select"
        snapMode="off"
        viewport={{ centerX: 0, centerZ: 0, zoom: 100 }}
        frameSystem={{ ...frameSystem, beams: [] }}
        interiorFloorSlab={{
          enabled: true,
          thicknessMeters: 0.125,
          footprintPolygon: [
            { x: 0, z: 0.5 },
            { x: 4, z: 0.5 },
            { x: 4, z: 1.5 },
            { x: 0, z: 1.5 },
          ],
          topElevationMeters: 0,
          bottomElevationMeters: -0.125,
          areaSquareMeters: 4,
          volumeCubicMeters: 0.5,
        }}
        interiorFloorSlabFootprint={[
          { x: 0, z: 0.5 },
          { x: 4, z: 0.5 },
          { x: 4, z: 1.5 },
          { x: 0, z: 1.5 },
        ]}
        drawingStyleMode="architectural"
        onInteraction={onSogInteraction}
      />,
    );
    svg = screen.getByLabelText(/design builder wall layout plan view/i) as SVGSVGElement;
    mockPlanSurface(svg);
    fireEvent.pointerDown(svg, { button: 0, pointerId: 33, clientX: 600, clientY: 100 });
    expect(onSogInteraction).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'select_object',
      objectType: 'structural_frame_system',
      objectTreeItemId: 'foundation-sog',
    }));
  });

  it('renders selected foundation tree items with teal group highlights', () => {
    const { layout, frameSystem, isolatedFootings } = createColumnDragFixture();
    const wallFootings = [{
      id: 'wall-footing-a-b',
      name: 'Wall Footing A-B',
      hostSegmentId: 'segment-a-b',
      startPoint: { x: 0, z: 0.5 },
      endPoint: { x: 4, z: 0.5 },
      widthMeters: 0.3,
      thicknessMeters: 0.25,
      topElevationMeters: -0.25,
      bottomElevationMeters: -0.5,
      centerElevationMeters: -0.375,
      source: 'auto_partition_wall' as const,
    }];
    const { container, rerender } = render(
      <DesignBuilderPlanCanvas
        layout={layout}
        toolMode="select"
        viewport={{ centerX: 2, centerZ: 1, zoom: 100 }}
        frameSystem={frameSystem}
        isolatedFootings={isolatedFootings}
        wallFootings={wallFootings}
        selectedObjectTreeItemId="foundation-tie-beam"
        drawingStyleMode="architectural"
        onInteraction={vi.fn()}
      />,
    );

    const tieBeam = container.querySelector('[data-foundation-beam-id="tie-beam-a-b"]');
    expect(tieBeam?.getAttribute('stroke')).toBe('#06b6d4');
    expect(tieBeam?.getAttribute('fill')).toBe('#06b6d433');
    expect(tieBeam?.getAttribute('data-selected-object-tree-item-id')).toBe('foundation-tie-beam');

    rerender(
      <DesignBuilderPlanCanvas
        layout={layout}
        toolMode="select"
        viewport={{ centerX: 2, centerZ: 1, zoom: 100 }}
        frameSystem={frameSystem}
        isolatedFootings={isolatedFootings}
        wallFootings={wallFootings}
        selectedObjectTreeItemId="foundation-plinth-beam"
        drawingStyleMode="architectural"
        onInteraction={vi.fn()}
      />,
    );
    const plinthBeam = container.querySelector('[data-foundation-beam-id="beam-a-b"]');
    expect(plinthBeam?.getAttribute('stroke')).toBe('#06b6d4');
    expect(plinthBeam?.getAttribute('data-selected-object-tree-item-id')).toBe('foundation-plinth-beam');

    rerender(
      <DesignBuilderPlanCanvas
        layout={layout}
        toolMode="select"
        viewport={{ centerX: 2, centerZ: 1, zoom: 100 }}
        frameSystem={frameSystem}
        isolatedFootings={isolatedFootings}
        wallFootings={wallFootings}
        selectedObjectTreeItemId="foundation-isolated-footings"
        drawingStyleMode="architectural"
        onInteraction={vi.fn()}
      />,
    );
    const footing = container.querySelector('[data-foundation-footing-id="footing-a"]');
    expect(footing?.getAttribute('stroke')).toBe('#06b6d4');
    expect(footing?.getAttribute('fill')).toBe('#06b6d433');
    expect(footing?.getAttribute('data-selected-object-tree-item-id')).toBe('foundation-isolated-footings');

    rerender(
      <DesignBuilderPlanCanvas
        layout={layout}
        toolMode="select"
        viewport={{ centerX: 2, centerZ: 1, zoom: 100 }}
        frameSystem={frameSystem}
        isolatedFootings={isolatedFootings}
        wallFootings={wallFootings}
        selectedObjectTreeItemId="foundation-wall-footings"
        drawingStyleMode="architectural"
        onInteraction={vi.fn()}
      />,
    );
    const wallFooting = container.querySelector('[data-foundation-wall-footing-id="wall-footing-a-b"]');
    expect(wallFooting?.getAttribute('stroke')).toBe('#06b6d4');
    expect(wallFooting?.getAttribute('data-selected-object-tree-item-id')).toBe('foundation-wall-footings');
  });

  it('renders selected below-grade CMU infill and SOG with teal group highlights', () => {
    const { layout, frameSystem } = createColumnDragFixture();
    const wallLayout = {
      ...layout,
      segments: [
        {
          id: 'segment-a-b',
          startNodeId: 'node-a',
          endNodeId: 'node-b',
          wallHeightMeters: 2.8,
          wallThicknessMeters: 0.19,
          wallRole: 'exterior' as const,
        },
      ],
    };
    const preset = createFiveBySixCmuBuildingPreset();
    const segmentFrames = getSegmentFramesForWallLayout(wallLayout, preset.wall);
    const frame = segmentFrames[0]!;
    const belowGradeBlock = {
      id: 'below-grade-cmu-a-b',
      segmentId: 'segment-a-b',
      course: 0,
      courseIndex: 0,
      blockType: 'full',
      source: 'below_grade_rc_infill',
      x: 2,
      y: -0.3,
      z: 0,
      rotationY: frame.rotationY,
      lengthMeters: 4,
      depthMeters: 0.19,
      startAlongMeters: 0,
      endAlongMeters: 4,
      infillBand: 'below_grade',
    } as const;
    const slab = {
      enabled: true,
      thicknessMeters: 0.125,
      footprintPolygon: [
        { x: 0, z: 0.25 },
        { x: 4, z: 0.25 },
        { x: 4, z: 1.25 },
        { x: 0, z: 1.25 },
      ],
      topElevationMeters: 0,
      bottomElevationMeters: -0.125,
      areaSquareMeters: 4,
      volumeCubicMeters: 0.5,
    };
    const slabFootprint = [
      { x: 0, z: 0.25 },
      { x: 4, z: 0.25 },
      { x: 4, z: 1.25 },
      { x: 0, z: 1.25 },
    ];
    const { container, rerender } = render(
      <DesignBuilderPlanCanvas
        layout={wallLayout}
        toolMode="select"
        viewport={{ centerX: 2, centerZ: 1, zoom: 100 }}
        frameSystem={frameSystem as unknown as StructuralFrameSystemParameters}
        segmentFrames={segmentFrames}
        foundationBlockInstances={[belowGradeBlock]}
        interiorFloorSlab={slab}
        interiorFloorSlabFootprint={slabFootprint}
        selectedObjectTreeItemId="foundation-cmu-infill-below-grade"
        drawingStyleMode="architectural"
        onInteraction={vi.fn()}
      />,
    );

    const infill = container.querySelector('[data-foundation-below-grade-cmu-infill="segment-a-b"]');
    expect(infill?.getAttribute('stroke')).toBe('#06b6d4');
    expect(infill?.getAttribute('data-selected-object-tree-item-id')).toBe('foundation-cmu-infill-below-grade');

    rerender(
      <DesignBuilderPlanCanvas
        layout={wallLayout}
        toolMode="select"
        viewport={{ centerX: 2, centerZ: 1, zoom: 100 }}
        frameSystem={frameSystem as unknown as StructuralFrameSystemParameters}
        segmentFrames={segmentFrames}
        foundationBlockInstances={[belowGradeBlock]}
        interiorFloorSlab={slab}
        interiorFloorSlabFootprint={slabFootprint}
        selectedObjectTreeItemId="foundation-sog"
        drawingStyleMode="architectural"
        onInteraction={vi.fn()}
      />,
    );
    const sog = container.querySelector('[data-foundation-floor-slab="true"]');
    expect(sog?.getAttribute('stroke')).toBe('#06b6d4');
    expect(sog?.getAttribute('fill')).toBe('#06b6d433');
    expect(sog?.getAttribute('data-selected-object-tree-item-id')).toBe('foundation-sog');
  });

  it('draws selected SOG from the resolved slab footprint instead of the fallback prop', () => {
    const { layout, frameSystem } = createColumnDragFixture();
    const resolvedFootprint = [
      { x: 0, z: 0.2 },
      { x: 2, z: 0.2 },
      { x: 2, z: 2 },
      { x: 0, z: 2 },
    ];
    const staleFallbackFootprint = [
      { x: 1, z: 1 },
      { x: 3, z: 1 },
      { x: 3, z: 3 },
      { x: 1, z: 3 },
    ];
    const { container } = render(
      <DesignBuilderPlanCanvas
        layout={layout}
        toolMode="select"
        viewport={{ centerX: 0, centerZ: 0, zoom: 100 }}
        frameSystem={frameSystem as unknown as StructuralFrameSystemParameters}
        interiorFloorSlab={{
          enabled: true,
          thicknessMeters: 0.125,
          footprintPolygon: resolvedFootprint,
          topElevationMeters: 0,
          bottomElevationMeters: -0.125,
          areaSquareMeters: 3.6,
          volumeCubicMeters: 0.45,
        }}
        interiorFloorSlabFootprint={staleFallbackFootprint}
        selectedObjectTreeItemId="foundation-sog"
        drawingStyleMode="architectural"
        onInteraction={vi.fn()}
      />,
    );

    const sog = container.querySelector('[data-foundation-floor-slab="true"]');
    expect(sog?.getAttribute('points')).toBe('450,240 650,240 650,60 450,60');
    expect(sog?.getAttribute('data-selected-object-tree-item-id')).toBe('foundation-sog');
  });

  it('selects isolated footing area outside the column body as a foundation object', () => {
    const { layout, frameSystem, isolatedFootings } = createColumnDragFixture();
    const onInteraction = vi.fn();
    const { container } = render(
      <DesignBuilderPlanCanvas
        layout={layout}
        toolMode="select"
        snapMode="off"
        viewport={{ centerX: 0, centerZ: 0, zoom: 100 }}
        frameSystem={frameSystem}
        isolatedFootings={isolatedFootings}
        selectedNodeId="node-a"
        drawingStyleMode="architectural"
        onInteraction={onInteraction}
      />,
    );

    const selectedFooting = container.querySelector('[data-foundation-footing-id="footing-a"]');
    expect(selectedFooting?.getAttribute('stroke')).toBe('#0891b2');

    const svg = screen.getByLabelText(/design builder wall layout plan view/i) as SVGSVGElement;
    mockPlanSurface(svg);
    fireEvent.pointerDown(svg, { button: 0, pointerId: 21, clientX: 435, clientY: 165 });

    expect(onInteraction).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'select_object',
      objectTreeItemId: 'foundation-isolated-footings',
    }));
  });

  it('uses architectural sheet style for permanent plan geometry without cyan component strokes', () => {
    const { container } = render(
      <DesignBuilderPlanCanvas
        layout={createEmptyWallLayout()}
        toolMode="select"
        placedComponents={[createPlacedColumn('placed-column-b')]}
        drawingStyleMode="architectural"
        onInteraction={vi.fn()}
      />,
    );

    expect(container.querySelector('[data-drawing-style-mode="architectural"]')).toBeTruthy();
    expect(container.querySelector('[data-canvas-layer="drawing-sheet"]')).toHaveAttribute('fill', '#f8fafc');
    const column = container.querySelector('[data-component-id="placed-column-b"][data-component-type="column"] rect:not([stroke-dasharray])');
    expect(column?.getAttribute('stroke')).not.toBe('#22d3ee');
    expect(column?.getAttribute('stroke')).not.toBe('#38bdf8');
  });

  it('creates a saved dimension annotation from the three-click workflow and renders it without cyan', () => {
    const layout = createEmptyWallLayout({
      nodes: [
        { id: 'node-a', x: 0, z: 0 },
        { id: 'node-b', x: 1, z: 0 },
      ],
    });
    const onAnnotationCreate = vi.fn();
    const { container, rerender } = render(
      <DesignBuilderPlanCanvas
        layout={layout}
        toolMode="place_dimension"
        viewport={{ centerX: 0, centerZ: 0, zoom: 100 }}
        drawingStyleMode="architectural"
        onAnnotationCreate={onAnnotationCreate}
        onInteraction={vi.fn()}
      />,
    );

    const svg = screen.getByLabelText(/design builder wall layout plan view/i) as SVGSVGElement;
    mockPlanSurface(svg);

    fireEvent.pointerDown(svg, { button: 0, clientX: 400, clientY: 200 });
    fireEvent.pointerDown(svg, { button: 0, clientX: 500, clientY: 200 });
    fireEvent.pointerMove(svg, { clientX: 450, clientY: 150 });
    expect(container.querySelector('[data-canvas-layer="active-dimension-preview"]')).toBeTruthy();
    fireEvent.pointerDown(svg, { button: 0, clientX: 450, clientY: 150 });

    expect(onAnnotationCreate).toHaveBeenCalledTimes(1);
    const annotation = onAnnotationCreate.mock.calls[0][0];
    expect(annotation).toMatchObject({
      type: 'dimension',
      viewType: 'foundation-plan',
      dimensionKind: 'horizontal',
      measuredValue: 1,
      unit: 'm',
      points: {
        start: { x: 0, z: 0 },
        end: { x: 1, z: 0 },
      },
    });
    expect(annotation.offsetPoint.z).toBeCloseTo(0.5, 6);

    rerender(
      <DesignBuilderPlanCanvas
        layout={layout}
        toolMode="select"
        viewport={{ centerX: 0, centerZ: 0, zoom: 100 }}
        drawingStyleMode="architectural"
        annotations={[annotation]}
        onInteraction={vi.fn()}
      />,
    );

    const permanentStrokes = Array.from(container.querySelectorAll('[data-canvas-layer="permanent-dimensions"] line'))
      .map((line) => line.getAttribute('stroke'));
    expect(permanentStrokes.length).toBeGreaterThan(0);
    expect(permanentStrokes).toEqual(expect.arrayContaining(['#111827']));
    expect(permanentStrokes).not.toContain('#22d3ee');
    expect(permanentStrokes).not.toContain('#38bdf8');
  });

  it('renders a snapped live distance preview while picking the second dimension point', () => {
    const layout = createEmptyWallLayout({
      nodes: [
        { id: 'node-a', x: 0, z: 0 },
        { id: 'node-b', x: 1, z: 0 },
      ],
    });
    const onAnnotationCreate = vi.fn();
    const { container } = render(
      <DesignBuilderPlanCanvas
        layout={layout}
        toolMode="place_dimension"
        viewport={{ centerX: 0, centerZ: 0, zoom: 100 }}
        onAnnotationCreate={onAnnotationCreate}
        onInteraction={vi.fn()}
      />,
    );

    const svg = screen.getByLabelText(/design builder wall layout plan view/i) as SVGSVGElement;
    mockPlanSurface(svg);

    fireEvent.pointerDown(svg, { button: 0, clientX: 400, clientY: 200 });
    expect(container.querySelector('[data-dimension-pending-point="true"]')).toBeTruthy();

    fireEvent.pointerMove(svg, { clientX: 498, clientY: 202 });

    const preview = container.querySelector('[data-dimension-preview-stage="picking-second-point"]');
    expect(preview).toBeTruthy();
    expect(preview).toHaveAttribute('data-dimension-measured-value', '1');
    expect(preview?.textContent).toContain('1 m');

    const line = preview?.querySelector('[data-dimension-live-line="true"]');
    expect(line).toHaveAttribute('x1', '400');
    expect(line).toHaveAttribute('y1', '200');
    expect(line).toHaveAttribute('x2', '500');
    expect(line).toHaveAttribute('y2', '200');

    const label = preview?.querySelector('[data-dimension-label="true"]');
    expect(label).toHaveAttribute('x', '450');
    expect(label).toHaveAttribute('y', '194');
    expect(onAnnotationCreate).not.toHaveBeenCalled();
  });

  it('freezes dimension distance during offset placement and centers the label on the offset line', () => {
    const layout = createEmptyWallLayout({
      nodes: [
        { id: 'node-a', x: 0, z: 0 },
        { id: 'node-b', x: 1, z: 0 },
      ],
    });
    const onAnnotationCreate = vi.fn();
    const { container } = render(
      <DesignBuilderPlanCanvas
        layout={layout}
        toolMode="place_dimension"
        viewport={{ centerX: 0, centerZ: 0, zoom: 100 }}
        onAnnotationCreate={onAnnotationCreate}
        onInteraction={vi.fn()}
      />,
    );

    const svg = screen.getByLabelText(/design builder wall layout plan view/i) as SVGSVGElement;
    mockPlanSurface(svg);

    fireEvent.pointerDown(svg, { button: 0, clientX: 400, clientY: 200 });
    fireEvent.pointerMove(svg, { clientX: 498, clientY: 202 });
    fireEvent.pointerDown(svg, { button: 0, clientX: 498, clientY: 202 });
    fireEvent.pointerMove(svg, { clientX: 450, clientY: 150 });

    let preview = container.querySelector('[data-dimension-id="dimension-preview"]');
    expect(preview).toHaveAttribute('data-dimension-measured-value', '1');
    expect(preview?.textContent).toContain('1 m');
    let dimensionLine = Array.from(preview?.querySelectorAll('line') ?? [])
      .find((line) => line.getAttribute('x1') === '400' && line.getAttribute('x2') === '500');
    expect(dimensionLine).toHaveAttribute('y1', '150');
    expect(dimensionLine).toHaveAttribute('y2', '150');
    let label = preview?.querySelector('[data-dimension-label="true"]');
    expect(label).toHaveAttribute('x', '450');
    expect(label).toHaveAttribute('y', '144');

    fireEvent.pointerMove(svg, { clientX: 450, clientY: 100 });

    preview = container.querySelector('[data-dimension-id="dimension-preview"]');
    expect(preview).toHaveAttribute('data-dimension-measured-value', '1');
    dimensionLine = Array.from(preview?.querySelectorAll('line') ?? [])
      .find((line) => line.getAttribute('x1') === '400' && line.getAttribute('x2') === '500');
    const movedOffsetY = Number(dimensionLine?.getAttribute('y1'));
    expect(movedOffsetY).toBeLessThan(150);
    expect(dimensionLine).toHaveAttribute('y2', String(movedOffsetY));
    label = preview?.querySelector('[data-dimension-label="true"]');
    expect(label).toHaveAttribute('x', '450');
    expect(Number(label?.getAttribute('y'))).toBeCloseTo(movedOffsetY - 6, 6);

    fireEvent.pointerDown(svg, { button: 0, clientX: 450, clientY: 100 });

    expect(onAnnotationCreate).toHaveBeenCalledTimes(1);
    expect(onAnnotationCreate.mock.calls[0][0]).toMatchObject({
      measuredValue: 1,
    });
    expect(Number.isFinite(onAnnotationCreate.mock.calls[0][0].offsetPoint.x)).toBe(true);
    expect(onAnnotationCreate.mock.calls[0][0].offsetPoint.z).toBeGreaterThan(0.9);
    expect(container.querySelector('[data-canvas-layer="active-dimension-preview"]')).toBeNull();
  });

  it('cancels incomplete dimension placement on Escape, right click, and tool switch', () => {
    const layout = createEmptyWallLayout({
      nodes: [
        { id: 'node-a', x: 0, z: 0 },
        { id: 'node-b', x: 1, z: 0 },
      ],
    });
    const onAnnotationCreate = vi.fn();
    const { container, rerender } = render(
      <DesignBuilderPlanCanvas
        layout={layout}
        toolMode="place_dimension"
        viewport={{ centerX: 0, centerZ: 0, zoom: 100 }}
        onAnnotationCreate={onAnnotationCreate}
        onInteraction={vi.fn()}
      />,
    );

    const svg = screen.getByLabelText(/design builder wall layout plan view/i) as SVGSVGElement;
    mockPlanSurface(svg);

    fireEvent.pointerDown(svg, { button: 0, clientX: 400, clientY: 200 });
    fireEvent.pointerMove(svg, { clientX: 500, clientY: 200 });
    expect(container.querySelector('[data-canvas-layer="active-dimension-preview"]')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(container.querySelector('[data-canvas-layer="active-dimension-preview"]')).toBeNull();

    fireEvent.pointerDown(svg, { button: 0, clientX: 400, clientY: 200 });
    fireEvent.pointerMove(svg, { clientX: 500, clientY: 200 });
    expect(container.querySelector('[data-canvas-layer="active-dimension-preview"]')).toBeTruthy();
    fireEvent.contextMenu(svg);
    expect(container.querySelector('[data-canvas-layer="active-dimension-preview"]')).toBeNull();

    fireEvent.pointerDown(svg, { button: 0, clientX: 400, clientY: 200 });
    fireEvent.pointerMove(svg, { clientX: 500, clientY: 200 });
    expect(container.querySelector('[data-canvas-layer="active-dimension-preview"]')).toBeTruthy();
    rerender(
      <DesignBuilderPlanCanvas
        layout={layout}
        toolMode="select"
        viewport={{ centerX: 0, centerZ: 0, zoom: 100 }}
        onAnnotationCreate={onAnnotationCreate}
        onInteraction={vi.fn()}
      />,
    );
    expect(container.querySelector('[data-canvas-layer="active-dimension-preview"]')).toBeNull();
    expect(onAnnotationCreate).not.toHaveBeenCalled();
  });

  it('uses imperial layout units for the live dimension preview', () => {
    const layout = createEmptyWallLayout({
      nodes: [
        { id: 'node-a', x: 0, z: 0 },
        { id: 'node-b', x: 1, z: 0 },
      ],
    });
    const { container } = render(
      <DesignBuilderPlanCanvas
        layout={layout}
        toolMode="place_dimension"
        measurementSystem="imperial"
        viewport={{ centerX: 0, centerZ: 0, zoom: 100 }}
        onInteraction={vi.fn()}
      />,
    );

    const svg = screen.getByLabelText(/design builder wall layout plan view/i) as SVGSVGElement;
    mockPlanSurface(svg);

    fireEvent.pointerDown(svg, { button: 0, clientX: 400, clientY: 200 });
    fireEvent.pointerMove(svg, { clientX: 500, clientY: 200 });

    const preview = container.querySelector('[data-dimension-preview-stage="picking-second-point"]');
    expect(preview?.textContent).toContain('3.28 ft');
  });

  it('highlights a selected saved dimension annotation', () => {
    const annotation = {
      id: 'dimension-a',
      type: 'dimension' as const,
      viewType: 'foundation-plan' as const,
      points: {
        start: { x: 0, z: 0 },
        end: { x: 1, z: 0 },
      },
      offsetPoint: { x: 0.5, z: 0.5 },
      dimensionKind: 'horizontal' as const,
      measuredValue: 1,
      unit: 'm' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const { container } = render(
      <DesignBuilderPlanCanvas
        layout={createEmptyWallLayout()}
        toolMode="select"
        viewport={{ centerX: 0, centerZ: 0, zoom: 100 }}
        drawingStyleMode="architectural"
        annotations={[annotation]}
        selectedAnnotationId="dimension-a"
        onInteraction={vi.fn()}
      />,
    );

    const selectedDimension = container.querySelector('[data-dimension-id="dimension-a"]');
    expect(selectedDimension).toHaveAttribute('data-dimension-selected', 'true');
    const strokes = Array.from(selectedDimension?.querySelectorAll('line') ?? [])
      .map((line) => line.getAttribute('stroke'));
    expect(strokes).toContain('#f59e0b');
    expect(selectedDimension?.querySelector('[data-dimension-selection-halo="main"]')).toBeTruthy();
    expect(selectedDimension?.querySelector('[data-dimension-selection-label-backer="true"]')).toBeTruthy();
    expect(selectedDimension?.querySelectorAll('[data-dimension-selection-handle]')).toHaveLength(2);
  });

  it('selects and deletes saved dimension annotations from dimension line hits', () => {
    const annotation = {
      id: 'dimension-a',
      type: 'dimension' as const,
      viewType: 'foundation-plan' as const,
      points: {
        start: { x: 0, z: 0 },
        end: { x: 1, z: 0 },
      },
      offsetPoint: { x: 0.5, z: 0.5 },
      dimensionKind: 'horizontal' as const,
      measuredValue: 1,
      unit: 'm' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const onInteraction = vi.fn();
    const { rerender } = render(
      <DesignBuilderPlanCanvas
        layout={createEmptyWallLayout()}
        toolMode="select"
        viewport={{ centerX: 0, centerZ: 0, zoom: 100 }}
        annotations={[annotation]}
        onInteraction={onInteraction}
      />,
    );

    const svg = screen.getByLabelText(/design builder wall layout plan view/i) as SVGSVGElement;
    mockPlanSurface(svg);
    fireEvent.pointerDown(svg, { button: 0, clientX: 450, clientY: 150 });

    expect(onInteraction).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'annotation_select',
      annotationId: 'dimension-a',
      phase: 'commit',
    }));

    onInteraction.mockClear();
    rerender(
      <DesignBuilderPlanCanvas
        layout={createEmptyWallLayout()}
        toolMode="delete"
        viewport={{ centerX: 0, centerZ: 0, zoom: 100 }}
        annotations={[annotation]}
        onInteraction={onInteraction}
      />,
    );

    fireEvent.pointerDown(svg, { button: 0, clientX: 450, clientY: 150 });

    expect(onInteraction).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'annotation_delete',
      annotationId: 'dimension-a',
      phase: 'commit',
    }));
  });

  it('creates and renders an angle annotation from the three-click workflow', () => {
    const layout = createEmptyWallLayout({
      nodes: [
        { id: 'node-a', x: 0, z: 0 },
        { id: 'node-b', x: 1, z: 0 },
        { id: 'node-c', x: 0, z: 1 },
      ],
    });
    const onAnnotationCreate = vi.fn();
    const { container, rerender } = render(
      <DesignBuilderPlanCanvas
        layout={layout}
        toolMode="place_angle"
        viewport={{ centerX: 0, centerZ: 0, zoom: 100 }}
        drawingStyleMode="architectural"
        onAnnotationCreate={onAnnotationCreate}
        onInteraction={vi.fn()}
      />,
    );

    const svg = screen.getByLabelText(/design builder wall layout plan view/i) as SVGSVGElement;
    mockPlanSurface(svg);

    fireEvent.pointerDown(svg, { button: 0, clientX: 500, clientY: 200 });
    fireEvent.pointerDown(svg, { button: 0, clientX: 400, clientY: 200 });
    fireEvent.pointerMove(svg, { clientX: 400, clientY: 100 });
    expect(container.querySelector('[data-canvas-layer="active-angle-preview"]')).toBeTruthy();
    fireEvent.pointerDown(svg, { button: 0, clientX: 400, clientY: 100 });

    expect(onAnnotationCreate).toHaveBeenCalledTimes(1);
    const annotation = onAnnotationCreate.mock.calls[0][0];
    expect(annotation).toMatchObject({
      type: 'angle',
      viewType: 'foundation-plan',
      measuredValueDegrees: 90,
      points: {
        start: { x: 1, z: 0 },
        vertex: { x: 0, z: 0 },
        end: { x: 0, z: 1 },
      },
    });

    rerender(
      <DesignBuilderPlanCanvas
        layout={layout}
        toolMode="select"
        viewport={{ centerX: 0, centerZ: 0, zoom: 100 }}
        drawingStyleMode="architectural"
        annotations={[annotation]}
        onInteraction={vi.fn()}
      />,
    );

    expect(container.querySelector('[data-angle-id]')).toBeTruthy();
    expect(container.querySelector('[data-angle-id]')?.textContent).toContain('90°');
  });

  it('snaps dimensions to generated RC column corners with forgiving pointer travel', () => {
    const { layout, frameSystem } = createColumnDragFixture();
    const onAnnotationCreate = vi.fn();
    render(
      <DesignBuilderPlanCanvas
        layout={layout}
        toolMode="place_dimension"
        snapMode="off"
        viewport={{ centerX: 0, centerZ: 0, zoom: 100 }}
        frameSystem={frameSystem}
        onAnnotationCreate={onAnnotationCreate}
        onInteraction={vi.fn()}
      />,
    );

    const svg = screen.getByLabelText(/design builder wall layout plan view/i) as SVGSVGElement;
    mockPlanSurface(svg);

    fireEvent.pointerDown(svg, { button: 0, clientX: 421, clientY: 215 });
    fireEvent.pointerDown(svg, { button: 0, clientX: 400, clientY: 200 });
    fireEvent.pointerMove(svg, { clientX: 380, clientY: 180 });
    fireEvent.pointerDown(svg, { button: 0, clientX: 380, clientY: 180 });

    expect(onAnnotationCreate).toHaveBeenCalledTimes(1);
    expect(onAnnotationCreate.mock.calls[0][0]).toMatchObject({
      points: {
        start: { x: 0.15, z: -0.15 },
        end: { x: 0, z: 0 },
      },
      references: {
        startSnapType: 'column-corner',
        startComponentId: 'column-a',
      },
    });
  });

  it('saves and renders dimensions against the active 2D plan view', () => {
    const layout = createEmptyWallLayout({
      nodes: [
        { id: 'node-a', x: 0, z: 0 },
        { id: 'node-b', x: 1, z: 0 },
      ],
    });
    const onAnnotationCreate = vi.fn();
    const { container } = render(
      <DesignBuilderPlanCanvas
        layout={layout}
        toolMode="place_dimension"
        active2DView="roof-plan"
        viewport={{ centerX: 0, centerZ: 0, zoom: 100 }}
        annotations={[{
          id: 'roof-dim-1',
          type: 'dimension',
          viewType: 'roof-plan',
          points: { start: { x: 0, z: 0 }, end: { x: 1, z: 0 } },
          offsetPoint: { x: 0.5, z: 0.5 },
          dimensionKind: 'horizontal',
          measuredValue: 1,
          unit: 'm',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        }, {
          id: 'foundation-dim-1',
          type: 'dimension',
          viewType: 'foundation-plan',
          points: { start: { x: 0, z: 0 }, end: { x: 2, z: 0 } },
          offsetPoint: { x: 1, z: 0.75 },
          dimensionKind: 'horizontal',
          measuredValue: 2,
          unit: 'm',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        }]}
        onAnnotationCreate={onAnnotationCreate}
        onInteraction={vi.fn()}
      />,
    );

    expect(container.querySelector('[data-drawing-annotation="plan-title"]')?.textContent).toContain('Roof Plan');
    expect(container.querySelector('[data-dimension-id="roof-dim-1"]')).toBeTruthy();
    expect(container.querySelector('[data-dimension-id="foundation-dim-1"]')).toBeFalsy();

    const svg = screen.getByLabelText(/design builder wall layout plan view/i) as SVGSVGElement;
    mockPlanSurface(svg);
    fireEvent.pointerDown(svg, { button: 0, clientX: 400, clientY: 200 });
    fireEvent.pointerDown(svg, { button: 0, clientX: 500, clientY: 200 });
    fireEvent.pointerMove(svg, { clientX: 450, clientY: 150 });
    fireEvent.pointerDown(svg, { button: 0, clientX: 450, clientY: 150 });

    expect(onAnnotationCreate.mock.calls[0][0]).toMatchObject({
      type: 'dimension',
      viewType: 'roof-plan',
    });
  });

  it('renders a real roof plan from resolved roof geometry without foundation column graphics', () => {
    const { layout, frameSystem } = createColumnDragFixture();
    const { container } = render(
      <DesignBuilderPlanCanvas
        layout={layout}
        toolMode="select"
        active2DView="roof-plan"
        viewport={{ centerX: 2, centerZ: 1, zoom: 100 }}
        frameSystem={frameSystem}
        resolvedRoofSystem={createResolvedRoofFixture()}
        drawingStyleMode="architectural"
        onInteraction={vi.fn()}
      />,
    );

    expect(container.querySelector('[data-drawing-annotation="plan-title"]')?.textContent).toContain('Roof Plan');
    expect(container.querySelector('[data-roof-plan-outline="true"]')).toBeTruthy();
    expect(container.querySelector('[data-roof-plan-ridge="true"]')).toBeTruthy();
    expect(container.querySelector('[data-roof-plan-hatch="true"]')).toBeTruthy();
    expect(container.querySelector('[data-roof-plan-purlin="north-slope"]')).toBeTruthy();
    expect(container.querySelector('[data-roof-plan-truss-member="bottom_chord"]')).toBeTruthy();
    expect(container.querySelector('[data-roof-plan-truss-member="diagonal_web"]')).toBeTruthy();
    expect(container.querySelector('[data-roof-plan-ridge="true"]')?.tagName.toLowerCase()).toBe('polygon');
    expect(container.querySelector('[data-roof-plan-purlin="north-slope"]')?.tagName.toLowerCase()).toBe('polygon');
    expect(container.querySelector('[data-roof-plan-truss-member="bottom_chord"]')?.tagName.toLowerCase()).toBe('polygon');
    expect(container.querySelector('[data-roof-plan-callout="ridge"]')?.textContent).toContain('RIDGE');
    expect(container.querySelector('[data-roof-plan-slope-arrow="north-slope"]')).toBeTruthy();
    expect(container.querySelector('[data-dimension-id="roof-overall-length"]')).toBeTruthy();
    const referenceSheet = container.querySelector('[data-testid="roof-truss-reference-sheet"]');
    expect(referenceSheet).toBeTruthy();
    expect(referenceSheet?.getAttribute('transform')).toContain('scale(');
    expect(referenceSheet).toHaveAttribute('data-reference-sheet-placement', 'model-space');
    expect(referenceSheet).toHaveAttribute('data-origin-x-meters', '14.600');
    expect(referenceSheet).toHaveAttribute('data-origin-z-meters', '2.600');
    expect(container.querySelector('[data-testid="truss-reference-sheet-drawing"]')).toHaveAttribute('data-reference-sheet-units', 'meters');
    expect(container.querySelector('[data-testid="truss-reference-sheet-notes-panel"]')).toBeTruthy();
    expect(container.querySelector('[data-canvas-layer="roof-truss-design-detail"]')).toBeFalsy();
    expect(container.querySelector('[data-column-drag-column-id="column-a"]')).toBeFalsy();
    expect(container.querySelector('[data-plan-wall-visible="true"]')).toBeFalsy();
  });

  it('renders all hip roof framing members in the 2D roof plan', () => {
    const { layout, frameSystem } = createColumnDragFixture();
    const { container } = render(
      <DesignBuilderPlanCanvas
        layout={layout}
        toolMode="select"
        active2DView="roof-plan"
        viewport={{ centerX: 2, centerZ: 1, zoom: 100 }}
        frameSystem={frameSystem}
        resolvedRoofSystem={createHipResolvedRoofFixture()}
        drawingStyleMode="architectural"
        onInteraction={vi.fn()}
      />,
    );

    const expectedKinds: Array<ResolvedRoofSystem['hipFramingMembers'][number]['memberKind']> = [
      'ridge',
      'hip',
      'jack',
      'common',
      'hip_corner_support',
      'hip_jack_bottom_chord',
      'ridge_end_frame',
      'ridge_end_frame_web',
      'ridge_end_frame_bottom',
    ];

    for (const kind of expectedKinds) {
      expect(container.querySelector(`[data-roof-plan-hip-framing-member="${kind}"]`)).toBeTruthy();
    }
    expect(container.querySelector('[data-roof-plan-hip-framing-id="hip-jack-north"]')).toBeTruthy();
    expect(container.querySelector('[data-roof-plan-slope-plane="north-hip"]')).toBeTruthy();
    expect(container.querySelector('[data-roof-plan-ridge-cap="true"]')).toHaveAttribute(
      'data-roof-plan-covering',
      'ridge_cap',
    );
  });

  it('hides roof shadow plane edges on the foundation plan', () => {
    const { layout, frameSystem } = createColumnDragFixture();
    const { container } = render(
      <DesignBuilderPlanCanvas
        layout={layout}
        toolMode="select"
        active2DView="foundation-plan"
        viewport={{ centerX: 2, centerZ: 1, zoom: 100 }}
        frameSystem={frameSystem}
        resolvedRoofSystem={createHipResolvedRoofFixture()}
        drawingStyleMode="architectural"
        onInteraction={vi.fn()}
      />,
    );

    expect(container.querySelector('[data-roof-shadow-outline="true"]')).toBeFalsy();
    expect(container.querySelectorAll('[data-roof-shadow-plane-edge]')).toHaveLength(0);
  });

  it('hides roof shadow truss station markers on the foundation plan', () => {
    const { layout, frameSystem } = createColumnDragFixture();
    const roof = {
      ...createHipResolvedRoofFixture(),
      ridgeStart: { x: 2, y: 3.8, z: 2.6 },
      ridgeEnd: { x: 2, y: 3.8, z: -0.6 },
      trussStations: [0.4, 1.6, 2.8],
    };
    const { container } = render(
      <DesignBuilderPlanCanvas
        layout={layout}
        toolMode="select"
        active2DView="foundation-plan"
        viewport={{ centerX: 2, centerZ: 1, zoom: 100 }}
        frameSystem={frameSystem}
        resolvedRoofSystem={roof}
        drawingStyleMode="architectural"
        onInteraction={vi.fn()}
      />,
    );

    expect(container.querySelectorAll('[data-roof-shadow-truss-station]')).toHaveLength(0);
  });

  it('hides the roof truss reference sheet when the roof plan display option is off', () => {
    const { layout, frameSystem } = createColumnDragFixture();
    const { container } = render(
      <DesignBuilderPlanCanvas
        layout={layout}
        toolMode="select"
        active2DView="roof-plan"
        viewport={{ centerX: 2, centerZ: 1, zoom: 100 }}
        frameSystem={frameSystem}
        resolvedRoofSystem={createResolvedRoofFixture()}
        roofPlanDisplay={{
          showHatch: true,
          showSlopeArrows: true,
          showDimensions: true,
          showReferenceLines: true,
          showTrussDesignDetail: false,
        }}
        drawingStyleMode="architectural"
        onInteraction={vi.fn()}
      />,
    );

    expect(container.querySelector('[data-roof-plan-outline="true"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="roof-truss-reference-sheet"]')).toBeFalsy();
    expect(container.querySelector('[data-canvas-layer="roof-truss-design-detail"]')).toBeFalsy();
  });

  it('snaps roof plan dimensions to roof outline corners', () => {
    const onAnnotationCreate = vi.fn();
    render(
      <DesignBuilderPlanCanvas
        layout={createEmptyWallLayout()}
        toolMode="place_dimension"
        active2DView="roof-plan"
        snapMode="off"
        viewport={{ centerX: 2, centerZ: 1, zoom: 100 }}
        resolvedRoofSystem={createResolvedRoofFixture()}
        onAnnotationCreate={onAnnotationCreate}
        onInteraction={vi.fn()}
      />,
    );

    const svg = screen.getByLabelText(/design builder wall layout plan view/i) as SVGSVGElement;
    mockPlanSurface(svg);

    fireEvent.pointerDown(svg, { button: 0, clientX: 140, clientY: 360 });
    fireEvent.pointerDown(svg, { button: 0, clientX: 660, clientY: 360 });
    fireEvent.pointerMove(svg, { clientX: 400, clientY: 330 });
    fireEvent.pointerDown(svg, { button: 0, clientX: 400, clientY: 330 });

    expect(onAnnotationCreate).toHaveBeenCalledTimes(1);
    expect(onAnnotationCreate.mock.calls[0][0]).toMatchObject({
      viewType: 'roof-plan',
      points: {
        start: { x: -0.6, z: -0.6 },
        end: { x: 4.6, z: -0.6 },
      },
      references: {
        startSnapType: expect.stringMatching(/^roof-/),
        endSnapType: expect.stringMatching(/^roof-/),
      },
    });
  });

  it('hides saved roof plan dimensions whose offset line sits inside the roof footprint', () => {
    const insideRoofDimension = {
      id: 'roof-dim-inside',
      type: 'dimension' as const,
      viewType: 'roof-plan' as const,
      points: { start: { x: 0.4, z: -0.6 }, end: { x: 0.4, z: 2.6 } },
      offsetPoint: { x: 0.6, z: 1 },
      dimensionKind: 'vertical' as const,
      measuredValue: 3.2,
      unit: 'm' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const outsideRoofDimension = {
      ...insideRoofDimension,
      id: 'roof-dim-outside',
      offsetPoint: { x: 5.3, z: 1 },
    };

    const { container } = render(
      <DesignBuilderPlanCanvas
        layout={createEmptyWallLayout()}
        toolMode="select"
        active2DView="roof-plan"
        viewport={{ centerX: 2, centerZ: 1, zoom: 100 }}
        resolvedRoofSystem={createResolvedRoofFixture()}
        annotations={[insideRoofDimension, outsideRoofDimension]}
        onInteraction={vi.fn()}
      />,
    );

    expect(container.querySelector('[data-dimension-id="roof-dim-inside"]')).toBeFalsy();
    expect(container.querySelector('[data-dimension-id="roof-dim-outside"]')).toBeTruthy();
  });

  it('selects an existing RC column without committing a move when pointer travel stays below the drag threshold', () => {
    const { layout, frameSystem, isolatedFootings } = createColumnDragFixture();
    const onInteraction = vi.fn();
    render(
      <DesignBuilderPlanCanvas
        layout={layout}
        toolMode="select"
        snapMode="off"
        viewport={{ centerX: 0, centerZ: 0, zoom: 100 }}
        frameSystem={frameSystem}
        isolatedFootings={isolatedFootings}
        onInteraction={onInteraction}
      />,
    );

    const svg = screen.getByLabelText(/design builder wall layout plan view/i) as SVGSVGElement;
    mockPlanSurface(svg);

    fireEvent.pointerDown(svg, { button: 0, pointerId: 12, clientX: 400, clientY: 200 });
    fireEvent.pointerUp(svg, { pointerId: 12, clientX: 402, clientY: 200 });

    expect(onInteraction).toHaveBeenCalledWith(expect.objectContaining({ kind: 'select_node', nodeId: 'node-a' }));
    expect(onInteraction).not.toHaveBeenCalledWith(expect.objectContaining({ objectTreeItemId: 'foundation-isolated-footings' }));
    expect(onInteraction).not.toHaveBeenCalledWith(expect.objectContaining({ kind: 'move_node', phase: 'commit' }));
  });

  it('cancels an in-progress RC column drag with Escape without mutating the model', () => {
    const { layout, frameSystem, isolatedFootings } = createColumnDragFixture();
    const onInteraction = vi.fn();
    const { container } = render(
      <DesignBuilderPlanCanvas
        layout={layout}
        toolMode="select"
        snapMode="off"
        viewport={{ centerX: 0, centerZ: 0, zoom: 100 }}
        frameSystem={frameSystem}
        isolatedFootings={isolatedFootings}
        onInteraction={onInteraction}
      />,
    );

    const svg = screen.getByLabelText(/design builder wall layout plan view/i) as SVGSVGElement;
    mockPlanSurface(svg);

    fireEvent.pointerDown(svg, { button: 0, pointerId: 13, clientX: 400, clientY: 200 });
    fireEvent.pointerMove(svg, { pointerId: 13, clientX: 500, clientY: 200 });
    expect(container.querySelector('[data-column-drag-preview="true"]')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.pointerUp(svg, { pointerId: 13, clientX: 500, clientY: 200 });

    expect(container.querySelector('[data-column-drag-preview="true"]')).toBeFalsy();
    expect(onInteraction).not.toHaveBeenCalledWith(expect.objectContaining({ kind: 'move_node', phase: 'commit' }));
  });
});

describe('DoorConfigurationControls', () => {
  it('shows one compact row with the current handing label', () => {
    render(
      <DoorConfigurationControls
        swingType="outswing"
        swingDirection="right"
        onSwingTypeChange={vi.fn()}
        onSwingDirectionChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /door handing: outswing · right/i })).toBeTruthy();
    expect(screen.getByText('Door handing')).toBeTruthy();
  });

  it('applies handing immediately from the 2x2 menu without an apply button', () => {
    const onSwingTypeChange = vi.fn();
    const onSwingDirectionChange = vi.fn();
    render(
      <DoorConfigurationControls
        swingType="inswing"
        swingDirection="left"
        onSwingTypeChange={onSwingTypeChange}
        onSwingDirectionChange={onSwingDirectionChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /door handing: inswing · left/i }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /outswing · right/i }));

    expect(onSwingTypeChange).toHaveBeenCalledWith('outswing');
    expect(onSwingDirectionChange).toHaveBeenCalledWith('right');
  });
});
