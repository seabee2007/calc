import type {
  DesignComponentType,
  ElevationFace,
  PlacedDesignComponent,
} from '../types';
import type { DesignLayoutBounds } from './designLayoutBounds';
import type {
  DesignRenderFooterReference,
  DesignRenderRcComponent,
  DesignRenderRcComponentKind,
} from './designRenderModel';

const METER_RENDER_PRECISION = 1_000_000;

export function renderMeter(value: number): number {
  return Math.round(value * METER_RENDER_PRECISION) / METER_RENDER_PRECISION;
}

export function numberValue(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return renderMeter(Number.isFinite(numeric) ? numeric : fallback);
}

export function positiveNumber(value: unknown, fallback: number): number {
  const numeric = numberValue(value, fallback);
  return numeric > 0 ? numeric : fallback;
}

export function designComponentPlanPosition(
  component: PlacedDesignComponent,
  bounds: DesignLayoutBounds | null,
): { x: number; z: number; sourceView: 'plan' | 'elevation' | 'world'; elevationFace?: ElevationFace } | null {
  if (component.viewPlacement.plan) {
    return {
      x: component.viewPlacement.plan.xMeters,
      z: component.viewPlacement.plan.zMeters,
      sourceView: 'plan',
    };
  }
  if (component.viewPlacement.world) {
    return {
      x: component.viewPlacement.world.xMeters,
      z: component.viewPlacement.world.zMeters,
      sourceView: 'world',
    };
  }
  const elevation = component.viewPlacement.elevation;
  if (!elevation || !bounds) return null;
  switch (elevation.face) {
    case 'north':
      return { x: elevation.xMeters, z: bounds.maxZ, sourceView: 'elevation', elevationFace: elevation.face };
    case 'south':
      return { x: elevation.xMeters, z: bounds.minZ, sourceView: 'elevation', elevationFace: elevation.face };
    case 'east':
      return { x: bounds.maxX, z: elevation.xMeters, sourceView: 'elevation', elevationFace: elevation.face };
    case 'west':
      return { x: bounds.minX, z: elevation.xMeters, sourceView: 'elevation', elevationFace: elevation.face };
    default:
      return null;
  }
}

export function componentKind(type: DesignComponentType): DesignRenderRcComponentKind | null {
  if (
    type === 'column' ||
    type === 'footer' ||
    type === 'tie_beam' ||
    type === 'plinth_beam' ||
    type === 'roof_beam' ||
    type === 'slab'
  ) {
    return type;
  }
  return null;
}

export function componentElevations(component: PlacedDesignComponent): { base: number; top: number } {
  const p = component.parameters;
  if (component.type === 'footer') {
    const bottom = numberValue(p.bottomElevationMeters, -0.45);
    return {
      base: bottom,
      top: numberValue(p.topElevationMeters, bottom + positiveNumber(p.thicknessMeters, 0.25)),
    };
  }
  if (component.type === 'slab') {
    const top = numberValue(p.topElevationMeters, 0);
    return {
      base: numberValue(p.bottomElevationMeters, top - positiveNumber(p.thicknessMeters, 0.1)),
      top,
    };
  }
  if (component.type === 'tie_beam' || component.type === 'plinth_beam' || component.type === 'roof_beam') {
    const base = numberValue(p.baseElevationMeters, numberValue(p.elevationMeters, 0));
    return {
      base,
      top: numberValue(p.topElevationMeters, base + positiveNumber(p.depthMeters, 0.3)),
    };
  }
  const base = numberValue(p.baseElevationMeters, numberValue(component.viewPlacement.world?.yMeters, 0));
  return {
    base,
    top: numberValue(component.derived.topElevationMeters, base + positiveNumber(p.heightMeters, 3)),
  };
}

export function componentDimensions(component: PlacedDesignComponent): DesignRenderRcComponent['dimensions'] {
  const p = component.parameters;
  if (component.type === 'slab') {
    const thickness = positiveNumber(p.thicknessMeters, 0.1);
    return {
      width: positiveNumber(p.widthMeters, 2),
      depth: thickness,
      height: thickness,
      length: positiveNumber(p.lengthMeters, 2),
    };
  }
  if (component.type === 'footer') {
    const thickness = positiveNumber(p.thicknessMeters, 0.25);
    return {
      width: positiveNumber(p.widthMeters, 0.7),
      depth: positiveNumber(p.lengthMeters, 1),
      height: thickness,
      length: positiveNumber(p.lengthMeters, 1),
    };
  }
  if (component.type === 'tie_beam' || component.type === 'plinth_beam' || component.type === 'roof_beam') {
    return {
      width: positiveNumber(p.widthMeters, 0.25),
      depth: positiveNumber(p.depthMeters, 0.3),
      height: positiveNumber(p.depthMeters, 0.3),
      length: positiveNumber(p.lengthMeters, 1.2),
    };
  }
  return {
    width: positiveNumber(p.widthMeters, 0.3),
    depth: positiveNumber(p.depthMeters, 0.3),
    height: positiveNumber(p.heightMeters, 3),
  };
}

export function columnFooter(
  component: PlacedDesignComponent,
  width: number,
  depth: number,
  base: number,
): DesignRenderFooterReference | undefined {
  const p = component.parameters;
  if (component.type !== 'column' || p.autoFooter === false) return undefined;
  const footerWidth = positiveNumber(p.footerWidthMeters, width * 2);
  const footerLength = positiveNumber(p.footerLengthMeters, depth * 2);
  const footerThickness = positiveNumber(p.footerThicknessMeters, 0.25);
  const bottom = numberValue(p.footerBottomElevationMeters, base - footerThickness);
  const top = numberValue(p.footerTopElevationMeters, bottom + footerThickness);
  return {
    id: `${component.id}-footer`,
    widthMeters: footerWidth,
    lengthMeters: footerLength,
    thicknessMeters: Math.max(0.02, top - bottom),
    bottomElevationMeters: bottom,
    topElevationMeters: top,
  };
}

export function buildDesignRenderRcComponents(params: {
  placedComponents?: readonly PlacedDesignComponent[];
  layoutBounds?: DesignLayoutBounds | null;
}): DesignRenderRcComponent[] {
  const bounds = params.layoutBounds ?? null;
  return (params.placedComponents ?? [])
    .map((component): DesignRenderRcComponent | null => {
      const kind = componentKind(component.type);
      if (!kind) return null;
      const plan = designComponentPlanPosition(component, bounds);
      if (!plan) return null;
      const dimensions = componentDimensions(component);
      const elevations = componentElevations(component);
      const footer = columnFooter(component, dimensions.width, dimensions.depth, elevations.base);
      return {
        id: component.id,
        sourceComponentId: component.id,
        type: kind,
        category: 'structure',
        system: 'reinforced-concrete',
        position: {
          x: renderMeter(plan.x),
          y: elevations.base,
          z: renderMeter(plan.z),
        },
        dimensions,
        elevations,
        references: {
          footerId: footer?.id,
          connectedBeamIds: component.references?.connectedComponentIds,
          sourceView: plan.sourceView,
          elevationFace: plan.elevationFace ?? (component.references?.elevationFace as ElevationFace | undefined),
        },
        footer,
        sourceComponent: component,
      };
    })
    .filter((component): component is DesignRenderRcComponent => component != null);
}
