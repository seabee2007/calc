import type { DesignGeometryResult } from "../geometry/designGeometry";
import type {
  DesignVisualStyle,
  StructuralBeam,
  StructuralColumn,
} from "../types";
import {
  createDesignBuilderRcFramePipelineSummary,
  type DesignBuilderRcFramePipelineSummary,
} from "./designBuilderRcFramePipelineSummary";
import { beamSpanLengthMeters } from "./structuralFrameLayout";

export const DEFAULT_RECOMMENDED_RC_FRAME_SPAN_METERS = 6;

export type DesignBuilderRcFrameSpanIssue = {
  beamId: string;
  beamKind: StructuralBeam["kind"];
  hostSegmentId: string | null;
  spanMeters: number;
  maxRecommendedSpanMeters: number;
  suggestedIntermediateSupportCount: number;
};

export type DesignBuilderRcFrameDebugSnapshot = {
  status: DesignBuilderRcFrameHealthStatus;
  stageStatus: DesignBuilderRcFrameStageStatus;
  pipeline: DesignBuilderRcFramePipelineSummary;
  buildingSystemMode:
    | "reinforced_concrete_frame_with_cmu_infill"
    | "cmu_bearing_wall"
    | "unknown";
  columnCount: number;
  footingCount: number;
  beamCount: number;
  maxRecommendedSpanMeters: number;
  longestBeamSpanMeters: number;
  longestRoofBeamSpanMeters: number;
  spanIssues: DesignBuilderRcFrameSpanIssue[];
  columns: Array<{
    id: string;
    hostNodeId: string | null;
    x: number;
    z: number;
  }>;
  infillHealth: DesignBuilderRcFrameInfillHealth;
  roofHealth: DesignBuilderRcFrameRoofHealth;
  gableEndHealth: DesignBuilderRcFrameGableEndHealth;
  materialPreviewHealth: DesignBuilderRcFrameMaterialPreviewHealth;
  issues: DesignBuilderRcFrameHealthIssue[];
};

export type DesignBuilderRcFrameHealthStatus = "go" | "no_go";

export type DesignBuilderRcFrameStageStatus = {
  layout: DesignBuilderRcFrameHealthStatus;
  frame: DesignBuilderRcFrameHealthStatus;
  infill: DesignBuilderRcFrameHealthStatus;
  roof: DesignBuilderRcFrameHealthStatus;
  gableEnd: DesignBuilderRcFrameHealthStatus;
  materialPreview: DesignBuilderRcFrameHealthStatus;
};

