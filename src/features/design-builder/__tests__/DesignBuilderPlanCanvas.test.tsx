import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import { resolveOpeningPlacementFromPlanPoint } from '../domain/openingPlacementResolver';
import { createEmptyWallLayout, createOutsideFaceRectangleLayout } from '../domain/wallLayoutRules';
import { getSegmentFramesForWallLayout } from '../geometry/designGeometry';
import { projectCellWidthPx } from '../domain/planGridState';
import { DoorConfigurationControls } from '../ui/DoorConfigurationControls';
import DesignBuilderPlanCanvas from '../ui/DesignBuilderPlanCanvas';
import type { PlacedDesignComponent, ResolvedRoofSystem } from '../types';

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
  layout: ReturnType<typeof createOutsideFaceRectangleLayout>,
) {
  layout.nodes.forEach((node) => {
    const circle = container.querySelector(`circle[data-plan-node-id="${node.id}"]`);
    expect(circle).toBeTruthy();
    const cx = Number(circle?.getAttribute('cx'));
    const cy = Number(circle?.getAttribute('cy'));
    const wallPoints = collectWallEndpointScreenPoints(container);
    const matching = wallPoints.filter((point) => Math.hypot(point.x - cx, point.y - cy) < 0.75);
    expect(matching.length).toBeGreaterThanOrEqual(2);
  });
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
    expect(container.querySelector('[data-plan-opening="window"]')).toBeTruthy();
  });

  it('emits segment preview while hovering during place door', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const onInteraction = vi.fn();
    render(
      <DesignBuilderPlanCanvas
        layout={preset.wallLayout}
        toolMode="place_door"
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
    expect(container.querySelectorAll('[data-wall-run="true"]').length).toBe(2);
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
        frameSystem={frameSystem}
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
        frameSystem={frameSystem}
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
    expect(container.querySelector('[data-foundation-beam-id="tie-beam-a-b"]')).toBeFalsy();
    expect(container.querySelector('[data-foundation-beam-id="roof-beam-a-b"]')).toBeFalsy();
  });

  it('selects generated columns from their footing footprint and highlights the footing with the column', () => {
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
      kind: 'select_node',
      nodeId: 'node-a',
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
    expect(strokes).toContain('#0891b2');
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
    expect(container.querySelector('[data-column-drag-column-id="column-a"]')).toBeFalsy();
    expect(container.querySelector('[data-plan-wall-visible="true"]')).toBeFalsy();
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
