import type {
  GableEndSettings,
  PurlinPlacement,
  ResolvedGableEnd,
  ResolvedRoofSystem,
  RoofPlane,
  RoofSystemSettings,
  RoofVec3,
} from '../types';
import type { CmuBlockInstance, SegmentFrame } from '../geometry/designGeometry';
import {
  buildPurlinRowStationFractions,
  insetPointBelowRoofSurface,
  normalizeOutwardRoofNormal,
  offsetPointAlongRoofNormal,
  PURLIN_BOTTOM_INSET_FROM_ROOF_TOP_METERS,
  PURLIN_PROFILE_DEPTH_METERS,
  resolvePurlinRowStationFractionAtPoint,
  resolveTrussSeatedPurlinBottomYOnPlane,
} from './roofFramingResolver';
import {
  resolveRoofTopPlaneAtPoint,
  roofCladdingTopYAtPoint,
  roofCladdingUndersideYAtPoint,
} from './roofSystemResolver';

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

export function resolveGablePanelRoofSlopeRadians(params: {
  resolvedRoof: ResolvedRoofSystem;
  panelStartStation: number;
  panelEndStation: number;
}): number {
  const thickness = params.resolvedRoof.roofAssemblyThicknessMeters;
  const eaveTop = params.resolvedRoof.roofBeamTopElevationMeters;
  const peakTop = params.resolvedRoof.peakElevationMeters;
  const halfRun = Math.max(0.001, (params.panelEndStation - params.panelStartStation) / 2);
  const rise = peakTop - thickness - (eaveTop - thickness);
  return Math.atan2(rise, halfRun);
}

function resolvePurlinBottomYFromPlacementRow(params: {
  purlinPlacements: readonly PurlinPlacement[];
  slopePlaneId: string;
  rowIndex: number;
  x: number;
  z: number;
}): number | null {
  const purlin = params.purlinPlacements.find(
    (placement) =>
      placement.slopePlaneId === params.slopePlaneId && placement.rowIndex === params.rowIndex,
  );
  if (!purlin) {
    return null;
  }
  const dx = purlin.end.x - purlin.start.x;
  const dz = purlin.end.z - purlin.start.z;
  const lenSq = dx * dx + dz * dz || 1;
  const t = Math.max(
    0,
    Math.min(1, ((params.x - purlin.start.x) * dx + (params.z - purlin.start.z) * dz) / lenSq),
  );
  const center = {
    x: purlin.start.x + dx * t,
    y: purlin.start.y + (purlin.end.y - purlin.start.y) * t,
    z: purlin.start.z + dz * t,
  };
  const normal = normalizeOutwardRoofNormal(purlin.planeNormal);
  return offsetPointAlongRoofNormal(center, normal, -PURLIN_PROFILE_DEPTH_METERS / 2).y;
}

function resolveInterpolatedPurlinBottomYAtRowT(params: {
  rowT: number;
  rowTs: readonly number[];
  purlinPlacements: readonly PurlinPlacement[];
  slopePlaneId: string;
  x: number;
  z: number;
  plane: RoofPlane;
  trussPlacements: ResolvedRoofSystem['trussPlacements'];
  claddingRidgeStart: RoofVec3;
  claddingRidgeEnd: RoofVec3;
}): number | null {
  if (params.rowTs.length === 0) {
    return null;
  }
  const clampedT = Math.max(0, Math.min(1, params.rowT));
  const bottomAtRowIndex = (rowIndex: number): number | null => {
    const placementBottom = resolvePurlinBottomYFromPlacementRow({
      purlinPlacements: params.purlinPlacements,
      slopePlaneId: params.slopePlaneId,
      rowIndex,
      x: params.x,
      z: params.z,
    });
    if (placementBottom != null) {
      return placementBottom;
    }
    const rowTAtIndex = params.rowTs[rowIndex];
    if (rowTAtIndex == null) {
      return null;
    }
    return resolveTrussSeatedPurlinBottomYOnPlane({
      plane: params.plane,
      trussPlacements: params.trussPlacements,
      claddingRidgeStart: params.claddingRidgeStart,
      claddingRidgeEnd: params.claddingRidgeEnd,
      x: params.x,
      z: params.z,
      rowT: rowTAtIndex,
    });
  };

  if (clampedT <= params.rowTs[0]! + 1e-9) {
    return bottomAtRowIndex(0);
  }
  const lastIndex = params.rowTs.length - 1;
  if (clampedT >= params.rowTs[lastIndex]! - 1e-9) {
    return bottomAtRowIndex(lastIndex);
  }

  for (let index = 0; index < lastIndex; index += 1) {
    const t0 = params.rowTs[index]!;
    const t1 = params.rowTs[index + 1]!;
    if (clampedT < t0 - 1e-9 || clampedT > t1 + 1e-9) {
      continue;
    }
    const y0 = bottomAtRowIndex(index);
    const y1 = bottomAtRowIndex(index + 1);
    if (y0 == null && y1 == null) {
      return null;
    }
    if (y0 == null) {
      return y1;
    }
    if (y1 == null) {
      return y0;
    }
    if (t1 - t0 <= 1e-9) {
      return y1;
    }
    const blend = (clampedT - t0) / (t1 - t0);
    return y0 + (y1 - y0) * blend;
  }

  return bottomAtRowIndex(lastIndex);
}

