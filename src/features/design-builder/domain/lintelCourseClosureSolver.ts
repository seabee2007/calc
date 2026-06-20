import type { ResolvedCmuOpening } from './cmuOpeningRules';
import {
  pointOnSegmentFrame,
  resolveEffectiveLintelSpan,
  resolveLintelCourseIndex,
  type ResolvedLintelSpan,
  type SegmentFrameLike,
} from './openingAssemblySolver';
import type { CourseUnitSpan } from './openingCourseClosureSolver';

export const LINTEL_COURSE_RECONCILE_TOLERANCE_METERS = 0.002;
export const HALF_BLOCK_TOLERANCE_METERS = 0.005;
export const CUT_BLOCK_MINIMUM_WIDTH_METERS = 0.04;

export type LintelClosureBlockKind = 'full_block' | 'half_block' | 'cut_block';
export type LintelClosureAdjacentTo = 'lintel_start' | 'lintel_end';

export type LintelCourseClosurePlacement = {
  id: string;
  openingId: string;
  hostSegmentId: string;
  courseIndex: number;
  side: 'left' | 'right';
  kind: LintelClosureBlockKind;
  startAlongMeters: number;
  endAlongMeters: number;
  lengthMeters: number;
  heightMeters: number;
  depthMeters: number;
  center: { x: number; y: number; z: number };
  rotationY: number;
  source: 'lintel_closure';
  adjacentTo: LintelClosureAdjacentTo;
  cutWidthMeters: number;
};

export type LintelCourseAssembly = {
  openingId: string;
  hostSegmentId: string;
  courseIndex: number;
  wallRunStartMeters: number;
  wallRunEndMeters: number;
  lintelStartMeters: number;
  lintelEndMeters: number;
  leftMasonrySpan: { startMeters: number; endMeters: number };
  rightMasonrySpan: { startMeters: number; endMeters: number };
  lintelSpanMeters: number;
  coursePattern: CoursePatternContext;
  leftPlacements: LintelCourseClosurePlacement[];
  rightPlacements: LintelCourseClosurePlacement[];
  isFullyReconciled: boolean;
};

export type CoursePatternContext = {
  hostSegmentId: string;
  courseIndex: number;
  runningBondPhase: 'full_start' | 'half_start';
  nominalUnitIntervals: Array<{
    startStationMeters: number;
    endStationMeters: number;
    kind: 'stretcher' | 'half_block' | 'corner_block';
  }>;
};

export type IntervalLike = {
  startAlongMeters: number;
  endAlongMeters: number;
};

export type LintelAdjacentTrim = {
  startAlongMeters: number;
  endAlongMeters: number;
  lengthMeters: number;
  adjacentTo: LintelClosureAdjacentTo;
  courseUnitStartMeters: number;
  courseUnitEndMeters: number;
};

function overlapsAlongSpan(start: number, end: number, spanStart: number, spanEnd: number): boolean {
  return start < spanEnd - LINTEL_COURSE_RECONCILE_TOLERANCE_METERS
    && end > spanStart + LINTEL_COURSE_RECONCILE_TOLERANCE_METERS;
}

export function assertNoOverlappingIntervals(intervals: readonly IntervalLike[]): boolean {
  const sorted = [...intervals].sort((left, right) => left.startAlongMeters - right.startAlongMeters);
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index].startAlongMeters < sorted[index - 1].endAlongMeters - LINTEL_COURSE_RECONCILE_TOLERANCE_METERS) {
      return false;
    }
  }
  return true;
}

export function inferCourseUnitKind(
  startStationMeters: number,
  endStationMeters: number,
  moduleLengthMeters: number,
): CoursePatternContext['nominalUnitIntervals'][number]['kind'] {
  const lengthMeters = endStationMeters - startStationMeters;
  const halfModule = moduleLengthMeters / 2;
  if (Math.abs(lengthMeters - halfModule) <= HALF_BLOCK_TOLERANCE_METERS) return 'half_block';
  if (lengthMeters + HALF_BLOCK_TOLERANCE_METERS < moduleLengthMeters) return 'corner_block';
  return 'stretcher';
}

