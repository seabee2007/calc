import type { DesignGeometryResult } from "../geometry/designGeometry";
import type {
  CmuInfillPanel,
  DesignVisualStyle,
  StructuralBeam,
} from "../types";
import {
  createDesignBuilderRcFrameInfillCoverage,
  type DesignBuilderRcFrameExpectedInfillBaySummary,
} from "./designBuilderRcFrameInfillCoverage";
import { resolveInfillPlasterPanelPlacements } from "./infillPlaster";
import { beamSpanLengthMeters } from "./structuralFrameLayout";

export type DesignBuilderRcFramePipelineSummary = {
  buildingSystemMode:
    | "reinforced_concrete_frame_with_cmu_infill"
    | "cmu_bearing_wall"
    | "unknown";
  pipelineStages: DesignBuilderRcFramePipelineStageSummary[];
  layoutStage: {
    wallSegmentCount: number;
    exteriorFootprintPointCount: number;
  };
  frameStage: {
    columnCount: number;
    footingCount: number;
    beamCount: number;
    longestBeamSpanMeters: number;
    longestRoofBeamSpanMeters: number;
  };
  infillStage: {
    plasterEnabled: boolean;
    expectedAboveGradeBayCount: number;
    aboveGradePanelCount: number;
    belowGradePanelCount: number;
    aboveGradeBoundsCount: number;
    plasterPlacementCount: number;
    segmentBaySummaries: DesignBuilderRcFrameSegmentBaySummary[];
    baySummaries: DesignBuilderRcFrameInfillBaySummary[];
  };
  roofSupportStage: {
    present: boolean;
    supported: boolean;
    bearingSource: string | null;
    roofBeamTopY: number | null;
    roofPeakY: number | null;
    gableEndSegmentIds: string[];
  };
  materialStage: {
    visualStyle: DesignVisualStyle | null;
    usePreviewMaterials: boolean | null;
    previewMaterialsReady: boolean | null;
  };
};

export type DesignBuilderRcFramePipelineStageKey =
  | "foundation_layout"
  | "rc_columns_footings_beams"
  | "infill_panel_bays"
  | "cmu_plaster_render"
  | "roof_support_inputs";

export type DesignBuilderRcFramePipelineStageStatus = "go" | "no_go";

export type DesignBuilderRcFramePipelineStageSummary = {
  key: DesignBuilderRcFramePipelineStageKey;
  label: string;
  status: DesignBuilderRcFramePipelineStageStatus;
  inputCount: number;
  outputCount: number;
  issueCount: number;
};

export type DesignBuilderRcFrameSegmentBaySummary = {
  hostSegmentId: string;
  expectedAboveGradeBayCount: number;
  expectedAboveGradeBays: DesignBuilderRcFrameExpectedInfillBaySummary[];
  aboveGradePanelCount: number;
  belowGradePanelCount: number;
  aboveGradeBoundsCount: number;
  aboveGradePanelsWithBlocks: number;
  aboveGradePanelsWithPlaster: number;
  missingAboveGradePanelCount: number;
  missingExpectedAboveGradeBays: DesignBuilderRcFrameExpectedInfillBaySummary[];
  unmatchedAboveGradePanelIds: string[];
  unmatchedAboveGradeBoundsPanelIds: string[];
};

export type DesignBuilderRcFrameInfillBaySummary = {
  panelId: string;
  hostSegmentId: string;
  zone: "above_grade" | "below_grade";
  startStationMeters: number;
  endStationMeters: number;
  clearWidthMeters: number;
  matchedExpectedBayId: string | null;
  matchedExpectedBoundsBayId: string | null;
  hasResolvedBounds: boolean;
  blockCount: number;
  plasterPlacementCount: number;
};

