import type { ResolvedCmuOpening } from './cmuOpeningRules';
import type { CmuWallSystemParameters, WallOpeningParameters } from '../types';
import { resolveCmuModuleConfig } from './cmuModuleRules';
import {
  applyGroutWaste,
  computeCellCoreVolumeCubicMeters,
  resolveCmuCoreGeometry,
  type CmuCoreGeometry,
} from './cmuCoreGeometry';

export type LintelSolidKind = 'bond_beam_lintel' | 'precast_lintel' | 'steel_lintel';

export type GroutFillKind =
  | 'jamb_cell'
  | 'lintel_cell'
  | 'bond_beam_cell'
  | 'sill_cell'
  | 'reinforced_cell'
  | 'closure_void';

export interface LintelSolidPlacement {
  id: string;
  openingId: string;
  hostSegmentId: string;
  courseIndex: number;
  center: { x: number; y: number; z: number };
  rotationY: number;
  lengthMeters: number;
  heightMeters: number;
  depthMeters: number;
  bearingLeftMeters: number;
  bearingRightMeters: number;
  kind: LintelSolidKind;
  source: 'opening_assembly_solver';
  startAlongMeters: number;
  endAlongMeters: number;
  extendedLeft: boolean;
  extendedRight: boolean;
}

export interface GroutFillPlacement {
  id: string;
  openingId?: string;
  hostSegmentId: string;
  kind: GroutFillKind;
  courseIndex: number;
  center: { x: number; y: number; z: number };
  rotationY: number;
  lengthMeters: number;
  heightMeters: number;
  depthMeters: number;
  grossVolumeCubicMeters: number;
  wastePercent: number;
  netVolumeCubicMeters: number;
  source: 'opening_assembly_solver';
}

export type SegmentFrameLike = {
  segmentId: string;
  start: { x: number; z: number };
  tangent: { x: number; z: number };
  inwardNormal: { x: number; z: number };
  rotationY: number;
  lengthMeters: number;
  wallThicknessMeters: number;
};

export type LegacyWallFacePlacement = {
  face: NonNullable<WallOpeningParameters['wallFace']>;
  wallLength: number;
  wallThickness: number;
  rotationY: number;
  position: (alongMeters: number, y: number) => { x: number; y: number; z: number };
};

export function resolveLintelCourseIndex(roughTopMeters: number, moduleHeightMeters: number): number {
  return Math.max(0, Math.ceil(roughTopMeters / Math.max(0.01, moduleHeightMeters)));
}

type OpeningCourseGridOptions = {
  courseIndexElevationDatumMeters?: number;
  courseIndexOffset?: number;
};

function resolveLintelCourseIndexForGrid(
  roughTopMeters: number,
  moduleHeightMeters: number,
  options?: OpeningCourseGridOptions,
): number {
  const datum = options?.courseIndexElevationDatumMeters ?? 0;
  const offset = options?.courseIndexOffset ?? 0;
  return resolveLintelCourseIndex(roughTopMeters - datum, moduleHeightMeters) + offset;
}

export function resolveOpeningBlockVoidBounds(opening: ResolvedCmuOpening): {
  startAlongMeters: number;
  endAlongMeters: number;
  bottomMeters: number;
  topMeters: number;
} {
  return {
    startAlongMeters: opening.roughStartAlongMeters,
    endAlongMeters: opening.roughEndAlongMeters,
    bottomMeters: opening.actualBottomMeters,
    topMeters: opening.actualTopMeters,
  };
}

export function resolveLintelAlongSpan(opening: ResolvedCmuOpening): {
  startAlongMeters: number;
  endAlongMeters: number;
  centerAlongMeters: number;
} {
  const centerAlongMeters = (opening.actualStartAlongMeters + opening.actualEndAlongMeters) / 2;
  const halfLength = opening.lintelLengthMeters / 2;
  return {
    startAlongMeters: Math.max(0, centerAlongMeters - halfLength),
    endAlongMeters: centerAlongMeters + halfLength,
    centerAlongMeters,
  };
}

const MIN_SUPPORT_BLOCK_LENGTH_METERS = 0.02;

export type OpeningSupportBlockType = 'full' | 'half' | 'cut' | 'jamb' | 'bond_beam';

export interface ResolvedLintelSpan {
  requestedStartAlongMeters: number;
  requestedEndAlongMeters: number;
  startAlongMeters: number;
  endAlongMeters: number;
  centerAlongMeters: number;
  actualLengthMeters: number;
  extendedLeft: boolean;
  extendedRight: boolean;
}

export type OpeningSupportClosureRole = 'lintel_left_bearing' | 'lintel_right_bearing';

export interface OpeningSupportBlockPlacement {
  id: string;
  openingId: string;
  hostSegmentId: string;
  courseIndex: number;
  side: 'left' | 'right';
  closureRole: OpeningSupportClosureRole;
  blockType: 'half_block' | 'cut_block';
  center: { x: number; y: number; z: number };
  rotationY: number;
  lengthMeters: number;
  heightMeters: number;
  depthMeters: number;
  startAlongMeters: number;
  endAlongMeters: number;
  source: 'opening_assembly_solver';
}

export type DerivedOpeningGroutRole = 'left_jamb' | 'right_jamb' | 'lintel' | 'closure';

export interface DerivedOpeningSupport {
  openingId: string;
  lintel: {
    start: number;
    end: number;
    actualLength: number;
    extendedToModule: boolean;
  };
  supportBlocks: Array<{
    type: OpeningSupportBlockType;
    position: { x: number; y: number; z: number };
    size: { length: number; height: number; depth: number };
  }>;
  groutCells: Array<{
    role: DerivedOpeningGroutRole;
    position: { x: number; y: number; z: number };
    size: { length: number; height: number; depth: number };
    volume: number;
  }>;
}

export function moduleAlignTolerance(moduleLengthMeters: number): number {
  return Math.max(0.006, moduleLengthMeters * 0.025);
}

export function isAlongModuleBoundary(alongMeters: number, moduleLengthMeters: number): boolean {
  const tolerance = moduleAlignTolerance(moduleLengthMeters);
  const offset = ((alongMeters % moduleLengthMeters) + moduleLengthMeters) % moduleLengthMeters;
  return offset <= tolerance || offset >= moduleLengthMeters - tolerance;
}

export function classifySupportBlockLength(
  lengthMeters: number,
  moduleLengthMeters: number,
): 'half_block' | 'cut_block' {
  const tolerance = moduleAlignTolerance(moduleLengthMeters);
  if (Math.abs(lengthMeters - moduleLengthMeters / 2) <= tolerance) return 'half_block';
  return 'cut_block';
}