function stationWorldPoint(params: {
  frame: SegmentFrame;
  stationMeters: number;
}): { x: number; z: number } {
  return {
    x: params.frame.centerlineStart.x + params.frame.tangent.x * params.stationMeters,
    z: params.frame.centerlineStart.z + params.frame.tangent.z * params.stationMeters,
  };
}

export function purlinBottomYAtPoint(params: {
  resolved: ResolvedRoofSystem;
  x: number;
  z: number;
}): number {
  const claddingRidgeStart = params.resolved.claddingRidgeStart;
  const claddingRidgeEnd = params.resolved.claddingRidgeEnd;
  if (
    params.resolved.trussPlacements.length > 0 &&
    claddingRidgeStart &&
    claddingRidgeEnd
  ) {
    const plane = resolveRoofTopPlaneAtPoint(params);
    if (plane) {
      const trussSeatedBottomY = resolveTrussSeatedPurlinBottomYOnPlane({
        plane,
        trussPlacements: params.resolved.trussPlacements,
        claddingRidgeStart,
        claddingRidgeEnd,
        x: params.x,
        z: params.z,
      });
      if (trussSeatedBottomY != null) {
        return trussSeatedBottomY;
      }
    }
  }

  const topY = roofCladdingTopYAtPoint(params);
  const plane = resolveRoofTopPlaneAtPoint(params);
  if (!plane) {
    return topY - PURLIN_BOTTOM_INSET_FROM_ROOF_TOP_METERS;
  }
  const normal = normalizeOutwardRoofNormal(plane.normal);
  return insetPointBelowRoofSurface(
    { x: params.x, y: topY, z: params.z },
    normal,
    PURLIN_BOTTOM_INSET_FROM_ROOF_TOP_METERS,
  ).y;
}

export function purlinBottomYAtStation(params: {
  resolvedRoof: ResolvedRoofSystem;
  frame: SegmentFrame;
  stationMeters: number;
  panelStartStation: number;
  panelEndStation: number;
  roofSystem?: RoofSystemSettings;
}): number {
  const point = stationWorldPoint(params);
  const claddingRidgeStart = params.resolvedRoof.claddingRidgeStart;
  const claddingRidgeEnd = params.resolvedRoof.claddingRidgeEnd;
  if (
    params.resolvedRoof.purlinPlacements.length > 0 &&
    claddingRidgeStart &&
    claddingRidgeEnd
  ) {
    const plane = resolveRoofTopPlaneAtPoint({
      resolved: params.resolvedRoof,
      x: point.x,
      z: point.z,
    });
    if (plane) {
      const slopeRowT = resolvePurlinRowStationFractionAtPoint({
        plane,
        claddingRidgeStart,
        claddingRidgeEnd,
        x: point.x,
        z: point.z,
      });
      const maxPurlinSpacingMeters =
        params.roofSystem?.purlins.maxSpacingMeters ??
        params.resolvedRoof.actualPurlinSpacingMeters;
      const { rowTs } = buildPurlinRowStationFractions({
        slopeLengthMeters: params.resolvedRoof.claddingRafterLengthMeters,
        structuralHalfRunMeters: params.resolvedRoof.structuralRafterRunMeters,
        sideEaveOverhangMeters:
          params.roofSystem?.eaveOverhangMeters ??
          Math.max(
            0,
            params.resolvedRoof.claddingRafterRunMeters -
              params.resolvedRoof.structuralRafterRunMeters,
          ),
        maxPurlinSpacingMeters,
      });
      if (slopeRowT != null) {
        const interpolatedBottomY = resolveInterpolatedPurlinBottomYAtRowT({
          rowT: slopeRowT,
          rowTs,
          purlinPlacements: params.resolvedRoof.purlinPlacements,
          slopePlaneId: plane.id,
          x: point.x,
          z: point.z,
          plane,
          trussPlacements: params.resolvedRoof.trussPlacements,
          claddingRidgeStart,
          claddingRidgeEnd,
        });
        if (interpolatedBottomY != null) {
          return interpolatedBottomY;
        }
      }
      const trussSeatedBottomY = resolveTrussSeatedPurlinBottomYOnPlane({
        plane,
        trussPlacements: params.resolvedRoof.trussPlacements,
        claddingRidgeStart,
        claddingRidgeEnd,
        x: point.x,
        z: point.z,
      });
      if (trussSeatedBottomY != null) {
        return trussSeatedBottomY;
      }
    }
  }
  return purlinBottomYAtPoint({
    resolved: params.resolvedRoof,
    x: point.x,
    z: point.z,
  });
}

function purlinsEnabledForCap(params: {
  resolvedRoof: ResolvedRoofSystem;
  roofSystem?: RoofSystemSettings;
}): boolean {
  if (params.roofSystem) {
    return params.roofSystem.purlins.enabled;
  }
  return params.resolvedRoof.purlinPlacements.length > 0;
}

