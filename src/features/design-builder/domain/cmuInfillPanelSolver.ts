import type {
  CmuInfillPanel,
  CmuWallSystemParameters,
  DesignWallLayoutParameters,
  RcFrameFoundationSettings,
  StructuralBeam,
  StructuralColumn,
} from "../types";
import {
  belowGradeInfillPanelFromResolvedBounds,
  infillPanelFromResolvedBounds,
  logInfillPanelBoundsTableForDev,
  resolveBelowGradeInfillPanelBoundsForLayout,
  resolveInfillPanelBoundsForLayout,
  resolveInfillPanelBoundsForSegment,
  type ResolvedInfillPanelBounds,
} from "./infillPanelBoundsResolver";
import type {
  CmuBlockInstance,
  SegmentFrame,
} from "../geometry/designGeometry";
import type { ResolvedCmuOpening } from "./cmuOpeningRules";
import { solveOpeningAwareMasonryPanel } from "./openingAwareMasonryPanelSolver";
import { lintelSolidToInstance } from "./openingAssemblySolver";

export const FRAME_INFILL_HEIGHT_TOLERANCE_METERS = 0.002;
export const TOP_COURSE_RENDER_EPSILON_METERS = 0.001;
export const TOP_CLOSURE_PRACTICAL_MIN_HEIGHT_METERS = 0.05;

