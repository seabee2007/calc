import * as THREE from 'three';

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
