import * as THREE from 'three';
import { chooseAdaptiveGridSpacing as computeAdaptiveGridSpacingFromVisibleWidth } from './planGridState';

export interface ClientPointerLike {
  clientX: number;
  clientY: number;
}

export type PlanViewportTransform = {
  screenToPlanPoint: (
    clientX: number,
    clientY: number,
  ) => { x: number; z: number } | null;
  planToScreenPoint: (
    point: { x: number; z: number },
  ) => { x: number; y: number };
  containsClientPoint: (
    clientX: number,
    clientY: number,
  ) => boolean;
};

export interface PlanViewportBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export type PlanViewportState = {
  centerX: number;
  centerZ: number;
  zoom: number;
};

export type PlanSurfaceSize = {
  width: number;
  height: number;
};

export const DEFAULT_PLAN_VIEWPORT: PlanViewportState = {
  centerX: 0,
  centerZ: 0,
  zoom: 48,
};

export const PLAN_ZOOM_LIMITS = {
  min: 0.05,
  max: 320,
};

export type PlanGridScalePreset = {
  spacingMeters: number;
  targetCellsAcrossViewport: number;
};

export const PLAN_GRID_SCALE_PRESETS: PlanGridScalePreset[] = [
  { spacingMeters: 0.1, targetCellsAcrossViewport: 3 },
  { spacingMeters: 0.2, targetCellsAcrossViewport: 4 },
  { spacingMeters: 0.4, targetCellsAcrossViewport: 6 },
  { spacingMeters: 1, targetCellsAcrossViewport: 10 },
  { spacingMeters: 2, targetCellsAcrossViewport: 12 },
  { spacingMeters: 5, targetCellsAcrossViewport: 16 },
  { spacingMeters: 10, targetCellsAcrossViewport: 20 },
  { spacingMeters: 20, targetCellsAcrossViewport: 24 },
  { spacingMeters: 50, targetCellsAcrossViewport: 32 },
  { spacingMeters: 100, targetCellsAcrossViewport: 40 },
];

export function clampPlanZoom(zoom: number): number {
  return Math.min(PLAN_ZOOM_LIMITS.max, Math.max(PLAN_ZOOM_LIMITS.min, zoom));
}

export function createPlanCameraController(
  viewport: PlanViewportState,
  surface: PlanSurfaceSize,
) {
  const safeWidth = Math.max(1, surface.width);
  const safeHeight = Math.max(1, surface.height);
  const zoom = clampPlanZoom(viewport.zoom);

  const screenToPlanPoint = (clientX: number, clientY: number, rectLeft = 0, rectTop = 0) => ({
    x: viewport.centerX + (clientX - rectLeft - safeWidth / 2) / zoom,
    z: viewport.centerZ - (clientY - rectTop - safeHeight / 2) / zoom,
  });

  const planToScreenPoint = (point: { x: number; z: number }) => ({
    x: safeWidth / 2 + (point.x - viewport.centerX) * zoom,
    y: safeHeight / 2 - (point.z - viewport.centerZ) * zoom,
  });

  const zoomAtPointer = (
    clientX: number,
    clientY: number,
    deltaY: number,
    rectLeft = 0,
    rectTop = 0,
  ): PlanViewportState => {
    const before = screenToPlanPoint(clientX, clientY, rectLeft, rectTop);
    const factor = deltaY > 0 ? 0.88 : 1.14;
    const nextZoom = clampPlanZoom(zoom * factor);
    return {
      centerX: before.x - (clientX - rectLeft - safeWidth / 2) / nextZoom,
      centerZ: before.z + (clientY - rectTop - safeHeight / 2) / nextZoom,
      zoom: nextZoom,
    };
  };

  const panByPointerDelta = (deltaX: number, deltaY: number): PlanViewportState => ({
    centerX: viewport.centerX - deltaX / zoom,
    centerZ: viewport.centerZ + deltaY / zoom,
    zoom,
  });

  return {
    zoomAtPointer,
    panByPointerDelta,
    screenToPlanPoint,
    planToScreenPoint,
    visibleWorldBounds: (): PlanViewportBounds => ({
      minX: viewport.centerX - safeWidth / (2 * zoom),
      maxX: viewport.centerX + safeWidth / (2 * zoom),
      minZ: viewport.centerZ - safeHeight / (2 * zoom),
      maxZ: viewport.centerZ + safeHeight / (2 * zoom),
    }),
  };
}

export function fitPlanViewportToBounds(
  bounds: PlanViewportBounds | null,
  surface: PlanSurfaceSize,
  paddingRatio = 0.18,
): PlanViewportState {
  if (!bounds) return DEFAULT_PLAN_VIEWPORT;
  const width = Math.max(0.1, bounds.maxX - bounds.minX);
  const height = Math.max(0.1, bounds.maxZ - bounds.minZ);
  const paddedWidth = width * (1 + paddingRatio * 2);
  const paddedHeight = height * (1 + paddingRatio * 2);
  return {
    centerX: (bounds.minX + bounds.maxX) / 2,
    centerZ: (bounds.minZ + bounds.maxZ) / 2,
    zoom: clampPlanZoom(Math.min(surface.width / paddedWidth, surface.height / paddedHeight)),
  };
}

