import { describe, expect, it } from "vitest";
import { resolveDesignBuilderGeometryPipeline } from "../application/designBuilderGeometryPipeline";
import {
  createDesignBuilderRcFrameDebugSnapshot,
  DEFAULT_RECOMMENDED_RC_FRAME_SPAN_METERS,
} from "../domain/designBuilderRcFrameDebugSnapshot";
import { createDesignBuilderRcFramePipelineSummary } from "../domain/designBuilderRcFramePipelineSummary";
import { createFiveBySixCmuBuildingPreset } from "../domain/designBuilderPreset";
import { syncPresetFromLayout } from "../domain/layoutWallAdapter";
import { applyAutoFrameLayout } from "../domain/structureActions";
import { createOutsideFaceRectangleLayout } from "../domain/wallLayoutRules";
import type { DesignGeometryResult } from "../geometry/designGeometry";

function rcFrameGeometry(params: {
  lengthMeters: number;
  widthMeters: number;
  intermediateSpacingMeters?: number;
}): DesignGeometryResult {
  const template = createFiveBySixCmuBuildingPreset();
  const layout = createOutsideFaceRectangleLayout({
    lengthMeters: params.lengthMeters,
    widthMeters: params.widthMeters,
    wallHeightMeters: 2.8,
    wallThicknessMeters: 0.2,
  });
  const synced = syncPresetFromLayout(
    {
      ...template,
      wall: {
        ...template.wall,
        openings: [],
      },
      wallLayout: layout,
    },
    layout,
  );
  const preset = applyAutoFrameLayout({
    ...synced,
    foundationSettings: {
      ...synced.foundationSettings,
      columns: {
        ...synced.foundationSettings.columns,
        ...(params.intermediateSpacingMeters
          ? { intermediateSpacingMeters: params.intermediateSpacingMeters }
          : {}),
      },
    },
  });

  return resolveDesignBuilderGeometryPipeline({
    wallLayout: preset.wallLayout,
    effectiveWall: preset.wall,
    resolvedPreset: {
      ...preset,
      buildingSystemMode: "reinforced_concrete_frame_with_cmu_infill",
    },
    footprintClosed: true,
    activeRoofSystem: preset.roofSystem,
  }).designGeometryResult;
}

