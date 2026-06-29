import {
  distancePointToLine2D,
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
import {
  selectTrussWebProfileForSpan,
  type TrussWebProfileId,
  type TrussWebProfileMode,
} from './trussWebProfiles';
import type {
  DesignWarning,
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
type PrimaryTopChordKind = 'top_chord_left' | 'top_chord_right';

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
  const lowerLeft = lerpVec3(leftBearing, rightBearing, 0.22);
  const lowerRight = lerpVec3(leftBearing, rightBearing, 0.78);
  const upperLeft = lerpVec3(leftBearing, apex, 0.72);
  const upperRight = lerpVec3(rightBearing, apex, 0.72);
  return [
    {
      id: `${trussId}-web-left-outer`,
      memberKind: 'diagonal_web',
      start: lowerLeft,
      end: upperLeft,
    },
    {
      id: `${trussId}-web-left-inner`,
      memberKind: 'diagonal_web',
      start: upperLeft,
      end: lowerCenter,
    },
    {
      id: `${trussId}-web-center`,
      memberKind: 'vertical_web',
      start: lowerCenter,
      end: apex,
    },
    {
      id: `${trussId}-web-right-inner`,
      memberKind: 'diagonal_web',
      start: lowerCenter,
      end: upperRight,
    },
    {
      id: `${trussId}-web-right-outer`,
      memberKind: 'diagonal_web',
      start: upperRight,
      end: lowerRight,
    },
  ];
}

function buildKingPostWebMembers(
  trussId: string,
  leftBearing: RoofVec3,
  rightBearing: RoofVec3,
  apex: RoofVec3,
): SteelMemberSegment[] {
  const center = lerpVec3(leftBearing, rightBearing, 0.5);
  return [
    {
      id: `${trussId}-king-post`,
      memberKind: 'vertical_web',
      start: center,
      end: apex,
    },
  ];
}

function buildQueenPostWebMembers(
  trussId: string,
  leftBearing: RoofVec3,
  rightBearing: RoofVec3,
  apex: RoofVec3,
): SteelMemberSegment[] {
  const b1 = lerpVec3(leftBearing, rightBearing, 1 / 3);
  const b2 = lerpVec3(leftBearing, rightBearing, 2 / 3);
  const t1 = lerpVec3(leftBearing, apex, 2 / 3);
  const t2 = lerpVec3(rightBearing, apex, 2 / 3);
  return [
    { id: `${trussId}-queen-post-left`, memberKind: 'vertical_web', start: b1, end: t1 },
    { id: `${trussId}-queen-post-right`, memberKind: 'vertical_web', start: b2, end: t2 },
    { id: `${trussId}-queen-web-left`, memberKind: 'diagonal_web', start: b1, end: apex },
    { id: `${trussId}-queen-web-right`, memberKind: 'diagonal_web', start: b2, end: apex },
  ];
}

function buildHoweWebMembers(
  trussId: string,
  leftBearing: RoofVec3,
  rightBearing: RoofVec3,
  apex: RoofVec3,
): SteelMemberSegment[] {
  const b25 = lerpVec3(leftBearing, rightBearing, 0.25);
  const b50 = lerpVec3(leftBearing, rightBearing, 0.5);
  const b75 = lerpVec3(leftBearing, rightBearing, 0.75);
  const t25 = lerpVec3(leftBearing, apex, 0.5);
  const t75 = lerpVec3(rightBearing, apex, 0.5);
  return [
    { id: `${trussId}-howe-vertical-left`, memberKind: 'vertical_web', start: b25, end: t25 },
    { id: `${trussId}-howe-vertical-center`, memberKind: 'vertical_web', start: b50, end: apex },
    { id: `${trussId}-howe-vertical-right`, memberKind: 'vertical_web', start: b75, end: t75 },
    { id: `${trussId}-howe-diag-left`, memberKind: 'diagonal_web', start: b25, end: apex },
    { id: `${trussId}-howe-diag-right`, memberKind: 'diagonal_web', start: b75, end: apex },
  ];
}

function buildDoubleFinkWebMembers(
  trussId: string,
  leftBearing: RoofVec3,
  rightBearing: RoofVec3,
  apex: RoofVec3,
): SteelMemberSegment[] {
  const b = (t: number) => lerpVec3(leftBearing, rightBearing, t);
  const lt = (t: number) => lerpVec3(leftBearing, apex, t);
  const rt = (t: number) => lerpVec3(rightBearing, apex, t);
  return [
    { id: `${trussId}-df-vertical-center`, memberKind: 'vertical_web', start: b(0.5), end: apex },
    { id: `${trussId}-df-left-post`, memberKind: 'vertical_web', start: b(0.25), end: lt(0.55) },
    { id: `${trussId}-df-right-post`, memberKind: 'vertical_web', start: b(0.75), end: rt(0.55) },
    { id: `${trussId}-df-left-diag-1`, memberKind: 'diagonal_web', start: b(0.125), end: lt(0.55) },
    { id: `${trussId}-df-left-diag-2`, memberKind: 'diagonal_web', start: b(0.375), end: lt(0.55) },
    { id: `${trussId}-df-right-diag-1`, memberKind: 'diagonal_web', start: b(0.625), end: rt(0.55) },
    { id: `${trussId}-df-right-diag-2`, memberKind: 'diagonal_web', start: b(0.875), end: rt(0.55) },
    { id: `${trussId}-df-left-to-apex`, memberKind: 'diagonal_web', start: b(0.375), end: apex },
    { id: `${trussId}-df-right-to-apex`, memberKind: 'diagonal_web', start: b(0.625), end: apex },
  ];
}

function buildDoubleHoweWebMembers(
  trussId: string,
  leftBearing: RoofVec3,
  rightBearing: RoofVec3,
  apex: RoofVec3,
): SteelMemberSegment[] {
  const b = (t: number) => lerpVec3(leftBearing, rightBearing, t);
  const lt = (t: number) => lerpVec3(leftBearing, apex, t);
  const rt = (t: number) => lerpVec3(rightBearing, apex, t);
  return [
    { id: `${trussId}-dh-center-post`, memberKind: 'vertical_web', start: b(0.5), end: apex },
    { id: `${trussId}-dh-left-post-outer`, memberKind: 'vertical_web', start: b(0.2), end: lt(0.4) },
    { id: `${trussId}-dh-left-post-inner`, memberKind: 'vertical_web', start: b(0.35), end: lt(0.7) },
    { id: `${trussId}-dh-right-post-inner`, memberKind: 'vertical_web', start: b(0.65), end: rt(0.7) },
    { id: `${trussId}-dh-right-post-outer`, memberKind: 'vertical_web', start: b(0.8), end: rt(0.4) },
    { id: `${trussId}-dh-left-diag-outer-1`, memberKind: 'diagonal_web', start: b(0.1), end: lt(0.4) },
    { id: `${trussId}-dh-left-diag-outer-2`, memberKind: 'diagonal_web', start: b(0.3), end: lt(0.4) },
    { id: `${trussId}-dh-left-diag-inner-1`, memberKind: 'diagonal_web', start: b(0.3), end: lt(0.7) },
    { id: `${trussId}-dh-left-diag-inner-2`, memberKind: 'diagonal_web', start: b(0.45), end: lt(0.7) },
    { id: `${trussId}-dh-left-to-apex`, memberKind: 'diagonal_web', start: b(0.45), end: apex },
    { id: `${trussId}-dh-right-diag-outer-1`, memberKind: 'diagonal_web', start: b(0.9), end: rt(0.4) },
    { id: `${trussId}-dh-right-diag-outer-2`, memberKind: 'diagonal_web', start: b(0.7), end: rt(0.4) },
    { id: `${trussId}-dh-right-diag-inner-1`, memberKind: 'diagonal_web', start: b(0.7), end: rt(0.7) },
    { id: `${trussId}-dh-right-diag-inner-2`, memberKind: 'diagonal_web', start: b(0.55), end: rt(0.7) },
    { id: `${trussId}-dh-right-to-apex`, memberKind: 'diagonal_web', start: b(0.55), end: apex },
  ];
}

function mirrorAcrossCenter(point: RoofVec3, leftBearing: RoofVec3, rightBearing: RoofVec3): RoofVec3 {
  const center = lerpVec3(leftBearing, rightBearing, 0.5);
  return {
    x: center.x * 2 - point.x,
    y: point.y,
    z: center.z * 2 - point.z,
  };
}

function buildTripleFinkWebMembers(
  trussId: string,
  leftBearing: RoofVec3,
  rightBearing: RoofVec3,
  apex: RoofVec3,
): SteelMemberSegment[] {
  const members: SteelMemberSegment[] = [];
  const b = (t: number) => lerpVec3(leftBearing, rightBearing, t);
  const lt = (t: number) => lerpVec3(leftBearing, apex, t);

  members.push({
    id: `${trussId}-tf-center-post`,
    memberKind: 'vertical_web',
    start: b(0.5),
    end: apex,
  });

  const leftPanels = [
    { bottom: 0.125, top: lt(0.35) },
    { bottom: 0.25, top: lt(0.55) },
    { bottom: 0.375, top: lt(0.75) },
  ];

  leftPanels.forEach((panel, index) => {
    members.push({
      id: `${trussId}-tf-left-post-${index + 1}`,
      memberKind: 'vertical_web',
      start: b(panel.bottom),
      end: panel.top,
    });
  });

  members.push(
    { id: `${trussId}-tf-left-diag-1`, memberKind: 'diagonal_web', start: b(0.0625), end: leftPanels[0]!.top },
    { id: `${trussId}-tf-left-diag-2`, memberKind: 'diagonal_web', start: b(0.1875), end: leftPanels[0]!.top },
    { id: `${trussId}-tf-left-diag-3`, memberKind: 'diagonal_web', start: b(0.1875), end: leftPanels[1]!.top },
    { id: `${trussId}-tf-left-diag-4`, memberKind: 'diagonal_web', start: b(0.3125), end: leftPanels[1]!.top },
    { id: `${trussId}-tf-left-diag-5`, memberKind: 'diagonal_web', start: b(0.3125), end: leftPanels[2]!.top },
    { id: `${trussId}-tf-left-diag-6`, memberKind: 'diagonal_web', start: b(0.4375), end: leftPanels[2]!.top },
    { id: `${trussId}-tf-left-to-apex`, memberKind: 'diagonal_web', start: b(0.4375), end: apex },
  );

  const mirrored = members
    .filter((member) => member.id.includes('-left-'))
    .map((member) => ({
      ...member,
      id: member.id.replace('-left-', '-right-'),
      start: mirrorAcrossCenter(member.start, leftBearing, rightBearing),
      end: member.end === apex ? apex : mirrorAcrossCenter(member.end, leftBearing, rightBearing),
    }));

  return [...members, ...mirrored];
}

function buildTrussWebMembers(params: {
  trussId: string;
  profileId: TrussWebProfileId;
  leftBearing: RoofVec3;
  rightBearing: RoofVec3;
  apex: RoofVec3;
}): SteelMemberSegment[] {
  switch (params.profileId) {
    case 'king_post':
      return buildKingPostWebMembers(params.trussId, params.leftBearing, params.rightBearing, params.apex);
    case 'queen_post':
      return buildQueenPostWebMembers(params.trussId, params.leftBearing, params.rightBearing, params.apex);
    case 'howe':
      return buildHoweWebMembers(params.trussId, params.leftBearing, params.rightBearing, params.apex);
    case 'double_fink':
      return buildDoubleFinkWebMembers(params.trussId, params.leftBearing, params.rightBearing, params.apex);
    case 'double_howe':
      return buildDoubleHoweWebMembers(params.trussId, params.leftBearing, params.rightBearing, params.apex);
    case 'triple_fink':
      return buildTripleFinkWebMembers(params.trussId, params.leftBearing, params.rightBearing, params.apex);
    case 'fink':
    default:
      return buildFinkWebMembers(params.trussId, params.leftBearing, params.rightBearing, params.apex);
  }
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
  webMembers: SteelMemberSegment[],
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
    ...webMembers,
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
  memberKind: PrimaryTopChordKind;
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

function distancePointToMemberPlanSegment(
  member: SteelMemberSegment,
  point: Pick<RoofVec3, 'x' | 'z'>,
): number {
  const t = planProjectionT(member, point);
  if (t == null) {
    return planDistance(point, member.start);
  }
  const clampedT = Math.max(0, Math.min(1, t));
  const projected = lerpVec3(member.start, member.end, clampedT);
  return planDistance(point, projected);
}

function topChordPlanDistanceForKind(params: {
  members: readonly SteelMemberSegment[];
  memberKind: PrimaryTopChordKind;
  point: Pick<RoofVec3, 'x' | 'z'>;
}): number {
  const primary = params.members.find((member) => member.memberKind === params.memberKind);
  if (!primary) return Number.POSITIVE_INFINITY;
  const extension = params.members.find(
    (member) => member.memberKind === topChordEaveExtensionKind(params.memberKind),
  );
  const candidates = extension ? [primary, extension] : [primary];
  return Math.min(
    ...candidates.map((member) =>
      distancePointToMemberPlanSegment(member, params.point),
    ),
  );
}

function isPrimaryTopChord(member: SteelMemberSegment): member is SteelMemberSegment & {
  memberKind: PrimaryTopChordKind;
} {
  return member.memberKind === 'top_chord_left' || member.memberKind === 'top_chord_right';
}

export function selectTopChordForRoofPlane(params: {
  plane: RoofPlane;
  referenceTruss: TrussPlacement;
  claddingRidgeStart: RoofVec3;
  claddingRidgeEnd: RoofVec3;
}): (SteelMemberSegment & { memberKind: PrimaryTopChordKind }) | null {
  const paired = pairEaveCornersToRidge(
    eaveCornersForPlane(params.plane),
    params.claddingRidgeStart,
    params.claddingRidgeEnd,
  );
  if (!paired) return null;

  const rowSamples = [0, 0.25, 0.5, 0.75, 0.95];
  const samples = rowSamples.flatMap((t) => [
    {
      x: paired.eaveAtStart.x + (params.claddingRidgeStart.x - paired.eaveAtStart.x) * t,
      z: paired.eaveAtStart.z + (params.claddingRidgeStart.z - paired.eaveAtStart.z) * t,
      weight: t === 0 ? 2 : 1,
    },
    {
      x: paired.eaveAtEnd.x + (params.claddingRidgeEnd.x - paired.eaveAtEnd.x) * t,
      z: paired.eaveAtEnd.z + (params.claddingRidgeEnd.z - paired.eaveAtEnd.z) * t,
      weight: t === 0 ? 2 : 1,
    },
  ]);
  const candidates = params.referenceTruss.members.filter(isPrimaryTopChord);
  if (candidates.length === 0) return null;

  return candidates
    .map((member) => ({
      member,
      score: samples.reduce(
        (sum, sample) =>
          sum +
          topChordPlanDistanceForKind({
            members: params.referenceTruss.members,
            memberKind: member.memberKind,
            point: sample,
          }) *
            sample.weight,
        0,
      ),
    }))
    .sort((left, right) => {
      if (left.score !== right.score) return left.score - right.score;
      return left.member.memberKind.localeCompare(right.member.memberKind);
    })[0]?.member ?? null;
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
  structuralTop: RoofVec3;
  ridgePoint: RoofVec3;
}): void {
  const memberStartAtBearing = length3(sub3(params.member.start, params.structuralTop)) <= TRUSS_VALIDATION_TOLERANCE_METERS;
  const memberEndAtBearing = length3(sub3(params.member.end, params.structuralTop)) <= TRUSS_VALIDATION_TOLERANCE_METERS;
  if (!memberStartAtBearing && !memberEndAtBearing) {
    throw new Error('Eave extension must terminate at the structural bearing top.');
  }

  const tail = memberStartAtBearing ? params.member.end : params.member.start;
  const outward = sub3(params.bearing, params.ridgePoint);
  const outwardPlanLength = Math.hypot(outward.x, outward.z) || 1;
  const outwardUnit = vec3(outward.x / outwardPlanLength, 0, outward.z / outwardPlanLength);
  const tailStation =
    (tail.x - params.bearing.x) * outwardUnit.x +
    (tail.z - params.bearing.z) * outwardUnit.z;
  if (tailStation <= TRUSS_VALIDATION_TOLERANCE_METERS) {
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
        structuralTop: topChord.start,
        ridgePoint: placement.apex,
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
        structuralTop: topChord.start,
        ridgePoint: placement.apex,
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

function isTopChordEaveExtension(member: SteelMemberSegment): boolean {
  return (
    member.memberKind === 'top_chord_left_eave_extension' ||
    member.memberKind === 'top_chord_right_eave_extension'
  );
}

function isEaveExtensionValidationError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.includes('eave extension') || error.message.includes('Eave extension');
}

function validateHipTrussPlacementKeepingStructuralCore(params: {
  placement: TrussPlacement;
  roofBeamTopY: number;
  basePlateThicknessMeters: number;
}): { placement: TrussPlacement; warnings: DesignWarning[] } {
  const structuralMembers = params.placement.members.filter(
    (member) => !isTopChordEaveExtension(member),
  );
  const eaveExtensions = params.placement.members.filter(isTopChordEaveExtension);
  const structuralPlacement = { ...params.placement, members: structuralMembers };

  validateTrussPlacement(
    structuralPlacement,
    params.roofBeamTopY,
    params.basePlateThicknessMeters,
  );

  if (eaveExtensions.length === 0) {
    return { placement: params.placement, warnings: [] };
  }

  const warnings: DesignWarning[] = [];
  const keptMembers = [...structuralMembers];
  for (const extension of eaveExtensions) {
    const candidatePlacement = {
      ...params.placement,
      members: [...structuralMembers, extension],
    };
    try {
      validateTrussPlacement(
        candidatePlacement,
        params.roofBeamTopY,
        params.basePlateThicknessMeters,
      );
      keptMembers.push(extension);
    } catch (error) {
      if (!isEaveExtensionValidationError(error)) {
        throw error;
      }
      warnings.push({
        code: 'hip_truss_eave_extension_invalid',
        message: `Skipped hip truss eave extension at station ${params.placement.stationMeters.toFixed(3)} m because the projected tail was invalid; structural truss was kept.`,
        severity: 'review',
      });
    }
  }

  const placement = { ...params.placement, members: keptMembers };
  validateTrussPlacement(placement, params.roofBeamTopY, params.basePlateThicknessMeters);
  return { placement, warnings };
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

function resolveInsetEndStations(
  lengthMeters: number,
  maxSpacingMeters: number,
  endInsetMeters: number,
): {
  count: number;
  actualSpacingMeters: number;
  stations: number[];
} {
  const inset = Math.max(0, Math.min(endInsetMeters, Math.max(0, lengthMeters / 2 - 0.001)));
  if (inset <= 0.001) {
    return resolveEvenStations(lengthMeters, maxSpacingMeters);
  }

  const supportedLengthMeters = Math.max(0.001, lengthMeters - inset * 2);
  const resolution = resolveEvenStations(supportedLengthMeters, maxSpacingMeters);
  return {
    count: resolution.count,
    actualSpacingMeters: resolution.actualSpacingMeters,
    stations: resolution.stations.map((station) => station + inset),
  };
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

export function spanEdgesPerpendicularToRidge(
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

export function resolveGableStructuralHalfRunDistancesFromRidge(params: {
  structuralBearing: readonly PlanVec2[];
  structuralRidgeStart: RoofVec3;
  structuralRidgeEnd: RoofVec3;
}): { halfRunA: number; halfRunB: number } | null {
  if (params.structuralBearing.length < 4) {
    return null;
  }
  const ridgeStart2 = {
    x: params.structuralRidgeStart.x,
    z: params.structuralRidgeStart.z,
  };
  const ridgeEnd2 = {
    x: params.structuralRidgeEnd.x,
    z: params.structuralRidgeEnd.z,
  };
  const [edgeAStart, edgeAEnd, edgeBStart, edgeBEnd] = spanEdgesPerpendicularToRidge(
    params.structuralBearing,
    ridgeStart2,
    ridgeEnd2,
  );
  const edgeAMid = midpoint2(edgeAStart, edgeAEnd);
  const edgeBMid = midpoint2(edgeBStart, edgeBEnd);
  const halfRunA = distancePointToLine2D(edgeAMid, ridgeStart2, ridgeEnd2);
  const halfRunB = distancePointToLine2D(edgeBMid, ridgeStart2, ridgeEnd2);
  if (!Number.isFinite(halfRunA) || !Number.isFinite(halfRunB)) {
    return null;
  }
  return { halfRunA, halfRunB };
}

export function resolveGableStructuralHalfRunFromRidge(params: {
  structuralBearing: readonly PlanVec2[];
  structuralRidgeStart: RoofVec3;
  structuralRidgeEnd: RoofVec3;
}): number {
  const distances = resolveGableStructuralHalfRunDistancesFromRidge(params);
  if (!distances) {
    return 0;
  }
  return (distances.halfRunA + distances.halfRunB) / 2;
}

type GableTrussPlacementResult = {
  placements: TrussPlacement[];
  warnings: DesignWarning[];
};

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
  webProfileMode: TrussWebProfileMode;
  manualWebProfileId?: TrussWebProfileId;
}): GableTrussPlacementResult {
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
    webProfileMode,
    manualWebProfileId,
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
  const placements: TrussPlacement[] = [];
  const warnings: DesignWarning[] = [];
  const maxExpectedTopChordLength =
    Math.hypot(structuralHalfRunMeters, peakY - bearingCenterY) + sideEaveOverhangMeters + 0.25;

  stations.forEach((station, index) => {
    if (station < -TRUSS_VALIDATION_TOLERANCE_METERS || station > ridgeLength + TRUSS_VALIDATION_TOLERANCE_METERS) {
      warnings.push({
        code: 'truss_station_outside_structural_ridge',
        message: `Skipped truss station ${station.toFixed(3)} m because it is outside the structural ridge length.`,
        severity: 'review',
      });
      return;
    }
    const t = ridgeLength <= 0.001 ? 0 : station / ridgeLength;
    const ridgePoint2 = lerp2(ridgeStart2, ridgeEnd2, t);
    const bearingLeftHit =
      intersectRayWithSegment2D(ridgePoint2, perp, edgeAStart, edgeAEnd) ??
      intersectRayWithSegment2D(ridgePoint2, { x: -perp.x, z: -perp.z }, edgeAStart, edgeAEnd);
    const bearingRightHit =
      intersectRayWithSegment2D(ridgePoint2, { x: -perp.x, z: -perp.z }, edgeBStart, edgeBEnd) ??
      intersectRayWithSegment2D(ridgePoint2, perp, edgeBStart, edgeBEnd);
    if (
      !bearingLeftHit ||
      !bearingRightHit ||
      planDistance(bearingLeftHit, ridgePoint2) <= TRUSS_VALIDATION_TOLERANCE_METERS ||
      planDistance(bearingRightHit, ridgePoint2) <= TRUSS_VALIDATION_TOLERANCE_METERS
    ) {
      warnings.push({
        code: 'truss_bearing_intersection_failed',
        message: `Skipped truss station ${station.toFixed(3)} m because bearing intersections could not be resolved.`,
        severity: 'review',
      });
      return;
    }
    const bearingLeft2 = bearingLeftHit;
    const bearingRight2 = bearingRightHit;

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
    const spanMeters = Math.hypot(
      bearingRight.x - bearingLeft.x,
      bearingRight.z - bearingLeft.z,
    );
    const webProfile = selectTrussWebProfileForSpan({
      spanMeters,
      mode: webProfileMode,
      manualProfileId: manualWebProfileId,
    });
    if (webProfile.warning) {
      warnings.push({
        code: webProfile.warningCode ?? 'truss_web_profile_missing',
        message: webProfile.warning,
        severity: 'review',
      });
    }
    if (webProfile.spanFt > 80 && webProfile.warningCode !== 'truss_span_requires_engineering_review') {
      warnings.push({
        code: 'truss_span_requires_engineering_review',
        message: `Truss span ${webProfile.spanFt.toFixed(1)} ft exceeds the conceptual range. Engineering review required.`,
        severity: 'review',
      });
    }
    const webMembers = buildTrussWebMembers({
      trussId,
      profileId: webProfile.profileId,
      leftBearing: leftTrussBearing,
      rightBearing: rightTrussBearing,
      apex,
    });
    if (
      webMembers.length === 0 ||
      (webProfile.profileId === 'king_post' &&
        webMembers.filter((member) => member.memberKind === 'vertical_web').length !== 1)
    ) {
      warnings.push({
        code: 'truss_web_profile_member_layout_empty',
        message: `Web profile ${webProfile.label} did not generate the expected web member layout.`,
        severity: 'review',
      });
    }
    const members = buildPrimaryTrussMembers(
      trussId,
      leftTrussBearing,
      rightTrussBearing,
      apex,
      webMembers,
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
      webProfileId: webProfile.profileId,
      webProfileLabel: webProfile.label,
      spanMeters,
      members,
    };
    validateTrussPlacement(placement, roofBeamTopY, basePlateThicknessMeters);
    const hasUnreasonableTopChord = members.some(
      (member) => member.memberKind.includes('top_chord') && trussMemberLength(member) > maxExpectedTopChordLength,
    );
    if (hasUnreasonableTopChord) {
      warnings.push({
        code: 'truss_top_chord_unreasonable_length',
        message: 'Truss top chord length exceeds expected roof span.',
        severity: 'review',
      });
    }
    placements.push(placement);
  });
  return { placements, warnings };
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
  const topChord = selectTopChordForRoofPlane({
    plane: params.plane,
    referenceTruss,
    claddingRidgeStart: params.claddingRidgeStart,
    claddingRidgeEnd: params.claddingRidgeEnd,
  });
  if (!topChord) {
    return null;
  }
  const topChordKind = topChord.memberKind;
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
  footprintPlanes?: readonly RoofPlane[];
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
  const footprintPlaneById = new Map(
    (params.footprintPlanes ?? []).map((plane) => [plane.id, plane]),
  );
  const displayPlanes = params.structuralPlanes.map((plane) => {
    const explicitFootprintPlane = footprintPlaneById.get(plane.id);
    const footprintPlane = explicitFootprintPlane ?? plane;
    const projectExplicitFootprint = explicitFootprintPlane !== undefined;
    const planeNormal = normalizeOutwardRoofNormal(plane.normal);
    const planePurlins = params.purlinPlacements.filter((purlin) => purlin.slopePlaneId === plane.id);
    if (planePurlins.length === 0) {
      return { ...footprintPlane };
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
      return { ...footprintPlane };
    }
    const offset = offsets[offsets.length - 1]!;
    const displayPlane = offsetRoofPlaneAlongNormal(footprintPlane, offset);
    const projectToDisplayPlane = (corner: RoofVec3): RoofVec3 => ({
      x: corner.x,
      y:
        elevationOnRoofPlaneAtPoint(displayPlane, corner.x, corner.z) ??
        displayPlane.corners[0]?.y ??
        corner.y,
      z: corner.z,
    });
    const paired =
      params.claddingRidgeStart && params.claddingRidgeEnd
        ? pairEaveCornersToRidge(
            eaveCornersForPlane(footprintPlane),
            params.claddingRidgeStart,
            params.claddingRidgeEnd,
          )
        : null;
    const corners =
      paired && params.claddingRidgeStart && params.claddingRidgeEnd
        ? footprintPlane.corners.map((corner, index) => {
            const rowT = rowStationOnSlope({
              point: corner,
              eaveAtStart: paired.eaveAtStart,
              eaveAtEnd: paired.eaveAtEnd,
              ridgeStart: params.claddingRidgeStart!,
              ridgeEnd: params.claddingRidgeEnd!,
            });
            if (rowT < 1 - PURLIN_ROW_STATION_TOLERANCE) {
              return projectToDisplayPlane(corner);
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
        : projectExplicitFootprint
          ? footprintPlane.corners.map(projectToDisplayPlane)
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
    const topChord = selectTopChordForRoofPlane({
      plane,
      referenceTruss,
      claddingRidgeStart: params.claddingRidgeStart,
      claddingRidgeEnd: params.claddingRidgeEnd,
    });
    if (!topChord) continue;
    const memberKind = topChord.memberKind;
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

type HipTrussPlacementResult = GableTrussPlacementResult & {
  actualSpacingMeters: number;
  stations: number[];
};

function dedupeSortedStations(stations: readonly number[]): number[] {
  const sorted = [...stations]
    .filter((station) => Number.isFinite(station))
    .sort((left, right) => left - right);
  const deduped: number[] = [];
  for (const station of sorted) {
    if (
      deduped.length === 0 ||
      Math.abs(station - deduped[deduped.length - 1]!) > TRUSS_VALIDATION_TOLERANCE_METERS * 5
    ) {
      deduped.push(station);
    }
  }
  return deduped;
}

function maxAdjacentStationSpacing(stations: readonly number[]): number {
  if (stations.length < 2) return 0;
  let maxSpacing = 0;
  for (let index = 1; index < stations.length; index += 1) {
    maxSpacing = Math.max(maxSpacing, stations[index]! - stations[index - 1]!);
  }
  return maxSpacing;
}

function resolveSideHitsAtRidgePoint(params: {
  ridgePoint: PlanVec2;
  perpUnit: PlanVec2;
  edges: readonly { start: PlanVec2; end: PlanVec2 }[];
}): PlanVec2[] {
  return params.edges
    .map((side, sideIndex) =>
      intersectRayWithSegment2D(
        params.ridgePoint,
        sideIndex === 0 ? params.perpUnit : scale2(params.perpUnit, -1),
        side.start,
        side.end,
      ) ??
      intersectRayWithSegment2D(
        params.ridgePoint,
        sideIndex === 0 ? scale2(params.perpUnit, -1) : params.perpUnit,
        side.start,
        side.end,
      ),
    )
    .filter((point): point is PlanVec2 => point != null);
}

function resolveHipTrussPlacements(params: {
  structuralBearing: readonly PlanVec2[];
  claddingBearing: readonly PlanVec2[];
  ridgeStart?: RoofVec3;
  ridgeEnd?: RoofVec3;
  roofBeamTopY: number;
  peakY: number;
  claddingEaveY: number;
  basePlateThicknessMeters: number;
  maxSpacingMeters: number;
  basePlateCenterInsetMeters: number;
  trussEndInsetMeters: number;
  fixedRoofSlope: number;
  hipInteriorTrussCount: number;
  webProfileMode: TrussWebProfileMode;
  manualWebProfileId?: TrussWebProfileId;
}): HipTrussPlacementResult {
  const placements: TrussPlacement[] = [];
  const warnings: DesignWarning[] = [];

  if (
    !params.ridgeStart ||
    !params.ridgeEnd ||
    params.structuralBearing.length !== 4 ||
    params.claddingBearing.length !== 4
  ) {
    warnings.push({
      code: 'hip_truss_station_missing',
      message: 'Skipped hip trusses because the hip roof structural ridge or bearing perimeter is incomplete.',
      severity: 'review',
    });
    return { placements, warnings, actualSpacingMeters: 0, stations: [] };
  }

  const ridgeStart = params.ridgeStart;
  const ridgeEnd = params.ridgeEnd;
  const ridgeStart2 = { x: ridgeStart.x, z: ridgeStart.z };
  const ridgeEnd2 = { x: ridgeEnd.x, z: ridgeEnd.z };
  const ridgeLength = planDistance(ridgeStart2, ridgeEnd2);
  if (ridgeLength <= TRUSS_VALIDATION_TOLERANCE_METERS) {
    warnings.push({
      code: 'hip_truss_station_missing',
      message: 'Skipped hip trusses because the hip roof structural ridge length could not be resolved.',
      severity: 'review',
    });
    return { placements, warnings, actualSpacingMeters: 0, stations: [] };
  }

  const ridgeUnit = normalize2(sub2(ridgeEnd2, ridgeStart2));
  const perpUnit = normalize2({ x: -ridgeUnit.z, z: ridgeUnit.x });
  const worldRidgeAxis = ridgeAxisWorld(ridgeStart, ridgeEnd);
  const trussResolution = resolveInsetEndStations(
    ridgeLength,
    params.maxSpacingMeters,
    params.trussEndInsetMeters,
  );
  const manualInteriorCount = Number.isFinite(params.hipInteriorTrussCount)
    ? Math.max(0, Math.round(params.hipInteriorTrussCount))
    : 0;
  const manualStations = Array.from({ length: manualInteriorCount }, (_, index) =>
    (ridgeLength * (index + 1)) / (manualInteriorCount + 1),
  );
  const stations = dedupeSortedStations([...trussResolution.stations, ...manualStations]);
  const actualSpacingMeters = maxAdjacentStationSpacing(stations);
  if (stations.length === 0) {
    warnings.push({
      code: 'hip_truss_station_missing',
      message: 'No valid hip truss stations were resolved along the structural ridge.',
      severity: 'review',
    });
  }
  if (actualSpacingMeters > params.maxSpacingMeters + TRUSS_VALIDATION_TOLERANCE_METERS) {
    warnings.push({
      code: 'hip_truss_spacing_exceeds_max',
      message: `Hip truss spacing ${actualSpacingMeters.toFixed(3)} m exceeds the configured maximum spacing ${params.maxSpacingMeters.toFixed(3)} m.`,
      severity: 'review',
    });
  }

  const structuralSides = spanEdgesPerpendicularToRidge(params.structuralBearing, ridgeStart2, ridgeEnd2);
  const claddingSides = spanEdgesPerpendicularToRidge(params.claddingBearing, ridgeStart2, ridgeEnd2);
  const structuralSideEdges = [
    { start: structuralSides[0], end: structuralSides[1] },
    { start: structuralSides[2], end: structuralSides[3] },
  ];
  const claddingSideEdges = [
    { start: claddingSides[0], end: claddingSides[1] },
    { start: claddingSides[2], end: claddingSides[3] },
  ];
  const bearingY = params.roofBeamTopY + params.basePlateThicknessMeters;
  const bearingCenterY = bearingY + TRUSS_CHORD_PROFILE_METERS / 2;

  stations.forEach((station) => {
    if (station < -TRUSS_VALIDATION_TOLERANCE_METERS || station > ridgeLength + TRUSS_VALIDATION_TOLERANCE_METERS) {
      warnings.push({
        code: 'hip_truss_station_missing',
        message: `Skipped hip truss station ${station.toFixed(3)} m because it is outside the structural ridge length.`,
        severity: 'review',
      });
      return;
    }

    const ridgeT = ridgeLength <= TRUSS_VALIDATION_TOLERANCE_METERS ? 0 : station / ridgeLength;
    const ridgePoint2 = lerp2(ridgeStart2, ridgeEnd2, ridgeT);
    const structuralHits = resolveSideHitsAtRidgePoint({
      ridgePoint: ridgePoint2,
      perpUnit,
      edges: structuralSideEdges,
    });
    if (structuralHits.length !== 2) {
      warnings.push({
        code: 'hip_truss_local_span_invalid',
        message: `Skipped hip truss station ${station.toFixed(3)} m because bearing intersections could not be resolved.`,
        severity: 'review',
      });
      return;
    }

    const bearingLeft2 = structuralHits[0]!;
    const bearingRight2 = structuralHits[1]!;
    const spanMeters = planDistance(bearingLeft2, bearingRight2);
    if (spanMeters <= MIN_HIP_JACK_LENGTH_METERS) {
      warnings.push({
        code: 'hip_truss_local_span_invalid',
        message: `Skipped hip truss station ${station.toFixed(3)} m because its local span is too short.`,
        severity: 'review',
      });
      return;
    }

    const claddingHits = resolveSideHitsAtRidgePoint({
      ridgePoint: ridgePoint2,
      perpUnit,
      edges: claddingSideEdges,
    });
    const bearingLeft = toVec3(bearingLeft2, bearingY);
    const bearingRight = toVec3(bearingRight2, bearingY);
    const leftTrussBearing = vec3(bearingLeft2.x, bearingCenterY, bearingLeft2.z);
    const rightTrussBearing = vec3(bearingRight2.x, bearingCenterY, bearingRight2.z);
    const basePlateCenterLeft = toVec3(
      insetPlanPointToward(bearingLeft2, ridgePoint2, params.basePlateCenterInsetMeters),
      bearingY,
    );
    const basePlateCenterRight = toVec3(
      insetPlanPointToward(bearingRight2, ridgePoint2, params.basePlateCenterInsetMeters),
      bearingY,
    );
    const apexY = Math.max(
      params.peakY,
      leftTrussBearing.y + params.fixedRoofSlope * planDistance(leftTrussBearing, ridgePoint2),
      rightTrussBearing.y + params.fixedRoofSlope * planDistance(rightTrussBearing, ridgePoint2),
    );
    const apex = vec3(ridgePoint2.x, apexY, ridgePoint2.z);
    const trussId = `hip-truss-${placements.length}`;
    const webProfile = selectTrussWebProfileForSpan({
      spanMeters,
      mode: params.webProfileMode,
      manualProfileId: params.manualWebProfileId,
    });
    if (webProfile.warning) {
      warnings.push({
        code: webProfile.warningCode === 'truss_web_profile_missing'
          ? 'hip_truss_web_profile_missing'
          : (webProfile.warningCode ?? 'hip_truss_web_profile_missing'),
        message: webProfile.warning,
        severity: 'review',
      });
    }
    if (webProfile.spanFt > 80 && webProfile.warningCode !== 'truss_span_requires_engineering_review') {
      warnings.push({
        code: 'truss_span_requires_engineering_review',
        message: `Hip truss span ${webProfile.spanFt.toFixed(1)} ft exceeds the conceptual range. Engineering review required.`,
        severity: 'review',
      });
    }

    const webMembers = buildTrussWebMembers({
      trussId,
      profileId: webProfile.profileId,
      leftBearing: leftTrussBearing,
      rightBearing: rightTrussBearing,
      apex,
    });
    if (webMembers.length === 0) {
      warnings.push({
        code: 'hip_truss_web_profile_missing',
        message: `Hip truss web profile ${webProfile.label} did not generate a web member layout.`,
        severity: 'review',
      });
    }

    const leftCladdingEave =
      claddingHits[0] && planDistance(claddingHits[0], bearingLeft2) > TRUSS_VALIDATION_TOLERANCE_METERS
        ? toVec3(claddingHits[0], params.claddingEaveY)
        : undefined;
    const rightCladdingEave =
      claddingHits[1] && planDistance(claddingHits[1], bearingRight2) > TRUSS_VALIDATION_TOLERANCE_METERS
        ? toVec3(claddingHits[1], params.claddingEaveY)
        : undefined;
    const members = buildPrimaryTrussMembers(
      trussId,
      leftTrussBearing,
      rightTrussBearing,
      apex,
      webMembers,
      leftCladdingEave,
      rightCladdingEave,
      leftTrussBearing,
      rightTrussBearing,
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
      planeNormal: buildTrussPlaneNormal(bearingLeft, bearingRight, apex),
      webProfileId: webProfile.profileId,
      webProfileLabel: webProfile.label,
      spanMeters,
      members,
    };

    try {
      const validated = validateHipTrussPlacementKeepingStructuralCore({
        placement,
        roofBeamTopY: params.roofBeamTopY,
        basePlateThicknessMeters: params.basePlateThicknessMeters,
      });
      warnings.push(...validated.warnings);
      placements.push(validated.placement);
    } catch (error) {
      warnings.push({
        code: 'hip_truss_local_span_invalid',
        message:
          error instanceof Error
            ? `Skipped hip truss station ${station.toFixed(3)} m: ${error.message}`
            : `Skipped hip truss station ${station.toFixed(3)} m because it failed validation.`,
        severity: 'review',
      });
    }
  });

  if (placements.length === 0) {
    warnings.push({
      code: 'hip_truss_station_missing',
      message: 'No hip truss placements were generated for the resolved hip roof.',
      severity: 'review',
    });
  }

  return {
    placements,
    warnings,
    actualSpacingMeters: maxAdjacentStationSpacing(placements.map((placement) => placement.stationMeters)),
    stations: placements.map((placement) => placement.stationMeters),
  };
}

function resolveHipJackRafters(params: {
  roofTopPlanes: readonly RoofPlane[];
  claddingBearing: readonly PlanVec2[];
  ridgeStart?: RoofVec3;
  ridgeEnd?: RoofVec3;
  maxSpacingMeters: number;
  claddingEaveY: number;
}): HipFramingMember[] {
  const members: HipFramingMember[] = [];
  if (!params.ridgeStart || !params.ridgeEnd || params.claddingBearing.length !== 4) {
    return members;
  }

  const addJack = (member: Omit<HipFramingMember, 'lengthMeters' | 'source'>) => {
    const duplicate = members.some(
      (existing) =>
        existing.slopePlaneId === member.slopePlaneId &&
        planDistance(existing.start, member.start) < 0.01 &&
        planDistance(existing.end, member.end) < 0.01,
    );
    if (!duplicate) {
      addHipFramingMember(members, member);
    }
  };

  for (const plane of params.roofTopPlanes.filter((item) => item.corners.length === 3)) {
    const paired = pairPlaneEaveToHighCorners(plane);
    if (!paired) continue;
    const eaveA = { x: paired.eaveA.x, z: paired.eaveA.z };
    const eaveB = { x: paired.eaveB.x, z: paired.eaveB.z };
    const high = paired.highA;
    const high2 = { x: high.x, z: high.z };
    const eaveLength = planDistance(eaveA, eaveB);
    if (eaveLength <= MIN_HIP_JACK_LENGTH_METERS) continue;
    const inward = normalize2(sub2(high2, midpoint2(eaveA, eaveB)));
    for (const station of stationsAlongSegment(eaveLength, params.maxSpacingMeters, false)) {
      const eavePoint = lerp2(eaveA, eaveB, station / eaveLength);
      const hitA = intersectRayWithSegment2D(eavePoint, inward, eaveA, high2);
      const hitB = intersectRayWithSegment2D(eavePoint, inward, eaveB, high2);
      const hit = [hitA, hitB]
        .filter((point): point is PlanVec2 => point != null)
        .sort((left, right) => planDistance(left, eavePoint) - planDistance(right, eavePoint))[0];
      if (!hit) continue;
      const hipStart = hit === hitA ? eaveA : eaveB;
      const end = interpolateRoofMemberPoint(toVec3(hipStart, params.claddingEaveY), high, hit);
      addJack({
        id: `hip-jack-end-${plane.id}-${station.toFixed(3)}`,
        start: hipMemberCenterlinePoint(toVec3(eavePoint, params.claddingEaveY)),
        end: hipMemberCenterlinePoint(end),
        memberKind: 'jack',
        slopePlaneId: plane.id,
      });
    }
  }

  for (const plane of params.roofTopPlanes.filter((item) => item.corners.length === 4)) {
    const paired = pairPlaneEaveToHighCorners(plane);
    if (!paired) continue;
    const eaveA = { x: paired.eaveA.x, z: paired.eaveA.z };
    const eaveB = { x: paired.eaveB.x, z: paired.eaveB.z };
    const highA = { x: paired.highA.x, z: paired.highA.z };
    const highB = { x: paired.highB.x, z: paired.highB.z };
    const eaveLength = planDistance(eaveA, eaveB);
    if (eaveLength <= MIN_HIP_JACK_LENGTH_METERS) continue;
    const eaveUnit = normalize2(sub2(eaveB, eaveA));
    const highAStation = Math.max(0, Math.min(eaveLength, dot2(sub2(highA, eaveA), eaveUnit)));
    const highBStation = Math.max(0, Math.min(eaveLength, dot2(sub2(highB, eaveA), eaveUnit)));
    const startHip =
      highAStation <= highBStation
        ? { corner: eaveA, high: paired.highA, station: highAStation }
        : { corner: eaveB, high: paired.highB, station: highBStation };
    const endHip =
      highAStation <= highBStation
        ? { corner: eaveB, high: paired.highB, station: highBStation }
        : { corner: eaveA, high: paired.highA, station: highAStation };
    const highMid = midpoint2(highA, highB);
    const inward = normalize2(sub2(highMid, midpoint2(eaveA, eaveB)));
    const intervals = [
      { from: 0, to: Math.min(highAStation, highBStation), hip: startHip, label: 'start' },
      { from: Math.max(highAStation, highBStation), to: eaveLength, hip: endHip, label: 'end' },
    ];

    for (const interval of intervals) {
      const intervalLength = interval.to - interval.from;
      if (intervalLength <= MIN_HIP_JACK_LENGTH_METERS) continue;
      for (const localStation of stationsAlongSegment(intervalLength, params.maxSpacingMeters, false)) {
        const station = interval.from + localStation;
        const eavePoint = lerp2(eaveA, eaveB, station / eaveLength);
        const hipHigh2 = { x: interval.hip.high.x, z: interval.hip.high.z };
        const hit = intersectRayWithSegment2D(eavePoint, inward, interval.hip.corner, hipHigh2);
        if (!hit) continue;
        const end = interpolateRoofMemberPoint(
          toVec3(interval.hip.corner, params.claddingEaveY),
          interval.hip.high,
          hit,
        );
        addJack({
          id: `hip-jack-side-${plane.id}-${interval.label}-${station.toFixed(3)}`,
          start: hipMemberCenterlinePoint(toVec3(eavePoint, params.claddingEaveY)),
          end: hipMemberCenterlinePoint(end),
          memberKind: 'jack',
          slopePlaneId: plane.id,
        });
      }
    }
  }

  return members;
}

function resolveHipFramingMembers(params: {
  structuralBearing: readonly PlanVec2[];
  claddingBearing: readonly PlanVec2[];
  roofTopPlanes: readonly RoofPlane[];
  roofBeamTopY: number;
  claddingEaveY: number;
  maxSpacingMeters: number;
  hipInteriorTrussCount: number;
  includeLegacySupportFrames: boolean;
  ridgeStart?: RoofVec3;
  ridgeEnd?: RoofVec3;
  peakPoint?: RoofVec3;
}): HipFramingMember[] {
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

  const [sideAStart, sideAEnd, sideBStart, sideBEnd] = spanEdgesPerpendicularToRidge(
    params.claddingBearing,
    ridgeStart2,
    ridgeEnd2,
  );
  const sideEdges = [
    { start: sideAStart, end: sideAEnd, id: 'a' },
    { start: sideBStart, end: sideBEnd, id: 'b' },
  ];
  const hipInteriorTrussCount = Number.isFinite(params.hipInteriorTrussCount)
    ? Math.max(0, Math.round(params.hipInteriorTrussCount))
    : 0;

  const perpUnit = normalize2({ x: -ridgeUnit.z, z: ridgeUnit.x });
  const addRidgeSupportFrame = (frameId: string, ridgePoint: RoofVec3) => {
    const ridgePoint2 = { x: ridgePoint.x, z: ridgePoint.z };
    const eaveBearings = sideEdges
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
    if (eaveBearings.length !== 2) return;
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
      id: `${frameId}-web`,
      start: lerpVec3(leftTopChordStart, rightTopChordStart, 0.5),
      end: apex,
      memberKind: 'ridge_end_frame_web',
    });
  };

  if (params.includeLegacySupportFrames) {
    for (const [endIndex, ridgePoint] of ridgeEnds.entries()) {
      const frameId = endIndex === 0 ? 'start' : 'end';
      addRidgeSupportFrame(`hip-ridge-end-frame-${frameId}`, ridgePoint);
    }

    for (let index = 1; index <= hipInteriorTrussCount; index += 1) {
      const fraction = index / (hipInteriorTrussCount + 1);
      addRidgeSupportFrame(`hip-ridge-interior-frame-${index}`, lerpVec3(ridgeStart, ridgeEnd, fraction));
    }
  }

  members.push(
    ...resolveHipJackRafters({
      roofTopPlanes: params.roofTopPlanes,
      claddingBearing: params.claddingBearing,
      ridgeStart,
      ridgeEnd,
      maxSpacingMeters: params.maxSpacingMeters,
      claddingEaveY: params.claddingEaveY,
    }),
  );

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
> & { framingWarnings: DesignWarning[] } {
  const bounds = buildExteriorRoofBeamBounds(
    params.structuralBearingPerimeter,
    params.roofBeamTopY,
    params.analysis,
  );

  const structuralRidgeStart = params.structuralRidgeStart ?? params.ridgeStart;
  const structuralRidgeEnd = params.structuralRidgeEnd ?? params.ridgeEnd;
  const claddingRidgeStart = params.claddingRidgeStart ?? params.ridgeStart;
  const claddingRidgeEnd = params.claddingRidgeEnd ?? params.ridgeEnd;
  const framingWarnings: DesignWarning[] = [];

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
    const structuralRidgeLengthMeters = Math.hypot(
      structuralRidgeEnd.x - structuralRidgeStart.x,
      structuralRidgeEnd.z - structuralRidgeStart.z,
    );
    const trussEndInsetMeters = params.settings.steelTrusses.basePlateEnabled
      ? params.settings.steelTrusses.basePlateWidthMeters / 2
      : 0;
    if (structuralRidgeLengthMeters <= TRUSS_VALIDATION_TOLERANCE_METERS) {
      framingWarnings.push({
        code: 'truss_structural_ridge_unresolved',
        message: 'Skipped steel trusses because the structural ridge length could not be resolved.',
        severity: 'review',
      });
    } else {
      const trussResolution = resolveInsetEndStations(
        structuralRidgeLengthMeters,
        params.settings.steelTrusses.maxSpacingMeters,
        trussEndInsetMeters,
      );
      actualTrussSpacingMeters = trussResolution.actualSpacingMeters;
      const trussPlacementResult = resolveGableTrussPlacements({
        bearing: params.structuralBearingPerimeter,
        ridgeStart: structuralRidgeStart,
        ridgeEnd: structuralRidgeEnd,
        peakY: params.peakY,
        roofBeamTopY: params.roofBeamTopY,
        basePlateThicknessMeters: params.settings.steelTrusses.basePlateEnabled
          ? params.settings.steelTrusses.basePlateThicknessMeters
          : 0,
        stations: trussResolution.stations,
        structuralHalfRunMeters: params.structuralHalfRunMeters,
        sideEaveOverhangMeters: params.sideEaveOverhangMeters,
        basePlateCenterInsetMeters: params.settings.steelTrusses.basePlateEnabled
          ? params.settings.steelTrusses.basePlateLengthMeters / 2
          : 0,
        fixedRoofSlope: params.fixedRoofSlope,
        webProfileMode: params.settings.steelTrusses.webProfileMode,
        manualWebProfileId: params.settings.steelTrusses.manualWebProfileId,
      });
      framingWarnings.push(...trussPlacementResult.warnings);
      trussPlacements = trussPlacementResult.placements;
      trussStations = trussPlacements.map((placement) => placement.stationMeters);
      trussCount = trussPlacements.length;
    }
  } else if (params.settings.roofType === 'hip') {
    const claddingEaveY = claddingEaveElevationMeters({
      structuralEaveY: params.roofBeamTopY,
      fixedSlope: params.fixedRoofSlope,
      sideEaveOverhangMeters: params.sideEaveOverhangMeters,
    });
    if (
      params.settings.steelTrusses.enabled &&
      !params.peakPoint &&
      structuralRidgeStart &&
      structuralRidgeEnd
    ) {
      const hipTrussPlacementResult = resolveHipTrussPlacements({
        structuralBearing: params.structuralBearingPerimeter,
        claddingBearing: params.claddingPerimeter,
        ridgeStart: structuralRidgeStart,
        ridgeEnd: structuralRidgeEnd,
        roofBeamTopY: params.roofBeamTopY,
        peakY: params.peakY,
        claddingEaveY,
        basePlateThicknessMeters: params.settings.steelTrusses.basePlateEnabled
          ? params.settings.steelTrusses.basePlateThicknessMeters
          : 0,
        maxSpacingMeters: params.settings.steelTrusses.maxSpacingMeters,
        basePlateCenterInsetMeters: params.settings.steelTrusses.basePlateEnabled
          ? params.settings.steelTrusses.basePlateLengthMeters / 2
          : 0,
        trussEndInsetMeters: params.settings.steelTrusses.basePlateEnabled
          ? params.settings.steelTrusses.basePlateWidthMeters / 2
          : 0,
        fixedRoofSlope: params.fixedRoofSlope,
        hipInteriorTrussCount: params.settings.steelTrusses.hipInteriorTrussCount,
        webProfileMode: params.settings.steelTrusses.webProfileMode,
        manualWebProfileId: params.settings.steelTrusses.manualWebProfileId,
      });
      framingWarnings.push(...hipTrussPlacementResult.warnings);
      trussPlacements = hipTrussPlacementResult.placements;
      trussStations = hipTrussPlacementResult.stations;
      actualTrussSpacingMeters = hipTrussPlacementResult.actualSpacingMeters;
      trussCount = trussPlacements.length;
    }

    hipFramingMembers = resolveHipFramingMembers({
      structuralBearing: params.structuralBearingPerimeter,
      claddingBearing: params.claddingPerimeter,
      roofTopPlanes: params.roofTopPlanes,
      roofBeamTopY: params.roofBeamTopY,
      claddingEaveY,
      maxSpacingMeters: params.settings.steelTrusses.maxSpacingMeters,
      hipInteriorTrussCount: params.settings.steelTrusses.hipInteriorTrussCount,
      includeLegacySupportFrames: trussPlacements.length === 0,
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
    framingWarnings,
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
  const ridgeCapY = Math.max(params.ridgeStart.y, params.ridgeEnd.y);
  const placement: RidgeCapPlacement = {
    id: 'ridge-cap',
    start: { ...params.ridgeStart, y: ridgeCapY },
    end: { ...params.ridgeEnd, y: ridgeCapY },
    widthMeters: DEFAULT_RIDGE_CAP_WIDTH_METERS,
    thicknessMeters: DEFAULT_RIDGE_CAP_THICKNESS_METERS,
    roofAngleRadians: Math.atan2(params.rafterRiseMeters, params.rafterRunMeters),
  };
  validateRidgeCapPlacement(placement);
  return placement;
}