export function resolveLintelModuleSpan(
  opening: ResolvedCmuOpening,
  moduleLengthMeters: number,
  wallLengthMeters: number,
): ResolvedLintelSpan {
  const requested = resolveLintelAlongSpan(opening);
  let startAlongMeters = requested.startAlongMeters;
  let endAlongMeters = requested.endAlongMeters;
  let extendedLeft = false;
  let extendedRight = false;

  if (opening.lintelType !== 'none' && moduleLengthMeters > 0) {
    if (!isAlongModuleBoundary(startAlongMeters, moduleLengthMeters)) {
      const moduleFloor = Math.floor(startAlongMeters / moduleLengthMeters) * moduleLengthMeters;
      const residual = startAlongMeters - moduleFloor;
      const supportViable =
        residual >= MIN_SUPPORT_BLOCK_LENGTH_METERS && moduleFloor >= 0 && moduleFloor < startAlongMeters;
      if (!supportViable && moduleFloor < startAlongMeters) {
        startAlongMeters = Math.max(0, moduleFloor);
        extendedLeft = startAlongMeters < requested.startAlongMeters;
      }
    }

    if (!isAlongModuleBoundary(endAlongMeters, moduleLengthMeters)) {
      const moduleCeil = Math.ceil(endAlongMeters / moduleLengthMeters) * moduleLengthMeters;
      const residual = moduleCeil - endAlongMeters;
      const supportViable =
        residual >= MIN_SUPPORT_BLOCK_LENGTH_METERS &&
        moduleCeil <= wallLengthMeters &&
        moduleCeil > endAlongMeters;
      if (!supportViable && moduleCeil > endAlongMeters) {
        endAlongMeters = Math.min(wallLengthMeters, moduleCeil);
        extendedRight = endAlongMeters > requested.endAlongMeters;
      }
    }
  }

  return {
    requestedStartAlongMeters: requested.startAlongMeters,
    requestedEndAlongMeters: requested.endAlongMeters,
    startAlongMeters,
    endAlongMeters,
    centerAlongMeters: (startAlongMeters + endAlongMeters) / 2,
    actualLengthMeters: Math.max(0, endAlongMeters - startAlongMeters),
    extendedLeft,
    extendedRight,
  };
}

export function resolveEffectiveLintelSpan(
  opening: ResolvedCmuOpening,
  moduleLengthMeters: number,
  wallLengthMeters: number,
  resolvedSpans?: ReadonlyMap<string, ResolvedLintelSpan>,
): ResolvedLintelSpan {
  const cached = resolvedSpans?.get(opening.id);
  if (cached) return cached;
  return resolveLintelModuleSpan(opening, moduleLengthMeters, wallLengthMeters);
}

function mapGroutKindToRole(kind: GroutFillKind, fillId: string): DerivedOpeningGroutRole {
  if (kind === 'lintel_cell' || kind === 'bond_beam_cell') return 'lintel';
  if (kind === 'sill_cell') return 'closure';
  if (kind === 'jamb_cell') {
    if (fillId.includes('-left-')) return 'left_jamb';
    if (fillId.includes('-right-')) return 'right_jamb';
  }
  return 'closure';
}

export function buildDerivedOpeningSupports(params: {
  openings: readonly ResolvedCmuOpening[];
  resolvedSpans: ReadonlyMap<string, ResolvedLintelSpan>;
  supportBlocks: readonly OpeningSupportBlockPlacement[];
  groutPlacements: readonly GroutFillPlacement[];
}): DerivedOpeningSupport[] {
  return params.openings.map((opening) => {
    const span =
      params.resolvedSpans.get(opening.id) ??
      resolveLintelModuleSpan(opening, 0.4, opening.roughEndAlongMeters);
    const openingSupports = params.supportBlocks.filter((block) => block.openingId === opening.id);
    const openingGrout = params.groutPlacements.filter((fill) => fill.openingId === opening.id);
    return {
      openingId: opening.id,
      lintel: {
        start: span.startAlongMeters,
        end: span.endAlongMeters,
        actualLength: span.actualLengthMeters,
        extendedToModule: span.extendedLeft || span.extendedRight,
      },
      supportBlocks: openingSupports.map((block) => ({
        type: block.blockType === 'half_block' ? 'half' : 'cut',
        position: block.center,
        size: {
          length: block.lengthMeters,
          height: block.heightMeters,
          depth: block.depthMeters,
        },
      })),
      groutCells: openingGrout.map((fill) => ({
        role: mapGroutKindToRole(fill.kind, fill.id),
        position: fill.center,
        size: {
          length: fill.lengthMeters,
          height: fill.heightMeters,
          depth: fill.depthMeters,
        },
        volume: fill.netVolumeCubicMeters,
      })),
    };
  });
}

export type OpeningUnitDisposition =
  | { action: 'place' }
  | { action: 'skip'; reason: 'rough' | 'lintel' }
  | {
      action: 'trim';
      startAlongMeters: number;
      endAlongMeters: number;
      lengthMeters: number;
      side: 'left' | 'right';
      reason: 'rough' | 'lintel';
    };

export type OpeningUnitSplitSegment = {
  startAlongMeters: number;
  endAlongMeters: number;
  lengthMeters: number;
  source: 'wall_run' | 'opening_jamb_closure';
  adjacentTo?: 'rough_opening_start' | 'rough_opening_end';
  openingId?: string;
};

const DEFAULT_OPENING_JAMB_MIN_CUT_LENGTH_METERS = 0.02;

function overlapsAlongSpan(start: number, end: number, spanStart: number, spanEnd: number): boolean {
  return start < spanEnd && end > spanStart;
}

function resolveHorizontalOpeningDisposition(params: {
  startAlongMeters: number;
  endAlongMeters: number;
  spanStart: number;
  spanEnd: number;
  minimumCutLengthMeters: number;
  reason: 'rough' | 'lintel';
}): OpeningUnitDisposition {
  const { startAlongMeters, endAlongMeters, spanStart, spanEnd, minimumCutLengthMeters, reason } = params;
  if (!overlapsAlongSpan(startAlongMeters, endAlongMeters, spanStart, spanEnd)) {
    return { action: 'place' };
  }
  if (startAlongMeters >= spanStart && endAlongMeters <= spanEnd) {
    return { action: 'skip', reason };
  }

  const extendsPastLeft = startAlongMeters < spanStart && endAlongMeters > spanStart;
  const extendsPastRight = startAlongMeters < spanEnd && endAlongMeters > spanEnd;
  if (extendsPastLeft && extendsPastRight) {
    const leftLengthMeters = spanStart - startAlongMeters;
    const rightLengthMeters = endAlongMeters - spanEnd;
    if (leftLengthMeters >= minimumCutLengthMeters && rightLengthMeters >= minimumCutLengthMeters) {
      return { action: 'skip', reason };
    }
    if (leftLengthMeters >= minimumCutLengthMeters) {
      return {
        action: 'trim',
        startAlongMeters,
        endAlongMeters: spanStart,
        lengthMeters: leftLengthMeters,
        side: 'left',
        reason,
      };
    }
    if (rightLengthMeters >= minimumCutLengthMeters) {
      return {
        action: 'trim',
        startAlongMeters: spanEnd,
        endAlongMeters,
        lengthMeters: rightLengthMeters,
        side: 'right',
        reason,
      };
    }
    return { action: 'skip', reason };
  }
  if (extendsPastLeft && endAlongMeters <= spanEnd) {
    const lengthMeters = spanStart - startAlongMeters;
    if (lengthMeters >= minimumCutLengthMeters) {
      return {
        action: 'trim',
        startAlongMeters,
        endAlongMeters: spanStart,
        lengthMeters,
        side: 'left',
        reason,
      };
    }
    return { action: 'skip', reason };
  }
  if (extendsPastRight && startAlongMeters >= spanStart) {
    const lengthMeters = endAlongMeters - spanEnd;
    if (lengthMeters >= minimumCutLengthMeters) {
      return {
        action: 'trim',
        startAlongMeters: spanEnd,
        endAlongMeters,
        lengthMeters,
        side: 'right',
        reason,
      };
    }
    return { action: 'skip', reason };
  }
  return { action: 'skip', reason };
}

