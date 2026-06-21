import type { CmuInfillPanel } from '../types';
import type { CmuBlockInstance, CmuUnitPlacement, SegmentFrame } from '../geometry/designGeometry';
import { MIN_OPENING_CLOSURE_LENGTH_METERS } from './openingCourseClosureSolver';

export const UNDERSIZED_CUT_WARNING_CODE = 'undersized_cut_unit';

export type ModuleGridCell = {
  cellStartMeters: number;
  cellEndMeters: number;
  blockType: 'full' | 'half';
};

export type CourseLayoutCounters = {
  full: number;
  half: number;
  cut: number;
  topClosure: number;
};

export type ClippedCourseBlock = {
  stationMeters: number;
  nominalLengthMeters: number;
  actualLengthMeters: number;
  blockType: CmuBlockInstance['blockType'];
  kind?: CmuUnitPlacement['kind'];
  warning?: string;
};

export function buildRunningBondModuleGrid(params: {
  bondDatumStationMeters: number;
  courseIndex: number;
  coverageEndMeters: number;
  nominalModuleMeters: number;
  halfNominalMeters: number;
  bondPattern: 'running_bond' | 'stack_bond';
}): ModuleGridCell[] {
  const cells: ModuleGridCell[] = [];
  const runningBondOffset =
    params.bondPattern === 'running_bond' && params.courseIndex % 2 === 1;
  let station = params.bondDatumStationMeters;

  if (runningBondOffset) {
    cells.push({
      cellStartMeters: params.bondDatumStationMeters,
      cellEndMeters: params.bondDatumStationMeters + params.halfNominalMeters,
      blockType: 'half',
    });
    station = params.bondDatumStationMeters + params.halfNominalMeters;
  }

  while (station < params.coverageEndMeters - 0.0001) {
    cells.push({
      cellStartMeters: station,
      cellEndMeters: station + params.nominalModuleMeters,
      blockType: 'full',
    });
    station += params.nominalModuleMeters;
  }

  return cells;
}

export function clipGridCellsToInterval(params: {
  cells: readonly ModuleGridCell[];
  intervalStartMeters: number;
  intervalEndMeters: number;
  nominalModuleMeters: number;
  halfNominalMeters: number;
  actualFullLengthMeters: number;
  halfActualLengthMeters: number;
}): ClippedCourseBlock[] {
  const blocks: ClippedCourseBlock[] = [];
  const tolerance = 0.005;

  for (const cell of params.cells) {
    const clipStart = Math.max(cell.cellStartMeters, params.intervalStartMeters);
    const clipEnd = Math.min(cell.cellEndMeters, params.intervalEndMeters);
    const clipLength = clipEnd - clipStart;
    if (clipLength <= 0.0001) {
      continue;
    }

    const fullyContained =
      clipStart <= cell.cellStartMeters + tolerance &&
      clipEnd >= cell.cellEndMeters - tolerance;

    if (fullyContained) {
      if (cell.blockType === 'half') {
        blocks.push({
          stationMeters: cell.cellStartMeters,
          nominalLengthMeters: params.halfNominalMeters,
          actualLengthMeters: params.halfActualLengthMeters,
          blockType: 'half',
        });
      } else {
        blocks.push({
          stationMeters: cell.cellStartMeters,
          nominalLengthMeters: params.nominalModuleMeters,
          actualLengthMeters: params.actualFullLengthMeters,
          blockType: 'full',
        });
      }
      continue;
    }

    let warning: string | undefined;
    if (clipLength < MIN_OPENING_CLOSURE_LENGTH_METERS) {
      warning = UNDERSIZED_CUT_WARNING_CODE;
    }

    blocks.push({
      stationMeters: clipStart,
      nominalLengthMeters: clipLength,
      actualLengthMeters: clipLength,
      blockType: 'cut',
      kind: 'cut_block',
      warning,
    });
  }

  return blocks;
}

