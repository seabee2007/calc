import type { RakedCapPlacement, ResolvedRoofSystem, RoofSystemSettings } from '../types';
import type { CmuBlockInstance, SegmentFrame } from '../geometry/designGeometry';
import {
  DEFAULT_MIN_RAKE_CAP_DEPTH_METERS,
  ROOF_CONTACT_EPSILON_METERS,
} from './structuralFrameDefaults';
import {
  allowedMasonryTopYAtStation,
  GABLE_HEIGHT_TOLERANCE_METERS,
  rakedCapTopYAtStation,
} from './roofGableSolver';

const RIDGE_MEET_TOLERANCE_METERS = 0.002;

export type RakedCapSolveResult = {
  placements: RakedCapPlacement[];
  warnings: string[];
};

function blockStationSpan(block: CmuBlockInstance): {
  startStationMeters: number;
  endStationMeters: number;
} {
  const start = block.startAlongMeters ?? block.stationMeters ?? 0;
  const end = block.endAlongMeters ?? start + block.lengthMeters;
  return { startStationMeters: start, endStationMeters: end };
}

function blockTopY(block: CmuBlockInstance): number {
  const height = block.physicalHeightMeters ?? block.heightMeters ?? 0;
  return block.y + height / 2;
}

export function courseMasonryTopAtStation(params: {
  blocks: readonly CmuBlockInstance[];
  courseIndex: number;
  stationMeters: number;
}): number {
  let maxTop = -Infinity;
  for (const block of params.blocks) {
    if ((block.courseIndex ?? 0) !== params.courseIndex) continue;
    const span = blockStationSpan(block);
    if (
      params.stationMeters + 0.001 < span.startStationMeters ||
      params.stationMeters - 0.001 > span.endStationMeters
    ) {
      continue;
    }
    maxTop = Math.max(maxTop, blockTopY(block));
  }
  return maxTop;
}

export function masonryTopEnvelopeYAtStation(params: {
  blocks: readonly CmuBlockInstance[];
  stationMeters: number;
}): number {
  let maxTop = -Infinity;
  for (const block of params.blocks) {
    const span = blockStationSpan(block);
    if (params.stationMeters + 0.001 < span.startStationMeters || params.stationMeters - 0.001 > span.endStationMeters) {
      continue;
    }
    maxTop = Math.max(maxTop, blockTopY(block));
  }
  if (!Number.isFinite(maxTop)) {
    return params.blocks.reduce((max, block) => Math.max(max, blockTopY(block)), -Infinity);
  }
  return maxTop;
}

function collectStationBreakpoints(params: {
  blocks: readonly CmuBlockInstance[];
  panelStartStation: number;
  panelEndStation: number;
  ridgeStationMeters: number;
}): number[] {
  const breakpoints = new Set<number>([
    params.panelStartStation,
    params.panelEndStation,
    params.ridgeStationMeters,
  ]);
  for (const block of params.blocks) {
    const span = blockStationSpan(block);
    breakpoints.add(Math.max(params.panelStartStation, span.startStationMeters));
    breakpoints.add(Math.min(params.panelEndStation, span.endStationMeters));
  }
  return [...breakpoints].filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
}

function resolveCapWallDepthMeters(params: {
  roofSystem: RoofSystemSettings;
  wallThicknessMeters: number;
}): number {
  const configured =
    params.roofSystem.gable.rakedConcreteCapWallDepthMeters ??
    params.roofSystem.gable.rakedConcreteCapDepthMeters;
  return Math.max(0.05, configured ?? params.wallThicknessMeters);
}

function capDepthMeters(params: {
  topY: number;
  bottomY: number;
}): number {
  return params.topY - params.bottomY;
}

function validateCapSegment(params: {
  startTopY: number;
  endTopY: number;
  startBottomY: number;
  endBottomY: number;
  minRakeCapDepthMeters: number;
}): boolean {
  if (params.startTopY <= params.startBottomY || params.endTopY <= params.endBottomY) {
    return false;
  }
  const startDepth = capDepthMeters({ topY: params.startTopY, bottomY: params.startBottomY });
  const endDepth = capDepthMeters({ topY: params.endTopY, bottomY: params.endBottomY });
  const tolerance = params.minRakeCapDepthMeters - GABLE_HEIGHT_TOLERANCE_METERS;
  return startDepth >= tolerance && endDepth >= tolerance;
}

function segmentVolumeCubicMeters(params: {
  startStationMeters: number;
  endStationMeters: number;
  startTopY: number;
  endTopY: number;
  startBottomY: number;
  endBottomY: number;
  wallDepthMeters: number;
}): number {
  const horizontalLengthMeters = params.endStationMeters - params.startStationMeters;
  const startCapHeightMeters = params.startTopY - params.startBottomY;
  const endCapHeightMeters = params.endTopY - params.endBottomY;
  return ((startCapHeightMeters + endCapHeightMeters) / 2) * horizontalLengthMeters * params.wallDepthMeters;
}

