import type {
  DesignWarning,
  DesignWallLayoutParameters,
  ResolvedRoofSystem,
  RidgeCapPlacement,
  RoofPlane,
  RoofSystemSettings,
  RoofVec3,
} from '../types';
import {
  analyzeRectangularFootprint,
  distancePointToLine2D,
  filterExteriorGableEndSegmentIds,
  gableEndSegmentIdsForRidgeAxis,
  longEdgesAreEven,
  midpoint2,
  resolveCladdingPerimeterFromBearing,
  resolveRidgeAxis,
  type PlanVec2,
  type RectangularFootprintAnalysis,
  type RidgeAxis,
  UNSUPPORTED_ROOF_FOOTPRINT_MESSAGE,
} from './roofFootprintSupport';
import {
  assertGableEndOverhangMeters,
  extendRidgeEndpointsForGableOverhang,
  gableEndOutwardNormal2D,
  resolveCladdingPerimeterWithOverhangs,
  resolveFixedRoofPitch,
  claddingEaveElevationMeters,
  claddingHorizontalRunMeters,
  ridgeLengthMeters,
} from './roofOverhangSupport';
import {
  buildCladdingDisplayPlanes,
  claddingRidgePointOnDisplayPlanes,
  DEFAULT_RIDGE_CAP_THICKNESS_METERS,
  DEFAULT_RIDGE_CAP_WIDTH_METERS,
  HIP_SHEET_SEAM_WELD_ALLOWANCE_METERS,
  ROOF_SHEET_EAVE_OVERHANG_METERS,
  resolveGableStructuralHalfRunDistancesFromRidge,
  resolveGableStructuralHalfRunFromRidge,
  resolveRoofFraming,
  resolveRidgeCapPlacement,
} from './roofFramingResolver';
import { validateStrictOrthogonalFootprint } from './wallFootprintValidation';
import {
  dedupeDesignWarnings,
  validateResolvedRoofGeometry,
} from './roofGeometryValidation';
import type { SegmentFrame } from '../geometry/designGeometry';
import { resolveGableEndRoofingClosures } from './gableEndRoofingClosureSolver';
import { resolveRoofFasciaPlacements } from './roofFasciaSolver';
import { resolveRoofSoffitPlacements } from './roofSoffitSolver';

const ROOF_RENDER_EPSILON_METERS = 0.001;
const GABLE_HALF_RUN_ASYMMETRY_TOLERANCE_METERS = 0.01;

function vec3(x: number, y: number, z: number): RoofVec3 {
  return { x, y, z };
}

type SolvedRoofDatum = {
  structuralBearingPerimeter: RoofVec3[];
  claddingPerimeter: RoofVec3[];
  roofSheetPerimeter: RoofVec3[];
  structuralRidgeStart?: RoofVec3;
  structuralRidgeEnd?: RoofVec3;
  claddingRidgeStart?: RoofVec3;
  claddingRidgeEnd?: RoofVec3;
  structuralRidgeLengthMeters: number;
  claddingRidgeLengthMeters: number;
  roofBeamTopY: number;
  structuralEaveY: number;
  claddingEaveY: number;
  peakY: number;
  roofTopPlanes: RoofPlane[];
  roofUndersidePlanes: RoofPlane[];
};

function toVec3(point: PlanVec2, y: number): RoofVec3 {
  return vec3(point.x, y, point.z);
}

function planeNormal(a: RoofVec3, b: RoofVec3, c: RoofVec3): RoofVec3 {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abz = b.z - a.z;
  const acx = c.x - a.x;
  const acy = c.y - a.y;
  const acz = c.z - a.z;
  const nx = aby * acz - abz * acy;
  const ny = abz * acx - abx * acz;
  const nz = abx * acy - aby * acx;
  const len = Math.hypot(nx, ny, nz) || 1;
  return { x: nx / len, y: ny / len, z: nz / len };
}

function triangleArea(a: RoofVec3, b: RoofVec3, c: RoofVec3): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abz = b.z - a.z;
  const acx = c.x - a.x;
  const acy = c.y - a.y;
  const acz = c.z - a.z;
  const cx = aby * acz - abz * acy;
  const cy = abz * acx - abx * acz;
  const cz = abx * acy - aby * acx;
  return Math.hypot(cx, cy, cz) / 2;
}

function quadArea(a: RoofVec3, b: RoofVec3, c: RoofVec3, d: RoofVec3): number {
  return triangleArea(a, b, c) + triangleArea(a, c, d);
}

function offsetPlaneDown(plane: RoofPlane, thicknessMeters: number): RoofPlane {
  return {
    id: `${plane.id}-underside`,
    corners: plane.corners.map((corner) => ({
      x: corner.x,
      y: corner.y - thicknessMeters,
      z: corner.z,
    })),
    normal: plane.normal,
  };
}

function roofPointKey(point: RoofVec3): string {
  return `${point.x.toFixed(3)}:${point.z.toFixed(3)}`;
}

function canonicalRoofEdgeKey(start: RoofVec3, end: RoofVec3): string {
  const startKey = roofPointKey(start);
  const endKey = roofPointKey(end);
  return startKey <= endKey ? `${startKey}|${endKey}` : `${endKey}|${startKey}`;
}

