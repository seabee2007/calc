import * as THREE from 'three';
import type { ResolvedRoofSystem, RoofPlane, RoofVec3 } from '../types';

type TrackGeometry = <T extends THREE.BufferGeometry>(geometry: T) => T;
type TrackMaterial = <T extends THREE.Material>(material: T) => T;

const COLORS = {
  structuralBearing: 0x22c55e,
  claddingPerimeter: 0x06b6d4,
  structuralRidge: 0xfacc15,
  claddingRidge: 0xfb923c,
  roofTopPlane: 0x3b82f6,
  claddingDisplayPlane: 0xd946ef,
  trussStation: 0xef4444,
  purlinEndpoint: 0xa855f7,
  normal: 0xffffff,
};

export function buildDesignBuilderViewerRoofDebugScene(params: {
  enabled: boolean;
  resolvedRoof: ResolvedRoofSystem | null | undefined;
  slabTopMeters: number;
  trackGeometry: TrackGeometry;
  trackMaterial: TrackMaterial;
}): THREE.Group {
  const group = new THREE.Group();
  group.name = 'roofDebugGroup';
  if (!params.enabled || !params.resolvedRoof?.supported) return group;
  const roof = params.resolvedRoof;

  addClosedPolyline({
    group,
    points: roof.structuralBearingPerimeter,
    slabTopMeters: params.slabTopMeters,
    color: COLORS.structuralBearing,
    trackGeometry: params.trackGeometry,
    trackMaterial: params.trackMaterial,
  });
  addClosedPolyline({
    group,
    points: roof.claddingPerimeter,
    slabTopMeters: params.slabTopMeters,
    color: COLORS.claddingPerimeter,
    trackGeometry: params.trackGeometry,
    trackMaterial: params.trackMaterial,
  });
  addSegment({
    group,
    start: roof.structuralRidgeStart,
    end: roof.structuralRidgeEnd,
    slabTopMeters: params.slabTopMeters,
    color: COLORS.structuralRidge,
    trackGeometry: params.trackGeometry,
    trackMaterial: params.trackMaterial,
  });
  addSegment({
    group,
    start: roof.claddingRidgeStart,
    end: roof.claddingRidgeEnd,
    slabTopMeters: params.slabTopMeters,
    color: COLORS.claddingRidge,
    trackGeometry: params.trackGeometry,
    trackMaterial: params.trackMaterial,
  });

  for (const plane of roof.roofTopPlanes) {
    addPlaneWireframe({
      group,
      plane,
      slabTopMeters: params.slabTopMeters,
      color: COLORS.roofTopPlane,
      trackGeometry: params.trackGeometry,
      trackMaterial: params.trackMaterial,
    });
    addPlaneNormal({
      group,
      plane,
      slabTopMeters: params.slabTopMeters,
      color: COLORS.normal,
      trackGeometry: params.trackGeometry,
      trackMaterial: params.trackMaterial,
    });
  }
  for (const plane of roof.claddingDisplayPlanes) {
    addPlaneWireframe({
      group,
      plane,
      slabTopMeters: params.slabTopMeters,
      color: COLORS.claddingDisplayPlane,
      trackGeometry: params.trackGeometry,
      trackMaterial: params.trackMaterial,
    });
  }

  addPointCloud({
    group,
    points: roof.trussPlacements.map((truss) => truss.apex),
    slabTopMeters: params.slabTopMeters,
    color: COLORS.trussStation,
    size: 0.1,
    name: 'roofDebugTrussStations',
    trackGeometry: params.trackGeometry,
    trackMaterial: params.trackMaterial,
  });
  addPointCloud({
    group,
    points: roof.purlinPlacements.flatMap((purlin) => [purlin.start, purlin.end]),
    slabTopMeters: params.slabTopMeters,
    color: COLORS.purlinEndpoint,
    size: 0.07,
    name: 'roofDebugPurlinEndpoints',
    trackGeometry: params.trackGeometry,
    trackMaterial: params.trackMaterial,
  });

  return group;
}