export type InfillPanelSolveResult = {
  panel: CmuInfillPanel;
  bounds: ResolvedInfillPanelBounds;
  blocks: CmuBlockInstance[];
  lintels: ReturnType<typeof lintelSolidToInstance>[];
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

export function countPanelVerticalCourses(params: {
  panelBottomElevationMeters: number;
  panelTopElevationMeters: number;
  nominalCourseHeightMeters: number;
}): number {
  const vertical = resolvePanelVerticalCourses(params);
  return vertical.fullCourseCount + (vertical.hasTopClosureCourse ? 1 : 0);
}

export function isAboveGradeInfillPanel(panel: CmuInfillPanel): boolean {
  return panel.infillZone !== "below_grade";
}

function findExistingPanelForBounds(
  existingPanels: readonly CmuInfillPanel[] | undefined,
  bounds: ResolvedInfillPanelBounds,
  zone: "above_grade" | "below_grade",
): CmuInfillPanel | undefined {
  return existingPanels
    ?.filter(
      (panel) =>
        panel.hostSegmentId === bounds.hostSegmentId &&
        (zone === "below_grade"
          ? panel.infillZone === "below_grade"
          : panel.infillZone !== "below_grade"),
    )
    .find(
      (panel) =>
        Math.abs(panel.startStationMeters - bounds.startStationMeters) <=
          FRAME_INFILL_HEIGHT_TOLERANCE_METERS &&
        Math.abs(panel.endStationMeters - bounds.endStationMeters) <=
          FRAME_INFILL_HEIGHT_TOLERANCE_METERS,
    );
}

function resolveAllInfillPanelBounds(params: {
  layout: DesignWallLayoutParameters;
  segmentFrames: SegmentFrame[];
  columns: StructuralColumn[];
  beams: StructuralBeam[];
  foundation?: RcFrameFoundationSettings;
}): ResolvedInfillPanelBounds[] {
  const belowGrade = resolveBelowGradeInfillPanelBoundsForLayout(params);
  const aboveGrade = resolveInfillPanelBoundsForLayout(params);
  const ordered: ResolvedInfillPanelBounds[] = [];
  for (const segment of params.layout.segments) {
    const below = belowGrade.find(
      (bounds) => bounds.hostSegmentId === segment.id,
    );
    const above = aboveGrade.find(
      (bounds) => bounds.hostSegmentId === segment.id,
    );
    if (below) ordered.push(below);
    if (above) ordered.push(above);
  }
  return ordered;
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
  const fullCourseCount = Math.floor(
    clearPanelHeightMeters / params.nominalCourseHeightMeters,
  );
  const topClosureHeightMeters =
    clearPanelHeightMeters - fullCourseCount * params.nominalCourseHeightMeters;
  const hasTopClosureCourse =
    topClosureHeightMeters > FRAME_INFILL_HEIGHT_TOLERANCE_METERS;
  return {
    clearPanelHeightMeters,
    fullCourseCount,
    topClosureHeightMeters,
    hasTopClosureCourse,
  };
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
  foundation?: RcFrameFoundationSettings;
  existingPanels?: readonly CmuInfillPanel[];
}): CmuInfillPanel[] {
  const resolvedBounds = resolveAllInfillPanelBounds(params);
  return resolvedBounds.map((bounds) => {
    const zone = bounds.panelId.includes("-below-")
      ? "below_grade"
      : "above_grade";
    const existingPanel = findExistingPanelForBounds(
      params.existingPanels,
      bounds,
      zone,
    );
    return zone === "below_grade"
      ? belowGradeInfillPanelFromResolvedBounds({
          bounds,
          wall: params.wall,
          beams: params.beams,
          existingPanel,
        })
      : infillPanelFromResolvedBounds({
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
  foundation?: RcFrameFoundationSettings;
  existingPanels?: readonly CmuInfillPanel[];
}): Array<{ panel: CmuInfillPanel; bounds: ResolvedInfillPanelBounds }> {
  const resolvedBounds = resolveAllInfillPanelBounds(params);
  return resolvedBounds.map((bounds) => {
    const zone = bounds.panelId.includes("-below-")
      ? "below_grade"
      : "above_grade";
    const existingPanel = findExistingPanelForBounds(
      params.existingPanels,
      bounds,
      zone,
    );
    return {
      bounds,
      panel:
        zone === "below_grade"
          ? belowGradeInfillPanelFromResolvedBounds({
              bounds,
              wall: params.wall,
              beams: params.beams,
              existingPanel,
            })
          : infillPanelFromResolvedBounds({
              bounds,
              wall: params.wall,
              beams: params.beams,
              existingPanel,
            }),
    };
  });
}

export function solveInfillPanelBlocks(params: {
  panel: CmuInfillPanel;
  bounds: ResolvedInfillPanelBounds;
  frame: SegmentFrame;
  wall: CmuWallSystemParameters;
  logBoundsForDev?: boolean;
  courseIndexOffset?: number;
  openings?: readonly ResolvedCmuOpening[];
}): InfillPanelSolveResult {
  const courseIndexOffset = params.courseIndexOffset ?? 0;
  const bondPattern =
    params.panel.masonrySettings.bondPattern ?? "running_bond";
  const panelOpenings = isAboveGradeInfillPanel(params.panel)
    ? (params.openings ?? [])
    : [];

  const solved = solveOpeningAwareMasonryPanel({
    panelKind: "rc_frame_infill",
    panel: params.panel,
    frame: params.frame,
    panelStartStationMeters: params.panel.startStationMeters,
    panelEndStationMeters: params.panel.endStationMeters,
    panelBottomElevationMeters: params.panel.bottomElevationMeters,
    panelTopElevationMeters: params.panel.topElevationMeters,
    openings: panelOpenings,
    wall: params.wall,
    bondPattern,
    courseIndexOffset,
    infillCenterlineInwardOffsetMeters:
      params.bounds.infillCenterlineInwardOffsetMeters,
  });

  const blocks = solved.blocks;
  const warnings = [...solved.warnings];

  const firstCmuStartStation =
    blocks.length > 0
      ? Math.min(...blocks.map((block) => block.stationMeters ?? 0))
      : params.panel.startStationMeters;
  const lastCmuEndStation =
    blocks.length > 0
      ? Math.max(
          ...blocks.map(
            (block) =>
              block.endAlongMeters ??
              (block.stationMeters ?? 0) + block.lengthMeters,
          ),
        )
      : params.panel.endStationMeters;

  if (params.logBoundsForDev) {
    logInfillPanelBoundsTableForDev(
      params.bounds,
      firstCmuStartStation,
      lastCmuEndStation,
    );
  }

  return {
    panel: params.panel,
    bounds: params.bounds,
    blocks,
    lintels: solved.lintels,
    fullBlockCount: solved.counts.full,
    halfBlockCount: solved.counts.half,
    cutBlockCount: solved.counts.cut,
    topClosureCutBlockCount: solved.counts.topClosure,
    firstCmuStartStation,
    lastCmuEndStation,
    warnings,
  };
}

export function panelClearWidthMeters(panel: CmuInfillPanel): number {
  return Math.max(0, panel.endStationMeters - panel.startStationMeters);
}

export function panelClearAreaSquareMeters(panel: CmuInfillPanel): number {
  return (
    panelClearWidthMeters(panel) *
    Math.max(0, panel.topElevationMeters - panel.bottomElevationMeters)
  );
}
