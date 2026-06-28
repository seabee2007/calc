import * as THREE from 'three';
import { getNormalizedPointerFromClient } from '../domain/pointerPlanMapping';
import {
  buildSegmentFrameMap,
  projectPointToSegmentStation,
} from '../domain/openingPlacementResolver';
import type { SegmentFrame } from '../geometry/designGeometry';
import type {
  CmuWallSystemParameters,
  DesignObjectType,
  WallOpeningParameters,
} from '../types';
import type { PlumbingSelection } from '../plumbing';

export type DesignBuilderViewerWallPick = {
  wallFace?: NonNullable<WallOpeningParameters['wallFace']>;
  offsetMeters?: number;
  wallSegmentId?: string;
  positionAlongSegment?: number;
  hitPoint?: { x: number; y?: number; z: number };
};

export type DesignBuilderViewerSelectableData = {
  designObjectType?: DesignObjectType;
  openingId?: string;
  plumbingSelection?: PlumbingSelection;
  selectionPriority?: number;
};

export type DesignBuilderViewerSelectablePick = {
  hit?: THREE.Intersection;
  data: DesignBuilderViewerSelectableData;
};

export type DesignBuilderViewerPlanTransform = {
  displayPointToPlanPoint?: (point: { x: number; z: number }) => { x: number; z: number };
  displayDirectionToPlanDirection?: (direction: { x: number; z: number }) => { x: number; z: number };
};

export function setPointerFromDesignViewerEvent(params: {
  event: PointerEvent;
  element: HTMLElement;
  camera: THREE.Camera;
  raycaster: THREE.Raycaster;
}): void {
  const pointer = getNormalizedPointerFromClient(params.event, params.element);
  params.raycaster.setFromCamera(pointer, params.camera);
}

export function resolveSelectableDataForObject(
  object: THREE.Object3D | null,
): DesignBuilderViewerSelectableData | null {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (
      current.userData.selectable &&
      (current.userData.designObjectType || current.userData.plumbingSelection)
    ) {
      return current.userData as DesignBuilderViewerSelectableData;
    }
    current = current.parent;
  }
  return null;
}

export function resolveSelectablePickFromIntersections(
  intersections: readonly THREE.Intersection[],
): DesignBuilderViewerSelectablePick | null {
  return (
    intersections
      .map((hit) => ({ hit, data: resolveSelectableDataForObject(hit.object) }))
      .filter(
        (
          item,
        ): item is {
          hit: THREE.Intersection;
          data: DesignBuilderViewerSelectableData;
        } => item.data != null,
      )
      .sort((a, b) => {
        const priorityDelta = (b.data.selectionPriority ?? 0) - (a.data.selectionPriority ?? 0);
        return priorityDelta !== 0 ? priorityDelta : a.hit.distance - b.hit.distance;
      })[0] ?? null
  );
}