export function getPlanGridScalePreset(spacingMeters: number): PlanGridScalePreset {
  return PLAN_GRID_SCALE_PRESETS.reduce((best, preset) =>
    Math.abs(preset.spacingMeters - spacingMeters) < Math.abs(best.spacingMeters - spacingMeters) ? preset : best,
  );
}

export function planViewportForGridScale(
  current: PlanViewportState,
  surface: PlanSurfaceSize,
  spacingMeters: number,
): PlanViewportState {
  const preset = getPlanGridScalePreset(spacingMeters);
  const safeWidth = Math.max(1, surface.width);
  const visibleWorldWidth = Math.max(0.1, preset.spacingMeters * preset.targetCellsAcrossViewport);
  return {
    centerX: current.centerX,
    centerZ: current.centerZ,
    zoom: clampPlanZoom(safeWidth / visibleWorldWidth),
  };
}

export function chooseAdaptiveGridSpacing(worldUnitsVisible: number): number {
  return computeAdaptiveGridSpacingFromVisibleWidth(worldUnitsVisible);
}

export function getNormalizedPointerFromClient(
  event: ClientPointerLike,
  canvasElement: Pick<HTMLElement, 'getBoundingClientRect'>,
): THREE.Vector2 {
  const rect = canvasElement.getBoundingClientRect();
  return new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );
}

export function getPlanPointFromPointer(
  event: ClientPointerLike,
  canvasElement: Pick<HTMLElement, 'getBoundingClientRect'>,
  camera: THREE.Camera,
  raycaster: THREE.Raycaster,
  planPlane: THREE.Plane,
): THREE.Vector2 | null {
  const pointer = getNormalizedPointerFromClient(event, canvasElement);
  raycaster.setFromCamera(pointer, camera);
  const hit = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(planPlane, hit)) return null;
  return new THREE.Vector2(hit.x, hit.z);
}

export function getSvgPlanPointFromPointer(
  event: ClientPointerLike,
  svg: SVGSVGElement,
  centerX: number,
  centerY: number,
  pixelsPerMeter: number,
): { x: number; z: number } | null {
  return screenPointerToPlanPoint(event, svg, centerX, centerY, pixelsPerMeter);
}

export function screenPointerToPlanPoint(
  event: ClientPointerLike,
  planSurfaceElement: SVGSVGElement,
  centerX: number,
  centerY: number,
  pixelsPerMeter: number,
): { x: number; z: number } | null {
  const svg = planSurfaceElement;
  const rect = svg.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const viewBox = svg.viewBox.baseVal;
  if (viewBox.width <= 0 || viewBox.height <= 0 || pixelsPerMeter <= 0) return null;

  const scale = Math.min(rect.width / viewBox.width, rect.height / viewBox.height);
  const renderedWidth = viewBox.width * scale;
  const renderedHeight = viewBox.height * scale;
  const contentLeft = rect.left + (rect.width - renderedWidth) / 2;
  const contentTop = rect.top + (rect.height - renderedHeight) / 2;
  const svgX = (viewBox.x ?? 0) + (event.clientX - contentLeft) / scale;
  const svgY = (viewBox.y ?? 0) + (event.clientY - contentTop) / scale;
  return {
    x: (svgX - centerX) / pixelsPerMeter,
    z: (centerY - svgY) / pixelsPerMeter,
  };
}

export function createPlanViewportTransform(
  planSurfaceElement: SVGSVGElement,
  bounds: PlanViewportBounds,
  pixelsPerMeter: number,
): PlanViewportTransform | null {
  const rect = planSurfaceElement.getBoundingClientRect();
  const viewBox = planSurfaceElement.viewBox.baseVal;
  if (
    rect.width <= 0 ||
    rect.height <= 0 ||
    viewBox.width <= 0 ||
    viewBox.height <= 0 ||
    pixelsPerMeter <= 0
  ) {
    return null;
  }

  const containsClientPoint = (clientX: number, clientY: number) =>
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom;

  const svgPointFromClient = (clientX: number, clientY: number) => ({
    x: (viewBox.x ?? 0) + ((clientX - rect.left) / rect.width) * viewBox.width,
    y: (viewBox.y ?? 0) + ((clientY - rect.top) / rect.height) * viewBox.height,
  });

  const planToScreenPoint = (point: { x: number; z: number }) => ({
    x: (point.x - bounds.minX) * pixelsPerMeter,
    y: (bounds.maxZ - point.z) * pixelsPerMeter,
  });

  return {
    containsClientPoint,
    screenToPlanPoint: (clientX: number, clientY: number) => {
      if (!containsClientPoint(clientX, clientY)) return null;
      const svg = svgPointFromClient(clientX, clientY);
      return {
        x: bounds.minX + svg.x / pixelsPerMeter,
        z: bounds.maxZ - svg.y / pixelsPerMeter,
      };
    },
    planToScreenPoint,
  };
}