function resolveHorizontalOpeningSplits(params: {
  startAlongMeters: number;
  endAlongMeters: number;
  spanStart: number;
  spanEnd: number;
  minimumCutLengthMeters: number;
  openingId?: string;
}): OpeningUnitSplitSegment[] | 'outside' | 'inside' {
  const { startAlongMeters, endAlongMeters, spanStart, spanEnd, minimumCutLengthMeters } = params;
  if (!overlapsAlongSpan(startAlongMeters, endAlongMeters, spanStart, spanEnd)) {
    return 'outside';
  }
  if (startAlongMeters >= spanStart && endAlongMeters <= spanEnd) {
    return 'inside';
  }

  const segments: OpeningUnitSplitSegment[] = [];
  if (startAlongMeters < spanStart && endAlongMeters > spanStart) {
    const lengthMeters = spanStart - startAlongMeters;
    if (lengthMeters >= minimumCutLengthMeters) {
      segments.push({
        startAlongMeters,
        endAlongMeters: spanStart,
        lengthMeters,
        source: 'opening_jamb_closure',
        adjacentTo: 'rough_opening_start',
        openingId: params.openingId,
      });
    }
  }
  if (endAlongMeters > spanEnd && startAlongMeters < spanEnd) {
    const lengthMeters = endAlongMeters - spanEnd;
    if (lengthMeters >= minimumCutLengthMeters) {
      segments.push({
        startAlongMeters: spanEnd,
        endAlongMeters,
        lengthMeters,
        source: 'opening_jamb_closure',
        adjacentTo: 'rough_opening_end',
        openingId: params.openingId,
      });
    }
  }
  return segments;
}

export function resolveOpeningUnitSplits(params: {
  opening: ResolvedCmuOpening;
  startAlongMeters: number;
  endAlongMeters: number;
  courseIndex: number;
  courseBottomMeters: number;
  courseTopMeters: number;
  moduleHeightMeters: number;
  moduleLengthMeters?: number;
  wallLengthMeters?: number;
  resolvedLintelSpans?: ReadonlyMap<string, ResolvedLintelSpan>;
  minimumCutLengthMeters?: number;
  inheritedSource?: OpeningUnitSplitSegment['source'];
  inheritedAdjacentTo?: OpeningUnitSplitSegment['adjacentTo'];
  inheritedOpeningId?: string;
  courseIndexElevationDatumMeters?: number;
  courseIndexOffset?: number;
}): OpeningUnitSplitSegment[] {
  const minimumCutLengthMeters = params.minimumCutLengthMeters ?? DEFAULT_OPENING_JAMB_MIN_CUT_LENGTH_METERS;
  const unitLengthMeters = params.endAlongMeters - params.startAlongMeters;
  if (unitLengthMeters <= 0) return [];

  if (params.opening.lintelType !== 'none') {
    const lintelCourseIndex = resolveLintelCourseIndexForGrid(
      params.opening.roughTopMeters,
      params.moduleHeightMeters,
      params,
    );
    if (params.courseIndex === lintelCourseIndex) {
      const lintelSpan =
        params.moduleLengthMeters && params.wallLengthMeters
          ? resolveEffectiveLintelSpan(
              params.opening,
              params.moduleLengthMeters,
              params.wallLengthMeters,
              params.resolvedLintelSpans,
            )
          : resolveLintelAlongSpan(params.opening);
      const lintelDisposition = resolveHorizontalOpeningDisposition({
        startAlongMeters: params.startAlongMeters,
        endAlongMeters: params.endAlongMeters,
        spanStart: lintelSpan.startAlongMeters,
        spanEnd: lintelSpan.endAlongMeters,
        minimumCutLengthMeters,
        reason: 'lintel',
      });
      if (lintelDisposition.action !== 'place') {
        return [];
      }
    }
  }

  const voidBounds = resolveOpeningBlockVoidBounds(params.opening);
  const inOpeningVertical =
    params.courseBottomMeters < voidBounds.topMeters &&
    params.courseTopMeters > voidBounds.bottomMeters;
  const passthroughSegment = (): OpeningUnitSplitSegment => ({
    startAlongMeters: params.startAlongMeters,
    endAlongMeters: params.endAlongMeters,
    lengthMeters: unitLengthMeters,
    source: params.inheritedSource ?? 'wall_run',
    adjacentTo: params.inheritedAdjacentTo,
    openingId: params.inheritedOpeningId,
  });

  if (!inOpeningVertical) {
    return [passthroughSegment()];
  }

  const voidSplits = resolveHorizontalOpeningSplits({
    startAlongMeters: params.startAlongMeters,
    endAlongMeters: params.endAlongMeters,
    spanStart: voidBounds.startAlongMeters,
    spanEnd: voidBounds.endAlongMeters,
    minimumCutLengthMeters,
    openingId: params.opening.id,
  });
  if (voidSplits === 'outside') {
    return [passthroughSegment()];
  }
  if (voidSplits === 'inside') {
    return [];
  }
  return voidSplits;
}

export function resolveUnitSegmentsAroundOpenings(params: {
  startAlongMeters: number;
  endAlongMeters: number;
  openings: readonly ResolvedCmuOpening[];
  courseIndex: number;
  courseBottomMeters: number;
  courseTopMeters: number;
  moduleHeightMeters: number;
  moduleLengthMeters?: number;
  wallLengthMeters?: number;
  resolvedLintelSpans?: ReadonlyMap<string, ResolvedLintelSpan>;
  minimumCutLengthMeters?: number;
  courseIndexElevationDatumMeters?: number;
  courseIndexOffset?: number;
}): OpeningUnitSplitSegment[] {
  let segments: OpeningUnitSplitSegment[] = [{
    startAlongMeters: params.startAlongMeters,
    endAlongMeters: params.endAlongMeters,
    lengthMeters: params.endAlongMeters - params.startAlongMeters,
    source: 'wall_run',
  }];
  params.openings.forEach((opening) => {
    segments = segments.flatMap((segment) =>
      resolveOpeningUnitSplits({
        opening,
        startAlongMeters: segment.startAlongMeters,
        endAlongMeters: segment.endAlongMeters,
        courseIndex: params.courseIndex,
        courseBottomMeters: params.courseBottomMeters,
        courseTopMeters: params.courseTopMeters,
        moduleHeightMeters: params.moduleHeightMeters,
        moduleLengthMeters: params.moduleLengthMeters,
        wallLengthMeters: params.wallLengthMeters,
        resolvedLintelSpans: params.resolvedLintelSpans,
        minimumCutLengthMeters: params.minimumCutLengthMeters,
        inheritedSource: segment.source,
        inheritedAdjacentTo: segment.adjacentTo,
        inheritedOpeningId: segment.openingId,
        courseIndexElevationDatumMeters: params.courseIndexElevationDatumMeters,
        courseIndexOffset: params.courseIndexOffset,
      }),
    );
  });
  return segments;
}

