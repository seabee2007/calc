import type { ResolvedCmuOpening } from './cmuOpeningRules';
import { resolveLintelCourseIndex, resolveOpeningUnitDisposition, type ResolvedLintelSpan } from './openingAssemblySolver';

export type OpeningClosureRole =
  | 'jamb_left'
  | 'jamb_right'
  | 'lintel_left_bearing'
  | 'lintel_right_bearing'
  | 'wall_end';

export type OpeningClosureBlockType = 'full' | 'half' | 'cut';

export type OpeningClosureClassification =
  | 'none'
  | 'shim_gap'
  | 'half_block'
  | 'jamb_block'
  | 'cut_block'
  | 'grout_fill';

export const MIN_OPENING_CLOSURE_LENGTH_METERS = 0.02;

export function moduleAlignTolerance(moduleLengthMeters: number): number {
  return Math.max(0.006, moduleLengthMeters * 0.025);
}

export function classifyClosureGapLength(
  residualGap: number,
  moduleLengthMeters: number,
  groutEnabled: boolean,
): OpeningClosureClassification {
  const tolerance = moduleAlignTolerance(moduleLengthMeters);
  const halfModule = moduleLengthMeters / 2;
  if (residualGap <= tolerance) return 'none';
  if (residualGap <= moduleLengthMeters * 0.08) return 'shim_gap';
  if (Math.abs(residualGap - halfModule) <= tolerance) return 'half_block';
  if (Math.abs(residualGap - moduleLengthMeters) <= tolerance) return 'jamb_block';
  if (groutEnabled && residualGap <= moduleLengthMeters * 0.35) return 'grout_fill';
  return 'cut_block';
}

export function closureClassificationToBlockType(
  classification: OpeningClosureClassification,
): OpeningClosureBlockType | null {
  switch (classification) {
    case 'half_block':
      return 'half';
    case 'jamb_block':
      return 'full';
    case 'cut_block':
      return 'cut';
    default:
      return null;
  }
}

export interface OpeningJambGap {
  openingId: string;
  courseIndex: number;
  courseBottom: number;
  courseTop: number;
  side: 'left' | 'right';
  gapStartMeters: number;
  gapEndMeters: number;
  gapLengthMeters: number;
  roughOpeningEdge: number;
  nearestBlockEdge: number;
  classification: OpeningClosureClassification;
}

export interface CourseUnitSpan {
  startAlongMeters: number;
  endAlongMeters: number;
}

