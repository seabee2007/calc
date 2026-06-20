import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createEmptyWallLayout, createBlankWallLayout } from '../domain/wallLayoutRules';
import DesignBuilderPlanCanvas from '../ui/DesignBuilderPlanCanvas';

describe('design builder line-layout workflow', () => {
  it('renders project origin, axes, and cardinal labels on blank plan view', () => {
    const { container } = render(
      <DesignBuilderPlanCanvas
        layout={createEmptyWallLayout()}
        toolMode="select"
        snapSpacingMeters={0.1}
        snapMode="grid"
        viewport={{ centerX: 0, centerZ: 0, zoom: 48 }}
        onInteraction={vi.fn()}
      />,
    );

    const svg = screen.getByLabelText(/design builder wall layout plan view/i);
    expect(svg.querySelector('[data-origin-marker="true"]')).toBeTruthy();
    expect(svg.querySelector('[data-origin-crosshair="x"]')).toBeTruthy();
    expect(svg.querySelector('[data-origin-crosshair="y"]')).toBeTruthy();
    expect(svg.querySelector('[data-axis="x"]')).toBeTruthy();
    expect(svg.querySelector('[data-axis="y"]')).toBeTruthy();
    expect(svg.textContent).toMatch(/0,0/);
    expect(svg.textContent).toMatch(/North \(\+Y\)/);
    expect(svg.textContent).toMatch(/East \(\+X\)/);
    expect(container.textContent).toMatch(/Project origin is at 0,0/);
  });

  it('shows draw-wall status chip with orthogonal state while drawing', () => {
    const layout = createBlankWallLayout();
    const { container } = render(
      <DesignBuilderPlanCanvas
        layout={layout}
        toolMode="draw_wall"
        snapMode="grid"
        onInteraction={() => undefined}
      />,
    );

    expect(container.textContent).toMatch(/Free angle/);
  });

  it('shows solid cyan snap marker when a target is captured', () => {
    render(
      <DesignBuilderPlanCanvas
        layout={createEmptyWallLayout()}
        toolMode="draw_wall"
        draftEnd={{ x: 0.3, z: 0.8 }}
        snapTarget={{
          type: 'grid',
          point: { x: 0.3, z: 0.8 },
          distancePx: 4,
          priority: 8,
          label: 'Grid',
          valid: true,
          captured: true,
        }}
        onInteraction={vi.fn()}
      />,
    );

    const svg = screen.getByLabelText(/design builder wall layout plan view/i);
    const marker = svg.querySelector('[data-snap-captured="true"]');
    expect(marker).toBeTruthy();
    expect(marker?.getAttribute('fill')).toBe('#22d3ee');
  });
});