export function resolveOpeningUnitDisposition(params: {
  opening: ResolvedCmuOpening;
  startAlongMeters: number;
  endAlongMeters: number;
  courseIndex: number;
  courseBottomMeters: number;
  courseTopMeters: number;
  moduleHeightMeters: number;
  moduleLengthMeters?: number;
  wallLengthMeters?: number;
  resolvedLintelSpans?: ReadonlyMap<string, ResolvedLintelSpan>;
  minimumCutLengthMeters?: number;
  courseIndexElevationDatumMeters?: number;
  courseIndexOffset?: number;
}): OpeningUnitDisposition {
  const minimumCutLengthMeters = params.minimumCutLengthMeters ?? DEFAULT_OPENING_JAMB_MIN_CUT_LENGTH_METERS;
  if (params.opening.lintelType !== 'none') {
    const lintelCourseIndex = resolveLintelCourseIndexForGrid(
      params.opening.roughTopMeters,
      params.moduleHeightMeters,
      params,
    );
    if (params.courseIndex === lintelCourseIndex) {
      const lintelSpan =
        params.moduleLengthMeters && params.wallLengthMeters
          ? resolveEffectiveLintelSpan(
              params.opening,
              params.moduleLengthMeters,
              params.wallLengthMeters,
              params.resolvedLintelSpans,
            )
          : resolveLintelAlongSpan(params.opening);
      const lintelDisposition = resolveHorizontalOpeningDisposition({
        startAlongMeters: params.startAlongMeters,
        endAlongMeters: params.endAlongMeters,
        spanStart: lintelSpan.startAlongMeters,
        spanEnd: lintelSpan.endAlongMeters,
        minimumCutLengthMeters,
        reason: 'lintel',
      });
      if (lintelDisposition.action === 'trim') {
        return { action: 'skip', reason: 'lintel' };
      }
      if (lintelDisposition.action === 'skip') {
        return lintelDisposition;
      }
    }
  }

  const voidBounds = resolveOpeningBlockVoidBounds(params.opening);
  const inOpeningVertical =
    params.courseBottomMeters < voidBounds.topMeters &&
    params.courseTopMeters > voidBounds.bottomMeters;
  if (inOpeningVertical) {
    const voidDisposition = resolveHorizontalOpeningDisposition({
      startAlongMeters: params.startAlongMeters,
      endAlongMeters: params.endAlongMeters,
      spanStart: voidBounds.startAlongMeters,
      spanEnd: voidBounds.endAlongMeters,
      minimumCutLengthMeters,
      reason: 'rough',
    });
    if (voidDisposition.action !== 'place') {
      return voidDisposition;
    }
  }

  return { action: 'place' };
}

export function blockOverlapsOpeningAssembly(params: {
  opening: ResolvedCmuOpening;
  startAlongMeters: number;
  endAlongMeters: number;
  courseIndex: number;
  courseBottomMeters: number;
  courseTopMeters: number;
  moduleHeightMeters: number;
  moduleLengthMeters?: number;
  wallLengthMeters?: number;
  resolvedLintelSpans?: ReadonlyMap<string, ResolvedLintelSpan>;
  courseIndexElevationDatumMeters?: number;
  courseIndexOffset?: number;
}): boolean {
  const voidBounds = resolveOpeningBlockVoidBounds(params.opening);
  const overlapsAlong = (start: number, end: number, oStart: number, oEnd: number) => start < oEnd && end > oStart;
  const inVoidHorizontal = overlapsAlong(
    params.startAlongMeters,
    params.endAlongMeters,
    voidBounds.startAlongMeters,
    voidBounds.endAlongMeters,
  );
  const inVoidVertical =
    params.courseBottomMeters < voidBounds.topMeters &&
    params.courseTopMeters > voidBounds.bottomMeters;
  if (inVoidHorizontal && inVoidVertical) return true;

  if (params.opening.lintelType === 'none') return false;
  const lintelCourseIndex = resolveLintelCourseIndexForGrid(
    params.opening.roughTopMeters,
    params.moduleHeightMeters,
    params,
  );
  if (params.courseIndex !== lintelCourseIndex) return false;
  const lintelSpan =
    params.moduleLengthMeters && params.wallLengthMeters
      ? resolveEffectiveLintelSpan(
          params.opening,
          params.moduleLengthMeters,
          params.wallLengthMeters,
          params.resolvedLintelSpans,
        )
      : resolveLintelAlongSpan(params.opening);
  return overlapsAlong(
    params.startAlongMeters,
    params.endAlongMeters,
    lintelSpan.startAlongMeters,
    lintelSpan.endAlongMeters,
  );
}

export function mapLintelKind(lintelType: ResolvedCmuOpening['lintelType']): LintelSolidKind {
  switch (lintelType) {
    case 'precast_concrete':
      return 'precast_lintel';
    case 'steel_placeholder':
      return 'steel_lintel';
    case 'bond_beam':
    default:
      return 'bond_beam_lintel';
  }
}

export function buildLegacyLintelSolidPlacements(
  params: CmuWallSystemParameters,
  openings: readonly ResolvedCmuOpening[],
  resolvedSpans?: ReadonlyMap<string, ResolvedLintelSpan>,
): LintelSolidPlacement[] {
  const moduleConfig = resolveCmuModuleConfig(params);
  const moduleLength = moduleConfig.moduleLengthMeters;
  const moduleHeight = moduleConfig.moduleHeightMeters;
  const actualHeight = moduleConfig.actualHeightMeters ?? Math.max(0.01, moduleHeight - moduleConfig.mortarJointMeters);
  const wallThickness = Math.max(0, params.wallThicknessMeters);
  const wallInset = wallThickness / 2;

  return openings
    .filter((opening) => opening.lintelType !== 'none')
    .map((opening) => {
      const wallFace = opening.wallFace ?? 'north';
      const wallLength = wallFace === 'north' || wallFace === 'south' ? params.lengthMeters : params.widthMeters;
      const lintelCourseIndex = resolveLintelCourseIndex(opening.roughTopMeters, moduleHeight);
      const lintelSpan = resolveEffectiveLintelSpan(opening, moduleLength, wallLength, resolvedSpans);
      const centeredAlong = lintelSpan.centerAlongMeters - wallLength / 2;
      const rotationY = wallFace === 'east' || wallFace === 'west' ? Math.PI / 2 : 0;
      const x =
        wallFace === 'east'
          ? params.lengthMeters / 2 - wallInset
          : wallFace === 'west'
            ? -params.lengthMeters / 2 + wallInset
            : centeredAlong;
      const z =
        wallFace === 'north'
          ? -params.widthMeters / 2 + wallInset
          : wallFace === 'south'
            ? params.widthMeters / 2 - wallInset
            : centeredAlong;
      return {
        id: `lintel-${opening.id}`,
        openingId: opening.id,
        hostSegmentId: wallFace,
        courseIndex: lintelCourseIndex,
        center: {
          x,
          y: lintelCourseIndex * moduleHeight + actualHeight / 2,
          z,
        },
        rotationY,
        lengthMeters: lintelSpan.actualLengthMeters,
        heightMeters: actualHeight,
        depthMeters: wallThickness,
        bearingLeftMeters: opening.lintelBearingMeters,
        bearingRightMeters: opening.lintelBearingMeters,
        kind: mapLintelKind(opening.lintelType),
        source: 'opening_assembly_solver',
        startAlongMeters: lintelSpan.startAlongMeters,
        endAlongMeters: lintelSpan.endAlongMeters,
        extendedLeft: lintelSpan.extendedLeft,
        extendedRight: lintelSpan.extendedRight,
      };
    });
}

function resolveLintelEndSupportSegment(params: {
  endAlongMeters: number;
  side: 'left' | 'right';
  moduleLengthMeters: number;
  resolvedSpan: ResolvedLintelSpan;
}): { startAlongMeters: number; endAlongMeters: number; blockType: 'half_block' | 'cut_block' } | null {
  if (params.resolvedSpan.extendedLeft && params.side === 'left') return null;
  if (params.resolvedSpan.extendedRight && params.side === 'right') return null;

  const requestedEnd =
    params.side === 'left'
      ? params.resolvedSpan.requestedStartAlongMeters
      : params.resolvedSpan.requestedEndAlongMeters;

  if (isAlongModuleBoundary(requestedEnd, params.moduleLengthMeters)) return null;

  if (params.side === 'left') {
    const moduleFloor = Math.floor(requestedEnd / params.moduleLengthMeters) * params.moduleLengthMeters;
    const lengthMeters = requestedEnd - moduleFloor;
    if (lengthMeters < MIN_SUPPORT_BLOCK_LENGTH_METERS) return null;
    return {
      startAlongMeters: moduleFloor,
      endAlongMeters: requestedEnd,
      blockType: classifySupportBlockLength(lengthMeters, params.moduleLengthMeters),
    };
  }

  const moduleCeil = Math.ceil(requestedEnd / params.moduleLengthMeters) * params.moduleLengthMeters;
  const lengthMeters = moduleCeil - requestedEnd;
  if (lengthMeters < MIN_SUPPORT_BLOCK_LENGTH_METERS) return null;
  return {
    startAlongMeters: requestedEnd,
    endAlongMeters: moduleCeil,
    blockType: classifySupportBlockLength(lengthMeters, params.moduleLengthMeters),
  };
}