export function blockFromPanelUnit(params: {
  panel: CmuInfillPanel;
  frame: SegmentFrame;
  courseIndex: number;
  moduleIndex: number;
  stationMeters: number;
  nominalLengthMeters: number;
  actualLengthMeters: number;
  courseBottomElevationMeters: number;
  physicalHeightMeters: number;
  blockType: CmuBlockInstance['blockType'];
  kind?: CmuUnitPlacement['kind'];
  source?: CmuUnitPlacement['source'];
}): CmuBlockInstance {
  const centerStation = params.stationMeters + params.nominalLengthMeters / 2;
  const y = params.courseBottomElevationMeters + params.physicalHeightMeters / 2;
  const unitType =
    params.kind === 'cut_height_block'
      ? 'cut'
      : params.blockType === 'half'
        ? 'half_block'
        : params.blockType === 'cut'
          ? 'cut_block'
          : 'full_block';
  return {
    id: `${params.panel.id}-c${params.courseIndex}-m${params.moduleIndex}`,
    face: 'north',
    segmentId: params.panel.hostSegmentId,
    wallFace: params.panel.hostSegmentId,
    course: params.courseIndex + 1,
    courseIndex: params.courseIndex,
    moduleIndex: params.moduleIndex,
    blockType: params.blockType,
    unitType,
    kind: params.kind,
    stationMeters: params.stationMeters,
    nominalLengthMeters: params.nominalLengthMeters,
    actualLengthMeters: params.actualLengthMeters,
    heightMeters: params.physicalHeightMeters,
    physicalHeightMeters: params.physicalHeightMeters,
    depthMeters: params.frame.wallThicknessMeters,
    source: params.source ?? 'infill_panel_solver',
    infillBand:
      params.panel.infillZone === 'below_grade'
        ? 'below_grade'
        : params.panel.infillZone === 'above_grade'
          ? 'above_grade'
          : 'main',
    x:
      params.frame.exteriorStart.x +
      params.frame.tangent.x * centerStation +
      params.frame.inwardNormal.x * (params.frame.wallThicknessMeters / 2),
    y,
    z:
      params.frame.exteriorStart.z +
      params.frame.tangent.z * centerStation +
      params.frame.inwardNormal.z * (params.frame.wallThicknessMeters / 2),
    rotationY: params.frame.rotationY,
    lengthMeters: params.actualLengthMeters,
    startAlongMeters: params.stationMeters,
    endAlongMeters: params.stationMeters + params.nominalLengthMeters,
  };
}

export function layoutHorizontalCourseUnits(params: {
  panel: CmuInfillPanel;
  frame: SegmentFrame;
  courseIndex: number;
  courseBottomElevationMeters: number;
  physicalHeightMeters: number;
  isTopClosure: boolean;
  nominalModuleMeters: number;
  actualFullLengthMeters: number;
  halfNominalMeters: number;
  halfActualLengthMeters: number;
  bondPattern: 'running_bond' | 'stack_bond';
  bondDatumStationMeters?: number;
  counters: CourseLayoutCounters;
  source?: CmuUnitPlacement['source'];
}): CmuBlockInstance[] {
  const bondDatum = params.bondDatumStationMeters ?? params.panel.startStationMeters;
  const cells = buildRunningBondModuleGrid({
    bondDatumStationMeters: bondDatum,
    courseIndex: params.courseIndex,
    coverageEndMeters: params.panel.endStationMeters,
    nominalModuleMeters: params.nominalModuleMeters,
    halfNominalMeters: params.halfNominalMeters,
    bondPattern: params.bondPattern,
  });
  const clipped = clipGridCellsToInterval({
    cells,
    intervalStartMeters: params.panel.startStationMeters,
    intervalEndMeters: params.panel.endStationMeters,
    nominalModuleMeters: params.nominalModuleMeters,
    halfNominalMeters: params.halfNominalMeters,
    actualFullLengthMeters: params.actualFullLengthMeters,
    halfActualLengthMeters: params.halfActualLengthMeters,
  });

  const blocks: CmuBlockInstance[] = [];
  let moduleIndex = 0;
  for (const clippedBlock of clipped) {
    blocks.push(
      blockFromPanelUnit({
        panel: params.panel,
        frame: params.frame,
        courseIndex: params.courseIndex,
        moduleIndex,
        stationMeters: clippedBlock.stationMeters,
        nominalLengthMeters: clippedBlock.nominalLengthMeters,
        actualLengthMeters: clippedBlock.actualLengthMeters,
        courseBottomElevationMeters: params.courseBottomElevationMeters,
        physicalHeightMeters: params.physicalHeightMeters,
        blockType: clippedBlock.blockType,
        kind: params.isTopClosure ? 'cut_height_block' : clippedBlock.kind,
        source: params.isTopClosure ? 'panel_top_closure' : params.source,
      }),
    );
    moduleIndex += 1;
    if (params.isTopClosure) {
      params.counters.topClosure += 1;
    } else if (clippedBlock.blockType === 'full') {
      params.counters.full += 1;
    } else if (clippedBlock.blockType === 'half') {
      params.counters.half += 1;
    } else {
      params.counters.cut += 1;
    }
  }

  return blocks;
}

