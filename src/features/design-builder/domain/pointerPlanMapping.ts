import * as THREE from 'three';

export interface ClientPointerLike {
  clientX: number;
  clientY: number;
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
