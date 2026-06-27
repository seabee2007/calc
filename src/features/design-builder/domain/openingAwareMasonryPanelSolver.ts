import type { CmuInfillPanel, CmuWallSystemParameters } from '../types';
import type { ResolvedCmuOpening } from './cmuOpeningRules';
import { resolveCmuModuleDefinition } from './cmuModuleRules';
import type { CmuBlockInstance, SegmentFrame } from '../geometry/designGeometry';
import type { PartitionWallCourseJoinTrim } from './partitionWallJoinRules';
import {
  blockOverlapsOpeningAssembly,
  buildLayoutLintelSolidPlacements,
  lintelSolidToInstance,
  resolveLintelModuleSpan,
  resolveUnitSegmentsAroundOpenings,
  type OpeningUnitSplitSegment,
  type ResolvedLintelSpan,
} from './openingAssemblySolver';
import {
  classifyClosureGapLength,
  closureClassificationToBlockType,
} from './openingCourseClosureSolver';
import {
  classifyLintelClosureKind,
  deriveLintelGapClosuresFromPlacedBlocks,
  lintelCourseClosureToBlockType,
} from './lintelCourseClosureSolver';
import {
  blockFromPanelUnit,
  buildRunningBondModuleGrid,
  clipGridCellsToInterval,
  type ClippedCourseBlock,
  type CourseLayoutCounters,
} from './cmuCourseLayoutEngine';

const FRAME_INFILL_HEIGHT_TOLERANCE_METERS = 0.002;
const TOP_CLOSURE_PRACTICAL_MIN_HEIGHT_METERS = 0.05;

