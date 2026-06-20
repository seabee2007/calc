import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import {
  deriveDesignLayoutBounds,
  fit3dToLayout,
  fitPlanToLayout,
  resetPlanView,
} from '../domain/designLayoutBounds';
import { createPlanCameraController } from '../domain/pointerPlanMapping';
import { createOutsideFaceRectangleLayout } from '../domain/wallLayoutRules';
import {
  buildDesignGeometryInputFromLayout,
  generateDesignGeometry,
} from '../geometry/designGeometry';

describe('design layout bounds and viewport fitting', () => {
  it('blank Plan view centers on the world origin', () => {
    expect(resetPlanView()).toEqual({ centerX: 0, centerZ: 0, zoom: 48 });
    expect(fitPlanToLayout(null, { width: 900, height: 520 })).toEqual(resetPlanView());
  });

  it('Plan fit centers a new wall layout without changing coordinates', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = createOutsideFaceRectangleLayout({ lengthMeters: 12, widthMeters: 8 });
    const beforeNodes = layout.nodes.map((node) => ({ ...node }));
    const geometry = generateDesignGeometry(buildDesignGeometryInputFromLayout({
      wallLayout: layout,
      cmuSettings: { ...preset.wall, openings: [], lengthMeters: 12, widthMeters: 8 },
      openings: [],
      slabSettings: preset.slab,
      roofSettings: preset.roof,
      trussSettings: preset.truss,
    }));
    const bounds = deriveDesignLayoutBounds({ geometryResult: geometry, wallLayout: layout, slab: preset.slab, roof: preset.roof, truss: preset.truss });
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

  it('3D fit targets layout bounds center', () => {
    const fit = fit3dToLayout({
      minX: 10,
      maxX: 20,
      minY: 0,
      maxY: 4,
      minZ: -8,
      maxZ: 2,
      center: { x: 15, y: 2, z: -3 },
      width: 10,
      depth: 10,
      height: 4,
    });

    expect(fit.target).toEqual({ x: 15, y: 2, z: -3 });
    expect(fit.position.x).toBeGreaterThan(15);
    expect(fit.position.y).toBeGreaterThan(2);
    expect(fit.position.z).toBeGreaterThan(-3);
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
});