export function buildLegacyLintelBearingSupportBlocks(
  params: CmuWallSystemParameters,
  openings: readonly ResolvedCmuOpening[],
  resolvedSpans: ReadonlyMap<string, ResolvedLintelSpan>,
): OpeningSupportBlockPlacement[] {
  const moduleConfig = resolveCmuModuleConfig(params);
  const moduleLength = moduleConfig.moduleLengthMeters;
  const moduleHeight = moduleConfig.moduleHeightMeters;
  const actualHeight = moduleConfig.actualHeightMeters ?? Math.max(0.01, moduleHeight - moduleConfig.mortarJointMeters);
  const wallThickness = Math.max(0, params.wallThicknessMeters);
  const wallInset = wallThickness / 2;
  const placements: OpeningSupportBlockPlacement[] = [];

  openings.forEach((opening) => {
    if (opening.lintelType === 'none') return;
    const wallFace = opening.wallFace ?? 'north';
    const wallLength = wallFace === 'north' || wallFace === 'south' ? params.lengthMeters : params.widthMeters;
    const resolvedSpan = resolveEffectiveLintelSpan(opening, moduleLength, wallLength, resolvedSpans);
    const lintelCourseIndex = resolveLintelCourseIndex(opening.roughTopMeters, moduleHeight);
    const supportCourseIndex = lintelCourseIndex - 1;
    if (supportCourseIndex < 0) return;

    const rotationY = wallFace === 'east' || wallFace === 'west' ? Math.PI / 2 : 0;
    const y = supportCourseIndex * moduleHeight + actualHeight / 2;
    const ends = [
      { side: 'left' as const, endAlongMeters: resolvedSpan.requestedStartAlongMeters },
      { side: 'right' as const, endAlongMeters: resolvedSpan.requestedEndAlongMeters },
    ];

    ends.forEach((end) => {
      const segment = resolveLintelEndSupportSegment({
        endAlongMeters: end.endAlongMeters,
        side: end.side,
        moduleLengthMeters: moduleLength,
        resolvedSpan,
      });
      if (!segment) return;
      if (segment.startAlongMeters < 0 || segment.endAlongMeters > wallLength) return;

      const centerAlong = (segment.startAlongMeters + segment.endAlongMeters) / 2;
      const centeredAlong = centerAlong - wallLength / 2;
      const lengthMeters = segment.endAlongMeters - segment.startAlongMeters;
      const x =
        wallFace === 'east'
          ? params.lengthMeters / 2 - wallInset
          : wallFace === 'west'
            ? -params.lengthMeters / 2 + wallInset
            : centeredAlong;
      const z =
        wallFace === 'north'
          ? -params.widthMeters / 2 + wallInset
          : wallFace === 'south'
            ? params.widthMeters / 2 - wallInset
            : centeredAlong;

      placements.push({
        id: `lintel-support-${opening.id}-${end.side}-course-${supportCourseIndex}`,
        openingId: opening.id,
        hostSegmentId: wallFace,
        courseIndex: supportCourseIndex,
        side: end.side,
        closureRole: end.side === 'left' ? 'lintel_left_bearing' : 'lintel_right_bearing',
        blockType: segment.blockType,
        center: { x, y, z },
        rotationY,
        lengthMeters,
        heightMeters: actualHeight,
        depthMeters: wallThickness,
        startAlongMeters: segment.startAlongMeters,
        endAlongMeters: segment.endAlongMeters,
        source: 'opening_assembly_solver',
      });
    });
  });

  return placements;
}

export function buildLayoutLintelBearingSupportBlocks(
  openings: readonly ResolvedCmuOpening[],
  framesById: ReadonlyMap<string, SegmentFrameLike>,
  moduleLengthMeters: number,
  moduleHeightMeters: number,
  actualHeightMeters: number,
  resolvedSpans: ReadonlyMap<string, ResolvedLintelSpan>,
): OpeningSupportBlockPlacement[] {
  const placements: OpeningSupportBlockPlacement[] = [];

  openings.forEach((opening) => {
    if (opening.lintelType === 'none') return;
    const segmentId = (opening as ResolvedCmuOpening & { wallSegmentId?: string }).wallSegmentId ?? '';
    const frame = framesById.get(segmentId);
    if (!frame) return;
    const resolvedSpan = resolveEffectiveLintelSpan(opening, moduleLengthMeters, frame.lengthMeters, resolvedSpans);
    const lintelCourseIndex = resolveLintelCourseIndex(opening.roughTopMeters, moduleHeightMeters);
    const supportCourseIndex = lintelCourseIndex - 1;
    if (supportCourseIndex < 0) return;
    const y = supportCourseIndex * moduleHeightMeters + actualHeightMeters / 2;

    const ends = [
      { side: 'left' as const, endAlongMeters: resolvedSpan.requestedStartAlongMeters },
      { side: 'right' as const, endAlongMeters: resolvedSpan.requestedEndAlongMeters },
    ];

    ends.forEach((end) => {
      const segment = resolveLintelEndSupportSegment({
        endAlongMeters: end.endAlongMeters,
        side: end.side,
        moduleLengthMeters,
        resolvedSpan,
      });
      if (!segment) return;
      if (segment.startAlongMeters < 0 || segment.endAlongMeters > frame.lengthMeters) return;

      const centerAlong = (segment.startAlongMeters + segment.endAlongMeters) / 2;
      const point = pointOnSegmentFrame(frame, centerAlong, frame.wallThicknessMeters / 2);
      placements.push({
        id: `lintel-support-${opening.id}-${end.side}-course-${supportCourseIndex}`,
        openingId: opening.id,
        hostSegmentId: segmentId,
        courseIndex: supportCourseIndex,
        side: end.side,
        closureRole: end.side === 'left' ? 'lintel_left_bearing' : 'lintel_right_bearing',
        blockType: segment.blockType,
        center: { x: point.x, y, z: point.z },
        rotationY: frame.rotationY,
        lengthMeters: segment.endAlongMeters - segment.startAlongMeters,
        heightMeters: actualHeightMeters,
        depthMeters: frame.wallThicknessMeters,
        startAlongMeters: segment.startAlongMeters,
        endAlongMeters: segment.endAlongMeters,
        source: 'opening_assembly_solver',
      });
    });
  });

  return placements;
}

export function supportBlockPlacementToBlockInstance(
  support: OpeningSupportBlockPlacement,
  face: NonNullable<WallOpeningParameters['wallFace']>,
): {
  id: string;
  face: NonNullable<WallOpeningParameters['wallFace']>;
  course: number;
  courseIndex: number;
  blockType: 'half_block' | 'cut_block';
  x: number;
  y: number;
  z: number;
  rotationY: number;
  lengthMeters: number;
  heightMeters: number;
  depthMeters: number;
  startAlongMeters: number;
  endAlongMeters: number;
  source: 'opening_assembly_solver';
  openingId: string;
  closureRole: OpeningSupportClosureRole;
} {
  return {
    id: support.id,
    face,
    course: support.courseIndex,
    courseIndex: support.courseIndex,
    blockType: support.blockType,
    x: support.center.x,
    y: support.center.y,
    z: support.center.z,
    rotationY: support.rotationY,
    lengthMeters: support.lengthMeters,
    heightMeters: support.heightMeters,
    depthMeters: support.depthMeters,
    startAlongMeters: support.startAlongMeters,
    endAlongMeters: support.endAlongMeters,
    source: support.source,
    openingId: support.openingId,
    closureRole: support.closureRole,
  };
}