function addClosedPolyline(params: {
  group: THREE.Group;
  points: readonly RoofVec3[];
  slabTopMeters: number;
  color: number;
  trackGeometry: TrackGeometry;
  trackMaterial: TrackMaterial;
}) {
  if (params.points.length < 2) return;
  addLine({
    ...params,
    points: [...params.points, params.points[0]!],
  });
}

function addSegment(params: {
  group: THREE.Group;
  start?: RoofVec3;
  end?: RoofVec3;
  slabTopMeters: number;
  color: number;
  trackGeometry: TrackGeometry;
  trackMaterial: TrackMaterial;
}) {
  if (!params.start || !params.end) return;
  addLine({
    group: params.group,
    points: [params.start, params.end],
    slabTopMeters: params.slabTopMeters,
    color: params.color,
    trackGeometry: params.trackGeometry,
    trackMaterial: params.trackMaterial,
  });
}

function addPlaneWireframe(params: {
  group: THREE.Group;
  plane: RoofPlane;
  slabTopMeters: number;
  color: number;
  trackGeometry: TrackGeometry;
  trackMaterial: TrackMaterial;
}) {
  if (params.plane.corners.length < 2) return;
  addClosedPolyline({
    group: params.group,
    points: params.plane.corners,
    slabTopMeters: params.slabTopMeters,
    color: params.color,
    trackGeometry: params.trackGeometry,
    trackMaterial: params.trackMaterial,
  });
}

function addPlaneNormal(params: {
  group: THREE.Group;
  plane: RoofPlane;
  slabTopMeters: number;
  color: number;
  trackGeometry: TrackGeometry;
  trackMaterial: TrackMaterial;
}) {
  if (params.plane.corners.length === 0) return;
  const centroid = params.plane.corners.reduce(
    (sum, corner) => ({
      x: sum.x + corner.x / params.plane.corners.length,
      y: sum.y + corner.y / params.plane.corners.length,
      z: sum.z + corner.z / params.plane.corners.length,
    }),
    { x: 0, y: 0, z: 0 },
  );
  const length = 0.45;
  addLine({
    group: params.group,
    points: [
      centroid,
      {
        x: centroid.x + params.plane.normal.x * length,
        y: centroid.y + params.plane.normal.y * length,
        z: centroid.z + params.plane.normal.z * length,
      },
    ],
    slabTopMeters: params.slabTopMeters,
    color: params.color,
    trackGeometry: params.trackGeometry,
    trackMaterial: params.trackMaterial,
  });
}

function addLine(params: {
  group: THREE.Group;
  points: readonly RoofVec3[];
  slabTopMeters: number;
  color: number;
  trackGeometry: TrackGeometry;
  trackMaterial: TrackMaterial;
}) {
  const material = params.trackMaterial(
    new THREE.LineBasicMaterial({ color: params.color, transparent: true, opacity: 0.95 }),
  );
  const geometry = params.trackGeometry(
    new THREE.BufferGeometry().setFromPoints(
      params.points.map((point) => new THREE.Vector3(point.x, params.slabTopMeters + point.y, point.z)),
    ),
  );
  const line = new THREE.Line(geometry, material);
  line.userData.explicitHelperMarker = true;
  params.group.add(line);
}

function addPointCloud(params: {
  group: THREE.Group;
  points: readonly RoofVec3[];
  slabTopMeters: number;
  color: number;
  size: number;
  name: string;
  trackGeometry: TrackGeometry;
  trackMaterial: TrackMaterial;
}) {
  if (params.points.length === 0) return;
  const material = params.trackMaterial(
    new THREE.PointsMaterial({ color: params.color, size: params.size, sizeAttenuation: true }),
  );
  const geometry = params.trackGeometry(
    new THREE.BufferGeometry().setFromPoints(
      params.points.map((point) => new THREE.Vector3(point.x, params.slabTopMeters + point.y, point.z)),
    ),
  );
  const points = new THREE.Points(geometry, material);
  points.name = params.name;
  points.userData.explicitHelperMarker = true;
  params.group.add(points);
}