export function computeOpeningJambGapsForCourse(params: {
  opening: ResolvedCmuOpening;
  courseIndex: number;
  courseBottomMeters: number;
  courseTopMeters: number;
  courseUnits: readonly CourseUnitSpan[];
  moduleLengthMeters: number;
  moduleHeightMeters: number;
  wallLengthMeters: number;
  groutEnabled: boolean;
  resolvedLintelSpans: ReadonlyMap<string, ResolvedLintelSpan>;
}): OpeningJambGap[] {
  if (params.courseBottomMeters >= params.opening.roughTopMeters || params.courseTopMeters <= params.opening.roughBottomMeters) {
    return [];
  }

  const keptUnits = params.courseUnits.flatMap((unit) => {
    const disposition = resolveOpeningUnitDisposition({
      opening: params.opening,
      startAlongMeters: unit.startAlongMeters,
      endAlongMeters: unit.endAlongMeters,
      courseIndex: params.courseIndex,
      courseBottomMeters: params.courseBottomMeters,
      courseTopMeters: params.courseTopMeters,
      moduleHeightMeters: params.moduleHeightMeters,
      moduleLengthMeters: params.moduleLengthMeters,
      wallLengthMeters: params.wallLengthMeters,
      resolvedLintelSpans: params.resolvedLintelSpans,
    });
    if (disposition.action === 'skip') {
      return [];
    }
    if (disposition.action === 'trim') {
      return [{
        startAlongMeters: disposition.startAlongMeters,
        endAlongMeters: disposition.endAlongMeters,
      }];
    }
    return [unit];
  });
  const leftUnit = keptUnits
    .filter((unit) => unit.endAlongMeters <= params.opening.roughStartAlongMeters)
    .sort((a, b) => b.endAlongMeters - a.endAlongMeters)[0];
  const rightUnit = keptUnits
    .filter((unit) => unit.startAlongMeters >= params.opening.roughEndAlongMeters)
    .sort((a, b) => a.startAlongMeters - b.startAlongMeters)[0];

  const gaps: OpeningJambGap[] = [];
  const leftStart = leftUnit?.endAlongMeters ?? 0;
  const leftEnd = params.opening.roughStartAlongMeters;
  const leftLength = Math.max(0, leftEnd - leftStart);
  if (leftLength >= MIN_OPENING_CLOSURE_LENGTH_METERS) {
    gaps.push({
      openingId: params.opening.id,
      courseIndex: params.courseIndex,
      courseBottom: params.courseBottomMeters,
      courseTop: params.courseTopMeters,
      side: 'left',
      gapStartMeters: leftStart,
      gapEndMeters: leftEnd,
      gapLengthMeters: leftLength,
      roughOpeningEdge: leftEnd,
      nearestBlockEdge: leftStart,
      classification: classifyClosureGapLength(leftLength, params.moduleLengthMeters, params.groutEnabled),
    });
  }

  const rightStart = params.opening.roughEndAlongMeters;
  const rightEnd = rightUnit?.startAlongMeters ?? params.wallLengthMeters;
  const rightLength = Math.max(0, rightEnd - rightStart);
  if (rightLength >= MIN_OPENING_CLOSURE_LENGTH_METERS) {
    gaps.push({
      openingId: params.opening.id,
      courseIndex: params.courseIndex,
      courseBottom: params.courseBottomMeters,
      courseTop: params.courseTopMeters,
      side: 'right',
      gapStartMeters: rightStart,
      gapEndMeters: rightEnd,
      gapLengthMeters: rightLength,
      roughOpeningEdge: rightStart,
      nearestBlockEdge: rightEnd,
      classification: classifyClosureGapLength(rightLength, params.moduleLengthMeters, params.groutEnabled),
    });
  }

  return gaps;
}

export function lintelBearingSupportCoversJambGap(params: {
  opening: ResolvedCmuOpening;
  courseIndex: number;
  side: 'left' | 'right';
  moduleHeightMeters: number;
  lintelSupportBlocks: readonly { openingId: string; courseIndex: number; side: 'left' | 'right' }[];
}): boolean {
  if (params.opening.lintelType === 'none') return false;
  const supportCourseIndex = resolveLintelCourseIndex(params.opening.roughTopMeters, params.moduleHeightMeters) - 1;
  if (params.courseIndex !== supportCourseIndex) return false;
  return params.lintelSupportBlocks.some(
    (block) =>
      block.openingId === params.opening.id &&
      block.courseIndex === params.courseIndex &&
      block.side === params.side,
  );
}

export function shouldPlaceJambClosureBlock(params: {
  gap: OpeningJambGap;
  opening: ResolvedCmuOpening;
  moduleHeightMeters: number;
  lintelSupportBlocks: readonly { openingId: string; courseIndex: number; side: 'left' | 'right' }[];
}): boolean {
  if (
    lintelBearingSupportCoversJambGap({
      opening: params.opening,
      courseIndex: params.gap.courseIndex,
      side: params.gap.side,
      moduleHeightMeters: params.moduleHeightMeters,
      lintelSupportBlocks: params.lintelSupportBlocks,
    })
  ) {
    return false;
  }
  return closureClassificationToBlockType(params.gap.classification) != null;
}

export function resolveClosureRole(side: 'left' | 'right', onLintelSupportCourse: boolean): OpeningClosureRole {
  if (onLintelSupportCourse) {
    return side === 'left' ? 'lintel_left_bearing' : 'lintel_right_bearing';
  }
  return side === 'left' ? 'jamb_left' : 'jamb_right';
}

