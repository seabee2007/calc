import type { SegmentFrame } from '../geometry/designGeometry';
import type {
  GableEndRoofingClosure,
  PurlinPlacement,
  ResolvedRoofSystem,
  RoofPlane,
  RoofSystemSettings,
  RoofVec3,
  TrussPlacement,
} from '../types';
import {
  gableEndSegmentIdsForRidgeAxis,
  type RectangularFootprintAnalysis,
  type RidgeAxis,
} from './roofFootprintSupport';
import {
  CORRUGATED_SHEET_DISPLAY_THICKNESS_METERS,
  DEFAULT_RIDGE_CAP_THICKNESS_METERS,
  elevationOnRoofPlaneAtPoint,
  normalizeOutwardRoofNormal,
  offsetPointAlongRoofNormal,
  PURLIN_PROFILE_DEPTH_METERS,
  PURLIN_PROFILE_WIDTH_METERS,
  ROOF_RIDGE_CAP_CLEARANCE_METERS,
  TRUSS_CHORD_PROFILE_METERS,
} from './roofFramingResolver';

const PURLIN_CUTOUT_CLEARANCE_METERS = 0.006;

function vec3(x: number, y: number, z: number): RoofVec3 {
  return { x, y, z };
}

function offsetAlongNormal(point: RoofVec3, normal: RoofVec3, distanceMeters: number): RoofVec3 {
  return {
    x: point.x + normal.x * distanceMeters,
    y: point.y + normal.y * distanceMeters,
    z: point.z + normal.z * distanceMeters,
  };
}

function normalizeHorizontal(normal: RoofVec3): RoofVec3 {
  const len = Math.hypot(normal.x, normal.z) || 1;
  return vec3(normal.x / len, 0, normal.z / len);
}

function outwardTrussNormal(truss: TrussPlacement, frame: SegmentFrame): RoofVec3 {
  const horizontal = normalizeHorizontal(truss.planeNormal);
  const dot = horizontal.x * frame.outwardNormal.x + horizontal.z * frame.outwardNormal.z;
  return dot >= 0 ? horizontal : vec3(-horizontal.x, 0, -horizontal.z);
}

function endTrussForGableSegment(params: {
  trussPlacements: readonly TrussPlacement[];
  frame: SegmentFrame;
  claddingRidgeStart?: RoofVec3;
  claddingRidgeEnd?: RoofVec3;
}): TrussPlacement | null {
  if (params.trussPlacements.length === 0) {
    return null;
  }
  const { claddingRidgeStart, claddingRidgeEnd } = params;
  if (!claddingRidgeStart || !claddingRidgeEnd) {
    return params.trussPlacements[0] ?? null;
  }
  const wallCenter = {
    x: (params.frame.exteriorStart.x + params.frame.exteriorEnd.x) / 2,
    z: (params.frame.exteriorStart.z + params.frame.exteriorEnd.z) / 2,
  };
  const distStart = Math.hypot(
    wallCenter.x - claddingRidgeStart.x,
    wallCenter.z - claddingRidgeStart.z,
  );
  const distEnd = Math.hypot(wallCenter.x - claddingRidgeEnd.x, wallCenter.z - claddingRidgeEnd.z);
  return distStart <= distEnd
    ? params.trussPlacements[0]!
    : params.trussPlacements[params.trussPlacements.length - 1]!;
}

function sheetOuterOffsetMeters(): number {
  return TRUSS_CHORD_PROFILE_METERS / 2 + CORRUGATED_SHEET_DISPLAY_THICKNESS_METERS;
}

type GablePlane = {
  fixedAxis: 'x' | 'z';
  fixedValue: number;
  profileSpanAxis: 'x' | 'z';
};

function gablePlaneForEndTruss(endTruss: TrussPlacement): GablePlane {
  if (endTruss.ridgeAxis === 'z') {
    return {
      fixedAxis: 'z',
      fixedValue: endTruss.bearingLeft.z,
      profileSpanAxis: 'x',
    };
  }
  return {
    fixedAxis: 'x',
    fixedValue: endTruss.bearingLeft.x,
    profileSpanAxis: 'z',
  };
}