export function createDesignBuilderRcFrameDebugSnapshot(params: {
  geometryResult: DesignGeometryResult | null | undefined;
  maxRecommendedSpanMeters?: number;
  visualStyle?: DesignVisualStyle;
  previewMaterialsReady?: boolean;
  usePreviewMaterials?: boolean;
}): DesignBuilderRcFrameDebugSnapshot {
  const geometry = params.geometryResult ?? null;
  const frameSystem = geometry?.frameSystem ?? null;
  const beams = frameSystem?.beams ?? [];
  const pipelineSummary = createDesignBuilderRcFramePipelineSummary(params);
  const maxRecommendedSpanMeters =
    params.maxRecommendedSpanMeters ?? DEFAULT_RECOMMENDED_RC_FRAME_SPAN_METERS;
  const spanIssues = beams
    .map((beam) => spanIssueForBeam(beam, maxRecommendedSpanMeters))
    .filter(
      (issue): issue is DesignBuilderRcFrameSpanIssue => issue !== null,
    );
  const infillHealth = createInfillHealth(geometry, pipelineSummary);
  const roofHealth = createRoofHealth(geometry);
  const gableEndHealth = createGableEndHealth(geometry);
  const materialPreviewHealth = createMaterialPreviewHealth(params);
  const issues = [
    ...spanIssues.map((issue): DesignBuilderRcFrameHealthIssue => ({
      code: "beam_span_exceeds_recommended",
      path: `frameSystem.beams.${issue.beamId}`,
      message: `${issue.beamKind} ${issue.beamId} spans ${issue.spanMeters}m, which exceeds the ${issue.maxRecommendedSpanMeters}m recommended span.`,
    })),
    ...infillHealth.issues,
    ...roofHealth.issues,
    ...gableEndHealth.issues,
    ...materialPreviewHealth.issues,
  ];
  const stageStatus: DesignBuilderRcFrameStageStatus = {
    layout:
      geometry && pipelineSummary.buildingSystemMode === "reinforced_concrete_frame_with_cmu_infill"
        ? "go"
        : "no_go",
    frame:
      spanIssues.length === 0 &&
      pipelineSummary.frameStage.columnCount > 0 &&
      pipelineSummary.frameStage.footingCount > 0 &&
      pipelineSummary.frameStage.beamCount > 0
        ? "go"
        : "no_go",
    infill: infillHealth.issues.length === 0 ? "go" : "no_go",
    roof: roofHealth.issues.length === 0 ? "go" : "no_go",
    gableEnd: gableEndHealth.issues.length === 0 ? "go" : "no_go",
    materialPreview:
      materialPreviewHealth.issues.length === 0 ? "go" : "no_go",
  };

  return {
    status: issues.length === 0 ? "go" : "no_go",
    stageStatus,
    pipeline: pipelineSummary,
    buildingSystemMode: pipelineSummary.buildingSystemMode,
    columnCount: pipelineSummary.frameStage.columnCount,
    footingCount: pipelineSummary.frameStage.footingCount,
    beamCount: pipelineSummary.frameStage.beamCount,
    maxRecommendedSpanMeters: round(maxRecommendedSpanMeters),
    longestBeamSpanMeters: pipelineSummary.frameStage.longestBeamSpanMeters,
    longestRoofBeamSpanMeters:
      pipelineSummary.frameStage.longestRoofBeamSpanMeters,
    spanIssues,
    columns: (frameSystem?.columns ?? []).map(columnSummary),
    infillHealth,
    roofHealth,
    gableEndHealth,
    materialPreviewHealth,
    issues,
  };
}

export type DesignBuilderRcFrameHealthIssue = {
  code:
    | "beam_span_exceeds_recommended"
    | "missing_geometry"
    | "wrong_building_system"
    | "missing_infill_panel"
    | "unmatched_infill_panel"
    | "missing_infill_bounds"
    | "missing_infill_blocks"
    | "missing_plaster"
    | "missing_roof"
    | "unsupported_roof"
    | "missing_roof_components"
    | "missing_gable_end"
    | "material_preview_not_active";
  path: string;
  message: string;
};

export type DesignBuilderRcFrameSegmentHealth = {
  hostSegmentId: string;
  expectedBayCount: number;
  expectedBayIds: string[];
  aboveGradePanelCount: number;
  belowGradePanelCount: number;
  aboveGradeBoundsCount: number;
  aboveGradePanelsWithBlocks: number;
  aboveGradePanelsWithPlaster: number;
  missingAboveGradePanelCount: number;
  missingExpectedBayIds: string[];
  unmatchedAboveGradePanelIds: string[];
  unmatchedAboveGradeBoundsPanelIds: string[];
  missingBlockPanelIds: string[];
  missingPlasterPanelIds: string[];
};

export type DesignBuilderRcFrameInfillHealth = {
  expectedAboveGradeBayCount: number;
  aboveGradePanelCount: number;
  belowGradePanelCount: number;
  aboveGradeBoundsCount: number;
  aboveGradePanelsWithBlocks: number;
  aboveGradePanelsWithPlaster: number;
  plasterPlacementCount: number;
  bayReports: DesignBuilderRcFrameInfillBayHealthReport[];
  segmentHealth: DesignBuilderRcFrameSegmentHealth[];
  issues: DesignBuilderRcFrameHealthIssue[];
};

export type DesignBuilderRcFrameInfillBayHealthReport = {
  panelId: string;
  hostSegmentId: string;
  zone: "above_grade" | "below_grade";
  matchedExpectedBayId: string | null;
  matchedExpectedBoundsBayId: string | null;
  startStationMeters: number;
  endStationMeters: number;
  clearWidthMeters: number;
  hasResolvedBounds: boolean;
  blockCount: number;
  plasterPlacementCount: number;
};

