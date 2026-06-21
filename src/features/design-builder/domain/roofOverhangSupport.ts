import type { RoofVec3 } from '../types';
import {
  longEdgesAreEven,
  offsetClosedPolygonWithEdgeOffsets,
  resolveGableRoofEdgeOffsets,
  type PlanVec2,
  type RidgeAxis,
} from './roofFootprintSupport';

export const GABLE_END_OVERHANG_VALIDATION_TOLERANCE_METERS = 0.002;

function vec3(x: number, y: number, z: number): RoofVec3 {
  return { x, y, z };
}

export function ridgeUnitVector2D(ridgeStart: RoofVec3, ridgeEnd: RoofVec3): { x: number; z: number } {
  const dx = ridgeEnd.x - ridgeStart.x;
  const dz = ridgeEnd.z - ridgeStart.z;
  const len = Math.hypot(dx, dz) || 1;
  return { x: dx / len, z: dz / len };
}

/** Outward horizontal normal for a gable end face (perpendicular to the gable wall). */
export function gableEndOutwardNormal2D(params: {
  bearing: readonly PlanVec2[];
  ridgeAxis: RidgeAxis;
  atStartGable: boolean;
}): { x: number; z: number } {
  const evenLong = longEdgesAreEven(params.bearing);
  const ridgeParallelToEvenEdges =
    (params.ridgeAxis === 'localX' && evenLong) || (params.ridgeAxis === 'localZ' && !evenLong);

  if (ridgeParallelToEvenEdges) {
    const startMid = midpoint2(params.bearing[3]!, params.bearing[0]!);
    const endMid = midpoint2(params.bearing[2]!, params.bearing[1]!);
    const unit = ridgeUnitVector2D(vec3(startMid.x, 0, startMid.z), vec3(endMid.x, 0, endMid.z));
    return params.atStartGable ? { x: -unit.x, z: -unit.z } : unit;
  }

  const startMid = midpoint2(params.bearing[0]!, params.bearing[1]!);
  const endMid = midpoint2(params.bearing[3]!, params.bearing[2]!);
  const unit = ridgeUnitVector2D(vec3(startMid.x, 0, startMid.z), vec3(endMid.x, 0, endMid.z));
  return params.atStartGable ? { x: -unit.x, z: -unit.z } : unit;
}

