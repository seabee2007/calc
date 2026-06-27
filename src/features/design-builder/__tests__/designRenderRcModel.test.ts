import { describe, expect, it } from 'vitest';
import type { DesignLayoutBounds } from '../domain/designLayoutBounds';
import {
  buildDesignRenderRcComponents,
  componentDimensions,
  componentElevations,
  componentKind,
  designComponentPlanPosition,
} from '../domain/designRenderRcModel';
import type { DesignComponentType, PlacedDesignComponent } from '../types';

function layoutBounds(): DesignLayoutBounds {
  return {
    minX: -3,
    maxX: 3,
    minY: -0.5,
    maxY: 3,
    minZ: -2,
    maxZ: 2,
    center: { x: 0, y: 1.25, z: 0 },
    width: 6,
    depth: 4,
    height: 3.5,
  };
}

function placedComponent(params: {
  id?: string;
  type: DesignComponentType;
  viewPlacement?: PlacedDesignComponent['viewPlacement'];
  parameters?: Record<string, unknown>;
  derived?: Record<string, unknown>;
  references?: PlacedDesignComponent['references'];
}): PlacedDesignComponent {
  return {
    id: params.id ?? `${params.type}-1`,
    type: params.type,
    division: 'Concrete',
    category: params.type === 'door' || params.type === 'window' ? 'openings' : 'structure',
    viewPlacement: params.viewPlacement ?? { plan: { xMeters: 1, zMeters: 2 } },
    parameters: params.parameters ?? {},
    derived: params.derived ?? {},
    references: params.references,
    metadata: {
      createdAt: '2026-06-27T00:00:00.000Z',
      updatedAt: '2026-06-27T00:00:00.000Z',
    },
  };
}

