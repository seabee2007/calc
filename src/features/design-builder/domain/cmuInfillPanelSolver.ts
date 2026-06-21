import type {
  CmuInfillPanel,
  CmuWallSystemParameters,
  DesignWallLayoutParameters,
  StructuralBeam,
  StructuralColumn,
} from '../types';
import { resolveCmuModuleDefinition } from './cmuModuleRules';
import {
  infillPanelFromResolvedBounds,
  logInfillPanelBoundsTableForDev,
  resolveInfillPanelBoundsForLayout,
  resolveInfillPanelBoundsForSegment,
  type ResolvedInfillPanelBounds,
} from './infillPanelBoundsResolver';
import type { CmuBlockInstance, CmuUnitPlacement, SegmentFrame } from '../geometry/designGeometry';

export const FRAME_INFILL_HEIGHT_TOLERANCE_METERS = 0.002;
export const TOP_COURSE_RENDER_EPSILON_METERS = 0.001;
export const TOP_CLOSURE_PRACTICAL_MIN_HEIGHT_METERS = 0.05;

export type InfillPanelSolveResult = {
  panel: CmuInfillPanel;
  bounds: ResolvedInfillPanelBounds;
  blocks: CmuBlockInstance[];
  fullBlockCount: number;
  halfBlockCount: number;
  cutBlockCount: number;
  topClosureCutBlockCount: number;
  firstCmuStartStation: number;
  lastCmuEndStation: number;
  warnings: string[];
};

function panelId(segmentId: string, index: number): string {
  return `infill-${segmentId}-${index}`;
}

export function resolvePanelVerticalCourses(params: {
  panelBottomElevationMeters: number;
  panelTopElevationMeters: number;
  nominalCourseHeightMeters: number;
}): {
  clearPanelHeightMeters: number;
  fullCourseCount: number;
  topClosureHeightMeters: number;
  hasTopClosureCourse: boolean;
} {
  const clearPanelHeightMeters = Math.max(
    0,
    params.panelTopElevationMeters - params.panelBottomElevationMeters,
  );
  const fullCourseCount = Math.floor(clearPanelHeightMeters / params.nominalCourseHeightMeters);
  const topClosureHeightMeters =
    clearPanelHeightMeters - fullCourseCount * params.nominalCourseHeightMeters;
  const hasTopClosureCourse = topClosureHeightMeters > FRAME_INFILL_HEIGHT_TOLERANCE_METERS;
  return {
    clearPanelHeightMeters,
    fullCourseCount,
    topClosureHeightMeters,
    hasTopClosureCourse,
  };
}

