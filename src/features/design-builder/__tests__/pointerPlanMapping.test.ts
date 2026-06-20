import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
  getNormalizedPointerFromClient,
  getPlanPointFromPointer,
  getSvgPlanPointFromPointer,
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
});