export function buildCoursePatternContext(params: {
  hostSegmentId: string;
  courseIndex: number;
  courseUnits: readonly CourseUnitSpan[];
  moduleLengthMeters: number;
  runningBond: boolean;
}): CoursePatternContext {
  return {
    hostSegmentId: params.hostSegmentId,
    courseIndex: params.courseIndex,
    runningBondPhase:
      params.runningBond && params.courseIndex % 2 === 1 ? 'half_start' : 'full_start',
    nominalUnitIntervals: params.courseUnits.map((unit) => ({
      startStationMeters: unit.startAlongMeters,
      endStationMeters: unit.endAlongMeters,
      kind: inferCourseUnitKind(unit.startAlongMeters, unit.endAlongMeters, params.moduleLengthMeters),
    })),
  };
}

export function classifyLintelClosureKind(
  lengthMeters: number,
  moduleLengthMeters: number,
): LintelClosureBlockKind {
  const halfModule = moduleLengthMeters / 2;
  if (Math.abs(lengthMeters - halfModule) <= HALF_BLOCK_TOLERANCE_METERS) return 'half_block';
  if (Math.abs(lengthMeters - moduleLengthMeters) <= HALF_BLOCK_TOLERANCE_METERS) return 'full_block';
  return 'cut_block';
}

export function resolveLintelAdjacentTrim(params: {
  unitStartMeters: number;
  unitEndMeters: number;
  lintelStartMeters: number;
  lintelEndMeters: number;
}): LintelAdjacentTrim[] {
  const { unitStartMeters, unitEndMeters, lintelStartMeters, lintelEndMeters } = params;
  if (!overlapsAlongSpan(unitStartMeters, unitEndMeters, lintelStartMeters, lintelEndMeters)) {
    return [];
  }
  if (
    unitStartMeters >= lintelStartMeters - LINTEL_COURSE_RECONCILE_TOLERANCE_METERS
    && unitEndMeters <= lintelEndMeters + LINTEL_COURSE_RECONCILE_TOLERANCE_METERS
  ) {
    return [];
  }

  const extendsPastLeft =
    unitStartMeters < lintelStartMeters - LINTEL_COURSE_RECONCILE_TOLERANCE_METERS
    && unitEndMeters > lintelStartMeters + LINTEL_COURSE_RECONCILE_TOLERANCE_METERS;
  const extendsPastRight =
    unitStartMeters < lintelEndMeters - LINTEL_COURSE_RECONCILE_TOLERANCE_METERS
    && unitEndMeters > lintelEndMeters + LINTEL_COURSE_RECONCILE_TOLERANCE_METERS;

  if (extendsPastLeft && extendsPastRight) {
    return [];
  }

  if (extendsPastLeft && unitEndMeters <= lintelEndMeters + LINTEL_COURSE_RECONCILE_TOLERANCE_METERS) {
    const lengthMeters = lintelStartMeters - unitStartMeters;
    if (lengthMeters + LINTEL_COURSE_RECONCILE_TOLERANCE_METERS < CUT_BLOCK_MINIMUM_WIDTH_METERS) return [];
    return [{
      startAlongMeters: unitStartMeters,
      endAlongMeters: lintelStartMeters,
      lengthMeters,
      adjacentTo: 'lintel_start',
      courseUnitStartMeters: unitStartMeters,
      courseUnitEndMeters: unitEndMeters,
    }];
  }

  if (extendsPastRight && unitStartMeters >= lintelStartMeters - LINTEL_COURSE_RECONCILE_TOLERANCE_METERS) {
    const lengthMeters = unitEndMeters - lintelEndMeters;
    if (lengthMeters + LINTEL_COURSE_RECONCILE_TOLERANCE_METERS < CUT_BLOCK_MINIMUM_WIDTH_METERS) return [];
    return [{
      startAlongMeters: lintelEndMeters,
      endAlongMeters: unitEndMeters,
      lengthMeters,
      adjacentTo: 'lintel_end',
      courseUnitStartMeters: unitStartMeters,
      courseUnitEndMeters: unitEndMeters,
    }];
  }

  return [];
}

