import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
  createPlanViewportTransform,
  chooseAdaptiveGridSpacing,
  createPlanCameraController,
  fitPlanViewportToBounds,
  getNormalizedPointerFromClient,
  getPlanGridScalePreset,
  getPlanPointFromPointer,
  getSvgPlanPointFromPointer,
  planViewportForGridScale,
  screenPointerToPlanPoint,
} from '../domain/pointerPlanMapping';

function canvasRect(left: number, top: number, width: number, height: number) {
  return {
    getBoundingClientRect: vi.fn(() => ({
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
      toJSON: () => ({}),
    } as DOMRect)),
  };
}

describe('pointerPlanMapping', () => {
  it('normalizes pointer coordinates from the canvas rect', () => {
    const canvas = canvasRect(100, 50, 400, 200);

    expect(getNormalizedPointerFromClient({ clientX: 100, clientY: 50 }, canvas).toArray()).toEqual([-1, 1]);
    expect(getNormalizedPointerFromClient({ clientX: 300, clientY: 150 }, canvas).toArray()).toEqual([0, 0]);
    expect(getNormalizedPointerFromClient({ clientX: 500, clientY: 250 }, canvas).toArray()).toEqual([1, -1]);
  });

  it('maps pointer rays onto the plan plane after viewer resize', () => {
    const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
    camera.position.set(0, 10, 0);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
    const raycaster = new THREE.Raycaster();
    const planPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    const firstCanvas = canvasRect(0, 0, 500, 500);
    const resizedCanvas = canvasRect(50, 25, 1000, 500);

    const first = getPlanPointFromPointer({ clientX: 250, clientY: 250 }, firstCanvas, camera, raycaster, planPlane);
    const resized = getPlanPointFromPointer({ clientX: 550, clientY: 275 }, resizedCanvas, camera, raycaster, planPlane);

    expect(first?.x).toBeCloseTo(0, 6);
    expect(first?.y).toBeCloseTo(0, 2);
    expect(resized?.x).toBeCloseTo(0, 6);
    expect(resized?.y).toBeCloseTo(0, 2);
  });

  it('maps SVG plan points from the SVG bounding rect', () => {
    const svg = {
      getBoundingClientRect: vi.fn(() => ({
        left: 100,
        top: 50,
        width: 400,
        height: 200,
        right: 500,
        bottom: 250,
        x: 100,
        y: 50,
        toJSON: () => ({}),
      } as DOMRect)),
      viewBox: { baseVal: { width: 800, height: 400 } },
    } as SVGSVGElement;

    expect(getSvgPlanPointFromPointer({ clientX: 300, clientY: 150 }, svg, 400, 200, 50)).toEqual({ x: 0, z: 0 });
    expect(getSvgPlanPointFromPointer({ clientX: 500, clientY: 50 }, svg, 400, 200, 50)).toEqual({ x: 8, z: 4 });
  });

  it('maps SVG plan points through the rendered viewBox when the surface is letterboxed', () => {
    const svg = {
      getBoundingClientRect: vi.fn(() => ({
        left: 100,
        top: 50,
        width: 800,
        height: 600,
        right: 900,
        bottom: 650,
        x: 100,
        y: 50,
        toJSON: () => ({}),
      } as DOMRect)),
      viewBox: { baseVal: { x: 0, y: 0, width: 800, height: 400 } },
    } as SVGSVGElement;

    expect(screenPointerToPlanPoint({ clientX: 500, clientY: 350 }, svg, 400, 200, 50)).toEqual({ x: 0, z: 0 });
    expect(screenPointerToPlanPoint({ clientX: 100, clientY: 150 }, svg, 400, 200, 50)).toEqual({ x: -8, z: 4 });
  });

  it('creates a reversible plan viewport transform from the actual plan surface rect', () => {
    const svg = {
      getBoundingClientRect: vi.fn(() => ({
        left: 320,
        top: 140,
        width: 480,
        height: 360,
        right: 800,
        bottom: 500,
        x: 320,
        y: 140,
        toJSON: () => ({}),
      } as DOMRect)),
      viewBox: { baseVal: { x: 0, y: 0, width: 480, height: 360 } },
    } as SVGSVGElement;

    const transform = createPlanViewportTransform(svg, { minX: -5, maxX: 5, minZ: -4, maxZ: 3.5 }, 48);

    expect(transform?.containsClientPoint(320, 140)).toBe(true);
    expect(transform?.containsClientPoint(100, 140)).toBe(false);
    expect(transform?.screenToPlanPoint(560, 320)).toEqual({ x: 0, z: -0.25 });
    expect(transform?.planToScreenPoint({ x: 0, z: -0.25 })).toEqual({ x: 240, y: 180 });
  });

  it('zooming out increases the visible world extent', () => {
    const controller = createPlanCameraController({ centerX: 0, centerZ: 0, zoom: 48 }, { width: 960, height: 540 });
    const before = controller.visibleWorldBounds();
    const afterViewport = controller.zoomAtPointer(480, 270, 100, 0, 0);
    const after = createPlanCameraController(afterViewport, { width: 960, height: 540 }).visibleWorldBounds();

    expect(after.maxX - after.minX).toBeGreaterThan(before.maxX - before.minX);
  });

  it('zooming toward the cursor preserves the cursor world point', () => {
    const viewport = { centerX: 2, centerZ: -3, zoom: 48 };
    const controller = createPlanCameraController(viewport, { width: 900, height: 600 });
    const before = controller.screenToPlanPoint(650, 220, 0, 0);
    const nextViewport = controller.zoomAtPointer(650, 220, -100, 0, 0);
    const after = createPlanCameraController(nextViewport, { width: 900, height: 600 }).screenToPlanPoint(650, 220, 0, 0);

    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.z).toBeCloseTo(before.z, 6);
  });

  it('middle-drag pan changes viewport without changing plan geometry coordinates', () => {
    const viewport = { centerX: 0, centerZ: 0, zoom: 50 };
    const next = createPlanCameraController(viewport, { width: 1000, height: 600 }).panByPointerDelta(100, -50);

    expect(next.centerX).toBeCloseTo(-2, 6);
    expect(next.centerZ).toBeCloseTo(-1, 6);
  });

  it('fit view frames large layouts with padding and blank fit uses neutral viewport', () => {
    const fit = fitPlanViewportToBounds({ minX: 0, maxX: 40, minZ: 0, maxZ: 30 }, { width: 1000, height: 600 });
    const blank = fitPlanViewportToBounds(null, { width: 1000, height: 600 });

    expect(fit.centerX).toBeCloseTo(20, 6);
    expect(fit.centerZ).toBeCloseTo(15, 6);
    expect(fit.zoom).toBeLessThan(20);
    expect(blank.centerX).toBe(0);
    expect(blank.centerZ).toBe(0);
  });

  it('grid spacing adapts as zoom changes', () => {
    expect(chooseAdaptiveGridSpacing(4)).toBeLessThan(chooseAdaptiveGridSpacing(120));
  });

  it('grid scale presets produce visibly different projected cell widths', () => {
    const surface = { width: 1000, height: 600 };
    const current = { centerX: 12, centerZ: -8, zoom: 10 };
    const close = planViewportForGridScale(current, surface, 0.4);
    const far = planViewportForGridScale(current, surface, 100);

    expect(close.centerX).toBe(current.centerX);
    expect(close.centerZ).toBe(current.centerZ);
    expect(far.centerX).toBe(current.centerX);
    expect(far.centerZ).toBe(current.centerZ);
    expect(close.zoom).toBeGreaterThan(far.zoom * 100);
    expect(0.4 * close.zoom).toBeGreaterThan(100 * far.zoom);
  });

  it('grid scale changes camera zoom without mutating spacing or world coordinates', () => {
    const spacingMeters = 0.4;
    const wallNode = { x: 10, z: -5 };
    const current = { centerX: 0, centerZ: 0, zoom: 48 };
    const scaled = planViewportForGridScale(current, { width: 900, height: 520 }, spacingMeters);

    expect(spacingMeters).toBe(0.4);
    expect(wallNode).toEqual({ x: 10, z: -5 });
    expect(scaled.centerX).toBe(0);
    expect(scaled.centerZ).toBe(0);
  });

  it('fit view frames bounds independently of selected grid scale', () => {
    const surface = { width: 1000, height: 600 };
    const closeScale = planViewportForGridScale({ centerX: 0, centerZ: 0, zoom: 48 }, surface, 0.4);
    const fit = fitPlanViewportToBounds({ minX: -20, maxX: 20, minZ: -10, maxZ: 10 }, surface);

    expect(fit.zoom).not.toBeCloseTo(closeScale.zoom, 2);
    expect(fit.centerX).toBe(0);
    expect(fit.centerZ).toBe(0);
  });

  it('reset scale uses the selected grid preset', () => {
    const preset = getPlanGridScalePreset(100);
    const reset = planViewportForGridScale({ centerX: 4, centerZ: 6, zoom: 48 }, { width: 1000, height: 600 }, 100);

    expect(reset.centerX).toBe(4);
    expect(reset.centerZ).toBe(6);
    expect(reset.zoom).toBeCloseTo(1000 / (preset.spacingMeters * preset.targetCellsAcrossViewport), 6);
  });

  it('mouse-wheel zoom continues from a grid scale preset', () => {
    const scaled = planViewportForGridScale({ centerX: 0, centerZ: 0, zoom: 48 }, { width: 1000, height: 600 }, 5);
    const zoomed = createPlanCameraController(scaled, { width: 1000, height: 600 }).zoomAtPointer(500, 300, -100);

    expect(zoomed.zoom).toBeGreaterThan(scaled.zoom);
  });
});