function midpoint2(a: PlanVec2, b: PlanVec2): PlanVec2 {
  return { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
}

export type FixedRoofPitch = {
  structuralRunMeters: number;
  structuralRiseMeters: number;
  pitchRadians: number;
  slope: number;
};

/** Pitch from structural Roof Beam bearing line to ridge — unchanged by side eave overhang. */
export function resolveFixedRoofPitch(params: {
  structuralHalfRunMeters: number;
  structuralRiseMeters: number;
}): FixedRoofPitch {
  const structuralRunMeters = Math.max(0.001, params.structuralHalfRunMeters);
  const pitchRadians = Math.atan2(params.structuralRiseMeters, structuralRunMeters);
  return {
    structuralRunMeters,
    structuralRiseMeters: params.structuralRiseMeters,
    pitchRadians,
    slope: Math.tan(pitchRadians),
  };
}

export function claddingHorizontalRunMeters(params: {
  structuralHalfRunMeters: number;
  sideEaveOverhangMeters: number;
}): number {
  return params.structuralHalfRunMeters + Math.max(0, params.sideEaveOverhangMeters);
}

export function claddingEaveElevationMeters(params: {
  structuralEaveY: number;
  fixedSlope: number;
  sideEaveOverhangMeters: number;
}): number {
  return params.structuralEaveY - params.fixedSlope * Math.max(0, params.sideEaveOverhangMeters);
}

/** Purlin/truss station (0=eave, 1=ridge) where the structural truss bearing line crosses the slope. */
export function sideEaveTrussRowStationFraction(params: {
  structuralHalfRunMeters: number;
  sideEaveOverhangMeters: number;
}): number {
  if (params.sideEaveOverhangMeters <= GABLE_END_OVERHANG_VALIDATION_TOLERANCE_METERS) {
    return 0;
  }
  const claddingRun = claddingHorizontalRunMeters(params);
  return params.sideEaveOverhangMeters / Math.max(0.001, claddingRun);
}

export function projectCladdingEaveFromStructuralBearing(params: {
  ridgePoint2: PlanVec2;
  structuralBearing2: PlanVec2;
  structuralHalfRunMeters: number;
  sideEaveOverhangMeters: number;
  structuralEaveY: number;
  fixedSlope: number;
}): RoofVec3 {
  const dx = params.structuralBearing2.x - params.ridgePoint2.x;
  const dz = params.structuralBearing2.z - params.ridgePoint2.z;
  const structuralDist = Math.hypot(dx, dz) || 1;
  const scale =
    (params.structuralHalfRunMeters + Math.max(0, params.sideEaveOverhangMeters)) / structuralDist;
  return {
    x: params.ridgePoint2.x + dx * scale,
    y: claddingEaveElevationMeters({
      structuralEaveY: params.structuralEaveY,
      fixedSlope: params.fixedSlope,
      sideEaveOverhangMeters: params.sideEaveOverhangMeters,
    }),
    z: params.ridgePoint2.z + dz * scale,
  };
}

/** @deprecated Side eave overhang extends horizontally at fixed pitch — use claddingHorizontalRunMeters offset instead. */
export function resolveEaveRunExtensionMeters(params: {
  bearingHalfRunMeters: number;
  rafterRiseMeters: number;
  eaveOverhangMeters: number;
}): number {
  return Math.max(0, params.eaveOverhangMeters);
}

export function extendRidgeEndpointsForGableOverhang(params: {
  structuralRidgeStart: RoofVec3;
  structuralRidgeEnd: RoofVec3;
  gableEndOverhangMeters: number;
  gableOutwardNormalStart: { x: number; z: number };
  gableOutwardNormalEnd: { x: number; z: number };
}): {
  structuralRidgeStart: RoofVec3;
  structuralRidgeEnd: RoofVec3;
  claddingRidgeStart: RoofVec3;
  claddingRidgeEnd: RoofVec3;
} {
  const overhang = Math.max(0, params.gableEndOverhangMeters);
  const peakY = params.structuralRidgeStart.y;
  const startNormal = params.gableOutwardNormalStart;
  const endNormal = params.gableOutwardNormalEnd;
  return {
    structuralRidgeStart: params.structuralRidgeStart,
    structuralRidgeEnd: params.structuralRidgeEnd,
    claddingRidgeStart: vec3(
      params.structuralRidgeStart.x + startNormal.x * overhang,
      peakY,
      params.structuralRidgeStart.z + startNormal.z * overhang,
    ),
    claddingRidgeEnd: vec3(
      params.structuralRidgeEnd.x + endNormal.x * overhang,
      peakY,
      params.structuralRidgeEnd.z + endNormal.z * overhang,
    ),
  };
}

export function ridgeLengthMeters(start: RoofVec3, end: RoofVec3): number {
  return Math.hypot(end.x - start.x, end.z - start.z);
}

export function resolveCladdingPerimeterWithOverhangs(params: {
  bearingPerimeter: readonly PlanVec2[];
  ridgeAxis: RidgeAxis;
  eaveOverhangMeters: number;
  gableEndOverhangMeters: number;
}): PlanVec2[] {
  if (params.bearingPerimeter.length !== 4) {
    return params.bearingPerimeter.map((point) => ({ ...point }));
  }
  const edgeOffsets = resolveGableRoofEdgeOffsets({
    bearing: params.bearingPerimeter,
    ridgeAxis: params.ridgeAxis,
    eaveOverhangMeters: params.eaveOverhangMeters,
    gableEndOverhangMeters: params.gableEndOverhangMeters,
  });
  return offsetClosedPolygonWithEdgeOffsets(params.bearingPerimeter, edgeOffsets);
}

export function assertGableEndOverhangMeters(value: number): void {
  if (value < 0) {
    throw new Error('Gable-End Overhang cannot be negative.');
  }
}
