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
import { resolveRoofFraming, resolveRidgeCapPlacement } from './roofFramingResolver';

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
}): { topPlanes: RoofPlane[]; undersidePlanes: RoofPlane[]; ridgeStart: RoofVec3; ridgeEnd: RoofVec3; gableEndSegmentIds: string[] } {
  const { analysis, bearing, cladding, roofBeamTopY, peakY } = params;
  const { ridgeStart, ridgeEnd } = ridgeEndpointsForAxis({
    bearing,
    ridgeAxis: params.ridgeAxis,
    peakY,
  });
  const evenLong = longEdgesAreEven(bearing);
  const ridgeParallelToEvenEdges =
    (params.ridgeAxis === 'localX' && evenLong) || (params.ridgeAxis === 'localZ' && !evenLong);

  const eaveY = roofBeamTopY;
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
    ridgeStart,
    ridgeEnd,
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

export function roofUndersideElevationAt(params: {
  resolved: ResolvedRoofSystem;
  x: number;
  z: number;
}): number {
  const thickness = params.resolved.roofAssemblyThicknessMeters ?? 0.15;
  const topY = params.resolved.peakElevationMeters;
  const eaveY = params.resolved.roofBeamTopElevationMeters;

  let roofTopY = eaveY;
  if (params.resolved.ridgeStart && params.resolved.ridgeEnd) {
    const ridgeStart2 = { x: params.resolved.ridgeStart.x, z: params.resolved.ridgeStart.z };
    const ridgeEnd2 = { x: params.resolved.ridgeEnd.x, z: params.resolved.ridgeEnd.z };
    const distFromRidge = distancePointToLine2D({ x: params.x, z: params.z }, ridgeStart2, ridgeEnd2);
    const halfRun = Math.max(0.001, params.resolved.rafterRunMeters);
    const rise = topY - eaveY;
    roofTopY = topY - (distFromRidge / halfRun) * rise;
  } else if (params.resolved.peakPoint) {
    const halfRun = Math.max(0.001, params.resolved.rafterRunMeters);
    const distFromPeak = Math.hypot(params.x - params.resolved.peakPoint.x, params.z - params.resolved.peakPoint.z);
    const rise = topY - eaveY;
    roofTopY = topY - (distFromPeak / halfRun) * rise;
  }
  return roofTopY - thickness;
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
  const claddingLoop = resolveCladdingPerimeterFromBearing(bearingLoop, settings.eaveOverhangMeters);

  const analysis = analyzeRectangularFootprint({
    layout: params.layout,
    exteriorFootprint: bearingLoop,
  });

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
    roofUndersidePlanes: [],
    gableEndSegmentIds: [],
    rafterRunMeters: 0,
    rafterRiseMeters: 0,
    rafterLengthMeters: 0,
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
  const ridgeAxis = resolveRidgeAxis(
    analysis,
    settings.ridgeDirection,
    settings.selectedRidgeWallSegmentId,
  );
  const isSquare = Math.abs(analysis.lengthMeters - analysis.widthMeters) < 0.05;

  let topPlanes: RoofPlane[] = [];
  let undersidePlanes: RoofPlane[] = [];
  let ridgeStart: RoofVec3 | undefined;
  let ridgeEnd: RoofVec3 | undefined;
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
    });
    topPlanes = gable.topPlanes;
    undersidePlanes = gable.undersidePlanes.map((plane) => offsetPlaneDown(plane, settings.roofAssemblyThicknessMeters));
    ridgeStart = gable.ridgeStart;
    ridgeEnd = gable.ridgeEnd;
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

  const bearingHalfRun =
    (ridgeAxis === 'localX' ? analysis.localZSpanMeters : analysis.localXSpanMeters) / 2;
  const rafterRiseMeters = settings.peakHeightAboveRoofBeamMeters;
  const rafterRunMeters = bearingHalfRun + settings.eaveOverhangMeters;
  const rafterLengthMeters = Math.hypot(rafterRunMeters, rafterRiseMeters);
  const ridgeLengthMeters =
    ridgeStart && ridgeEnd ? Math.hypot(ridgeEnd.x - ridgeStart.x, ridgeEnd.z - ridgeStart.z) : 0;
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
    ridgeStart,
    ridgeEnd,
    peakPoint,
    roofTopPlanes: topPlanes,
    rafterLengthMeters,
    ridgeLengthMeters,
  });

  const ridgeCapPlacement = resolveRidgeCapPlacement({
    roofType: settings.roofType,
    ridgeStart,
    ridgeEnd,
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
    ridgeCapPlacement,
    peakPoint,
    roofBeamTopElevationMeters: roofBeamTopY,
    roofBeamTopY,
    peakElevationMeters: peakY,
    roofPeakY: peakY,
    roofAssemblyThicknessMeters: settings.roofAssemblyThicknessMeters,
    roofTopPlanes: topPlanes,
    roofUndersidePlanes: undersidePlanes,
    gableEndSegmentIds,
    rafterRunMeters,
    rafterRiseMeters,
    rafterLengthMeters,
    roofRunMeters: rafterRunMeters,
    roofRiseMeters: rafterRiseMeters,
    roofMemberReferenceLengthMeters: rafterLengthMeters,
    ridgeLengthMeters,
    roofSurfaceAreaSquareMeters,
    gableCmuAreaSquareMeters: 0,
    rakedCapVolumeCubicMeters: 0,
    gableEnds: [],
    warnings,
  };
}

export { ROOF_RENDER_EPSILON_METERS };
