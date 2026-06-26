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
export const HIP_SHEET_SEAM_WELD_ALLOWANCE_METERS = 0.006;
/** Perpendicular inset from roof top surface to purlin bottom flange. */
export const PURLIN_BOTTOM_INSET_FROM_ROOF_TOP_METERS =
  PURLIN_TO_SHEET_CLEARANCE_METERS + PURLIN_PROFILE_DEPTH_METERS;
const TRUSS_VALIDATION_TOLERANCE_METERS = 0.002;
const PURLIN_ROW_STATION_TOLERANCE = 0.001;
const MIN_HIP_JACK_LENGTH_METERS = 0.15;

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

function cross3(a: RoofVec3, b: RoofVec3): RoofVec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function roofPlaneNormalFromCorners(corners: readonly RoofVec3[], fallback: RoofVec3): RoofVec3 {
  if (corners.length < 3) {
    return fallback;
  }
  const normal = normalize3(cross3(sub3(corners[1]!, corners[0]!), sub3(corners[2]!, corners[0]!)));
  if (length3(normal) <= 1e-8) {
    return fallback;
  }
  return normal.y < 0 ? vec3(-normal.x, -normal.y, -normal.z) : normal;
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

function add2(a: PlanVec2, b: PlanVec2): PlanVec2 {
  return { x: a.x + b.x, z: a.z + b.z };
}

function sub2(a: PlanVec2, b: PlanVec2): PlanVec2 {
  return { x: a.x - b.x, z: a.z - b.z };
}

function scale2(v: PlanVec2, scalar: number): PlanVec2 {
  return { x: v.x * scalar, z: v.z * scalar };
}

function dot2(a: PlanVec2, b: PlanVec2): number {
  return a.x * b.x + a.z * b.z;
}

function length2(v: PlanVec2): number {
  return Math.hypot(v.x, v.z);
}

function normalize2(v: PlanVec2): PlanVec2 {
  const len = length2(v) || 1;
  return { x: v.x / len, z: v.z / len };
}

function planDistance(a: Pick<RoofVec3, 'x' | 'z'>, b: Pick<RoofVec3, 'x' | 'z'>): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function roofVertexKey(point: RoofVec3): string {
  return `${point.x.toFixed(4)}:${point.y.toFixed(4)}:${point.z.toFixed(4)}`;
}

function canonicalRoofEdgeKey(start: RoofVec3, end: RoofVec3): string {
  const startKey = roofVertexKey(start);
  const endKey = roofVertexKey(end);
  return startKey <= endKey ? `${startKey}|${endKey}` : `${endKey}|${startKey}`;
}

function withHipMemberMetadata(
  member: Omit<HipFramingMember, 'lengthMeters' | 'source'>,
): HipFramingMember {
  return {
    ...member,
    lengthMeters: length3(sub3(member.end, member.start)),
    source: 'hip_roof_framing_solver',
  };
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

function insetPlanPointToward(point: PlanVec2, target: PlanVec2, insetMeters: number): PlanVec2 {
  if (insetMeters <= 0) {
    return { ...point };
  }
  const inward = normalize2(sub2(target, point));
  return add2(point, scale2(inward, insetMeters));
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
  basePlateCenterInsetMeters: number;
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
    basePlateCenterInsetMeters,
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
    const plateInsetMeters = Math.max(0, basePlateCenterInsetMeters);
    const basePlateCenterLeft2 = insetPlanPointToward(bearingLeft2, ridgePoint2, plateInsetMeters);
    const basePlateCenterRight2 = insetPlanPointToward(bearingRight2, ridgePoint2, plateInsetMeters);
    const basePlateCenterLeft = toVec3(basePlateCenterLeft2, bearingY);
    const basePlateCenterRight = toVec3(basePlateCenterRight2, bearingY);
    const leftTrussBearing = vec3(bearingLeft2.x, bearingCenterY, bearingLeft2.z);
    const rightTrussBearing = vec3(bearingRight2.x, bearingCenterY, bearingRight2.z);
    const leftTopChordBearingCenter = leftTrussBearing;
    const rightTopChordBearingCenter = rightTrussBearing;
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
      basePlateCenterLeft,
      basePlateCenterRight,
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

function weldSharedCladdingDisplayPlaneCorners(params: {
  sourcePlanes: readonly RoofPlane[];
  displayPlanes: readonly RoofPlane[];
}): RoofPlane[] {
  const edgeRefs = new Map<string, { planeIndex: number; startIndex: number; endIndex: number }[]>();
  for (const [planeIndex, plane] of params.sourcePlanes.entries()) {
    for (let cornerIndex = 0; cornerIndex < plane.corners.length; cornerIndex += 1) {
      const nextIndex = (cornerIndex + 1) % plane.corners.length;
      const key = canonicalRoofEdgeKey(plane.corners[cornerIndex]!, plane.corners[nextIndex]!);
      const refs = edgeRefs.get(key) ?? [];
      refs.push({ planeIndex, startIndex: cornerIndex, endIndex: nextIndex });
      edgeRefs.set(key, refs);
    }
  }

  const displayPlanes = params.displayPlanes.map((plane) => ({
    ...plane,
    corners: plane.corners.map((corner) => ({ ...corner })),
  }));
  const originalDisplayPlanes = displayPlanes.map((plane) => ({
    ...plane,
    corners: plane.corners.map((corner) => ({ ...corner })),
  }));
  const vertexRefs = new Map<string, Map<string, { planeIndex: number; cornerIndex: number }>>();
  const addVertexRef = (sourcePoint: RoofVec3, planeIndex: number, cornerIndex: number) => {
    const vertexKey = roofVertexKey(sourcePoint);
    const refs = vertexRefs.get(vertexKey) ?? new Map<string, { planeIndex: number; cornerIndex: number }>();
    refs.set(`${planeIndex}:${cornerIndex}`, { planeIndex, cornerIndex });
    vertexRefs.set(vertexKey, refs);
  };

  for (const refs of edgeRefs.values()) {
    if (refs.length < 2) {
      continue;
    }
    for (const ref of refs) {
      const sourcePlane = params.sourcePlanes[ref.planeIndex];
      if (!sourcePlane) continue;
      addVertexRef(sourcePlane.corners[ref.startIndex]!, ref.planeIndex, ref.startIndex);
      addVertexRef(sourcePlane.corners[ref.endIndex]!, ref.planeIndex, ref.endIndex);
    }
  }

  for (const refs of vertexRefs.values()) {
    const refList = [...refs.values()];
    if (refList.length < 2) {
      continue;
    }
    const corners = refList
      .map((ref) => displayPlanes[ref.planeIndex]?.corners[ref.cornerIndex])
      .filter((corner): corner is RoofVec3 => corner != null);
    if (corners.length === 0) {
      continue;
    }
    const weldedX = corners.reduce((sum, corner) => sum + corner.x, 0) / corners.length;
    const weldedZ = corners.reduce((sum, corner) => sum + corner.z, 0) / corners.length;
    const weldedY = Math.max(
      ...refList.map((ref) => {
        const plane = originalDisplayPlanes[ref.planeIndex];
        const corner = plane?.corners[ref.cornerIndex];
        if (!plane || !corner) {
          return -Infinity;
        }
        return elevationOnRoofPlaneAtPoint(plane, weldedX, weldedZ) ?? corner.y;
      }),
    );
    const welded = vec3(
      weldedX,
      Number.isFinite(weldedY) ? weldedY : corners.reduce((sum, corner) => sum + corner.y, 0) / corners.length,
      weldedZ,
    );
    for (const ref of refList) {
      const plane = displayPlanes[ref.planeIndex];
      if (plane?.corners[ref.cornerIndex]) {
        plane.corners[ref.cornerIndex] = { ...welded };
      }
    }
  }

  return displayPlanes.map((plane) => ({
    ...plane,
    normal: roofPlaneNormalFromCorners(plane.corners, plane.normal),
  }));
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
  if (params.purlinPlacements.length === 0) {
    return params.structuralPlanes.map((plane) => ({ ...plane }));
  }
  const displayThicknessMeters =
    params.claddingDisplayThicknessMeters ?? CORRUGATED_SHEET_DISPLAY_THICKNESS_METERS;
  const displayPlanes = params.structuralPlanes.map((plane) => {
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
  return params.claddingRidgeStart && params.claddingRidgeEnd
    ? displayPlanes
    : weldSharedCladdingDisplayPlaneCorners({
        sourcePlanes: params.structuralPlanes,
        displayPlanes,
      });
}

function pairPlaneEaveToHighCorners(plane: RoofPlane): {
  eaveA: RoofVec3;
  eaveB: RoofVec3;
  highA: RoofVec3;
  highB: RoofVec3;
} | null {
  if (plane.corners.length < 3) return null;
  const cornersByY = [...plane.corners].sort((a, b) => a.y - b.y);
  const eaveA = cornersByY[0];
  const eaveB = cornersByY[1];
  if (!eaveA || !eaveB) return null;
  const highCorners = plane.corners.filter((corner) => corner !== eaveA && corner !== eaveB);
  if (highCorners.length === 0) return null;
  if (highCorners.length === 1) {
    return { eaveA, eaveB, highA: highCorners[0]!, highB: highCorners[0]! };
  }
  const [firstHigh, secondHigh] = highCorners;
  const directScore = planDistance(eaveA, firstHigh!) + planDistance(eaveB, secondHigh!);
  const crossedScore = planDistance(eaveA, secondHigh!) + planDistance(eaveB, firstHigh!);
  return directScore <= crossedScore
    ? { eaveA, eaveB, highA: firstHigh!, highB: secondHigh! }
    : { eaveA, eaveB, highA: secondHigh!, highB: firstHigh! };
}

function purlinCenterAboveHipFrameSurface(params: {
  plane: RoofPlane;
  planeNormal: RoofVec3;
  point: Pick<RoofVec3, 'x' | 'z'>;
}): RoofVec3 | null {
  const surfaceY = elevationOnRoofPlaneAtPoint(params.plane, params.point.x, params.point.z);
  if (surfaceY == null) return null;
  return offsetPointAlongRoofNormal(
    { x: params.point.x, y: surfaceY, z: params.point.z },
    params.planeNormal,
    TRUSS_CHORD_PROFILE_METERS / 2 + PURLIN_TO_CHORD_CLEARANCE_METERS + PURLIN_PROFILE_DEPTH_METERS / 2,
  );
}

function resolveHipPurlinPlacements(params: {
  roofTopPlanes: RoofPlane[];
  rowTs: number[];
  rowsPerSlope: number;
  actualSpacingMeters: number;
}): { rowsPerSlope: number; actualSpacingMeters: number; placements: PurlinPlacement[] } {
  const placements: PurlinPlacement[] = [];

  for (const plane of params.roofTopPlanes) {
    const paired = pairPlaneEaveToHighCorners(plane);
    if (!paired) continue;
    const planeNormal = normalizeOutwardRoofNormal(plane.normal);
    for (let rowIndex = 0; rowIndex < params.rowTs.length; rowIndex += 1) {
      const t = params.rowTs[rowIndex]!;
      let startPlan = lerpVec3(paired.eaveA, paired.highA, t);
      let endPlan = lerpVec3(paired.eaveB, paired.highB, t);
      if (rowIndex === 0) {
        const startInboard = normalize3(sub3(paired.highA, paired.eaveA));
        const endInboard = normalize3(sub3(paired.highB, paired.eaveB));
        const centerOffsetAlongNormal =
          TRUSS_CHORD_PROFILE_METERS / 2 + PURLIN_TO_CHORD_CLEARANCE_METERS + PURLIN_PROFILE_DEPTH_METERS / 2;
        const normalPlanOffsetMeters =
          Math.hypot(planeNormal.x, planeNormal.z) * centerOffsetAlongNormal;
        const inboardOffsetMeters = PURLIN_PROFILE_WIDTH_METERS / 2 + normalPlanOffsetMeters;
        startPlan = {
          x: startPlan.x + startInboard.x * inboardOffsetMeters,
          y: startPlan.y + startInboard.y * inboardOffsetMeters,
          z: startPlan.z + startInboard.z * inboardOffsetMeters,
        };
        endPlan = {
          x: endPlan.x + endInboard.x * inboardOffsetMeters,
          y: endPlan.y + endInboard.y * inboardOffsetMeters,
          z: endPlan.z + endInboard.z * inboardOffsetMeters,
        };
      }
      if (planDistance(startPlan, endPlan) < MIN_HIP_JACK_LENGTH_METERS) {
        continue;
      }
      const start = purlinCenterAboveHipFrameSurface({ plane, planeNormal, point: startPlan });
      const end = purlinCenterAboveHipFrameSurface({ plane, planeNormal, point: endPlan });
      if (!start || !end || length3(sub3(end, start)) < MIN_HIP_JACK_LENGTH_METERS) {
        continue;
      }
      placements.push({
        id: `${plane.id}-hip-purlin-${rowIndex}`,
        slopePlaneId: plane.id,
        rowIndex,
        start,
        end,
        planeNormal,
      });
    }
  }

  return {
    rowsPerSlope: params.rowsPerSlope,
    actualSpacingMeters: params.actualSpacingMeters,
    placements,
  };
}

function resolvePurlinPlacements(params: {
  roofType: RoofSystemSettings['roofType'];
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

  if (params.roofType === 'hip') {
    return resolveHipPurlinPlacements({
      roofTopPlanes: params.roofTopPlanes,
      rowTs,
      rowsPerSlope,
      actualSpacingMeters,
    });
  }

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

function interpolateRoofMemberPoint(start: RoofVec3, end: RoofVec3, point: PlanVec2): RoofVec3 {
  const span = { x: end.x - start.x, z: end.z - start.z };
  const spanLenSq = span.x * span.x + span.z * span.z || 1;
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * span.x + (point.z - start.z) * span.z) / spanLenSq));
  return {
    x: point.x,
    y: start.y + (end.y - start.y) * t,
    z: point.z,
  };
}

function hipMemberCenterlinePoint(point: RoofVec3): RoofVec3 {
  return {
    ...point,
    y: point.y + TRUSS_CHORD_PROFILE_METERS / 2,
  };
}

function stationsAlongSegment(
  lengthMeters: number,
  maxSpacingMeters: number,
  includeEnds: boolean,
  requiredStations: number[] = [],
): number[] {
  const resolution = resolveEvenStations(lengthMeters, maxSpacingMeters);
  const baseStations = includeEnds
    ? resolution.stations
    : resolution.stations.filter((station) => station > 0.05 && station < lengthMeters - 0.05);
  const minStation = includeEnds ? -0.001 : 0.05;
  const maxStation = includeEnds ? lengthMeters + 0.001 : lengthMeters - 0.05;
  const allStations = [
    ...baseStations,
    ...requiredStations.filter((station) => station > minStation && station < maxStation),
  ].sort((a, b) => a - b);
  const deduped: number[] = [];
  for (const station of allStations) {
    if (deduped.length === 0 || Math.abs(station - deduped[deduped.length - 1]!) > 0.05) {
      deduped.push(station);
    }
  }
  return deduped;
}

function addHipFramingMember(
  members: HipFramingMember[],
  member: Omit<HipFramingMember, 'lengthMeters' | 'source'>,
): void {
  const resolved = withHipMemberMetadata(member);
  if (resolved.lengthMeters >= MIN_HIP_JACK_LENGTH_METERS) {
    members.push(resolved);
  }
}

function resolveHipFramingMembers(params: {
  structuralBearing: readonly PlanVec2[];
  claddingBearing: readonly PlanVec2[];
  roofBeamTopY: number;
  claddingEaveY: number;
  maxSpacingMeters: number;
  hipInteriorTrussCount: number;
  ridgeStart?: RoofVec3;
  ridgeEnd?: RoofVec3;
  peakPoint?: RoofVec3;
}): HipFramingMember[] {
  const structuralEaveY = params.roofBeamTopY;
  const framingEaveY = params.claddingEaveY;
  const framingCorners = params.claddingBearing.map((point) => toVec3(point, framingEaveY));
  const members: HipFramingMember[] = [];

  if (params.peakPoint) {
    for (let index = 0; index < framingCorners.length; index += 1) {
      addHipFramingMember(members, {
        id: `hip-${index}`,
        start: hipMemberCenterlinePoint(framingCorners[index]!),
        end: hipMemberCenterlinePoint(params.peakPoint),
        memberKind: 'hip',
      });
    }
    return members;
  }

  if (!params.ridgeStart || !params.ridgeEnd || params.structuralBearing.length !== 4) {
    return members;
  }

  const ridgeStart = params.ridgeStart;
  const ridgeEnd = params.ridgeEnd;
  const ridgeStart2 = { x: ridgeStart.x, z: ridgeStart.z };
  const ridgeEnd2 = { x: ridgeEnd.x, z: ridgeEnd.z };
  const ridgeVector = sub2(ridgeEnd2, ridgeStart2);
  const ridgeLength = length2(ridgeVector);
  if (ridgeLength <= MIN_HIP_JACK_LENGTH_METERS) {
    return members;
  }
  const ridgeUnit = normalize2(ridgeVector);
  const ridgeMid = midpoint2(ridgeStart2, ridgeEnd2);

  addHipFramingMember(members, {
    id: 'hip-ridge',
    start: hipMemberCenterlinePoint(ridgeStart),
    end: hipMemberCenterlinePoint(ridgeEnd),
    memberKind: 'ridge',
  });

  const ridgeEnds = [ridgeStart, ridgeEnd] as const;
  for (const [cornerIndex, corner] of framingCorners.entries()) {
    const target = planDistance(corner, ridgeStart) <= planDistance(corner, ridgeEnd) ? ridgeStart : ridgeEnd;
    addHipFramingMember(members, {
      id: `hip-rafter-${cornerIndex}`,
      start: hipMemberCenterlinePoint(corner),
      end: hipMemberCenterlinePoint(target),
      memberKind: 'hip',
    });
  }

  const [structuralSideAStart, structuralSideAEnd, structuralSideBStart, structuralSideBEnd] = spanEdgesPerpendicularToRidge(
    params.structuralBearing,
    ridgeStart2,
    ridgeEnd2,
  );
  const [sideAStart, sideAEnd, sideBStart, sideBEnd] = spanEdgesPerpendicularToRidge(
    params.claddingBearing,
    ridgeStart2,
    ridgeEnd2,
  );
  const sideEdges = [
    { start: sideAStart, end: sideAEnd, id: 'a' },
    { start: sideBStart, end: sideBEnd, id: 'b' },
  ];
  const structuralSideEdges = [
    { start: structuralSideAStart, end: structuralSideAEnd, id: 'a' },
    { start: structuralSideBStart, end: structuralSideBEnd, id: 'b' },
  ];
  const hipInteriorTrussCount = Number.isFinite(params.hipInteriorTrussCount)
    ? Math.max(0, Math.round(params.hipInteriorTrussCount))
    : 0;

  const perpUnit = normalize2({ x: -ridgeUnit.z, z: ridgeUnit.x });
  const addRidgeSupportFrame = (frameId: string, ridgePoint: RoofVec3) => {
    const ridgePoint2 = { x: ridgePoint.x, z: ridgePoint.z };
    const sideBearingPoints = (edges: typeof sideEdges) =>
      edges
      .map((side, sideIndex) =>
        intersectRayWithSegment2D(
          ridgePoint2,
          sideIndex === 0 ? perpUnit : scale2(perpUnit, -1),
          side.start,
          side.end,
        ) ??
        intersectRayWithSegment2D(
          ridgePoint2,
          sideIndex === 0 ? scale2(perpUnit, -1) : perpUnit,
          side.start,
          side.end,
        ),
      )
      .filter((point): point is PlanVec2 => point != null);
    const structuralBearings = sideBearingPoints(structuralSideEdges);
    const eaveBearings = sideBearingPoints(sideEdges);
    if (structuralBearings.length !== 2 || eaveBearings.length !== 2) return;
    const left = hipMemberCenterlinePoint(toVec3(structuralBearings[0]!, structuralEaveY));
    const right = hipMemberCenterlinePoint(toVec3(structuralBearings[1]!, structuralEaveY));
    const leftTopChordStart = hipMemberCenterlinePoint(toVec3(eaveBearings[0]!, framingEaveY));
    const rightTopChordStart = hipMemberCenterlinePoint(toVec3(eaveBearings[1]!, framingEaveY));
    const apex = hipMemberCenterlinePoint(ridgePoint);
    addHipFramingMember(members, {
      id: `${frameId}-left`,
      start: leftTopChordStart,
      end: apex,
      memberKind: 'ridge_end_frame',
    });
    addHipFramingMember(members, {
      id: `${frameId}-right`,
      start: rightTopChordStart,
      end: apex,
      memberKind: 'ridge_end_frame',
    });
    addHipFramingMember(members, {
      id: `${frameId}-bottom`,
      start: left,
      end: right,
      memberKind: 'ridge_end_frame_bottom',
    });
    addHipFramingMember(members, {
      id: `${frameId}-web`,
      start: lerpVec3(left, right, 0.5),
      end: apex,
      memberKind: 'ridge_end_frame_web',
    });
  };

  const commonStations = stationsAlongSegment(ridgeLength, params.maxSpacingMeters, false);
  for (const station of commonStations) {
    const ridgePoint2 = add2(ridgeStart2, scale2(ridgeUnit, station));
    const ridgePoint = {
      x: ridgePoint2.x,
      y: ridgeStart.y + (ridgeEnd.y - ridgeStart.y) * (station / ridgeLength),
      z: ridgePoint2.z,
    };
    for (const [sideIndex, side] of sideEdges.entries()) {
      const sidePoint2 =
        intersectRayWithSegment2D(ridgePoint2, sideIndex === 0 ? perpUnit : scale2(perpUnit, -1), side.start, side.end) ??
        intersectRayWithSegment2D(ridgePoint2, sideIndex === 0 ? scale2(perpUnit, -1) : perpUnit, side.start, side.end);
      if (!sidePoint2) continue;
      addHipFramingMember(members, {
        id: `hip-common-${side.id}-${station.toFixed(3)}`,
        start: hipMemberCenterlinePoint(toVec3(sidePoint2, framingEaveY)),
        end: hipMemberCenterlinePoint(ridgePoint),
        memberKind: 'common',
      });
    }
  }

  for (const [endIndex, ridgePoint] of ridgeEnds.entries()) {
    const frameId = endIndex === 0 ? 'start' : 'end';
    addRidgeSupportFrame(`hip-ridge-end-frame-${frameId}`, ridgePoint);
  }

  for (let index = 1; index <= hipInteriorTrussCount; index += 1) {
    const fraction = index / (hipInteriorTrussCount + 1);
    addRidgeSupportFrame(`hip-ridge-interior-frame-${index}`, lerpVec3(ridgeStart, ridgeEnd, fraction));
  }

  const sideJackSupportPoints = ridgeEnds.flatMap((ridgePoint) => {
    const ridgePoint2 = { x: ridgePoint.x, z: ridgePoint.z };
    const jackStartPointGroups = [1 / 3, 2 / 3].map((fraction) => sideEdges.map((side) => {
      const sideLength = length2(sub2(side.end, side.start));
      const sideUnit = normalize2(sub2(side.end, side.start));
      const projectedRidgeStation = dot2(sub2(ridgePoint2, side.start), sideUnit);
      const nearestEndStation =
        planDistance(side.start, ridgePoint2) <= planDistance(side.end, ridgePoint2)
          ? 0
          : sideLength;
      const jackStartStation = nearestEndStation + (projectedRidgeStation - nearestEndStation) * fraction;
      return lerp2(side.start, side.end, jackStartStation / sideLength);
    }));
    return jackStartPointGroups.map((jackStartPoints) => ({
      x: jackStartPoints.reduce((sum, point) => sum + point.x, 0) / Math.max(1, jackStartPoints.length),
      z: jackStartPoints.reduce((sum, point) => sum + point.z, 0) / Math.max(1, jackStartPoints.length),
    }));
  });

  for (const [supportIndex, supportPoint] of sideJackSupportPoints.entries()) {
    const sideBearings = structuralSideEdges
      .map((side, sideIndex) =>
        intersectRayWithSegment2D(
          supportPoint,
          sideIndex === 0 ? perpUnit : scale2(perpUnit, -1),
          side.start,
          side.end,
        ) ??
        intersectRayWithSegment2D(
          supportPoint,
          sideIndex === 0 ? scale2(perpUnit, -1) : perpUnit,
          side.start,
          side.end,
        ),
      )
      .filter((point): point is PlanVec2 => point != null);
    if (sideBearings.length !== 2) continue;
    addHipFramingMember(members, {
      id: `hip-jack-bottom-chord-${supportIndex}`,
      start: hipMemberCenterlinePoint(toVec3(sideBearings[0]!, structuralEaveY)),
      end: hipMemberCenterlinePoint(toVec3(sideBearings[1]!, structuralEaveY)),
      memberKind: 'hip_jack_bottom_chord',
    });
  }

  for (const side of sideEdges) {
    const sideLength = length2(sub2(side.end, side.start));
    const sideUnit = normalize2(sub2(side.end, side.start));
    const sideMid = midpoint2(side.start, side.end);
    const inward = normalize2(sub2(ridgeMid, sideMid));
    const sideJackStations = ridgeEnds.map((ridgePoint) => {
      const ridgePoint2 = { x: ridgePoint.x, z: ridgePoint.z };
      const projectedRidgeStation = dot2(sub2(ridgePoint2, side.start), sideUnit);
      const nearestEndStation =
        planDistance(side.start, ridgePoint2) <= planDistance(side.end, ridgePoint2)
          ? 0
          : sideLength;
      return nearestEndStation + (projectedRidgeStation - nearestEndStation) / 3;
    });
    for (const station of sideJackStations.sort((a, b) => a - b)) {
      const eavePoint = lerp2(side.start, side.end, station / sideLength);
      const ridgeStation = dot2(sub2(eavePoint, ridgeStart2), ridgeUnit);
      if (ridgeStation >= -0.05 && ridgeStation <= ridgeLength + 0.05) {
        continue;
      }
      const targetRidge = ridgeStation < 0 ? ridgeStart : ridgeEnd;
      const targetRidge2 = { x: targetRidge.x, z: targetRidge.z };
      const sideCorner = planDistance(side.start, targetRidge2) <= planDistance(side.end, targetRidge2)
        ? side.start
        : side.end;
      const intersection = intersectRayWithSegment2D(eavePoint, inward, sideCorner, targetRidge2);
      if (!intersection) continue;
      const corner3 = toVec3(sideCorner, framingEaveY);
      const end = interpolateRoofMemberPoint(corner3, targetRidge, intersection);
      addHipFramingMember(members, {
        id: `hip-jack-long-${side.id}-${station.toFixed(3)}`,
        start: hipMemberCenterlinePoint(toVec3(eavePoint, framingEaveY)),
        end: hipMemberCenterlinePoint(end),
        memberKind: 'jack',
      });
    }
  }

  for (const [endIndex, ridgePoint] of ridgeEnds.entries()) {
    const ridgePoint2 = { x: ridgePoint.x, z: ridgePoint.z };
    const endCorners = params.claddingBearing
      .map((corner) => ({ corner, distance: planDistance(corner, ridgePoint2) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 2)
      .map((entry) => entry.corner);
    const [edgeStart, edgeEnd] = endCorners;
    if (!edgeStart || !edgeEnd) continue;
    const edgeLength = length2(sub2(edgeEnd, edgeStart));
    const inward = normalize2(sub2(ridgePoint2, midpoint2(edgeStart, edgeEnd)));
    const frameId = endIndex === 0 ? 'start' : 'end';
    const hipSideJackStations = [edgeLength / 6, edgeLength / 2, (edgeLength * 5) / 6];
    for (const station of stationsAlongSegment(edgeLength, params.maxSpacingMeters, false, hipSideJackStations)) {
      const eavePoint = lerp2(edgeStart, edgeEnd, station / edgeLength);
      const hipA = { start: edgeStart, end: ridgePoint2 };
      const hipB = { start: edgeEnd, end: ridgePoint2 };
      const hitA = intersectRayWithSegment2D(eavePoint, inward, hipA.start, hipA.end);
      const hitB = intersectRayWithSegment2D(eavePoint, inward, hipB.start, hipB.end);
      const hit = [hitA, hitB]
        .filter((point): point is PlanVec2 => point != null)
        .sort((a, b) => length2(sub2(a, eavePoint)) - length2(sub2(b, eavePoint)))[0];
      if (!hit) continue;
      const hipStart = hit === hitA ? edgeStart : edgeEnd;
      const hitsRidgePoint = planDistance(hit, ridgePoint2) < 0.01;
      const isOuterHipSideJack =
        station < edgeLength / 4 ||
        station > (edgeLength * 3) / 4;
      const end = interpolateRoofMemberPoint(toVec3(hipStart, framingEaveY), ridgePoint, hit);
      const lowerSideEdge = sideEdges.find(
        (side) =>
          planDistance(side.start, hipStart) < 0.01 ||
          planDistance(side.end, hipStart) < 0.01,
      );
      const lowerStart = (() => {
        if (!lowerSideEdge) {
          return eavePoint;
        }
        const sideInward = normalize2(sub2(ridgeMid, midpoint2(lowerSideEdge.start, lowerSideEdge.end)));
        return (
          intersectRayWithSegment2D(
            hit,
            scale2(sideInward, -1),
            lowerSideEdge.start,
            lowerSideEdge.end,
          ) ?? eavePoint
        );
      })();
      if (lowerSideEdge && !hitsRidgePoint && !isOuterHipSideJack) {
        addHipFramingMember(members, {
          id: `hip-corner-support-${frameId}-${station.toFixed(3)}`,
          start: hipMemberCenterlinePoint(toVec3(lowerStart, framingEaveY)),
          end: hipMemberCenterlinePoint(end),
          memberKind: 'hip_corner_support',
        });
      }
      addHipFramingMember(members, {
        id: `hip-jack-end-${frameId}-${station.toFixed(3)}`,
        start: hipMemberCenterlinePoint(toVec3(eavePoint, framingEaveY)),
        end: hipMemberCenterlinePoint(end),
        memberKind: 'jack',
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
      basePlateCenterInsetMeters: params.settings.steelTrusses.basePlateEnabled
        ? params.settings.steelTrusses.basePlateLengthMeters / 2
        : 0,
      fixedRoofSlope: params.fixedRoofSlope,
    });
  } else if (params.settings.roofType === 'hip') {
    hipFramingMembers = resolveHipFramingMembers({
      structuralBearing: params.structuralBearingPerimeter,
      claddingBearing: params.claddingPerimeter,
      roofBeamTopY: params.roofBeamTopY,
      claddingEaveY: claddingEaveElevationMeters({
        structuralEaveY: params.roofBeamTopY,
        fixedSlope: params.fixedRoofSlope,
        sideEaveOverhangMeters: params.sideEaveOverhangMeters,
      }),
      maxSpacingMeters: params.settings.steelTrusses.maxSpacingMeters,
      hipInteriorTrussCount: params.settings.steelTrusses.hipInteriorTrussCount,
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
      roofType: params.settings.roofType,
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