export function createDesignBuilderRcFramePipelineSummary(params: {
  geometryResult: DesignGeometryResult | null | undefined;
  visualStyle?: DesignVisualStyle;
  previewMaterialsReady?: boolean;
  usePreviewMaterials?: boolean;
}): DesignBuilderRcFramePipelineSummary {
  const geometry = params.geometryResult ?? null;
  const frameSystem = geometry?.frameSystem ?? null;
  const beams = frameSystem?.beams ?? [];
  const aboveGradePanels = (geometry?.infillSystem?.panels ?? []).filter(
    isAboveGradePanel,
  );
  const belowGradePanels = (geometry?.infillSystem?.panels ?? []).filter(
    (panel) => panel.infillZone === "below_grade",
  );
  const aboveGradePanelIds = new Set(aboveGradePanels.map((panel) => panel.id));
  const aboveGradeBounds = (geometry?.resolvedInfillPanelBounds ?? []).filter(
    (bounds) => aboveGradePanelIds.has(bounds.panelId),
  );
  const plasterPlacements = geometry
    ? resolveInfillPlasterPanelPlacements({
        infillSystem: geometry.infillSystem,
        panelBounds: aboveGradeBounds,
        openings: geometry.wallCmuLayout.roughOpenings,
        wallThicknessMeters: resolveWallThicknessMeters(geometry),
      })
    : [];
  const blocksByPanelId = new Map<string, number>();
  for (const block of geometry?.blockInstances ?? []) {
    if (!block.panelId) continue;
    blocksByPanelId.set(block.panelId, (blocksByPanelId.get(block.panelId) ?? 0) + 1);
  }
  const plasterByPanelId = new Map<string, number>();
  for (const placement of plasterPlacements) {
    plasterByPanelId.set(
      placement.panelId,
      (plasterByPanelId.get(placement.panelId) ?? 0) + 1,
    );
  }
  const boundsPanelIds = new Set(aboveGradeBounds.map((bounds) => bounds.panelId));
  const infillCoverage = createDesignBuilderRcFrameInfillCoverage({
    geometry,
    aboveGradePanels,
    aboveGradeBounds,
  });
  const expectedAboveGradeBays = infillCoverage.expectedAboveGradeBays;
  const expectedBayIdByPanelId = new Map(
    infillCoverage.panelCoverage.map((coverage) => [
      coverage.panelId,
      coverage.matchedExpectedBayId,
    ]),
  );
  const expectedBoundsBayIdByPanelId = new Map(
    infillCoverage.boundsCoverage.map((coverage) => [
      coverage.panelId,
      coverage.matchedExpectedBayId,
    ]),
  );
  const expectedBayCounts = expectedBayCountBySegment(expectedAboveGradeBays);
  const allSegmentIds = new Set([
    ...expectedBayCounts.keys(),
    ...aboveGradePanels.map((panel) => panel.hostSegmentId),
    ...belowGradePanels.map((panel) => panel.hostSegmentId),
  ]);
  const segmentBaySummaries = [...allSegmentIds].sort().map((hostSegmentId) => {
    const segmentAbovePanels = aboveGradePanels.filter(
      (panel) => panel.hostSegmentId === hostSegmentId,
    );
    const segmentBelowPanels = belowGradePanels.filter(
      (panel) => panel.hostSegmentId === hostSegmentId,
    );
    const expectedAboveGradeSegmentBays = expectedAboveGradeBays.filter(
      (bay) => bay.hostSegmentId === hostSegmentId,
    );
    const missingExpectedAboveGradeBays = expectedAboveGradeSegmentBays.filter(
      (bay) => bay.matchedPanelId === null,
    );
    const expectedAboveGradeBayCount = expectedBayCounts.get(hostSegmentId) ?? 0;
    const unmatchedAboveGradePanelIds =
      expectedAboveGradeBayCount > 0
        ? segmentAbovePanels
            .filter((panel) => expectedBayIdByPanelId.get(panel.id) == null)
            .map((panel) => panel.id)
        : [];
    const unmatchedAboveGradeBoundsPanelIds =
      expectedAboveGradeBayCount > 0
        ? aboveGradeBounds
            .filter(
              (bounds) =>
                bounds.hostSegmentId === hostSegmentId &&
                expectedBoundsBayIdByPanelId.get(bounds.panelId) == null,
            )
            .map((bounds) => bounds.panelId)
        : [];
    return {
      hostSegmentId,
      expectedAboveGradeBayCount,
      expectedAboveGradeBays: expectedAboveGradeSegmentBays,
      aboveGradePanelCount: segmentAbovePanels.length,
      belowGradePanelCount: segmentBelowPanels.length,
      aboveGradeBoundsCount: aboveGradeBounds.filter(
        (bounds) => bounds.hostSegmentId === hostSegmentId,
      ).length,
      aboveGradePanelsWithBlocks: segmentAbovePanels.filter(
        (panel) => (blocksByPanelId.get(panel.id) ?? 0) > 0,
      ).length,
      aboveGradePanelsWithPlaster: segmentAbovePanels.filter(
        (panel) => (plasterByPanelId.get(panel.id) ?? 0) > 0,
      ).length,
      missingAboveGradePanelCount: missingExpectedAboveGradeBays.length,
      missingExpectedAboveGradeBays,
      unmatchedAboveGradePanelIds,
      unmatchedAboveGradeBoundsPanelIds,
    };
  });
  const baySummaries = [...aboveGradePanels, ...belowGradePanels].map((panel) =>
    baySummaryForPanel({
      panel,
      matchedExpectedBayId: expectedBayIdByPanelId.get(panel.id) ?? null,
      matchedExpectedBoundsBayId:
        expectedBoundsBayIdByPanelId.get(panel.id) ?? null,
      hasResolvedBounds:
        panel.infillZone === "below_grade" || boundsPanelIds.has(panel.id),
      blockCount: blocksByPanelId.get(panel.id) ?? 0,
      plasterPlacementCount: plasterByPanelId.get(panel.id) ?? 0,
    }),
  );
  const roof = geometry?.resolvedRoofSystem ?? null;
  const buildingSystemMode = inferBuildingSystemMode(geometry);
  const layoutStage = {
    wallSegmentCount: geometry?.wallSegments.length ?? 0,
    exteriorFootprintPointCount: geometry?.exteriorFootprint.length ?? 0,
  };
  const frameStage = {
    columnCount: frameSystem?.columns.length ?? 0,
    footingCount: geometry?.isolatedFootings?.length ?? 0,
    beamCount: beams.length,
    longestBeamSpanMeters: round(longestSpan(beams)),
    longestRoofBeamSpanMeters: round(
      longestSpan(beams.filter((beam) => beam.kind === "roof_beam")),
    ),
  };
  const plasterEnabled = Boolean(
    geometry?.infillSystem?.plaster?.enabled ||
      geometry?.infillSystem?.plaster?.interiorEnabled,
  );
  const infillStage = {
    plasterEnabled,
    expectedAboveGradeBayCount: sum(
      segmentBaySummaries.map(
        (segment) => segment.expectedAboveGradeBayCount,
      ),
    ),
    aboveGradePanelCount: aboveGradePanels.length,
    belowGradePanelCount: belowGradePanels.length,
    aboveGradeBoundsCount: aboveGradeBounds.length,
    plasterPlacementCount: plasterPlacements.length,
    segmentBaySummaries,
    baySummaries,
  };
  const roofSupportStage = {
    present: roof !== null,
    supported: roof?.supported ?? false,
    bearingSource: roof?.roofBearingSource ?? null,
    roofBeamTopY: finiteOrNull(roof?.roofBeamTopY),
    roofPeakY: finiteOrNull(roof?.roofPeakY),
    gableEndSegmentIds: roof?.gableEndSegmentIds ?? [],
  };
  const materialStage = {
    visualStyle: params.visualStyle ?? null,
    usePreviewMaterials: params.usePreviewMaterials ?? null,
    previewMaterialsReady: params.previewMaterialsReady ?? null,
  };

  return {
    buildingSystemMode,
    pipelineStages: createPipelineStages({
      buildingSystemMode,
      layoutStage,
      frameStage,
      infillStage,
      roofSupportStage,
    }),
    layoutStage,
    frameStage,
    infillStage,
    roofSupportStage,
    materialStage,
  };
}