export function roofToCapClearanceAtStation(params: {
  capTopY: number;
  resolvedRoof: ResolvedRoofSystem;
  roofSystem?: import('../types').RoofSystemSettings;
  frame: SegmentFrame;
  stationMeters: number;
  panelStartStation: number;
  panelEndStation: number;
}): number {
  const capBearingY = rakedCapTopYAtStation({
    resolvedRoof: params.resolvedRoof,
    roofSystem: params.roofSystem,
    frame: params.frame,
    stationMeters: params.stationMeters,
    panelStartStation: params.panelStartStation,
    panelEndStation: params.panelEndStation,
  });
  return capBearingY - params.capTopY;
}

export function solveRakedCapPlacements(params: {
  gableEndSegmentId: string;
  panelId: string;
  frame: SegmentFrame;
  panelStartStation: number;
  panelEndStation: number;
  panelBottomElevationMeters: number;
  blocks: CmuBlockInstance[];
  roofSystem: RoofSystemSettings;
  resolvedRoof: ResolvedRoofSystem;
  wallDepthMeters: number;
  moduleHeightMeters: number;
}): RakedCapPlacement[] {
  return solveRakedCapPlacementsWithWarnings(params).placements;
}

export function solveRakedCapPlacementsWithWarnings(params: {
  gableEndSegmentId: string;
  panelId: string;
  frame: SegmentFrame;
  panelStartStation: number;
  panelEndStation: number;
  panelBottomElevationMeters: number;
  blocks: CmuBlockInstance[];
  roofSystem: RoofSystemSettings;
  resolvedRoof: ResolvedRoofSystem;
  wallDepthMeters: number;
  moduleHeightMeters: number;
}): RakedCapSolveResult {
  if (
    !params.roofSystem.gable.rakedConcreteCapEnabled ||
    params.roofSystem.roofType !== 'gable' ||
    params.blocks.length === 0
  ) {
    return { placements: [], warnings: [] };
  }

  const minRakeCapDepthMeters = Math.max(
    DEFAULT_MIN_RAKE_CAP_DEPTH_METERS,
    params.roofSystem.gable.rakeClearanceMeters,
  );
  const capWallDepthMeters = resolveCapWallDepthMeters({
    roofSystem: params.roofSystem,
    wallThicknessMeters: params.wallDepthMeters,
  });
  const ridgeStationMeters = (params.panelStartStation + params.panelEndStation) / 2;
  const breakpoints = collectStationBreakpoints({
    blocks: params.blocks,
    panelStartStation: params.panelStartStation,
    panelEndStation: params.panelEndStation,
    ridgeStationMeters,
  });
  const warnings: string[] = [];
  const caps: RakedCapPlacement[] = [];

  for (let index = 0; index < breakpoints.length - 1; index += 1) {
    const startStationMeters = breakpoints[index]!;
    const endStationMeters = breakpoints[index + 1]!;
    const span = endStationMeters - startStationMeters;
    if (span <= 0.01) continue;

    const startBottomY = masonryTopEnvelopeYAtStation({
      blocks: params.blocks,
      stationMeters: startStationMeters + 0.0005,
    });
    const endBottomY = masonryTopEnvelopeYAtStation({
      blocks: params.blocks,
      stationMeters: endStationMeters - 0.0005,
    });
    if (!Number.isFinite(startBottomY) || !Number.isFinite(endBottomY)) {
      continue;
    }

    const startTopY = rakedCapTopYAtStation({
      resolvedRoof: params.resolvedRoof,
      roofSystem: params.roofSystem,
      frame: params.frame,
      stationMeters: startStationMeters,
      panelStartStation: params.panelStartStation,
      panelEndStation: params.panelEndStation,
    });
    const endTopY = rakedCapTopYAtStation({
      resolvedRoof: params.resolvedRoof,
      roofSystem: params.roofSystem,
      frame: params.frame,
      stationMeters: endStationMeters,
      panelStartStation: params.panelStartStation,
      panelEndStation: params.panelEndStation,
    });

    const startDepth = capDepthMeters({ topY: startTopY, bottomY: startBottomY });
    const endDepth = capDepthMeters({ topY: endTopY, bottomY: endBottomY });
    if (
      startDepth < minRakeCapDepthMeters - GABLE_HEIGHT_TOLERANCE_METERS ||
      endDepth < minRakeCapDepthMeters - GABLE_HEIGHT_TOLERANCE_METERS
    ) {
      warnings.push(
        `Insufficient raked-cap depth at stations ${startStationMeters.toFixed(3)}–${endStationMeters.toFixed(3)} m (actual ${Math.min(startDepth, endDepth).toFixed(3)} m, required ${minRakeCapDepthMeters.toFixed(3)} m). Lower gable CMU courses; cap top remains at the purlin bottom.`,
      );
      continue;
    }

    if (
      !validateCapSegment({
        startTopY,
        endTopY,
        startBottomY,
        endBottomY,
        minRakeCapDepthMeters,
      })
    ) {
      continue;
    }

    const midStation = (startStationMeters + endStationMeters) / 2;
    const slope: RakedCapPlacement['slope'] = midStation <= ridgeStationMeters + 0.0001 ? 'left' : 'right';
    const volumeCubicMeters = segmentVolumeCubicMeters({
      startStationMeters,
      endStationMeters,
      startTopY,
      endTopY,
      startBottomY,
      endBottomY,
      wallDepthMeters: capWallDepthMeters,
    });
    if (volumeCubicMeters <= ROOF_CONTACT_EPSILON_METERS) continue;

    caps.push({
      id: `${params.panelId}-rake-cap-${slope}-${index}`,
      gableEndSegmentId: params.gableEndSegmentId,
      slope,
      startStationMeters,
      endStationMeters,
      startBottomY,
      endBottomY,
      startTopY,
      endTopY,
      wallDepthMeters: capWallDepthMeters,
      concreteVolumeCubicMeters: volumeCubicMeters,
      source: 'gable_raked_concrete_cap',
    });
  }

  const leftCaps = caps.filter((cap) => cap.slope === 'left');
  const rightCaps = caps.filter((cap) => cap.slope === 'right');
  if (leftCaps.length > 0 && rightCaps.length > 0) {
    const leftEnd = leftCaps.reduce((best, cap) =>
      cap.endStationMeters > best.endStationMeters ? cap : best,
    );
    const rightStart = rightCaps.reduce((best, cap) =>
      cap.startStationMeters < best.startStationMeters ? cap : best,
    );
    const leftPoint = {
      x: params.frame.start.x + params.frame.tangent.x * leftEnd.endStationMeters,
      y: leftEnd.endTopY,
      z: params.frame.start.z + params.frame.tangent.z * leftEnd.endStationMeters,
    };
    const rightPoint = {
      x: params.frame.start.x + params.frame.tangent.x * rightStart.startStationMeters,
      y: rightStart.startTopY,
      z: params.frame.start.z + params.frame.tangent.z * rightStart.startStationMeters,
    };
    const ridgeGap = Math.hypot(leftPoint.x - rightPoint.x, leftPoint.y - rightPoint.y, leftPoint.z - rightPoint.z);
    if (ridgeGap > RIDGE_MEET_TOLERANCE_METERS) {
      const ridgeTopY = rakedCapTopYAtStation({
        resolvedRoof: params.resolvedRoof,
        roofSystem: params.roofSystem,
        frame: params.frame,
        stationMeters: ridgeStationMeters,
        panelStartStation: params.panelStartStation,
        panelEndStation: params.panelEndStation,
      });
      leftEnd.endTopY = ridgeTopY;
      rightStart.startTopY = ridgeTopY;
      leftEnd.concreteVolumeCubicMeters = segmentVolumeCubicMeters(leftEnd);
      rightStart.concreteVolumeCubicMeters = segmentVolumeCubicMeters(rightStart);
    }
  }

  return {
    placements: caps.filter(
      (cap) =>
        cap.startTopY > cap.startBottomY + GABLE_HEIGHT_TOLERANCE_METERS &&
        cap.endTopY > cap.endBottomY + GABLE_HEIGHT_TOLERANCE_METERS &&
        cap.concreteVolumeCubicMeters > ROOF_CONTACT_EPSILON_METERS,
    ),
    warnings,
  };
}