function spanCoord(point: RoofVec3, spanAxis: 'x' | 'z'): number {
  return spanAxis === 'x' ? point.x : point.z;
}

function pointOnGablePlane(plane: GablePlane, span: number, y: number): RoofVec3 {
  return plane.fixedAxis === 'x'
    ? vec3(plane.fixedValue, y, span)
    : vec3(span, y, plane.fixedValue);
}

function planPointOnGable(plane: GablePlane, span: number): { x: number; z: number } {
  return plane.fixedAxis === 'x'
    ? { x: plane.fixedValue, z: span }
    : { x: span, z: plane.fixedValue };
}

function sign(x: number, z: number, ax: number, az: number, bx: number, bz: number): number {
  return (x - bx) * (az - bz) - (ax - bx) * (z - bz);
}

function pointInTriangle2d(
  x: number,
  z: number,
  a: RoofVec3,
  b: RoofVec3,
  c: RoofVec3,
): boolean {
  const d1 = sign(x, z, a.x, a.z, b.x, b.z);
  const d2 = sign(x, z, b.x, b.z, c.x, c.z);
  const d3 = sign(x, z, c.x, c.z, a.x, a.z);
  const hasNegative = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPositive = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNegative && hasPositive);
}

function pointInRoofPlaneFootprint(plane: RoofPlane, x: number, z: number): boolean {
  if (plane.corners.length === 3) {
    const [a, b, c] = plane.corners;
    return pointInTriangle2d(x, z, a!, b!, c!);
  }
  if (plane.corners.length === 4) {
    const [a, b, c, d] = plane.corners;
    return (
      pointInTriangle2d(x, z, a!, b!, c!) ||
      pointInTriangle2d(x, z, a!, c!, d!)
    );
  }
  return false;
}

function pickDisplayPlaneForEaveCorner(
  displayPlanes: readonly RoofPlane[],
  corner: RoofVec3,
): RoofPlane | null {
  if (displayPlanes.length === 0) return null;
  for (const roofPlane of displayPlanes) {
    if (pointInRoofPlaneFootprint(roofPlane, corner.x, corner.z)) {
      return roofPlane;
    }
  }
  let bestPlane: RoofPlane | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const roofPlane of displayPlanes) {
    const minY = Math.min(...roofPlane.corners.map((point) => point.y));
    for (const eaveCorner of roofPlane.corners) {
      if (Math.abs(eaveCorner.y - minY) > 0.05) continue;
      const distance = Math.hypot(eaveCorner.x - corner.x, eaveCorner.z - corner.z);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestPlane = roofPlane;
      }
    }
  }
  return bestPlane;
}

function claddingUndersideOnRake(params: {
  displayPlane: RoofPlane | null;
  gablePlane: GablePlane;
  span: number;
  spanEave: number;
  spanRidge: number;
  yEave: number;
  peakY: number;
  apexTrimMeters: number;
}): number {
  const ridgeY = params.peakY - params.apexTrimMeters;
  if (params.displayPlane) {
    const { x, z } = planPointOnGable(params.gablePlane, params.span);
    const topY = elevationOnRoofPlaneAtPoint(params.displayPlane, x, z);
    if (topY != null) {
      return offsetPointAlongRoofNormal(
        { x, y: topY, z },
        normalizeOutwardRoofNormal(params.displayPlane.normal),
        -CORRUGATED_SHEET_DISPLAY_THICKNESS_METERS,
      ).y;
    }
  }
  const spanDelta = params.spanRidge - params.spanEave;
  if (Math.abs(spanDelta) <= 1e-6) {
    return ridgeY;
  }
  const t = (params.span - params.spanEave) / spanDelta;
  const clampedT = Math.max(0, Math.min(1, t));
  return params.yEave + (ridgeY - params.yEave) * clampedT;
}

type PurlinHit = {
  key: string;
  span: number;
  y: number;
  bottomY: number;
  halfSpanMeters: number;
};

