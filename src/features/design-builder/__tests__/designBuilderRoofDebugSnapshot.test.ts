import { describe, expect, it } from "vitest";
import { resolveDesignBuilderGeometryPipeline } from "../application/designBuilderGeometryPipeline";
import { createDesignBuilderRoofDebugSnapshot } from "../domain/designBuilderRoofDebugSnapshot";
import { createFiveBySixCmuBuildingPreset } from "../domain/designBuilderPreset";
import { syncPresetFromLayout } from "../domain/layoutWallAdapter";
import {
  createDefaultRoofSystemSettings,
  normalizeRoofSystemSettings,
} from "../domain/roofSystemDefaults";
import { applyAutoFrameLayout } from "../domain/structureActions";
import { createOutsideFaceRectangleLayout } from "../domain/wallLayoutRules";
import type { DesignGeometryResult } from "../geometry/designGeometry";
import type { RoofSystemSettings } from "../types";

type Scenario = {
  label: string;
  lengthMeters: number;
  widthMeters: number;
};

const RECTANGULAR_SCENARIOS: Scenario[] = [
  { label: "5m x 8m", lengthMeters: 5, widthMeters: 8 },
  { label: "8m x 5m", lengthMeters: 8, widthMeters: 5 },
  { label: "15m x 6m", lengthMeters: 15, widthMeters: 6 },
  { label: "6m x 15m", lengthMeters: 6, widthMeters: 15 },
  { label: "9.94m x 18.91m", lengthMeters: 9.94, widthMeters: 18.91 },
  { label: "18.91m x 9.94m", lengthMeters: 18.91, widthMeters: 9.94 },
  { label: "11.44m x 15.33m", lengthMeters: 11.44, widthMeters: 15.33 },
  { label: "15.33m x 11.44m", lengthMeters: 15.33, widthMeters: 11.44 },
  { label: "10.66m x 18.59m", lengthMeters: 10.66, widthMeters: 18.59 },
  { label: "18.59m x 10.66m", lengthMeters: 18.59, widthMeters: 10.66 },
  { label: "35m x 6m", lengthMeters: 35, widthMeters: 6 },
  { label: "6m x 35m", lengthMeters: 6, widthMeters: 35 },
];

function gableRoofSystem(
  overrides: Partial<RoofSystemSettings> = {},
): RoofSystemSettings {
  const defaults = createDefaultRoofSystemSettings();
  return normalizeRoofSystemSettings({
    ...defaults,
    roofType: "gable",
    ridgeDirection: "along_longest_axis",
    eaveOverhangMeters: 0.3,
    gableEndOverhangMeters: 0.3,
    gable: {
      ...defaults.gable,
      enabled: true,
      rakedConcreteCapEnabled: true,
    },
    purlins: {
      ...defaults.purlins,
      enabled: true,
    },
    steelTrusses: {
      ...defaults.steelTrusses,
      enabled: true,
    },
    ...overrides,
  });
}

