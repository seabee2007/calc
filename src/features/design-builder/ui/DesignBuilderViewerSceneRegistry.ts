import * as THREE from 'three';
import type { DesignObjectType, WallOpeningParameters } from '../types';

export function selectionPriorityForObjectType(objectType: DesignObjectType): number {
  if (objectType === 'door_opening' || objectType === 'window_opening') return 100;
  if (objectType === 'cmu_wall_system') return 40;
  if (
    objectType === 'building_footprint' ||
    objectType === 'thickened_edge_slab' ||
    objectType === 'gable_roof_system' ||
    objectType === 'steel_truss_system'
  ) {
    return 20;
  }
  return 1;
}

export function markDesignBuilderSelectable(params: {
  object: THREE.Object3D;
  objectType: DesignObjectType;
  openingId?: string;
  priority?: number;
}): THREE.Object3D {
  params.object.userData.selectable = true;
  params.object.userData.designObjectType = params.objectType;
  params.object.userData.selectionPriority =
    params.priority ?? selectionPriorityForObjectType(params.objectType);
  if (params.openingId) params.object.userData.openingId = params.openingId;
  return params.object;
}

export function markDesignBuilderWallPickable(params: {
  mesh: THREE.Mesh;
  wallFace?: WallOpeningParameters['wallFace'];
  wallSegmentId?: string;
  lengthMeters?: number;
}): THREE.Mesh {
  if (params.wallFace) params.mesh.userData.wallFace = params.wallFace;
  if (params.wallSegmentId) params.mesh.userData.wallSegmentId = params.wallSegmentId;
  if (typeof params.lengthMeters === 'number') {
    params.mesh.userData.lengthMeters = params.lengthMeters;
  }
  params.mesh.userData.isWallPickable = true;
  return params.mesh;
}

function isObject3D(value: unknown): value is THREE.Object3D {
  return Boolean(value && typeof value === 'object' && (value as THREE.Object3D).isObject3D === true);
}

function warnInvalidObject(label: string, object: unknown): void {
  if (import.meta.env.DEV) {
    console.warn(`[DesignBuilderViewerSceneRegistry] Skipped invalid Object3D: ${label}`, object);
  }
}

export interface DesignBuilderViewerSceneRegistry {
  addRootObject: (object: THREE.Object3D) => THREE.Object3D;
  addSelectable: (
    object: THREE.Object3D,
    objectType: DesignObjectType,
    openingId?: string,
    priority?: number,
  ) => THREE.Object3D;
  addWallPickable: (
    mesh: THREE.Mesh,
    data: {
      wallFace?: WallOpeningParameters['wallFace'];
      wallSegmentId?: string;
      lengthMeters?: number;
    },
  ) => THREE.Mesh;
  registerSelectable: (object: THREE.Object3D) => THREE.Object3D;
  registerSelectables: (objects: readonly THREE.Object3D[]) => void;
  reset: () => void;
}

export function createDesignBuilderViewerSceneRegistry(params: {
  root: THREE.Group;
  selectableObjects: THREE.Object3D[];
  wallPickableObjects: THREE.Object3D[];
}): DesignBuilderViewerSceneRegistry {
  const addRootObject = (object: THREE.Object3D, label: string): THREE.Object3D => {
    if (!isObject3D(object)) {
      warnInvalidObject(label, object);
      return object;
    }
    params.root.add(object);
    return object;
  };

  return {
    addRootObject: (object) => {
      return addRootObject(object, 'root object');
    },
    addSelectable: (object, objectType, openingId, priority) => {
      if (!isObject3D(object)) {
        warnInvalidObject(`selectable ${objectType}`, object);
        return object;
      }
      markDesignBuilderSelectable({ object, objectType, openingId, priority });
      params.selectableObjects.push(object);
      return addRootObject(object, `selectable ${objectType}`);
    },
    addWallPickable: (mesh, data) => {
      if (!isObject3D(mesh)) {
        warnInvalidObject('wall pickable', mesh);
        return mesh;
      }
      markDesignBuilderWallPickable({ mesh, ...data });
      params.wallPickableObjects.push(mesh);
      return addRootObject(mesh, 'wall pickable');
    },
    registerSelectable: (object) => {
      if (!isObject3D(object)) {
        warnInvalidObject('registered selectable', object);
        return object;
      }
      params.selectableObjects.push(object);
      return object;
    },
    registerSelectables: (objects) => {
      objects.forEach((object, index) => {
        if (!isObject3D(object)) {
          warnInvalidObject(`registered selectable ${index}`, object);
          return;
        }
        params.selectableObjects.push(object);
      });
    },
    reset: () => {
      params.root.clear();
      params.selectableObjects.length = 0;
      params.wallPickableObjects.length = 0;
    },
  };
}