export function buildLayoutLintelSolidPlacements(
  openings: readonly ResolvedCmuOpening[],
  framesById: ReadonlyMap<string, SegmentFrameLike>,
  moduleHeightMeters: number,
  actualHeightMeters: number,
  moduleLengthMeters: number,
  resolvedSpans?: ReadonlyMap<string, ResolvedLintelSpan>,
  courseGrid?: OpeningCourseGridOptions,
): LintelSolidPlacement[] {
  return openings
    .filter((opening) => opening.lintelType !== 'none')
    .map((opening) => {
      const segmentId = (opening as ResolvedCmuOpening & { wallSegmentId?: string }).wallSegmentId ?? '';
      const frame = framesById.get(segmentId);
      const lintelCourseIndex = resolveLintelCourseIndexForGrid(
        opening.roughTopMeters,
        moduleHeightMeters,
        courseGrid,
      );
      const courseIndexOffset = courseGrid?.courseIndexOffset ?? 0;
      const courseIndexElevationDatumMeters = courseGrid?.courseIndexElevationDatumMeters ?? 0;
      const localLintelCourseIndex = lintelCourseIndex - courseIndexOffset;
      const lintelDepthMeters = frame?.wallThicknessMeters ?? 0.19;
      const wallLengthMeters = frame?.lengthMeters ?? 0;
      const lintelSpan = resolveEffectiveLintelSpan(opening, moduleLengthMeters, wallLengthMeters, resolvedSpans);
      const point = frame
        ? pointOnSegmentFrame(frame, lintelSpan.centerAlongMeters, lintelDepthMeters / 2)
        : { x: 0, z: 0 };
      return {
        id: `lintel-${opening.id}`,
        openingId: opening.id,
        hostSegmentId: segmentId,
        courseIndex: lintelCourseIndex,
        center: {
          x: point.x,
          y:
            courseIndexElevationDatumMeters +
            localLintelCourseIndex * moduleHeightMeters +
            actualHeightMeters / 2,
          z: point.z,
        },
        rotationY: frame?.rotationY ?? 0,
        lengthMeters: lintelSpan.actualLengthMeters,
        heightMeters: actualHeightMeters,
        depthMeters: lintelDepthMeters,
        bearingLeftMeters: opening.lintelBearingMeters,
        bearingRightMeters: opening.lintelBearingMeters,
        kind: mapLintelKind(opening.lintelType),
        source: 'opening_assembly_solver',
        startAlongMeters: lintelSpan.startAlongMeters,
        endAlongMeters: lintelSpan.endAlongMeters,
        extendedLeft: lintelSpan.extendedLeft,
        extendedRight: lintelSpan.extendedRight,
      };
    });
}

export function buildLegacyJambGroutFillPlacements(
  params: CmuWallSystemParameters,
  openings: readonly ResolvedCmuOpening[],
  courseCount: number,
): GroutFillPlacement[] {
  const moduleConfig = resolveCmuModuleConfig(params);
  const moduleLength = moduleConfig.moduleLengthMeters;
  const moduleHeight = moduleConfig.moduleHeightMeters;
  const actualHeight = moduleConfig.actualHeightMeters ?? Math.max(0.01, moduleHeight - moduleConfig.mortarJointMeters);
  const core = resolveCmuCoreGeometry(params);
  const wastePercent = Math.max(0, params.groutWastePercent ?? 0.1) * 100;
  const wallThickness = Math.max(0, params.wallThicknessMeters);
  const wallInset = wallThickness / 2;
  const placements: GroutFillPlacement[] = [];

  openings.forEach((opening) => {
    if (!opening.jambGroutEnabled || opening.groutCellsEachSide <= 0) return;
    const wallFace = opening.wallFace ?? 'north';
    const wallLength = wallFace === 'north' || wallFace === 'south' ? params.lengthMeters : params.widthMeters;
    const rotationY = wallFace === 'east' || wallFace === 'west' ? Math.PI / 2 : 0;
    const sides = [
      { side: 'left', edge: opening.roughStartAlongMeters, direction: -1 },
      { side: 'right', edge: opening.roughEndAlongMeters, direction: 1 },
    ] as const;

    for (let course = 0; course < courseCount; course += 1) {
      const courseBottom = course * moduleHeight;
      const courseTop = courseBottom + moduleHeight;
      if (courseBottom >= opening.roughTopMeters || courseTop <= opening.roughBottomMeters) continue;
      const y = courseBottom + actualHeight / 2;
      sides.forEach((side) => {
        for (let index = 0; index < opening.groutCellsEachSide; index += 1) {
          const centerAlong = side.edge + side.direction * (index + 0.5) * moduleLength;
          if (centerAlong < 0 || centerAlong > wallLength) continue;
          const centeredAlong = centerAlong - wallLength / 2;
          const x =
            wallFace === 'east'
              ? params.lengthMeters / 2 - wallInset
              : wallFace === 'west'
                ? -params.lengthMeters / 2 + wallInset
                : centeredAlong;
          const z =
            wallFace === 'north'
              ? -params.widthMeters / 2 + wallInset
              : wallFace === 'south'
                ? params.widthMeters / 2 - wallInset
                : centeredAlong;
          const gross = computeCellCoreVolumeCubicMeters(core, actualHeight);
          const volumes = applyGroutWaste(gross, wastePercent);
          placements.push({
            id: `jamb-grout-${opening.id}-${side.side}-${index}-course-${course}`,
            openingId: opening.id,
            hostSegmentId: wallFace,
            kind: 'jamb_cell',
            courseIndex: course,
            center: { x, y, z },
            rotationY,
            lengthMeters: moduleLength,
            heightMeters: actualHeight,
            depthMeters: wallThickness,
            grossVolumeCubicMeters: volumes.grossVolumeCubicMeters,
            wastePercent: volumes.wastePercent,
            netVolumeCubicMeters: volumes.netVolumeCubicMeters,
            source: 'opening_assembly_solver',
          });
        }
      });
    }
  });

  return placements;
}

