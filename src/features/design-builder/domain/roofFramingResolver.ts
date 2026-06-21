import {
  footprintBounds,
  intersectRayWithSegment2D,
  midpoint2,
  type PlanVec2,
  type RectangularFootprintAnalysis,
  type RidgeAxis,
} from './roofFootprintSupport';
import type {
  ExteriorRoofBeamBounds,
  HipFramingMember,
  PurlinPlacement,
  ResolvedRoofSystem,
  RidgeCapPlacement,
  RoofPlane,
  RoofSystemSettings,
  RoofVec3,
  SteelMemberSegment,
  TrussPlacement,
} from '../types';

export const ROOF_SHEET_CLEARANCE_METERS = 0.005;
export const ROOF_RIDGE_CAP_CLEARANCE_METERS = 0.005;
export const DEFAULT_RIDGE_CAP_WIDTH_METERS = 0.3;
export const DEFAULT_RIDGE_CAP_THICKNESS_METERS = 0.02;
export const TRUSS_CHORD_PROFILE_METERS = 0.04;
export const PURLIN_PROFILE_WIDTH_METERS = 0.05;
export const PURLIN_PROFILE_DEPTH_METERS = 0.08;
const TRUSS_VALIDATION_TOLERANCE_METERS = 0.002;

function vec3(x: number, y: number, z: number): RoofVec3 {
  return { x, y, z };
}

function sub3(a: RoofVec3, b: RoofVec3): RoofVec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function length3(v: RoofVec3): number {
  return Math.hypot(v.x, v.y, v.z);
}

