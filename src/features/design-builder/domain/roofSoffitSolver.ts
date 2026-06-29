import type { FasciaPlacement, RoofPlane, RoofSystemSettings, RoofVec3, SoffitPlacement } from '../types';
import {
  CORRUGATED_SHEET_DISPLAY_THICKNESS_METERS,
  elevationOnRoofPlaneAtPoint,
} from './roofFramingResolver';

const MIN_SOFFIT_PANEL_WIDTH_METERS = 0.02;
const DEFAULT_SOFFIT_DROP_BELOW_BEARING_METERS = 0.0254;
const SIDE_EAVE_FASCIA_OVERLAP_METERS = 0.03;

function segmentLength(start: RoofVec3, end: RoofVec3): number {
  return Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z);
}

function planDistanceSquared(a: Pick<RoofVec3, 'x' | 'z'>, b: Pick<RoofVec3, 'x' | 'z'>): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
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

function midpoint(start: RoofVec3, end: RoofVec3): RoofVec3 {
  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
    z: (start.z + end.z) / 2,
  };
}

function nearestFasciaPlacement(
  edgeMidpoint: RoofVec3,
  fasciaPlacements: readonly FasciaPlacement[],
): FasciaPlacement | null {
  let nearest: { placement: FasciaPlacement; distanceSquared: number } | null = null;
  for (const placement of fasciaPlacements) {
    const fasciaMidpoint = midpoint(placement.bottomStart, placement.bottomEnd);
    const distanceSquared = planDistanceSquared(edgeMidpoint, fasciaMidpoint);
    if (!nearest || distanceSquared < nearest.distanceSquared) {
      nearest = { placement, distanceSquared };
    }
  }
  return nearest?.placement ?? null;
}

function soffitElevationForEdge(params: {
  edgeMidpoint: RoofVec3;
  fasciaPlacements: readonly FasciaPlacement[];
  roofBeamTopY: number;
}): number {
  const fascia = nearestFasciaPlacement(params.edgeMidpoint, params.fasciaPlacements);
  if (fascia) {
    return Math.min(fascia.bottomStart.y, fascia.bottomEnd.y);
  }
  return params.roofBeamTopY - DEFAULT_SOFFIT_DROP_BELOW_BEARING_METERS;
}

function resolveHipSoffitElevation(params: {
  innerStartSource: RoofVec3;
  innerEndSource: RoofVec3;
  outerStartSource: RoofVec3;
  outerEndSource: RoofVec3;
  edgeMidpoint: RoofVec3;
  claddingDisplayPlanes: readonly RoofPlane[];
  fasciaPlacements: readonly FasciaPlacement[];
  roofBeamTopY: number;
  roofAssemblyThicknessMeters: number;
}): number {
  const fallbackBearingY = params.roofBeamTopY - DEFAULT_SOFFIT_DROP_BELOW_BEARING_METERS;
  const fasciaY = soffitElevationForEdge({
    edgeMidpoint: params.edgeMidpoint,
    fasciaPlacements: params.fasciaPlacements,
    roofBeamTopY: params.roofBeamTopY,
  });
  if (params.fasciaPlacements.length > 0) {
    return fasciaY;
  }

  const undersideDropMeters =
    Math.max(
      params.roofAssemblyThicknessMeters,
      CORRUGATED_SHEET_DISPLAY_THICKNESS_METERS,
    ) + DEFAULT_SOFFIT_DROP_BELOW_BEARING_METERS;
  const sampledYs = [
    params.outerStartSource,
    params.outerEndSource,
    params.edgeMidpoint,
    params.innerStartSource,
    params.innerEndSource,
  ]
    .map((point) => lowestRoofPlaneYAtPoint(params.claddingDisplayPlanes, point))
    .filter((y): y is number => y != null && Number.isFinite(y))
    .map((roofTopY) => roofTopY - undersideDropMeters);

  if (sampledYs.length === 0) {
    return fallbackBearingY;
  }

  return Math.min(fallbackBearingY, ...sampledYs);
}