export function cutCoursePatternAroundLintel(params: {
  pattern: CoursePatternContext;
  lintelStartMeters: number;
  lintelEndMeters: number;
  moduleLengthMeters: number;
}): {
  leftTrims: LintelAdjacentTrim[];
  rightTrims: LintelAdjacentTrim[];
} {
  const leftTrims: LintelAdjacentTrim[] = [];
  const rightTrims: LintelAdjacentTrim[] = [];

  params.pattern.nominalUnitIntervals.forEach((unit) => {
    const trims = resolveLintelAdjacentTrim({
      unitStartMeters: unit.startStationMeters,
      unitEndMeters: unit.endStationMeters,
      lintelStartMeters: params.lintelStartMeters,
      lintelEndMeters: params.lintelEndMeters,
    });
    trims.forEach((trim) => {
      if (trim.adjacentTo === 'lintel_start') leftTrims.push(trim);
      else rightTrims.push(trim);
    });
  });

  leftTrims.sort((left, right) => left.startAlongMeters - right.startAlongMeters);
  rightTrims.sort((left, right) => left.startAlongMeters - right.startAlongMeters);
  return { leftTrims, rightTrims };
}

function adjacentToSide(adjacentTo: LintelClosureAdjacentTo): 'left' | 'right' {
  return adjacentTo === 'lintel_start' ? 'left' : 'right';
}

function mapKindToBlockType(kind: LintelClosureBlockKind): 'full' | 'half' | 'cut' {
  if (kind === 'half_block') return 'half';
  if (kind === 'cut_block') return 'cut';
  return 'full';
}

export function buildLintelCourseClosurePlacement(params: {
  opening: ResolvedCmuOpening;
  hostSegmentId: string;
  frame: SegmentFrameLike;
  courseIndex: number;
  trim: LintelAdjacentTrim;
  kind: LintelClosureBlockKind;
  moduleHeightMeters: number;
  actualHeightMeters: number;
}): LintelCourseClosurePlacement {
  const side = adjacentToSide(params.trim.adjacentTo);
  const centerAlong = (params.trim.startAlongMeters + params.trim.endAlongMeters) / 2;
  const y = params.courseIndex * params.moduleHeightMeters + params.actualHeightMeters / 2;
  const point = pointOnSegmentFrame(params.frame, centerAlong, params.frame.wallThicknessMeters / 2);
  return {
    id: `lintel-closure-${params.opening.id}-${side}-course-${params.courseIndex}-${params.trim.startAlongMeters.toFixed(3)}`,
    openingId: params.opening.id,
    hostSegmentId: params.hostSegmentId,
    courseIndex: params.courseIndex,
    side,
    kind: params.kind,
    startAlongMeters: params.trim.startAlongMeters,
    endAlongMeters: params.trim.endAlongMeters,
    lengthMeters: params.trim.lengthMeters,
    heightMeters: params.actualHeightMeters,
    depthMeters: params.frame.wallThicknessMeters,
    center: { x: point.x, y, z: point.z },
    rotationY: params.frame.rotationY,
    source: 'lintel_closure',
    adjacentTo: params.trim.adjacentTo,
    cutWidthMeters: params.trim.lengthMeters,
  };
}

function masonrySpanFromTrims(
  trims: readonly LintelAdjacentTrim[],
  lintelEdgeMeters: number,
  side: 'left' | 'right',
): { startMeters: number; endMeters: number } {
  if (trims.length === 0) {
    return { startMeters: lintelEdgeMeters, endMeters: lintelEdgeMeters };
  }
  if (side === 'left') {
    return {
      startMeters: Math.min(...trims.map((trim) => trim.startAlongMeters)),
      endMeters: lintelEdgeMeters,
    };
  }
  return {
    startMeters: lintelEdgeMeters,
    endMeters: Math.max(...trims.map((trim) => trim.endAlongMeters)),
  };
}

