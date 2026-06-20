import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import {
  deriveDesignLayoutBounds,
  deriveDesignSceneBounds,
  fit3dToLayout,
  fitPerspectiveCameraToBounds,
  fitPlanToLayout,
  resetPlanView,
  resolveSceneGridLayout,
} from '../domain/designLayoutBounds';
import { createPlanCameraController } from '../domain/pointerPlanMapping';
import { createBlankWallLayout, createOutsideFaceRectangleLayout, createWallLayoutId } from '../domain/wallLayoutRules';
import {
  buildDesignGeometryInputFromLayout,
  generateDesignGeometry,
} from '../geometry/designGeometry';
import type { DesignWallLayoutParameters } from '../types';

function createOffsetFootprintLayout(params: {
  minX: number;
  minZ: number;
  lengthMeters: number;
  widthMeters: number;
}): DesignWallLayoutParameters {
  const { minX, minZ, lengthMeters, widthMeters } = params;
  const sw = createWallLayoutId('node');
  const se = createWallLayoutId('node');
  const ne = createWallLayoutId('node');
  const nw = createWallLayoutId('node');
  const defaults = {
    wallHeightMeters: 2.8,
    wallThicknessMeters: 0.19,
  };
  return {
    kind: 'wall_layout',
    dimensionBasis: 'outside_face',
    nodes: [
      { id: sw, x: minX, z: minZ },
      { id: se, x: minX + lengthMeters, z: minZ },
      { id: ne, x: minX + lengthMeters, z: minZ + widthMeters },
      { id: nw, x: minX, z: minZ + widthMeters },
    ],
    segments: [
      { id: createWallLayoutId('segment'), startNodeId: sw, endNodeId: se, ...defaults },
      { id: createWallLayoutId('segment'), startNodeId: se, endNodeId: ne, ...defaults },
      { id: createWallLayoutId('segment'), startNodeId: ne, endNodeId: nw, ...defaults },
      { id: createWallLayoutId('segment'), startNodeId: nw, endNodeId: sw, ...defaults },
    ],
    isFootprintClosed: true,
    defaultWallHeightMeters: defaults.wallHeightMeters,
    defaultWallThicknessMeters: defaults.wallThicknessMeters,
    snapToGrid: true,
    snapToModule: true,
    gridSpacingMeters: 0.1,
    orthogonalLock: true,
    cornerOverrides: [],
  };
}

function geometryForLayout(
  layout: DesignWallLayoutParameters,
  preset = createFiveBySixCmuBuildingPreset(),
) {
  return generateDesignGeometry(
    buildDesignGeometryInputFromLayout({
      wallLayout: layout,
      cmuSettings: { ...preset.wall, openings: [], lengthMeters: 12, widthMeters: 8 },
      openings: [],
      slabSettings: preset.slab,
      roofSettings: preset.roof,
      trussSettings: preset.truss,
    }),
  );
}