function resolveHipRidgeCapPlacements(params: {
  roofType: RoofSystemSettings['roofType'];
  sourcePlanes: readonly RoofPlane[];
  displayPlanes: readonly RoofPlane[];
  enabled: boolean;
  roofPitchRadians: number;
}): RidgeCapPlacement[] {
  if (!params.enabled || params.roofType !== 'hip') {
    return [];
  }

  const displayPlaneBySourceId = new Map(
    params.displayPlanes.map((plane) => [plane.id.replace(/-cladding-display$/, ''), plane]),
  );
  const displayTopYAtPoint = (point: RoofVec3): number => {
    const sourceMatches = params.sourcePlanes.filter((plane) =>
      pointInRoofPlaneFootprint(plane, point.x, point.z),
    );
    const sourceElevations = sourceMatches
      .map((plane) => displayPlaneBySourceId.get(plane.id) ?? params.displayPlanes.find((item) => item.id === plane.id))
      .map((plane) => (plane ? elevationOnRoofPlaneAtPoint(plane, point.x, point.z) : null))
      .filter((y): y is number => y != null && Number.isFinite(y));
    if (sourceElevations.length > 0) {
      return sourceElevations.sort((a, b) => b - a)[0]!;
    }
    const fallbackElevations = params.displayPlanes
      .filter((plane) => pointInRoofPlaneFootprint(plane, point.x, point.z))
      .map((plane) => elevationOnRoofPlaneAtPoint(plane, point.x, point.z))
      .filter((y): y is number => y != null && Number.isFinite(y));
    return fallbackElevations.sort((a, b) => b - a)[0] ?? point.y;
  };

  const edges = new Map<string, { start: RoofVec3; end: RoofVec3; planeIds: Set<string> }>();
  for (const plane of params.sourcePlanes) {
    for (let index = 0; index < plane.corners.length; index += 1) {
      const start = plane.corners[index]!;
      const end = plane.corners[(index + 1) % plane.corners.length]!;
      if (Math.hypot(end.x - start.x, end.z - start.z) <= 0.05) {
        continue;
      }
      const key = canonicalRoofEdgeKey(start, end);
      const existing = edges.get(key);
      if (existing) {
        existing.planeIds.add(plane.id);
      } else {
        edges.set(key, { start, end, planeIds: new Set([plane.id]) });
      }
    }
  }

  return [...edges.values()]
    .filter((edge) => edge.planeIds.size >= 2)
    .map((edge) => {
      return {
        ...edge,
        start: { ...edge.start, y: displayTopYAtPoint(edge.start) },
        end: { ...edge.end, y: displayTopYAtPoint(edge.end) },
      };
    })
    .sort((a, b) => {
      const aHorizontal = Math.abs(a.start.y - a.end.y) <= 0.01 ? 1 : 0;
      const bHorizontal = Math.abs(b.start.y - b.end.y) <= 0.01 ? 1 : 0;
      if (aHorizontal !== bHorizontal) return aHorizontal - bHorizontal;
      return (
        Math.hypot(b.end.x - b.start.x, b.end.z - b.start.z) -
        Math.hypot(a.end.x - a.start.x, a.end.z - a.start.z)
      );
    })
    .map((edge, index) => ({
      id: `hip-ridge-cap-${index}`,
      start: edge.start,
      end: edge.end,
      widthMeters: DEFAULT_RIDGE_CAP_WIDTH_METERS,
      thicknessMeters: DEFAULT_RIDGE_CAP_THICKNESS_METERS,
      roofAngleRadians: params.roofPitchRadians,
      adjacentPlaneIds: [...edge.planeIds],
    }));
}

function ridgeEndpointsForAxis(params: {
  bearing: readonly PlanVec2[];
  ridgeAxis: RidgeAxis;
  peakY: number;
}): { ridgeStart: RoofVec3; ridgeEnd: RoofVec3 } {
  const { bearing, ridgeAxis, peakY } = params;
  const evenLong = longEdgesAreEven(bearing);
  const ridgeParallelToEvenEdges =
    (ridgeAxis === 'localX' && evenLong) || (ridgeAxis === 'localZ' && !evenLong);

  if (ridgeParallelToEvenEdges) {
    return {
      ridgeStart: toVec3(midpoint2(bearing[3]!, bearing[0]!), peakY),
      ridgeEnd: toVec3(midpoint2(bearing[2]!, bearing[1]!), peakY),
    };
  }
  return {
    ridgeStart: toVec3(midpoint2(bearing[0]!, bearing[1]!), peakY),
    ridgeEnd: toVec3(midpoint2(bearing[3]!, bearing[2]!), peakY),
  };
}

function dist2(a: PlanVec2, b: PlanVec2): number {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

function normalizedPlanVector(start: PlanVec2, end: PlanVec2): PlanVec2 {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const length = Math.hypot(dx, dz) || 1;
  return { x: dx / length, z: dz / length };
}

function centerOfPerimeter(points: readonly PlanVec2[]): PlanVec2 {
  const count = points.length || 1;
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / count,
    z: points.reduce((sum, point) => sum + point.z, 0) / count,
  };
}

function hipRidgeEndpointsForAxis(params: {
  perimeter: readonly PlanVec2[];
  ridgeAxis: RidgeAxis;
  peakY: number;
}): {
  ridgeStart?: RoofVec3;
  ridgeEnd?: RoofVec3;
  ridgeLengthMeters: number;
  isPyramid: boolean;
  ridgeParallelToEvenEdges: boolean;
  apex: RoofVec3;
} {
  const { perimeter, peakY } = params;
  void params.ridgeAxis;

  const evenSpanMeters = (dist2(perimeter[0]!, perimeter[1]!) + dist2(perimeter[2]!, perimeter[3]!)) / 2;
  const oddSpanMeters = (dist2(perimeter[1]!, perimeter[2]!) + dist2(perimeter[3]!, perimeter[0]!)) / 2;
  const ridgeParallelToEvenEdges = evenSpanMeters >= oddSpanMeters;
  const longSpanMeters = Math.max(evenSpanMeters, oddSpanMeters);
  const shortSpanMeters = Math.min(evenSpanMeters, oddSpanMeters);
  const ridgeLengthMetersValue = Math.max(0, longSpanMeters - shortSpanMeters);
  const center = centerOfPerimeter(perimeter);
  const apex = toVec3(center, peakY);

  if (ridgeLengthMetersValue <= ROOF_RENDER_EPSILON_METERS) {
    return {
      ridgeLengthMeters: 0,
      isPyramid: true,
      ridgeParallelToEvenEdges,
      apex,
    };
  }

  const startAnchor = ridgeParallelToEvenEdges
    ? midpoint2(perimeter[3]!, perimeter[0]!)
    : midpoint2(perimeter[0]!, perimeter[1]!);
  const endAnchor = ridgeParallelToEvenEdges
    ? midpoint2(perimeter[2]!, perimeter[1]!)
    : midpoint2(perimeter[3]!, perimeter[2]!);
  const ridgeUnit = normalizedPlanVector(startAnchor, endAnchor);
  const insetMeters = shortSpanMeters / 2;
  const ridgeStart = {
    x: startAnchor.x + ridgeUnit.x * insetMeters,
    z: startAnchor.z + ridgeUnit.z * insetMeters,
  };
  const ridgeEnd = {
    x: endAnchor.x - ridgeUnit.x * insetMeters,
    z: endAnchor.z - ridgeUnit.z * insetMeters,
  };

  return {
    ridgeStart: toVec3(ridgeStart, peakY),
    ridgeEnd: toVec3(ridgeEnd, peakY),
    ridgeLengthMeters: ridgeLengthMetersValue,
    isPyramid: false,
    ridgeParallelToEvenEdges,
    apex,
  };
}

