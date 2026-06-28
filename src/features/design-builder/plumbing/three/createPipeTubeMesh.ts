import * as THREE from 'three';
import type { PlumbingRun } from '../plumbingTypes';
import type { ResolvedPlumbingRunPath } from './plumbingElevationResolver';
import {
  createCylinderBetween,
  diameterInchesToVisualRadiusMeters,
  markPlumbingObject3D,
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

  for (let index = 1; index < params.resolvedPath.points.length; index += 1) {
    const start = params.resolvedPath.points[index - 1];
    const end = params.resolvedPath.points[index];
    if (!start || !end) continue;
    const mesh = createCylinderBetween({
      name: `pipe segment ${index}`,
      start: vectorFromPoint(start),
      end: vectorFromPoint(end),
      radius,
      material,
      trackGeometry: params.trackGeometry,
      radialSegments: 12,
    });
    if (mesh) group.add(mesh);
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
