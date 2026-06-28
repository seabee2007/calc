import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { resolveDesignBuilderGeometryPipeline } from "../application/designBuilderGeometryPipeline";
import { createFiveBySixCmuBuildingPreset } from "../domain/designBuilderPreset";
import { syncPresetFromLayout } from "../domain/layoutWallAdapter";
import {
  createDefaultRoofSystemSettings,
  normalizeRoofSystemSettings,
} from "../domain/roofSystemDefaults";
import { collectResolvedRoofGeometryIssues } from "../domain/roofGeometryValidation";
import { applyAutoFrameLayout } from "../domain/structureActions";
import { createOutsideFaceRectangleLayout } from "../domain/wallLayoutRules";
import type { DesignGeometryResult } from "../geometry/designGeometry";
import type {
  DesignWallLayoutParameters,
  DesignWarning,
  RoofSystemSettings,
} from "../types";

const __dirname = dirname(fileURLToPath(import.meta.url));

const GABLE_SWEEP_WIDTHS_M = [3, 4, 5, 6, 7, 8, 10, 12, 15];
const GABLE_SWEEP_LENGTHS_M = [6, 8, 10, 12, 15, 18, 20, 24, 30];

type RoofDebugFixture = {
  summary?: {
    warningCodes?: string[];
    maxPurlinPlaneOffsetM?: number | null;
  };
  input?: unknown;
  roof?: {
    warnings?: DesignWarning[];
    validationIssues?: Array<{ code: string; sourceId?: string }>;
    roofTopPlanes?: Array<{ id: string }>;
    claddingDisplayPlanes?: Array<{ id: string }>;
    trussPlacements?: Array<{ stationMeters: number; id: string }>;
    purlinPlacements?: Array<{
      slopePlaneId: string;
      rowIndex: number;
      id: string;
    }>;
  };
  scene?: {
    source?: string;
    roofCladdingMeshBounds?: Array<{ id: string }>;
    trussMeshBounds?: Array<{ id: string }>;
    purlinMeshBounds?: Array<{ id: string }>;
  };
};

function gableRoofSystem(): RoofSystemSettings {
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
  });
}

