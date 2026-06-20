import type { ResolvedCmuOpening } from './cmuOpeningRules';
import {
  applyGroutWaste,
  computeCellCoreVolumeCubicMeters,
  type CmuCoreGeometry,
} from './cmuCoreGeometry';
import type { CmuBlockInstance } from '../geometry/designGeometry';
import type { GroutFillKind, GroutFillPlacement, SegmentFrameLike } from './openingAssemblySolver';
import { pointOnSegmentFrame, resolveLintelCourseIndex } from './openingAssemblySolver';
import type { CmuOpeningCourseClosure } from '../geometry/designGeometry';

export type GroutCellPlacementKind =
  | 'jamb_cell'
  | 'reinforced_cell'
  | 'bond_beam_cell'
  | 'lintel_cell'
  | 'closure_void';

export type GroutCellPlacement = {
  id: string;
  openingId?: string;
  hostSegmentId: string;
  kind: GroutCellPlacementKind;
  courseIndex?: number;
  startStationMeters: number;
  endStationMeters: number;
  baseElevationMeters: number;
  topElevationMeters: number;
  coreVoidVolumeCubicMeters: number;
  source: 'opening_jamb' | 'bond_beam' | 'lintel' | 'course_closure';
  center: { x: number; y: number; z: number };
  rotationY: number;
};

export type GroutCellRenderDimensions = {
  lengthMeters: number;
  heightMeters: number;
  depthMeters: number;
};

export const GROUT_CELL_RENDER_COLOR = 0xa8a29e;
export const LINTEL_RENDER_COLOR = 0x9ca3af;
export const LINTEL_RENDER_EPSILON_METERS = 0.002;

type LayoutBlockLike = Pick<
  CmuBlockInstance,
  | 'segmentId'
  | 'course'
  | 'courseIndex'
  | 'startAlongMeters'
  | 'endAlongMeters'
  | 'stationMeters'
  | 'x'
  | 'y'
  | 'z'
  | 'rotationY'
  | 'blockType'
  | 'unitType'
  | 'heightMeters'
  | 'nearOpeningId'
>;

export function isBondBeamLintelType(lintelType: ResolvedCmuOpening['lintelType']): boolean {
  return lintelType === 'bond_beam';
}

export function isGroutableJambBlock(block: LayoutBlockLike): boolean {
  const unitType = block.unitType ?? block.blockType;
  if (unitType === 'jamb' || unitType === 'jamb_block') return false;
  if (unitType === 'half' || unitType === 'half_block') return false;
  if (unitType === 'cut' || unitType === 'cut_block') return false;
  if (unitType === 'corner' || unitType === 'corner_block') return false;
  if (unitType === 'bond_beam' || unitType === 'bond_beam_block') return false;
  if (unitType === 'end' || unitType === 'end_block') return false;
  return unitType === 'full' || unitType === 'full_block' || block.unitType === 'full';
}

export function resolveGroutFillMeshDimensions(
  fill: Pick<GroutFillPlacement, 'kind' | 'lengthMeters' | 'heightMeters' | 'depthMeters'>,
  core: CmuCoreGeometry,
): GroutCellRenderDimensions {
  if (fill.kind === 'closure_void' || fill.kind === 'sill_cell') {
    return {
      lengthMeters: fill.lengthMeters,
      heightMeters: fill.heightMeters,
      depthMeters: fill.depthMeters,
    };
  }
  return resolveGroutCellRenderDimensions(fill, core);
}

export function resolveGroutCellRenderDimensions(
  fill: Pick<GroutFillPlacement, 'kind' | 'heightMeters'>,
  core: CmuCoreGeometry,
): GroutCellRenderDimensions {
  const coreCount = Math.max(1, core.coreCount);
  return {
    lengthMeters: core.coreLengthMeters,
    heightMeters: fill.heightMeters,
    depthMeters: core.coreWidthMeters * coreCount,
  };
}

