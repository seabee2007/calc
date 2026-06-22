import type {
  DesignWallLayoutParameters,
  ResolvedRoofSystem,
  RoofPlane,
  RoofSystemSettings,
  RoofVec3,
} from '../types';
import {
  analyzeRectangularFootprint,
  distancePointToLine2D,
  footprintBounds,
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
  resolveRoofFraming,
  resolveRidgeCapPlacement,
} from './roofFramingResolver';

const ROOF_RENDER_EPSILON_METERS = 0.001;

function vec3(x: number, y: number, z: number): RoofVec3 {
  return { x, y, z };
}

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
  analysis: RectangularFootprintAnalysis;
  bearing: readonly PlanVec2[];
  cladding: readonly PlanVec2[];
  roofBeamTopY: number;
  peakY: number;
  isSquare: boolean;
}): {
  topPlanes: RoofPlane[];
  undersidePlanes: RoofPlane[];
  ridgeStart?: RoofVec3;
  ridgeEnd?: RoofVec3;
  peakPoint?: RoofVec3;
} {
  const { bearing, cladding, roofBeamTopY, peakY, isSquare } = params;
  const eaveY = roofBeamTopY;
  const bounds = footprintBounds(bearing);

  if (isSquare) {
    const peakPoint = vec3(bounds.centerX, peakY, bounds.centerZ);
    const c0 = toVec3(cladding[0]!, eaveY);
    const c1 = toVec3(cladding[1]!, eaveY);
    const c2 = toVec3(cladding[2]!, eaveY);
    const c3 = toVec3(cladding[3]!, eaveY);
    const topPlanes: RoofPlane[] = [
      { id: 'hip-pyramid-0', corners: [c0, c1, peakPoint], normal: planeNormal(c0, c1, peakPoint) },
      { id: 'hip-pyramid-1', corners: [c1, c2, peakPoint], normal: planeNormal(c1, c2, peakPoint) },
      { id: 'hip-pyramid-2', corners: [c2, c3, peakPoint], normal: planeNormal(c2, c3, peakPoint) },
      { id: 'hip-pyramid-3', corners: [c3, c0, peakPoint], normal: planeNormal(c3, c0, peakPoint) },
    ];
    return { topPlanes, undersidePlanes: topPlanes.map((plane) => offsetPlaneDown(plane, 0)), peakPoint };
  }

  const { ridgeStart, ridgeEnd } = ridgeEndpointsForAxis({
    bearing,
    ridgeAxis: params.ridgeAxis,
    peakY,
  });
  const evenLong = longEdgesAreEven(bearing);
  const ridgeParallelToEvenEdges =
    (params.ridgeAxis === 'localX' && evenLong) || (params.ridgeAxis === 'localZ' && !evenLong);

  const c0 = toVec3(cladding[0]!, eaveY);
  const c1 = toVec3(cladding[1]!, eaveY);
  const c2 = toVec3(cladding[2]!, eaveY);
  const c3 = toVec3(cladding[3]!, eaveY);

  let topPlanes: RoofPlane[];
  if (ridgeParallelToEvenEdges) {
    topPlanes = [
      { id: 'hip-0', corners: [c0, c1, ridgeEnd, ridgeStart], normal: planeNormal(c0, c1, ridgeEnd) },
      { id: 'hip-2', corners: [c2, c3, ridgeStart, ridgeEnd], normal: planeNormal(c2, c3, ridgeStart) },
      { id: 'hip-3', corners: [c3, c0, ridgeStart], normal: planeNormal(c3, c0, ridgeStart) },
      { id: 'hip-1', corners: [c1, c2, ridgeEnd], normal: planeNormal(c1, c2, ridgeEnd) },
    ];
  } else {
    topPlanes = [
      { id: 'hip-1', corners: [c1, c2, ridgeEnd, ridgeStart], normal: planeNormal(c1, c2, ridgeEnd) },
      { id: 'hip-3', corners: [c3, c0, ridgeStart, ridgeEnd], normal: planeNormal(c3, c0, ridgeStart) },
      { id: 'hip-0', corners: [c0, c1, ridgeStart], normal: planeNormal(c0, c1, ridgeStart) },
      { id: 'hip-2', corners: [c2, c3, ridgeEnd], normal: planeNormal(c2, c3, ridgeEnd) },
    ];
  }

  return { topPlanes, undersidePlanes: topPlanes.map((plane) => offsetPlaneDown(plane, 0)), ridgeStart, ridgeEnd };
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
}): ResolvedRoofSystem & { roofAssemblyThicknessMeters: number } {
  const settings = params.roofSystem;
  const bearingLoop = params.structuralBearingPerimeter.map((point) => ({ ...point }));

  const analysis = analyzeRectangularFootprint({
    layout: params.layout,
    exteriorFootprint: bearingLoop,
  });

  const ridgeAxis = analysis.supported
    ? resolveRidgeAxis(analysis, settings.ridgeDirection, settings.selectedRidgeWallSegmentId)
    : ('localX' as RidgeAxis);

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
    rakedCapVolumeCubicMeters: 0,
    gableEnds: [],
    warnings: [],
  };

  if (!settings.enabled || !analysis.supported) {
    return {
      ...empty,
      warnings: analysis.supported
        ? []
        : [{ code: 'unsupported_footprint', message: UNSUPPORTED_ROOF_FOOTPRINT_MESSAGE, severity: 'review' }],
    };
  }

  const structuralBearingPerimeter = emptyPerimeterVec3(bearingLoop);
  const claddingPerimeter = emptyPerimeterVec3(claddingLoop);
  const roofBeamTopY = params.roofBeamTopElevationMeters;
  const peakY = roofBeamTopY + Math.max(0, settings.peakHeightAboveRoofBeamMeters);
  const isSquare = Math.abs(analysis.lengthMeters - analysis.widthMeters) < 0.05;
  const bearingHalfRun =
    (ridgeAxis === 'localX' ? analysis.localZSpanMeters : analysis.localXSpanMeters) / 2;
  const rafterRiseMeters = settings.peakHeightAboveRoofBeamMeters;
  const fixedRoofPitch = resolveFixedRoofPitch({
    structuralHalfRunMeters: bearingHalfRun,
    structuralRiseMeters: rafterRiseMeters,
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
    gableEndSegmentIds = settings.gable.enabled ? gable.gableEndSegmentIds : [];
  } else {
    const hip = buildHipRoofPlanes({
      ridgeAxis,
      analysis,
      bearing: bearingLoop,
      cladding: claddingLoop,
      roofBeamTopY,
      peakY,
      isSquare,
    });
    topPlanes = hip.topPlanes;
    undersidePlanes = hip.undersidePlanes.map((plane) => offsetPlaneDown(plane, settings.roofAssemblyThicknessMeters));
    ridgeStart = hip.ridgeStart;
    ridgeEnd = hip.ridgeEnd;
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

  const warnings = (params.bearingWarnings ?? []).map((message) => ({
    code: 'roof_bearing_loop',
    message,
    severity: 'review' as const,
  }));
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
    ridgeAxis,
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

  const claddingDisplayPlanes =
    settings.purlins.enabled && framing.purlinPlacements.length > 0
      ? buildCladdingDisplayPlanes({
          structuralPlanes: topPlanes,
          trussPlacements: framing.trussPlacements,
          purlinPlacements: framing.purlinPlacements,
          peakY,
          claddingRidgeStart: claddingRidgeStart ?? ridgeStart,
          claddingRidgeEnd: claddingRidgeEnd ?? ridgeEnd,
        })
      : topPlanes.map((plane) => ({ ...plane }));

  const ridgeCapRidgeStart =
    claddingRidgeStart && claddingDisplayPlanes.length > 0
      ? claddingRidgePointOnDisplayPlanes({
          displayPlanes: claddingDisplayPlanes,
          ridgePoint: claddingRidgeStart,
        })
      : claddingRidgeStart;
  const ridgeCapRidgeEnd =
    claddingRidgeEnd && claddingDisplayPlanes.length > 0
      ? claddingRidgePointOnDisplayPlanes({
          displayPlanes: claddingDisplayPlanes,
          ridgePoint: claddingRidgeEnd,
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

  return {
    supported: true,
    roofType: settings.roofType,
    roofBearingSource: params.bearingSource,
    ...framing,
    structuralBearingPerimeter,
    claddingPerimeter,
    eaveFootprint: claddingPerimeter,
    ridgeStart,
    ridgeEnd,
    structuralRidgeStart,
    structuralRidgeEnd,
    claddingRidgeStart,
    claddingRidgeEnd,
    structuralRidgeLengthMeters,
    claddingRidgeLengthMeters,
    gableEndOverhangMeters: settings.gableEndOverhangMeters,
    ridgeCapPlacement,
    peakPoint,
    roofBeamTopElevationMeters: roofBeamTopY,
    roofBeamTopY,
    peakElevationMeters: peakY,
    roofPeakY: peakY,
    roofAssemblyThicknessMeters: settings.roofAssemblyThicknessMeters,
    roofTopPlanes: topPlanes,
    claddingDisplayPlanes,
    roofUndersidePlanes: undersidePlanes,
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
    warnings,
  };
}

export { ROOF_RENDER_EPSILON_METERS };
