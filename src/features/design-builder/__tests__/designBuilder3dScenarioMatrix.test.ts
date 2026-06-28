import { describe, expect, it } from "vitest";
import { createFiveBySixCmuBuildingPreset } from "../domain/designBuilderPreset";
import { resolveDesignBuilderGeometryPipeline } from "../application/designBuilderGeometryPipeline";
import { syncPresetFromLayout } from "../domain/layoutWallAdapter";
import {
  createDefaultRoofSystemSettings,
  normalizeRoofSystemSettings,
} from "../domain/roofSystemDefaults";
import {
  CORRUGATED_SHEET_DISPLAY_THICKNESS_METERS,
  distanceAlongRoofNormal,
  elevationOnRoofPlaneAtPoint,
  normalizeOutwardRoofNormal,
  offsetPointAlongRoofNormal,
  PURLIN_PROFILE_DEPTH_METERS,
  PURLIN_TO_SHEET_CLEARANCE_METERS,
  spanEdgesPerpendicularToRidge,
  TRUSS_CHORD_PROFILE_METERS,
} from "../domain/roofFramingResolver";
import { distancePointToLine2D, midpoint2 } from "../domain/roofFootprintSupport";
import { applyAutoFrameLayout } from "../domain/structureActions";
import { createOutsideFaceRectangleLayout } from "../domain/wallLayoutRules";
import type { DesignGeometryResult } from "../geometry/designGeometry";
import type { RoofSystemSettings, SteelMemberSegment } from "../types";

type Scenario = {
  label: string;
  lengthMeters: number;
  widthMeters: number;
};

type ResolvedScenarioRoof = NonNullable<DesignGeometryResult["resolvedRoofSystem"]>;

const RECTANGULAR_SCENARIOS: Scenario[] = [
  { label: "5m x 8m", lengthMeters: 5, widthMeters: 8 },
  { label: "8m x 5m", lengthMeters: 8, widthMeters: 5 },
  { label: "15m x 6m", lengthMeters: 15, widthMeters: 6 },
  { label: "6m x 15m", lengthMeters: 6, widthMeters: 15 },
  { label: "16m x 5m", lengthMeters: 16, widthMeters: 5 },
  { label: "5m x 16m", lengthMeters: 5, widthMeters: 16 },
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
): DesignGeometryResult {
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

  return resolveDesignBuilderGeometryPipeline({
    wallLayout: preset.wallLayout,
    effectiveWall: preset.wall,
    resolvedPreset: {
      ...preset,
      buildingSystemMode: "reinforced_concrete_frame_with_cmu_infill",
    },
    footprintClosed: true,
    activeRoofSystem: roofSystem,
  }).designGeometryResult;
}

function blockBottomY(block: {
  y: number;
  heightMeters?: number;
  physicalHeightMeters?: number;
}): number {
  const height = block.physicalHeightMeters ?? block.heightMeters ?? 0;
  return block.y - height / 2;
}

function assertPrimaryTopChordSeatedOnStructuralBearing(params: {
  member: SteelMemberSegment;
  bearing: { x: number; y: number; z: number };
  apex: { x: number; y: number; z: number };
}) {
  expect(params.member.start.x).toBeCloseTo(params.bearing.x, 4);
  expect(params.member.start.z).toBeCloseTo(params.bearing.z, 4);
  expect(params.member.start.y).toBeCloseTo(
    params.bearing.y + TRUSS_CHORD_PROFILE_METERS / 2,
    4,
  );
  expect(params.member.end.x).toBeCloseTo(params.apex.x, 4);
  expect(params.member.end.y).toBeCloseTo(params.apex.y, 4);
  expect(params.member.end.z).toBeCloseTo(params.apex.z, 4);
}