export function roofCladdingTopYAtStation(params: {
  resolvedRoof: ResolvedRoofSystem;
  frame: SegmentFrame;
  stationMeters: number;
  panelStartStation: number;
  panelEndStation: number;
}): number {
  const point = stationWorldPoint(params);
  return roofCladdingTopYAtPoint({
    resolved: params.resolvedRoof,
    x: point.x,
    z: point.z,
  });
}

export function roofCladdingUndersideYAtStation(params: {
  resolvedRoof: ResolvedRoofSystem;
  frame: SegmentFrame;
  stationMeters: number;
  panelStartStation: number;
  panelEndStation: number;
}): number {
  const point = stationWorldPoint(params);
  return roofCladdingUndersideYAtPoint({
    resolved: params.resolvedRoof,
    x: point.x,
    z: point.z,
  });
}

/** Cladding underside sampled from resolved roof planes. */
export function roofUndersideYAtStation(params: {
  resolvedRoof: ResolvedRoofSystem;
  frame: SegmentFrame;
  stationMeters: number;
  panelStartStation: number;
  panelEndStation: number;
}): number {
  return roofCladdingUndersideYAtStation(params);
}

export function allowedMasonryTopYAtStation(params: {
  resolvedRoof: ResolvedRoofSystem;
  frame: SegmentFrame;
  stationMeters: number;
  panelStartStation: number;
  panelEndStation: number;
  minRakeCapDepthMeters: number;
  roofSystem?: RoofSystemSettings;
}): number {
  const capBearingY = rakedCapTopYAtStation({
    resolvedRoof: params.resolvedRoof,
    roofSystem: params.roofSystem,
    frame: params.frame,
    stationMeters: params.stationMeters,
    panelStartStation: params.panelStartStation,
    panelEndStation: params.panelEndStation,
  });
  const slopeRadians = resolveGablePanelRoofSlopeRadians({
    resolvedRoof: params.resolvedRoof,
    panelStartStation: params.panelStartStation,
    panelEndStation: params.panelEndStation,
  });
  const verticalClearance = params.minRakeCapDepthMeters / Math.max(0.05, Math.cos(slopeRadians));
  return capBearingY - verticalClearance;
}

/** @deprecated Use allowedMasonryTopYAtStation — kept for existing tests. */
export function roofClearanceElevationAtStation(params: {
  resolvedRoof: ResolvedRoofSystem;
  frame: SegmentFrame;
  stationMeters: number;
  panelStartStation: number;
  panelEndStation: number;
  rakeClearanceMeters: number;
}): number {
  return allowedMasonryTopYAtStation({
    resolvedRoof: params.resolvedRoof,
    frame: params.frame,
    stationMeters: params.stationMeters,
    panelStartStation: params.panelStartStation,
    panelEndStation: params.panelEndStation,
    minRakeCapDepthMeters: params.rakeClearanceMeters,
  });
}

export function rakedCapTopYAtStation(params: {
  resolvedRoof: ResolvedRoofSystem;
  frame: SegmentFrame;
  stationMeters: number;
  panelStartStation: number;
  panelEndStation: number;
  roofSystem?: RoofSystemSettings;
}): number {
  if (purlinsEnabledForCap({ resolvedRoof: params.resolvedRoof, roofSystem: params.roofSystem })) {
    return purlinBottomYAtStation(params);
  }
  return roofCladdingUndersideYAtStation(params);
}

/** Top of raked concrete cap — flush with purlin bottom when purlins are enabled. */
export function capTopYAtStation(params: {
  resolvedRoof: ResolvedRoofSystem;
  frame: SegmentFrame;
  stationMeters: number;
  panelStartStation: number;
  panelEndStation: number;
  roofSystem?: RoofSystemSettings;
}): number {
  return rakedCapTopYAtStation(params);
}

export function buildResolvedGableEnd(params: {
  hostSegmentId: string;
  panelStartStation: number;
  panelEndStation: number;
  blocks: CmuBlockInstance[];
  rakedCapPlacements: import('../types').RakedCapPlacement[];
  warnings?: ResolvedGableEnd['warnings'];
}): ResolvedGableEnd {
  const courses = new Map<number, number>();
  for (const block of params.blocks) {
    const courseIndex = block.courseIndex ?? 0;
    const blockHeight = block.physicalHeightMeters ?? block.heightMeters ?? 0;
    const top = block.y + blockHeight / 2;
    courses.set(courseIndex, Math.max(courses.get(courseIndex) ?? -Infinity, top));
  }
  return {
    hostSegmentId: params.hostSegmentId,
    masonryCourses: [...courses.entries()]
      .sort(([a], [b]) => a - b)
      .map(([courseIndex, topElevationMeters]) => ({
        courseIndex,
        topElevationMeters,
        startStationMeters: params.panelStartStation,
        endStationMeters: params.panelEndStation,
      })),
    rakedCapPlacements: params.rakedCapPlacements,
    cmuUnitPlacements: params.blocks,
    warnings: params.warnings ?? [],
  };
}