function roleForEdge(params: {
  roofType: RoofSystemSettings['roofType'];
  innerStart: RoofVec3;
  innerEnd: RoofVec3;
  ridgeStart?: RoofVec3;
  ridgeEnd?: RoofVec3;
}): SoffitPlacement['edgeRole'] {
  if (params.roofType === 'hip') {
    return 'hip_eave';
  }
  if (!params.ridgeStart || !params.ridgeEnd) {
    return 'roof_perimeter';
  }

  const edgeX = params.innerEnd.x - params.innerStart.x;
  const edgeZ = params.innerEnd.z - params.innerStart.z;
  const ridgeX = params.ridgeEnd.x - params.ridgeStart.x;
  const ridgeZ = params.ridgeEnd.z - params.ridgeStart.z;
  const edgeLength = Math.hypot(edgeX, edgeZ);
  const ridgeLength = Math.hypot(ridgeX, ridgeZ);
  if (edgeLength <= 1e-8 || ridgeLength <= 1e-8) {
    return 'roof_perimeter';
  }

  const alignment = Math.abs((edgeX * ridgeX + edgeZ * ridgeZ) / (edgeLength * ridgeLength));
  return alignment > 0.85 ? 'side_eave' : 'gable_return';
}

function roofPlaneYAtPoint(planes: readonly RoofPlane[], point: Pick<RoofVec3, 'x' | 'z'>): number | null {
  const elevations = planes
    .map((plane) => elevationOnRoofPlaneAtPoint(plane, point.x, point.z))
    .filter((y): y is number => y != null && Number.isFinite(y));
  if (elevations.length === 0) {
    return null;
  }
  return elevations.sort((a, b) => b - a)[0]!;
}

function lowestRoofPlaneYAtPoint(planes: readonly RoofPlane[], point: Pick<RoofVec3, 'x' | 'z'>): number | null {
  const elevations = planes
    .map((plane) => elevationOnRoofPlaneAtPoint(plane, point.x, point.z))
    .filter((y): y is number => y != null && Number.isFinite(y));
  if (elevations.length === 0) {
    return null;
  }
  return elevations.sort((a, b) => a - b)[0]!;
}

function signedPlanDistanceFromRidge(params: {
  point: Pick<RoofVec3, 'x' | 'z'>;
  ridgeStart: RoofVec3;
  ridgeEnd: RoofVec3;
}): number {
  const ridgeX = params.ridgeEnd.x - params.ridgeStart.x;
  const ridgeZ = params.ridgeEnd.z - params.ridgeStart.z;
  const pointX = params.point.x - params.ridgeStart.x;
  const pointZ = params.point.z - params.ridgeStart.z;
  return ridgeX * pointZ - ridgeZ * pointX;
}

function roofPlanesForRidgeSide(params: {
  planes: readonly RoofPlane[];
  ridgeStart: RoofVec3;
  ridgeEnd: RoofVec3;
  referencePoint: Pick<RoofVec3, 'x' | 'z'>;
}): readonly RoofPlane[] {
  const referenceSign = signedPlanDistanceFromRidge({
    point: params.referencePoint,
    ridgeStart: params.ridgeStart,
    ridgeEnd: params.ridgeEnd,
  });
  if (Math.abs(referenceSign) <= 1e-8) {
    return params.planes;
  }

  const matchingPlanes = params.planes.filter((plane) => {
    const sideSum = plane.corners.reduce(
      (sum, corner) =>
        sum +
        signedPlanDistanceFromRidge({
          point: corner,
          ridgeStart: params.ridgeStart,
          ridgeEnd: params.ridgeEnd,
        }),
      0,
    );
    return Math.abs(sideSum) > 1e-8 && sideSum * referenceSign > 0;
  });
  return matchingPlanes.length > 0 ? matchingPlanes : params.planes;
}

function slopedSoffitPoint(params: {
  source: Pick<RoofVec3, 'x' | 'z'>;
  claddingDisplayPlanes: readonly RoofPlane[];
  fallbackY: number;
  undersideDropMeters: number;
}): RoofVec3 {
  const topY = roofPlaneYAtPoint(params.claddingDisplayPlanes, params.source);
  return {
    x: params.source.x,
    y: (topY ?? params.fallbackY) - params.undersideDropMeters,
    z: params.source.z,
  };
}

function pushPlacement(
  placements: SoffitPlacement[],
  placement: Omit<SoffitPlacement, 'id' | 'areaSquareMeters'>,
): void {
  const areaSquareMeters = quadArea(
    placement.innerStart,
    placement.innerEnd,
    placement.outerEnd,
    placement.outerStart,
  );
  if (areaSquareMeters <= 0.0001) {
    return;
  }

  placements.push({
    ...placement,
    id: `roof-soffit-${placements.length}`,
    areaSquareMeters,
  });
}

