import type { CmuInfillPanel, CmuWallSystemParameters, ResolvedRoofSystem, RoofSystemSettings } from '../types';
import type { CmuBlockInstance, SegmentFrame } from '../geometry/designGeometry';
import { resolveCmuModuleDefinition } from './cmuModuleRules';
import {
  layoutHorizontalCourseUnitsForInterval,
  type CourseLayoutCounters,
} from './cmuCourseLayoutEngine';
import {
  allowedMasonryTopYAtStation,
  GABLE_HEIGHT_TOLERANCE_METERS,
} from './roofGableSolver';
import { resolvePanelVerticalCourses } from './cmuInfillPanelSolver';

export type GableMasonryCourseDebug = {
  courseIndex: number;
  availableWidthMeters: number;
  fullUnits: number;
  halfUnits: number;
  cutUnits: number;
  bondOffsetMeters: number;
  intervalStartMeters: number;
  intervalEndMeters: number;
};

export type GableMasonrySolveResult = {
  blocks: CmuBlockInstance[];
  layoutDebug: GableMasonryCourseDebug[];
  warnings: string[];
  fullBlockCount: number;
  halfBlockCount: number;
  cutBlockCount: number;
};

export function masonryCeilingYAtStation(params: {
  resolvedRoof: ResolvedRoofSystem;
  frame: SegmentFrame;
  stationMeters: number;
  panelStartStation: number;
  panelEndStation: number;
  minRakeCapDepthMeters: number;
  roofSystem?: RoofSystemSettings;
}): number {
  return allowedMasonryTopYAtStation(params);
}

export function resolveGableCourseInterval(params: {
  courseTopY: number;
  panelStartStation: number;
  panelEndStation: number;
  ridgeStationMeters: number;
  resolvedRoof: ResolvedRoofSystem;
  frame: SegmentFrame;
  minRakeCapDepthMeters: number;
  roofSystem?: RoofSystemSettings;
}): { startMeters: number; endMeters: number } | null {
  const peakCeiling = allowedMasonryTopYAtStation({
    resolvedRoof: params.resolvedRoof,
    roofSystem: params.roofSystem,
    frame: params.frame,
    stationMeters: params.ridgeStationMeters,
    panelStartStation: params.panelStartStation,
    panelEndStation: params.panelEndStation,
    minRakeCapDepthMeters: params.minRakeCapDepthMeters,
  });
  if (params.courseTopY > peakCeiling + GABLE_HEIGHT_TOLERANCE_METERS) {
    return null;
  }

  const eaveCeiling = allowedMasonryTopYAtStation({
    resolvedRoof: params.resolvedRoof,
    roofSystem: params.roofSystem,
    frame: params.frame,
    stationMeters: params.panelStartStation,
    panelStartStation: params.panelStartStation,
    panelEndStation: params.panelEndStation,
    minRakeCapDepthMeters: params.minRakeCapDepthMeters,
  });
  const halfRun = Math.max(0.001, (params.panelEndStation - params.panelStartStation) / 2);
  const ceilingDrop = peakCeiling - eaveCeiling;
  if (ceilingDrop <= 0.001) {
    return null;
  }

  const distFromCenter = halfRun * ((peakCeiling - params.courseTopY) / ceilingDrop);
  if (!Number.isFinite(distFromCenter) || distFromCenter <= 0.001) {
    return null;
  }

  const intervalStart = Math.max(params.panelStartStation, params.ridgeStationMeters - distFromCenter);
  const intervalEnd = Math.min(params.panelEndStation, params.ridgeStationMeters + distFromCenter);
  if (intervalEnd - intervalStart <= 0.01) {
    return null;
  }

  return { startMeters: intervalStart, endMeters: intervalEnd };
}