export type DesignBuilderRcFrameRoofHealth = {
  present: boolean;
  supported: boolean;
  roofTopPlaneCount: number;
  claddingDisplayPlaneCount: number;
  trussCount: number;
  purlinCount: number;
  roofBeamTopY: number | null;
  roofPeakY: number | null;
  issues: DesignBuilderRcFrameHealthIssue[];
};

export type DesignBuilderRcFrameGableEndHealth = {
  expectedGableEndCount: number;
  resolvedGableEndCount: number;
  gableEndCmuBlockCount: number;
  gableEndSegmentIds: string[];
  issues: DesignBuilderRcFrameHealthIssue[];
};

export type DesignBuilderRcFrameMaterialPreviewHealth = {
  visualStyle: DesignVisualStyle | null;
  usePreviewMaterials: boolean | null;
  previewMaterialsReady: boolean | null;
  issues: DesignBuilderRcFrameHealthIssue[];
};

function createInfillHealth(
  geometry: DesignGeometryResult | null,
  pipeline: DesignBuilderRcFramePipelineSummary,
): DesignBuilderRcFrameInfillHealth {
  const issues: DesignBuilderRcFrameHealthIssue[] = [];
  if (!geometry) {
    issues.push({
      code: "missing_geometry",
      path: "geometryResult",
      message: "No geometry result is available for RC frame infill checks.",
    });
    return emptyInfillHealth(issues);
  }
  if (pipeline.buildingSystemMode !== "reinforced_concrete_frame_with_cmu_infill") {
    issues.push({
      code: "wrong_building_system",
      path: "geometryResult.buildingSystemMode",
      message: "RC frame health checks only apply to reinforced concrete frame with CMU infill mode.",
    });
    return emptyInfillHealth(issues);
  }

  const plasterEnabled =
    geometry.infillSystem?.plaster?.enabled ||
    geometry.infillSystem?.plaster?.interiorEnabled;
  const segmentHealth = pipeline.infillStage.segmentBaySummaries.map((segment) => {
    const segmentAbovePanels = pipeline.infillStage.baySummaries.filter(
      (bay) =>
        bay.hostSegmentId === segment.hostSegmentId &&
        bay.zone === "above_grade",
    );
    const missingBlockPanelIds = segmentAbovePanels
      .filter((bay) => bay.blockCount === 0)
      .map((bay) => bay.panelId);
    const missingPlasterPanelIds =
      plasterEnabled
        ? segmentAbovePanels
            .filter((bay) => bay.plasterPlacementCount === 0)
            .map((bay) => bay.panelId)
        : [];
    return {
      hostSegmentId: segment.hostSegmentId,
      expectedBayCount: segment.expectedAboveGradeBayCount,
      expectedBayIds: segment.expectedAboveGradeBays.map((bay) => bay.bayId),
      aboveGradePanelCount: segment.aboveGradePanelCount,
      belowGradePanelCount: segment.belowGradePanelCount,
      aboveGradeBoundsCount: segment.aboveGradeBoundsCount,
      aboveGradePanelsWithBlocks: segment.aboveGradePanelsWithBlocks,
      aboveGradePanelsWithPlaster: segment.aboveGradePanelsWithPlaster,
      missingAboveGradePanelCount: segment.missingAboveGradePanelCount,
      missingExpectedBayIds: segment.missingExpectedAboveGradeBays.map(
        (bay) => bay.bayId,
      ),
      unmatchedAboveGradePanelIds: segment.unmatchedAboveGradePanelIds,
      unmatchedAboveGradeBoundsPanelIds:
        segment.unmatchedAboveGradeBoundsPanelIds,
      missingBlockPanelIds,
      missingPlasterPanelIds,
    };
  });

  for (const segment of segmentHealth) {
    if (segment.missingAboveGradePanelCount > 0) {
      issues.push({
        code: "missing_infill_panel",
        path: `infillSystem.panels.${segment.hostSegmentId}`,
        message: `${segment.hostSegmentId} is missing RC infill panel(s) for expected bay(s): ${segment.missingExpectedBayIds.join(", ")}.`,
      });
    }
    if (segment.unmatchedAboveGradePanelIds.length > 0) {
      issues.push({
        code: "unmatched_infill_panel",
        path: `infillSystem.panels.${segment.hostSegmentId}`,
        message: `${segment.hostSegmentId} has generated RC infill panel(s) that do not match an expected support bay: ${segment.unmatchedAboveGradePanelIds.join(", ")}.`,
      });
    }
    if (segment.aboveGradeBoundsCount < segment.aboveGradePanelCount) {
      issues.push({
        code: "missing_infill_bounds",
        path: `resolvedInfillPanelBounds.${segment.hostSegmentId}`,
        message: `${segment.hostSegmentId} has ${segment.aboveGradePanelCount} above-grade panel(s), but only ${segment.aboveGradeBoundsCount} resolved bound(s).`,
      });
    }
    for (const panelId of segment.missingBlockPanelIds) {
      issues.push({
        code: "missing_infill_blocks",
        path: `blockInstances.${panelId}`,
        message: `RC infill panel ${panelId} has no generated CMU block instances.`,
      });
    }
    for (const panelId of segment.missingPlasterPanelIds) {
      issues.push({
        code: "missing_plaster",
        path: `infillPlaster.${panelId}`,
        message: `RC infill panel ${panelId} has no plaster placement even though plaster is enabled.`,
      });
    }
  }

  return {
    expectedAboveGradeBayCount:
      pipeline.infillStage.expectedAboveGradeBayCount,
    aboveGradePanelCount: pipeline.infillStage.aboveGradePanelCount,
    belowGradePanelCount: pipeline.infillStage.belowGradePanelCount,
    aboveGradeBoundsCount: pipeline.infillStage.aboveGradeBoundsCount,
    aboveGradePanelsWithBlocks: sum(
      segmentHealth.map((segment) => segment.aboveGradePanelsWithBlocks),
    ),
    aboveGradePanelsWithPlaster: sum(
      segmentHealth.map((segment) => segment.aboveGradePanelsWithPlaster),
    ),
    plasterPlacementCount: pipeline.infillStage.plasterPlacementCount,
    bayReports: pipeline.infillStage.baySummaries.map((bay) => ({ ...bay })),
    segmentHealth,
    issues,
  };
}