export interface OpeningClosureBlockSpec {
  id: string;
  openingId: string;
  hostSegmentId: string;
  courseIndex: number;
  closureRole: OpeningClosureRole;
  blockType: OpeningClosureBlockType;
  startAlongMeters: number;
  endAlongMeters: number;
  lengthMeters: number;
  heightMeters: number;
  depthMeters: number;
  center: { x: number; y: number; z: number };
  rotationY: number;
  classification: OpeningClosureClassification;
}

export function buildOpeningClosureBlockFromGap(params: {
  gap: OpeningJambGap;
  hostSegmentId: string;
  closureRole: OpeningClosureRole;
  heightMeters: number;
  depthMeters: number;
  center: { x: number; y: number; z: number };
  rotationY: number;
}): OpeningClosureBlockSpec | null {
  const blockType = closureClassificationToBlockType(params.gap.classification);
  if (!blockType) return null;

  return {
    id: `opening-closure-${params.gap.openingId}-${params.closureRole}-course-${params.gap.courseIndex}`,
    openingId: params.gap.openingId,
    hostSegmentId: params.hostSegmentId,
    courseIndex: params.gap.courseIndex,
    closureRole: params.closureRole,
    blockType,
    startAlongMeters: params.gap.gapStartMeters,
    endAlongMeters: params.gap.gapEndMeters,
    lengthMeters: params.gap.gapLengthMeters,
    heightMeters: params.heightMeters,
    depthMeters: params.depthMeters,
    center: params.center,
    rotationY: params.rotationY,
    classification: params.gap.classification,
  };
}

export function openingJambGapToCourseClosure(params: {
  gap: OpeningJambGap;
  wallFace: NonNullable<ResolvedCmuOpening['wallFace']>;
  wallThickness: number;
  courseHeight: number;
  fillFactor: number;
  wasteMultiplier: number;
  opening: ResolvedCmuOpening;
}): {
  openingId: string;
  wallFace: NonNullable<ResolvedCmuOpening['wallFace']>;
  courseIndex: number;
  courseBottom: number;
  courseTop: number;
  side: 'left' | 'right';
  roughOpeningEdge: number;
  nearestBlockEdge: number;
  residualGap: number;
  closureType: OpeningClosureClassification;
  suggestedUnitType?: string;
  groutVolume?: number;
  warning?: string;
} {
  const closureType = params.gap.classification;
  const groutVolume =
    closureType === 'grout_fill'
      ? params.gap.gapLengthMeters * params.wallThickness * params.courseHeight * params.fillFactor * params.wasteMultiplier
      : 0;
  const warning =
    closureType === 'cut_block'
      ? `Opening ${params.opening.id} creates non-modular jamb cuts on course ${params.gap.courseIndex + 1}.`
      : closureType === 'grout_fill'
        ? `Opening ${params.opening.id} uses grout-fill closure on course ${params.gap.courseIndex + 1}.`
        : undefined;

  return {
    openingId: params.gap.openingId,
    wallFace: params.wallFace,
    courseIndex: params.gap.courseIndex,
    courseBottom: params.gap.courseBottom,
    courseTop: params.gap.courseTop,
    side: params.gap.side,
    roughOpeningEdge: params.gap.roughOpeningEdge,
    nearestBlockEdge: params.gap.nearestBlockEdge,
    residualGap: params.gap.gapLengthMeters,
    closureType,
    suggestedUnitType: suggestedUnitTypeForClosure(closureType),
    groutVolume,
    warning,
  };
}

function suggestedUnitTypeForClosure(closureType: OpeningClosureClassification): string | undefined {
  switch (closureType) {
    case 'half_block':
      return 'half block';
    case 'jamb_block':
      return 'jamb block';
    case 'cut_block':
      return 'cut block';
    case 'grout_fill':
      return 'grout/closure fill';
    case 'shim_gap':
      return 'shim/mortar pack';
    case 'none':
    default:
      return undefined;
  }
}
