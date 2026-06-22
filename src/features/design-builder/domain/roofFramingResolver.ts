import {
  footprintBounds,
  intersectRayWithSegment2D,
  midpoint2,
  type PlanVec2,
  type RectangularFootprintAnalysis,
  type RidgeAxis,
} from './roofFootprintSupport';
import {
  claddingEaveElevationMeters,
  projectCladdingEaveFromStructuralBearing,
  sideEaveTrussRowStationFraction,
} from './roofOverhangSupport';
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

export const ROOF_SHEET_CLEARANCE_METERS = 0.002;
export const PURLIN_TO_CHORD_CLEARANCE_METERS = 0.001;
export const PURLIN_TO_SHEET_CLEARANCE_METERS = 0.002;
export const ROOF_RIDGE_CAP_CLEARANCE_METERS = 0.005;
/** Visible corrugated sheet thickness in 3D — not the full roof assembly build-up depth. */
export const CORRUGATED_SHEET_DISPLAY_THICKNESS_METERS = 0.002;
export const DEFAULT_RIDGE_CAP_WIDTH_METERS = 0.3;
export const DEFAULT_RIDGE_CAP_THICKNESS_METERS = 0.02;
export const TRUSS_CHORD_PROFILE_METERS = 0.04;
export const PURLIN_PROFILE_WIDTH_METERS = 0.05;
export const PURLIN_PROFILE_DEPTH_METERS = 0.08;
export const ROOF_SHEET_EAVE_OVERHANG_METERS = 0.0254; // 1 inch
/** Perpendicular inset from roof top surface to purlin bottom flange. */
export const PURLIN_BOTTOM_INSET_FROM_ROOF_TOP_METERS =
  PURLIN_TO_SHEET_CLEARANCE_METERS + PURLIN_PROFILE_DEPTH_METERS;
const TRUSS_VALIDATION_TOLERANCE_METERS = 0.002;
const PURLIN_ROW_STATION_TOLERANCE = 0.001;

function vec3(x: number, y: number, z: number): RoofVec3 {
  return { x, y, z };
}

export function normalizeOutwardRoofNormal(normal: RoofVec3): RoofVec3 {
  const len = Math.hypot(normal.x, normal.y, normal.z) || 1;
  const normalized = vec3(normal.x / len, normal.y / len, normal.z / len);
  if (normalized.y < 0) {
    return vec3(-normalized.x, -normalized.y, -normalized.z);
  }
  return normalized;
}

export function offsetPointAlongRoofNormal(
  point: RoofVec3,
  outwardNormal: RoofVec3,
  distanceMeters: number,
): RoofVec3 {
  const normal = normalizeOutwardRoofNormal(outwardNormal);
  return vec3(
    point.x + normal.x * distanceMeters,
    point.y + normal.y * distanceMeters,
    point.z + normal.z * distanceMeters,
  );
}

export function distanceAlongRoofNormal(
  from: RoofVec3,
  to: RoofVec3,
  outwardNormal: RoofVec3,
): number {
  const normal = normalizeOutwardRoofNormal(outwardNormal);
  return (to.x - from.x) * normal.x + (to.y - from.y) * normal.y + (to.z - from.z) * normal.z;
}

export function resolveTrussTopChordUpperPoint(params: {
  chordCenter: RoofVec3;
  outwardNormal: RoofVec3;
}): RoofVec3 {
  return offsetPointAlongRoofNormal(
    params.chordCenter,
    params.outwardNormal,
    TRUSS_CHORD_PROFILE_METERS / 2,
  );
}

export function resolvePurlinCenterOnTrussTop(params: {
  chordCenter: RoofVec3;
  outwardNormal: RoofVec3;
  purlinDepthMeters?: number;
}): RoofVec3 {
  const depth = params.purlinDepthMeters ?? PURLIN_PROFILE_DEPTH_METERS;
  return offsetPointAlongRoofNormal(
    params.chordCenter,
    params.outwardNormal,
    TRUSS_CHORD_PROFILE_METERS / 2 + PURLIN_TO_CHORD_CLEARANCE_METERS + depth / 2,
  );
}

export function resolveCladdingTopFromPurlinCenter(params: {
  purlinCenter: RoofVec3;
  outwardNormal: RoofVec3;
  purlinDepthMeters?: number;
  roofAssemblyThicknessMeters: number;
}): RoofVec3 {
  const depth = params.purlinDepthMeters ?? PURLIN_PROFILE_DEPTH_METERS;
  return offsetPointAlongRoofNormal(
    params.purlinCenter,
    params.outwardNormal,
    depth / 2 + PURLIN_TO_SHEET_CLEARANCE_METERS + params.roofAssemblyThicknessMeters,
  );
}

export function resolveCladdingStackOffsetFromStructuralSurfaceMeters(
  roofAssemblyThicknessMeters: number,
): number {
  return (
    TRUSS_CHORD_PROFILE_METERS / 2 +
    PURLIN_TO_CHORD_CLEARANCE_METERS +
    PURLIN_PROFILE_DEPTH_METERS +
    PURLIN_TO_SHEET_CLEARANCE_METERS +
    roofAssemblyThicknessMeters
  );
}