function scenarioGeometry(
  scenario: Scenario,
  roofSystem = gableRoofSystem(),
): {
  geometry: DesignGeometryResult;
  roofSystem: RoofSystemSettings;
  slabTopMeters: number;
} {
  const template = createFiveBySixCmuBuildingPreset();
  const layout = createOutsideFaceRectangleLayout({
    lengthMeters: scenario.lengthMeters,
    widthMeters: scenario.widthMeters,
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
  const preset = applyAutoFrameLayout(synced);

  return {
    geometry: resolveDesignBuilderGeometryPipeline({
      wallLayout: preset.wallLayout,
      effectiveWall: preset.wall,
      resolvedPreset: {
        ...preset,
        buildingSystemMode: "reinforced_concrete_frame_with_cmu_infill",
      },
      footprintClosed: true,
      activeRoofSystem: roofSystem,
    }).designGeometryResult,
    roofSystem,
    slabTopMeters: preset.slab.slabThicknessMeters,
  };
}

describe("createDesignBuilderRoofDebugSnapshot", () => {
  it.each(RECTANGULAR_SCENARIOS)(
    "summarizes complete RC-frame gable roof geometry for $label",
    (scenario) => {
      const { geometry, roofSystem, slabTopMeters } =
        scenarioGeometry(scenario);

      const snapshot = createDesignBuilderRoofDebugSnapshot({
        geometryResult: geometry,
        roofSystem,
        slabTopMeters,
      });

      expect(snapshot.sourcePath).toBe("layout_graph");
      expect(snapshot.buildingSystemMode).toBe(
        "reinforced_concrete_frame_with_cmu_infill",
      );
      expect(snapshot.settings.roofType).toBe("gable");
      expect(snapshot.settings.supportSystem).toBe("steel_trusses");
      expect(snapshot.resolvedRoof.present).toBe(true);
      expect(snapshot.resolvedRoof.supported).toBe(true);
      expect(snapshot.resolvedRoof.bearingSource).toBe("roof_beam_outer_faces");
      expect(snapshot.resolvedRoof.roofBeamTopY).toBeGreaterThan(0);
      expect(snapshot.resolvedRoof.roofPeakY).toBeGreaterThan(
        snapshot.resolvedRoof.roofBeamTopY ?? 0,
      );
      expect(
        snapshot.resolvedRoof.structuralBearingBounds?.widthMeters ?? 0,
      ).toBeGreaterThan(0);
      expect(
        snapshot.resolvedRoof.structuralBearingBounds?.depthMeters ?? 0,
      ).toBeGreaterThan(0);
      expect(
        snapshot.resolvedRoof.claddingBounds?.widthMeters ?? 0,
      ).toBeGreaterThan(
        snapshot.resolvedRoof.structuralBearingBounds?.widthMeters ?? 0,
      );
      expect(
        snapshot.resolvedRoof.claddingBounds?.depthMeters ?? 0,
      ).toBeGreaterThan(
        snapshot.resolvedRoof.structuralBearingBounds?.depthMeters ?? 0,
      );
      expect(snapshot.counts.roofTopPlanes).toBe(2);
      expect(snapshot.counts.claddingDisplayPlanes).toBe(2);
      expect(snapshot.counts.purlins).toBeGreaterThan(0);
      expect(snapshot.trusses.count).toBeGreaterThan(0);
      expect(snapshot.trusses.bounds?.widthMeters ?? 0).toBeGreaterThan(0);
      expect(snapshot.trusses.bounds?.depthMeters ?? 0).toBeGreaterThan(0);
      expect(
        snapshot.trusses.first?.topChordLengthMeters.left ?? 0,
      ).toBeGreaterThan(0);
      expect(
        snapshot.trusses.first?.topChordLengthMeters.right ?? 0,
      ).toBeGreaterThan(0);
      expect(
        snapshot.trusses.first?.eaveExtensionLengthMeters.left ?? 0,
      ).toBeGreaterThan(0);
      expect(
        snapshot.trusses.first?.eaveExtensionLengthMeters.right ?? 0,
      ).toBeGreaterThan(0);
      expect(snapshot.gableEnd.count).toBe(2);
      expect(snapshot.gableEnd.segmentIds).toHaveLength(2);
      expect(snapshot.gableEnd.cmuBlockCount).toBeGreaterThan(0);
      expect(snapshot.rakedCaps.count).toBeGreaterThan(0);
      expect(snapshot.rakedCaps.volumeCubicMeters).toBeGreaterThan(0);
      expect(snapshot.issues).toEqual([]);
    },
  );

  it("reports missing roof geometry instead of silently returning empty counts", () => {
    const snapshot = createDesignBuilderRoofDebugSnapshot({
      geometryResult: null,
      roofSystem: gableRoofSystem(),
      slabTopMeters: null,
    });

    expect(snapshot.sourcePath).toBe("missing_geometry");
    expect(snapshot.resolvedRoof.present).toBe(false);
    expect(snapshot.resolvedRoof.supported).toBe(false);
    expect(snapshot.issues).toContainEqual({
      path: "geometry.resolvedRoofSystem",
      code: "missing",
      message: "No resolved roof system is available for this geometry result.",
    });
  });

  it("flags non-finite roof coordinates for broken solver output", () => {
    const { geometry, roofSystem, slabTopMeters } = scenarioGeometry(
      RECTANGULAR_SCENARIOS[0]!,
    );
    const roof = geometry.resolvedRoofSystem!;
    const brokenGeometry: DesignGeometryResult = {
      ...geometry,
      resolvedRoofSystem: {
        ...roof,
        structuralBearingPerimeter: [
          ...roof.structuralBearingPerimeter,
          { x: Number.NaN, y: roof.roofBeamTopY, z: 0 },
        ],
      },
    };

    const snapshot = createDesignBuilderRoofDebugSnapshot({
      geometryResult: brokenGeometry,
      roofSystem,
      slabTopMeters,
    });

    expect(snapshot.issues).toContainEqual({
      path: `roof.structuralBearingPerimeter[${roof.structuralBearingPerimeter.length}]`,
      code: "non_finite",
      message: "Point contains a non-finite coordinate.",
    });
  });
});