export function groutFillPlacementToCellPlacement(fill: GroutFillPlacement): GroutCellPlacement {
  const halfHeight = fill.heightMeters / 2;
  return {
    id: fill.id,
    openingId: fill.openingId,
    hostSegmentId: fill.hostSegmentId,
    kind: fill.kind === 'sill_cell' ? 'closure_void' : (fill.kind as GroutCellPlacementKind),
    courseIndex: fill.courseIndex,
    startStationMeters: fill.center.x,
    endStationMeters: fill.center.x,
    baseElevationMeters: fill.center.y - halfHeight,
    topElevationMeters: fill.center.y + halfHeight,
    coreVoidVolumeCubicMeters: fill.netVolumeCubicMeters,
    source:
      fill.kind === 'jamb_cell'
        ? 'opening_jamb'
        : fill.kind === 'closure_void'
          ? 'course_closure'
          : fill.kind === 'lintel_cell' || fill.kind === 'bond_beam_cell'
            ? 'lintel'
            : 'bond_beam',
    center: fill.center,
    rotationY: fill.rotationY,
  };
}

function findGroutableBlockAtJambStation(
  blocks: readonly LayoutBlockLike[],
  segmentId: string,
  courseIndex: number,
  centerAlongMeters: number,
  moduleLengthMeters: number,
): LayoutBlockLike | null {
  const tolerance = Math.max(0.03, moduleLengthMeters * 0.35);
  return (
    blocks.find((block) => {
      if (block.segmentId !== segmentId) return false;
      const blockCourse = block.courseIndex ?? block.course;
      if (blockCourse !== courseIndex) return false;
      if (!isGroutableJambBlock(block)) return false;
      const start = block.startAlongMeters;
      const end = block.endAlongMeters;
      const blockCenter = Number.isFinite(start) && Number.isFinite(end) ? (start + end) / 2 : block.stationMeters ?? centerAlongMeters;
      if (Math.abs(blockCenter - centerAlongMeters) <= tolerance) return true;
      return centerAlongMeters + tolerance >= start && centerAlongMeters - tolerance <= end;
    }) ?? null
  );
}

