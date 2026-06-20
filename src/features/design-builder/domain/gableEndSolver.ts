import type { GableCmuPlacement, GableEndSettings } from '../types';
import type { SegmentFrame } from '../geometry/designGeometry';
import { DEFAULT_ROOF_TO_MASONRY_CLEARANCE_METERS } from './structuralFrameDefaults';

export type GableGeometry = {
  halfSpanMeters: number;
  riseMeters: number;
  roofSlopeLengthMeters: number;
  roofSlopeRadians: number;
  peakElevationMeters: number;
  eaveElevationMeters: number;
  clearanceMeters: number;
};

export function resolvePeakElevationMeters(settings: GableEndSettings): number {
  if (settings.peakMode === 'absolute_elevation') {
    return settings.peakElevationMeters ?? settings.eaveElevationMeters;
  }
  return settings.eaveElevationMeters + (settings.peakRiseMeters ?? 0);
}

export function computeGableGeometry(params: {
  settings: GableEndSettings;
  wallClearSpanMeters: number;
}): GableGeometry {
  const halfSpanMeters = params.wallClearSpanMeters / 2;
  const eaveElevationMeters = params.settings.eaveElevationMeters;
  const peakElevationMeters = resolvePeakElevationMeters(params.settings);
  const riseMeters = Math.max(0, peakElevationMeters - eaveElevationMeters);
  const roofSlopeLengthMeters = Math.hypot(halfSpanMeters, riseMeters);
  const roofSlopeRadians = Math.atan2(riseMeters, halfSpanMeters);
  return {
    halfSpanMeters,
    riseMeters,
    roofSlopeLengthMeters,
    roofSlopeRadians,
    peakElevationMeters,
    eaveElevationMeters,
    clearanceMeters: params.settings.roofToMasonryClearanceMeters || DEFAULT_ROOF_TO_MASONRY_CLEARANCE_METERS,
  };
}

/** Masonry top elevation at horizontal station from left support (perpendicular roof clearance). */
export function gableMasonryTopAtStation(params: {
  geometry: GableGeometry;
  stationFromLeftMeters: number;
  panelWidthMeters: number;
}): number {
  const ridgeStation =
    params.geometry.halfSpanMeters +
    (params.panelWidthMeters / 2 - params.geometry.halfSpanMeters);
  const distFromRidge = Math.abs(params.stationFromLeftMeters - ridgeStation);
  const verticalDrop = distFromRidge * Math.tan(params.geometry.roofSlopeRadians);
  const perpendicularOffset =
    params.geometry.clearanceMeters / Math.cos(params.geometry.roofSlopeRadians);
  return params.geometry.peakElevationMeters - verticalDrop - perpendicularOffset;
}

export function solveGableEndPlacements(params: {
  settings: GableEndSettings;
  panelId: string;
  frame: SegmentFrame;
  panelStartStation: number;
  panelEndStation: number;
  bottomElevationMeters: number;
  moduleLengthMeters: number;
  moduleHeightMeters: number;
  blockDepthMeters: number;
}): GableCmuPlacement[] {
  const panelWidth = params.panelEndStation - params.panelStartStation;
  const geometry = computeGableGeometry({
    settings: params.settings,
    wallClearSpanMeters: panelWidth,
  });
  const bondPattern = params.settings.bondPattern ?? 'running_bond';
  const placements: GableCmuPlacement[] = [];
  const maxCourses = Math.ceil(
    (geometry.peakElevationMeters - params.bottomElevationMeters) / params.moduleHeightMeters,
  );

  for (let courseIndex = 0; courseIndex < maxCourses; courseIndex += 1) {
    const courseBaseY = params.bottomElevationMeters + courseIndex * params.moduleHeightMeters;
    const coursePhase = bondPattern === 'running_bond' ? courseIndex % 2 : 0;
    const jointOffset = coursePhase === 1 ? params.moduleLengthMeters / 2 : 0;
    let station = params.panelStartStation + jointOffset;
    let moduleIndex = 0;
    while (station < params.panelEndStation - 0.001) {
      const localStation = station - params.panelStartStation;
      const masonryTop = gableMasonryTopAtStation({
        geometry,
        stationFromLeftMeters: localStation,
        panelWidthMeters: panelWidth,
      });
      if (courseBaseY >= masonryTop - 0.001) break;
      const remaining = params.panelEndStation - station;
      let unitLength = params.moduleLengthMeters;
      let kind: GableCmuPlacement['kind'] = 'stretcher';
      const courseTop = courseBaseY + params.moduleHeightMeters;
      const clippedTop = Math.min(courseTop, masonryTop);
      const clippedHeight = clippedTop - courseBaseY;
      if (clippedHeight < params.moduleHeightMeters - 0.005) {
        if (clippedHeight < params.moduleHeightMeters / 2) {
          kind = 'cut_block';
        } else {
          kind = 'half_block';
        }
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
      const profile =
        kind === 'cut_block'
          ? [
              { x: 0, y: 0 },
              { x: unitLength, y: 0 },
              { x: unitLength, y: clippedHeight },
              { x: 0, y: clippedHeight },
            ]
          : undefined;
      placements.push({
        id: `${params.panelId}-gable-c${courseIndex}-m${moduleIndex}`,
        panelId: params.panelId,
        courseIndex,
        kind,
        polygonProfile: profile,
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
