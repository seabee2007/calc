import type { GableCmuPlacement, GableEndSettings, ResolvedGableEnd, ResolvedRoofSystem, RoofSystemSettings } from '../types';
import type { SegmentFrame } from '../geometry/designGeometry';
import { roofUndersideElevationAt } from './roofSystemResolver';

export const GABLE_HEIGHT_TOLERANCE_METERS = 0.002;

export function gableSettingsFromRoofSystem(params: {
  hostSegmentId: string;
  roofSystem: RoofSystemSettings;
  roofBeamTopElevationMeters: number;
  peakElevationMeters: number;
}): GableEndSettings {
  return {
    kind: 'gable_end',
    id: `gable-${params.hostSegmentId}`,
    hostWallSegmentId: params.hostSegmentId,
    eaveElevationMeters: params.roofBeamTopElevationMeters,
    peakMode: 'rise_above_eave',
    peakRiseMeters: params.peakElevationMeters - params.roofBeamTopElevationMeters,
    ridgePosition: 'centered',
    roofToMasonryClearanceMeters: params.roofSystem.gable.rakeClearanceMeters,
    roofClearanceMeasurement: 'perpendicular_to_roof_slope',
    bondPattern: 'running_bond',
  };
}

export function roofClearanceElevationAtStation(params: {
  resolvedRoof: ResolvedRoofSystem;
  frame: SegmentFrame;
  stationMeters: number;
  panelStartStation: number;
  panelEndStation: number;
  rakeClearanceMeters: number;
}): number {
  if (
    params.resolvedRoof.roofType === 'gable' &&
    params.resolvedRoof.gableEndSegmentIds.includes(params.frame.segmentId)
  ) {
    const thickness = params.resolvedRoof.roofAssemblyThicknessMeters;
    const centerStation = (params.panelStartStation + params.panelEndStation) / 2;
    const halfRun = Math.max(0.001, (params.panelEndStation - params.panelStartStation) / 2);
    const distFromCenter = Math.abs(params.stationMeters - centerStation);
    const eaveUnderside = params.resolvedRoof.roofBeamTopElevationMeters - thickness;
    const peakUnderside = params.resolvedRoof.peakElevationMeters - thickness;
    const rise = peakUnderside - eaveUnderside;
    const undersideAtStation = peakUnderside - (distFromCenter / halfRun) * rise;
    return undersideAtStation - params.rakeClearanceMeters;
  }
  const point = {
    x: params.frame.start.x + params.frame.tangent.x * params.stationMeters,
    z: params.frame.start.z + params.frame.tangent.z * params.stationMeters,
  };
  return (
    roofUndersideElevationAt({ resolved: params.resolvedRoof, x: point.x, z: point.z }) -
    params.rakeClearanceMeters
  );
}