function normalizeVector(vector: RoofVec3): RoofVec3 {
  const len = Math.hypot(vector.x, vector.y, vector.z) || 1;
  return vec3(vector.x / len, vector.y / len, vector.z / len);
}

function cross(a: RoofVec3, b: RoofVec3): RoofVec3 {
  return vec3(
    a.y * b.z - a.z * b.y,
    a.z * b.x - a.x * b.z,
    a.x * b.y - a.y * b.x,
  );
}

function purlinRunAxis(purlin: PurlinPlacement): RoofVec3 {
  return normalizeVector({
    x: purlin.end.x - purlin.start.x,
    y: purlin.end.y - purlin.start.y,
    z: purlin.end.z - purlin.start.z,
  });
}

function profileAxisComponent(axis: 'x' | 'z', vector: RoofVec3): number {
  return axis === 'x' ? vector.x : vector.z;
}

function purlinProfileCutout(params: {
  purlin: PurlinPlacement;
  plane: GablePlane;
  center: RoofVec3;
}): { bottomY: number; halfSpanMeters: number } {
  const normal = normalizeOutwardRoofNormal(params.purlin.planeNormal);
  const runAxis = purlinRunAxis(params.purlin);
  let widthAxis = normalizeVector(cross(runAxis, normal));
  if (Math.hypot(widthAxis.x, widthAxis.y, widthAxis.z) <= 1e-6) {
    widthAxis = params.plane.profileSpanAxis === 'x' ? vec3(1, 0, 0) : vec3(0, 0, 1);
  }

  const halfWidth = PURLIN_PROFILE_WIDTH_METERS / 2 + PURLIN_CUTOUT_CLEARANCE_METERS;
  const halfDepth = PURLIN_PROFILE_DEPTH_METERS / 2 + PURLIN_CUTOUT_CLEARANCE_METERS;
  const spanComponent =
    Math.abs(profileAxisComponent(params.plane.profileSpanAxis, widthAxis)) * halfWidth +
    Math.abs(profileAxisComponent(params.plane.profileSpanAxis, normal)) * halfDepth;
  const verticalComponent = Math.abs(widthAxis.y) * halfWidth + Math.abs(normal.y) * halfDepth;

  return {
    bottomY: params.center.y - verticalComponent,
    halfSpanMeters: Math.max(PURLIN_PROFILE_WIDTH_METERS / 2, spanComponent),
  };
}

function intersectPurlinWithGablePlane(
  purlin: PurlinPlacement,
  plane: GablePlane,
  toleranceMeters = 0.08,
): PurlinHit | null {
  const startFixed = plane.fixedAxis === 'x' ? purlin.start.x : purlin.start.z;
  const endFixed = plane.fixedAxis === 'x' ? purlin.end.x : purlin.end.z;
  const deltaFixed = endFixed - startFixed;

  if (Math.abs(deltaFixed) <= 1e-6) {
    if (Math.abs(startFixed - plane.fixedValue) > toleranceMeters) return null;
    const center = {
      x: (purlin.start.x + purlin.end.x) / 2,
      y: (purlin.start.y + purlin.end.y) / 2,
      z: (purlin.start.z + purlin.end.z) / 2,
    };
    const cutout = purlinProfileCutout({ purlin, plane, center });
    return {
      key: `${purlin.slopePlaneId}:${purlin.rowIndex}`,
      span:
        plane.profileSpanAxis === 'x'
          ? (purlin.start.x + purlin.end.x) / 2
          : (purlin.start.z + purlin.end.z) / 2,
      y: center.y,
      bottomY: cutout.bottomY,
      halfSpanMeters: cutout.halfSpanMeters,
    };
  }

  const t = (plane.fixedValue - startFixed) / deltaFixed;
  if (t < -0.02 || t > 1.02) return null;
  const clampedT = Math.max(0, Math.min(1, t));
  const center = {
    x: purlin.start.x + (purlin.end.x - purlin.start.x) * clampedT,
    y: purlin.start.y + (purlin.end.y - purlin.start.y) * clampedT,
    z: purlin.start.z + (purlin.end.z - purlin.start.z) * clampedT,
  };
  const span =
    plane.profileSpanAxis === 'x'
      ? center.x
      : center.z;
  const cutout = purlinProfileCutout({ purlin, plane, center });

  return {
    key: `${purlin.slopePlaneId}:${purlin.rowIndex}`,
    span,
    y: center.y,
    bottomY: cutout.bottomY,
    halfSpanMeters: cutout.halfSpanMeters,
  };
}