export function layoutHorizontalCourseUnitsForInterval(params: {
  panel: CmuInfillPanel;
  frame: SegmentFrame;
  courseIndex: number;
  courseBottomElevationMeters: number;
  physicalHeightMeters: number;
  intervalStartMeters: number;
  intervalEndMeters: number;
  nominalModuleMeters: number;
  actualFullLengthMeters: number;
  halfNominalMeters: number;
  halfActualLengthMeters: number;
  bondPattern: 'running_bond' | 'stack_bond';
  bondDatumStationMeters: number;
  counters: CourseLayoutCounters;
  source: CmuUnitPlacement['source'];
  warnings: string[];
}): CmuBlockInstance[] {
  const cells = buildRunningBondModuleGrid({
    bondDatumStationMeters: params.bondDatumStationMeters,
    courseIndex: params.courseIndex,
    coverageEndMeters: params.panel.endStationMeters,
    nominalModuleMeters: params.nominalModuleMeters,
    halfNominalMeters: params.halfNominalMeters,
    bondPattern: params.bondPattern,
  });
  const clipped = clipGridCellsToInterval({
    cells,
    intervalStartMeters: params.intervalStartMeters,
    intervalEndMeters: params.intervalEndMeters,
    nominalModuleMeters: params.nominalModuleMeters,
    halfNominalMeters: params.halfNominalMeters,
    actualFullLengthMeters: params.actualFullLengthMeters,
    halfActualLengthMeters: params.halfActualLengthMeters,
  });

  const blocks: CmuBlockInstance[] = [];
  let moduleIndex = 0;
  for (const clippedBlock of clipped) {
    if (clippedBlock.warning) {
      params.warnings.push(
        `Course ${params.courseIndex + 1} has ${clippedBlock.warning} at station ${clippedBlock.stationMeters.toFixed(3)} m (length ${clippedBlock.actualLengthMeters.toFixed(3)} m).`,
      );
    }
    blocks.push(
      blockFromPanelUnit({
        panel: params.panel,
        frame: params.frame,
        courseIndex: params.courseIndex,
        moduleIndex,
        stationMeters: clippedBlock.stationMeters,
        nominalLengthMeters: clippedBlock.nominalLengthMeters,
        actualLengthMeters: clippedBlock.actualLengthMeters,
        courseBottomElevationMeters: params.courseBottomElevationMeters,
        physicalHeightMeters: params.physicalHeightMeters,
        blockType: clippedBlock.blockType,
        kind: clippedBlock.kind,
        source: params.source,
      }),
    );
    moduleIndex += 1;
    if (clippedBlock.blockType === 'full') {
      params.counters.full += 1;
    } else if (clippedBlock.blockType === 'half') {
      params.counters.half += 1;
    } else {
      params.counters.cut += 1;
    }
  }

  return blocks;
}