describe("createDesignBuilderRcFrameDebugSnapshot", () => {
  it.each([
    { label: "5m x 8m", lengthMeters: 5, widthMeters: 8 },
    { label: "15m x 6m", lengthMeters: 15, widthMeters: 6 },
    { label: "35m x 6m", lengthMeters: 35, widthMeters: 6 },
  ])(
    "reports complete RC health for $label",
    ({ lengthMeters, widthMeters }) => {
      const snapshot = createDesignBuilderRcFrameDebugSnapshot({
        geometryResult: rcFrameGeometry({ lengthMeters, widthMeters }),
        visualStyle: "material_preview",
        usePreviewMaterials: true,
        previewMaterialsReady: false,
      });

      expect(snapshot.buildingSystemMode).toBe(
        "reinforced_concrete_frame_with_cmu_infill",
      );
      expect(snapshot.status).toBe("go");
      expect(snapshot.stageStatus).toEqual({
        layout: "go",
        frame: "go",
        infill: "go",
        roof: "go",
        gableEnd: "go",
        materialPreview: "go",
      });
      expect(snapshot.pipeline.pipelineStages.map((stage) => stage.key)).toEqual([
        "foundation_layout",
        "rc_columns_footings_beams",
        "infill_panel_bays",
        "cmu_plaster_render",
        "roof_support_inputs",
      ]);
      expect(
        snapshot.pipeline.pipelineStages.map((stage) => stage.status),
      ).toEqual(["go", "go", "go", "go", "go"]);
      expect(snapshot.issues).toEqual([]);
      expect(snapshot.infillHealth.expectedAboveGradeBayCount).toBeGreaterThan(0);
      const aboveGradeBayReports = snapshot.infillHealth.bayReports.filter(
        (bay) => bay.zone === "above_grade",
      );
      expect(aboveGradeBayReports).toHaveLength(
        snapshot.infillHealth.aboveGradePanelCount,
      );
      const matchedWallBayReports = aboveGradeBayReports.filter(
        (bay) => bay.matchedExpectedBayId != null,
      );
      expect(matchedWallBayReports).toHaveLength(
        snapshot.infillHealth.expectedAboveGradeBayCount,
      );
      expect(
        matchedWallBayReports.every(
          (bay) =>
            bay.matchedExpectedBoundsBayId != null &&
            bay.hasResolvedBounds &&
            bay.blockCount > 0 &&
            bay.plasterPlacementCount > 0,
        ),
      ).toBe(true);
      expect(
        aboveGradeBayReports.every(
          (bay) => bay.blockCount > 0 && bay.plasterPlacementCount > 0,
        ),
      ).toBe(true);
      expect(snapshot.infillHealth.aboveGradePanelsWithBlocks).toBe(
        snapshot.infillHealth.aboveGradePanelCount,
      );
      expect(snapshot.infillHealth.aboveGradePanelsWithPlaster).toBe(
        snapshot.infillHealth.aboveGradePanelCount,
      );
      for (const segment of snapshot.infillHealth.segmentHealth) {
        if (segment.expectedBayCount > 0) {
          expect(segment.aboveGradePanelCount).toBe(segment.expectedBayCount);
          expect(segment.aboveGradeBoundsCount).toBe(segment.expectedBayCount);
        }
        expect(segment.missingAboveGradePanelCount).toBe(0);
        expect(segment.missingBlockPanelIds).toEqual([]);
        expect(segment.missingPlasterPanelIds).toEqual([]);
      }
      expect(snapshot.roofHealth.present).toBe(true);
      expect(snapshot.roofHealth.supported).toBe(true);
      expect(snapshot.roofHealth.roofTopPlaneCount).toBe(2);
      expect(snapshot.roofHealth.claddingDisplayPlaneCount).toBe(2);
      expect(snapshot.roofHealth.trussCount).toBeGreaterThan(0);
      expect(snapshot.roofHealth.purlinCount).toBeGreaterThan(0);
      expect(snapshot.gableEndHealth.expectedGableEndCount).toBe(2);
      expect(snapshot.gableEndHealth.resolvedGableEndCount).toBe(2);
      expect(snapshot.gableEndHealth.gableEndCmuBlockCount).toBeGreaterThan(0);
      expect(snapshot.materialPreviewHealth.visualStyle).toBe("material_preview");
      expect(snapshot.materialPreviewHealth.usePreviewMaterials).toBe(true);
    },
  );

  it("adds default intermediate supports without over-spanning a small RC frame", () => {
    const snapshot = createDesignBuilderRcFrameDebugSnapshot({
      geometryResult: rcFrameGeometry({ lengthMeters: 5, widthMeters: 6 }),
    });

    expect(snapshot.columnCount).toBe(8);
    expect(snapshot.status).toBe("go");
    expect(snapshot.stageStatus.frame).toBe("go");
    expect(snapshot.footingCount).toBe(8);
    expect(snapshot.longestRoofBeamSpanMeters).toBeLessThanOrEqual(
      DEFAULT_RECOMMENDED_RC_FRAME_SPAN_METERS,
    );
    expect(snapshot.spanIssues).toEqual([]);
  });

  it("keeps a 35m long RC frame within the default 4m intermediate support spacing", () => {
    const geometry = rcFrameGeometry({ lengthMeters: 35, widthMeters: 6 });
    const pipeline = createDesignBuilderRcFramePipelineSummary({
      geometryResult: geometry,
    });
    const snapshot = createDesignBuilderRcFrameDebugSnapshot({
      geometryResult: geometry,
    });
    const rectangularAboveGradeBays = pipeline.infillStage.baySummaries.filter(
      (bay) =>
        bay.zone === "above_grade" &&
        !pipeline.roofSupportStage.gableEndSegmentIds.includes(
          bay.hostSegmentId,
        ),
    );

    expect(pipeline.frameStage.columnCount).toBe(22);
    expect(pipeline.pipelineStages.map((stage) => stage.key)).toEqual([
      "foundation_layout",
      "rc_columns_footings_beams",
      "infill_panel_bays",
      "cmu_plaster_render",
      "roof_support_inputs",
    ]);
    expect(
      pipeline.pipelineStages.map((stage) => [stage.key, stage.status]),
    ).toEqual([
      ["foundation_layout", "go"],
      ["rc_columns_footings_beams", "go"],
      ["infill_panel_bays", "go"],
      ["cmu_plaster_render", "go"],
      ["roof_support_inputs", "go"],
    ]);
    expect(pipeline.infillStage.expectedAboveGradeBayCount).toBe(
      rectangularAboveGradeBays.length,
    );
    for (const segment of pipeline.infillStage.segmentBaySummaries) {
      if (segment.expectedAboveGradeBayCount === 0) continue;
      expect(segment.expectedAboveGradeBays).toHaveLength(
        segment.expectedAboveGradeBayCount,
      );
      expect(
        segment.expectedAboveGradeBays.every(
          (bay) => bay.matchedPanelId != null && bay.matchedBoundsPanelId != null,
        ),
      ).toBe(true);
      expect(segment.missingExpectedAboveGradeBays).toEqual([]);
    }
    expect(
      rectangularAboveGradeBays.every(
        (bay) =>
          bay.matchedExpectedBayId != null &&
          bay.matchedExpectedBoundsBayId != null &&
          bay.hasResolvedBounds &&
          bay.blockCount > 0 &&
          bay.plasterPlacementCount > 0,
      ),
    ).toBe(true);
    expect(
      snapshot.infillHealth.bayReports
        .filter((bay) => bay.zone === "above_grade")
        .filter((bay) => bay.matchedExpectedBayId != null)
        .every(
          (bay) =>
            bay.matchedExpectedBoundsBayId != null,
        ),
    ).toBe(true);
    expect(pipeline.roofSupportStage.supported).toBe(true);
    expect(snapshot.columnCount).toBe(22);
    expect(snapshot.status).toBe("go");
    expect(snapshot.stageStatus.infill).toBe("go");
    expect(snapshot.stageStatus.roof).toBe("go");
    expect(snapshot.footingCount).toBe(22);
    expect(snapshot.longestRoofBeamSpanMeters).toBeLessThanOrEqual(4);
    expect(snapshot.spanIssues).toEqual([]);
  });

  it("uses the user-adjustable spacing when laying out intermediate supports", () => {
    const snapshot = createDesignBuilderRcFrameDebugSnapshot({
      geometryResult: rcFrameGeometry({
        lengthMeters: 35,
        widthMeters: 6,
        intermediateSpacingMeters: 10,
      }),
    });

    expect(snapshot.columnCount).toBe(10);
    expect(snapshot.status).toBe("no_go");
    expect(snapshot.stageStatus.frame).toBe("no_go");
    expect(snapshot.longestRoofBeamSpanMeters).toBeGreaterThan(
      DEFAULT_RECOMMENDED_RC_FRAME_SPAN_METERS,
    );
    expect(
      snapshot.spanIssues.some((issue) => issue.beamKind === "roof_beam"),
    ).toBe(true);
  });

  it("fails loudly when an RC infill bay panel has no generated blocks", () => {
    const geometry = rcFrameGeometry({ lengthMeters: 15, widthMeters: 6 });
    const firstPanelId = geometry.infillSystem!.panels.find(
      (panel) => panel.infillZone !== "below_grade",
    )!.id;
    const brokenGeometry: DesignGeometryResult = {
      ...geometry,
      blockInstances: geometry.blockInstances.filter(
        (block) => block.panelId !== firstPanelId,
      ),
    };

    const snapshot = createDesignBuilderRcFrameDebugSnapshot({
      geometryResult: brokenGeometry,
    });

    expect(snapshot.status).toBe("no_go");
    expect(snapshot.stageStatus.infill).toBe("no_go");
    expect(
      snapshot.pipeline.pipelineStages.find(
        (stage) => stage.key === "cmu_plaster_render",
      )?.status,
    ).toBe("no_go");
    expect(snapshot.issues).toContainEqual(
      expect.objectContaining({
        code: "missing_infill_blocks",
        path: `blockInstances.${firstPanelId}`,
      }),
    );
  });

  it("fails loudly when an expected RC infill bay panel is missing", () => {
    const geometry = rcFrameGeometry({ lengthMeters: 15, widthMeters: 6 });
    const firstPanelId = geometry.infillSystem!.panels.find(
      (panel) => panel.infillZone !== "below_grade",
    )!.id;
    const brokenGeometry: DesignGeometryResult = {
      ...geometry,
      infillSystem: {
        ...geometry.infillSystem!,
        panels: geometry.infillSystem!.panels.filter(
          (panel) => panel.id !== firstPanelId,
        ),
      },
    };

    const snapshot = createDesignBuilderRcFrameDebugSnapshot({
      geometryResult: brokenGeometry,
    });

    expect(snapshot.status).toBe("no_go");
    expect(snapshot.stageStatus.infill).toBe("no_go");
    expect(
      snapshot.pipeline.pipelineStages.find(
        (stage) => stage.key === "infill_panel_bays",
      )?.status,
    ).toBe("no_go");
    expect(snapshot.issues).toContainEqual(
      expect.objectContaining({
        code: "missing_infill_panel",
      }),
    );
  });

  it("fails loudly when RC infill panels have the right count but duplicate one bay range", () => {
    const geometry = rcFrameGeometry({ lengthMeters: 15, widthMeters: 6 });
    const aboveGradePanels = geometry.infillSystem!.panels.filter(
      (panel) => panel.infillZone !== "below_grade",
    );
    const hostSegmentId = aboveGradePanels.find(
      (panel) =>
        aboveGradePanels.filter((candidate) => candidate.hostSegmentId === panel.hostSegmentId)
          .length > 1,
    )!.hostSegmentId;
    const firstPanel = aboveGradePanels.find(
      (panel) => panel.hostSegmentId === hostSegmentId,
    )!;
    const secondPanel = aboveGradePanels.find(
      (panel) => panel.hostSegmentId === hostSegmentId && panel.id !== firstPanel.id,
    )!;
    const brokenGeometry: DesignGeometryResult = {
      ...geometry,
      infillSystem: {
        ...geometry.infillSystem!,
        panels: geometry.infillSystem!.panels.map((panel) =>
          panel.id === secondPanel.id
            ? {
                ...panel,
                startStationMeters: firstPanel.startStationMeters,
                endStationMeters: firstPanel.endStationMeters,
              }
            : panel,
        ),
      },
    };

    const snapshot = createDesignBuilderRcFrameDebugSnapshot({
      geometryResult: brokenGeometry,
    });

    expect(snapshot.status).toBe("no_go");
    expect(snapshot.stageStatus.infill).toBe("no_go");
    expect(
      snapshot.pipeline.pipelineStages.find(
        (stage) => stage.key === "infill_panel_bays",
      )?.status,
    ).toBe("no_go");
    expect(snapshot.issues).toContainEqual(
      expect.objectContaining({
        code: "missing_infill_panel",
        path: `infillSystem.panels.${hostSegmentId}`,
      }),
    );
    expect(
      snapshot.infillHealth.segmentHealth.find(
        (segment) => segment.hostSegmentId === hostSegmentId,
      )?.missingExpectedBayIds.length,
    ).toBe(1);
    expect(
      snapshot.infillHealth.segmentHealth.find(
        (segment) => segment.hostSegmentId === hostSegmentId,
      )?.unmatchedAboveGradePanelIds,
    ).toContain(secondPanel.id);
    expect(snapshot.issues).toContainEqual(
      expect.objectContaining({
        code: "unmatched_infill_panel",
        path: `infillSystem.panels.${hostSegmentId}`,
      }),
    );
  });

  it("flags Material Preview when the viewer does not activate preview materials", () => {
    const snapshot = createDesignBuilderRcFrameDebugSnapshot({
      geometryResult: rcFrameGeometry({ lengthMeters: 5, widthMeters: 8 }),
      visualStyle: "material_preview",
      usePreviewMaterials: false,
      previewMaterialsReady: false,
    });

    expect(snapshot.status).toBe("no_go");
    expect(snapshot.stageStatus.materialPreview).toBe("no_go");
    expect(snapshot.issues).toContainEqual(
      expect.objectContaining({
        code: "material_preview_not_active",
      }),
    );
  });
});