function blockFromPanelUnit(params: {
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

function layoutHorizontalCourseUnits(params: {
  panel: CmuInfillPanel;
  frame: SegmentFrame;
  courseIndex: number;
  courseBottomElevationMeters: number;
  physicalHeightMeters: number;
  isTopClosure: boolean;
  nominalModule: number;
  actualFull: number;
  halfNominal: number;
  halfActual: number;
  bondPattern: 'running_bond' | 'stack_bond';
  counters: { full: number; half: number; cut: number; topClosure: number };
}): CmuBlockInstance[] {
  const blocks: CmuBlockInstance[] = [];
  const runningBondOffset = params.bondPattern === 'running_bond' && params.courseIndex % 2 === 1;
  let station = params.panel.startStationMeters;
  const panelEnd = params.panel.endStationMeters;
  let moduleIndex = 0;

  const pushBlock = (blockParams: {
    stationMeters: number;
    nominalLengthMeters: number;
    actualLengthMeters: number;
    blockType: CmuBlockInstance['blockType'];
    kind?: CmuUnitPlacement['kind'];
    source?: CmuUnitPlacement['source'];
  }) => {
    blocks.push(
      blockFromPanelUnit({
        panel: params.panel,
        frame: params.frame,
        courseIndex: params.courseIndex,
        moduleIndex,
        stationMeters: blockParams.stationMeters,
        nominalLengthMeters: blockParams.nominalLengthMeters,
        actualLengthMeters: blockParams.actualLengthMeters,
        courseBottomElevationMeters: params.courseBottomElevationMeters,
        physicalHeightMeters: params.physicalHeightMeters,
        blockType: blockParams.blockType,
        kind: params.isTopClosure ? 'cut_height_block' : blockParams.kind,
        source: params.isTopClosure ? 'panel_top_closure' : blockParams.source,
      }),
    );
    moduleIndex += 1;
  };

  if (runningBondOffset && panelEnd - station >= params.halfNominal - 0.005) {
    pushBlock({
      stationMeters: station,
      nominalLengthMeters: params.halfNominal,
      actualLengthMeters: params.halfActual,
      blockType: 'half',
    });
    if (params.isTopClosure) {
      params.counters.topClosure += 1;
    } else {
      params.counters.half += 1;
    }
    station += params.halfNominal;
  }

  while (panelEnd - station > 0.001) {
    const remaining = panelEnd - station;
    if (remaining >= params.nominalModule - 0.005) {
      pushBlock({
        stationMeters: station,
        nominalLengthMeters: params.nominalModule,
        actualLengthMeters: params.actualFull,
        blockType: 'stretcher' as CmuBlockInstance['blockType'],
      });
      if (params.isTopClosure) {
        params.counters.topClosure += 1;
      } else {
        params.counters.full += 1;
      }
      station += params.nominalModule;
    } else if (remaining >= params.halfNominal - 0.005) {
      pushBlock({
        stationMeters: station,
        nominalLengthMeters: params.halfNominal,
        actualLengthMeters: params.halfActual,
        blockType: 'half',
      });
      if (params.isTopClosure) {
        params.counters.topClosure += 1;
      } else {
        params.counters.half += 1;
      }
      station += params.halfNominal;
    } else if (remaining >= 0.05) {
      pushBlock({
        stationMeters: station,
        nominalLengthMeters: remaining,
        actualLengthMeters: remaining,
        blockType: 'cut',
        kind: 'cut_block',
      });
      if (params.isTopClosure) {
        params.counters.topClosure += 1;
      } else {
        params.counters.cut += 1;
      }
      station += remaining;
    } else {
      break;
    }
  }

  const tailRemaining = panelEnd - station;
  if (tailRemaining > 0.001) {
    pushBlock({
      stationMeters: station,
      nominalLengthMeters: tailRemaining,
      actualLengthMeters: tailRemaining,
      blockType: 'cut',
      kind: 'cut_block',
    });
    if (params.isTopClosure) {
      params.counters.topClosure += 1;
    } else {
      params.counters.cut += 1;
    }
  }

  return blocks;
}

export function deriveInfillPanelsForSegment(params: {
  segmentId: string;
  segment: { startNodeId: string; endNodeId: string; wallHeightMeters: number };
  frame: SegmentFrame;
  columns: StructuralColumn[];
  beams: StructuralBeam[];
  wall: CmuWallSystemParameters;
  gradeBeamTopMeters: number;
  ringBeamBaseMeters: number;
  existingPanel?: CmuInfillPanel;
}): CmuInfillPanel[] {
  const bounds = resolveInfillPanelBoundsForSegment({
    panelId: params.existingPanel?.id ?? panelId(params.segmentId, 0),
    segmentId: params.segmentId,
    segment: params.segment,
    frame: params.frame,
    columns: params.columns,
    beams: params.beams,
    gradeBeamTopMeters: params.gradeBeamTopMeters,
    ringBeamBaseMeters: params.ringBeamBaseMeters,
  });
  if (!bounds) return [];
  return [
    infillPanelFromResolvedBounds({
      bounds,
      wall: params.wall,
      beams: params.beams,
      existingPanel: params.existingPanel,
    }),
  ];
}

export function deriveInfillPanelsForLayout(params: {
  layout: DesignWallLayoutParameters;
  segmentFrames: SegmentFrame[];
  columns: StructuralColumn[];
  beams: StructuralBeam[];
  wall: CmuWallSystemParameters;
  existingPanels?: readonly CmuInfillPanel[];
}): CmuInfillPanel[] {
  const resolvedBounds = resolveInfillPanelBoundsForLayout({
    layout: params.layout,
    segmentFrames: params.segmentFrames,
    columns: params.columns,
    beams: params.beams,
  });
  return resolvedBounds.map((bounds) => {
    const existingPanel = params.existingPanels?.find((panel) => panel.hostSegmentId === bounds.hostSegmentId);
    return infillPanelFromResolvedBounds({
      bounds,
      wall: params.wall,
      beams: params.beams,
      existingPanel,
    });
  });
}

export function resolveInfillPanelsWithBounds(params: {
  layout: DesignWallLayoutParameters;
  segmentFrames: SegmentFrame[];
  columns: StructuralColumn[];
  beams: StructuralBeam[];
  wall: CmuWallSystemParameters;
  existingPanels?: readonly CmuInfillPanel[];
}): Array<{ panel: CmuInfillPanel; bounds: ResolvedInfillPanelBounds }> {
  const resolvedBounds = resolveInfillPanelBoundsForLayout({
    layout: params.layout,
    segmentFrames: params.segmentFrames,
    columns: params.columns,
    beams: params.beams,
  });
  return resolvedBounds.map((bounds) => ({
    bounds,
    panel: infillPanelFromResolvedBounds({
      bounds,
      wall: params.wall,
      beams: params.beams,
      existingPanel: params.existingPanels?.find((panel) => panel.hostSegmentId === bounds.hostSegmentId),
    }),
  }));
}

export function solveInfillPanelBlocks(params: {
  panel: CmuInfillPanel;
  bounds: ResolvedInfillPanelBounds;
  frame: SegmentFrame;
  wall: CmuWallSystemParameters;
  logBoundsForDev?: boolean;
}): InfillPanelSolveResult {
  const module = resolveCmuModuleDefinition(params.wall);
  const nominalModule = module.nominalModuleLengthMeters;
  const actualFull = module.actualFullBlockLengthMeters;
  const halfNominal = nominalModule / 2;
  const halfActual = actualFull / 2;
  const bondPattern = params.panel.masonrySettings.bondPattern ?? 'running_bond';
  const blocks: CmuBlockInstance[] = [];
  const counters = { full: 0, half: 0, cut: 0, topClosure: 0 };
  const warnings: string[] = [];

  const vertical = resolvePanelVerticalCourses({
    panelBottomElevationMeters: params.panel.bottomElevationMeters,
    panelTopElevationMeters: params.panel.topElevationMeters,
    nominalCourseHeightMeters: module.nominalModuleHeightMeters,
  });

  if (
    vertical.hasTopClosureCourse &&
    vertical.topClosureHeightMeters < TOP_CLOSURE_PRACTICAL_MIN_HEIGHT_METERS
  ) {
    warnings.push(
      `Top CMU closure course is under ${TOP_CLOSURE_PRACTICAL_MIN_HEIGHT_METERS} m high on panel ${params.panel.id}. Review beam elevation or masonry course layout.`,
    );
  }

  const courseCount =
    vertical.fullCourseCount + (vertical.hasTopClosureCourse ? 1 : 0);

  for (let courseIndex = 0; courseIndex < courseCount; courseIndex += 1) {
    const isTopClosure = vertical.hasTopClosureCourse && courseIndex === vertical.fullCourseCount;
    const courseBottomElevationMeters =
      params.panel.bottomElevationMeters +
      courseIndex * module.nominalModuleHeightMeters;
    const physicalHeightMeters = isTopClosure
      ? vertical.topClosureHeightMeters
      : module.actualBlockHeightMeters;

    if (isTopClosure) {
      const courseTop = courseBottomElevationMeters + physicalHeightMeters;
      if (courseTop > params.panel.topElevationMeters + FRAME_INFILL_HEIGHT_TOLERANCE_METERS) {
        warnings.push(
          `Top CMU closure course on panel ${params.panel.id} exceeds ring beam underside by ${(courseTop - params.panel.topElevationMeters).toFixed(3)} m.`,
        );
      }
    }

    blocks.push(
      ...layoutHorizontalCourseUnits({
        panel: params.panel,
        frame: params.frame,
        courseIndex,
        courseBottomElevationMeters,
        physicalHeightMeters,
        isTopClosure,
        nominalModule,
        actualFull,
        halfNominal,
        halfActual,
        bondPattern,
        counters,
      }),
    );
  }

  const firstCmuStartStation =
    blocks.length > 0 ? Math.min(...blocks.map((block) => block.stationMeters ?? 0)) : params.panel.startStationMeters;
  const lastCmuEndStation =
    blocks.length > 0
      ? Math.max(...blocks.map((block) => block.endAlongMeters ?? (block.stationMeters ?? 0) + block.lengthMeters))
      : params.panel.endStationMeters;

  if (params.logBoundsForDev) {
    logInfillPanelBoundsTableForDev(params.bounds, firstCmuStartStation, lastCmuEndStation);
  }

  return {
    panel: params.panel,
    bounds: params.bounds,
    blocks,
    fullBlockCount: counters.full,
    halfBlockCount: counters.half,
    cutBlockCount: counters.cut,
    topClosureCutBlockCount: counters.topClosure,
    firstCmuStartStation,
    lastCmuEndStation,
    warnings,
  };
}

export function panelClearWidthMeters(panel: CmuInfillPanel): number {
  return Math.max(0, panel.endStationMeters - panel.startStationMeters);
}

export function panelClearAreaSquareMeters(panel: CmuInfillPanel): number {
  return panelClearWidthMeters(panel) * Math.max(0, panel.topElevationMeters - panel.bottomElevationMeters);
}