function uniquePurlinHits(hits: PurlinHit[]): PurlinHit[] {
  const byKey = new Map<string, PurlinHit>();
  for (const hit of hits) {
    const existing = byKey.get(hit.key);
    if (!existing || hit.y > existing.y) {
      byKey.set(hit.key, hit);
    }
  }
  return [...byKey.values()].sort((left, right) => left.span - right.span);
}

function polygonAreaSquareMeters(corners: readonly RoofVec3[]): number {
  if (corners.length < 3) return 0;
  let area = 0;
  const origin = corners[0]!;
  for (let index = 1; index < corners.length - 1; index += 1) {
    const ab = {
      x: corners[index]!.x - origin.x,
      y: corners[index]!.y - origin.y,
      z: corners[index]!.z - origin.z,
    };
    const ac = {
      x: corners[index + 1]!.x - origin.x,
      y: corners[index + 1]!.y - origin.y,
      z: corners[index + 1]!.z - origin.z,
    };
    const cross = {
      x: ab.y * ac.z - ab.z * ac.y,
      y: ab.z * ac.x - ab.x * ac.z,
      z: ab.x * ac.y - ab.y * ac.x,
    };
    area += Math.hypot(cross.x, cross.y, cross.z) / 2;
  }
  return area;
}

function appendEdgeWithPurlinNotches(params: {
  points: RoofVec3[];
  plane: GablePlane;
  spanFrom: number;
  spanTo: number;
  ascending: boolean;
  purlinHits: readonly PurlinHit[];
  meetingYAt: (span: number) => number;
  includeStartOverlaps?: boolean;
  includeEndOverlaps?: boolean;
  terminalY?: number;
}): void {
  const spanMin = Math.min(params.spanFrom, params.spanTo);
  const spanMax = Math.max(params.spanFrom, params.spanTo);
  const hitOverlapsSpan = (hit: PurlinHit, span: number) =>
    hit.span - hit.halfSpanMeters <= span && hit.span + hit.halfSpanMeters >= span;
  const hits = params.purlinHits.filter(
    (hit) =>
      (hit.span >= spanMin && hit.span <= spanMax) ||
      (params.includeStartOverlaps && hitOverlapsSpan(hit, params.spanFrom)) ||
      (params.includeEndOverlaps && hitOverlapsSpan(hit, params.spanTo)),
  );
  hits.sort((left, right) => (params.ascending ? left.span - right.span : right.span - left.span));

  const pushAtSpan = (span: number, y = params.meetingYAt(span)) => {
    params.points.push(pointOnGablePlane(params.plane, span, y));
  };

  const clampSpan = (span: number) => Math.max(spanMin, Math.min(spanMax, span));

  let cursor = params.spanFrom;
  for (const hit of hits) {
    const notchStartSpan = clampSpan(
      params.ascending ? hit.span - hit.halfSpanMeters : hit.span + hit.halfSpanMeters,
    );
    const notchEndSpan = clampSpan(
      params.ascending ? hit.span + hit.halfSpanMeters : hit.span - hit.halfSpanMeters,
    );
    const notchStartTopY = params.meetingYAt(notchStartSpan);
    const notchEndTopY = params.meetingYAt(notchEndSpan);
    const notchTopY = Math.min(notchStartTopY, notchEndTopY);
    if (hit.bottomY >= notchTopY - 0.002) {
      continue;
    }

    if (
      (params.ascending && notchStartSpan > cursor + 0.001) ||
      (!params.ascending && notchStartSpan < cursor - 0.001)
    ) {
      pushAtSpan(notchStartSpan, notchStartTopY);
    }

    params.points.push(pointOnGablePlane(params.plane, notchStartSpan, hit.bottomY));
    params.points.push(pointOnGablePlane(params.plane, notchEndSpan, hit.bottomY));
    pushAtSpan(notchEndSpan, notchEndTopY);

    cursor = notchEndSpan;
  }

  const terminalY = params.terminalY ?? params.meetingYAt(params.spanTo);
  if (
    (params.ascending && params.spanTo > cursor + 0.001) ||
    (!params.ascending && params.spanTo < cursor - 0.001)
  ) {
    pushAtSpan(params.spanTo, terminalY);
  }
}