export function deriveLintelGapClosuresFromPlacedBlocks(params: {
  placedBlocks: readonly CourseUnitSpan[];
  lintelStartMeters: number;
  lintelEndMeters: number;
  wallRunStartMeters: number;
  wallRunEndMeters: number;
}): { leftTrims: LintelAdjacentTrim[]; rightTrims: LintelAdjacentTrim[] } {
  const sorted = [...params.placedBlocks].sort(
    (left, right) => left.startAlongMeters - right.startAlongMeters,
  );
  const leftBlocks = sorted.filter(
    (block) => block.endAlongMeters <= params.lintelStartMeters + LINTEL_COURSE_RECONCILE_TOLERANCE_METERS,
  );
  const rightBlocks = sorted.filter(
    (block) => block.startAlongMeters >= params.lintelEndMeters - LINTEL_COURSE_RECONCILE_TOLERANCE_METERS,
  );
  const leftGapStart = leftBlocks.at(-1)?.endAlongMeters ?? params.wallRunStartMeters;
  const rightGapEnd = rightBlocks.at(0)?.startAlongMeters ?? params.wallRunEndMeters;
  const leftWidth = params.lintelStartMeters - leftGapStart;
  const rightWidth = rightGapEnd - params.lintelEndMeters;
  const leftTrims: LintelAdjacentTrim[] = [];
  const rightTrims: LintelAdjacentTrim[] = [];

  if (leftWidth + LINTEL_COURSE_RECONCILE_TOLERANCE_METERS >= CUT_BLOCK_MINIMUM_WIDTH_METERS) {
    leftTrims.push({
      startAlongMeters: leftGapStart,
      endAlongMeters: params.lintelStartMeters,
      lengthMeters: leftWidth,
      adjacentTo: 'lintel_start',
      courseUnitStartMeters: leftGapStart,
      courseUnitEndMeters: params.lintelStartMeters,
    });
  }
  if (rightWidth + LINTEL_COURSE_RECONCILE_TOLERANCE_METERS >= CUT_BLOCK_MINIMUM_WIDTH_METERS) {
    rightTrims.push({
      startAlongMeters: params.lintelEndMeters,
      endAlongMeters: rightGapEnd,
      lengthMeters: rightWidth,
      adjacentTo: 'lintel_end',
      courseUnitStartMeters: params.lintelEndMeters,
      courseUnitEndMeters: rightGapEnd,
    });
  }

  return { leftTrims, rightTrims };
}