function createPipelineStages(params: {
  buildingSystemMode: DesignBuilderRcFramePipelineSummary["buildingSystemMode"];
  layoutStage: DesignBuilderRcFramePipelineSummary["layoutStage"];
  frameStage: DesignBuilderRcFramePipelineSummary["frameStage"];
  infillStage: DesignBuilderRcFramePipelineSummary["infillStage"];
  roofSupportStage: DesignBuilderRcFramePipelineSummary["roofSupportStage"];
}): DesignBuilderRcFramePipelineStageSummary[] {
  const layoutGo =
    params.buildingSystemMode === "reinforced_concrete_frame_with_cmu_infill" &&
    params.layoutStage.wallSegmentCount > 0 &&
    params.layoutStage.exteriorFootprintPointCount >= 4;
  const frameGo =
    params.frameStage.columnCount > 0 &&
    params.frameStage.footingCount > 0 &&
    params.frameStage.beamCount > 0;
  const missingInfillOutputs = Math.max(
    0,
    params.infillStage.expectedAboveGradeBayCount -
      params.infillStage.aboveGradePanelCount,
  );
  const missingBayMatches = sum(
    params.infillStage.segmentBaySummaries.map(
      (segment) => segment.missingAboveGradePanelCount,
    ),
  );
  const unmatchedPanelRanges = sum(
    params.infillStage.segmentBaySummaries.map(
      (segment) =>
        segment.unmatchedAboveGradePanelIds.length +
        segment.unmatchedAboveGradeBoundsPanelIds.length,
    ),
  );
  const missingBounds = Math.max(
    0,
    params.infillStage.aboveGradePanelCount -
      params.infillStage.aboveGradeBoundsCount,
  );
  const missingBlocks = params.infillStage.baySummaries.filter(
    (bay) => bay.zone === "above_grade" && bay.blockCount === 0,
  ).length;
  const missingPlaster = params.infillStage.plasterEnabled
    ? params.infillStage.baySummaries.filter(
        (bay) => bay.zone === "above_grade" && bay.plasterPlacementCount === 0,
      ).length
    : 0;
  const infillBayGo =
    params.infillStage.expectedAboveGradeBayCount > 0 &&
    missingInfillOutputs === 0 &&
    missingBayMatches === 0 &&
    unmatchedPanelRanges === 0 &&
    missingBounds === 0;
  const renderGo = missingBlocks === 0 && missingPlaster === 0;
  const roofGo =
    params.roofSupportStage.present &&
    params.roofSupportStage.supported &&
    params.roofSupportStage.roofBeamTopY !== null &&
    params.roofSupportStage.roofPeakY !== null;

  return [
    {
      key: "foundation_layout",
      label: "Foundation/layout",
      status: layoutGo ? "go" : "no_go",
      inputCount: params.layoutStage.wallSegmentCount,
      outputCount: params.layoutStage.exteriorFootprintPointCount,
      issueCount: layoutGo ? 0 : 1,
    },
    {
      key: "rc_columns_footings_beams",
      label: "RC columns, footings, and beams",
      status: frameGo ? "go" : "no_go",
      inputCount: params.layoutStage.wallSegmentCount,
      outputCount:
        params.frameStage.columnCount +
        params.frameStage.footingCount +
        params.frameStage.beamCount,
      issueCount: frameGo ? 0 : 1,
    },
    {
      key: "infill_panel_bays",
      label: "Infill panel bays",
      status: infillBayGo ? "go" : "no_go",
      inputCount: params.infillStage.expectedAboveGradeBayCount,
      outputCount:
        params.infillStage.aboveGradePanelCount +
        params.infillStage.aboveGradeBoundsCount,
      issueCount:
        missingInfillOutputs +
        missingBayMatches +
        unmatchedPanelRanges +
        missingBounds,
    },
    {
      key: "cmu_plaster_render",
      label: "CMU/plaster render readiness",
      status: renderGo ? "go" : "no_go",
      inputCount: params.infillStage.aboveGradePanelCount,
      outputCount:
        params.infillStage.baySummaries.filter(
          (bay) => bay.zone === "above_grade" && bay.blockCount > 0,
        ).length + params.infillStage.plasterPlacementCount,
      issueCount: missingBlocks + missingPlaster,
    },
    {
      key: "roof_support_inputs",
      label: "Roof support inputs",
      status: roofGo ? "go" : "no_go",
      inputCount: params.frameStage.beamCount,
      outputCount:
        (params.roofSupportStage.present ? 1 : 0) +
        params.roofSupportStage.gableEndSegmentIds.length,
      issueCount: roofGo ? 0 : 1,
    },
  ];
}