function scenarioGeometry(params: {
  widthMeters: number;
  lengthMeters: number;
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
  const preset = applyAutoFrameLayout(synced);

  return resolveDesignBuilderGeometryPipeline({
    wallLayout: preset.wallLayout,
    effectiveWall: preset.wall,
    resolvedPreset: {
      ...preset,
      buildingSystemMode: "reinforced_concrete_frame_with_cmu_infill",
    },
    footprintClosed: true,
    activeRoofSystem: gableRoofSystem(),
  }).designGeometryResult;
}

function geometryFromWallLayout(
  layout: DesignWallLayoutParameters,
): DesignGeometryResult {
  const template = createFiveBySixCmuBuildingPreset();
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

  return resolveDesignBuilderGeometryPipeline({
    wallLayout: preset.wallLayout,
    effectiveWall: preset.wall,
    resolvedPreset: {
      ...preset,
      buildingSystemMode: "reinforced_concrete_frame_with_cmu_infill",
    },
    footprintClosed: true,
    activeRoofSystem: gableRoofSystem(),
  }).designGeometryResult;
}

function badFloatingRoofFixtureLayout(): DesignWallLayoutParameters {
  const nodes = [
    { id: "bad-roof-sw", x: 2.3, z: 1.0 },
    { id: "bad-roof-se", x: 8.775, z: 1.0 },
    { id: "bad-roof-ne", x: 8.775, z: 8.2 },
    { id: "bad-roof-nw", x: 2.3, z: 8.2 },
  ];
  return {
    kind: "wall_layout",
    dimensionBasis: "outside_face",
    nodes,
    segments: [
      {
        id: "bad-roof-south",
        startNodeId: "bad-roof-sw",
        endNodeId: "bad-roof-se",
        wallRole: "exterior",
        wallHeightMeters: 2.8,
        wallThicknessMeters: 0.2,
      },
      {
        id: "bad-roof-east",
        startNodeId: "bad-roof-se",
        endNodeId: "bad-roof-ne",
        wallRole: "exterior",
        wallHeightMeters: 2.8,
        wallThicknessMeters: 0.2,
      },
      {
        id: "bad-roof-north",
        startNodeId: "bad-roof-ne",
        endNodeId: "bad-roof-nw",
        wallRole: "exterior",
        wallHeightMeters: 2.8,
        wallThicknessMeters: 0.2,
      },
      {
        id: "bad-roof-west",
        startNodeId: "bad-roof-nw",
        endNodeId: "bad-roof-sw",
        wallRole: "exterior",
        wallHeightMeters: 2.8,
        wallThicknessMeters: 0.2,
      },
    ],
    isFootprintClosed: true,
    defaultWallHeightMeters: 2.8,
    defaultWallThicknessMeters: 0.2,
    snapToGrid: true,
    snapToModule: true,
    gridSpacingMeters: 0.1,
    orthogonalLock: true,
    cornerOverrides: [],
  };
}

describe("validateResolvedRoofGeometry", () => {
  it("accepts gable RC-frame rectangles across the dimension sweep", () => {
    const failures: Array<{
      widthM: number;
      lengthM: number;
      warningCodes: string[];
      maxPurlinOffsetM: number | null;
      badPlaneIds: string[];
      badPurlinIds: string[];
    }> = [];

    for (const widthM of GABLE_SWEEP_WIDTHS_M) {
      for (const lengthM of GABLE_SWEEP_LENGTHS_M) {
        const geometry = scenarioGeometry({
          widthMeters: widthM,
          lengthMeters: lengthM,
        });
        const roof = geometry.resolvedRoofSystem;
        expect(roof).toBeDefined();
        const validation = collectResolvedRoofGeometryIssues(roof!);
        if (validation.issues.length > 0) {
          failures.push({
            widthM,
            lengthM,
            warningCodes: [
              ...new Set(validation.issues.map((issue) => issue.code)),
            ].sort(),
            maxPurlinOffsetM: validation.metrics.maxPurlinPlaneOffsetM,
            badPlaneIds: validation.metrics.badPlaneIds,
            badPurlinIds: validation.metrics.badPurlinIds,
          });
        }
      }
    }

    expect(failures).toEqual([]);
  });

  it("flags cladding ridge endpoints when display plane elevations disagree", () => {
    const roof = scenarioGeometry({
      widthMeters: 5,
      lengthMeters: 8,
    }).resolvedRoofSystem!;
    const firstDisplayPlane = roof.claddingDisplayPlanes[0]!;

    const validation = collectResolvedRoofGeometryIssues({
      ...roof,
      claddingDisplayPlanes: roof.claddingDisplayPlanes.map((plane) =>
        plane.id === firstDisplayPlane.id
          ? {
              ...plane,
              corners: plane.corners.map((corner) =>
                ({ ...corner, y: corner.y + 0.25 }),
              ),
            }
          : plane,
      ),
    });

    expect(validation.issues).toContainEqual(
      expect.objectContaining({
        code: "roof_ridge_not_on_cladding_planes",
        sourceId: "cladding-ridge-start",
      }),
    );
  });

  it("keeps purlins seated on the bad floating-roof fixture footprint", () => {
    const roof = geometryFromWallLayout(
      badFloatingRoofFixtureLayout(),
    ).resolvedRoofSystem!;
    const validation = collectResolvedRoofGeometryIssues(roof);
    const warningCodes = new Set([
      ...roof.warnings.map((warning) => warning.code),
      ...validation.issues.map((issue) => issue.code),
    ]);

    expect(warningCodes.has("purlin_endpoint_outside_roof_plane")).toBe(false);
    expect(warningCodes.has("purlin_to_cladding_underside_gap_invalid")).toBe(
      false,
    );
    expect(validation.metrics.maxPurlinPlaneOffsetM).toBeGreaterThan(0.05);
    expect(validation.metrics.maxPurlinPlaneOffsetM).toBeLessThan(0.2);

    const purlinYByPlane = new Map<string, number[]>();
    for (const purlin of roof.purlinPlacements) {
      const entries = purlinYByPlane.get(purlin.slopePlaneId) ?? [];
      entries[purlin.rowIndex] = (purlin.start.y + purlin.end.y) / 2;
      purlinYByPlane.set(purlin.slopePlaneId, entries);
    }
    for (const rowYs of purlinYByPlane.values()) {
      const finiteRows = rowYs.filter((value) => Number.isFinite(value));
      expect(new Set(finiteRows.map((value) => value.toFixed(3))).size).toBeGreaterThan(3);
      for (let index = 1; index < finiteRows.length; index += 1) {
        expect(finiteRows[index]!).toBeGreaterThan(finiteRows[index - 1]! - 0.001);
      }
    }

    const maxCladdingDisplayY = Math.max(
      ...roof.claddingDisplayPlanes.flatMap((plane) =>
        plane.corners.map((corner) => corner.y),
      ),
    );
    expect(maxCladdingDisplayY).toBeLessThanOrEqual(roof.roofPeakY + 0.35);
  });
});

describe("roof debug fixture runner", () => {
  it("loads copied roof debug snapshots and verifies stable sections", () => {
    const fixtureDir = join(__dirname, "..", "__fixtures__", "roof-debug");
    const files = existsSync(fixtureDir)
      ? readdirSync(fixtureDir)
          .filter((fileName) => fileName.endsWith(".json"))
          .sort()
      : [];

    expect(Array.isArray(files)).toBe(true);

    for (const fileName of files) {
      const snapshot = JSON.parse(
        readFileSync(join(fixtureDir, fileName), "utf8"),
      ) as RoofDebugFixture;

      expect(snapshot.summary).toBeDefined();
      expect(snapshot.input).toBeDefined();
      expect(snapshot.roof).toBeDefined();
      expect(snapshot.summary?.warningCodes ?? []).toEqual(
        [...(snapshot.summary?.warningCodes ?? [])].sort(),
      );
      expect(
        (snapshot.roof?.warnings ?? []).map(
          (warning) => `${warning.code}:${warning.message}`,
        ),
      ).toEqual(
        [
          ...(snapshot.roof?.warnings ?? []).map(
            (warning) => `${warning.code}:${warning.message}`,
          ),
        ].sort(),
      );
      expect(snapshot.roof?.roofTopPlanes?.map((plane) => plane.id) ?? []).toEqual(
        [...(snapshot.roof?.roofTopPlanes?.map((plane) => plane.id) ?? [])].sort(),
      );
      expect(
        snapshot.roof?.claddingDisplayPlanes?.map((plane) => plane.id) ?? [],
      ).toEqual(
        [
          ...(snapshot.roof?.claddingDisplayPlanes?.map((plane) => plane.id) ??
            []),
        ].sort(),
      );
      expect(snapshot.roof?.trussPlacements ?? []).toEqual(
        [...(snapshot.roof?.trussPlacements ?? [])].sort((left, right) => {
          if (left.stationMeters !== right.stationMeters) {
            return left.stationMeters - right.stationMeters;
          }
          return left.id.localeCompare(right.id);
        }),
      );
      expect(snapshot.roof?.purlinPlacements ?? []).toEqual(
        [...(snapshot.roof?.purlinPlacements ?? [])].sort((left, right) => {
          const planeCompare = left.slopePlaneId.localeCompare(
            right.slopePlaneId,
          );
          if (planeCompare !== 0) return planeCompare;
          if (left.rowIndex !== right.rowIndex) {
            return left.rowIndex - right.rowIndex;
          }
          return left.id.localeCompare(right.id);
        }),
      );

      if (snapshot.scene) {
        expect(snapshot.scene.source).toBe("three-render-debug-snapshot");
        expectSortedBounds(snapshot.scene.roofCladdingMeshBounds ?? []);
        expectSortedBounds(snapshot.scene.trussMeshBounds ?? []);
        expectSortedBounds(snapshot.scene.purlinMeshBounds ?? []);
      }
    }
  });
});

function expectSortedBounds(bounds: Array<{ id: string }>) {
  expect(bounds.map((entry) => entry.id)).toEqual(
    [...bounds.map((entry) => entry.id)].sort(),
  );
}
