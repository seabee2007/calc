import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createEmptyWallLayout, createOutsideFaceRectangleLayout } from '../domain/wallLayoutRules';
import DesignBuilderPlanCanvas from '../ui/DesignBuilderPlanCanvas';

describe('DesignBuilderPlanCanvas', () => {
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