export function buildLintelCourseAssembly(params: {
  opening: ResolvedCmuOpening;
  hostSegmentId: string;
  frame: SegmentFrameLike;
  moduleLengthMeters: number;
  moduleHeightMeters: number;
  actualHeightMeters: number;
  resolvedLintelSpans: ReadonlyMap<string, ResolvedLintelSpan>;
  courseUnits: readonly CourseUnitSpan[];
  placedCourseBlocks?: readonly CourseUnitSpan[];
  runningBond: boolean;
}): LintelCourseAssembly | null {
  if (params.opening.lintelType === 'none') return null;

  const lintelCourseIndex = resolveLintelCourseIndex(params.opening.roughTopMeters, params.moduleHeightMeters);
  const resolvedSpan = resolveEffectiveLintelSpan(
    params.opening,
    params.moduleLengthMeters,
    params.frame.lengthMeters,
    params.resolvedLintelSpans,
  );
  const lintelStartMeters = resolvedSpan.startAlongMeters;
  const lintelEndMeters = resolvedSpan.endAlongMeters;
  const wallRunStartMeters = 0;
  const wallRunEndMeters = params.frame.lengthMeters;

  const coursePattern = buildCoursePatternContext({
    hostSegmentId: params.hostSegmentId,
    courseIndex: lintelCourseIndex,
    courseUnits: params.courseUnits,
    moduleLengthMeters: params.moduleLengthMeters,
    runningBond: params.runningBond,
  });

  const { leftTrims: patternLeftTrims, rightTrims: patternRightTrims } = cutCoursePatternAroundLintel({
    pattern: coursePattern,
    lintelStartMeters,
    lintelEndMeters,
    moduleLengthMeters: params.moduleLengthMeters,
  });
  const { leftTrims, rightTrims } = params.placedCourseBlocks?.length
    ? deriveLintelGapClosuresFromPlacedBlocks({
        placedBlocks: params.placedCourseBlocks,
        lintelStartMeters,
        lintelEndMeters,
        wallRunStartMeters,
        wallRunEndMeters,
      })
    : { leftTrims: patternLeftTrims, rightTrims: patternRightTrims };

  const leftPlacements = leftTrims.map((trim) =>
    buildLintelCourseClosurePlacement({
      opening: params.opening,
      hostSegmentId: params.hostSegmentId,
      frame: params.frame,
      courseIndex: lintelCourseIndex,
      trim,
      kind: classifyLintelClosureKind(trim.lengthMeters, params.moduleLengthMeters),
      moduleHeightMeters: params.moduleHeightMeters,
      actualHeightMeters: params.actualHeightMeters,
    }),
  );
  const rightPlacements = rightTrims.map((trim) =>
    buildLintelCourseClosurePlacement({
      opening: params.opening,
      hostSegmentId: params.hostSegmentId,
      frame: params.frame,
      courseIndex: lintelCourseIndex,
      trim,
      kind: classifyLintelClosureKind(trim.lengthMeters, params.moduleLengthMeters),
      moduleHeightMeters: params.moduleHeightMeters,
      actualHeightMeters: params.actualHeightMeters,
    }),
  );

  const leftMasonrySpan = masonrySpanFromTrims(leftTrims, lintelStartMeters, 'left');
  const rightMasonrySpan = masonrySpanFromTrims(rightTrims, lintelEndMeters, 'right');
  const leftExpected = Math.max(0, leftMasonrySpan.endMeters - leftMasonrySpan.startMeters);
  const rightExpected = Math.max(0, rightMasonrySpan.endMeters - rightMasonrySpan.startMeters);
  const leftCovered = leftPlacements.reduce((sum, item) => sum + item.lengthMeters, 0);
  const rightCovered = rightPlacements.reduce((sum, item) => sum + item.lengthMeters, 0);
  const intervals = [
    ...leftPlacements,
    { startAlongMeters: lintelStartMeters, endAlongMeters: lintelEndMeters },
    ...rightPlacements,
  ];
  const isFullyReconciled =
    Math.abs(leftCovered - leftExpected) <= LINTEL_COURSE_RECONCILE_TOLERANCE_METERS &&
    Math.abs(rightCovered - rightExpected) <= LINTEL_COURSE_RECONCILE_TOLERANCE_METERS &&
    assertNoOverlappingIntervals(intervals);

  return {
    openingId: params.opening.id,
    hostSegmentId: params.hostSegmentId,
    courseIndex: lintelCourseIndex,
    wallRunStartMeters,
    wallRunEndMeters,
    lintelStartMeters,
    lintelEndMeters,
    leftMasonrySpan,
    rightMasonrySpan,
    lintelSpanMeters: lintelEndMeters - lintelStartMeters,
    coursePattern,
    leftPlacements,
    rightPlacements,
    isFullyReconciled,
  };
}

