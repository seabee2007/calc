import { describe, expect, it } from "vitest";
import { resolveDesignBuilderGeometryPipeline } from "../application/designBuilderGeometryPipeline";
import {
  createDesignBuilderRcFrameDebugSnapshot,
  DEFAULT_RECOMMENDED_RC_FRAME_SPAN_METERS,
} from "../domain/designBuilderRcFrameDebugSnapshot";
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
  it("adds default intermediate supports without over-spanning a small RC frame", () => {
    const snapshot = createDesignBuilderRcFrameDebugSnapshot({
      geometryResult: rcFrameGeometry({ lengthMeters: 5, widthMeters: 6 }),
    });

    expect(snapshot.columnCount).toBe(8);
    expect(snapshot.footingCount).toBe(8);
    expect(snapshot.longestRoofBeamSpanMeters).toBeLessThanOrEqual(
      DEFAULT_RECOMMENDED_RC_FRAME_SPAN_METERS,
    );
    expect(snapshot.spanIssues).toEqual([]);
  });

  it("keeps a 35m long RC frame within the default 4m intermediate support spacing", () => {
    const snapshot = createDesignBuilderRcFrameDebugSnapshot({
      geometryResult: rcFrameGeometry({ lengthMeters: 35, widthMeters: 6 }),
    });

    expect(snapshot.columnCount).toBe(22);
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
    expect(snapshot.longestRoofBeamSpanMeters).toBeGreaterThan(
      DEFAULT_RECOMMENDED_RC_FRAME_SPAN_METERS,
    );
    expect(
      snapshot.spanIssues.some((issue) => issue.beamKind === "roof_beam"),
    ).toBe(true);
  });
});
