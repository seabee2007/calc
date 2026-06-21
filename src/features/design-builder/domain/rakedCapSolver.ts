import type {
  RakedCapPlacement,
  ResolvedRoofSystem,
  RoofSystemSettings,
} from '../types';
import type {
  CmuBlockInstance,
  SegmentFrame,
} from '../geometry/designGeometry';
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
const CAP_SEAM_TOLERANCE_METERS = 0.0005;
const CAP_TO_CMU_CONTACT_OVERLAP_METERS = 0.001;
const MIN_INTERVAL_SPAN_METERS = 0.001;

export type RakedCapSolveResult = {
  placements: RakedCapPlacement[];
  warnings: string[];
};

type SourceAwareBlock = CmuBlockInstance & {
  source?: string;
  topY?: number;
};

type StationSpan = {
  startStationMeters: number;
  endStationMeters: number;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function blockStationSpan(block: CmuBlockInstance): StationSpan {
  const start = block.startAlongMeters ?? block.stationMeters ?? 0;
  const length = block.actualLengthMeters ?? block.lengthMeters ?? 0;
  const rawEnd = block.endAlongMeters ?? start + length;

  return {
    startStationMeters: Math.min(start, rawEnd),
    endStationMeters: Math.max(start, rawEnd),
  };
}

function blockTopY(block: CmuBlockInstance): number {
  const withTop = block as SourceAwareBlock;

  if (isFiniteNumber(withTop.topY)) {
    return withTop.topY;
  }

  const height = block.physicalHeightMeters ?? block.heightMeters ?? 0;
  return block.y + height / 2;
}

/**
 * Current call sites normally pass gable blocks only. When source is present,
 * use the final gable solver output; otherwise keep legacy saved designs working.
 */
function finalGableBlocks(
  blocks: readonly CmuBlockInstance[],
): CmuBlockInstance[] {
  const finalBlocks = blocks.filter(
    (block) => (block as SourceAwareBlock).source === 'gable_end_solver',
  );

  return finalBlocks.length > 0 ? finalBlocks : [...blocks];
}

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function dedupeSortedStations(stations: readonly number[]): number[] {
  const sorted = stations.filter(isFiniteNumber).sort((a, b) => a - b);
  const result: number[] = [];

  for (const station of sorted) {
    const prior = result[result.length - 1];

    if (
      prior === undefined ||
      Math.abs(station - prior) > CAP_SEAM_TOLERANCE_METERS
    ) {
      result.push(station);
    }
  }

  return result;
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

function capTopAtStation(params: {
  resolvedRoof: ResolvedRoofSystem;
  roofSystem: RoofSystemSettings;
  frame: SegmentFrame;
  stationMeters: number;
  panelStartStation: number;
  panelEndStation: number;
}): number {
  return rakedCapTopYAtStation({
    resolvedRoof: params.resolvedRoof,
    roofSystem: params.roofSystem,
    frame: params.frame,
    stationMeters: params.stationMeters,
    panelStartStation: params.panelStartStation,
    panelEndStation: params.panelEndStation,
  });
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
  const span = params.endStationMeters - params.startStationMeters;
  const startDepth = params.startTopY - params.startBottomY;
  const endDepth = params.endTopY - params.endBottomY;

  return ((startDepth + endDepth) / 2) * span * params.wallDepthMeters;
}

function findCrossing(params: {
  from: number;
  to: number;
  topY: number;
  capTop: (station: number) => number;
}): number | null {
  let low = params.from;
  let high = params.to;
  let lowValue = params.capTop(low) - params.topY;
  const highValue = params.capTop(high) - params.topY;

  if (Math.abs(lowValue) <= CAP_SEAM_TOLERANCE_METERS) {
    return low;
  }

  if (Math.abs(highValue) <= CAP_SEAM_TOLERANCE_METERS) {
    return high;
  }

  if (lowValue * highValue > 0) {
    return null;
  }

  for (let iteration = 0; iteration < 40; iteration += 1) {
    const mid = (low + high) / 2;
    const midValue = params.capTop(mid) - params.topY;

    if (Math.abs(midValue) <= CAP_SEAM_TOLERANCE_METERS) {
      return mid;
    }

    if (lowValue * midValue <= 0) {
      high = mid;
    } else {
      low = mid;
      lowValue = midValue;
    }
  }

  return (low + high) / 2;
}

function collectBreakpoints(params: {
  blocks: readonly CmuBlockInstance[];
  panelStart: number;
  panelEnd: number;
  ridge: number;
  capTop: (station: number) => number;
}): number[] {
  const stations = [params.panelStart, params.ridge, params.panelEnd];
  const topLevels = new Set<number>();

  for (const block of params.blocks) {
    const span = blockStationSpan(block);

    stations.push(
      clamp(span.startStationMeters, params.panelStart, params.panelEnd),
      clamp(span.endStationMeters, params.panelStart, params.panelEnd),
    );

    topLevels.add(blockTopY(block));
  }

  for (const topY of topLevels) {
    const left = findCrossing({
      from: params.panelStart,
      to: params.ridge,
      topY,
      capTop: params.capTop,
    });

    if (left !== null) {
      stations.push(left);
    }

    const right = findCrossing({
      from: params.ridge,
      to: params.panelEnd,
      topY,
      capTop: params.capTop,
    });

    if (right !== null) {
      stations.push(right);
    }
  }

  return dedupeSortedStations(stations);
}

function blocksOverlappingInterval(params: {
  blocks: readonly CmuBlockInstance[];
  startStationMeters: number;
  endStationMeters: number;
}): CmuBlockInstance[] {
  return params.blocks.filter((block) => {
    const span = blockStationSpan(block);

    return (
      span.startStationMeters <
        params.endStationMeters - CAP_SEAM_TOLERANCE_METERS &&
      span.endStationMeters >
        params.startStationMeters + CAP_SEAM_TOLERANCE_METERS
    );
  });
}

/**
 * Merge only coplanar neighbouring cap portions. Do not merge across a CMU step.
 */
function mergeCoplanar(
  placements: readonly RakedCapPlacement[],
): RakedCapPlacement[] {
  const sorted = [...placements].sort(
    (a, b) => a.startStationMeters - b.startStationMeters,
  );
  const result: RakedCapPlacement[] = [];

  for (const placement of sorted) {
    const previous = result[result.length - 1];

    if (!previous) {
      result.push({ ...placement });
      continue;
    }

    const contiguous =
      Math.abs(
        previous.endStationMeters - placement.startStationMeters,
      ) <= CAP_SEAM_TOLERANCE_METERS;

    const sameBottom =
      Math.abs(previous.startBottomY - placement.startBottomY) <=
        CAP_SEAM_TOLERANCE_METERS &&
      Math.abs(previous.endBottomY - placement.endBottomY) <=
        CAP_SEAM_TOLERANCE_METERS;

    const continuousTop =
      Math.abs(previous.endTopY - placement.startTopY) <=
      RIDGE_MEET_TOLERANCE_METERS;

    if (
      previous.slope === placement.slope &&
      contiguous &&
      sameBottom &&
      continuousTop
    ) {
      previous.endStationMeters = placement.endStationMeters;
      previous.endTopY = placement.endTopY;
      previous.endBottomY = placement.endBottomY;
      previous.concreteVolumeCubicMeters =
        segmentVolumeCubicMeters(previous);
    } else {
      result.push({ ...placement });
    }
  }

  return result;
}

function synchronizeRidge(params: {
  placements: RakedCapPlacement[];
  ridgeStationMeters: number;
  ridgeTopY: number;
}): void {
  const left = params.placements
    .filter((placement) => placement.slope === 'left')
    .sort((a, b) => b.endStationMeters - a.endStationMeters)[0];

  const right = params.placements
    .filter((placement) => placement.slope === 'right')
    .sort((a, b) => a.startStationMeters - b.startStationMeters)[0];

  if (
    left &&
    Math.abs(left.endStationMeters - params.ridgeStationMeters) <=
      RIDGE_MEET_TOLERANCE_METERS
  ) {
    left.endTopY = params.ridgeTopY;
    left.concreteVolumeCubicMeters = segmentVolumeCubicMeters(left);
  }

  if (
    right &&
    Math.abs(right.startStationMeters - params.ridgeStationMeters) <=
      RIDGE_MEET_TOLERANCE_METERS
  ) {
    right.startTopY = params.ridgeTopY;
    right.concreteVolumeCubicMeters = segmentVolumeCubicMeters(right);
  }
}

export function courseMasonryTopAtStation(params: {
  blocks: readonly CmuBlockInstance[];
  courseIndex: number;
  stationMeters: number;
}): number {
  let maxTop = -Infinity;

  for (const block of params.blocks) {
    if ((block.courseIndex ?? 0) !== params.courseIndex) {
      continue;
    }

    const span = blockStationSpan(block);

    if (
      params.stationMeters + CAP_SEAM_TOLERANCE_METERS <
        span.startStationMeters ||
      params.stationMeters - CAP_SEAM_TOLERANCE_METERS >
        span.endStationMeters
    ) {
      continue;
    }

    maxTop = Math.max(maxTop, blockTopY(block));
  }

  return maxTop;
}

/**
 * Returns -Infinity when no block covers the station. Do not fall back to the
 * tallest block elsewhere in the gable — that caused false angled cap bottoms.
 */
export function masonryTopEnvelopeYAtStation(params: {
  blocks: readonly CmuBlockInstance[];
  stationMeters: number;
}): number {
  let maxTop = -Infinity;

  for (const block of params.blocks) {
    const span = blockStationSpan(block);

    if (
      params.stationMeters + CAP_SEAM_TOLERANCE_METERS <
        span.startStationMeters ||
      params.stationMeters - CAP_SEAM_TOLERANCE_METERS >
        span.endStationMeters
    ) {
      continue;
    }

    maxTop = Math.max(maxTop, blockTopY(block));
  }

  return maxTop;
}

export function roofToCapClearanceAtStation(params: {
  capTopY: number;
  resolvedRoof: ResolvedRoofSystem;
  roofSystem?: RoofSystemSettings;
  frame: SegmentFrame;
  stationMeters: number;
  panelStartStation: number;
  panelEndStation: number;
}): number {
  const roofCapY = rakedCapTopYAtStation({
    resolvedRoof: params.resolvedRoof,
    roofSystem: params.roofSystem,
    frame: params.frame,
    stationMeters: params.stationMeters,
    panelStartStation: params.panelStartStation,
    panelEndStation: params.panelEndStation,
  });

  return roofCapY - params.capTopY;
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

  const blocks = finalGableBlocks(params.blocks);

  if (blocks.length === 0) {
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

  const ridgeStationMeters =
    (params.panelStartStation + params.panelEndStation) / 2;

  const roofCapTop = (stationMeters: number) =>
    capTopAtStation({
      resolvedRoof: params.resolvedRoof,
      roofSystem: params.roofSystem,
      frame: params.frame,
      stationMeters,
      panelStartStation: params.panelStartStation,
      panelEndStation: params.panelEndStation,
    });

  const breakpoints = collectBreakpoints({
    blocks,
    panelStart: params.panelStartStation,
    panelEnd: params.panelEndStation,
    ridge: ridgeStationMeters,
    capTop: roofCapTop,
  });

  const warnings: string[] = [];
  const rawCaps: RakedCapPlacement[] = [];

  for (let index = 0; index < breakpoints.length - 1; index += 1) {
    const startStationMeters = breakpoints[index]!;
    const endStationMeters = breakpoints[index + 1]!;
    const spanMeters = endStationMeters - startStationMeters;

    if (spanMeters < MIN_INTERVAL_SPAN_METERS) {
      continue;
    }

    const intervalBlocks = blocksOverlappingInterval({
      blocks,
      startStationMeters,
      endStationMeters,
    });

    if (intervalBlocks.length === 0) {
      continue;
    }

    /**
     * Critical correction:
     * A cap interval sits on one flat CMU step. It must not interpolate its
     * underside from one block elevation to another.
     */
    const flatBottomY =
      Math.max(...intervalBlocks.map(blockTopY)) -
      CAP_TO_CMU_CONTACT_OVERLAP_METERS;

    const startTopY = roofCapTop(startStationMeters);
    const endTopY = roofCapTop(endStationMeters);

    if (
      !isFiniteNumber(flatBottomY) ||
      !isFiniteNumber(startTopY) ||
      !isFiniteNumber(endTopY)
    ) {
      continue;
    }

    const hasPositiveVoid =
      startTopY > flatBottomY + GABLE_HEIGHT_TOLERANCE_METERS ||
      endTopY > flatBottomY + GABLE_HEIGHT_TOLERANCE_METERS;

    const nonInverted =
      startTopY >= flatBottomY - GABLE_HEIGHT_TOLERANCE_METERS &&
      endTopY >= flatBottomY - GABLE_HEIGHT_TOLERANCE_METERS;

    if (!hasPositiveVoid || !nonInverted) {
      continue;
    }

    const startDepth = startTopY - flatBottomY;
    const endDepth = endTopY - flatBottomY;

    if (
      startDepth <
        minRakeCapDepthMeters - GABLE_HEIGHT_TOLERANCE_METERS ||
      endDepth <
        minRakeCapDepthMeters - GABLE_HEIGHT_TOLERANCE_METERS
    ) {
      /**
       * Visual geometry must still be emitted to prevent cap coverage holes.
       * The warning remains for conceptual structural review.
       */
      warnings.push(
        `[Design review — visual fill only, not structurally compliant] ` +
          `Insufficient raked-cap depth at stations ` +
          `${startStationMeters.toFixed(3)}–${endStationMeters.toFixed(3)} m ` +
          `(actual ${Math.min(startDepth, endDepth).toFixed(3)} m, ` +
          `required ${minRakeCapDepthMeters.toFixed(3)} m).`,
      );
    }

    const slope: RakedCapPlacement['slope'] =
      (startStationMeters + endStationMeters) / 2 <= ridgeStationMeters
        ? 'left'
        : 'right';

    const concreteVolumeCubicMeters = segmentVolumeCubicMeters({
      startStationMeters,
      endStationMeters,
      startTopY,
      endTopY,
      startBottomY: flatBottomY,
      endBottomY: flatBottomY,
      wallDepthMeters: capWallDepthMeters,
    });

    if (concreteVolumeCubicMeters <= ROOF_CONTACT_EPSILON_METERS) {
      continue;
    }

    rawCaps.push({
      id: `${params.panelId}-rake-cap-${slope}-${index}`,
      gableEndSegmentId: params.gableEndSegmentId,
      slope,
      startStationMeters,
      endStationMeters,
      startBottomY: flatBottomY,
      endBottomY: flatBottomY,
      startTopY,
      endTopY,
      wallDepthMeters: capWallDepthMeters,
      concreteVolumeCubicMeters,
      source: 'gable_raked_concrete_cap',
    });
  }

  const leftCaps = mergeCoplanar(
    rawCaps.filter((cap) => cap.slope === 'left'),
  );

  const rightCaps = mergeCoplanar(
    rawCaps.filter((cap) => cap.slope === 'right'),
  );

  const placements = [...leftCaps, ...rightCaps].sort(
    (a, b) => a.startStationMeters - b.startStationMeters,
  );

  synchronizeRidge({
    placements,
    ridgeStationMeters,
    ridgeTopY: roofCapTop(ridgeStationMeters),
  });

  return {
    placements: placements.filter(
      (cap) =>
        cap.startTopY >
          cap.startBottomY + GABLE_HEIGHT_TOLERANCE_METERS &&
        cap.endTopY >
          cap.endBottomY + GABLE_HEIGHT_TOLERANCE_METERS &&
        cap.concreteVolumeCubicMeters > ROOF_CONTACT_EPSILON_METERS,
    ),
    warnings,
  };
}

export function totalRakedCapVolumeCubicMeters(
  caps: readonly RakedCapPlacement[],
): number {
  return caps.reduce(
    (sum, cap) => sum + cap.concreteVolumeCubicMeters,
    0,
  );
}

export function totalRakedCapLinearLengthMeters(
  caps: readonly RakedCapPlacement[],
): number {
  return caps.reduce(
    (sum, cap) =>
      sum + (cap.endStationMeters - cap.startStationMeters),
    0,
  );
}

export function minimumRakedCapDepthMeters(
  caps: readonly RakedCapPlacement[],
): number {
  if (caps.length === 0) {
    return 0;
  }

  return caps.reduce((minimumDepth, cap) => {
    const startDepth = cap.startTopY - cap.startBottomY;
    const endDepth = cap.endTopY - cap.endBottomY;

    return Math.min(minimumDepth, startDepth, endDepth);
  }, Number.POSITIVE_INFINITY);
}

export function totalGableCmuAreaSquareMeters(
  blocks: readonly CmuBlockInstance[],
): number {
  return blocks.reduce((sum, block) => {
    const height =
      block.physicalHeightMeters ?? block.heightMeters ?? 0;
    const length =
      block.actualLengthMeters ?? block.lengthMeters;

    return sum + length * height;
  }, 0);
}

export function minimumAllowedMasonryTopY(params: {
  resolvedRoof: ResolvedRoofSystem;
  frame: SegmentFrame;
  panelStartStation: number;
  panelEndStation: number;
  minRakeCapDepthMeters: number;
  roofSystem?: RoofSystemSettings;
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
