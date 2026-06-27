import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import { resolveOpeningPlacementFromPlanPoint } from '../domain/openingPlacementResolver';
import { createEmptyWallLayout, createOutsideFaceRectangleLayout } from '../domain/wallLayoutRules';
import { getSegmentFramesForWallLayout } from '../geometry/designGeometry';
import { projectCellWidthPx } from '../domain/planGridState';
import { DoorConfigurationControls } from '../ui/DoorConfigurationControls';
import DesignBuilderPlanCanvas from '../ui/DesignBuilderPlanCanvas';

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