function createUpwardRoofPlane(id: string, corners: RoofVec3[]): RoofPlane {
  if (corners.length < 3) {
    throw new Error(`Roof plane ${id} requires at least three corners.`);
  }
  const area =
    corners.length === 3
      ? triangleArea(corners[0]!, corners[1]!, corners[2]!)
      : quadArea(corners[0]!, corners[1]!, corners[2]!, corners[3]!);
  if (area <= ROOF_RENDER_EPSILON_METERS ** 2) {
    throw new Error(`Roof plane ${id} is degenerate.`);
  }

  let ordered = [...corners];
  let normal = planeNormal(ordered[0]!, ordered[1]!, ordered[2]!);
  if (normal.y < 0) {
    ordered = [ordered[0]!, ...ordered.slice(1).reverse()];
    normal = planeNormal(ordered[0]!, ordered[1]!, ordered[2]!);
  }

  if (ordered.length === 4) {
    const [a, , , d] = ordered;
    const distanceFromPlane = Math.abs(
      normal.x * (d!.x - a!.x) + normal.y * (d!.y - a!.y) + normal.z * (d!.z - a!.z),
    );
    if (distanceFromPlane > ROOF_RENDER_EPSILON_METERS) {
      throw new Error(`Roof plane ${id} is non-planar.`);
    }
  }

  return { id, corners: ordered, normal };
}

function buildGableRoofPlanes(params: {
  ridgeAxis: RidgeAxis;
  analysis: RectangularFootprintAnalysis;
  bearing: readonly PlanVec2[];
  cladding: readonly PlanVec2[];
  roofBeamTopY: number;
  peakY: number;
  gableEndOverhangMeters: number;
  sideEaveOverhangMeters: number;
  fixedRoofSlope: number;
}): {
  topPlanes: RoofPlane[];
  undersidePlanes: RoofPlane[];
  structuralRidgeStart: RoofVec3;
  structuralRidgeEnd: RoofVec3;
  claddingRidgeStart: RoofVec3;
  claddingRidgeEnd: RoofVec3;
  gableEndSegmentIds: string[];
} {
  const { analysis, bearing, cladding, roofBeamTopY, peakY } = params;
  const structural = ridgeEndpointsForAxis({
    bearing,
    ridgeAxis: params.ridgeAxis,
    peakY,
  });
  const ridge = extendRidgeEndpointsForGableOverhang({
    structuralRidgeStart: structural.ridgeStart,
    structuralRidgeEnd: structural.ridgeEnd,
    gableEndOverhangMeters: params.gableEndOverhangMeters,
    gableOutwardNormalStart: gableEndOutwardNormal2D({
      bearing,
      ridgeAxis: params.ridgeAxis,
      atStartGable: true,
    }),
    gableOutwardNormalEnd: gableEndOutwardNormal2D({
      bearing,
      ridgeAxis: params.ridgeAxis,
      atStartGable: false,
    }),
  });
  const { claddingRidgeStart: ridgeStart, claddingRidgeEnd: ridgeEnd } = ridge;
  const evenLong = longEdgesAreEven(bearing);
  const ridgeParallelToEvenEdges =
    (params.ridgeAxis === 'localX' && evenLong) || (params.ridgeAxis === 'localZ' && !evenLong);

  const eaveY = claddingEaveElevationMeters({
    structuralEaveY: roofBeamTopY,
    fixedSlope: params.fixedRoofSlope,
    sideEaveOverhangMeters: params.sideEaveOverhangMeters,
  });
  let topPlanes: RoofPlane[];

  if (ridgeParallelToEvenEdges) {
    const plane0: RoofPlane = {
      id: 'gable-roof-0',
      corners: [
        toVec3(cladding[0]!, eaveY),
        toVec3(cladding[1]!, eaveY),
        ridgeEnd,
        ridgeStart,
      ],
      normal: planeNormal(toVec3(cladding[0]!, eaveY), toVec3(cladding[1]!, eaveY), ridgeEnd),
    };
    const plane2: RoofPlane = {
      id: 'gable-roof-2',
      corners: [
        toVec3(cladding[2]!, eaveY),
        toVec3(cladding[3]!, eaveY),
        ridgeStart,
        ridgeEnd,
      ],
      normal: planeNormal(toVec3(cladding[2]!, eaveY), toVec3(cladding[3]!, eaveY), ridgeStart),
    };
    topPlanes = [plane0, plane2];
  } else {
    const plane1: RoofPlane = {
      id: 'gable-roof-1',
      corners: [
        toVec3(cladding[1]!, eaveY),
        toVec3(cladding[2]!, eaveY),
        ridgeEnd,
        ridgeStart,
      ],
      normal: planeNormal(toVec3(cladding[1]!, eaveY), toVec3(cladding[2]!, eaveY), ridgeEnd),
    };
    const plane3: RoofPlane = {
      id: 'gable-roof-3',
      corners: [
        toVec3(cladding[3]!, eaveY),
        toVec3(cladding[0]!, eaveY),
        ridgeStart,
        ridgeEnd,
      ],
      normal: planeNormal(toVec3(cladding[3]!, eaveY), toVec3(cladding[0]!, eaveY), ridgeStart),
    };
    topPlanes = [plane1, plane3];
  }

  return {
    topPlanes,
    undersidePlanes: topPlanes.map((plane) => offsetPlaneDown(plane, 0)),
    structuralRidgeStart: ridge.structuralRidgeStart,
    structuralRidgeEnd: ridge.structuralRidgeEnd,
    claddingRidgeStart: ridge.claddingRidgeStart,
    claddingRidgeEnd: ridge.claddingRidgeEnd,
    gableEndSegmentIds: gableEndSegmentIdsForRidgeAxis(analysis, params.ridgeAxis),
  };
}

