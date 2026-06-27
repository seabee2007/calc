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
  return {
    addRootObject: (object) => {
      params.root.add(object);
      return object;
    },
    addSelectable: (object, objectType, openingId, priority) => {
      markDesignBuilderSelectable({ object, objectType, openingId, priority });
      params.selectableObjects.push(object);
      params.root.add(object);
      return object;
    },
    addWallPickable: (mesh, data) => {
      markDesignBuilderWallPickable({ mesh, ...data });
      params.wallPickableObjects.push(mesh);
      params.root.add(mesh);
      return mesh;
    },
    registerSelectable: (object) => {
      params.selectableObjects.push(object);
      return object;
    },
    registerSelectables: (objects) => {
      params.selectableObjects.push(...objects);
    },
    reset: () => {
      params.root.clear();
      params.selectableObjects.length = 0;
      params.wallPickableObjects.length = 0;
    },
  };
}