function createRoofHealth(
  geometry: DesignGeometryResult | null,
): DesignBuilderRcFrameRoofHealth {
  const roof = geometry?.resolvedRoofSystem ?? null;
  const issues: DesignBuilderRcFrameHealthIssue[] = [];
  if (!roof) {
    issues.push({
      code: "missing_roof",
      path: "geometryResult.resolvedRoofSystem",
      message: "No resolved roof system is available.",
    });
  } else {
    if (!roof.supported) {
      issues.push({
        code: "unsupported_roof",
        path: "geometryResult.resolvedRoofSystem.supported",
        message: roof.unsupportedMessage || "The resolved roof system is marked unsupported.",
      });
    }
    if (
      roof.roofTopPlanes.length === 0 ||
      roof.claddingDisplayPlanes.length === 0 ||
      roof.trussPlacements.length === 0 ||
      roof.purlinPlacements.length === 0
    ) {
      issues.push({
        code: "missing_roof_components",
        path: "geometryResult.resolvedRoofSystem",
        message: "The resolved roof is missing one or more required visible/framing component groups.",
      });
    }
  }
  return {
    present: roof !== null,
    supported: roof?.supported ?? false,
    roofTopPlaneCount: roof?.roofTopPlanes.length ?? 0,
    claddingDisplayPlaneCount: roof?.claddingDisplayPlanes.length ?? 0,
    trussCount: roof?.trussPlacements.length ?? 0,
    purlinCount: roof?.purlinPlacements.length ?? 0,
    roofBeamTopY: finiteOrNull(roof?.roofBeamTopY),
    roofPeakY: finiteOrNull(roof?.roofPeakY),
    issues,
  };
}