function baySummaryForPanel(params: {
  panel: CmuInfillPanel;
  matchedExpectedBayId: string | null;
  matchedExpectedBoundsBayId: string | null;
  hasResolvedBounds: boolean;
  blockCount: number;
  plasterPlacementCount: number;
}): DesignBuilderRcFrameInfillBaySummary {
  return {
    panelId: params.panel.id,
    hostSegmentId: params.panel.hostSegmentId,
    zone:
      params.panel.infillZone === "below_grade" ? "below_grade" : "above_grade",
    startStationMeters: round(params.panel.startStationMeters),
    endStationMeters: round(params.panel.endStationMeters),
    clearWidthMeters: round(
      Math.max(0, params.panel.endStationMeters - params.panel.startStationMeters),
    ),
    matchedExpectedBayId: params.matchedExpectedBayId,
    matchedExpectedBoundsBayId: params.matchedExpectedBoundsBayId,
    hasResolvedBounds: params.hasResolvedBounds,
    blockCount: params.blockCount,
    plasterPlacementCount: params.plasterPlacementCount,
  };
}

function expectedBayCountBySegment(
  expectedBays: readonly DesignBuilderRcFrameExpectedInfillBaySummary[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const bay of expectedBays) {
    counts.set(bay.hostSegmentId, (counts.get(bay.hostSegmentId) ?? 0) + 1);
  }
  return counts;
}