function pushSlopedGableReturnPlacements(params: {
  placements: SoffitPlacement[];
  innerStartSource: RoofVec3;
  innerEndSource: RoofVec3;
  outerStartSource: RoofVec3;
  outerEndSource: RoofVec3;
  edgeMidpoint: RoofVec3;
  claddingDisplayPlanes: readonly RoofPlane[];
  structuralRidgeStart?: RoofVec3;
  structuralRidgeEnd?: RoofVec3;
  fallbackY: number;
  undersideDropMeters: number;
}): boolean {
  if (
    !params.structuralRidgeStart ||
    !params.structuralRidgeEnd ||
    params.claddingDisplayPlanes.length === 0
  ) {
    return false;
  }

  const useStartRidge =
    planDistanceSquared(params.edgeMidpoint, params.structuralRidgeStart) <=
    planDistanceSquared(params.edgeMidpoint, params.structuralRidgeEnd);
  const innerRidgeSource = useStartRidge ? params.structuralRidgeStart : params.structuralRidgeEnd;
  const oppositeRidgeSource = useStartRidge ? params.structuralRidgeEnd : params.structuralRidgeStart;
  const gableOffset = {
    x:
      ((params.outerStartSource.x - params.innerStartSource.x) +
        (params.outerEndSource.x - params.innerEndSource.x)) /
      2,
    z:
      ((params.outerStartSource.z - params.innerStartSource.z) +
        (params.outerEndSource.z - params.innerEndSource.z)) /
      2,
  };
  const outerRidgeSource = {
    x: innerRidgeSource.x + gableOffset.x,
    y: innerRidgeSource.y,
    z: innerRidgeSource.z + gableOffset.z,
  };
  const startSidePlanes = roofPlanesForRidgeSide({
    planes: params.claddingDisplayPlanes,
    ridgeStart: innerRidgeSource,
    ridgeEnd: oppositeRidgeSource,
    referencePoint: params.innerStartSource,
  });
  const endSidePlanes = roofPlanesForRidgeSide({
    planes: params.claddingDisplayPlanes,
    ridgeStart: innerRidgeSource,
    ridgeEnd: oppositeRidgeSource,
    referencePoint: params.innerEndSource,
  });

  const innerStart = slopedSoffitPoint({
    source: params.innerStartSource,
    claddingDisplayPlanes: startSidePlanes,
    fallbackY: params.fallbackY,
    undersideDropMeters: params.undersideDropMeters,
  });
  const innerEnd = slopedSoffitPoint({
    source: params.innerEndSource,
    claddingDisplayPlanes: endSidePlanes,
    fallbackY: params.fallbackY,
    undersideDropMeters: params.undersideDropMeters,
  });
  const outerStart = slopedSoffitPoint({
    source: params.outerStartSource,
    claddingDisplayPlanes: startSidePlanes,
    fallbackY: params.fallbackY,
    undersideDropMeters: params.undersideDropMeters,
  });
  const outerEnd = slopedSoffitPoint({
    source: params.outerEndSource,
    claddingDisplayPlanes: endSidePlanes,
    fallbackY: params.fallbackY,
    undersideDropMeters: params.undersideDropMeters,
  });
  const innerRidge = slopedSoffitPoint({
    source: innerRidgeSource,
    claddingDisplayPlanes: startSidePlanes,
    fallbackY: params.fallbackY,
    undersideDropMeters: params.undersideDropMeters,
  });
  const outerRidge = slopedSoffitPoint({
    source: outerRidgeSource,
    claddingDisplayPlanes: startSidePlanes,
    fallbackY: params.fallbackY,
    undersideDropMeters: params.undersideDropMeters,
  });

  pushPlacement(params.placements, {
    edgeRole: 'gable_return',
    innerStart,
    innerEnd: innerRidge,
    outerEnd: outerRidge,
    outerStart,
  });
  pushPlacement(params.placements, {
    edgeRole: 'gable_return',
    innerStart: slopedSoffitPoint({
      source: innerRidgeSource,
      claddingDisplayPlanes: endSidePlanes,
      fallbackY: params.fallbackY,
      undersideDropMeters: params.undersideDropMeters,
    }),
    innerEnd,
    outerEnd,
    outerStart: slopedSoffitPoint({
      source: outerRidgeSource,
      claddingDisplayPlanes: endSidePlanes,
      fallbackY: params.fallbackY,
      undersideDropMeters: params.undersideDropMeters,
    }),
  });
  return true;
}