export function offsetRoofPlaneAlongNormal(plane: RoofPlane, distanceMeters: number): RoofPlane {
  const normal = normalizeOutwardRoofNormal(plane.normal);
  return {
    ...plane,
    id: `${plane.id}-cladding-top`,
    corners: plane.corners.map((corner) => offsetPointAlongRoofNormal(corner, normal, distanceMeters)),
  };
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

function pointOnChordSlopeAtPlanPoint(
  chordStart: RoofVec3,
  chordEnd: RoofVec3,
  point: RoofVec3,
): RoofVec3 {
  const span = sub3(chordEnd, chordStart);
  const spanHorizLenSq = span.x * span.x + span.z * span.z;
  if (spanHorizLenSq <= 1e-8) {
    return { ...point, y: chordStart.y };
  }
  const t = ((point.x - chordStart.x) * span.x + (point.z - chordStart.z) * span.z) / spanHorizLenSq;
  return {
    x: point.x,
    y: chordStart.y + (chordEnd.y - chordStart.y) * t,
    z: point.z,
  };
}

function buildPrimaryTrussMembers(
  trussId: string,
  leftBearing: RoofVec3,
  rightBearing: RoofVec3,
  apex: RoofVec3,
  leftCladdingEave?: RoofVec3,
  rightCladdingEave?: RoofVec3,
  leftBearingTopCenter?: RoofVec3,
  rightBearingTopCenter?: RoofVec3,
): SteelMemberSegment[] {
  const resolvedLeftBearingTop = leftBearingTopCenter ?? leftBearing;
  const resolvedRightBearingTop = rightBearingTopCenter ?? rightBearing;
  const members: SteelMemberSegment[] = [
    {
      id: `${trussId}-top-left`,
      memberKind: 'top_chord_left',
      start: resolvedLeftBearingTop,
      end: apex,
    },
    {
      id: `${trussId}-top-right`,
      memberKind: 'top_chord_right',
      start: resolvedRightBearingTop,
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

  if (leftCladdingEave && length3(sub3(leftCladdingEave, resolvedLeftBearingTop)) > TRUSS_VALIDATION_TOLERANCE_METERS) {
    const extensionStart = pointOnChordSlopeAtPlanPoint(
      resolvedLeftBearingTop,
      apex,
      leftCladdingEave,
    );
    members.push({
      id: `${trussId}-top-left-eave-extension`,
      memberKind: 'top_chord_left_eave_extension',
      start: extensionStart,
      end: resolvedLeftBearingTop,
    });
  }

  if (
    rightCladdingEave &&
    length3(sub3(rightCladdingEave, resolvedRightBearingTop)) > TRUSS_VALIDATION_TOLERANCE_METERS
  ) {
    const extensionStart = pointOnChordSlopeAtPlanPoint(
      resolvedRightBearingTop,
      apex,
      rightCladdingEave,
    );
    members.push({
      id: `${trussId}-top-right-eave-extension`,
      memberKind: 'top_chord_right_eave_extension',
      start: extensionStart,
      end: resolvedRightBearingTop,
    });
  }

  return members;
}

function chordCenterAtBearing(params: {
  member: SteelMemberSegment;
  bearing: RoofVec3;
}): RoofVec3 {
  const span = sub3(params.member.end, params.member.start);
  const spanHorizLenSq = span.x * span.x + span.z * span.z;
  if (spanHorizLenSq <= 1e-8) {
    return params.member.start;
  }
  const toBearing = sub3(params.bearing, params.member.start);
  const t = Math.max(0, Math.min(1, (toBearing.x * span.x + toBearing.z * span.z) / spanHorizLenSq));
  return lerpVec3(params.member.start, params.member.end, t);
}

function topChordEaveExtensionKind(
  memberKind: 'top_chord_left' | 'top_chord_right',
): 'top_chord_left_eave_extension' | 'top_chord_right_eave_extension' {
  return memberKind === 'top_chord_left'
    ? 'top_chord_left_eave_extension'
    : 'top_chord_right_eave_extension';
}

function planProjectionT(member: SteelMemberSegment, point: Pick<RoofVec3, 'x' | 'z'>): number | null {
  const span = sub3(member.end, member.start);
  const spanHorizLenSq = span.x * span.x + span.z * span.z;
  if (spanHorizLenSq <= 1e-8) {
    return null;
  }
  return ((point.x - member.start.x) * span.x + (point.z - member.start.z) * span.z) / spanHorizLenSq;
}

function chordCenterAtPlanPoint(member: SteelMemberSegment, point: Pick<RoofVec3, 'x' | 'z'>): RoofVec3 {
  const t = planProjectionT(member, point);
  if (t == null) {
    return { x: point.x, y: member.start.y, z: point.z };
  }
  return {
    x: point.x,
    y: lerpVec3(member.start, member.end, Math.max(0, Math.min(1, t))).y,
    z: point.z,
  };
}

function resolveSplitTopChordCenter(params: {
  members: readonly SteelMemberSegment[];
  memberKind: 'top_chord_left' | 'top_chord_right';
  point: Pick<RoofVec3, 'x' | 'z'>;
}): RoofVec3 | null {
  const primary = params.members.find((member) => member.memberKind === params.memberKind);
  if (!primary) {
    return null;
  }
  const extension = params.members.find(
    (member) => member.memberKind === topChordEaveExtensionKind(params.memberKind),
  );
  if (extension) {
    const extensionT = planProjectionT(extension, params.point);
    if (
      extensionT != null &&
      extensionT >= -PURLIN_ROW_STATION_TOLERANCE &&
      extensionT <= 1 + PURLIN_ROW_STATION_TOLERANCE
    ) {
      return {
        x: params.point.x,
        y: lerpVec3(extension.start, extension.end, Math.max(0, Math.min(1, extensionT))).y,
        z: params.point.z,
      };
    }
  }
  return chordCenterAtPlanPoint(primary, params.point);
}

function validateTopChordClearsRoofBeam(params: {
  member: SteelMemberSegment;
  bearing: RoofVec3;
  outwardNormal: RoofVec3;
  roofBeamTopY: number;
  basePlateThicknessMeters: number;
}): void {
  const normal = normalizeOutwardRoofNormal(params.outwardNormal);
  const center = chordCenterAtBearing({ member: params.member, bearing: params.bearing });
  const chordBottomY = center.y - normal.y * (TRUSS_CHORD_PROFILE_METERS / 2);
  const requiredMinY = params.roofBeamTopY + params.basePlateThicknessMeters;
  if (chordBottomY < requiredMinY - TRUSS_VALIDATION_TOLERANCE_METERS) {
    throw new Error('Top chord intersects Roof Beam or base plate.');
  }
}

function validateEaveExtensionProjectsOutward(params: {
  member: SteelMemberSegment;
  bearing: RoofVec3;
  oppositeBearing: RoofVec3;
  structuralTop: RoofVec3;
}): void {
  const memberStartAtBearing = length3(sub3(params.member.start, params.structuralTop)) <= TRUSS_VALIDATION_TOLERANCE_METERS;
  const memberEndAtBearing = length3(sub3(params.member.end, params.structuralTop)) <= TRUSS_VALIDATION_TOLERANCE_METERS;
  if (!memberStartAtBearing && !memberEndAtBearing) {
    throw new Error('Eave extension must terminate at the structural bearing top.');
  }

  const tail = memberStartAtBearing ? params.member.end : params.member.start;
  const spanMid = vec3(
    (params.bearing.x + params.oppositeBearing.x) / 2,
    (params.bearing.y + params.oppositeBearing.y) / 2,
    (params.bearing.z + params.oppositeBearing.z) / 2,
  );
  const outward = sub3(params.bearing, spanMid);
  const outwardPlanLength = Math.hypot(outward.x, outward.z) || 1;
  const outwardUnit = vec3(outward.x / outwardPlanLength, 0, outward.z / outwardPlanLength);
  const bearingStation =
    (params.bearing.x - spanMid.x) * outwardUnit.x + (params.bearing.z - spanMid.z) * outwardUnit.z;
  const tailStation = (tail.x - spanMid.x) * outwardUnit.x + (tail.z - spanMid.z) * outwardUnit.z;
  if (tailStation <= bearingStation + TRUSS_VALIDATION_TOLERANCE_METERS) {
    throw new Error('Eave extension projects inward through Roof Beam or column zone.');
  }
}

export function validateTrussPlacement(
  placement: TrussPlacement,
  roofBeamTopY: number,
  basePlateThicknessMeters = 0,
): void {
  const planePoint = placement.bearingLeft;
  const planeNormal = placement.planeNormal;
  for (const member of placement.members) {
    if (member.memberKind === 'top_chord_left') {
      validateTopChordClearsRoofBeam({
        member,
        bearing: placement.bearingLeft,
        outwardNormal: planeNormal,
        roofBeamTopY,
        basePlateThicknessMeters,
      });
      continue;
    }
    if (member.memberKind === 'top_chord_right') {
      validateTopChordClearsRoofBeam({
        member,
        bearing: placement.bearingRight,
        outwardNormal: planeNormal,
        roofBeamTopY,
        basePlateThicknessMeters,
      });
      continue;
    }
    if (member.memberKind === 'top_chord_left_eave_extension') {
      const topChord = placement.members.find((item) => item.memberKind === 'top_chord_left');
      if (!topChord) {
        throw new Error('Left eave extension requires a primary top chord.');
      }
      validateEaveExtensionProjectsOutward({
        member,
        bearing: placement.bearingLeft,
        oppositeBearing: placement.bearingRight,
        structuralTop: topChord.start,
      });
      continue;
    }
    if (member.memberKind === 'top_chord_right_eave_extension') {
      const topChord = placement.members.find((item) => item.memberKind === 'top_chord_right');
      if (!topChord) {
        throw new Error('Right eave extension requires a primary top chord.');
      }
      validateEaveExtensionProjectsOutward({
        member,
        bearing: placement.bearingRight,
        oppositeBearing: placement.bearingLeft,
        structuralTop: topChord.start,
      });
      continue;
    }
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
  structuralHalfRunMeters: number;
  sideEaveOverhangMeters: number;
  trussBearingOutsetMeters: number;
  fixedRoofSlope: number;
}): TrussPlacement[] {
  const {
    bearing,
    ridgeStart,
    ridgeEnd,
    peakY,
    roofBeamTopY,
    basePlateThicknessMeters,
    stations,
    structuralHalfRunMeters,
    sideEaveOverhangMeters,
    trussBearingOutsetMeters,
    fixedRoofSlope,
  } = params;
  const bearingY = roofBeamTopY + basePlateThicknessMeters;
  const bearingCenterY = bearingY + TRUSS_CHORD_PROFILE_METERS / 2;
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
    const supportOutsetMeters = Math.max(TRUSS_CHORD_PROFILE_METERS / 2, trussBearingOutsetMeters);
    const leftTrussBearingPoint = projectCladdingEaveFromStructuralBearing({
      ridgePoint2,
      structuralBearing2: bearingLeft2,
      structuralHalfRunMeters,
      sideEaveOverhangMeters: supportOutsetMeters,
      structuralEaveY: bearingY,
      fixedSlope: 0,
    });
    const rightTrussBearingPoint = projectCladdingEaveFromStructuralBearing({
      ridgePoint2,
      structuralBearing2: bearingRight2,
      structuralHalfRunMeters,
      sideEaveOverhangMeters: supportOutsetMeters,
      structuralEaveY: bearingY,
      fixedSlope: 0,
    });
    const leftTrussBearing = vec3(leftTrussBearingPoint.x, bearingCenterY, leftTrussBearingPoint.z);
    const rightTrussBearing = vec3(rightTrussBearingPoint.x, bearingCenterY, rightTrussBearingPoint.z);
    const leftTopChordBearingCenter = projectCladdingEaveFromStructuralBearing({
      ridgePoint2,
      structuralBearing2: bearingLeft2,
      structuralHalfRunMeters,
      sideEaveOverhangMeters: supportOutsetMeters,
      structuralEaveY: bearingCenterY,
      fixedSlope: 0,
    });
    const rightTopChordBearingCenter = projectCladdingEaveFromStructuralBearing({
      ridgePoint2,
      structuralBearing2: bearingRight2,
      structuralHalfRunMeters,
      sideEaveOverhangMeters: supportOutsetMeters,
      structuralEaveY: bearingCenterY,
      fixedSlope: 0,
    });
    const topChordApexY = Math.max(
      peakY,
      leftTopChordBearingCenter.y +
        fixedRoofSlope *
          Math.hypot(
            ridgePoint2.x - leftTopChordBearingCenter.x,
            ridgePoint2.z - leftTopChordBearingCenter.z,
          ),
      rightTopChordBearingCenter.y +
        fixedRoofSlope *
          Math.hypot(
            ridgePoint2.x - rightTopChordBearingCenter.x,
            ridgePoint2.z - rightTopChordBearingCenter.z,
          ),
    );
    const apex = vec3(ridgePoint2.x, topChordApexY, ridgePoint2.z);
    const leftCladdingEave =
      sideEaveOverhangMeters > TRUSS_VALIDATION_TOLERANCE_METERS
        ? {
            ...projectCladdingEaveFromStructuralBearing({
              ridgePoint2,
              structuralBearing2: bearingLeft2,
              structuralHalfRunMeters,
              sideEaveOverhangMeters,
              structuralEaveY: bearingCenterY,
              fixedSlope: fixedRoofSlope,
            }),
            y: claddingEaveElevationMeters({
              structuralEaveY: bearingCenterY,
              fixedSlope: fixedRoofSlope,
              sideEaveOverhangMeters,
            }),
          }
        : undefined;
    const rightCladdingEave =
      sideEaveOverhangMeters > TRUSS_VALIDATION_TOLERANCE_METERS
        ? {
            ...projectCladdingEaveFromStructuralBearing({
              ridgePoint2,
              structuralBearing2: bearingRight2,
              structuralHalfRunMeters,
              sideEaveOverhangMeters,
              structuralEaveY: bearingCenterY,
              fixedSlope: fixedRoofSlope,
            }),
            y: claddingEaveElevationMeters({
              structuralEaveY: bearingCenterY,
              fixedSlope: fixedRoofSlope,
              sideEaveOverhangMeters,
            }),
          }
        : undefined;
    const trussId = `truss-${index}`;
    const planeNormal = buildTrussPlaneNormal(bearingLeft, bearingRight, apex);
    const members = buildPrimaryTrussMembers(
      trussId,
      leftTrussBearing,
      rightTrussBearing,
      apex,
      leftCladdingEave,
      rightCladdingEave,
      leftTopChordBearingCenter,
      rightTopChordBearingCenter,
    );
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
    validateTrussPlacement(placement, roofBeamTopY, basePlateThicknessMeters);
    return placement;
  });
}

export function insetPointBelowRoofSurface(
  surface: RoofVec3,
  outwardNormal: RoofVec3,
  distanceMeters: number,
): RoofVec3 {
  return vec3(
    surface.x - outwardNormal.x * distanceMeters,
    surface.y - outwardNormal.y * distanceMeters,
    surface.z - outwardNormal.z * distanceMeters,
  );
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

/** Fraction along the eave-to-ridge slope (0 = eave, 1 = ridge) for a plan point on a roof plane. */
export function resolvePurlinRowStationFractionAtPoint(params: {
  plane: RoofPlane;
  claddingRidgeStart: RoofVec3;
  claddingRidgeEnd: RoofVec3;
  x: number;
  z: number;
}): number | null {
  const paired = pairEaveCornersToRidge(
    eaveCornersForPlane(params.plane),
    params.claddingRidgeStart,
    params.claddingRidgeEnd,
  );
  if (!paired) {
    return null;
  }
  return rowStationOnSlope({
    point: { x: params.x, y: 0, z: params.z },
    eaveAtStart: paired.eaveAtStart,
    eaveAtEnd: paired.eaveAtEnd,
    ridgeStart: params.claddingRidgeStart,
    ridgeEnd: params.claddingRidgeEnd,
  });
}

/** Purlin bottom flange on truss top chords at a plan point on the given slope plane. */
export function resolveTrussSeatedPurlinBottomYOnPlane(params: {
  plane: RoofPlane;
  trussPlacements: readonly TrussPlacement[];
  claddingRidgeStart: RoofVec3;
  claddingRidgeEnd: RoofVec3;
  x: number;
  z: number;
  rowT?: number;
}): number | null {
  if (params.trussPlacements.length === 0) {
    return null;
  }
  const referenceTruss = params.trussPlacements[Math.floor(params.trussPlacements.length / 2)]!;
  const topChordKind = topChordMemberKindForPlane(params.plane.id);
  const topChord = referenceTruss.members.find((member) => member.memberKind === topChordKind);
  if (!topChord) {
    return null;
  }
  const paired = pairEaveCornersToRidge(
    eaveCornersForPlane(params.plane),
    params.claddingRidgeStart,
    params.claddingRidgeEnd,
  );
  if (!paired) {
    return null;
  }
  const planeNormal = normalizeOutwardRoofNormal(params.plane.normal);
  const rowT =
    params.rowT ??
    rowStationOnSlope({
      point: { x: params.x, y: 0, z: params.z },
      eaveAtStart: paired.eaveAtStart,
      eaveAtEnd: paired.eaveAtEnd,
      ridgeStart: params.claddingRidgeStart,
      ridgeEnd: params.claddingRidgeEnd,
    });
  const nearRidgeStart =
    Math.hypot(params.x - params.claddingRidgeStart.x, params.z - params.claddingRidgeStart.z) <=
    Math.hypot(params.x - params.claddingRidgeEnd.x, params.z - params.claddingRidgeEnd.z);
  const eave = nearRidgeStart ? paired.eaveAtStart : paired.eaveAtEnd;
  const ridge = nearRidgeStart ? params.claddingRidgeStart : params.claddingRidgeEnd;
  const chordPlanPoint = {
    x: eave.x + (ridge.x - eave.x) * rowT,
    z: eave.z + (ridge.z - eave.z) * rowT,
  };
  const chordCenter =
    resolveSplitTopChordCenter({
      members: referenceTruss.members,
      memberKind: topChordKind,
      point: chordPlanPoint,
    }) ?? {
      ...chordPlanPoint,
      y: topChord.start.y + (referenceTruss.apex.y - topChord.start.y) * rowT,
    };
  const purlinCenter = resolvePurlinCenterOnTrussTop({
    chordCenter,
    outwardNormal: planeNormal,
  });
  return offsetPointAlongRoofNormal(
    purlinCenter,
    planeNormal,
    -PURLIN_PROFILE_DEPTH_METERS / 2,
  ).y;
}

export function buildPurlinRowStationFractions(params: {
  /** Cladding slope length from the outer eave to the ridge. */
  slopeLengthMeters: number;
  structuralHalfRunMeters: number;
  sideEaveOverhangMeters: number;
  maxPurlinSpacingMeters: number;
}): { rowTs: number[]; rowsPerSlope: number; actualSpacingMeters: number } {
  const trussEaveT = sideEaveTrussRowStationFraction({
    structuralHalfRunMeters: params.structuralHalfRunMeters,
    sideEaveOverhangMeters: params.sideEaveOverhangMeters,
  });

  const slopeLengthMeters = Math.max(0.001, params.slopeLengthMeters);
  const interiorRows = Math.max(
    2,
    Math.ceil(slopeLengthMeters / Math.max(0.001, params.maxPurlinSpacingMeters)) + 1,
  );
  const actualSpacingMeters = slopeLengthMeters / (interiorRows - 1);

  const rowTs = new Set<number>();
  for (let index = 0; index < interiorRows; index += 1) {
    rowTs.add(index / (interiorRows - 1));
  }
  if (trussEaveT > TRUSS_VALIDATION_TOLERANCE_METERS) {
    rowTs.add(trussEaveT);
  }

  const sortedTs = [...rowTs].sort((a, b) => a - b);
  const deduped: number[] = [];
  for (const t of sortedTs) {
    if (deduped.length === 0 || t - deduped[deduped.length - 1]! > PURLIN_ROW_STATION_TOLERANCE) {
      deduped.push(t);
    }
  }

  return {
    rowTs: deduped,
    rowsPerSlope: deduped.length,
    actualSpacingMeters,
  };
}

function topChordMemberKindForPlane(planeId: string): 'top_chord_left' | 'top_chord_right' {
  return planeId.endsWith('-2') || planeId.endsWith('-3') ? 'top_chord_right' : 'top_chord_left';
}

function rowStationOnSlope(params: {
  point: RoofVec3;
  eaveAtStart: RoofVec3;
  eaveAtEnd: RoofVec3;
  ridgeStart: RoofVec3;
  ridgeEnd: RoofVec3;
}): number {
  const nearRidgeStart =
    Math.hypot(params.point.x - params.ridgeStart.x, params.point.z - params.ridgeStart.z) <=
    Math.hypot(params.point.x - params.ridgeEnd.x, params.point.z - params.ridgeEnd.z);
  const eave = nearRidgeStart ? params.eaveAtStart : params.eaveAtEnd;
  const ridge = nearRidgeStart ? params.ridgeStart : params.ridgeEnd;
  const dx = ridge.x - eave.x;
  const dz = ridge.z - eave.z;
  const lenSq = dx * dx + dz * dz || 1;
  return Math.max(0, Math.min(1, ((params.point.x - eave.x) * dx + (params.point.z - eave.z) * dz) / lenSq));
}

export function elevationOnRoofPlaneAtPoint(plane: RoofPlane, x: number, z: number): number | null {
  const anchor = plane.corners[0];
  if (!anchor) return null;
  const normal = plane.normal;
  if (Math.abs(normal.y) <= 1e-6) return null;
  return anchor.y - (normal.x * (x - anchor.x) + normal.z * (z - anchor.z)) / normal.y;
}

export function claddingRidgePointOnDisplayPlanes(params: {
  displayPlanes: readonly RoofPlane[];
  ridgePoint: RoofVec3;
}): RoofVec3 {
  let matchedTopY = -Infinity;
  for (const plane of params.displayPlanes) {
    const topY = elevationOnRoofPlaneAtPoint(plane, params.ridgePoint.x, params.ridgePoint.z);
    if (topY != null) {
      matchedTopY = Math.max(matchedTopY, topY);
    }
  }
  return matchedTopY > -Infinity
    ? { ...params.ridgePoint, y: matchedTopY }
    : params.ridgePoint;
}

export function buildCladdingDisplayPlanes(params: {
  structuralPlanes: readonly RoofPlane[];
  trussPlacements: readonly TrussPlacement[];
  purlinPlacements: readonly PurlinPlacement[];
  peakY: number;
  claddingRidgeStart?: RoofVec3;
  claddingRidgeEnd?: RoofVec3;
  claddingDisplayThicknessMeters?: number;
}): RoofPlane[] {
  if (params.trussPlacements.length === 0 || params.purlinPlacements.length === 0) {
    return params.structuralPlanes.map((plane) => ({ ...plane }));
  }
  const displayThicknessMeters =
    params.claddingDisplayThicknessMeters ?? CORRUGATED_SHEET_DISPLAY_THICKNESS_METERS;
  return params.structuralPlanes.map((plane) => {
    const planeNormal = normalizeOutwardRoofNormal(plane.normal);
    const planePurlins = params.purlinPlacements.filter((purlin) => purlin.slopePlaneId === plane.id);
    if (planePurlins.length === 0) {
      return { ...plane };
    }
    const offsets = planePurlins
      .map((purlin) => {
        const center = {
          x: (purlin.start.x + purlin.end.x) / 2,
          y: (purlin.start.y + purlin.end.y) / 2,
          z: (purlin.start.z + purlin.end.z) / 2,
        };
        const structuralY = elevationOnRoofPlaneAtPoint(plane, center.x, center.z);
        if (structuralY == null) {
          return null;
        }
        const structuralPoint = { x: center.x, y: structuralY, z: center.z };
        const purlinTop = offsetPointAlongRoofNormal(center, planeNormal, PURLIN_PROFILE_DEPTH_METERS / 2);
        const claddingTop = offsetPointAlongRoofNormal(
          purlinTop,
          planeNormal,
          PURLIN_TO_SHEET_CLEARANCE_METERS + displayThicknessMeters,
        );
        return distanceAlongRoofNormal(structuralPoint, claddingTop, planeNormal);
      })
      .filter((offset): offset is number => offset != null && Number.isFinite(offset))
      .sort((a, b) => a - b);
    if (offsets.length === 0) {
      return { ...plane };
    }
    const offset = offsets[offsets.length - 1]!;
    const displayPlane = offsetRoofPlaneAlongNormal(plane, offset);
    const paired =
      params.claddingRidgeStart && params.claddingRidgeEnd
        ? pairEaveCornersToRidge(eaveCornersForPlane(plane), params.claddingRidgeStart, params.claddingRidgeEnd)
        : null;
    const corners =
      paired && params.claddingRidgeStart && params.claddingRidgeEnd
        ? plane.corners.map((corner, index) => {
            const rowT = rowStationOnSlope({
              point: corner,
              eaveAtStart: paired.eaveAtStart,
              eaveAtEnd: paired.eaveAtEnd,
              ridgeStart: params.claddingRidgeStart!,
              ridgeEnd: params.claddingRidgeEnd!,
            });
            if (rowT < 1 - PURLIN_ROW_STATION_TOLERANCE) {
              return displayPlane.corners[index] ?? corner;
            }
            const ridgePoint =
              Math.hypot(corner.x - params.claddingRidgeStart!.x, corner.z - params.claddingRidgeStart!.z) <=
              Math.hypot(corner.x - params.claddingRidgeEnd!.x, corner.z - params.claddingRidgeEnd!.z)
                ? params.claddingRidgeStart!
                : params.claddingRidgeEnd!;
            return {
              x: ridgePoint.x,
              y:
                elevationOnRoofPlaneAtPoint(displayPlane, ridgePoint.x, ridgePoint.z) ??
                displayPlane.corners[index]?.y ??
                corner.y,
              z: ridgePoint.z,
            };
          })
        : displayPlane.corners;
    return {
      ...displayPlane,
      id: `${plane.id}-cladding-display`,
      corners,
    };
  });
}

function resolvePurlinPlacements(params: {
  roofTopPlanes: RoofPlane[];
  claddingRafterLengthMeters: number;
  structuralHalfRunMeters: number;
  sideEaveOverhangMeters: number;
  maxPurlinSpacingMeters: number;
  claddingRidgeStart?: RoofVec3;
  claddingRidgeEnd?: RoofVec3;
  trussPlacements: TrussPlacement[];
}): { rowsPerSlope: number; actualSpacingMeters: number; placements: PurlinPlacement[] } {
  const { rowTs, rowsPerSlope, actualSpacingMeters } = buildPurlinRowStationFractions({
    slopeLengthMeters: params.claddingRafterLengthMeters,
    structuralHalfRunMeters: params.structuralHalfRunMeters,
    sideEaveOverhangMeters: params.sideEaveOverhangMeters,
    maxPurlinSpacingMeters: params.maxPurlinSpacingMeters,
  });
  const placements: PurlinPlacement[] = [];

  if (!params.claddingRidgeStart || !params.claddingRidgeEnd || params.trussPlacements.length === 0) {
    return { rowsPerSlope, actualSpacingMeters, placements };
  }

  const referenceTruss = params.trussPlacements[Math.floor(params.trussPlacements.length / 2)]!;

  for (const plane of params.roofTopPlanes) {
    if (plane.corners.length < 3) continue;
    const planeNormal = normalizeOutwardRoofNormal(plane.normal);
    const memberKind = topChordMemberKindForPlane(plane.id);
    const topChord = referenceTruss.members.find((member) => member.memberKind === memberKind);
    if (!topChord) continue;
    const eaveCorners = eaveCornersForPlane(plane);
    const paired = pairEaveCornersToRidge(
      eaveCorners,
      params.claddingRidgeStart,
      params.claddingRidgeEnd,
    );
    if (!paired) continue;
    const { eaveAtStart, eaveAtEnd } = paired;

    for (let rowIndex = 0; rowIndex < rowTs.length; rowIndex += 1) {
      const t = rowTs[rowIndex]!;
      const chordPlanStart = {
        x: lerpVec3(eaveAtStart, params.claddingRidgeStart, t).x,
        z: lerpVec3(eaveAtStart, params.claddingRidgeStart, t).z,
      };
      const chordPlanEnd = {
        x: lerpVec3(eaveAtEnd, params.claddingRidgeEnd, t).x,
        z: lerpVec3(eaveAtEnd, params.claddingRidgeEnd, t).z,
      };
      const fallbackChordCenterY = lerpVec3(topChord.start, referenceTruss.apex, t).y;
      let chordCenterStart: RoofVec3 =
        resolveSplitTopChordCenter({
          members: referenceTruss.members,
          memberKind,
          point: chordPlanStart,
        }) ?? {
          ...chordPlanStart,
          y: fallbackChordCenterY,
        };

      let chordCenterEnd: RoofVec3 =
        resolveSplitTopChordCenter({
          members: referenceTruss.members,
          memberKind,
          point: chordPlanEnd,
        }) ?? {
          ...chordPlanEnd,
          y: fallbackChordCenterY,
        };
      
      /*
       * Move only the existing outer eave purlin inward by half of its
       * cross-slope width. This makes its outside face flush with the
       * actual top-chord eave endpoint.
       *
       * Do not alter rowTs. Do not add a new purlin.
       */
      const isOuterEavePurlin = rowIndex === 0;
      
      if (isOuterEavePurlin) {
        const inboardDirection = normalize3(
          sub3(topChord.end, topChord.start),
        );
      
        const inboardOffsetMeters =
          PURLIN_PROFILE_WIDTH_METERS / 2;
      
        chordCenterStart = {
          x: chordCenterStart.x + inboardDirection.x * inboardOffsetMeters,
          y: chordCenterStart.y + inboardDirection.y * inboardOffsetMeters,
          z: chordCenterStart.z + inboardDirection.z * inboardOffsetMeters,
        };
      
        chordCenterEnd = {
          x: chordCenterEnd.x + inboardDirection.x * inboardOffsetMeters,
          y: chordCenterEnd.y + inboardDirection.y * inboardOffsetMeters,
          z: chordCenterEnd.z + inboardDirection.z * inboardOffsetMeters,
        };
      }
      
      const start = resolvePurlinCenterOnTrussTop({
        chordCenter: chordCenterStart,
        outwardNormal: planeNormal,
      });
      
      const end = resolvePurlinCenterOnTrussTop({
        chordCenter: chordCenterEnd,
        outwardNormal: planeNormal,
      });
      placements.push({
        id: `${plane.id}-purlin-${rowIndex}`,
        slopePlaneId: plane.id,
        rowIndex,
        start,
        end,
        planeNormal,
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
  structuralRidgeStart?: RoofVec3;
  structuralRidgeEnd?: RoofVec3;
  claddingRidgeStart?: RoofVec3;
  claddingRidgeEnd?: RoofVec3;
  /** @deprecated Use structuralRidgeStart/End for trusses and claddingRidgeStart/End for purlins. */
  ridgeStart?: RoofVec3;
  /** @deprecated Use structuralRidgeStart/End for trusses and claddingRidgeStart/End for purlins. */
  ridgeEnd?: RoofVec3;
  peakPoint?: RoofVec3;
  roofTopPlanes: RoofPlane[];
  rafterLengthMeters: number;
  claddingRafterLengthMeters: number;
  rafterRunMeters: number;
  structuralHalfRunMeters: number;
  sideEaveOverhangMeters: number;
  fixedRoofSlope: number;
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

  const structuralRidgeStart = params.structuralRidgeStart ?? params.ridgeStart;
  const structuralRidgeEnd = params.structuralRidgeEnd ?? params.ridgeEnd;
  const claddingRidgeStart = params.claddingRidgeStart ?? params.ridgeStart;
  const claddingRidgeEnd = params.claddingRidgeEnd ?? params.ridgeEnd;

  let trussCount = 0;
  let actualTrussSpacingMeters = 0;
  let trussStations: number[] = [];
  let trussPlacements: TrussPlacement[] = [];
  let hipFramingMembers: HipFramingMember[] = [];

  if (
    params.settings.roofType === 'gable' &&
    params.settings.steelTrusses.enabled &&
    structuralRidgeStart &&
    structuralRidgeEnd
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
      ridgeStart: structuralRidgeStart,
      ridgeEnd: structuralRidgeEnd,
      peakY: params.peakY,
      roofBeamTopY: params.roofBeamTopY,
      basePlateThicknessMeters: params.settings.steelTrusses.basePlateEnabled
        ? params.settings.steelTrusses.basePlateThicknessMeters
        : 0,
      stations: trussStations,
      structuralHalfRunMeters: params.structuralHalfRunMeters,
      sideEaveOverhangMeters: params.sideEaveOverhangMeters,
      trussBearingOutsetMeters: params.settings.steelTrusses.basePlateLengthMeters / 2,
      fixedRoofSlope: params.fixedRoofSlope,
    });
  } else if (params.settings.roofType === 'hip') {
    hipFramingMembers = resolveHipFramingMembers({
      cladding: params.claddingPerimeter,
      roofBeamTopY: params.roofBeamTopY,
      ridgeStart: structuralRidgeStart,
      ridgeEnd: structuralRidgeEnd,
      peakPoint: params.peakPoint,
    });
  }

  let purlinRowsPerSlope = 0;
  let actualPurlinSpacingMeters = 0;
  let purlinPlacements: PurlinPlacement[] = [];
  if (params.settings.purlins.enabled) {
    const purlinResolution = resolvePurlinPlacements({
      roofTopPlanes: params.roofTopPlanes,
      claddingRafterLengthMeters: params.claddingRafterLengthMeters,
      structuralHalfRunMeters: params.structuralHalfRunMeters,
      sideEaveOverhangMeters: params.sideEaveOverhangMeters,
      maxPurlinSpacingMeters: params.settings.purlins.maxSpacingMeters,
      claddingRidgeStart,
      claddingRidgeEnd,
      trussPlacements,
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
