import * as THREE from 'three';
import type { PlumbingFixtureRoughInAssembly, PlumbingRun } from '../plumbingTypes';
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

export function createPlumbingRiserMesh(params: {
  roughIn: PlumbingFixtureRoughInAssembly;
  run: PlumbingRun;
  resolvedPath: ResolvedPlumbingRunPath;
  materials: PlumbingThreeMaterials;
  selected?: boolean;
  trackGeometry?: TrackGeometry;
  showCenterline?: boolean;
  finishedFloorY?: number;
  fittingCenters?: THREE.Vector3[];
}): THREE.Group {
  const group = new THREE.Group();
  group.name = `plumbing_rough_in:${params.roughIn.id}`;
  const material = params.selected
    ? params.materials.selected
    : params.resolvedPath.validationIssues.length > 0
      ? params.materials.warning
      : materialForPlumbingRunSystem(params.run.system, params.materials);
  const radius = diameterInchesToVisualRadiusMeters(params.run.diameterInches);
  const visualPoints = params.resolvedPath.points.map((point) => ({ ...point }));
  const last = visualPoints[visualPoints.length - 1];
  if (
    last &&
    params.run.elevationMode === 'vertical' &&
    Number.isFinite(params.finishedFloorY) &&
    last.y < params.finishedFloorY!
  ) {
    group.userData.riserVisualTopExtension = {
      fromY: last.y,
      toY: params.finishedFloorY,
    };
    last.y = params.finishedFloorY!;
  }
  const visibleSegmentPoints = trimRunPathForFittings(
    visualPoints.map(vectorFromPoint),
    [],
    fittingSocketLengthMeters(params.run.diameterInches),
    params.fittingCenters ?? [],
  );
  for (let index = 1; index < visibleSegmentPoints.length; index += 2) {
    const previous = visibleSegmentPoints[index - 1];
    const current = visibleSegmentPoints[index];
    if (!previous || !current) continue;
    const segment = createCylinderBetween({
      name: `riser pipe segment ${(index + 1) / 2}`,
      start: previous,
      end: current,
      radius,
      material,
      trackGeometry: params.trackGeometry,
      radialSegments: 14,
    });
    if (segment) group.add(segment);
  }
  if (params.showCenterline && visualPoints.length > 1) {
    const geometry = params.trackGeometry?.(
      new THREE.BufferGeometry().setFromPoints(visualPoints.map(vectorFromPoint)),
    ) ?? new THREE.BufferGeometry().setFromPoints(visualPoints.map(vectorFromPoint));
    const centerline = new THREE.Line(geometry, params.materials.centerline);
    centerline.name = 'riser centerline';
    group.add(centerline);
  }
  markPlumbingObject3D({
    group,
    objectType: 'plumbing_rough_in',
    objectId: params.roughIn.id,
    selectionPriority: 84,
  });
  return group;
}