function pushSlopedSideEavePlacement(params: {
  placements: SoffitPlacement[];
  innerStartSource: RoofVec3;
  innerEndSource: RoofVec3;
  outerStartSource: RoofVec3;
  outerEndSource: RoofVec3;
  edgeMidpoint: RoofVec3;
  claddingDisplayPlanes: readonly RoofPlane[];
  structuralRidgeStart?: RoofVec3;
  structuralRidgeEnd?: RoofVec3;
  fallbackY: number;
  undersideDropMeters: number;
  fasciaOverlapMeters: number;
}): boolean {
  if (
    !params.structuralRidgeStart ||
    !params.structuralRidgeEnd ||
    params.claddingDisplayPlanes.length === 0
  ) {
    return false;
  }

  const sidePlanes = roofPlanesForRidgeSide({
    planes: params.claddingDisplayPlanes,
    ridgeStart: params.structuralRidgeStart,
    ridgeEnd: params.structuralRidgeEnd,
    referencePoint: params.edgeMidpoint,
  });
  const startOffset = {
    x: params.outerStartSource.x - params.innerStartSource.x,
    z: params.outerStartSource.z - params.innerStartSource.z,
  };
  const endOffset = {
    x: params.outerEndSource.x - params.innerEndSource.x,
    z: params.outerEndSource.z - params.innerEndSource.z,
  };
  const startOffsetLength = Math.hypot(startOffset.x, startOffset.z);
  const endOffsetLength = Math.hypot(endOffset.x, endOffset.z);
  const outerStartSource =
    startOffsetLength > 1e-8 && params.fasciaOverlapMeters > 0
      ? {
          ...params.outerStartSource,
          x: params.outerStartSource.x + (startOffset.x / startOffsetLength) * params.fasciaOverlapMeters,
          z: params.outerStartSource.z + (startOffset.z / startOffsetLength) * params.fasciaOverlapMeters,
        }
      : params.outerStartSource;
  const outerEndSource =
    endOffsetLength > 1e-8 && params.fasciaOverlapMeters > 0
      ? {
          ...params.outerEndSource,
          x: params.outerEndSource.x + (endOffset.x / endOffsetLength) * params.fasciaOverlapMeters,
          z: params.outerEndSource.z + (endOffset.z / endOffsetLength) * params.fasciaOverlapMeters,
        }
      : params.outerEndSource;
  pushPlacement(params.placements, {
    edgeRole: 'side_eave',
    innerStart: slopedSoffitPoint({
      source: params.innerStartSource,
      claddingDisplayPlanes: sidePlanes,
      fallbackY: params.fallbackY,
      undersideDropMeters: params.undersideDropMeters,
    }),
    innerEnd: slopedSoffitPoint({
      source: params.innerEndSource,
      claddingDisplayPlanes: sidePlanes,
      fallbackY: params.fallbackY,
      undersideDropMeters: params.undersideDropMeters,
    }),
    outerEnd: slopedSoffitPoint({
      source: outerEndSource,
      claddingDisplayPlanes: sidePlanes,
      fallbackY: params.fallbackY,
      undersideDropMeters: params.undersideDropMeters,
    }),
    outerStart: slopedSoffitPoint({
      source: outerStartSource,
      claddingDisplayPlanes: sidePlanes,
      fallbackY: params.fallbackY,
      undersideDropMeters: params.undersideDropMeters,
    }),
  });
  return true;
}