function resolvePanelVerticalCourses(params: {
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

export type OpeningAwareMasonryPanelKind = 'bearing_wall_segment' | 'rc_frame_infill';

function partitionCourseEndpointTrimMeters(
  endpoint: PartitionWallCourseJoinTrim['start'] | PartitionWallCourseJoinTrim['end'],
  courseIndex: number,
): number {
  if (!endpoint) return 0;
  const courseParity = (courseIndex % 2) as 0 | 1;
  return courseParity === endpoint.ownerCourseParity ? 0 : endpoint.trimMeters;
}

export type OpeningAwareMasonryPanelResult = {
  blocks: CmuBlockInstance[];
  lintels: ReturnType<typeof lintelSolidToInstance>[];
  warnings: string[];
  counts: CourseLayoutCounters;
  panelAdjustedOpenings: ResolvedCmuOpening[];
};

export function panelAdjustedOpeningsForElevation(
  openings: readonly ResolvedCmuOpening[],
  panelBottomElevationMeters: number,
): ResolvedCmuOpening[] {
  if (panelBottomElevationMeters === 0) {
    return openings.map((opening) => ({ ...opening }));
  }
  return openings.map((opening) => ({
    ...opening,
    actualBottomMeters: opening.actualBottomMeters + panelBottomElevationMeters,
    actualTopMeters: opening.actualTopMeters + panelBottomElevationMeters,
    roughBottomMeters: opening.roughBottomMeters + panelBottomElevationMeters,
    roughTopMeters: opening.roughTopMeters + panelBottomElevationMeters,
  }));
}

/** RC infill masonry trims to the door/window frame, not the module-snapped rough opening. */
export function openingsForFrameFitMasonry(
  openings: readonly ResolvedCmuOpening[],
): ResolvedCmuOpening[] {
  return openings.map((opening) => ({
    ...opening,
    roughStartAlongMeters: opening.actualStartAlongMeters,
    roughEndAlongMeters: opening.actualEndAlongMeters,
    roughOpeningWidthMeters: opening.actualWidthMeters,
    roughBottomMeters: opening.actualBottomMeters,
    roughTopMeters: opening.actualTopMeters,
    roughOpeningHeightMeters: opening.actualHeightMeters,
  }));
}

function blockTypeForOpeningSegment(
  segment: OpeningUnitSplitSegment,
  moduleLengthMeters: number,
  defaultBlockType: ClippedCourseBlock['blockType'],
): ClippedCourseBlock['blockType'] {
  if (segment.source !== 'opening_jamb_closure') {
    return defaultBlockType;
  }
  const classification = classifyClosureGapLength(segment.lengthMeters, moduleLengthMeters, false);
  return closureClassificationToBlockType(classification) ?? 'cut';
}

function actualLengthForOpeningSegment(
  segment: OpeningUnitSplitSegment,
  unitActualLengthMeters: number,
): number {
  return segment.source === 'opening_jamb_closure' ? segment.lengthMeters : unitActualLengthMeters;
}

function openingCourseIndexFromElevation(
  courseBottomElevationMeters: number,
  nominalModuleHeightMeters: number,
  panelBottomElevationMeters: number,
  courseIndexOffset: number,
): number {
  return (
    Math.floor(
      (courseBottomElevationMeters - panelBottomElevationMeters) /
        Math.max(0.01, nominalModuleHeightMeters) +
        1e-9,
    ) + courseIndexOffset
  );
}

function buildResolvedLintelSpanMap(
  openings: readonly ResolvedCmuOpening[],
  moduleLengthMeters: number,
  wallLengthMeters: number,
): Map<string, ResolvedLintelSpan> {
  return new Map(
    openings.map((opening) => [
      opening.id,
      resolveLintelModuleSpan(opening, moduleLengthMeters, wallLengthMeters),
    ]),
  );
}

function countFinalPanelBlocks(blocks: readonly CmuBlockInstance[]): CourseLayoutCounters {
  const counts: CourseLayoutCounters = { full: 0, half: 0, cut: 0, topClosure: 0 };
  blocks.forEach((block) => {
    if (block.source === 'panel_top_closure') {
      counts.topClosure += 1;
    } else if (block.blockType === 'full') {
      counts.full += 1;
    } else if (block.blockType === 'half') {
      counts.half += 1;
    } else if (block.blockType === 'cut') {
      counts.cut += 1;
    }
  });
  return counts;
}

function courseBottomElevationForIndex(params: {
  courseIndex: number;
  panelBottomElevationMeters: number;
  courseIndexOffset: number;
  nominalModuleHeightMeters: number;
}): number {
  return (
    params.panelBottomElevationMeters +
    (params.courseIndex - params.courseIndexOffset) * params.nominalModuleHeightMeters
  );
}

function buildLintelCourseClosureBlocks(params: {
  panel: CmuInfillPanel;
  frame: SegmentFrame;
  panelStartStationMeters: number;
  panelEndStationMeters: number;
  panelBottomElevationMeters: number;
  courseIndexOffset: number;
  nominalModuleLengthMeters: number;
  nominalModuleHeightMeters: number;
  actualBlockHeightMeters: number;
  openings: readonly ResolvedCmuOpening[];
  lintelSolids: ReturnType<typeof buildLayoutLintelSolidPlacements>;
  placedBlocks: readonly CmuBlockInstance[];
  infillCenterlineInwardOffsetMeters?: number;
}): CmuBlockInstance[] {
  const lintelSolidsByOpeningId = new Map(
    params.lintelSolids.map((lintel) => [lintel.openingId, lintel]),
  );

  return params.openings.flatMap((opening) => {
    if (opening.lintelType === 'none') return [];
    const lintel = lintelSolidsByOpeningId.get(opening.id);
    if (!lintel) return [];

    const neighboringLintels = params.lintelSolids.filter(
      (candidate) => candidate.openingId !== opening.id && candidate.courseIndex === lintel.courseIndex,
    );
    const wallRunStartMeters = Math.max(
      params.panelStartStationMeters,
      ...neighboringLintels
        .filter((candidate) => candidate.endAlongMeters <= lintel.startAlongMeters)
        .map((candidate) => candidate.endAlongMeters),
    );
    const wallRunEndMeters = Math.min(
      params.panelEndStationMeters,
      ...neighboringLintels
        .filter((candidate) => candidate.startAlongMeters >= lintel.endAlongMeters)
        .map((candidate) => candidate.startAlongMeters),
    );

    const placedCourseBlocks = params.placedBlocks
      .filter((block) => (block.courseIndex ?? block.course ?? 0) === lintel.courseIndex)
      .map((block) => {
        const startAlongMeters = block.startAlongMeters ?? block.stationMeters ?? 0;
        return {
          startAlongMeters,
          endAlongMeters:
            block.endAlongMeters ??
            startAlongMeters + (block.actualLengthMeters ?? block.lengthMeters),
        };
      });

    const { leftTrims, rightTrims } = deriveLintelGapClosuresFromPlacedBlocks({
      placedBlocks: placedCourseBlocks,
      lintelStartMeters: lintel.startAlongMeters,
      lintelEndMeters: lintel.endAlongMeters,
      wallRunStartMeters,
      wallRunEndMeters,
    });
    const courseBottomElevationMeters = courseBottomElevationForIndex({
      courseIndex: lintel.courseIndex,
      panelBottomElevationMeters: params.panelBottomElevationMeters,
      courseIndexOffset: params.courseIndexOffset,
      nominalModuleHeightMeters: params.nominalModuleHeightMeters,
    });

    return [...leftTrims, ...rightTrims].map((trim, index) => {
      const kind = classifyLintelClosureKind(trim.lengthMeters, params.nominalModuleLengthMeters);
      const blockType = lintelCourseClosureToBlockType(kind);
      const side = trim.adjacentTo === 'lintel_start' ? 'left' : 'right';
      const block = blockFromPanelUnit({
        panel: params.panel,
        frame: params.frame,
        courseIndex: lintel.courseIndex,
        moduleIndex: index,
        stationMeters: trim.startAlongMeters,
        nominalLengthMeters: trim.lengthMeters,
        actualLengthMeters: trim.lengthMeters,
        courseBottomElevationMeters,
        physicalHeightMeters: params.actualBlockHeightMeters,
        blockType,
        kind: kind === 'full_block' ? 'stretcher' : kind,
        source: 'lintel_closure',
        infillCenterlineInwardOffsetMeters: params.infillCenterlineInwardOffsetMeters,
      });

      return {
        ...block,
        id: `${params.panel.id}-lintel-closure-${opening.id}-${side}-c${lintel.courseIndex}`,
        unitType: blockType === 'full' ? 'full' : blockType === 'half' ? 'half' : 'cut',
        nearOpeningId: opening.id,
        closureRole: side === 'left' ? 'lintel_left_bearing' : 'lintel_right_bearing',
      };
    });
  });
}

function blockOverlapsAnyOpeningAssembly(params: {
  block: CmuBlockInstance;
  openings: readonly ResolvedCmuOpening[];
  courseBottomElevationMeters: number;
  physicalHeightMeters: number;
  nominalModuleHeightMeters: number;
  nominalModuleLengthMeters: number;
  wallLengthMeters: number;
  resolvedLintelSpans: ReadonlyMap<string, ResolvedLintelSpan>;
  panelBottomElevationMeters: number;
  courseIndexOffset: number;
}): boolean {
  const courseIndex = openingCourseIndexFromElevation(
    params.courseBottomElevationMeters,
    params.nominalModuleHeightMeters,
    params.panelBottomElevationMeters,
    params.courseIndexOffset,
  );
  const courseBottomMeters = params.courseBottomElevationMeters;
  const courseTopMeters = courseBottomMeters + params.physicalHeightMeters;
  const startAlongMeters = params.block.startAlongMeters ?? params.block.stationMeters ?? 0;
  const endAlongMeters =
    params.block.endAlongMeters ?? startAlongMeters + (params.block.actualLengthMeters ?? params.block.lengthMeters);

  return params.openings.some((opening) =>
    blockOverlapsOpeningAssembly({
      opening,
      startAlongMeters,
      endAlongMeters,
      courseIndex,
      courseBottomMeters,
      courseTopMeters,
      moduleHeightMeters: params.nominalModuleHeightMeters,
      moduleLengthMeters: params.nominalModuleLengthMeters,
      wallLengthMeters: params.wallLengthMeters,
      resolvedLintelSpans: params.resolvedLintelSpans,
      courseIndexElevationDatumMeters: params.panelBottomElevationMeters,
      courseIndexOffset: params.courseIndexOffset,
    }),
  );
}

export function solveOpeningAwareMasonryPanel(params: {
  panelKind: OpeningAwareMasonryPanelKind;
  panel: CmuInfillPanel;
  frame: SegmentFrame;
  panelStartStationMeters: number;
  panelEndStationMeters: number;
  panelBottomElevationMeters: number;
  panelTopElevationMeters: number;
  openings: readonly ResolvedCmuOpening[];
  wall: CmuWallSystemParameters;
  bondPattern?: 'running_bond' | 'stack_bond';
  courseIndexOffset?: number;
  bondDatumStationMeters?: number;
  infillCenterlineInwardOffsetMeters?: number;
  partitionWallCourseJoinTrim?: PartitionWallCourseJoinTrim;
}): OpeningAwareMasonryPanelResult {
  if (params.panelKind !== 'rc_frame_infill') {
    return {
      blocks: [],
      lintels: [],
      warnings: [`Panel kind ${params.panelKind} is not wired in this implementation phase.`],
      counts: { full: 0, half: 0, cut: 0, topClosure: 0 },
      panelAdjustedOpenings: [],
    };
  }

  const module = resolveCmuModuleDefinition(params.wall);
  const nominalModule = module.nominalModuleLengthMeters;
  const actualFull = module.actualFullBlockLengthMeters;
  const halfNominal = nominalModule / 2;
  const halfActual = actualFull / 2;
  const bondPattern = params.bondPattern ?? params.panel.masonrySettings.bondPattern ?? 'running_bond';
  const courseIndexOffset = params.courseIndexOffset ?? 0;
  const bondDatum = params.bondDatumStationMeters ?? params.panelStartStationMeters;
  const blocks: CmuBlockInstance[] = [];
  const warnings: string[] = [];

  const panelAdjustedOpenings = openingsForFrameFitMasonry(
    panelAdjustedOpeningsForElevation(params.openings, params.panelBottomElevationMeters),
  );
  const resolvedLintelSpans = buildResolvedLintelSpanMap(
    params.openings,
    nominalModule,
    params.frame.lengthMeters,
  );

  const vertical = resolvePanelVerticalCourses({
    panelBottomElevationMeters: params.panelBottomElevationMeters,
    panelTopElevationMeters: params.panelTopElevationMeters,
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

  const courseCount = vertical.fullCourseCount + (vertical.hasTopClosureCourse ? 1 : 0);
  const blockSource =
    params.panel.infillZone === 'below_grade' ? 'below_grade_rc_infill' : 'rc_frame_infill';

  for (let courseIndex = 0; courseIndex < courseCount; courseIndex += 1) {
    const absoluteCourseIndex = courseIndex + courseIndexOffset;
    const isTopClosure = vertical.hasTopClosureCourse && courseIndex === vertical.fullCourseCount;
    const courseBottomElevationMeters =
      params.panelBottomElevationMeters + courseIndex * module.nominalModuleHeightMeters;
    const physicalHeightMeters = isTopClosure
      ? vertical.topClosureHeightMeters
      : module.actualBlockHeightMeters;
    const courseTopElevationMeters = courseBottomElevationMeters + physicalHeightMeters;
    const openingCourseIndex = openingCourseIndexFromElevation(
      courseBottomElevationMeters,
      module.nominalModuleHeightMeters,
      params.panelBottomElevationMeters,
      courseIndexOffset,
    );
    const courseStartTrimMeters = partitionCourseEndpointTrimMeters(
      params.partitionWallCourseJoinTrim?.start,
      absoluteCourseIndex,
    );
    const courseEndTrimMeters = partitionCourseEndpointTrimMeters(
      params.partitionWallCourseJoinTrim?.end,
      absoluteCourseIndex,
    );
    const coursePanelStartStationMeters =
      params.panelStartStationMeters + courseStartTrimMeters;
    const coursePanelEndStationMeters =
      params.panelEndStationMeters - courseEndTrimMeters;
    if (coursePanelEndStationMeters - coursePanelStartStationMeters <= 0.05) {
      warnings.push(
        `Skipped course ${absoluteCourseIndex + 1} on panel ${params.panel.id}; partition corner weave trims exceed clear panel span.`,
      );
      continue;
    }

    if (isTopClosure) {
      if (courseTopElevationMeters > params.panelTopElevationMeters + FRAME_INFILL_HEIGHT_TOLERANCE_METERS) {
        warnings.push(
          `Top CMU closure course on panel ${params.panel.id} exceeds ring beam underside by ${(courseTopElevationMeters - params.panelTopElevationMeters).toFixed(3)} m.`,
        );
      }
    }

    const cells = buildRunningBondModuleGrid({
      bondDatumStationMeters: bondDatum,
      courseIndex: absoluteCourseIndex,
      coverageEndMeters: coursePanelEndStationMeters,
      nominalModuleMeters: nominalModule,
      halfNominalMeters: halfNominal,
      bondPattern,
    });
    const clipped = clipGridCellsToInterval({
      cells,
      intervalStartMeters: coursePanelStartStationMeters,
      intervalEndMeters: coursePanelEndStationMeters,
      nominalModuleMeters: nominalModule,
      halfNominalMeters: halfNominal,
      actualFullLengthMeters: actualFull,
      halfActualLengthMeters: halfActual,
    });

    let moduleIndex = 0;
    for (const clippedBlock of clipped) {
      const segments = resolveUnitSegmentsAroundOpenings({
        startAlongMeters: clippedBlock.stationMeters,
        endAlongMeters: clippedBlock.stationMeters + clippedBlock.nominalLengthMeters,
        openings: panelAdjustedOpenings,
        courseIndex: openingCourseIndex,
        courseBottomMeters: courseBottomElevationMeters,
        courseTopMeters: courseTopElevationMeters,
        moduleHeightMeters: module.nominalModuleHeightMeters,
        moduleLengthMeters: nominalModule,
        wallLengthMeters: params.frame.lengthMeters,
        resolvedLintelSpans,
        courseIndexElevationDatumMeters: params.panelBottomElevationMeters,
        courseIndexOffset,
      });

      for (const [segmentIndex, segment] of segments.entries()) {
        const isJambClosure = segment.source === 'opening_jamb_closure';
        const blockType = blockTypeForOpeningSegment(segment, nominalModule, clippedBlock.blockType);
        const nominalLengthMeters = segment.lengthMeters;
        const touchesPartitionJoinStart =
          params.partitionWallCourseJoinTrim?.start != null &&
          Math.abs(segment.startAlongMeters - coursePanelStartStationMeters) <= 0.001;
        const touchesPartitionJoinEnd =
          params.partitionWallCourseJoinTrim?.end != null &&
          Math.abs(segment.endAlongMeters - coursePanelEndStationMeters) <= 0.001;
        const actualLengthMeters =
          touchesPartitionJoinStart || touchesPartitionJoinEnd
            ? nominalLengthMeters
            : actualLengthForOpeningSegment(segment, clippedBlock.actualLengthMeters);
        const placementCenterStationMeters =
          touchesPartitionJoinStart && !touchesPartitionJoinEnd
            ? segment.startAlongMeters + actualLengthMeters / 2
            : touchesPartitionJoinEnd && !touchesPartitionJoinStart
              ? segment.endAlongMeters - actualLengthMeters / 2
              : undefined;

        const block = blockFromPanelUnit({
          panel: params.panel,
          frame: params.frame,
          courseIndex: absoluteCourseIndex,
          moduleIndex,
          stationMeters: segment.startAlongMeters,
          nominalLengthMeters,
          actualLengthMeters,
          placementCenterStationMeters,
          courseBottomElevationMeters,
          physicalHeightMeters,
          blockType,
          kind: isTopClosure ? 'cut_height_block' : isJambClosure ? 'cut_block' : clippedBlock.kind,
          source: isTopClosure
            ? 'panel_top_closure'
            : isJambClosure
              ? 'opening_jamb_closure'
              : blockSource,
          infillCenterlineInwardOffsetMeters: params.infillCenterlineInwardOffsetMeters,
        });

        blocks.push({
          ...block,
          id:
            segments.length === 1
              ? block.id
              : `${block.id}-s${segmentIndex}`,
          nearOpeningId: segment.openingId,
          adjacentTo: segment.adjacentTo,
        });

        moduleIndex += 1;
      }
    }
  }

  const openingFramesById = new Map([[params.frame.segmentId, params.frame]]);
  const lintelSolids = buildLayoutLintelSolidPlacements(
    panelAdjustedOpenings,
    openingFramesById,
    module.nominalModuleHeightMeters,
    module.actualBlockHeightMeters,
    nominalModule,
    resolvedLintelSpans,
    {
      courseIndexElevationDatumMeters: params.panelBottomElevationMeters,
      courseIndexOffset,
    },
  );
  const lintels = lintelSolids.map(lintelSolidToInstance);

  const filteredBlocks = blocks.filter(
    (block) =>
      !blockOverlapsAnyOpeningAssembly({
        block,
        openings: panelAdjustedOpenings,
        courseBottomElevationMeters: courseBottomElevationForIndex({
          courseIndex: block.courseIndex ?? block.course ?? 0,
          panelBottomElevationMeters: params.panelBottomElevationMeters,
          courseIndexOffset,
          nominalModuleHeightMeters: module.nominalModuleHeightMeters,
        }),
        physicalHeightMeters: block.physicalHeightMeters ?? block.heightMeters ?? module.actualBlockHeightMeters,
        nominalModuleHeightMeters: module.nominalModuleHeightMeters,
        nominalModuleLengthMeters: nominalModule,
        wallLengthMeters: params.frame.lengthMeters,
        resolvedLintelSpans,
        panelBottomElevationMeters: params.panelBottomElevationMeters,
        courseIndexOffset,
      }),
  );

  if (filteredBlocks.length < blocks.length) {
    warnings.push(
      `Removed ${blocks.length - filteredBlocks.length} RC infill block(s) overlapping opening assembly on panel ${params.panel.id}.`,
    );
  }

  const lintelClosureBlocks = buildLintelCourseClosureBlocks({
    panel: params.panel,
    frame: params.frame,
    panelStartStationMeters: params.panelStartStationMeters,
    panelEndStationMeters: params.panelEndStationMeters,
    panelBottomElevationMeters: params.panelBottomElevationMeters,
    courseIndexOffset,
    nominalModuleLengthMeters: nominalModule,
    nominalModuleHeightMeters: module.nominalModuleHeightMeters,
    actualBlockHeightMeters: module.actualBlockHeightMeters,
    openings: panelAdjustedOpenings,
    lintelSolids,
    placedBlocks: filteredBlocks,
    infillCenterlineInwardOffsetMeters: params.infillCenterlineInwardOffsetMeters,
  });
  const finalBlocks = [...filteredBlocks, ...lintelClosureBlocks];

  return {
    blocks: finalBlocks,
    lintels,
    warnings,
    counts: countFinalPanelBlocks(finalBlocks),
    panelAdjustedOpenings,
  };
}
