import * as THREE from 'three';
import type { PlumbingRun } from '../plumbingTypes';
import type { ResolvedPlumbingRunPath } from './plumbingElevationResolver';
import {
  createCylinderBetween,
  diameterInchesToVisualRadiusMeters,
  fittingSocketLengthMeters,
  markPlumbingObject3D,
  trimRunPathForFittings,
  vectorFromPoint,
  type TrackGeometry,
} from './plumbingThreeUtils';
import {
  materialForPlumbingRunSystem,
  type PlumbingThreeMaterials,
} from './plumbingThreeMaterials';

export function createPipeTubeMesh(params: {
  run: PlumbingRun;
  resolvedPath: ResolvedPlumbingRunPath;
  materials: PlumbingThreeMaterials;
  selected?: boolean;
  trackGeometry?: TrackGeometry;
  fittingCenters?: THREE.Vector3[];
  penetrationTargets?: THREE.Vector3[];
  showCenterline?: boolean;
}): THREE.Group {
  const group = new THREE.Group();
  group.name = `plumbing_run:${params.run.id}`;
  group.userData.system = params.run.system;
  group.userData.elevationMode = params.run.elevationMode;

  const radius = diameterInchesToVisualRadiusMeters(params.run.diameterInches);
  const material = params.selected
    ? params.materials.selected
    : params.resolvedPath.validationIssues.length > 0
      ? params.materials.warning
      : materialForPlumbingRunSystem(params.run.system, params.materials);

  const centerlinePoints = params.resolvedPath.points.map(vectorFromPoint);
  const visibleSegmentPoints = trimRunPathForFittings(
    centerlinePoints,
    [],
    fittingSocketLengthMeters(params.run.diameterInches),
    params.fittingCenters ?? [],
  );
  const pipePenetration = radius * 0.7;

  function shouldPenetrate(point: THREE.Vector3): boolean {
    return (params.penetrationTargets ?? []).some((target) => target.distanceTo(point) <= Math.max(radius * 1.5, 0.055));
  }

  for (let index = 1; index < visibleSegmentPoints.length; index += 2) {
    const start = visibleSegmentPoints[index - 1]?.clone();
    const end = visibleSegmentPoints[index]?.clone();
    if (!start || !end) continue;
    const direction = end.clone().sub(start);
    if (direction.lengthSq() > 0.000001) {
      direction.normalize();
      if (shouldPenetrate(start)) start.addScaledVector(direction, -pipePenetration);
      if (shouldPenetrate(end)) end.addScaledVector(direction, pipePenetration);
    }
    const mesh = createCylinderBetween({
      name: `pipe segment ${(index + 1) / 2}`,
      start,
      end,
      radius,
      material,
      trackGeometry: params.trackGeometry,
      radialSegments: 12,
    });
    if (mesh) group.add(mesh);
  }

  if (params.showCenterline && centerlinePoints.length > 1) {
    const geometry = params.trackGeometry?.(
      new THREE.BufferGeometry().setFromPoints(centerlinePoints),
    ) ?? new THREE.BufferGeometry().setFromPoints(centerlinePoints);
    const centerline = new THREE.Line(geometry, params.materials.centerline);
    centerline.name = 'plumbing run centerline';
    group.add(centerline);
  }

  if (group.children.length === 0) {
    const point = params.resolvedPath.points[0] ?? { x: 0, y: 0, z: 0 };
    const geometry = params.trackGeometry?.(new THREE.SphereGeometry(radius * 1.4, 12, 8)) ??
      new THREE.SphereGeometry(radius * 1.4, 12, 8);
    const marker = new THREE.Mesh(geometry, params.materials.warning);
    marker.name = 'invalid pipe marker';
    marker.position.set(point.x, point.y, point.z);
    group.add(marker);
  }

  return markPlumbingObject3D({
    group,
    objectType: 'plumbing_run',
    objectId: params.run.id,
    selectionPriority: 74,
  }) as THREE.Group;
}