function buildHipRoofPlanes(params: {
  ridgeAxis: RidgeAxis;
  bearing: readonly PlanVec2[];
  cladding: readonly PlanVec2[];
  roofBeamTopY: number;
  peakY: number;
  isSquare: boolean;
  eaveOverhangMeters: number;
  fixedRoofSlope: number;
}): {
  topPlanes: RoofPlane[];
  undersidePlanes: RoofPlane[];
  ridgeStart?: RoofVec3;
  ridgeEnd?: RoofVec3;
  structuralRidgeStart?: RoofVec3;
  structuralRidgeEnd?: RoofVec3;
  claddingRidgeStart?: RoofVec3;
  claddingRidgeEnd?: RoofVec3;
  peakPoint?: RoofVec3;
} {
  const { bearing, cladding, roofBeamTopY, peakY, isSquare } = params;
  const eaveY = claddingEaveElevationMeters({
    structuralEaveY: roofBeamTopY,
    fixedSlope: params.fixedRoofSlope,
    sideEaveOverhangMeters: params.eaveOverhangMeters,
  });
  const structuralRidge = hipRidgeEndpointsForAxis({
    perimeter: bearing,
    ridgeAxis: params.ridgeAxis,
    peakY,
  });
  const claddingRidge = hipRidgeEndpointsForAxis({
    perimeter: cladding,
    ridgeAxis: params.ridgeAxis,
    peakY,
  });

  if (isSquare || claddingRidge.isPyramid) {
    const peakPoint = claddingRidge.apex;
    const c0 = toVec3(cladding[0]!, eaveY);
    const c1 = toVec3(cladding[1]!, eaveY);
    const c2 = toVec3(cladding[2]!, eaveY);
    const c3 = toVec3(cladding[3]!, eaveY);
    const topPlanes: RoofPlane[] = [
      createUpwardRoofPlane('hip-pyramid-0', [c0, c1, peakPoint]),
      createUpwardRoofPlane('hip-pyramid-1', [c1, c2, peakPoint]),
      createUpwardRoofPlane('hip-pyramid-2', [c2, c3, peakPoint]),
      createUpwardRoofPlane('hip-pyramid-3', [c3, c0, peakPoint]),
    ];
    return { topPlanes, undersidePlanes: topPlanes.map((plane) => offsetPlaneDown(plane, 0)), peakPoint };
  }

  const { ridgeStart, ridgeEnd } = claddingRidge;
  if (!ridgeStart || !ridgeEnd) {
    throw new Error('Hip roof ridge endpoints could not be resolved.');
  }
  const ridgeParallelToEvenEdges = claddingRidge.ridgeParallelToEvenEdges;

  const c0 = toVec3(cladding[0]!, eaveY);
  const c1 = toVec3(cladding[1]!, eaveY);
  const c2 = toVec3(cladding[2]!, eaveY);
  const c3 = toVec3(cladding[3]!, eaveY);

  let topPlanes: RoofPlane[];
  if (ridgeParallelToEvenEdges) {
    topPlanes = [
      createUpwardRoofPlane('hip-0', [c0, c1, ridgeEnd, ridgeStart]),
      createUpwardRoofPlane('hip-2', [c2, c3, ridgeStart, ridgeEnd]),
      createUpwardRoofPlane('hip-3', [c3, c0, ridgeStart]),
      createUpwardRoofPlane('hip-1', [c1, c2, ridgeEnd]),
    ];
  } else {
    topPlanes = [
      createUpwardRoofPlane('hip-1', [c1, c2, ridgeEnd, ridgeStart]),
      createUpwardRoofPlane('hip-3', [c3, c0, ridgeStart, ridgeEnd]),
      createUpwardRoofPlane('hip-0', [c0, c1, ridgeStart]),
      createUpwardRoofPlane('hip-2', [c2, c3, ridgeEnd]),
    ];
  }

  return {
    topPlanes,
    undersidePlanes: topPlanes.map((plane) => offsetPlaneDown(plane, 0)),
    ridgeStart,
    ridgeEnd,
    structuralRidgeStart: structuralRidge.ridgeStart,
    structuralRidgeEnd: structuralRidge.ridgeEnd,
    claddingRidgeStart: ridgeStart,
    claddingRidgeEnd: ridgeEnd,
  };
}

