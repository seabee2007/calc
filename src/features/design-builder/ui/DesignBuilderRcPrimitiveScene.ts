import * as THREE from 'three';

export type TrackGeometry = <T extends THREE.BufferGeometry>(geometry: T) => T;

export interface RcMeshUserData {
  [key: string]: unknown;
}

function assignUserData(mesh: THREE.Mesh, userData?: RcMeshUserData): THREE.Mesh {
  if (userData) {
    Object.assign(mesh.userData, userData);
  }
  return mesh;
}

export function buildRcBoxMesh(params: {
  name: string;
  xSizeMeters: number;
  ySizeMeters: number;
  zSizeMeters: number;
  center: { x: number; y: number; z: number };
  material: THREE.Material;
  trackGeometry: TrackGeometry;
  rotationY?: number;
  userData?: RcMeshUserData;
}): THREE.Mesh {
  const mesh = new THREE.Mesh(
    params.trackGeometry(
      new THREE.BoxGeometry(params.xSizeMeters, params.ySizeMeters, params.zSizeMeters),
    ),
    params.material,
  );
  mesh.name = params.name;
  mesh.position.set(params.center.x, params.center.y, params.center.z);
  if (typeof params.rotationY === 'number') {
    mesh.rotation.y = params.rotationY;
  }
  return assignUserData(mesh, params.userData);
}

export function buildRcElevationBoxMesh(params: {
  name: string;
  xSizeMeters: number;
  zSizeMeters: number;
  bottomElevationMeters: number;
  topElevationMeters: number;
  x: number;
  z: number;
  slabTopMeters: number;
  material: THREE.Material;
  trackGeometry: TrackGeometry;
  rotationY?: number;
  minHeightMeters?: number;
  userData?: RcMeshUserData;
}): THREE.Mesh {
  const height = Math.max(params.minHeightMeters ?? 0.02, params.topElevationMeters - params.bottomElevationMeters);
  return buildRcBoxMesh({
    name: params.name,
    xSizeMeters: params.xSizeMeters,
    ySizeMeters: height,
    zSizeMeters: params.zSizeMeters,
    center: {
      x: params.x,
      y: params.slabTopMeters + params.bottomElevationMeters + height / 2,
      z: params.z,
    },
    material: params.material,
    trackGeometry: params.trackGeometry,
    rotationY: params.rotationY,
    userData: params.userData,
  });
}

export function buildRcBeamMesh(params: {
  name: string;
  start: { x: number; z: number };
  end: { x: number; z: number };
  baseElevationMeters: number;
  widthMeters: number;
  depthMeters: number;
  slabTopMeters: number;
  material: THREE.Material;
  trackGeometry: TrackGeometry;
  userData?: RcMeshUserData;
}): THREE.Mesh | null {
  const dx = params.end.x - params.start.x;
  const dz = params.end.z - params.start.z;
  const length = Math.hypot(dx, dz);
  if (length <= 0) return null;
  return buildRcBoxMesh({
    name: params.name,
    xSizeMeters: length,
    ySizeMeters: params.depthMeters,
    zSizeMeters: params.widthMeters,
    center: {
      x: (params.start.x + params.end.x) / 2,
      y: params.slabTopMeters + params.baseElevationMeters + params.depthMeters / 2,
      z: (params.start.z + params.end.z) / 2,
    },
    material: params.material,
    trackGeometry: params.trackGeometry,
    rotationY: -Math.atan2(dz, dx),
    userData: params.userData,
  });
}