function isAboveGradePanel(panel: CmuInfillPanel): boolean {
  return panel.infillZone !== "below_grade";
}

function inferBuildingSystemMode(
  geometry: DesignGeometryResult | null,
): DesignBuilderRcFramePipelineSummary["buildingSystemMode"] {
  if (!geometry) return "unknown";
  if (geometry.buildingSystemMode === "cmu_bearing_wall") return "cmu_bearing_wall";
  if (
    geometry.buildingSystemMode === "reinforced_concrete_frame_with_cmu_infill" ||
    geometry.frameSystem ||
    geometry.infillSystem ||
    geometry.isolatedFootings?.length
  ) {
    return "reinforced_concrete_frame_with_cmu_infill";
  }
  return "unknown";
}

function resolveWallThicknessMeters(geometry: DesignGeometryResult): number {
  const wallThicknesses = geometry.wallSegments
    .map((segment) => segment.thicknessMeters)
    .filter((value) => Number.isFinite(value) && value > 0);
  if (wallThicknesses.length > 0) return Math.max(...wallThicknesses);
  const blockDepths = geometry.blockInstances
    .map((block) => block.depthMeters)
    .filter((value): value is number => Number.isFinite(value) && value > 0);
  return blockDepths.length > 0 ? Math.max(...blockDepths) : 0;
}

function longestSpan(beams: readonly StructuralBeam[]): number {
  return beams.reduce(
    (longest, beam) => Math.max(longest, beamSpanLengthMeters(beam)),
    0,
  );
}

function finiteOrNull(value: number | null | undefined): number | null {
  return Number.isFinite(value) ? round(value!) : null;
}

function sum(values: readonly number[]): number {
  return round(values.reduce((total, value) => total + value, 0));
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
