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
import {
  resolvePanelVerticalCourses,
  TOP_CLOSURE_PRACTICAL_MIN_HEIGHT_METERS,
} from './cmuInfillPanelSolver';

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

type GableRidgeStationFrame =
  Pick<SegmentFrame, 'lengthMeters'> &
  Partial<Pick<SegmentFrame, 'centerlineStart' | 'centerlineEnd' | 'tangent'>>;

function projectPointToFrameStation(
  point: { x: number; z: number },
  frame: GableRidgeStationFrame,
): number | null {
  if (!frame.centerlineStart || !frame.tangent) {
    return null;
  }

  return (
    (point.x - frame.centerlineStart.x) * frame.tangent.x +
    (point.z - frame.centerlineStart.z) * frame.tangent.z
  );
}

function centerlineLengthMeters(frame: GableRidgeStationFrame): number {
  if (frame.centerlineStart && frame.centerlineEnd) {
    return Math.hypot(
      frame.centerlineEnd.x - frame.centerlineStart.x,
      frame.centerlineEnd.z - frame.centerlineStart.z,
    );
  }

  return frame.lengthMeters;
}

export function resolveGableRidgeStationMeters(params: {
  frame: GableRidgeStationFrame;
  resolvedRoof?: Pick<
    ResolvedRoofSystem,
    | 'claddingRidgeStart'
    | 'claddingRidgeEnd'
    | 'structuralRidgeStart'
    | 'structuralRidgeEnd'
    | 'ridgeStart'
    | 'ridgeEnd'
  >;
}): number {
  const ridgeStart =
    params.resolvedRoof?.claddingRidgeStart ??
    params.resolvedRoof?.structuralRidgeStart ??
    params.resolvedRoof?.ridgeStart;
  const ridgeEnd =
    params.resolvedRoof?.claddingRidgeEnd ??
    params.resolvedRoof?.structuralRidgeEnd ??
    params.resolvedRoof?.ridgeEnd;

  const projectedStations = [ridgeStart, ridgeEnd]
    .map((point) => (point ? projectPointToFrameStation(point, params.frame) : null))
    .filter((station): station is number => station != null && Number.isFinite(station));

  if (projectedStations.length > 0) {
    return (
      projectedStations.reduce((sum, station) => sum + station, 0) /
      projectedStations.length
    );
  }

  return centerlineLengthMeters(params.frame) / 2;
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
  const leftRunMeters = Math.max(0, params.ridgeStationMeters - params.panelStartStation);
  const rightRunMeters = Math.max(0, params.panelEndStation - params.ridgeStationMeters);
  const ceilingDrop = peakCeiling - eaveCeiling;
  if (ceilingDrop <= 0.001) {
    return null;
  }

  const progress = Math.max(
    0,
    Math.min(1, (peakCeiling - params.courseTopY) / ceilingDrop),
  );
  if (progress <= 0.001) {
    return null;
  }

  const panelStraddlesRidge =
    params.panelStartStation < params.ridgeStationMeters &&
    params.panelEndStation > params.ridgeStationMeters;
  const mirroredRunMeters = panelStraddlesRidge
    ? Math.min(leftRunMeters, rightRunMeters)
    : Math.max(leftRunMeters, rightRunMeters);
  const leftHalfSpanMeters = mirroredRunMeters * progress;
  const rightHalfSpanMeters = mirroredRunMeters * progress;

  const intervalStart = panelStraddlesRidge
    ? Math.max(params.panelStartStation, params.ridgeStationMeters - leftHalfSpanMeters)
    : params.ridgeStationMeters - leftHalfSpanMeters;
  const intervalEnd = panelStraddlesRidge
    ? Math.min(params.panelEndStation, params.ridgeStationMeters + rightHalfSpanMeters)
    : params.ridgeStationMeters + rightHalfSpanMeters;
  if (intervalEnd - intervalStart <= 0.01) {
    return null;
  }

  return { startMeters: intervalStart, endMeters: intervalEnd };
}

function resolveGableTopClosureCourse(params: {
  courseBottomElevationMeters: number;
  physicalHeightMeters: number;
  nominalModuleMeters: number;
  panelStartStation: number;
  panelEndStation: number;
  ridgeStationMeters: number;
  resolvedRoof: ResolvedRoofSystem;
  frame: SegmentFrame;
  minRakeCapDepthMeters: number;
  roofSystem?: RoofSystemSettings;
}): { courseTopY: number; physicalHeightMeters: number } | null {
  const peakCeiling = allowedMasonryTopYAtStation({
    resolvedRoof: params.resolvedRoof,
    roofSystem: params.roofSystem,
    frame: params.frame,
    stationMeters: params.ridgeStationMeters,
    panelStartStation: params.panelStartStation,
    panelEndStation: params.panelEndStation,
    minRakeCapDepthMeters: params.minRakeCapDepthMeters,
  });
  const eaveCeiling = allowedMasonryTopYAtStation({
    resolvedRoof: params.resolvedRoof,
    roofSystem: params.roofSystem,
    frame: params.frame,
    stationMeters: params.panelStartStation,
    panelStartStation: params.panelStartStation,
    panelEndStation: params.panelEndStation,
    minRakeCapDepthMeters: params.minRakeCapDepthMeters,
  });
  const leftRunMeters = Math.max(0, params.ridgeStationMeters - params.panelStartStation);
  const rightRunMeters = Math.max(0, params.panelEndStation - params.ridgeStationMeters);
  const limitingRunMeters = Math.min(leftRunMeters, rightRunMeters);
  const ceilingDrop = peakCeiling - eaveCeiling;
  if (limitingRunMeters <= 0.001 || ceilingDrop <= 0.001) {
    return null;
  }

  const desiredTopClosureWidthMeters = Math.min(
    params.nominalModuleMeters,
    Math.max(0, params.panelEndStation - params.panelStartStation),
  );
  const desiredHalfSpanMeters = Math.min(limitingRunMeters, desiredTopClosureWidthMeters / 2);
  const topDropForClosureWidthMeters =
    ceilingDrop * (desiredHalfSpanMeters / limitingRunMeters);
  const courseTopY = Math.min(
    params.courseBottomElevationMeters + params.physicalHeightMeters,
    peakCeiling - topDropForClosureWidthMeters,
  );
  const closureHeightMeters = courseTopY - params.courseBottomElevationMeters;
  if (closureHeightMeters <= GABLE_HEIGHT_TOLERANCE_METERS) {
    return null;
  }

  return { courseTopY, physicalHeightMeters: closureHeightMeters };
}