function createGableEndHealth(
  geometry: DesignGeometryResult | null,
): DesignBuilderRcFrameGableEndHealth {
  const roof = geometry?.resolvedRoofSystem ?? null;
  const expectedGableEndCount = roof?.gableEndSegmentIds.length ?? 0;
  const resolvedGableEndCount = roof?.gableEnds.length ?? 0;
  const gableEndCmuBlockCount =
    roof?.gableEnds.reduce(
      (total, gableEnd) => total + gableEnd.cmuUnitPlacements.length,
      0,
    ) ??
    geometry?.blockInstances.filter((block) => block.source === "gable_end_solver")
      .length ??
    0;
  const issues: DesignBuilderRcFrameHealthIssue[] = [];
  if (
    expectedGableEndCount > 0 &&
    (resolvedGableEndCount < expectedGableEndCount || gableEndCmuBlockCount === 0)
  ) {
    issues.push({
      code: "missing_gable_end",
      path: "geometryResult.resolvedRoofSystem.gableEnds",
      message: `Expected ${expectedGableEndCount} gable end(s), resolved ${resolvedGableEndCount}, with ${gableEndCmuBlockCount} CMU block(s).`,
    });
  }
  return {
    expectedGableEndCount,
    resolvedGableEndCount,
    gableEndCmuBlockCount,
    gableEndSegmentIds: roof?.gableEndSegmentIds ?? [],
    issues,
  };
}

function createMaterialPreviewHealth(params: {
  visualStyle?: DesignVisualStyle;
  previewMaterialsReady?: boolean;
  usePreviewMaterials?: boolean;
}): DesignBuilderRcFrameMaterialPreviewHealth {
  const visualStyle = params.visualStyle ?? null;
  const usePreviewMaterials = params.usePreviewMaterials ?? null;
  const previewMaterialsReady = params.previewMaterialsReady ?? null;
  const issues: DesignBuilderRcFrameHealthIssue[] = [];
  if (visualStyle === "material_preview" && usePreviewMaterials === false) {
    issues.push({
      code: "material_preview_not_active",
      path: "viewer.materialPreview",
      message: "Material Preview is selected, but preview materials are not active.",
    });
  }
  return {
    visualStyle,
    usePreviewMaterials,
    previewMaterialsReady,
    issues,
  };
}

function emptyInfillHealth(
  issues: DesignBuilderRcFrameHealthIssue[],
): DesignBuilderRcFrameInfillHealth {
  return {
    expectedAboveGradeBayCount: 0,
    aboveGradePanelCount: 0,
    belowGradePanelCount: 0,
    aboveGradeBoundsCount: 0,
    aboveGradePanelsWithBlocks: 0,
    aboveGradePanelsWithPlaster: 0,
    plasterPlacementCount: 0,
    bayReports: [],
    segmentHealth: [],
    issues,
  };
}

function sum(values: readonly number[]): number {
  return round(values.reduce((total, value) => total + value, 0));
}

function finiteOrNull(value: number | null | undefined): number | null {
  return Number.isFinite(value) ? round(value!) : null;
}

function spanIssueForBeam(
  beam: StructuralBeam,
  maxRecommendedSpanMeters: number,
): DesignBuilderRcFrameSpanIssue | null {
  const spanMeters = beamSpanLengthMeters(beam);
  if (spanMeters <= maxRecommendedSpanMeters) return null;
  return {
    beamId: beam.id,
    beamKind: beam.kind,
    hostSegmentId: beam.hostSegmentId ?? null,
    spanMeters: round(spanMeters),
    maxRecommendedSpanMeters: round(maxRecommendedSpanMeters),
    suggestedIntermediateSupportCount: Math.max(
      0,
      Math.ceil(spanMeters / maxRecommendedSpanMeters) - 1,
    ),
  };
}

function columnSummary(column: StructuralColumn) {
  return {
    id: column.id,
    hostNodeId: column.hostNodeId ?? null,
    x: round(column.position.x),
    z: round(column.position.z),
  };
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