function buildClosureForSegment(params: {
  segmentId: string;
  frame: SegmentFrame;
  roofBeamTopY: number;
  peakElevationMeters: number;
  endTruss: TrussPlacement;
  claddingDisplayPlanes: readonly RoofPlane[];
  purlinPlacements: readonly PurlinPlacement[];
}): GableEndRoofingClosure | null {
  const outward = outwardTrussNormal(params.endTruss, params.frame);
  const sheetOffset = sheetOuterOffsetMeters();
  const apexTrimMeters = DEFAULT_RIDGE_CAP_THICKNESS_METERS + ROOF_RIDGE_CAP_CLEARANCE_METERS;
  const plane = gablePlaneForEndTruss(params.endTruss);
  const spanLeft = spanCoord(params.endTruss.bearingLeft, plane.profileSpanAxis);
  const spanRight = spanCoord(params.endTruss.bearingRight, plane.profileSpanAxis);
  const spanRidge = spanCoord(params.endTruss.apex, plane.profileSpanAxis);
  const leftDisplayPlane = pickDisplayPlaneForEaveCorner(
    params.claddingDisplayPlanes,
    params.endTruss.bearingLeft,
  );
  const rightDisplayPlane = pickDisplayPlaneForEaveCorner(
    params.claddingDisplayPlanes,
    params.endTruss.bearingRight,
  );

  const leftMeetingYAt = (span: number) =>
    claddingUndersideOnRake({
      displayPlane: leftDisplayPlane,
      gablePlane: plane,
      span,
      spanEave: spanLeft,
      spanRidge,
      yEave: params.roofBeamTopY,
      peakY: params.peakElevationMeters,
      apexTrimMeters,
    });

  const rightMeetingYAt = (span: number) =>
    claddingUndersideOnRake({
      displayPlane: rightDisplayPlane,
      gablePlane: plane,
      span,
      spanEave: spanRight,
      spanRidge,
      yEave: params.roofBeamTopY,
      peakY: params.peakElevationMeters,
      apexTrimMeters,
    });

  const purlinHits = uniquePurlinHits(
    params.purlinPlacements
      .map((purlin) => intersectPurlinWithGablePlane(purlin, plane))
      .filter((hit): hit is PurlinHit => hit != null),
  );

  const inner: RoofVec3[] = [pointOnGablePlane(plane, spanLeft, params.roofBeamTopY)];

  appendEdgeWithPurlinNotches({
    points: inner,
    plane,
    spanFrom: spanLeft,
    spanTo: spanRidge,
    ascending: spanRidge >= spanLeft,
    purlinHits,
    meetingYAt: leftMeetingYAt,
    includeStartOverlaps: true,
  });

  appendEdgeWithPurlinNotches({
    points: inner,
    plane,
    spanFrom: spanRidge,
    spanTo: spanRight,
    ascending: spanRight >= spanRidge,
    purlinHits,
    meetingYAt: rightMeetingYAt,
    includeEndOverlaps: true,
    terminalY: params.roofBeamTopY,
  });

  const last = inner[inner.length - 1];
  if (
    !last ||
    Math.abs(spanCoord(last, plane.profileSpanAxis) - spanRight) > 0.001 ||
    Math.abs(last.y - params.roofBeamTopY) > 0.001
  ) {
    inner.push(pointOnGablePlane(plane, spanRight, params.roofBeamTopY));
  }

  const corners = inner.map((point) => offsetAlongNormal(point, outward, sheetOffset));

  return {
    id: `gable-end-roofing-${params.segmentId}`,
    hostWallSegmentId: params.segmentId,
    corners,
    outwardNormal: outward,
    profileSpanAxis: plane.profileSpanAxis,
    areaSquareMeters: polygonAreaSquareMeters(corners),
  };
}