export function totalRakedCapVolumeCubicMeters(caps: readonly RakedCapPlacement[]): number {
  return caps.reduce((sum, cap) => sum + cap.concreteVolumeCubicMeters, 0);
}

export function totalRakedCapLinearLengthMeters(caps: readonly RakedCapPlacement[]): number {
  return caps.reduce((sum, cap) => sum + (cap.endStationMeters - cap.startStationMeters), 0);
}

export function minimumRakedCapDepthMeters(caps: readonly RakedCapPlacement[]): number {
  if (caps.length === 0) return 0;
  return caps.reduce((minDepth, cap) => {
    const startDepth = cap.startTopY - cap.startBottomY;
    const endDepth = cap.endTopY - cap.endBottomY;
    return Math.min(minDepth, startDepth, endDepth);
  }, Number.POSITIVE_INFINITY);
}

export function totalGableCmuAreaSquareMeters(blocks: readonly CmuBlockInstance[]): number {
  return blocks.reduce((sum, block) => {
    const height = block.physicalHeightMeters ?? block.heightMeters ?? 0;
    const length = block.actualLengthMeters ?? block.lengthMeters;
    return sum + length * height;
  }, 0);
}

export function minimumAllowedMasonryTopY(params: {
  resolvedRoof: ResolvedRoofSystem;
  frame: SegmentFrame;
  panelStartStation: number;
  panelEndStation: number;
  minRakeCapDepthMeters: number;
  roofSystem?: import('../types').RoofSystemSettings;
}): number {
  const samples = [
    params.panelStartStation,
    params.panelEndStation,
    (params.panelStartStation + params.panelEndStation) / 2,
  ];
  return Math.min(
    ...samples.map((stationMeters) =>
      allowedMasonryTopYAtStation({
        resolvedRoof: params.resolvedRoof,
        roofSystem: params.roofSystem,
        frame: params.frame,
        stationMeters,
        panelStartStation: params.panelStartStation,
        panelEndStation: params.panelEndStation,
        minRakeCapDepthMeters: params.minRakeCapDepthMeters,
      }),
    ),
  );
}