export function solveRoofGableEndPlacements(params: {
  panelId: string;
  hostSegmentId: string;
  frame: SegmentFrame;
  panelStartStation: number;
  panelEndStation: number;
  roofBeamTopElevationMeters: number;
  roofSystem: RoofSystemSettings;
  resolvedRoof: ResolvedRoofSystem;
  moduleLengthMeters: number;
  moduleHeightMeters: number;
  blockDepthMeters: number;
}): GableCmuPlacement[] {
  if (!params.roofSystem.gable.enabled || params.roofSystem.roofType !== 'gable') {
    return [];
  }
  const bondPattern = 'running_bond';
  const placements: GableCmuPlacement[] = [];
  const bottomElevationMeters = params.roofBeamTopElevationMeters;
  const centerStation = (params.panelStartStation + params.panelEndStation) / 2;
  const maxPeakAtPanel = roofClearanceElevationAtStation({
    resolvedRoof: params.resolvedRoof,
    frame: params.frame,
    stationMeters: centerStation,
    panelStartStation: params.panelStartStation,
    panelEndStation: params.panelEndStation,
    rakeClearanceMeters: params.roofSystem.gable.rakeClearanceMeters,
  });
  const maxCourses = Math.max(
    0,
    Math.ceil((maxPeakAtPanel - bottomElevationMeters) / params.moduleHeightMeters),
  );

  for (let courseIndex = 0; courseIndex < maxCourses; courseIndex += 1) {
    const courseBaseY = bottomElevationMeters + courseIndex * params.moduleHeightMeters;
    const coursePhase = bondPattern === 'running_bond' ? courseIndex % 2 : 0;
    const jointOffset = coursePhase === 1 ? params.moduleLengthMeters / 2 : 0;
    let station = params.panelStartStation + jointOffset;
    let moduleIndex = 0;
    while (station < params.panelEndStation - 0.001) {
      const remaining = params.panelEndStation - station;
      let unitLength = params.moduleLengthMeters;
      let kind: GableCmuPlacement['kind'] = 'stretcher';
      const unitEndStation = Math.min(params.panelEndStation, station + unitLength);
      const allowedTopStart = roofClearanceElevationAtStation({
        resolvedRoof: params.resolvedRoof,
        frame: params.frame,
        stationMeters: station,
        panelStartStation: params.panelStartStation,
        panelEndStation: params.panelEndStation,
        rakeClearanceMeters: params.roofSystem.gable.rakeClearanceMeters,
      });
      const allowedTopEnd = roofClearanceElevationAtStation({
        resolvedRoof: params.resolvedRoof,
        frame: params.frame,
        stationMeters: unitEndStation,
        panelStartStation: params.panelStartStation,
        panelEndStation: params.panelEndStation,
        rakeClearanceMeters: params.roofSystem.gable.rakeClearanceMeters,
      });
      const allowedTopElevation = Math.min(allowedTopStart, allowedTopEnd);
      const proposedUnitTopElevation = courseBaseY + params.moduleHeightMeters;
      const unitFits =
        proposedUnitTopElevation <= allowedTopElevation + GABLE_HEIGHT_TOLERANCE_METERS;
      if (!unitFits) {
        station += Math.min(remaining, params.moduleLengthMeters / 2);
        continue;
      }
      if (courseBaseY >= allowedTopElevation - GABLE_HEIGHT_TOLERANCE_METERS) {
        break;
      }
      const courseTop = Math.min(proposedUnitTopElevation, allowedTopElevation);
      const clippedHeight = courseTop - courseBaseY;
      if (clippedHeight < params.moduleHeightMeters - 0.005) {
        kind = clippedHeight < params.moduleHeightMeters / 2 ? 'cut_block' : 'half_block';
      }
      if (remaining < params.moduleLengthMeters - 0.005) {
        if (remaining >= params.moduleLengthMeters / 2 - 0.005) {
          unitLength = params.moduleLengthMeters / 2;
          kind = kind === 'stretcher' ? 'half_block' : kind;
        } else if (remaining >= 0.08) {
          unitLength = remaining;
          kind = 'cut_block';
        } else {
          break;
        }
      }
      const centerStation = station + unitLength / 2;
      const x =
        params.frame.start.x +
        params.frame.tangent.x * centerStation +
        params.frame.inwardNormal.x * (params.blockDepthMeters / 2);
      const z =
        params.frame.start.z +
        params.frame.tangent.z * centerStation +
        params.frame.inwardNormal.z * (params.blockDepthMeters / 2);
      const y = courseBaseY + clippedHeight / 2;
      placements.push({
        id: `${params.panelId}-gable-c${courseIndex}-m${moduleIndex}`,
        panelId: params.panelId,
        courseIndex,
        kind,
        volumeCubicMeters: unitLength * clippedHeight * params.blockDepthMeters,
        x,
        y,
        z,
        rotationY: params.frame.rotationY,
        lengthMeters: unitLength,
        heightMeters: clippedHeight,
        depthMeters: params.blockDepthMeters,
        source: 'gable_panel_solver',
      });
      station += unitLength;
      moduleIndex += 1;
    }
  }
  return placements;
}

export function buildResolvedGableEnd(params: {
  hostSegmentId: string;
  frame: SegmentFrame;
  panelStartStation: number;
  panelEndStation: number;
  roofSystem: RoofSystemSettings;
  resolvedRoof: ResolvedRoofSystem;
  placements: GableCmuPlacement[];
  rakedCapPlacements: import('../types').RakedCapPlacement[];
}): ResolvedGableEnd {
  const courses = new Map<number, { top: number; start: number; end: number }>();
  for (const placement of params.placements) {
    const top = placement.y + placement.heightMeters / 2;
    const start = placement.x;
    const end = placement.x;
    const existing = courses.get(placement.courseIndex);
    if (!existing) {
      courses.set(placement.courseIndex, { top, start, end });
    } else {
      existing.top = Math.max(existing.top, top);
    }
  }
  return {
    hostSegmentId: params.hostSegmentId,
    masonryCourses: [...courses.entries()].map(([courseIndex, course]) => ({
      courseIndex,
      topElevationMeters: course.top,
      startStationMeters: params.panelStartStation,
      endStationMeters: params.panelEndStation,
    })),
    rakedCapPlacements: params.rakedCapPlacements,
    cmuUnitPlacements: params.placements,
    warnings: [],
  };
}