export function buildLayoutLintelCourseAssemblies(params: {
  openings: readonly ResolvedCmuOpening[];
  framesById: ReadonlyMap<string, SegmentFrameLike>;
  moduleLengthMeters: number;
  moduleHeightMeters: number;
  actualHeightMeters: number;
  resolvedLintelSpans: ReadonlyMap<string, ResolvedLintelSpan>;
  courseUnitsBySegmentCourse: ReadonlyMap<string, readonly CourseUnitSpan[]>;
  placedBlocksBySegmentCourse?: ReadonlyMap<string, readonly CourseUnitSpan[]>;
  openingsBySegmentId: (opening: ResolvedCmuOpening) => string | undefined;
  runningBond: boolean;
}): LintelCourseAssembly[] {
  const assemblies: LintelCourseAssembly[] = [];
  params.openings.forEach((opening) => {
    const hostSegmentId = params.openingsBySegmentId(opening) ?? '';
    const frame = params.framesById.get(hostSegmentId);
    if (!frame) return;
    const lintelCourseIndex = resolveLintelCourseIndex(opening.roughTopMeters, params.moduleHeightMeters);
    const courseUnits =
      params.courseUnitsBySegmentCourse.get(`${hostSegmentId}-${lintelCourseIndex}`) ?? [];
    const placedCourseBlocks =
      params.placedBlocksBySegmentCourse?.get(`${hostSegmentId}-${lintelCourseIndex}`) ?? [];
    const assembly = buildLintelCourseAssembly({
      opening,
      hostSegmentId,
      frame,
      moduleLengthMeters: params.moduleLengthMeters,
      moduleHeightMeters: params.moduleHeightMeters,
      actualHeightMeters: params.actualHeightMeters,
      resolvedLintelSpans: params.resolvedLintelSpans,
      courseUnits,
      placedCourseBlocks,
      runningBond: params.runningBond,
    });
    if (assembly) assemblies.push(assembly);
  });
  return assemblies;
}

export function lintelCourseClosureToBlockType(kind: LintelClosureBlockKind): 'full' | 'half' | 'cut' {
  return mapKindToBlockType(kind);
}

export function summarizeLintelCourseClosureSide(
  placements: readonly LintelCourseClosurePlacement[],
): string {
  if (placements.length === 0) return 'None';
  const cut = placements.find((placement) => placement.kind === 'cut_block');
  if (cut) return `1 cut CMU — ${cut.lengthMeters.toFixed(2)} m`;
  const halfCount = placements.filter((placement) => placement.kind === 'half_block').length;
  if (halfCount > 0) return halfCount === 1 ? 'Half CMU' : `${halfCount} half CMU`;
  const fullCount = placements.filter((placement) => placement.kind === 'full_block').length;
  return fullCount === 1 ? 'Full CMU' : `${fullCount} full CMU`;
}

export function lintelCourseAssemblyRequiresCutWarning(assembly: LintelCourseAssembly): boolean {
  return [...assembly.leftPlacements, ...assembly.rightPlacements].some(
    (placement) => placement.kind === 'cut_block',
  );
}

export function countLintelClosureCutBlocks(assemblies: readonly LintelCourseAssembly[]): number {
  return assemblies.reduce(
    (sum, assembly) =>
      sum +
      [...assembly.leftPlacements, ...assembly.rightPlacements].filter(
        (placement) => placement.kind === 'cut_block',
      ).length,
    0,
  );
}

export function collectLintelClosureCutBlockMetadata(
  assemblies: readonly LintelCourseAssembly[],
): Array<{
  source: 'lintel_closure';
  openingId: string;
  hostSegmentId: string;
  courseIndex: number;
  side: 'left' | 'right';
  adjacentTo: LintelClosureAdjacentTo;
  actualCutWidthMeters: number;
  quantityFormula: string;
  confidence: 'calculated_from_parameters';
}> {
  return assemblies.flatMap((assembly) =>
    [...assembly.leftPlacements, ...assembly.rightPlacements]
      .filter((placement) => placement.kind === 'cut_block')
      .map((placement) => ({
        source: 'lintel_closure' as const,
        openingId: placement.openingId,
        hostSegmentId: placement.hostSegmentId,
        courseIndex: placement.courseIndex,
        side: placement.side,
        adjacentTo: placement.adjacentTo,
        actualCutWidthMeters: placement.cutWidthMeters,
        quantityFormula: 'lintel_closure_cut_blocks = count(lintel_course cut_block placements)',
        confidence: 'calculated_from_parameters' as const,
      })),
  );
}

export function isLintelClosureGrout(placement: {
  source?: string;
  kind?: string;
}): boolean {
  return placement.source === 'lintel_closure' && placement.kind === 'grout_fill';
}
