import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createEmptyWallLayout, createOutsideFaceRectangleLayout } from '../domain/wallLayoutRules';
import { projectCellWidthPx } from '../domain/planGridState';
import DesignBuilderPlanCanvas from '../ui/DesignBuilderPlanCanvas';

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
});