describe('design scene bounds and viewport framing', () => {
  it('blank Plan view centers on the world origin', () => {
    expect(resetPlanView()).toEqual({ centerX: 0, centerZ: 0, zoom: 48 });
    expect(fitPlanToLayout(null, { width: 900, height: 520 })).toEqual(resetPlanView());
  });

  it('derives bounds centered at (7.5, 2.5) for a footprint drawn from (5, 0) through (10, 5)', () => {
    const layout = createOffsetFootprintLayout({ minX: 5, minZ: 0, lengthMeters: 5, widthMeters: 5 });
    const bounds = deriveDesignSceneBounds({ wallLayout: layout });
    expect(bounds).not.toBeNull();
    expect(bounds!.center.x).toBeCloseTo(7.5, 6);
    expect(bounds!.center.z).toBeCloseTo(2.5, 6);
    expect(bounds!.width).toBeCloseTo(5, 6);
    expect(bounds!.depth).toBeCloseTo(5, 6);
  });

  it('Plan fit centers the viewport on off-origin bounds, not global origin', () => {
    const layout = createOffsetFootprintLayout({ minX: 5, minZ: 0, lengthMeters: 5, widthMeters: 5 });
    const bounds = deriveDesignLayoutBounds({ wallLayout: layout });
    const viewport = fitPlanToLayout(bounds, { width: 1200, height: 800 });
    expect(viewport.centerX).toBeCloseTo(7.5, 6);
    expect(viewport.centerZ).toBeCloseTo(2.5, 6);
    expect(Math.hypot(viewport.centerX, viewport.centerZ)).toBeGreaterThan(1);
  });

  it('Plan fit preserves wall node coordinates', () => {
    const layout = createOffsetFootprintLayout({ minX: 5, minZ: 0, lengthMeters: 5, widthMeters: 5 });
    const beforeNodes = layout.nodes.map((node) => ({ ...node }));
    fitPlanToLayout(deriveDesignLayoutBounds({ wallLayout: layout }), { width: 1200, height: 800 });
    expect(layout.nodes).toEqual(beforeNodes);
  });

  it('3D fit targets the actual model bounds center with perspective-aware distance', () => {
    const bounds = deriveDesignSceneBounds({
      wallLayout: createOffsetFootprintLayout({ minX: 5, minZ: 0, lengthMeters: 5, widthMeters: 5 }),
    })!;
    const fit = fitPerspectiveCameraToBounds({
      bounds,
      camera: { fov: 45, aspect: 16 / 9 },
      padding: 1.2,
    });
    expect(fit.target.x).toBeCloseTo(7.5, 6);
    expect(fit.target.z).toBeCloseTo(2.5, 6);
    expect(fit.position.x).toBeGreaterThan(7.5);
    expect(fit.position.z).toBeGreaterThan(2.5);
  });

  it('3D grid and floor center follow model bounds center', () => {
    const bounds = deriveDesignLayoutBounds({
      wallLayout: createOffsetFootprintLayout({ minX: 5, minZ: 0, lengthMeters: 5, widthMeters: 5 }),
    });
    const grid = resolveSceneGridLayout(bounds);
    expect(grid.centerX).toBeCloseTo(7.5, 6);
    expect(grid.centerZ).toBeCloseTo(2.5, 6);
    expect(grid.gridSize).toBeGreaterThanOrEqual(10);
  });

  it('centers negative-coordinate footprints correctly', () => {
    const layout = createOffsetFootprintLayout({ minX: -12, minZ: -8, lengthMeters: 6, widthMeters: 4 });
    const bounds = deriveDesignSceneBounds({ wallLayout: layout })!;
    expect(bounds.center.x).toBeCloseTo(-9, 6);
    expect(bounds.center.z).toBeCloseTo(-6, 6);
    const fit = fit3dToLayout(bounds, { camera: { fov: 45, aspect: 1.5 } });
    expect(fit.target.x).toBeCloseTo(-9, 6);
    expect(fit.target.z).toBeCloseTo(-6, 6);
  });

  it('includes generated walls, slab footprint, and roof height in bounds', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = createOffsetFootprintLayout({ minX: 5, minZ: 0, lengthMeters: 5, widthMeters: 5 });
    const geometry = geometryForLayout(layout, preset);
    const bounds = deriveDesignSceneBounds({
      geometryResult: geometry,
      wallLayout: layout,
      slab: preset.slab,
      roof: preset.roof,
      truss: preset.truss,
    })!;
    expect(bounds.minX).toBeLessThanOrEqual(5);
    expect(bounds.maxX).toBeGreaterThanOrEqual(10);
    expect(bounds.minZ).toBeLessThanOrEqual(0);
    expect(bounds.maxZ).toBeGreaterThanOrEqual(5);
    expect(bounds.maxY).toBeGreaterThan(preset.wall.heightMeters);
    expect(bounds.radius).toBeGreaterThan(2);
  });

  it('blank layout bounds stay null without phantom geometry', () => {
    const blankLayout = createBlankWallLayout({
      defaultWallHeightMeters: 2.8,
      defaultWallThicknessMeters: 0.19,
    });
    expect(deriveDesignSceneBounds({ wallLayout: blankLayout })).toBeNull();
    expect(resetPlanView()).toEqual({ centerX: 0, centerZ: 0, zoom: 48 });
  });

  it('Plan fit centers a template layout at the origin without changing coordinates', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = createOutsideFaceRectangleLayout({ lengthMeters: 12, widthMeters: 8 });
    const beforeNodes = layout.nodes.map((node) => ({ ...node }));
    const geometry = geometryForLayout(layout, preset);
    const bounds = deriveDesignLayoutBounds({
      geometryResult: geometry,
      wallLayout: layout,
      slab: preset.slab,
      roof: preset.roof,
      truss: preset.truss,
    });
    const viewport = fitPlanToLayout(bounds, { width: 1200, height: 800 });
    expect(viewport.centerX).toBeCloseTo(0, 6);
    expect(viewport.centerZ).toBeCloseTo(0, 6);
    expect(layout.nodes).toEqual(beforeNodes);
  });

  it('Plan mapping preserves North-up orientation', () => {
    const viewport = { centerX: 0, centerZ: 0, zoom: 50 };
    const controller = createPlanCameraController(viewport, { width: 1000, height: 600 });
    expect(controller.planToScreenPoint({ x: 0, z: -2 }).y).toBeGreaterThan(controller.planToScreenPoint({ x: 0, z: 2 }).y);
    expect(controller.planToScreenPoint({ x: 2, z: 0 }).x).toBeGreaterThan(controller.planToScreenPoint({ x: -2, z: 0 }).x);
  });

  it('large layouts fit fully within Plan view with padding', () => {
    const bounds = {
      minX: -120,
      maxX: 80,
      minY: 0,
      maxY: 8,
      minZ: -75,
      maxZ: 125,
      center: { x: -20, y: 4, z: 25 },
      width: 200,
      depth: 200,
      height: 8,
    };
    const viewport = fitPlanToLayout(bounds, { width: 1000, height: 600 });
    const visible = createPlanCameraController(viewport, { width: 1000, height: 600 }).visibleWorldBounds();
    expect(visible.minX).toBeLessThan(bounds.minX);
    expect(visible.maxX).toBeGreaterThan(bounds.maxX);
    expect(visible.minZ).toBeLessThan(bounds.minZ);
    expect(visible.maxZ).toBeGreaterThan(bounds.maxZ);
  });

  it('Fit restores centered framing after an off-origin layout change', () => {
    const layout = createOffsetFootprintLayout({ minX: 5, minZ: 0, lengthMeters: 5, widthMeters: 5 });
    const bounds = deriveDesignLayoutBounds({ wallLayout: layout });
    const manualViewport = { centerX: 0, centerZ: 0, zoom: 48 };
    const refitViewport = fitPlanToLayout(bounds, { width: 1200, height: 800 });
    expect(manualViewport.centerX).toBe(0);
    expect(refitViewport.centerX).toBeCloseTo(7.5, 6);
    expect(refitViewport.centerZ).toBeCloseTo(2.5, 6);
  });
});
