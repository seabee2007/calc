import { describe, expect, it } from "vitest";
import { createFiveBySixCmuBuildingPreset } from "../domain/designBuilderPreset";
import { applyAutoFrameLayout } from "../domain/structureActions";
import {
  createDefaultRcFrameFoundationSettings,
  migrateLegacyFoundationSettings,
  normalizeRcFrameFoundationSettings,
} from "../domain/rcFrameFoundationMigration";
import {
  FOUNDATION_CONTACT_EPSILON_METERS,
  resolveFoundationElevations,
  resolveStructuralConcreteVolumes,
  TOP_OF_PLINTH_BEAM_Y,
} from "../domain/foundationElevations";
import {
  autoFrameLayout,
  findColumnAtNode,
} from "../domain/structuralFrameLayout";
import {
  buildDesignGeometryInputFromLayout,
  generateDesignGeometry,
  getSegmentFramesForWallLayout,
} from "../geometry/designGeometry";
import type {
  LegacyStructuralFoundationSettings,
  RcFrameFoundationSettings,
} from "../types";

describe("RC frame foundation — plinth / roof / tie beams", () => {
  const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
  const foundation = normalizeRcFrameFoundationSettings(
    preset.foundationSettings,
  );
  const wallHeightMeters = preset.wallLayout.defaultWallHeightMeters;
  const elevations = resolveFoundationElevations({
    foundation,
    wallHeightMeters,
  });
  const frames = getSegmentFramesForWallLayout(preset.wallLayout, preset.wall);

  function geometryForPreset() {
    return generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: preset.wallLayout,
        cmuSettings: preset.wall,
        slabSettings: preset.slab,
        roofSettings: preset.roof,
        trussSettings: preset.truss,
        buildingSystemMode: "reinforced_concrete_frame_with_cmu_infill",
        frameSystem: preset.frameSystem,
        foundationSettings: foundation,
        infillSystem: preset.infillSystem,
        gableEndSystem: preset.gableEndSystem,
      }),
    );
  }

  it("migrates legacy grade beam to plinth beam", () => {
    const legacy: LegacyStructuralFoundationSettings = {
      gradeBeam: {
        enabled: true,
        widthMeters: 0.4,
        depthMeters: 0.5,
        followsExteriorSegments: true,
        followsInteriorSegments: false,
      },
      isolatedFootings: {
        enabled: true,
        placementMode: "at_columns",
        footingWidthMeters: 1.5,
        footingLengthMeters: 1.5,
        footingThicknessMeters: 0.5,
        dropBelowGradeBeamMeters: 0.8,
        autoCreateAtStructuralColumns: true,
      },
    };
    const migrated = migrateLegacyFoundationSettings(legacy);
    expect(migrated.plinthBeam.widthMeters).toBe(0.4);
    expect(migrated.plinthBeam.depthMeters).toBe(0.5);
    expect(migrated.roofBeam.widthMeters).toBe(migrated.columns.widthMeters);
    expect(migrated.roofBeam.depthMeters).toBe(migrated.columns.depthMeters);
    expect(migrated.columns.placementMode).toBe("corners_and_intermediate");
    expect(migrated.columns.intermediateSpacingMeters).toBe(4);
    expect(migrated.isolatedFootings.dropBelowPlinthBeamMeters).toBeGreaterThan(
      0,
    );
  });

  it("migrates legacy ring beam to roof beam", () => {
    const legacy: LegacyStructuralFoundationSettings = {
      gradeBeam: {
        enabled: true,
        widthMeters: 0.3,
        depthMeters: 0.45,
        followsExteriorSegments: true,
        followsInteriorSegments: false,
      },
      ringBeam: {
        enabled: true,
        widthMeters: 0.28,
        depthMeters: 0.32,
      },
      isolatedFootings: {
        enabled: true,
        placementMode: "at_columns",
        footingWidthMeters: 1.2,
        footingLengthMeters: 1.2,
        footingThicknessMeters: 0.45,
        dropBelowGradeBeamMeters: 0.6,
        autoCreateAtStructuralColumns: true,
      },
    };
    const migrated = migrateLegacyFoundationSettings(legacy);
    expect(migrated.roofBeam.widthMeters).toBe(0.28);
    expect(migrated.roofBeam.depthMeters).toBe(0.32);
  });

  it("migrates intermediate dropBelowTieBeamMeters settings safely", () => {
    const intermediate = {
      ...createDefaultRcFrameFoundationSettings(),
      tieBeam: {
        enabled: true,
        widthMeters: 0.25,
        depthMeters: 0.3,
        dropBelowPlinthBeamMeters: 0.6,
      },
      isolatedFootings: {
        ...createDefaultRcFrameFoundationSettings().isolatedFootings,
        dropBelowTieBeamMeters: 0.6,
        dropBelowPlinthBeamMeters: undefined as unknown as number,
      },
    };
    const migrated = normalizeRcFrameFoundationSettings(
      intermediate as RcFrameFoundationSettings,
    );
    expect(migrated.tieBeam).not.toHaveProperty("dropBelowPlinthBeamMeters");
    expect(migrated.isolatedFootings.dropBelowPlinthBeamMeters).toBeCloseTo(
      1.5,
      6,
    );
    expect(migrated.isolatedFootings).not.toHaveProperty(
      "dropBelowTieBeamMeters",
    );
  });

  it("derives CMU clear height from column height above plinth minus roof beam depth", () => {
    const customFoundation = normalizeRcFrameFoundationSettings({
      ...foundation,
      columns: {
        ...foundation.columns,
        heightAbovePlinthMeters: 3.5,
      },
    });
    const customElevations = resolveFoundationElevations({
      foundation: customFoundation,
      wallHeightMeters,
    });
    expect(customElevations.columnHeightAbovePlinthMeters).toBeCloseTo(3.5, 6);
    expect(customElevations.cmuClearHeightMeters).toBeCloseTo(
      3.5 - customFoundation.roofBeam.depthMeters,
      6,
    );
    expect(customElevations.roofBeamTopY).toBeCloseTo(3.5, 6);
  });

  it("places top of plinth beam at Y = 0", () => {
    expect(elevations.topOfPlinthBeamY).toBe(TOP_OF_PLINTH_BEAM_Y);
    const plinthBeam = preset.frameSystem.beams.find(
      (beam) => beam.kind === "plinth_beam",
    );
    expect(plinthBeam?.topElevationMeters).toBeCloseTo(0, 6);
  });

  it("derives footing top from bottom of plinth beam minus footing drop", () => {
    expect(elevations.topOfFootingY).toBeCloseTo(
      elevations.bottomOfPlinthBeamY -
        foundation.isolatedFootings.dropBelowPlinthBeamMeters,
      6,
    );
  });

  it("places bottom of tie beam exactly on top of footing", () => {
    expect(elevations.bottomOfTieBeamY).toBeCloseTo(
      elevations.topOfFootingY,
      9,
    );
    const tieBeam = preset.frameSystem.beams.find(
      (beam) => beam.kind === "tie_beam",
    );
    expect(tieBeam?.baseElevationMeters).toBeCloseTo(
      elevations.topOfFootingY,
      9,
    );
    for (const footing of geometryForPreset().isolatedFootings ?? []) {
      expect(footing.topElevationMeters).toBeCloseTo(
        elevations.topOfFootingY,
        9,
      );
      expect(tieBeam!.baseElevationMeters).toBeCloseTo(
        footing.topElevationMeters,
        9,
      );
    }
  });

  it("derives tie beam top from footing top plus tie-beam depth", () => {
    expect(elevations.topOfTieBeamY).toBeCloseTo(
      elevations.topOfFootingY + foundation.tieBeam.depthMeters,
      9,
    );
    const tieBeam = preset.frameSystem.beams.find(
      (beam) => beam.kind === "tie_beam",
    );
    expect(tieBeam?.topElevationMeters).toBeCloseTo(
      elevations.topOfTieBeamY,
      9,
    );
  });

  it("has no render gap between footing top and tie beam bottom", () => {
    const geometry = geometryForPreset();
    const tieBeam = preset.frameSystem.beams.find(
      (beam) => beam.kind === "tie_beam",
    )!;
    for (const footing of geometry.isolatedFootings ?? []) {
      const gap = Math.abs(
        tieBeam.baseElevationMeters - footing.topElevationMeters,
      );
      expect(gap).toBeLessThanOrEqual(FOUNDATION_CONTACT_EPSILON_METERS);
    }
  });

  it("extends columns from footing top through all beam elevations", () => {
    const roofBeam = preset.frameSystem.beams.find(
      (beam) => beam.kind === "roof_beam",
    );
    const plinthBeam = preset.frameSystem.beams.find(
      (beam) => beam.kind === "plinth_beam",
    );
    const tieBeam = preset.frameSystem.beams.find(
      (beam) => beam.kind === "tie_beam",
    );
    for (const column of preset.frameSystem.columns) {
      expect(column.baseElevationMeters).toBeCloseTo(
        elevations.topOfFootingY,
        6,
      );
      expect(column.topElevationMeters).toBeCloseTo(
        roofBeam!.topElevationMeters,
        6,
      );
      expect(column.baseElevationMeters).toBeLessThan(
        tieBeam!.topElevationMeters,
      );
      expect(column.topElevationMeters).toBeGreaterThan(
        plinthBeam!.topElevationMeters,
      );
    }
  });

  it("uses Footing Drop Below Plinth Beam on isolated footings settings", () => {
    expect(foundation.isolatedFootings).toHaveProperty(
      "dropBelowPlinthBeamMeters",
    );
    expect(foundation.isolatedFootings).not.toHaveProperty(
      "dropBelowTieBeamMeters",
    );
    expect(foundation.tieBeam).not.toHaveProperty("dropBelowPlinthBeamMeters");
  });

  it("does not double-count footing, tie beam, and column overlap in quantities", () => {
    const geometry = geometryForPreset();
    const breakdown = geometry.structuralConcreteVolumeBreakdown!;
    const volumes = resolveStructuralConcreteVolumes({
      columns: preset.frameSystem.columns,
      beams: preset.frameSystem.beams,
      footings: geometry.isolatedFootings ?? [],
      elevations,
    });
    const naiveTotal =
      volumes.plinthBeamVolumeCubicMeters +
      volumes.roofBeamVolumeCubicMeters +
      volumes.tieBeamVolumeCubicMeters +
      volumes.columnBelowPlinthVolumeCubicMeters +
      volumes.columnAbovePlinthVolumeCubicMeters +
      volumes.footingVolumeCubicMeters;
    expect(breakdown.totalDeduplicatedVolumeCubicMeters).toBeLessThan(
      naiveTotal,
    );
    expect(breakdown.footingVolumeCubicMeters).toBeGreaterThan(0);
    expect(breakdown.tieBeamVolumeCubicMeters).toBeGreaterThan(0);
  });

  it("renders all three beam kinds separately", () => {
    expect(
      preset.frameSystem.beams.some((beam) => beam.kind === "plinth_beam"),
    ).toBe(true);
    expect(
      preset.frameSystem.beams.some((beam) => beam.kind === "roof_beam"),
    ).toBe(true);
    expect(
      preset.frameSystem.beams.some((beam) => beam.kind === "tie_beam"),
    ).toBe(true);
  });

  it("sets CMU infill base at plinth top with interior floor slab flush at same elevation", () => {
    const geometry = geometryForPreset();
    const aboveGradePanels = geometry.infillSystem?.panels.filter(
      (panel) => panel.infillZone !== "below_grade",
    );
    aboveGradePanels?.forEach((panel) => {
      expect(panel.bottomElevationMeters).toBeCloseTo(0, 6);
      expect(panel.topElevationMeters).toBeCloseTo(wallHeightMeters, 6);
    });
    expect(geometry.interiorFloorSlab?.topElevationMeters).toBeCloseTo(0, 6);
    expect(geometry.interiorFloorSlab?.bottomElevationMeters).toBeLessThan(0);
  });

  it("keeps existing RC Frame + CMU Infill designs valid via normalization", () => {
    const legacyPreset = createFiveBySixCmuBuildingPreset();
    legacyPreset.foundationSettings = {
      gradeBeam: {
        enabled: true,
        widthMeters: 0.3,
        depthMeters: 0.45,
        followsExteriorSegments: true,
        followsInteriorSegments: false,
      },
      isolatedFootings: {
        enabled: true,
        placementMode: "at_columns",
        footingWidthMeters: 1.2,
        footingLengthMeters: 1.2,
        footingThicknessMeters: 0.45,
        dropBelowGradeBeamMeters: 0.6,
        autoCreateAtStructuralColumns: true,
      },
    };
    const normalized = applyAutoFrameLayout(legacyPreset);
    const settings = normalizeRcFrameFoundationSettings(
      normalized.foundationSettings,
    );
    expect(settings.plinthBeam.enabled).toBe(true);
    expect(settings.isolatedFootings.dropBelowPlinthBeamMeters).toBeGreaterThan(
      0,
    );
    expect(normalized.frameSystem.columns.length).toBeGreaterThan(0);
  });

  it("reconciles auto frame layout with foundation settings", () => {
    const result = autoFrameLayout({
      layout: preset.wallLayout,
      segmentFrames: frames,
      frameSystem: preset.frameSystem,
      foundation,
    });
    expect(result.isolatedFootings.length).toBeGreaterThan(0);
    expect(
      result.frameSystem.beams.some((beam) => beam.kind === "plinth_beam"),
    ).toBe(true);
    expect(
      result.frameSystem.beams.some((beam) => beam.kind === "roof_beam"),
    ).toBe(true);
    expect(
      result.frameSystem.beams.some((beam) => beam.kind === "tie_beam"),
    ).toBe(true);
  });

  it("does not duplicate footings at shared corner columns", () => {
    for (const node of preset.wallLayout.nodes) {
      const column = findColumnAtNode(preset.frameSystem.columns, node.id)!;
      const footingsForColumn =
        geometryForPreset().isolatedFootings?.filter(
          (footing) => footing.columnId === column.id,
        ) ?? [];
      expect(footingsForColumn).toHaveLength(1);
    }
  });
});