function pointInTriangle2d(
  x: number,
  z: number,
  a: { x: number; z: number },
  b: { x: number; z: number },
  c: { x: number; z: number },
): boolean {
  const sign = (p1x: number, p1z: number, p2x: number, p2z: number, p3x: number, p3z: number) =>
    (p1x - p3x) * (p2z - p3z) - (p2x - p3x) * (p1z - p3z);
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

function elevationOnRoofPlaneAtPoint(plane: RoofPlane, x: number, z: number): number | null {
  const anchor = plane.corners[0];
  if (!anchor) return null;
  const normal = plane.normal;
  if (Math.abs(normal.y) <= 1e-6) return null;
  return anchor.y - (normal.x * (x - anchor.x) + normal.z * (z - anchor.z)) / normal.y;
}

export function resolveRoofTopPlaneAtPoint(params: {
  resolved: ResolvedRoofSystem;
  x: number;
  z: number;
}): RoofPlane | null {
  let matched: { plane: RoofPlane; topY: number } | null = null;
  for (const plane of params.resolved.roofTopPlanes) {
    if (!pointInRoofPlaneFootprint(plane, params.x, params.z)) continue;
    const topY = elevationOnRoofPlaneAtPoint(plane, params.x, params.z);
    if (topY == null) continue;
    if (!matched || topY > matched.topY) {
      matched = { plane, topY };
    }
  }
  return matched?.plane ?? null;
}

export function roofCladdingTopYAtPoint(params: {
  resolved: ResolvedRoofSystem;
  x: number;
  z: number;
}): number {
  let matchedTopY = -Infinity;
  for (const plane of params.resolved.roofTopPlanes) {
    if (!pointInRoofPlaneFootprint(plane, params.x, params.z)) continue;
    const topY = elevationOnRoofPlaneAtPoint(plane, params.x, params.z);
    if (topY != null) {
      matchedTopY = Math.max(matchedTopY, topY);
    }
  }
  if (Number.isFinite(matchedTopY)) {
    return matchedTopY;
  }

  const topY = params.resolved.peakElevationMeters;
  const eaveY = params.resolved.roofBeamTopElevationMeters;
  let roofTopY = eaveY;
  if (params.resolved.ridgeStart && params.resolved.ridgeEnd) {
    const ridgeStart2 = { x: params.resolved.ridgeStart.x, z: params.resolved.ridgeStart.z };
    const ridgeEnd2 = { x: params.resolved.ridgeEnd.x, z: params.resolved.ridgeEnd.z };
    const distFromRidge = distancePointToLine2D({ x: params.x, z: params.z }, ridgeStart2, ridgeEnd2);
    const halfRun = Math.max(0.001, params.resolved.structuralRafterRunMeters || params.resolved.rafterRunMeters);
    const rise = topY - eaveY;
    roofTopY = topY - (distFromRidge / halfRun) * rise;
  } else if (params.resolved.peakPoint) {
    const halfRun = Math.max(0.001, params.resolved.structuralRafterRunMeters || params.resolved.rafterRunMeters);
    const distFromPeak = Math.hypot(params.x - params.resolved.peakPoint.x, params.z - params.resolved.peakPoint.z);
    const rise = topY - eaveY;
    roofTopY = topY - (distFromPeak / halfRun) * rise;
  }
  return roofTopY;
}

export function roofCladdingUndersideYAtPoint(params: {
  resolved: ResolvedRoofSystem;
  x: number;
  z: number;
}): number {
  const thickness = params.resolved.roofAssemblyThicknessMeters ?? 0.15;
  return roofCladdingTopYAtPoint(params) - thickness;
}

/** @deprecated Use roofCladdingUndersideYAtPoint — kept for legacy callers. */
export function roofUndersideElevationAt(params: {
  resolved: ResolvedRoofSystem;
  x: number;
  z: number;
}): number {
  return roofCladdingUndersideYAtPoint(params);
}

export function resolveRoofSystem(params: {
  layout: DesignWallLayoutParameters;
  wallExteriorFootprint: readonly PlanVec2[];
  structuralBearingPerimeter: readonly PlanVec2[];
  bearingSource: 'roof_beam_outer_faces' | 'wall_exterior_fallback';
  bearingWarnings?: readonly string[];
  roofSystem: RoofSystemSettings;
  roofBeamTopElevationMeters: number;
  segmentFrames?: readonly SegmentFrame[];
  exteriorSegmentIds?: ReadonlySet<string> | readonly string[];
}): ResolvedRoofSystem & { roofAssemblyThicknessMeters: number } {
  const settings = params.roofSystem;
  const rawBearingLoop = params.structuralBearingPerimeter.map((point) => ({ ...point }));

  const analysis = analyzeRectangularFootprint({
    layout: params.layout,
    exteriorFootprint: rawBearingLoop,
    exteriorSegmentIds: params.exteriorSegmentIds,
  });
  const strictFootprintWarnings = analysis.supported ? validateStrictOrthogonalFootprint(params.layout) : [];
  const bearingLoop = analysis.supported
    ? analysis.bearingCorners.map((point) => ({ ...point }))
    : rawBearingLoop;

  const ridgeAxis = analysis.supported
    ? resolveRidgeAxis(analysis, settings.ridgeDirection, settings.selectedRidgeWallSegmentId)
    : ('localX' as RidgeAxis);
  const hipRidgeAxis: RidgeAxis =
    analysis.supported && analysis.localZSpanMeters > analysis.localXSpanMeters ? 'localZ' : 'localX';
  const activeRidgeAxis = settings.roofType === 'hip' ? hipRidgeAxis : ridgeAxis;

  assertGableEndOverhangMeters(settings.gableEndOverhangMeters);

  const claddingLoop =
    settings.roofType === 'gable'
      ? resolveCladdingPerimeterWithOverhangs({
          bearingPerimeter: bearingLoop,
          ridgeAxis,
          eaveOverhangMeters: settings.eaveOverhangMeters,
          gableEndOverhangMeters: settings.gableEndOverhangMeters,
        })
      : resolveCladdingPerimeterFromBearing(bearingLoop, settings.eaveOverhangMeters);

  const emptyPerimeterVec3 = (points: readonly PlanVec2[]) =>
    points.map((point) => vec3(point.x, params.roofBeamTopElevationMeters, point.z));

  const empty: ResolvedRoofSystem & { roofAssemblyThicknessMeters: number } = {
    supported: false,
    unsupportedMessage: UNSUPPORTED_ROOF_FOOTPRINT_MESSAGE,
    roofType: settings.roofType,
    roofBearingSource: params.bearingSource,
    exteriorRoofBeamBounds: {
      footprint: [],
      center: vec3(0, params.roofBeamTopElevationMeters, 0),
      widthMeters: 0,
      depthMeters: 0,
    },
    structuralBearingPerimeter: [],
    claddingPerimeter: [],
    roofSheetPerimeter: [],
    eaveFootprint: [],
    roofBeamTopElevationMeters: params.roofBeamTopElevationMeters,
    roofBeamTopY: params.roofBeamTopElevationMeters,
    peakElevationMeters: params.roofBeamTopElevationMeters,
    roofPeakY: params.roofBeamTopElevationMeters,
    roofAssemblyThicknessMeters: settings.roofAssemblyThicknessMeters,
    roofTopPlanes: [],
    claddingDisplayPlanes: [],
    roofUndersidePlanes: [],
    gableEndSegmentIds: [],
    rafterRunMeters: 0,
    rafterRiseMeters: 0,
    rafterLengthMeters: 0,
    structuralRafterRunMeters: 0,
    claddingRafterRunMeters: 0,
    claddingRafterLengthMeters: 0,
    roofPitchRadians: 0,
    roofRunMeters: 0,
    roofRiseMeters: 0,
    roofMemberReferenceLengthMeters: 0,
    ridgeLengthMeters: 0,
    roofSurfaceAreaSquareMeters: 0,
    trussCount: 0,
    actualTrussSpacingMeters: 0,
    trussStations: [],
    trussPlacements: [],
    purlinRowsPerSlope: 0,
    actualPurlinSpacingMeters: 0,
    purlinPlacements: [],
    hipFramingMembers: [],
    ridgeCapPlacement: null,
    structuralRidgeLengthMeters: 0,
    claddingRidgeLengthMeters: 0,
    gableEndOverhangMeters: settings.gableEndOverhangMeters,
    gableCmuAreaSquareMeters: 0,
    ridgeCapPlacements: [],
    rakedCapVolumeCubicMeters: 0,
    gableEnds: [],
    gableEndRoofingClosures: [],
    fasciaPlacements: [],
    soffitPlacements: [],
    warnings: [],
  };

  if (!settings.enabled || !analysis.supported || strictFootprintWarnings.length > 0) {
    return {
      ...empty,
      warnings: !settings.enabled
        ? []
        : strictFootprintWarnings.length > 0
          ? strictFootprintWarnings
          : [{ code: 'unsupported_footprint', message: UNSUPPORTED_ROOF_FOOTPRINT_MESSAGE, severity: 'review' }],
    };
  }

  const structuralBearingPerimeter = emptyPerimeterVec3(bearingLoop);
  const claddingPerimeter = emptyPerimeterVec3(claddingLoop);
  const roofBeamTopY = params.roofBeamTopElevationMeters;
  const peakY = roofBeamTopY + Math.max(0, settings.peakHeightAboveRoofBeamMeters);
  const isSquare = Math.abs(analysis.lengthMeters - analysis.widthMeters) < 0.05;
  const warnings: DesignWarning[] = (params.bearingWarnings ?? []).map((message) => ({
    code: 'roof_bearing_loop',
    message,
    severity: 'review' as const,
  }));
  const axisDerivedBearingHalfRun =
    (activeRidgeAxis === 'localX' ? analysis.localZSpanMeters : analysis.localXSpanMeters) / 2;
  const preliminaryStructuralRidge =
    settings.roofType === 'gable'
      ? ridgeEndpointsForAxis({
          bearing: bearingLoop,
          ridgeAxis,
          peakY,
        })
      : null;
  const measuredGableHalfRun =
    preliminaryStructuralRidge != null
      ? resolveGableStructuralHalfRunFromRidge({
          structuralBearing: bearingLoop,
          structuralRidgeStart: preliminaryStructuralRidge.ridgeStart,
          structuralRidgeEnd: preliminaryStructuralRidge.ridgeEnd,
        })
      : 0;
  const bearingHalfRun =
    settings.roofType === 'gable' && measuredGableHalfRun > ROOF_RENDER_EPSILON_METERS
      ? measuredGableHalfRun
      : axisDerivedBearingHalfRun;
  const gableHalfRunDistances =
    preliminaryStructuralRidge != null
      ? resolveGableStructuralHalfRunDistancesFromRidge({
          structuralBearing: bearingLoop,
          structuralRidgeStart: preliminaryStructuralRidge.ridgeStart,
          structuralRidgeEnd: preliminaryStructuralRidge.ridgeEnd,
        })
      : null;
  if (
    gableHalfRunDistances &&
    Math.abs(gableHalfRunDistances.halfRunA - gableHalfRunDistances.halfRunB) >
      GABLE_HALF_RUN_ASYMMETRY_TOLERANCE_METERS
  ) {
    warnings.push({
      code: 'gable_half_run_asymmetry',
      message: `Gable structural half-run differs across bearing edges (${gableHalfRunDistances.halfRunA.toFixed(3)} m vs ${gableHalfRunDistances.halfRunB.toFixed(3)} m).`,
      severity: 'review',
    });
  }
  const rafterRiseMeters = settings.peakHeightAboveRoofBeamMeters;
  const fixedRoofPitch = resolveFixedRoofPitch({
    structuralHalfRunMeters: bearingHalfRun,
    structuralRiseMeters: rafterRiseMeters,
  });
  const structuralEaveY = roofBeamTopY;
  const claddingEaveY = claddingEaveElevationMeters({
    structuralEaveY,
    fixedSlope: fixedRoofPitch.slope,
    sideEaveOverhangMeters: settings.eaveOverhangMeters,
  });

  let topPlanes: RoofPlane[] = [];
  let undersidePlanes: RoofPlane[] = [];
  let ridgeStart: RoofVec3 | undefined;
  let ridgeEnd: RoofVec3 | undefined;
  let structuralRidgeStart: RoofVec3 | undefined;
  let structuralRidgeEnd: RoofVec3 | undefined;
  let claddingRidgeStart: RoofVec3 | undefined;
  let claddingRidgeEnd: RoofVec3 | undefined;
  let peakPoint: RoofVec3 | undefined;
  let gableEndSegmentIds: string[] = [];

  if (settings.roofType === 'gable') {
    const gable = buildGableRoofPlanes({
      ridgeAxis,
      analysis,
      bearing: bearingLoop,
      cladding: claddingLoop,
      roofBeamTopY,
      peakY,
      gableEndOverhangMeters: settings.gableEndOverhangMeters,
      sideEaveOverhangMeters: settings.eaveOverhangMeters,
      fixedRoofSlope: fixedRoofPitch.slope,
    });
    topPlanes = gable.topPlanes;
    undersidePlanes = gable.undersidePlanes.map((plane) => offsetPlaneDown(plane, settings.roofAssemblyThicknessMeters));
    structuralRidgeStart = gable.structuralRidgeStart;
    structuralRidgeEnd = gable.structuralRidgeEnd;
    claddingRidgeStart = gable.claddingRidgeStart;
    claddingRidgeEnd = gable.claddingRidgeEnd;
    ridgeStart = gable.claddingRidgeStart;
    ridgeEnd = gable.claddingRidgeEnd;
    gableEndSegmentIds = settings.gable.enabled
      ? filterExteriorGableEndSegmentIds(params.layout, gable.gableEndSegmentIds, params.exteriorSegmentIds)
      : [];
  } else {
    const hip = buildHipRoofPlanes({
      ridgeAxis: hipRidgeAxis,
      bearing: bearingLoop,
      cladding: claddingLoop,
      roofBeamTopY,
      peakY,
      isSquare,
      eaveOverhangMeters: settings.eaveOverhangMeters,
      fixedRoofSlope: fixedRoofPitch.slope,
    });
    topPlanes = hip.topPlanes;
    undersidePlanes = hip.undersidePlanes.map((plane) => offsetPlaneDown(plane, settings.roofAssemblyThicknessMeters));
    ridgeStart = hip.ridgeStart;
    ridgeEnd = hip.ridgeEnd;
    structuralRidgeStart = hip.structuralRidgeStart;
    structuralRidgeEnd = hip.structuralRidgeEnd;
    claddingRidgeStart = hip.claddingRidgeStart;
    claddingRidgeEnd = hip.claddingRidgeEnd;
    peakPoint = hip.peakPoint;
    gableEndSegmentIds = [];
  }

  const structuralRafterRunMeters = bearingHalfRun;
  const claddingRafterRunMeters = claddingHorizontalRunMeters({
    structuralHalfRunMeters: bearingHalfRun,
    sideEaveOverhangMeters: settings.eaveOverhangMeters,
  });
  const rafterRunMeters = structuralRafterRunMeters;
  const rafterLengthMeters = Math.hypot(structuralRafterRunMeters, rafterRiseMeters);
  const claddingRafterLengthMeters = Math.hypot(
    claddingRafterRunMeters,
    rafterRiseMeters + fixedRoofPitch.slope * Math.max(0, settings.eaveOverhangMeters),
  );
  const structuralRidgeLengthMeters =
    structuralRidgeStart && structuralRidgeEnd
      ? ridgeLengthMeters(structuralRidgeStart, structuralRidgeEnd)
      : ridgeStart && ridgeEnd
        ? ridgeLengthMeters(ridgeStart, ridgeEnd)
        : 0;
  const claddingRidgeLengthMeters =
    claddingRidgeStart && claddingRidgeEnd
      ? ridgeLengthMeters(claddingRidgeStart, claddingRidgeEnd)
      : ridgeStart && ridgeEnd
        ? ridgeLengthMeters(ridgeStart, ridgeEnd)
        : 0;
  const ridgeLengthMetersValue = claddingRidgeLengthMeters;
  const roofSurfaceAreaSquareMeters = topPlanes.reduce((sum, plane) => {
    if (plane.corners.length === 3) {
      return sum + triangleArea(plane.corners[0]!, plane.corners[1]!, plane.corners[2]!);
    }
    if (plane.corners.length === 4) {
      return sum + quadArea(plane.corners[0]!, plane.corners[1]!, plane.corners[2]!, plane.corners[3]!);
    }
    return sum;
  }, 0);

  if (settings.roofType === 'gable' && settings.peakHeightAboveRoofBeamMeters <= 0.19) {
    warnings.push({
      code: 'low_peak_gable',
      message: 'Roof peak may be too low for gable-end CMU courses.',
      severity: 'review' as const,
    });
  }

  const framing = resolveRoofFraming({
    settings,
    analysis,
    structuralBearingPerimeter: bearingLoop,
    claddingPerimeter: claddingLoop,
    ridgeAxis: activeRidgeAxis,
    roofBeamTopY,
    peakY,
    structuralRidgeStart: structuralRidgeStart ?? ridgeStart,
    structuralRidgeEnd: structuralRidgeEnd ?? ridgeEnd,
    claddingRidgeStart: claddingRidgeStart ?? ridgeStart,
    claddingRidgeEnd: claddingRidgeEnd ?? ridgeEnd,
    peakPoint,
    roofTopPlanes: topPlanes,
    rafterLengthMeters,
    claddingRafterLengthMeters,
    rafterRunMeters,
    structuralHalfRunMeters: bearingHalfRun,
    sideEaveOverhangMeters: settings.eaveOverhangMeters,
    fixedRoofSlope: fixedRoofPitch.slope,
    ridgeLengthMeters: ridgeLengthMetersValue,
  });
  const { framingWarnings, ...roofFraming } = framing;
  warnings.push(...framingWarnings);

  const sheetEaveLipOverhangMeters = ROOF_SHEET_EAVE_OVERHANG_METERS;
  const gableSheetEaveOverhangMeters =
    settings.eaveOverhangMeters + sheetEaveLipOverhangMeters;
  const gableSheetEndOverhangMeters =
    settings.gableEndOverhangMeters + ROOF_SHEET_EAVE_OVERHANG_METERS;
  const gableSheetLoop =
    settings.roofType === 'gable' && settings.purlins.enabled && framing.purlinPlacements.length > 0
      ? resolveCladdingPerimeterWithOverhangs({
          bearingPerimeter: bearingLoop,
          ridgeAxis: activeRidgeAxis,
          eaveOverhangMeters: gableSheetEaveOverhangMeters,
          gableEndOverhangMeters: gableSheetEndOverhangMeters,
        })
      : null;
  const gableSheet =
    gableSheetLoop != null
      ? buildGableRoofPlanes({
          ridgeAxis,
          analysis,
          bearing: bearingLoop,
          cladding: gableSheetLoop,
          roofBeamTopY,
          peakY,
          gableEndOverhangMeters: gableSheetEndOverhangMeters,
          sideEaveOverhangMeters: gableSheetEaveOverhangMeters,
          fixedRoofSlope: fixedRoofPitch.slope,
        })
      : null;
  const gableSheetTopPlanes = gableSheet?.topPlanes ?? null;

  const hipSheetEaveOverhangMeters =
    settings.eaveOverhangMeters +
    sheetEaveLipOverhangMeters +
    (settings.roofType === 'hip' ? HIP_SHEET_SEAM_WELD_ALLOWANCE_METERS : 0);
  const hipSheetLoop =
    settings.roofType === 'hip' && settings.purlins.enabled && framing.purlinPlacements.length > 0
      ? resolveCladdingPerimeterFromBearing(
          bearingLoop,
          hipSheetEaveOverhangMeters,
        )
      : null;
  const roofSheetPerimeter = emptyPerimeterVec3(gableSheetLoop ?? hipSheetLoop ?? claddingLoop);

  const hipSheet =
    settings.roofType === 'hip' && settings.purlins.enabled && framing.purlinPlacements.length > 0
      ? buildHipRoofPlanes({
          ridgeAxis: hipRidgeAxis,
          bearing: bearingLoop,
          cladding: hipSheetLoop ?? claddingLoop,
          roofBeamTopY,
          peakY,
          isSquare,
          eaveOverhangMeters: hipSheetEaveOverhangMeters,
          fixedRoofSlope: fixedRoofPitch.slope,
        })
      : null;
  const hipSheetTopPlanes = hipSheet?.topPlanes ?? null;
  const sheetTopPlanes = gableSheetTopPlanes ?? hipSheetTopPlanes ?? null;
  const displayRidgeStart =
    settings.roofType === 'gable'
      ? (gableSheet?.claddingRidgeStart ?? claddingRidgeStart ?? ridgeStart)
      : undefined;
  const displayRidgeEnd =
    settings.roofType === 'gable'
      ? (gableSheet?.claddingRidgeEnd ?? claddingRidgeEnd ?? ridgeEnd)
      : undefined;
  const roofDatum: SolvedRoofDatum = {
    structuralBearingPerimeter,
    claddingPerimeter,
    roofSheetPerimeter,
    structuralRidgeStart,
    structuralRidgeEnd,
    claddingRidgeStart,
    claddingRidgeEnd,
    structuralRidgeLengthMeters,
    claddingRidgeLengthMeters,
    roofBeamTopY,
    structuralEaveY,
    claddingEaveY,
    peakY,
    roofTopPlanes: topPlanes,
    roofUndersidePlanes: undersidePlanes,
  };

  const claddingDisplayPlanes =
    settings.purlins.enabled && framing.purlinPlacements.length > 0
      ? buildCladdingDisplayPlanes({
          structuralPlanes:
            settings.roofType === 'gable' ? roofDatum.roofTopPlanes : (sheetTopPlanes ?? roofDatum.roofTopPlanes),
          footprintPlanes:
            settings.roofType === 'gable' ? (sheetTopPlanes ?? roofDatum.roofTopPlanes) : undefined,
          trussPlacements: framing.trussPlacements,
          purlinPlacements: framing.purlinPlacements,
          peakY,
          claddingRidgeStart: displayRidgeStart,
          claddingRidgeEnd: displayRidgeEnd,
        })
      : roofDatum.roofTopPlanes.map((plane) => ({ ...plane }));
  const ridgeCapRidgeStart =
    (displayRidgeStart ?? claddingRidgeStart) && claddingDisplayPlanes.length > 0
      ? claddingRidgePointOnDisplayPlanes({
          displayPlanes: claddingDisplayPlanes,
          ridgePoint: displayRidgeStart ?? claddingRidgeStart!,
        })
      : claddingRidgeStart;
  const ridgeCapRidgeEnd =
    (displayRidgeEnd ?? claddingRidgeEnd) && claddingDisplayPlanes.length > 0
      ? claddingRidgePointOnDisplayPlanes({
          displayPlanes: claddingDisplayPlanes,
          ridgePoint: displayRidgeEnd ?? claddingRidgeEnd!,
        })
      : claddingRidgeEnd;

  const ridgeCapPlacement = resolveRidgeCapPlacement({
    roofType: settings.roofType,
    ridgeStart: ridgeCapRidgeStart ?? ridgeStart,
    ridgeEnd: ridgeCapRidgeEnd ?? ridgeEnd,
    rafterRunMeters,
    rafterRiseMeters,
    enabled: settings.corrugatedMetal.enabled && settings.corrugatedMetal.ridgeCapEnabled,
  });
  const hipRidgeCapPlacements = resolveHipRidgeCapPlacements({
    roofType: settings.roofType,
    sourcePlanes: sheetTopPlanes ?? topPlanes,
    displayPlanes: claddingDisplayPlanes,
    roofPitchRadians: fixedRoofPitch.pitchRadians,
    enabled: settings.corrugatedMetal.enabled && settings.corrugatedMetal.ridgeCapEnabled,
  });
  const ridgeCapPlacements =
    settings.roofType === 'hip'
      ? hipRidgeCapPlacements
      : ridgeCapPlacement
        ? [ridgeCapPlacement]
        : [];

  const gableEndRoofingClosures = resolveGableEndRoofingClosures({
    roofSystem: settings,
    analysis,
    ridgeAxis,
    segmentFrames: params.segmentFrames ?? [],
    trussPlacements: framing.trussPlacements,
    resolvedRoof: {
      roofBeamTopElevationMeters: roofBeamTopY,
      peakElevationMeters: peakY,
      claddingRidgeStart: roofDatum.claddingRidgeStart,
      claddingRidgeEnd: roofDatum.claddingRidgeEnd,
      claddingDisplayPlanes,
      purlinPlacements: framing.purlinPlacements,
    },
  });
  const fasciaPlacements = resolveRoofFasciaPlacements({
    roofSystem: settings,
    claddingDisplayPlanes,
    supportRoofTopPlanes: roofDatum.roofTopPlanes,
    purlinPlacements: framing.purlinPlacements,
  });
  const soffitPlacements = resolveRoofSoffitPlacements({
    roofSystem: settings,
    roofType: settings.roofType,
    structuralBearingPerimeter: roofDatum.structuralBearingPerimeter,
    claddingPerimeter: roofDatum.claddingPerimeter,
    roofSheetPerimeter: roofDatum.roofSheetPerimeter,
    claddingDisplayPlanes,
    fasciaPlacements,
    roofBeamTopY,
    structuralRidgeStart: roofDatum.structuralRidgeStart ?? ridgeStart,
    structuralRidgeEnd: roofDatum.structuralRidgeEnd ?? ridgeEnd,
  });

  const resolvedRoofSystem: ResolvedRoofSystem & { roofAssemblyThicknessMeters: number } = {
    supported: true,
    roofType: settings.roofType,
    roofBearingSource: params.bearingSource,
    ...roofFraming,
    structuralBearingPerimeter: roofDatum.structuralBearingPerimeter,
    claddingPerimeter: roofDatum.claddingPerimeter,
    roofSheetPerimeter: roofDatum.roofSheetPerimeter,
    eaveFootprint: roofDatum.claddingPerimeter,
    ridgeStart,
    ridgeEnd,
    structuralRidgeStart: roofDatum.structuralRidgeStart,
    structuralRidgeEnd: roofDatum.structuralRidgeEnd,
    claddingRidgeStart: roofDatum.claddingRidgeStart,
    claddingRidgeEnd: roofDatum.claddingRidgeEnd,
    structuralRidgeLengthMeters: roofDatum.structuralRidgeLengthMeters,
    claddingRidgeLengthMeters: roofDatum.claddingRidgeLengthMeters,
    gableEndOverhangMeters: settings.gableEndOverhangMeters,
    ridgeCapPlacement,
    ridgeCapPlacements,
    peakPoint,
    roofBeamTopElevationMeters: roofDatum.roofBeamTopY,
    roofBeamTopY: roofDatum.roofBeamTopY,
    peakElevationMeters: roofDatum.peakY,
    roofPeakY: roofDatum.peakY,
    roofAssemblyThicknessMeters: settings.roofAssemblyThicknessMeters,
    roofTopPlanes: roofDatum.roofTopPlanes,
    claddingDisplayPlanes,
    roofUndersidePlanes: roofDatum.roofUndersidePlanes,
    gableEndSegmentIds,
    rafterRunMeters,
    rafterRiseMeters,
    rafterLengthMeters,
    roofRunMeters: structuralRafterRunMeters,
    roofRiseMeters: rafterRiseMeters,
    roofMemberReferenceLengthMeters: rafterLengthMeters,
    roofPitchRadians: fixedRoofPitch.pitchRadians,
    structuralRafterRunMeters,
    claddingRafterRunMeters,
    claddingRafterLengthMeters,
    ridgeLengthMeters: ridgeLengthMetersValue,
    roofSurfaceAreaSquareMeters,
    gableCmuAreaSquareMeters: 0,
    rakedCapVolumeCubicMeters: 0,
    gableEnds: [],
    gableEndRoofingClosures,
    fasciaPlacements,
    soffitPlacements,
    warnings: [],
  };
  return {
    ...resolvedRoofSystem,
    warnings: dedupeDesignWarnings([
      ...warnings,
      ...validateResolvedRoofGeometry(resolvedRoofSystem),
    ]),
  };
}

export { ROOF_RENDER_EPSILON_METERS };