function roundMeters(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function expectedStructuralHalfRunFromRidge(roof: ResolvedScenarioRoof): number {
  expect(roof.structuralRidgeStart).toBeDefined();
  expect(roof.structuralRidgeEnd).toBeDefined();
  const structuralBearing = roof.structuralBearingPerimeter.map((point) => ({
    x: point.x,
    z: point.z,
  }));
  const ridgeStart2 = {
    x: roof.structuralRidgeStart!.x,
    z: roof.structuralRidgeStart!.z,
  };
  const ridgeEnd2 = {
    x: roof.structuralRidgeEnd!.x,
    z: roof.structuralRidgeEnd!.z,
  };
  const [edgeAStart, edgeAEnd, edgeBStart, edgeBEnd] =
    spanEdgesPerpendicularToRidge(structuralBearing, ridgeStart2, ridgeEnd2);
  const halfRunA = distancePointToLine2D(
    midpoint2(edgeAStart, edgeAEnd),
    ridgeStart2,
    ridgeEnd2,
  );
  const halfRunB = distancePointToLine2D(
    midpoint2(edgeBStart, edgeBEnd),
    ridgeStart2,
    ridgeEnd2,
  );
  return (halfRunA + halfRunB) / 2;
}

function assertGableHalfRunDatum(
  roof: ResolvedScenarioRoof,
  roofSystem: RoofSystemSettings,
) {
  expect(roof.structuralRafterRunMeters).toBeCloseTo(
    expectedStructuralHalfRunFromRidge(roof),
    4,
  );
  expect(roof.claddingRafterRunMeters).toBeCloseTo(
    roof.structuralRafterRunMeters + roofSystem.eaveOverhangMeters,
    4,
  );
}

function assertPurlinsTightToCladdingDisplay(
  roof: ResolvedScenarioRoof,
) {
  const displayPlaneBySourceId = new Map(
    roof.claddingDisplayPlanes.map((plane) => [
      plane.id.replace(/-cladding-display$/, ""),
      plane,
    ]),
  );
  const sourcePlaneById = new Map(
    roof.roofTopPlanes.map((plane) => [plane.id, plane]),
  );
  const maxGapMeters = PURLIN_TO_SHEET_CLEARANCE_METERS + 0.012;
  const failures: {
    slopePlaneId: string;
    rowIndex: number;
    expectedPurlinTopToDisplayUndersideGapMeters: number;
    actualPurlinTopToDisplayUndersideGapMeters: number;
    center: { x: number; z: number };
    sourceRoofPlaneY: number | null;
    purlinCenterY: number;
    purlinTopY: number;
    claddingDisplayTopY: number;
  }[] = [];

  for (const purlin of roof.purlinPlacements) {
    const displayPlane = displayPlaneBySourceId.get(purlin.slopePlaneId);
    const sourcePlane = sourcePlaneById.get(purlin.slopePlaneId);
    expect(displayPlane).toBeDefined();
    expect(sourcePlane).toBeDefined();
    const outwardNormal = normalizeOutwardRoofNormal(purlin.planeNormal);
    const center = {
      x: (purlin.start.x + purlin.end.x) / 2,
      y: (purlin.start.y + purlin.end.y) / 2,
      z: (purlin.start.z + purlin.end.z) / 2,
    };
    const purlinTop = offsetPointAlongRoofNormal(
      center,
      outwardNormal,
      PURLIN_PROFILE_DEPTH_METERS / 2,
    );
    const displayTopY = elevationOnRoofPlaneAtPoint(
      displayPlane!,
      center.x,
      center.z,
    );
    expect(displayTopY).toBeGreaterThan(0);
    const sourceRoofPlaneY = elevationOnRoofPlaneAtPoint(
      sourcePlane!,
      center.x,
      center.z,
    );
    const displayUnderside = offsetPointAlongRoofNormal(
      { x: center.x, y: displayTopY!, z: center.z },
      outwardNormal,
      -CORRUGATED_SHEET_DISPLAY_THICKNESS_METERS,
    );
    const gapMeters = distanceAlongRoofNormal(
      purlinTop,
      displayUnderside,
      outwardNormal,
    );

    if (gapMeters < -0.006 || gapMeters > maxGapMeters) {
      failures.push({
        slopePlaneId: purlin.slopePlaneId,
        rowIndex: purlin.rowIndex,
        expectedPurlinTopToDisplayUndersideGapMeters: roundMeters(
          PURLIN_TO_SHEET_CLEARANCE_METERS,
        ),
        actualPurlinTopToDisplayUndersideGapMeters: roundMeters(gapMeters),
        center: {
          x: roundMeters(center.x),
          z: roundMeters(center.z),
        },
        sourceRoofPlaneY:
          sourceRoofPlaneY == null ? null : roundMeters(sourceRoofPlaneY),
        purlinCenterY: roundMeters(center.y),
        purlinTopY: roundMeters(purlinTop.y),
        claddingDisplayTopY: roundMeters(displayTopY!),
      });
    }
  }

  expect(failures).toEqual([]);
}

function summarizeScenario(scenario: Scenario, geometry: DesignGeometryResult) {
  const roof = geometry.resolvedRoofSystem;
  return {
    scenario: scenario.label,
    sourcePath: geometry.sourcePath,
    supported: roof?.supported ?? false,
    bearingSource: roof?.roofBearingSource ?? "none",
    roofPlanes: roof?.roofTopPlanes.length ?? 0,
    displayPlanes: roof?.claddingDisplayPlanes.length ?? 0,
    gableEnds: roof?.gableEnds.length ?? 0,
    gableBlocks: geometry.blockInstances.filter(
      (block) => block.source === "gable_end_solver",
    ).length,
    rakedCaps: geometry.rakedCapPlacements?.length ?? 0,
    trusses: roof?.trussPlacements.length ?? 0,
    purlins: roof?.purlinPlacements.length ?? 0,
    roofBeamTopY: roof?.roofBeamTopY ?? 0,
    roofPeakY: roof?.roofPeakY ?? 0,
  };
}

describe("Design Builder 3D scenario matrix", () => {
  it.each(RECTANGULAR_SCENARIOS)(
    "keeps the gable roof, trusses, gable CMU, and raked caps complete for $label",
    (scenario) => {
      const roofSystem = gableRoofSystem();
      const geometry = scenarioGeometry(scenario, roofSystem);
      const roof = geometry.resolvedRoofSystem;

      expect(geometry.sourcePath).toBe("layout_graph");
      expect(roof?.supported).toBe(true);
      expect(roof?.roofType).toBe("gable");
      expect(roof?.roofBearingSource).toBe("roof_beam_outer_faces");
      expect(roof?.roofTopPlanes).toHaveLength(2);
      expect(roof?.claddingDisplayPlanes).toHaveLength(2);
      assertGableHalfRunDatum(roof!, roofSystem);
      expect(roof?.gableEndSegmentIds).toHaveLength(2);
      expect(roof?.gableEnds).toHaveLength(2);
      expect(roof?.roofPeakY ?? 0).toBeGreaterThan(roof?.roofBeamTopY ?? 0);
      expect(roof?.structuralRidgeLengthMeters ?? 0).toBeGreaterThan(
        Math.max(scenario.lengthMeters, scenario.widthMeters) * 0.6,
      );

      const roofBeams =
        geometry.frameSystem?.beams.filter(
          (beam) => beam.kind === "roof_beam",
        ) ?? [];
      expect(roofBeams.length).toBeGreaterThanOrEqual(4);
      for (const beam of roofBeams) {
        expect(beam.topElevationMeters).toBeCloseTo(roof!.roofBeamTopY, 6);
      }

      const gableBlocks = geometry.blockInstances.filter(
        (block) => block.source === "gable_end_solver",
      );
      const roofGableBlocks = roof!.gableEnds.flatMap(
        (gableEnd) => gableEnd.cmuUnitPlacements,
      );
      expect(gableBlocks.length).toBeGreaterThan(0);
      expect(roofGableBlocks).toHaveLength(gableBlocks.length);
      expect(geometry.rakedCapPlacements?.length ?? 0).toBeGreaterThan(0);
      expect(roof?.rakedCapVolumeCubicMeters ?? 0).toBeGreaterThan(0);
      expect(roof?.trussPlacements.length ?? 0).toBeGreaterThan(0);
      expect(roof?.purlinPlacements.length ?? 0).toBeGreaterThan(0);
      assertPurlinsTightToCladdingDisplay(roof!);

      for (const segmentId of roof!.gableEndSegmentIds) {
        const segmentBlocks = gableBlocks.filter(
          (block) => block.segmentId === segmentId,
        );
        const panel = geometry.infillSystem?.panels.find(
          (candidate) =>
            candidate.hostSegmentId === segmentId &&
            candidate.infillZone === "above_grade",
        );
        const roofBeam = roofBeams.find(
          (beam) => beam.hostSegmentId === segmentId,
        );
        const firstGableBottom = Math.min(...segmentBlocks.map(blockBottomY));

        expect(segmentBlocks.length).toBeGreaterThan(0);
        expect(panel).toBeDefined();
        expect(roofBeam).toBeDefined();
        expect(firstGableBottom).toBeGreaterThanOrEqual(
          panel!.topElevationMeters - 0.01,
        );
        expect(firstGableBottom).toBeLessThan(panel!.topElevationMeters + 0.05);
        expect(firstGableBottom).toBeLessThan(roofBeam!.topElevationMeters);
      }

      for (const truss of roof!.trussPlacements) {
        const topLeft = truss.members.find(
          (member) => member.memberKind === "top_chord_left",
        );
        const topRight = truss.members.find(
          (member) => member.memberKind === "top_chord_right",
        );
        const leftExtension = truss.members.find(
          (member) => member.memberKind === "top_chord_left_eave_extension",
        );
        const rightExtension = truss.members.find(
          (member) => member.memberKind === "top_chord_right_eave_extension",
        );

        expect(topLeft).toBeDefined();
        expect(topRight).toBeDefined();
        expect(leftExtension).toBeDefined();
        expect(rightExtension).toBeDefined();
        assertPrimaryTopChordSeatedOnStructuralBearing({
          member: topLeft!,
          bearing: truss.bearingLeft,
          apex: truss.apex,
        });
        assertPrimaryTopChordSeatedOnStructuralBearing({
          member: topRight!,
          bearing: truss.bearingRight,
          apex: truss.apex,
        });
        expect(leftExtension!.end).toEqual(topLeft!.start);
        expect(rightExtension!.end).toEqual(topRight!.start);
      }
    },
  );

  it("prints a compact scenario report when DESIGN_BUILDER_MATRIX_REPORT is enabled", () => {
    const summaries = RECTANGULAR_SCENARIOS.map((scenario) =>
      summarizeScenario(scenario, scenarioGeometry(scenario)),
    );

    if (process.env.DESIGN_BUILDER_MATRIX_REPORT === "1") {
      console.table(summaries);
    }

    expect(summaries.every((summary) => summary.supported)).toBe(true);
  });
});