export function buildLayoutJambGroutFillPlacements(
  openings: readonly ResolvedCmuOpening[],
  framesById: ReadonlyMap<string, SegmentFrameLike>,
  moduleLengthMeters: number,
  moduleHeightMeters: number,
  actualHeightMeters: number,
  core: CmuCoreGeometry,
  wastePercent: number,
): GroutFillPlacement[] {
  const placements: GroutFillPlacement[] = [];

  openings.forEach((opening) => {
    if (!opening.jambGroutEnabled || opening.groutCellsEachSide <= 0) return;
    const segmentId = (opening as ResolvedCmuOpening & { wallSegmentId?: string }).wallSegmentId ?? '';
    const frame = framesById.get(segmentId);
    if (!frame) return;
    const maxCourse = Math.ceil(opening.roughTopMeters / moduleHeightMeters);
    const sides = [
      { side: 'left', edge: opening.roughStartAlongMeters, direction: -1 },
      { side: 'right', edge: opening.roughEndAlongMeters, direction: 1 },
    ] as const;

    for (let course = 0; course < maxCourse; course += 1) {
      const courseBottom = course * moduleHeightMeters;
      const courseTop = courseBottom + moduleHeightMeters;
      if (courseBottom >= opening.roughTopMeters || courseTop <= opening.roughBottomMeters) continue;
      const y = courseBottom + actualHeightMeters / 2;
      sides.forEach((side) => {
        for (let index = 0; index < opening.groutCellsEachSide; index += 1) {
          const centerAlong = side.edge + side.direction * (index + 0.5) * moduleLengthMeters;
          if (centerAlong < 0 || centerAlong > frame.lengthMeters) continue;
          const point = pointOnSegmentFrame(frame, centerAlong, frame.wallThicknessMeters / 2);
          const gross = computeCellCoreVolumeCubicMeters(core, actualHeightMeters);
          const volumes = applyGroutWaste(gross, wastePercent);
          placements.push({
            id: `jamb-grout-${opening.id}-${side.side}-${index}-course-${course}`,
            openingId: opening.id,
            hostSegmentId: segmentId,
            kind: 'jamb_cell',
            courseIndex: course,
            center: { x: point.x, y, z: point.z },
            rotationY: frame.rotationY,
            lengthMeters: moduleLengthMeters,
            heightMeters: actualHeightMeters,
            depthMeters: frame.wallThicknessMeters,
            grossVolumeCubicMeters: volumes.grossVolumeCubicMeters,
            wastePercent: volumes.wastePercent,
            netVolumeCubicMeters: volumes.netVolumeCubicMeters,
            source: 'opening_assembly_solver',
          });
        }
      });
    }
  });

  return placements;
}

export function buildLintelGroutFillPlacements(
  params: CmuWallSystemParameters,
  openings: readonly ResolvedCmuOpening[],
  resolvePlacement: (opening: ResolvedCmuOpening, alongMeters: number, y: number) => {
    hostSegmentId: string;
    center: { x: number; y: number; z: number };
    rotationY: number;
    depthMeters: number;
  } | null,
  resolvedSpans?: ReadonlyMap<string, ResolvedLintelSpan>,
  wallLengthByOpeningId?: ReadonlyMap<string, number>,
): GroutFillPlacement[] {
  if (!params.lintelBondBeamEnabled) return [];
  const moduleConfig = resolveCmuModuleConfig(params);
  const moduleLength = moduleConfig.moduleLengthMeters;
  const moduleHeight = moduleConfig.moduleHeightMeters;
  const actualHeight = moduleConfig.actualHeightMeters ?? Math.max(0.01, moduleHeight - moduleConfig.mortarJointMeters);
  const core = resolveCmuCoreGeometry(params);
  const wastePercent = Math.max(0, params.groutWastePercent ?? 0.1) * 100;
  const placements: GroutFillPlacement[] = [];

  openings.forEach((opening) => {
    if (opening.lintelType === 'none' || opening.lintelType === 'precast_concrete' || opening.lintelType === 'steel_placeholder') {
      return;
    }
    if (opening.lintelType !== 'bond_beam') return;
    const wallLength =
      wallLengthByOpeningId?.get(opening.id) ??
      (opening.wallFace === 'north' || opening.wallFace === 'south' ? params.lengthMeters : params.widthMeters);
    const lintelCourseIndex = resolveLintelCourseIndex(opening.roughTopMeters, moduleHeight);
    const lintelSpan = resolveEffectiveLintelSpan(opening, moduleLength, wallLength, resolvedSpans);
    const y = lintelCourseIndex * moduleHeight + actualHeight / 2;
    let moduleStart = Math.floor(lintelSpan.startAlongMeters / moduleLength) * moduleLength;
    while (moduleStart < lintelSpan.endAlongMeters) {
      const cellCenterAlong = moduleStart + moduleLength / 2;
      if (cellCenterAlong >= lintelSpan.startAlongMeters && cellCenterAlong <= lintelSpan.endAlongMeters) {
        const resolved = resolvePlacement(opening, cellCenterAlong, y);
        if (resolved) {
          const gross = computeCellCoreVolumeCubicMeters(core, actualHeight);
          const volumes = applyGroutWaste(gross, wastePercent);
          placements.push({
            id: `lintel-grout-${opening.id}-course-${lintelCourseIndex}-along-${moduleStart.toFixed(3)}`,
            openingId: opening.id,
            hostSegmentId: resolved.hostSegmentId,
            kind: 'lintel_cell',
            courseIndex: lintelCourseIndex,
            center: resolved.center,
            rotationY: resolved.rotationY,
            lengthMeters: moduleLength,
            heightMeters: actualHeight,
            depthMeters: resolved.depthMeters,
            grossVolumeCubicMeters: volumes.grossVolumeCubicMeters,
            wastePercent: volumes.wastePercent,
            netVolumeCubicMeters: volumes.netVolumeCubicMeters,
            source: 'opening_assembly_solver',
          });
        }
      }
      moduleStart += moduleLength;
    }
  });

  return placements;
}

export function buildSillGroutFillPlacements(
  params: CmuWallSystemParameters,
  openings: readonly ResolvedCmuOpening[],
  openingParams: readonly WallOpeningParameters[],
  resolvePlacement: (opening: ResolvedCmuOpening, alongMeters: number, y: number) => {
    hostSegmentId: string;
    center: { x: number; y: number; z: number };
    rotationY: number;
    depthMeters: number;
  } | null,
): GroutFillPlacement[] {
  const moduleConfig = resolveCmuModuleConfig(params);
  const moduleLength = moduleConfig.moduleLengthMeters;
  const moduleHeight = moduleConfig.moduleHeightMeters;
  const actualHeight = moduleConfig.actualHeightMeters ?? Math.max(0.01, moduleHeight - moduleConfig.mortarJointMeters);
  const core = resolveCmuCoreGeometry(params);
  const wastePercent = Math.max(0, params.groutWastePercent ?? 0.1) * 100;
  const placements: GroutFillPlacement[] = [];
  const paramsById = new Map(openingParams.map((opening) => [opening.id, opening]));

  openings.forEach((opening) => {
    if (opening.type !== 'window') return;
    const source = paramsById.get(opening.id);
    const sillCondition = source?.sillCondition ?? 'none';
    if (sillCondition !== 'grouted_sill_course') return;
    const sillCourseIndex = Math.max(0, Math.floor(opening.roughBottomMeters / moduleHeight));
    const y = sillCourseIndex * moduleHeight + actualHeight / 2;
    let moduleStart = Math.floor(opening.roughStartAlongMeters / moduleLength) * moduleLength;
    while (moduleStart < opening.roughEndAlongMeters) {
      const cellCenterAlong = moduleStart + moduleLength / 2;
      if (cellCenterAlong >= opening.roughStartAlongMeters && cellCenterAlong <= opening.roughEndAlongMeters) {
        const resolved = resolvePlacement(opening, cellCenterAlong, y);
        if (resolved) {
          const gross = computeCellCoreVolumeCubicMeters(core, actualHeight);
          const volumes = applyGroutWaste(gross, wastePercent);
          placements.push({
            id: `sill-grout-${opening.id}-course-${sillCourseIndex}-along-${moduleStart.toFixed(3)}`,
            openingId: opening.id,
            hostSegmentId: resolved.hostSegmentId,
            kind: 'sill_cell',
            courseIndex: sillCourseIndex,
            center: resolved.center,
            rotationY: resolved.rotationY,
            lengthMeters: moduleLength,
            heightMeters: actualHeight,
            depthMeters: resolved.depthMeters,
            grossVolumeCubicMeters: volumes.grossVolumeCubicMeters,
            wastePercent: volumes.wastePercent,
            netVolumeCubicMeters: volumes.netVolumeCubicMeters,
            source: 'opening_assembly_solver',
          });
        }
      }
      moduleStart += moduleLength;
    }
  });

  return placements;
}