export function resolveRoofSoffitPlacements(params: {
  roofSystem: RoofSystemSettings;
  roofType: RoofSystemSettings['roofType'];
  structuralBearingPerimeter: readonly RoofVec3[];
  claddingPerimeter: readonly RoofVec3[];
  roofSheetPerimeter: readonly RoofVec3[];
  claddingDisplayPlanes: readonly RoofPlane[];
  fasciaPlacements: readonly FasciaPlacement[];
  roofBeamTopY: number;
  structuralRidgeStart?: RoofVec3;
  structuralRidgeEnd?: RoofVec3;
}): SoffitPlacement[] {
  if (!params.roofSystem.soffit.enabled) {
    return [];
  }

  const outerPerimeter =
    params.fasciaPlacements.length === 0 &&
    params.roofSheetPerimeter.length === params.structuralBearingPerimeter.length
      ? params.roofSheetPerimeter
      : params.claddingPerimeter;
  if (
    params.structuralBearingPerimeter.length < 3 ||
    outerPerimeter.length !== params.structuralBearingPerimeter.length
  ) {
    return [];
  }

  const placements: SoffitPlacement[] = [];
  const slopedUndersideDropMeters = Math.max(
    params.roofSystem.roofAssemblyThicknessMeters,
    CORRUGATED_SHEET_DISPLAY_THICKNESS_METERS,
  );
  for (let index = 0; index < params.structuralBearingPerimeter.length; index += 1) {
    const nextIndex = (index + 1) % params.structuralBearingPerimeter.length;
    const innerStartSource = params.structuralBearingPerimeter[index]!;
    const innerEndSource = params.structuralBearingPerimeter[nextIndex]!;
    const outerStartSource = outerPerimeter[index]!;
    const outerEndSource = outerPerimeter[nextIndex]!;
    const widthStart = Math.hypot(outerStartSource.x - innerStartSource.x, outerStartSource.z - innerStartSource.z);
    const widthEnd = Math.hypot(outerEndSource.x - innerEndSource.x, outerEndSource.z - innerEndSource.z);
    if (Math.max(widthStart, widthEnd) < MIN_SOFFIT_PANEL_WIDTH_METERS) {
      continue;
    }

    const edgeMidpoint = midpoint(outerStartSource, outerEndSource);
    const y = soffitElevationForEdge({
      edgeMidpoint,
      fasciaPlacements: params.fasciaPlacements,
      roofBeamTopY: params.roofBeamTopY,
    });
    const edgeRole = roleForEdge({
      roofType: params.roofType,
      innerStart: innerStartSource,
      innerEnd: innerEndSource,
      ridgeStart: params.structuralRidgeStart,
      ridgeEnd: params.structuralRidgeEnd,
    });
    if (
      edgeRole === 'gable_return' &&
      pushSlopedGableReturnPlacements({
        placements,
    innerStartSource,
        innerEndSource,
        outerStartSource,
        outerEndSource,
        edgeMidpoint,
        claddingDisplayPlanes: params.claddingDisplayPlanes,
        structuralRidgeStart: params.structuralRidgeStart,
        structuralRidgeEnd: params.structuralRidgeEnd,
        fallbackY: y,
        undersideDropMeters: slopedUndersideDropMeters,
      })
    ) {
      continue;
    }
    if (
      edgeRole === 'side_eave' &&
      pushSlopedSideEavePlacement({
        placements,
        innerStartSource,
        innerEndSource,
        outerStartSource,
        outerEndSource,
        edgeMidpoint,
        claddingDisplayPlanes: params.claddingDisplayPlanes,
        structuralRidgeStart: params.structuralRidgeStart,
        structuralRidgeEnd: params.structuralRidgeEnd,
        fallbackY: y,
        undersideDropMeters: slopedUndersideDropMeters,
        fasciaOverlapMeters: params.fasciaPlacements.length > 0 ? SIDE_EAVE_FASCIA_OVERLAP_METERS : 0,
      })
    ) {
      continue;
    }

    if (edgeRole === 'hip_eave') {
      const hipY = resolveHipSoffitElevation({
        innerStartSource,
        innerEndSource,
        outerStartSource,
        outerEndSource,
        edgeMidpoint,
        claddingDisplayPlanes: params.claddingDisplayPlanes,
        fasciaPlacements: params.fasciaPlacements,
        roofBeamTopY: params.roofBeamTopY,
        roofAssemblyThicknessMeters: params.roofSystem.roofAssemblyThicknessMeters,
      });
      pushPlacement(placements, {
        edgeRole,
        innerStart: { x: innerStartSource.x, y: hipY, z: innerStartSource.z },
        innerEnd: { x: innerEndSource.x, y: hipY, z: innerEndSource.z },
        outerEnd: { x: outerEndSource.x, y: hipY, z: outerEndSource.z },
        outerStart: { x: outerStartSource.x, y: hipY, z: outerStartSource.z },
      });
      continue;
    }

    const innerStart = { x: innerStartSource.x, y, z: innerStartSource.z };
    const innerEnd = { x: innerEndSource.x, y, z: innerEndSource.z };
    const outerEnd = { x: outerEndSource.x, y, z: outerEndSource.z };
    const outerStart = { x: outerStartSource.x, y, z: outerStartSource.z };
    pushPlacement(placements, {
      edgeRole,
      innerStart,
      innerEnd,
      outerEnd,
      outerStart,
    });
  }

  return placements;
}

export function totalRoofSoffitAreaSquareMeters(placements: readonly SoffitPlacement[]): number {
  return placements.reduce((sum, placement) => sum + placement.areaSquareMeters, 0);
}

export function totalRoofSoffitLengthMeters(placements: readonly SoffitPlacement[]): number {
  return placements.reduce((sum, placement) => sum + segmentLength(placement.outerStart, placement.outerEnd), 0);
}