export function buildLayoutJambGroutFillPlacementsFromBlocks(params: {
  openings: readonly ResolvedCmuOpening[];
  framesById: ReadonlyMap<string, SegmentFrameLike>;
  blocks: readonly LayoutBlockLike[];
  moduleLengthMeters: number;
  moduleHeightMeters: number;
  actualHeightMeters: number;
  core: CmuCoreGeometry;
  wastePercent: number;
}): GroutFillPlacement[] {
  const placements: GroutFillPlacement[] = [];

  params.openings.forEach((opening) => {
    if (!opening.jambGroutEnabled || opening.groutCellsEachSide <= 0) return;
    const segmentId = (opening as ResolvedCmuOpening & { wallSegmentId?: string }).wallSegmentId ?? '';
    const frame = params.framesById.get(segmentId);
    if (!frame) return;
    const maxCourse = Math.ceil(opening.roughTopMeters / params.moduleHeightMeters);
    const lintelCourseIndex = resolveLintelCourseIndex(opening.roughTopMeters, params.moduleHeightMeters);
    const sides = [
      { side: 'left', edge: opening.roughStartAlongMeters, direction: -1 },
      { side: 'right', edge: opening.roughEndAlongMeters, direction: 1 },
    ] as const;

    for (let course = 0; course < maxCourse; course += 1) {
      if (course >= lintelCourseIndex) continue;
      const courseBottom = course * params.moduleHeightMeters;
      const courseTop = courseBottom + params.moduleHeightMeters;
      if (courseBottom >= opening.roughTopMeters || courseTop <= opening.roughBottomMeters) continue;

      sides.forEach((side) => {
        for (let index = 0; index < opening.groutCellsEachSide; index += 1) {
          const centerAlong = side.edge + side.direction * (index + 0.5) * params.moduleLengthMeters;
          if (centerAlong < 0 || centerAlong > frame.lengthMeters) continue;
          const block = findGroutableBlockAtJambStation(
            params.blocks,
            segmentId,
            course,
            centerAlong,
            params.moduleLengthMeters,
          );
          if (!block) continue;

          const point = pointOnSegmentFrame(frame, centerAlong, frame.wallThicknessMeters / 2);
          const gross = computeCellCoreVolumeCubicMeters(params.core, params.actualHeightMeters);
          const volumes = applyGroutWaste(gross, params.wastePercent);
          const renderDims = resolveGroutCellRenderDimensions(
            { kind: 'jamb_cell', heightMeters: params.actualHeightMeters },
            params.core,
          );
          placements.push({
            id: `jamb-grout-${opening.id}-${side.side}-${index}-course-${course}`,
            openingId: opening.id,
            hostSegmentId: segmentId,
            kind: 'jamb_cell',
            courseIndex: course,
            center: { x: point.x, y: courseBottom + params.actualHeightMeters / 2, z: point.z },
            rotationY: frame.rotationY,
            lengthMeters: renderDims.lengthMeters,
            heightMeters: renderDims.heightMeters,
            depthMeters: renderDims.depthMeters,
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

export function buildClosureGroutFillPlacements(params: {
  closures: readonly CmuOpeningCourseClosure[];
  openings: readonly ResolvedCmuOpening[];
  framesById: ReadonlyMap<string, SegmentFrameLike>;
  moduleHeightMeters: number;
  actualHeightMeters: number;
  wallThicknessMeters: number;
  wastePercent: number;
}): GroutFillPlacement[] {
  const placements: GroutFillPlacement[] = [];
  const openingById = new Map(params.openings.map((opening) => [opening.id, opening]));

  params.closures.forEach((closure) => {
    if (closure.closureType !== 'grout_fill') return;
    const opening = openingById.get(closure.openingId);
    if (!opening) return;
    const segmentId = (opening as ResolvedCmuOpening & { wallSegmentId?: string }).wallSegmentId ?? closure.wallFace;
    const frame = params.framesById.get(segmentId);
    const gapStart = Math.min(closure.roughOpeningEdge, closure.nearestBlockEdge);
    const gapEnd = Math.max(closure.roughOpeningEdge, closure.nearestBlockEdge);
    const lengthMeters = Math.max(0, gapEnd - gapStart);
    if (lengthMeters <= 0) return;
    const centerAlong = (gapStart + gapEnd) / 2;
    const y = closure.courseBottom + params.actualHeightMeters / 2;
    const center = frame
      ? (() => {
          const point = pointOnSegmentFrame(frame, centerAlong, frame.wallThicknessMeters / 2);
          return { x: point.x, y, z: point.z };
        })()
      : { x: 0, y, z: 0 };
    const grossVolume = closure.groutVolume ?? lengthMeters * params.wallThicknessMeters * params.moduleHeightMeters;
    const volumes = applyGroutWaste(grossVolume, params.wastePercent);
    placements.push({
      id: `closure-grout-${closure.openingId}-course-${closure.courseIndex}-${closure.side}`,
      openingId: closure.openingId,
      hostSegmentId: segmentId,
      kind: 'closure_void' as GroutFillKind,
      courseIndex: closure.courseIndex,
      center,
      rotationY: frame?.rotationY ?? 0,
      lengthMeters,
      heightMeters: params.actualHeightMeters,
      depthMeters: params.wallThicknessMeters,
      grossVolumeCubicMeters: volumes.grossVolumeCubicMeters,
      wastePercent: volumes.wastePercent,
      netVolumeCubicMeters: volumes.netVolumeCubicMeters,
      source: 'opening_assembly_solver',
    });
  });

  return placements;
}

export function totalGroutCellVolumeCubicMeters(placements: readonly GroutFillPlacement[]): number {
  return placements.reduce((sum, placement) => sum + Math.max(0, placement.netVolumeCubicMeters), 0);
}