describe('designRenderRcModel', () => {
  it('maps component types to RC render kinds and filters non-RC components', () => {
    expect(componentKind('column')).toBe('column');
    expect(componentKind('footer')).toBe('footer');
    expect(componentKind('tie_beam')).toBe('tie_beam');
    expect(componentKind('door')).toBeNull();
  });

  it('normalizes plan and world placement coordinates', () => {
    const planColumn = placedComponent({
      id: 'plan-column',
      type: 'column',
      viewPlacement: { plan: { xMeters: 1.23456789, zMeters: -0.25 } },
      parameters: { widthMeters: 0.35, depthMeters: 0.4, heightMeters: 3.2, baseElevationMeters: 0.1 },
      derived: { topElevationMeters: 3.3 },
    });
    const worldColumn = placedComponent({
      id: 'world-column',
      type: 'column',
      viewPlacement: { world: { xMeters: -1.2, yMeters: 0.25, zMeters: 2.4 } },
      parameters: { widthMeters: 0.3, depthMeters: 0.35, heightMeters: 2.8 },
    });

    expect(designComponentPlanPosition(planColumn, null)).toEqual({
      x: 1.23456789,
      z: -0.25,
      sourceView: 'plan',
    });
    expect(designComponentPlanPosition(worldColumn, null)).toEqual({
      x: -1.2,
      z: 2.4,
      sourceView: 'world',
    });

    const components = buildDesignRenderRcComponents({
      placedComponents: [planColumn, worldColumn],
    });
    expect(components.map((component) => component.position)).toEqual([
      { x: 1.234568, y: 0.1, z: -0.25 },
      { x: -1.2, y: 0.25, z: 2.4 },
    ]);
  });

  it('projects elevation-placed RC components through layout bounds', () => {
    const northColumn = placedComponent({
      id: 'north-column',
      type: 'column',
      viewPlacement: { elevation: { face: 'north', xMeters: 1.5, zMeters: 0 } },
    });
    const eastColumn = placedComponent({
      id: 'east-column',
      type: 'column',
      viewPlacement: { elevation: { face: 'east', xMeters: -0.75, zMeters: 0 } },
    });

    expect(designComponentPlanPosition(northColumn, layoutBounds())).toEqual({
      x: 1.5,
      z: 2,
      sourceView: 'elevation',
      elevationFace: 'north',
    });
    expect(designComponentPlanPosition(eastColumn, layoutBounds())).toEqual({
      x: 3,
      z: -0.75,
      sourceView: 'elevation',
      elevationFace: 'east',
    });
    expect(designComponentPlanPosition(northColumn, null)).toBeNull();

    expect(
      buildDesignRenderRcComponents({
        placedComponents: [northColumn, eastColumn],
        layoutBounds: layoutBounds(),
      }).map((component) => component.references),
    ).toMatchObject([
      { sourceView: 'elevation', elevationFace: 'north' },
      { sourceView: 'elevation', elevationFace: 'east' },
    ]);
  });

  it('normalizes RC dimensions, elevations, and automatic column footer references', () => {
    const column = placedComponent({
      id: 'column-1',
      type: 'column',
      parameters: {
        widthMeters: 0.35,
        depthMeters: 0.4,
        heightMeters: 3.2,
        baseElevationMeters: 0.1,
        autoFooter: true,
        footerWidthMeters: 0.9,
        footerLengthMeters: 1,
        footerBottomElevationMeters: -0.55,
        footerTopElevationMeters: -0.25,
      },
      derived: { topElevationMeters: 3.3 },
      references: { connectedComponentIds: ['beam-1'] },
    });

    expect(componentDimensions(column)).toEqual({ width: 0.35, depth: 0.4, height: 3.2 });
    expect(componentElevations(column)).toEqual({ base: 0.1, top: 3.3 });

    const component = buildDesignRenderRcComponents({ placedComponents: [column] })[0]!;
    expect(component).toMatchObject({
      id: 'column-1',
      sourceComponentId: 'column-1',
      type: 'column',
      category: 'structure',
      system: 'reinforced-concrete',
      references: {
        footerId: 'column-1-footer',
        connectedBeamIds: ['beam-1'],
        sourceView: 'plan',
      },
      footer: {
        id: 'column-1-footer',
        widthMeters: 0.9,
        lengthMeters: 1,
        bottomElevationMeters: -0.55,
        topElevationMeters: -0.25,
      },
    });
    expect(component.footer?.thicknessMeters).toBeCloseTo(0.3, 6);
  });

  it('normalizes beam, slab, and footer components with stable fallbacks', () => {
    const beam = placedComponent({
      id: 'beam-1',
      type: 'tie_beam',
      parameters: {
        widthMeters: 0.25,
        depthMeters: 0.3,
        lengthMeters: 2.4,
        elevationMeters: 0.4,
      },
    });
    const slab = placedComponent({
      id: 'slab-1',
      type: 'slab',
      parameters: {
        widthMeters: 2,
        lengthMeters: 3,
        thicknessMeters: 0.12,
        topElevationMeters: 0.4,
      },
    });
    const footer = placedComponent({
      id: 'footer-1',
      type: 'footer',
      parameters: {
        widthMeters: 0.8,
        lengthMeters: 0.9,
        thicknessMeters: 0.25,
        bottomElevationMeters: -0.5,
      },
    });

    expect(buildDesignRenderRcComponents({ placedComponents: [beam, slab, footer] })).toMatchObject([
      {
        id: 'beam-1',
        type: 'tie_beam',
        dimensions: { width: 0.25, depth: 0.3, height: 0.3, length: 2.4 },
        elevations: { base: 0.4, top: 0.7 },
      },
      {
        id: 'slab-1',
        type: 'slab',
        dimensions: { width: 2, depth: 0.12, height: 0.12, length: 3 },
        elevations: { base: 0.28, top: 0.4 },
      },
      {
        id: 'footer-1',
        type: 'footer',
        dimensions: { width: 0.8, depth: 0.9, height: 0.25, length: 0.9 },
        elevations: { base: -0.5, top: -0.25 },
      },
    ]);
  });
});
