import type { GableCmuPlacement, RakedCapPlacement, ResolvedRoofSystem, RoofSystemSettings } from '../types';
import type { SegmentFrame } from '../geometry/designGeometry';
import { roofClearanceElevationAtStation } from './roofGableSolver';
import { ROOF_RENDER_EPSILON_METERS } from './roofSystemResolver';

function courseTopElevationMeters(params: {
  placements: GableCmuPlacement[];
  courseIndex: number;
}): number {
  return params.placements
    .filter((placement) => placement.courseIndex === params.courseIndex)
    .reduce((maxTop, placement) => Math.max(maxTop, placement.y + placement.heightMeters / 2), 0);
}

function courseStationSpan(params: {
  placements: GableCmuPlacement[];
  courseIndex: number;
  frame: SegmentFrame;
}): { startStationMeters: number; endStationMeters: number } | null {
  const coursePlacements = params.placements.filter((placement) => placement.courseIndex === params.courseIndex);
  if (coursePlacements.length === 0) return null;
  const stations = coursePlacements.map((placement) => {
    const relX = placement.x - params.frame.start.x - params.frame.inwardNormal.x * (placement.depthMeters / 2);
    const relZ = placement.z - params.frame.start.z - params.frame.inwardNormal.z * (placement.depthMeters / 2);
    const centerStation = relX * params.frame.tangent.x + relZ * params.frame.tangent.z;
    return {
      start: centerStation - placement.lengthMeters / 2,
      end: centerStation + placement.lengthMeters / 2,
    };
  });
  return {
    startStationMeters: Math.min(...stations.map((station) => station.start)),
    endStationMeters: Math.max(...stations.map((station) => station.end)),
  };
}

export function solveRakedCapPlacements(params: {
  gableEndSegmentId: string;
  panelId: string;
  frame: SegmentFrame;
  panelStartStation: number;
  panelEndStation: number;
  placements: GableCmuPlacement[];
  roofSystem: RoofSystemSettings;
  resolvedRoof: ResolvedRoofSystem;
  wallDepthMeters: number;
}): RakedCapPlacement[] {
  if (
    !params.roofSystem.gable.rakedConcreteCapEnabled ||
    params.roofSystem.roofType !== 'gable'
  ) {
    return [];
  }
  const capDepth = Math.max(0.05, params.roofSystem.gable.rakedConcreteCapDepthMeters);
  const courseIndices = [...new Set(params.placements.map((placement) => placement.courseIndex))].sort(
    (a, b) => a - b,
  );
  const caps: RakedCapPlacement[] = [];

  for (const courseIndex of courseIndices) {
    const baseElevationMeters = courseTopElevationMeters({
      placements: params.placements,
      courseIndex,
    });
    if (baseElevationMeters <= params.resolvedRoof.roofBeamTopElevationMeters + ROOF_RENDER_EPSILON_METERS) {
      continue;
    }
    const span = courseStationSpan({
      placements: params.placements,
      courseIndex,
      frame: params.frame,
    });
    if (!span) continue;
    const startStationMeters = Math.max(params.panelStartStation, span.startStationMeters);
    const endStationMeters = Math.min(params.panelEndStation, span.endStationMeters);
    const widthMeters = endStationMeters - startStationMeters;
    if (widthMeters <= 0.05) continue;

    const topLeftElevationMeters = roofClearanceElevationAtStation({
      resolvedRoof: params.resolvedRoof,
      frame: params.frame,
      stationMeters: startStationMeters,
      panelStartStation: params.panelStartStation,
      panelEndStation: params.panelEndStation,
      rakeClearanceMeters: params.roofSystem.gable.rakeClearanceMeters,
    });
    const topRightElevationMeters = roofClearanceElevationAtStation({
      resolvedRoof: params.resolvedRoof,
      frame: params.frame,
      stationMeters: endStationMeters,
      panelStartStation: params.panelStartStation,
      panelEndStation: params.panelEndStation,
      rakeClearanceMeters: params.roofSystem.gable.rakeClearanceMeters,
    });
    const leftHeight = topLeftElevationMeters - baseElevationMeters;
    const rightHeight = topRightElevationMeters - baseElevationMeters;
    const avgHeight = (leftHeight + rightHeight) / 2;
    if (avgHeight <= ROOF_RENDER_EPSILON_METERS) continue;

    caps.push({
      id: `${params.panelId}-rake-cap-c${courseIndex}`,
      gableEndSegmentId: params.gableEndSegmentId,
      courseIndex,
      startStationMeters,
      endStationMeters,
      baseElevationMeters,
      topLeftElevationMeters,
      topRightElevationMeters,
      wallDepthMeters: capDepth,
      concreteVolumeCubicMeters: widthMeters * capDepth * avgHeight,
      source: 'gable_raked_cap',
    });
  }

  return caps;
}

export function totalRakedCapVolumeCubicMeters(caps: readonly RakedCapPlacement[]): number {
  return caps.reduce((sum, cap) => sum + cap.concreteVolumeCubicMeters, 0);
}

export function totalGableCmuAreaSquareMeters(placements: readonly GableCmuPlacement[]): number {
  return placements.reduce(
    (sum, placement) => sum + placement.lengthMeters * placement.heightMeters,
    0,
  );
}