export function resolveGableEndRoofingClosures(params: {
  roofSystem: RoofSystemSettings;
  analysis: RectangularFootprintAnalysis;
  ridgeAxis: RidgeAxis;
  segmentFrames: readonly SegmentFrame[];
  trussPlacements: readonly TrussPlacement[];
  resolvedRoof: Pick<
    ResolvedRoofSystem,
    | 'roofBeamTopElevationMeters'
    | 'peakElevationMeters'
    | 'claddingRidgeStart'
    | 'claddingRidgeEnd'
    | 'claddingDisplayPlanes'
    | 'purlinPlacements'
  >;
}): GableEndRoofingClosure[] {
  const { roofSystem, analysis, ridgeAxis, segmentFrames, trussPlacements, resolvedRoof } = params;
  if (
    roofSystem.roofType !== 'gable' ||
    !roofSystem.gable.closeInWithRoofingEnabled ||
    !roofSystem.corrugatedMetal.enabled ||
    !analysis.supported ||
    trussPlacements.length === 0
  ) {
    return [];
  }

  const displayPlanes =
    resolvedRoof.claddingDisplayPlanes.length > 0 ? resolvedRoof.claddingDisplayPlanes : [];

  const gableSegmentIds = gableEndSegmentIdsForRidgeAxis(analysis, ridgeAxis);
  const frameById = new Map(segmentFrames.map((frame) => [frame.segmentId, frame]));
  const closures: GableEndRoofingClosure[] = [];

  for (const segmentId of gableSegmentIds) {
    const frame = frameById.get(segmentId);
    if (!frame) {
      continue;
    }
    const endTruss = endTrussForGableSegment({
      trussPlacements,
      frame,
      claddingRidgeStart: resolvedRoof.claddingRidgeStart,
      claddingRidgeEnd: resolvedRoof.claddingRidgeEnd,
    });
    if (!endTruss) {
      continue;
    }
    const closure = buildClosureForSegment({
      segmentId,
      frame,
      roofBeamTopY: resolvedRoof.roofBeamTopElevationMeters,
      peakElevationMeters: resolvedRoof.peakElevationMeters,
      endTruss,
      claddingDisplayPlanes: displayPlanes,
      purlinPlacements: resolvedRoof.purlinPlacements,
    });
    if (closure && closure.areaSquareMeters > 0 && closure.corners.length >= 3) {
      closures.push(closure);
    }
  }

  return closures;
}

export function totalGableEndRoofingClosureAreaSquareMeters(
  closures: readonly GableEndRoofingClosure[],
): number {
  return closures.reduce((sum, closure) => sum + closure.areaSquareMeters, 0);
}

export function describeGableEndRoofingClosureBlockReason(params: {
  roofSystem: RoofSystemSettings;
  supported: boolean;
  trussCount: number;
}): string | null {
  const { roofSystem, supported, trussCount } = params;
  if (!roofSystem.gable.closeInWithRoofingEnabled) return null;
  if (roofSystem.roofType !== 'gable') return 'Gable end close-in requires a gable roof.';
  if (!roofSystem.enabled) return 'Enable the roof system to generate gable end close-in.';
  if (!roofSystem.corrugatedMetal.enabled) return 'Enable Corrugated Metal Roofing to generate gable end close-in.';
  if (!roofSystem.steelTrusses.enabled) return 'Enable steel trusses to generate gable end close-in.';
  if (!supported) return 'Roof generation requires a closed rectangular footprint.';
  if (trussCount <= 0) return 'Add steel trusses before generating gable end close-in.';
  return null;
}