export function deduplicateGroutFillPlacements(placements: readonly GroutFillPlacement[]): {
  placements: GroutFillPlacement[];
  overlapDeduplicationCubicMeters: number;
} {
  const seen = new Map<string, GroutFillPlacement>();
  let overlapDeduplicationCubicMeters = 0;

  placements.forEach((placement) => {
    const key = [
      placement.hostSegmentId,
      placement.courseIndex,
      placement.kind === 'bond_beam_cell' ? 'bond_beam_cell' : placement.kind,
      placement.center.x.toFixed(4),
      placement.center.y.toFixed(4),
      placement.center.z.toFixed(4),
    ].join('|');
    const existing = seen.get(key);
    if (existing) {
      overlapDeduplicationCubicMeters += placement.netVolumeCubicMeters;
      if (placement.kind === 'lintel_cell' && existing.kind === 'bond_beam_cell') {
        seen.set(key, { ...existing, kind: 'lintel_cell', openingId: placement.openingId ?? existing.openingId });
      }
      return;
    }
    seen.set(key, placement);
  });

  return { placements: [...seen.values()], overlapDeduplicationCubicMeters };
}

export function groutFillsToJambGroutCells(
  fills: readonly GroutFillPlacement[],
): Array<{
  id: string;
  face: NonNullable<WallOpeningParameters['wallFace']>;
  openingId: string;
  courseIndex: number;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  heightMeters: number;
  widthMeters: number;
  segmentId?: string;
}> {
  return fills
    .filter((fill) => fill.kind === 'jamb_cell' && fill.openingId)
    .map((fill) => ({
      id: fill.id,
      face: (fill.hostSegmentId as NonNullable<WallOpeningParameters['wallFace']>) ?? 'north',
      openingId: fill.openingId!,
      courseIndex: fill.courseIndex,
      x: fill.center.x,
      y: fill.center.y,
      z: fill.center.z,
      rotationY: fill.rotationY,
      heightMeters: fill.heightMeters,
      widthMeters: fill.lengthMeters,
      segmentId: fill.hostSegmentId,
    }));
}

export function lintelSolidToInstance(lintel: LintelSolidPlacement): {
  id: string;
  face: NonNullable<WallOpeningParameters['wallFace']>;
  openingId: string;
  courseIndex: number;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  lengthMeters: number;
  heightMeters: number;
  depthMeters: number;
  bearingLeftMeters: number;
  bearingRightMeters: number;
  segmentId?: string;
  kind: LintelSolidKind;
  source: 'opening_assembly_solver';
  hostSegmentId: string;
} {
  return {
    id: lintel.id,
    face: (lintel.hostSegmentId as NonNullable<WallOpeningParameters['wallFace']>) ?? 'north',
    openingId: lintel.openingId,
    courseIndex: lintel.courseIndex,
    x: lintel.center.x,
    y: lintel.center.y,
    z: lintel.center.z,
    rotationY: lintel.rotationY,
    lengthMeters: lintel.lengthMeters,
    heightMeters: lintel.heightMeters,
    depthMeters: lintel.depthMeters,
    bearingLeftMeters: lintel.bearingLeftMeters,
    bearingRightMeters: lintel.bearingRightMeters,
    segmentId: lintel.hostSegmentId,
    hostSegmentId: lintel.hostSegmentId,
    kind: lintel.kind,
    source: lintel.source,
  };
}

export function summarizeGroutFillPlacements(params: {
  placements: readonly GroutFillPlacement[];
  overlapDeduplicationCubicMeters: number;
  closureGroutVolumeCubicMeters?: number;
  bondBeamGroutVolumeCubicMeters?: number;
  standardCoreFillCubicMeters?: number;
  coreGeometry: CmuCoreGeometry;
}): {
  jambGroutVolumeCubicMeters: number;
  lintelGroutVolumeCubicMeters: number;
  sillGroutVolumeCubicMeters: number;
  bondBeamGroutVolumeCubicMeters: number;
  closureGroutVolumeCubicMeters: number;
  standardCoreFillCubicMeters: number;
  totalGroutVolumeCubicMeters: number;
  jambGroutCellCount: number;
  lintelGroutedCellCount: number;
  groutFillPlacementIds: string[];
} {
  const sumByKind = (kind: GroutFillKind) =>
    params.placements
      .filter((placement) => placement.kind === kind)
      .reduce((sum, placement) => sum + placement.netVolumeCubicMeters, 0);

  const jambGroutVolumeCubicMeters = sumByKind('jamb_cell');
  const lintelGroutVolumeCubicMeters = sumByKind('lintel_cell');
  const sillGroutVolumeCubicMeters = sumByKind('sill_cell');
  const bondBeamFromPlacements = sumByKind('bond_beam_cell');
  const bondBeamGroutVolumeCubicMeters = params.bondBeamGroutVolumeCubicMeters ?? bondBeamFromPlacements;
  const closureGroutVolumeCubicMeters =
    params.closureGroutVolumeCubicMeters ?? sumByKind('closure_void') + sumByKind('sill_cell');
  const standardCoreFillCubicMeters = params.standardCoreFillCubicMeters ?? 0;

  const totalGroutVolumeCubicMeters =
    standardCoreFillCubicMeters +
    jambGroutVolumeCubicMeters +
    lintelGroutVolumeCubicMeters +
    sillGroutVolumeCubicMeters +
    bondBeamGroutVolumeCubicMeters +
    closureGroutVolumeCubicMeters -
    params.overlapDeduplicationCubicMeters;

  return {
    jambGroutVolumeCubicMeters,
    lintelGroutVolumeCubicMeters,
    sillGroutVolumeCubicMeters,
    bondBeamGroutVolumeCubicMeters,
    closureGroutVolumeCubicMeters,
    standardCoreFillCubicMeters,
    totalGroutVolumeCubicMeters: Math.max(0, totalGroutVolumeCubicMeters),
    jambGroutCellCount: params.placements.filter((placement) => placement.kind === 'jamb_cell').length,
    lintelGroutedCellCount: params.placements.filter(
      (placement) => placement.kind === 'lintel_cell' || placement.kind === 'bond_beam_cell',
    ).length,
    groutFillPlacementIds: params.placements.map((placement) => placement.id),
  };
}

export function pointOnSegmentFrame(
  frame: SegmentFrameLike,
  alongMeters: number,
  inwardOffsetMeters: number,
): { x: number; z: number } {
  return {
    x: frame.start.x + frame.tangent.x * alongMeters + frame.inwardNormal.x * inwardOffsetMeters,
    z: frame.start.z + frame.tangent.z * alongMeters + frame.inwardNormal.z * inwardOffsetMeters,
  };
}

export function lintelSolidOccupiesSameVolumeAsBlock(params: {
  lintel: LintelSolidPlacement;
  blockCenter: { x: number; y: number; z: number };
  blockSize: { lengthMeters: number; heightMeters: number; depthMeters: number };
  toleranceMeters?: number;
}): boolean {
  const tolerance = params.toleranceMeters ?? 0.02;
  const dx = Math.abs(params.lintel.center.x - params.blockCenter.x);
  const dy = Math.abs(params.lintel.center.y - params.blockCenter.y);
  const dz = Math.abs(params.lintel.center.z - params.blockCenter.z);
  return (
    dx <= params.blockSize.lengthMeters / 2 + params.lintel.lengthMeters / 2 + tolerance &&
    dy <= params.blockSize.heightMeters / 2 + params.lintel.heightMeters / 2 + tolerance &&
    dz <= params.blockSize.depthMeters / 2 + params.lintel.depthMeters / 2 + tolerance
  );
}