export function solveGableEndMasonryBlocks(params: {
  panel: CmuInfillPanel;
  frame: SegmentFrame;
  wall: CmuWallSystemParameters;
  roofSystem: RoofSystemSettings;
  resolvedRoof: ResolvedRoofSystem;
  roofBeamTopElevationMeters: number;
}): GableMasonrySolveResult {
  if (!params.roofSystem.gable.enabled || params.roofSystem.roofType !== 'gable') {
    return {
      blocks: [],
      layoutDebug: [],
      warnings: [],
      fullBlockCount: 0,
      halfBlockCount: 0,
      cutBlockCount: 0,
    };
  }

  const module = resolveCmuModuleDefinition(params.wall);
  const bondPattern = params.panel.masonrySettings.bondPattern ?? 'running_bond';
  const bondDatumStationMeters = params.panel.startStationMeters;
  const ridgeStationMeters = (params.panel.startStationMeters + params.panel.endStationMeters) / 2;
  const minRakeCapDepthMeters = params.roofSystem.gable.rakeClearanceMeters;
  const counters: CourseLayoutCounters = { full: 0, half: 0, cut: 0, topClosure: 0 };
  const warnings: string[] = [];
  const layoutDebug: GableMasonryCourseDebug[] = [];
  const blocks: CmuBlockInstance[] = [];

  const verticalBelowBeam = resolvePanelVerticalCourses({
    panelBottomElevationMeters: params.panel.bottomElevationMeters,
    panelTopElevationMeters: params.roofBeamTopElevationMeters,
    nominalCourseHeightMeters: module.nominalModuleHeightMeters,
  });
  const firstGableCourseIndex = verticalBelowBeam.fullCourseCount;
  const physicalHeightMeters = module.actualBlockHeightMeters;
  const maxCourses = Math.ceil(
    (params.resolvedRoof.peakElevationMeters - params.roofBeamTopElevationMeters) /
      module.nominalModuleHeightMeters,
  );

  for (let offset = 0; offset < maxCourses; offset += 1) {
    const courseIndex = firstGableCourseIndex + offset;
    const courseBottomElevationMeters =
      params.panel.bottomElevationMeters + courseIndex * module.nominalModuleHeightMeters;
    const courseTopY = courseBottomElevationMeters + physicalHeightMeters;
    const interval = resolveGableCourseInterval({
      courseTopY,
      panelStartStation: params.panel.startStationMeters,
      panelEndStation: params.panel.endStationMeters,
      ridgeStationMeters,
      resolvedRoof: params.resolvedRoof,
      frame: params.frame,
      minRakeCapDepthMeters,
      roofSystem: params.roofSystem,
    });
    if (!interval) {
      break;
    }

    const courseCounters: CourseLayoutCounters = { full: 0, half: 0, cut: 0, topClosure: 0 };
    const courseBlocks = layoutHorizontalCourseUnitsForInterval({
      panel: params.panel,
      frame: params.frame,
      courseIndex,
      courseBottomElevationMeters,
      physicalHeightMeters,
      intervalStartMeters: interval.startMeters,
      intervalEndMeters: interval.endMeters,
      nominalModuleMeters: module.nominalModuleLengthMeters,
      actualFullLengthMeters: module.actualFullBlockLengthMeters,
      halfNominalMeters: module.nominalModuleLengthMeters / 2,
      halfActualLengthMeters: module.actualFullBlockLengthMeters / 2,
      bondPattern,
      bondDatumStationMeters,
      counters: courseCounters,
      source: 'gable_end_solver',
      warnings,
    });

    for (const block of courseBlocks) {
      const blockHeight = block.physicalHeightMeters ?? block.heightMeters ?? physicalHeightMeters;
      const topY = block.y + blockHeight / 2;
      const startStation = block.stationMeters ?? block.startAlongMeters ?? 0;
      const endStation = block.endAlongMeters ?? startStation + (block.nominalLengthMeters ?? block.lengthMeters);
      const ceilingStart = masonryCeilingYAtStation({
        resolvedRoof: params.resolvedRoof,
        frame: params.frame,
        stationMeters: startStation,
        panelStartStation: params.panel.startStationMeters,
        panelEndStation: params.panel.endStationMeters,
        minRakeCapDepthMeters,
        roofSystem: params.roofSystem,
      });
      const ceilingEnd = masonryCeilingYAtStation({
        resolvedRoof: params.resolvedRoof,
        frame: params.frame,
        stationMeters: endStation,
        panelStartStation: params.panel.startStationMeters,
        panelEndStation: params.panel.endStationMeters,
        minRakeCapDepthMeters,
        roofSystem: params.roofSystem,
      });
      if (
        topY > ceilingStart + GABLE_HEIGHT_TOLERANCE_METERS + 0.01 ||
        topY > ceilingEnd + GABLE_HEIGHT_TOLERANCE_METERS + 0.01
      ) {
        throw new Error('Gable CMU block crosses the required rake-cap boundary.');
      }
    }

    blocks.push(...courseBlocks);
    counters.full += courseCounters.full;
    counters.half += courseCounters.half;
    counters.cut += courseCounters.cut;

    layoutDebug.push({
      courseIndex,
      availableWidthMeters: interval.endMeters - interval.startMeters,
      fullUnits: courseCounters.full,
      halfUnits: courseCounters.half,
      cutUnits: courseCounters.cut,
      bondOffsetMeters: courseIndex % 2 === 1 ? module.nominalModuleLengthMeters / 2 : 0,
      intervalStartMeters: interval.startMeters,
      intervalEndMeters: interval.endMeters,
    });
  }

  return {
    blocks,
    layoutDebug,
    warnings,
    fullBlockCount: counters.full,
    halfBlockCount: counters.half,
    cutBlockCount: counters.cut,
  };
}