export function solveGableEndMasonryBlocks(params: {
  panel: CmuInfillPanel;
  frame: SegmentFrame;
  wall: CmuWallSystemParameters;
  roofSystem: RoofSystemSettings;
  resolvedRoof: ResolvedRoofSystem;
  roofBeamTopElevationMeters: number;
  infillCenterlineInwardOffsetMeters?: number;
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
  const ridgeStationMeters = resolveGableRidgeStationMeters({
    frame: params.frame,
    resolvedRoof: params.resolvedRoof,
  });
  const minRakeCapDepthMeters = params.roofSystem.gable.rakeClearanceMeters;
  const counters: CourseLayoutCounters = { full: 0, half: 0, cut: 0, topClosure: 0 };
  const warnings: string[] = [];
  const layoutDebug: GableMasonryCourseDebug[] = [];
  const blocks: CmuBlockInstance[] = [];

  const gableBandBaseElevationMeters = params.roofBeamTopElevationMeters;
  const verticalBelowGableBase = resolvePanelVerticalCourses({
    panelBottomElevationMeters: params.panel.bottomElevationMeters,
    panelTopElevationMeters: gableBandBaseElevationMeters,
    nominalCourseHeightMeters: module.nominalModuleHeightMeters,
  });
  const firstGableCourseIndex =
    verticalBelowGableBase.fullCourseCount +
    (verticalBelowGableBase.hasTopClosureCourse ? 1 : 0);
  const physicalHeightMeters = module.actualBlockHeightMeters;
  const maxCourses = Math.ceil(
    (params.resolvedRoof.peakElevationMeters - gableBandBaseElevationMeters) /
      module.nominalModuleHeightMeters,
  );
  const bondDatumStationMeters = params.panel.startStationMeters;

  for (let offset = 0; offset < maxCourses; offset += 1) {
    const courseIndex = firstGableCourseIndex + offset;
    const courseBottomElevationMeters =
      gableBandBaseElevationMeters + offset * module.nominalModuleHeightMeters;
    const courseTopY = courseBottomElevationMeters + physicalHeightMeters;
    let resolvedCourseTopY = courseTopY;
    let resolvedPhysicalHeightMeters = physicalHeightMeters;
    let isTopClosure = false;
    let interval = resolveGableCourseInterval({
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
      const topClosure = resolveGableTopClosureCourse({
        courseBottomElevationMeters,
        physicalHeightMeters,
        nominalModuleMeters: module.nominalModuleLengthMeters,
        panelStartStation: params.panel.startStationMeters,
        panelEndStation: params.panel.endStationMeters,
        ridgeStationMeters,
        resolvedRoof: params.resolvedRoof,
        frame: params.frame,
        minRakeCapDepthMeters,
        roofSystem: params.roofSystem,
      });
      if (!topClosure) {
        break;
      }
      resolvedCourseTopY = topClosure.courseTopY;
      resolvedPhysicalHeightMeters = topClosure.physicalHeightMeters;
      isTopClosure = true;
      interval = resolveGableCourseInterval({
        courseTopY: resolvedCourseTopY,
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
      if (resolvedPhysicalHeightMeters < TOP_CLOSURE_PRACTICAL_MIN_HEIGHT_METERS) {
        warnings.push(
          `Gable CMU top closure course is under ${TOP_CLOSURE_PRACTICAL_MIN_HEIGHT_METERS.toFixed(2)} m at course ${courseIndex + 1}.`,
        );
      }
    }

    const courseCounters: CourseLayoutCounters = { full: 0, half: 0, cut: 0, topClosure: 0 };
    const courseBlocks = layoutHorizontalCourseUnitsForInterval({
      panel: params.panel,
      frame: params.frame,
      courseIndex,
      courseBottomElevationMeters,
      physicalHeightMeters: resolvedPhysicalHeightMeters,
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
      isTopClosure,
      infillCenterlineInwardOffsetMeters: params.infillCenterlineInwardOffsetMeters,
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
    counters.cut += courseCounters.cut + courseCounters.topClosure;

    layoutDebug.push({
      courseIndex,
      availableWidthMeters: interval.endMeters - interval.startMeters,
      fullUnits: courseCounters.full,
      halfUnits: courseCounters.half,
      cutUnits: courseCounters.cut + courseCounters.topClosure,
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
