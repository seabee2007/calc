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
  promotePlacedColumnComponentsToFrameColumns,
  promotePlacedColumnComponentToFrameColumn,
} from "../domain/structuralFrameLayout";
import {
  buildDesignGeometryInputFromLayout,
  generateDesignGeometry,
  getSegmentFramesForWallLayout,
} from "../geometry/designGeometry";
import type {
  LegacyStructuralFoundationSettings,
  PlacedDesignComponent,
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

  it("promotes manual segment columns into beam splitting and isolated footing generation", () => {
    const manualPreset = createFiveBySixCmuBuildingPreset();
    const manualFoundation = normalizeRcFrameFoundationSettings({
      ...manualPreset.foundationSettings,
      columns: {
        ...manualPreset.foundationSettings.columns,
        placementMode: "corners_only",
      },
      tieBeam: {
        ...manualPreset.foundationSettings.tieBeam,
        enabled: true,
      },
      roofBeam: {
        ...manualPreset.foundationSettings.roofBeam,
        enabled: true,
      },
    });
    const manualFrames = getSegmentFramesForWallLayout(
      manualPreset.wallLayout,
      manualPreset.wall,
    );
    const hostFrame = manualFrames[0]!;
    const baseFrame = autoFrameLayout({
      layout: manualPreset.wallLayout,
      segmentFrames: manualFrames,
      frameSystem: manualPreset.frameSystem,
      foundation: manualFoundation,
    }).frameSystem;
    const clickPoint = {
      x: hostFrame.centerlineStart.x + hostFrame.tangent.x * (hostFrame.lengthMeters / 2),
      z: hostFrame.centerlineStart.z + hostFrame.tangent.z * (hostFrame.lengthMeters / 2),
    };
    const placedColumn: PlacedDesignComponent = {
      id: "component-manual-midspan",
      type: "column",
      division: "Structure",
      category: "structure",
      viewPlacement: {
        plan: { xMeters: clickPoint.x, zMeters: clickPoint.z },
      },
      parameters: {
        widthMeters: 0.3,
        depthMeters: 0.3,
        heightMeters: 3,
        baseElevationMeters: 0,
      },
      derived: { topElevationMeters: 3 },
      metadata: {
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    };

    const promoted = promotePlacedColumnComponentToFrameColumn({
      component: placedColumn,
      layout: manualPreset.wallLayout,
      segmentFrames: manualFrames,
      frameSystem: baseFrame,
      foundation: manualFoundation,
      wallHeightMeters: manualPreset.wallLayout.defaultWallHeightMeters,
    });
    expect(promoted?.added).toBe(true);
    expect(promoted?.column.source).toBe("manual_frame_layout");
    expect(promoted?.column.hostSegmentId).toBe(hostFrame.segmentId);
    expect(promoted?.column.position.x).toBeCloseTo(clickPoint.x, 6);
    expect(promoted?.column.position.z).toBeCloseTo(clickPoint.z, 6);

    const result = autoFrameLayout({
      layout: manualPreset.wallLayout,
      segmentFrames: manualFrames,
      frameSystem: {
        ...baseFrame,
        columns: [...baseFrame.columns, promoted!.column],
      },
      foundation: manualFoundation,
    });
    const manualColumn = result.frameSystem.columns.find(
      (column) => column.id === promoted!.column.id,
    );
    expect(manualColumn).toBeDefined();

    for (const kind of ["plinth_beam", "tie_beam", "roof_beam"] as const) {
      const segmentBeams = result.frameSystem.beams.filter(
        (beam) => beam.kind === kind && beam.hostSegmentId === hostFrame.segmentId,
      );
      expect(segmentBeams).toHaveLength(2);
      const connected = segmentBeams.filter(
        (beam) =>
          beam.startColumnId === manualColumn!.id ||
          beam.endColumnId === manualColumn!.id,
      );
      expect(connected).toHaveLength(2);
      connected.forEach((beam) => {
        const point =
          beam.startColumnId === manualColumn!.id
            ? beam.startPoint
            : beam.endPoint;
        expect(Math.hypot(point.x - manualColumn!.position.x, point.z - manualColumn!.position.z)).toBeCloseTo(
          Math.max(manualColumn!.widthMeters, manualColumn!.depthMeters) / 2,
          6,
        );
      });
    }

    expect(
      result.isolatedFootings.some((footing) => footing.columnId === manualColumn!.id),
    ).toBe(true);
  });

  it("promotes legacy column components idempotently and removes linked footer overlays", () => {
    const migrationPreset = createFiveBySixCmuBuildingPreset();
    const migrationFoundation = normalizeRcFrameFoundationSettings({
      ...migrationPreset.foundationSettings,
      columns: {
        ...migrationPreset.foundationSettings.columns,
        placementMode: "corners_only",
      },
    });
    const migrationFrames = getSegmentFramesForWallLayout(
      migrationPreset.wallLayout,
      migrationPreset.wall,
    );
    const baseFrame = autoFrameLayout({
      layout: migrationPreset.wallLayout,
      segmentFrames: migrationFrames,
      frameSystem: migrationPreset.frameSystem,
      foundation: migrationFoundation,
    }).frameSystem;
    const legacyColumn: PlacedDesignComponent = {
      id: "component-legacy-column",
      type: "column",
      division: "Structure",
      category: "structure",
      viewPlacement: {
        plan: { xMeters: 2.5, zMeters: 0 },
      },
      parameters: {
        widthMeters: 0.3,
        depthMeters: 0.3,
        heightMeters: 3,
        baseElevationMeters: 0,
      },
      derived: { topElevationMeters: 3 },
      references: { connectedComponentIds: ["component-legacy-footer"] },
      metadata: {
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    };
    const legacyFooter: PlacedDesignComponent = {
      id: "component-legacy-footer",
      type: "footer",
      division: "Structure",
      category: "structure",
      viewPlacement: {
        plan: { xMeters: 2.5, zMeters: 0 },
      },
      parameters: {
        widthMeters: 0.9,
        lengthMeters: 0.9,
        thicknessMeters: 0.3,
      },
      derived: { topElevationMeters: -0.3 },
      references: { hostId: legacyColumn.id },
      metadata: {
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    };

    const first = promotePlacedColumnComponentsToFrameColumns({
      placedComponents: [legacyColumn, legacyFooter],
      layout: migrationPreset.wallLayout,
      segmentFrames: migrationFrames,
      frameSystem: baseFrame,
      foundation: migrationFoundation,
      wallHeightMeters: migrationPreset.wallLayout.defaultWallHeightMeters,
    });
    expect(first.changed).toBe(true);
    expect(first.remainingPlacedComponents).toHaveLength(0);
    expect(
      first.frameSystem.columns.filter((column) => column.id === "manual-column-component-legacy-column"),
    ).toHaveLength(1);

    const second = promotePlacedColumnComponentsToFrameColumns({
      placedComponents: [legacyColumn, legacyFooter],
      layout: migrationPreset.wallLayout,
      segmentFrames: migrationFrames,
      frameSystem: first.frameSystem,
      foundation: migrationFoundation,
      wallHeightMeters: migrationPreset.wallLayout.defaultWallHeightMeters,
    });
    expect(second.remainingPlacedComponents).toHaveLength(0);
    expect(
      second.frameSystem.columns.filter((column) => column.id === "manual-column-component-legacy-column"),
    ).toHaveLength(1);
  });

  it("creates broad shallow strip footings under partition wall segments", () => {
    const partitionPreset = createFiveBySixCmuBuildingPreset();
    const startNode = partitionPreset.wallLayout.nodes[0]!;
    const endNodeId = "partition-end";
    partitionPreset.wallLayout = {
      ...partitionPreset.wallLayout,
      isFootprintClosed: false,
      nodes: [
        ...partitionPreset.wallLayout.nodes,
        { id: endNodeId, x: 0, z: 0 },
      ],
      segments: [
        ...partitionPreset.wallLayout.segments,
        {
          id: "partition-wall",
          startNodeId: startNode.id,
          endNodeId,
          wallHeightMeters: partitionPreset.wallLayout.defaultWallHeightMeters,
          wallThicknessMeters: 0.2,
          wallRole: "partition",
        },
      ],
    };
    const partitionFoundation = normalizeRcFrameFoundationSettings({
      ...partitionPreset.foundationSettings,
      isolatedFootings: {
        ...partitionPreset.foundationSettings.isolatedFootings,
        dropBelowPlinthBeamMeters: 1.2,
        thicknessMeters: 0.3,
      },
    });
    const partitionGeometry = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: partitionPreset.wallLayout,
        cmuSettings: partitionPreset.wall,
        slabSettings: partitionPreset.slab,
        roofSettings: partitionPreset.roof,
        trussSettings: partitionPreset.truss,
        buildingSystemMode: "reinforced_concrete_frame_with_cmu_infill",
        frameSystem: partitionPreset.frameSystem,
        foundationSettings: partitionFoundation,
        infillSystem: partitionPreset.infillSystem,
        gableEndSystem: partitionPreset.gableEndSystem,
      }),
    );
    const partitionFooting = partitionGeometry.wallFootings?.find(
      (footing) => footing.hostSegmentId === "partition-wall",
    );
    const partitionElevations = resolveFoundationElevations({
      foundation: partitionFoundation,
      wallHeightMeters: partitionPreset.wallLayout.defaultWallHeightMeters,
    });

    expect(partitionFooting).toBeDefined();
    expect(partitionFooting!.widthMeters).toBeCloseTo(0.6, 6);
    expect(partitionFooting!.thicknessMeters).toBeCloseTo(0.15, 6);
    expect(partitionFooting!.topElevationMeters).toBeCloseTo(
      partitionElevations.bottomOfPlinthBeamY -
        partitionFoundation.isolatedFootings.dropBelowPlinthBeamMeters / 2,
      6,
    );
    const partitionBelowGradePanel =
      partitionGeometry.infillSystem.panels.find(
        (panel) =>
          panel.hostSegmentId === "partition-wall" &&
          panel.infillZone === "below_grade",
      );
    expect(partitionBelowGradePanel).toBeDefined();
    expect(partitionBelowGradePanel!.bottomElevationMeters).toBeCloseTo(
      partitionFooting!.topElevationMeters,
      6,
    );
    expect(partitionBelowGradePanel!.topElevationMeters).toBeCloseTo(
      partitionGeometry.interiorFloorSlab!.bottomElevationMeters,
      6,
    );
    const partitionBelowGradeBounds =
      partitionGeometry.resolvedInfillPanelBounds?.find(
        (bounds) =>
          bounds.hostSegmentId === "partition-wall" &&
          bounds.panelId.includes("-below-"),
      );
    expect(partitionBelowGradeBounds).toBeDefined();
    expect(partitionBelowGradeBounds!.topElevationMeters).toBeCloseTo(
      partitionGeometry.interiorFloorSlab!.bottomElevationMeters,
      6,
    );
    expect(
      partitionBelowGradeBounds!.infillCenterlineInwardOffsetMeters,
    ).toBeCloseTo(0, 6);
  });

  it("does not add wall strip footings to unlabeled or exterior wall segments", () => {
    const mixedPreset = createFiveBySixCmuBuildingPreset();
    const startNode = mixedPreset.wallLayout.nodes[0]!;
    const endNodeId = "unlabeled-interior-end";
    mixedPreset.wallLayout = {
      ...mixedPreset.wallLayout,
      isFootprintClosed: false,
      nodes: [
        ...mixedPreset.wallLayout.nodes,
        { id: endNodeId, x: 0, z: 0 },
      ],
      segments: [
        ...mixedPreset.wallLayout.segments,
        {
          id: "unlabeled-interior-wall",
          startNodeId: startNode.id,
          endNodeId,
          wallHeightMeters: mixedPreset.wallLayout.defaultWallHeightMeters,
          wallThicknessMeters: 0.2,
        },
      ],
    };

    const mixedGeometry = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: mixedPreset.wallLayout,
        cmuSettings: mixedPreset.wall,
        slabSettings: mixedPreset.slab,
        roofSettings: mixedPreset.roof,
        trussSettings: mixedPreset.truss,
        buildingSystemMode: "reinforced_concrete_frame_with_cmu_infill",
        frameSystem: mixedPreset.frameSystem,
        foundationSettings: mixedPreset.foundationSettings,
        infillSystem: mixedPreset.infillSystem,
        gableEndSystem: mixedPreset.gableEndSystem,
      }),
    );

    expect(mixedGeometry.wallFootings ?? []).toHaveLength(0);
  });

  it("weaves partition CMU infill courses at L-corners", () => {
    const cornerPreset = createFiveBySixCmuBuildingPreset();
    const wallThicknessMeters = 0.2;
    cornerPreset.wallLayout = {
      ...cornerPreset.wallLayout,
      nodes: [
        ...cornerPreset.wallLayout.nodes,
        { id: "partition-start", x: 2, z: 1 },
        { id: "partition-corner", x: 2, z: 3 },
        { id: "partition-end", x: 4, z: 3 },
      ],
      segments: [
        ...cornerPreset.wallLayout.segments,
        {
          id: "partition-incoming",
          startNodeId: "partition-start",
          endNodeId: "partition-corner",
          wallHeightMeters: cornerPreset.wallLayout.defaultWallHeightMeters,
          wallThicknessMeters,
          wallRole: "partition",
        },
        {
          id: "partition-outgoing",
          startNodeId: "partition-corner",
          endNodeId: "partition-end",
          wallHeightMeters: cornerPreset.wallLayout.defaultWallHeightMeters,
          wallThicknessMeters,
          wallRole: "partition",
        },
      ],
    };

    const cornerGeometry = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: cornerPreset.wallLayout,
        cmuSettings: cornerPreset.wall,
        slabSettings: cornerPreset.slab,
        roofSettings: cornerPreset.roof,
        trussSettings: cornerPreset.truss,
        buildingSystemMode: "reinforced_concrete_frame_with_cmu_infill",
        frameSystem: cornerPreset.frameSystem,
        foundationSettings: cornerPreset.foundationSettings,
        infillSystem: cornerPreset.infillSystem,
        gableEndSystem: cornerPreset.gableEndSystem,
      }),
    );
    const incomingFrame = cornerGeometry.wallCmuLayout.segmentFrames.find(
      (frame) => frame.segmentId === "partition-incoming",
    )!;
    const outgoingFrame = cornerGeometry.wallCmuLayout.segmentFrames.find(
      (frame) => frame.segmentId === "partition-outgoing",
    )!;
    const incomingFooting = cornerGeometry.wallFootings?.find(
      (footing) => footing.hostSegmentId === "partition-incoming",
    );
    const outgoingFooting = cornerGeometry.wallFootings?.find(
      (footing) => footing.hostSegmentId === "partition-outgoing",
    );
    const expectedTrimMeters = wallThicknessMeters / 2;

    expect(incomingFooting).toBeDefined();
    expect(outgoingFooting).toBeDefined();
    const expectedFootingJoinMeters = incomingFooting!.widthMeters / 2;
    expect(incomingFooting!.endPoint.x).toBeCloseTo(
      incomingFrame.centerlineEnd.x +
        incomingFrame.tangent.x * expectedFootingJoinMeters,
      6,
    );
    expect(incomingFooting!.endPoint.z).toBeCloseTo(
      incomingFrame.centerlineEnd.z +
        incomingFrame.tangent.z * expectedFootingJoinMeters,
      6,
    );
    expect(outgoingFooting!.startPoint.x).toBeCloseTo(
      outgoingFrame.centerlineStart.x +
        outgoingFrame.tangent.x * expectedFootingJoinMeters,
      6,
    );
    expect(outgoingFooting!.startPoint.z).toBeCloseTo(
      outgoingFrame.centerlineStart.z +
        outgoingFrame.tangent.z * expectedFootingJoinMeters,
      6,
    );

    const aboveGradeBlocks = cornerGeometry.wallCmuLayout.blocks.filter(
      (block) =>
        block.source === "rc_frame_infill" &&
        (block.segmentId === "partition-incoming" ||
          block.segmentId === "partition-outgoing"),
    );
    const firstAboveGradeCourseIndex = Math.min(
      ...aboveGradeBlocks.map((block) => block.courseIndex ?? block.course),
    );
    const secondAboveGradeCourseIndex = firstAboveGradeCourseIndex + 1;
    const courseStations = (
      segmentId: string,
      courseIndex: number,
    ): { start: number; end: number } => {
      const courseBlocks = aboveGradeBlocks.filter(
        (block) =>
          block.segmentId === segmentId &&
          (block.courseIndex ?? block.course) === courseIndex,
      );
      expect(courseBlocks.length).toBeGreaterThan(0);
      return {
        start: Math.min(
          ...courseBlocks.map((block) => block.stationMeters ?? 0),
        ),
        end: Math.max(
          ...courseBlocks.map(
            (block) =>
              block.endAlongMeters ??
              (block.stationMeters ?? 0) + block.lengthMeters,
          ),
        ),
      };
    };

    const incomingEvenCourse = courseStations(
      "partition-incoming",
      firstAboveGradeCourseIndex,
    );
    const incomingOddCourse = courseStations(
      "partition-incoming",
      secondAboveGradeCourseIndex,
    );
    const outgoingEvenCourse = courseStations(
      "partition-outgoing",
      firstAboveGradeCourseIndex,
    );
    const outgoingOddCourse = courseStations(
      "partition-outgoing",
      secondAboveGradeCourseIndex,
    );

    expect(incomingEvenCourse.start).toBeCloseTo(0, 6);
    expect(incomingOddCourse.start).toBeCloseTo(0, 6);
    expect(incomingEvenCourse.end).toBeCloseTo(
      incomingFrame.lengthMeters + expectedTrimMeters,
      6,
    );
    expect(incomingOddCourse.end).toBeCloseTo(
      incomingFrame.lengthMeters - expectedTrimMeters,
      6,
    );
    expect(outgoingEvenCourse.start).toBeCloseTo(expectedTrimMeters, 6);
    expect(outgoingOddCourse.start).toBeCloseTo(-expectedTrimMeters, 6);
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