function normalize3(v: RoofVec3): RoofVec3 {
  const len = length3(v) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function dot3(a: RoofVec3, b: RoofVec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross3(a: RoofVec3, b: RoofVec3): RoofVec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function lerpVec3(a: RoofVec3, b: RoofVec3, t: number): RoofVec3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

function lerp2(a: PlanVec2, b: PlanVec2, t: number): PlanVec2 {
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
}

function toVec3(point: PlanVec2, y: number): RoofVec3 {
  return vec3(point.x, y, point.z);
}

function distancePointToTrussPlane(point: RoofVec3, planePoint: RoofVec3, planeNormal: RoofVec3): number {
  const dx = point.x - planePoint.x;
  const dy = point.y - planePoint.y;
  const dz = point.z - planePoint.z;
  return Math.abs(dx * planeNormal.x + dy * planeNormal.y + dz * planeNormal.z);
}

function ridgeAxisWorld(ridgeStart: RoofVec3, ridgeEnd: RoofVec3): 'x' | 'z' {
  const dx = Math.abs(ridgeEnd.x - ridgeStart.x);
  const dz = Math.abs(ridgeEnd.z - ridgeStart.z);
  return dx >= dz ? 'x' : 'z';
}

function buildTrussPlaneNormal(left: RoofVec3, right: RoofVec3, apex: RoofVec3): RoofVec3 {
  const alongBottom = sub3(right, left);
  const upLeg = sub3(apex, left);
  const normal = cross3(alongBottom, upLeg);
  const len = length3(normal);
  if (len <= 1e-9) {
    return vec3(0, 0, 1);
  }
  return normalize3(normal);
}

function buildFinkWebMembers(
  trussId: string,
  leftBearing: RoofVec3,
  rightBearing: RoofVec3,
  apex: RoofVec3,
): SteelMemberSegment[] {
  const lowerCenter = lerpVec3(leftBearing, rightBearing, 0.5);
  const lowerLeft = lerpVec3(leftBearing, rightBearing, 0.25);
  const lowerRight = lerpVec3(leftBearing, rightBearing, 0.75);
  return [
    {
      id: `${trussId}-web-left`,
      memberKind: 'diagonal_web',
      start: lowerLeft,
      end: apex,
    },
    {
      id: `${trussId}-web-center`,
      memberKind: 'vertical_web',
      start: lowerCenter,
      end: apex,
    },
    {
      id: `${trussId}-web-right`,
      memberKind: 'diagonal_web',
      start: lowerRight,
      end: apex,
    },
  ];
}

function buildPrimaryTrussMembers(
  trussId: string,
  leftBearing: RoofVec3,
  rightBearing: RoofVec3,
  apex: RoofVec3,
): SteelMemberSegment[] {
  return [
    {
      id: `${trussId}-top-left`,
      memberKind: 'top_chord_left',
      start: leftBearing,
      end: apex,
    },
    {
      id: `${trussId}-top-right`,
      memberKind: 'top_chord_right',
      start: rightBearing,
      end: apex,
    },
    {
      id: `${trussId}-bottom`,
      memberKind: 'bottom_chord',
      start: leftBearing,
      end: rightBearing,
    },
    ...buildFinkWebMembers(trussId, leftBearing, rightBearing, apex),
  ];
}

export function validateTrussPlacement(
  placement: TrussPlacement,
  roofBeamTopY: number,
): void {
  const planePoint = placement.bearingLeft;
  const planeNormal = placement.planeNormal;
  for (const member of placement.members) {
    const memberBottomY = Math.min(member.start.y, member.end.y);
    if (memberBottomY < roofBeamTopY - TRUSS_VALIDATION_TOLERANCE_METERS) {
      throw new Error('Roof truss member extends below Roof Beam elevation');
    }
    if (
      distancePointToTrussPlane(member.start, planePoint, planeNormal) > TRUSS_VALIDATION_TOLERANCE_METERS ||
      distancePointToTrussPlane(member.end, planePoint, planeNormal) > TRUSS_VALIDATION_TOLERANCE_METERS
    ) {
      throw new Error('Truss member is outside its assigned truss plane');
    }
  }
}

export function resolveEvenStations(lengthMeters: number, maxSpacingMeters: number): {
  count: number;
  actualSpacingMeters: number;
  stations: number[];
} {
  const count = Math.max(2, Math.ceil(lengthMeters / Math.max(0.001, maxSpacingMeters)) + 1);
  const actualSpacingMeters = lengthMeters / (count - 1);
  const stations = Array.from({ length: count }, (_, index) => index * actualSpacingMeters);
  return { count, actualSpacingMeters, stations };
}

export function buildExteriorRoofBeamBounds(
  structuralBearingPerimeter: readonly PlanVec2[],
  roofBeamTopY: number,
  analysis?: RectangularFootprintAnalysis,
): ExteriorRoofBeamBounds {
  const footprint = structuralBearingPerimeter.map((point) => vec3(point.x, roofBeamTopY, point.z));
  const bounds = footprintBounds(structuralBearingPerimeter);
  return {
    footprint,
    center: vec3(bounds.centerX, roofBeamTopY, bounds.centerZ),
    widthMeters: analysis?.localXSpanMeters ?? bounds.maxX - bounds.minX,
    depthMeters: analysis?.localZSpanMeters ?? bounds.maxZ - bounds.minZ,
  };
}

function spanEdgesPerpendicularToRidge(
  bearing: readonly PlanVec2[],
  ridgeStart: PlanVec2,
  ridgeEnd: PlanVec2,
): [PlanVec2, PlanVec2, PlanVec2, PlanVec2] {
  const ridgeDir = {
    x: ridgeEnd.x - ridgeStart.x,
    z: ridgeEnd.z - ridgeStart.z,
  };
  const perp = { x: -ridgeDir.z, z: ridgeDir.x };
  const perpLen = Math.hypot(perp.x, perp.z) || 1;
  const perpUnit = { x: perp.x / perpLen, z: perp.z / perpLen };

  let bestIndex = 0;
  let bestScore = -Infinity;
  for (let index = 0; index < 4; index += 1) {
    const edgeMid = midpoint2(bearing[index]!, bearing[(index + 1) % 4]!);
    const score = Math.abs((edgeMid.x - ridgeStart.x) * perpUnit.x + (edgeMid.z - ridgeStart.z) * perpUnit.z);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  const oppositeIndex = (bestIndex + 2) % 4;
  return [
    bearing[bestIndex]!,
    bearing[(bestIndex + 1) % 4]!,
    bearing[oppositeIndex]!,
    bearing[(oppositeIndex + 1) % 4]!,
  ];
}

function resolveGableTrussPlacements(params: {
  bearing: readonly PlanVec2[];
  ridgeStart: RoofVec3;
  ridgeEnd: RoofVec3;
  peakY: number;
  roofBeamTopY: number;
  basePlateThicknessMeters: number;
  stations: number[];
}): TrussPlacement[] {
  const { bearing, ridgeStart, ridgeEnd, peakY, roofBeamTopY, basePlateThicknessMeters, stations } = params;
  const bearingY = roofBeamTopY + basePlateThicknessMeters;
  const ridgeStart2 = { x: ridgeStart.x, z: ridgeStart.z };
  const ridgeEnd2 = { x: ridgeEnd.x, z: ridgeEnd.z };
  const ridgeLength = Math.hypot(ridgeEnd2.x - ridgeStart2.x, ridgeEnd2.z - ridgeStart2.z) || 1;
  const ridgeDir = {
    x: (ridgeEnd2.x - ridgeStart2.x) / ridgeLength,
    z: (ridgeEnd2.z - ridgeStart2.z) / ridgeLength,
  };
  const perp = { x: -ridgeDir.z, z: ridgeDir.x };
  const worldRidgeAxis = ridgeAxisWorld(ridgeStart, ridgeEnd);

  const [edgeAStart, edgeAEnd, edgeBStart, edgeBEnd] = spanEdgesPerpendicularToRidge(
    bearing,
    ridgeStart2,
    ridgeEnd2,
  );

  return stations.map((station, index) => {
    const t = ridgeLength <= 0.001 ? 0 : station / ridgeLength;
    const ridgePoint2 = lerp2(ridgeStart2, ridgeEnd2, t);
    const bearingLeft2 =
      intersectRayWithSegment2D(ridgePoint2, perp, edgeAStart, edgeAEnd) ??
      intersectRayWithSegment2D(ridgePoint2, { x: -perp.x, z: -perp.z }, edgeAStart, edgeAEnd) ??
      ridgePoint2;
    const bearingRight2 =
      intersectRayWithSegment2D(ridgePoint2, { x: -perp.x, z: -perp.z }, edgeBStart, edgeBEnd) ??
      intersectRayWithSegment2D(ridgePoint2, perp, edgeBStart, edgeBEnd) ??
      ridgePoint2;

    const bearingLeft = toVec3(bearingLeft2, bearingY);
    const bearingRight = toVec3(bearingRight2, bearingY);
    const apex = vec3(ridgePoint2.x, peakY, ridgePoint2.z);
    const trussId = `truss-${index}`;
    const planeNormal = buildTrussPlaneNormal(bearingLeft, bearingRight, apex);
    const members = buildPrimaryTrussMembers(trussId, bearingLeft, bearingRight, apex);
    const placement: TrussPlacement = {
      id: trussId,
      stationMeters: station,
      bearingLeft,
      bearingRight,
      apex,
      ridgeAxis: worldRidgeAxis,
      planeNormal,
      members,
    };
    validateTrussPlacement(placement, roofBeamTopY);
    return placement;
  });
}

function eaveCornersForPlane(plane: RoofPlane): RoofVec3[] {
  const minY = Math.min(...plane.corners.map((corner) => corner.y));
  return plane.corners.filter((corner) => Math.abs(corner.y - minY) < TRUSS_VALIDATION_TOLERANCE_METERS);
}

function pairEaveCornersToRidge(
  eaveCorners: readonly RoofVec3[],
  ridgeStart: RoofVec3,
  ridgeEnd: RoofVec3,
): { eaveAtStart: RoofVec3; eaveAtEnd: RoofVec3 } | null {
  if (eaveCorners.length < 2) {
    return null;
  }
  const [first, second] = eaveCorners;
  const firstNearStart =
    Math.hypot(first.x - ridgeStart.x, first.z - ridgeStart.z) <=
    Math.hypot(first.x - ridgeEnd.x, first.z - ridgeEnd.z);
  return firstNearStart
    ? { eaveAtStart: first, eaveAtEnd: second }
    : { eaveAtStart: second, eaveAtEnd: first };
}

function resolvePurlinPlacements(params: {
  roofTopPlanes: RoofPlane[];
  rafterLengthMeters: number;
  maxPurlinSpacingMeters: number;
  ridgeStart?: RoofVec3;
  ridgeEnd?: RoofVec3;
  roofBeamTopY: number;
}): { rowsPerSlope: number; actualSpacingMeters: number; placements: PurlinPlacement[] } {
  const rowsPerSlope = Math.max(
    2,
    Math.ceil(params.rafterLengthMeters / Math.max(0.001, params.maxPurlinSpacingMeters)) + 1,
  );
  const actualSpacingMeters = params.rafterLengthMeters / (rowsPerSlope - 1);
  const placements: PurlinPlacement[] = [];
  const verticalOffset = ROOF_SHEET_CLEARANCE_METERS + PURLIN_PROFILE_DEPTH_METERS / 2;

  if (!params.ridgeStart || !params.ridgeEnd) {
    return { rowsPerSlope, actualSpacingMeters, placements };
  }

  for (const plane of params.roofTopPlanes) {
    if (plane.corners.length < 3) continue;
    const eaveCorners = eaveCornersForPlane(plane);
    const paired = pairEaveCornersToRidge(eaveCorners, params.ridgeStart, params.ridgeEnd);
    if (!paired) continue;
    const { eaveAtStart, eaveAtEnd } = paired;

    for (let row = 0; row < rowsPerSlope; row += 1) {
      const t = row / (rowsPerSlope - 1);
      const surfaceStart = lerpVec3(eaveAtStart, params.ridgeStart, t);
      const surfaceEnd = lerpVec3(eaveAtEnd, params.ridgeEnd, t);
      const start = vec3(surfaceStart.x, surfaceStart.y - verticalOffset, surfaceStart.z);
      const end = vec3(surfaceEnd.x, surfaceEnd.y - verticalOffset, surfaceEnd.z);
      if (Math.min(start.y, end.y) < params.roofBeamTopY - TRUSS_VALIDATION_TOLERANCE_METERS) {
        continue;
      }
      placements.push({
        id: `${plane.id}-purlin-${row}`,
        slopePlaneId: plane.id,
        rowIndex: row,
        start,
        end,
      });
    }
  }

  return { rowsPerSlope, actualSpacingMeters, placements };
}

function resolveHipFramingMembers(params: {
  cladding: readonly PlanVec2[];
  roofBeamTopY: number;
  ridgeStart?: RoofVec3;
  ridgeEnd?: RoofVec3;
  peakPoint?: RoofVec3;
}): HipFramingMember[] {
  const { cladding, roofBeamTopY, ridgeStart, ridgeEnd, peakPoint } = params;
  const eaveY = roofBeamTopY;
  const corners = cladding.map((point) => toVec3(point, eaveY));

  if (peakPoint) {
    return corners.map((corner, index) => ({
      id: `hip-${index}`,
      start: corner,
      end: peakPoint,
      memberKind: 'hip' as const,
    }));
  }

  const members: HipFramingMember[] = [];
  if (ridgeStart && ridgeEnd) {
    members.push({ id: 'ridge', start: ridgeStart, end: ridgeEnd, memberKind: 'ridge' });
    for (let index = 0; index < 4; index += 1) {
      const corner = corners[index]!;
      const ridgeCorner = index <= 1 ? ridgeEnd : ridgeStart;
      members.push({
        id: `hip-${index}`,
        start: corner,
        end: ridgeCorner,
        memberKind: 'hip',
      });
    }
  }
  return members;
}

export function resolveRoofFraming(params: {
  settings: RoofSystemSettings;
  analysis: RectangularFootprintAnalysis;
  structuralBearingPerimeter: readonly PlanVec2[];
  claddingPerimeter: readonly PlanVec2[];
  ridgeAxis: RidgeAxis;
  roofBeamTopY: number;
  peakY: number;
  ridgeStart?: RoofVec3;
  ridgeEnd?: RoofVec3;
  peakPoint?: RoofVec3;
  roofTopPlanes: RoofPlane[];
  rafterLengthMeters: number;
  ridgeLengthMeters: number;
}): Pick<
  ResolvedRoofSystem,
  | 'exteriorRoofBeamBounds'
  | 'trussCount'
  | 'actualTrussSpacingMeters'
  | 'trussStations'
  | 'trussPlacements'
  | 'purlinRowsPerSlope'
  | 'actualPurlinSpacingMeters'
  | 'purlinPlacements'
  | 'hipFramingMembers'
> {
  const bounds = buildExteriorRoofBeamBounds(
    params.structuralBearingPerimeter,
    params.roofBeamTopY,
    params.analysis,
  );
  const buildingLengthMeters =
    params.ridgeAxis === 'localX' ? params.analysis.localXSpanMeters : params.analysis.localZSpanMeters;

  let trussCount = 0;
  let actualTrussSpacingMeters = 0;
  let trussStations: number[] = [];
  let trussPlacements: TrussPlacement[] = [];
  let hipFramingMembers: HipFramingMember[] = [];

  if (
    params.settings.roofType === 'gable' &&
    params.settings.steelTrusses.enabled &&
    params.ridgeStart &&
    params.ridgeEnd
  ) {
    const trussResolution = resolveEvenStations(
      buildingLengthMeters,
      params.settings.steelTrusses.maxSpacingMeters,
    );
    trussCount = trussResolution.count;
    actualTrussSpacingMeters = trussResolution.actualSpacingMeters;
    trussStations = trussResolution.stations;
    trussPlacements = resolveGableTrussPlacements({
      bearing: params.structuralBearingPerimeter,
      ridgeStart: params.ridgeStart,
      ridgeEnd: params.ridgeEnd,
      peakY: params.peakY,
      roofBeamTopY: params.roofBeamTopY,
      basePlateThicknessMeters: params.settings.steelTrusses.basePlateEnabled
        ? params.settings.steelTrusses.basePlateThicknessMeters
        : 0,
      stations: trussStations,
    });
  } else if (params.settings.roofType === 'hip') {
    hipFramingMembers = resolveHipFramingMembers({
      cladding: params.claddingPerimeter,
      roofBeamTopY: params.roofBeamTopY,
      ridgeStart: params.ridgeStart,
      ridgeEnd: params.ridgeEnd,
      peakPoint: params.peakPoint,
    });
  }

  let purlinRowsPerSlope = 0;
  let actualPurlinSpacingMeters = 0;
  let purlinPlacements: PurlinPlacement[] = [];
  if (params.settings.purlins.enabled) {
    const purlinResolution = resolvePurlinPlacements({
      roofTopPlanes: params.roofTopPlanes,
      rafterLengthMeters: params.rafterLengthMeters,
      maxPurlinSpacingMeters: params.settings.purlins.maxSpacingMeters,
      ridgeStart: params.ridgeStart,
      ridgeEnd: params.ridgeEnd,
      roofBeamTopY: params.roofBeamTopY,
    });
    purlinRowsPerSlope = purlinResolution.rowsPerSlope;
    actualPurlinSpacingMeters = purlinResolution.actualSpacingMeters;
    purlinPlacements = purlinResolution.placements;
  }

  return {
    exteriorRoofBeamBounds: bounds,
    trussCount,
    actualTrussSpacingMeters,
    trussStations,
    trussPlacements,
    purlinRowsPerSlope,
    actualPurlinSpacingMeters,
    purlinPlacements,
    hipFramingMembers,
  };
}

export function trussMemberLength(member: SteelMemberSegment): number {
  return length3(sub3(member.end, member.start));
}

export function distancePointToTrussPlaneForTests(
  point: RoofVec3,
  planePoint: RoofVec3,
  planeNormal: RoofVec3,
): number {
  return distancePointToTrussPlane(point, planePoint, planeNormal);
}

export function validateRidgeCapPlacement(placement: RidgeCapPlacement): void {
  const ridgeVectorY = placement.end.y - placement.start.y;
  if (Math.abs(ridgeVectorY) > 0.002) {
    throw new Error('Gable ridge cap must run horizontally between ridge endpoints.');
  }
  if (placement.thicknessMeters > 0.05) {
    throw new Error('Ridge cap thickness is unrealistically large.');
  }
}

export function resolveRidgeCapPlacement(params: {
  roofType: RoofSystemSettings['roofType'];
  ridgeStart?: RoofVec3;
  ridgeEnd?: RoofVec3;
  rafterRunMeters: number;
  rafterRiseMeters: number;
  enabled: boolean;
}): RidgeCapPlacement | null {
  if (!params.enabled || params.roofType !== 'gable' || !params.ridgeStart || !params.ridgeEnd) {
    return null;
  }
  const placement: RidgeCapPlacement = {
    id: 'ridge-cap',
    start: params.ridgeStart,
    end: params.ridgeEnd,
    widthMeters: DEFAULT_RIDGE_CAP_WIDTH_METERS,
    thicknessMeters: DEFAULT_RIDGE_CAP_THICKNESS_METERS,
    roofAngleRadians: Math.atan2(params.rafterRiseMeters, params.rafterRunMeters),
  };
  validateRidgeCapPlacement(placement);
  return placement;
}