export function resolveWallPickFromIntersections(params: {
  intersections: readonly THREE.Intersection[];
  viewDirection: Pick<THREE.Vector3, 'x' | 'z'>;
  segmentFrames: readonly SegmentFrame[];
  wall: Pick<CmuWallSystemParameters, 'lengthMeters' | 'widthMeters'>;
  debugLog?: (message: string) => void;
} & DesignBuilderViewerPlanTransform): DesignBuilderViewerWallPick | null {
  const displayPointToPlanPoint = params.displayPointToPlanPoint ?? ((point: { x: number; z: number }) => point);
  const displayDirectionToPlanDirection = params.displayDirectionToPlanDirection ?? ((direction: { x: number; z: number }) => direction);
  const planViewDirection = displayDirectionToPlanDirection(params.viewDirection);
  const frameById = buildSegmentFrameMap(params.segmentFrames);
  const candidates = params.intersections
    .filter((hit) => hit.object.userData.isWallPickable)
    .map((hit) => {
      const wallSegmentId = hit.object.userData.wallSegmentId as string | undefined;
      const frame = wallSegmentId ? frameById.get(wallSegmentId) : null;
      const facing = frame
        ? frame.outwardNormal.x * -planViewDirection.x +
            frame.outwardNormal.z * -planViewDirection.z >
          0.05
        : true;
      return { hit, wallSegmentId, frame, facing };
    })
    .filter((candidate) => candidate.facing)
    .sort((left, right) => left.hit.distance - right.hit.distance);

  const best = candidates[0];
  if (!best) return null;
  const point = best.hit.point;
  const planPoint = displayPointToPlanPoint(point);

  if (best.wallSegmentId && best.frame) {
    const positionAlongSegment = projectPointToSegmentStation(
      planPoint,
      best.frame,
    );
    params.debugLog?.(
      `Host wall: ${best.wallSegmentId}\nStation: ${positionAlongSegment.toFixed(2)} m / ${best.frame.lengthMeters.toFixed(2)} m`,
    );
    return {
      wallSegmentId: best.wallSegmentId,
      positionAlongSegment,
      hitPoint: { x: planPoint.x, y: point.y, z: planPoint.z },
    };
  }

  if (!best.hit.object.userData.wallFace) return null;
  const wallFace = best.hit.object.userData.wallFace as WallOpeningParameters['wallFace'];
  const offsetMeters =
    wallFace === 'north' || wallFace === 'south'
      ? planPoint.x + params.wall.lengthMeters / 2
      : planPoint.z + params.wall.widthMeters / 2;
  return { wallFace, offsetMeters, hitPoint: { x: planPoint.x, y: point.y, z: planPoint.z } };
}

export function resolveManualBrushPointFromRay(params: {
  ray: THREE.Ray;
  groundPlane?: THREE.Plane;
} & Pick<DesignBuilderViewerPlanTransform, 'displayPointToPlanPoint'>): { x: number; z: number } | null {
  const hit = new THREE.Vector3();
  const groundPlane = params.groundPlane ?? new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  if (!params.ray.intersectPlane(groundPlane, hit)) return null;
  const planPoint = params.displayPointToPlanPoint?.(hit) ?? hit;
  return { x: planPoint.x, z: planPoint.z };
}

export function createDesignBuilderViewerPickers(params: {
  element: HTMLElement;
  camera: THREE.Camera;
  raycaster: THREE.Raycaster;
  selectableObjects: THREE.Object3D[];
  wallPickableObjects: THREE.Object3D[];
  getWall: () => Pick<CmuWallSystemParameters, 'lengthMeters' | 'widthMeters'>;
  getSegmentFrames: () => readonly SegmentFrame[];
  groundPlane?: THREE.Plane;
  debug?: boolean;
} & DesignBuilderViewerPlanTransform): {
  pickWall: (event: PointerEvent) => DesignBuilderViewerWallPick | null;
  pickSelectable: (event: PointerEvent) => DesignBuilderViewerSelectablePick | null;
  pickManualBrushPoint: (event: PointerEvent) => { x: number; z: number } | null;
} {
  const setPointerFromEvent = (event: PointerEvent) => {
    setPointerFromDesignViewerEvent({
      event,
      element: params.element,
      camera: params.camera,
      raycaster: params.raycaster,
    });
  };

  return {
    pickWall: (event) => {
      setPointerFromEvent(event);
      return resolveWallPickFromIntersections({
        intersections: params.raycaster.intersectObjects(params.wallPickableObjects, false),
        viewDirection: params.raycaster.ray.direction.clone().normalize(),
        segmentFrames: params.getSegmentFrames(),
        wall: params.getWall(),
        debugLog: params.debug ? (message) => console.debug(message) : undefined,
        displayPointToPlanPoint: params.displayPointToPlanPoint,
        displayDirectionToPlanDirection: params.displayDirectionToPlanDirection,
      });
    },
    pickSelectable: (event) => {
      setPointerFromEvent(event);
      return resolveSelectablePickFromIntersections(
        params.raycaster.intersectObjects(params.selectableObjects, true),
      );
    },
    pickManualBrushPoint: (event) => {
      setPointerFromEvent(event);
      return resolveManualBrushPointFromRay({
        ray: params.raycaster.ray,
        groundPlane: params.groundPlane,
        displayPointToPlanPoint: params.displayPointToPlanPoint,
      });
    },
  };
}
