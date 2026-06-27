import type {
  BuildingSystemMode,
  CmuInfillSystemParameters,
  CmuWallSystemParameters,
  DesignWallLayoutParameters,
  GableEndSettings,
  GableEndSystemParameters,
  IsolatedFooting,
  RakedCapPlacement,
  ResolvedRoofSystem,
  RoofSystemSettings,
  StructuralFoundationSettings,
  StructuralFrameSystemParameters,
  ThickenedEdgeSlabParameters,
  WallFooting,
} from "../types";
import type {
  CmuBlockInstance,
  CmuLayoutResult,
  CmuLintelInstance,
  DesignGeometryResult,
  ResolvedWallLayoutGeometry,
} from "./designGeometry";
import {
  emptyCmuLayout,
  findExteriorFootprintBoundaryViolations,
  generateCmuLayoutFromWallLayout,
  getExteriorPerimeterSegmentIds,
  getSegmentFramesForWallLayout,
  resolveLayoutRoughOpeningsFromWall,
  resolveWallLayoutGeometry,
  resolvedBuildingFootprintFromWallLayout,
} from "./designGeometry";
import { reconcileStructuralFrameWithFoundation } from "../domain/structuralFrameLayout";
import {
  createDefaultFoundationSettings,
  normalizeRcFrameFoundationSettings,
  resolveFoundationElevations,
  resolveStructuralConcreteVolumes,
  resolveStructuralWallHeightMeters,
} from "../domain/foundationElevations";
import { resolveInteriorFloorSlab } from "../domain/interiorFloorSlab";
import { resolveFloorTileLayout } from "../domain/floorTileLayout";
import { resolvePlywoodCeilingLayout } from "../domain/plywoodCeilingLayout";
import {
  countPanelVerticalCourses,
  isAboveGradeInfillPanel,
  resolveInfillPanelsWithBounds,
  solveInfillPanelBlocks,
} from "../domain/cmuInfillPanelSolver";
import type { ResolvedInfillPanelBounds } from "../domain/infillPanelBoundsResolver";
import {
  infillPanelFromResolvedBounds,
  resolveInfillPanelBoundsForSegment,
} from "../domain/infillPanelBoundsResolver";
import { solveGableEndPlacements } from "../domain/gableEndSolver";
import { solveGableEndMasonryBlocks } from "../domain/gableEndMasonrySolver";
import { resolveCmuModuleDefinition } from "../domain/cmuModuleRules";
import type { ResolvedCmuOpening } from "../domain/cmuOpeningRules";
import {
  createEmptyCmuInfillSystem,
  createEmptyGableEndSystem,
} from "../domain/structuralFrameDefaults";
import { createDefaultRoofSystemSettings } from "../domain/roofSystemDefaults";
import { normalizeCmuInfillSystem } from "../domain/infillPlaster";
import { resolveRoofSystem } from "../domain/roofSystemResolver";
import { resolveOuterRoofBeamBearingLoop } from "../domain/roofFootprintSupport";
import { buildResolvedGableEnd } from "../domain/roofGableSolver";
import {
  solveRakedCapPlacementsWithWarnings,
  totalGableCmuAreaSquareMeters,
  totalRakedCapVolumeCubicMeters,
} from "../domain/rakedCapSolver";

export type StructuralFrameGeometryInput = {
  buildingSystemMode: BuildingSystemMode;
  wallLayout: DesignWallLayoutParameters;
  wall: CmuWallSystemParameters;
  slab: ThickenedEdgeSlabParameters;
  frameSystem: StructuralFrameSystemParameters;
  foundationSettings: StructuralFoundationSettings;
  roofSystem: RoofSystemSettings;
  infillSystem: CmuInfillSystemParameters;
  gableEndSystem: GableEndSystemParameters;
};

export type StructuralConcreteVolumeBreakdown = {
  plinthBeamVolumeCubicMeters: number;
  roofBeamVolumeCubicMeters: number;
  tieBeamVolumeCubicMeters: number;
  columnBelowPlinthVolumeCubicMeters: number;
  columnAbovePlinthVolumeCubicMeters: number;
  footingVolumeCubicMeters: number;
  interiorFloorSlabVolumeCubicMeters: number;
  totalDeduplicatedVolumeCubicMeters: number;
  /** @deprecated Use plinthBeamVolumeCubicMeters */
  gradeBeamVolumeCubicMeters: number;
  /** @deprecated Use roofBeamVolumeCubicMeters */
  ringBeamVolumeCubicMeters: number;
  /** @deprecated Use columnBelowPlinthVolumeCubicMeters */
  columnBelowGradeVolumeCubicMeters: number;
  /** @deprecated Use columnAbovePlinthVolumeCubicMeters */
  columnAboveGradeVolumeCubicMeters: number;
};

export type StructuralFrameGeometryExtras = {
  frameSystem: StructuralFrameSystemParameters;
  foundationSettings: StructuralFoundationSettings;
  isolatedFootings: IsolatedFooting[];
  wallFootings: WallFooting[];
  infillSystem: CmuInfillSystemParameters;
  gableEndSystem: GableEndSystemParameters;
  structuralConcreteVolumeCubicMeters: number;
  structuralConcreteVolumeBreakdown: StructuralConcreteVolumeBreakdown;
  gablePlacements: import("../types").GableCmuPlacement[];
  rakedCapPlacements: RakedCapPlacement[];
  resolvedRoofSystem: ResolvedRoofSystem | null;
  resolvedInfillPanelBounds: ResolvedInfillPanelBounds[];
  interiorFloorSlab?: import("../domain/interiorFloorSlab").ResolvedInteriorFloorSlab;
};

export function generateFrameInfillGeometry(
  input: StructuralFrameGeometryInput,
): DesignGeometryResult & StructuralFrameGeometryExtras {
  const wall = {
    ...input.wall,
    bondPattern: input.wall.bondPattern ?? "running_bond",
  };
  const resolvedWallGeometry = resolveWallLayoutGeometry(
    input.wallLayout,
    wall,
  );
  const resolvedFootprint =
    resolvedBuildingFootprintFromWallLayout(resolvedWallGeometry);
  const segmentFrames = getSegmentFramesForWallLayout(input.wallLayout, wall);
  const exteriorSegmentIds = getExteriorPerimeterSegmentIds(input.wallLayout);

  const foundationSettings = normalizeRcFrameFoundationSettings(
    input.foundationSettings ?? createDefaultFoundationSettings(),
  );
  const layoutWallHeight = input.wallLayout.defaultWallHeightMeters;
  const wallHeightMeters = resolveStructuralWallHeightMeters({
    foundation: foundationSettings,
    wallHeightMeters: layoutWallHeight,
  });

  const reconciled = reconcileStructuralFrameWithFoundation({
    layout: input.wallLayout,
    segmentFrames,
    frameSystem: input.frameSystem,
    foundation: foundationSettings,
    wallHeightMeters,
  });
  const frameSystem = reconciled.frameSystem;
  const isolatedFootings = reconciled.isolatedFootings;
  const wallFootings = reconciled.wallFootings;

  let panelEntries = resolveInfillPanelsWithBounds({
    layout: input.wallLayout,
    segmentFrames,
    columns: frameSystem.columns,
    beams: frameSystem.beams,
    wall,
    foundation: foundationSettings,
    wallFootings,
    existingPanels: input.infillSystem.panels,
  });
  const module = resolveCmuModuleDefinition(wall);
  const roughOpenings = resolveLayoutRoughOpeningsFromWall({
    wall,
    segmentFrames,
  });
  const allBlocks: CmuBlockInstance[] = [];
  const allLintels: CmuLintelInstance[] = [];
  let totalFull = 0;
  let totalHalf = 0;
  let totalCut = 0;
  let totalTopClosure = 0;
  const layoutWarnings: string[] = [];
  const gablePlacements: import("../types").GableCmuPlacement[] = [];
  const rakedCapPlacements: RakedCapPlacement[] = [];

  const roofBeam =
    frameSystem.beams.find((beam) => beam.kind === "roof_beam") ??
    frameSystem.beams.find((beam) => beam.kind === "ring_beam");
  const foundationElevations = resolveFoundationElevations({
    foundation: foundationSettings,
    wallHeightMeters,
  });
  const roofBeamTopElevationMeters =
    roofBeam?.topElevationMeters ?? foundationElevations.roofBeamTopY;
  const roofSystem = input.roofSystem ?? createDefaultRoofSystemSettings();
  const roofBearingLoop = resolveOuterRoofBeamBearingLoop({
    layout: input.wallLayout,
    segmentFrames,
    roofBeams: frameSystem.beams,
    fallbackExteriorFootprint: resolvedWallGeometry.exteriorFacePolygon,
    exteriorSegmentIds,
  });
  let resolvedRoofSystem = resolveRoofSystem({
    layout: input.wallLayout,
    wallExteriorFootprint: resolvedWallGeometry.exteriorFacePolygon,
    structuralBearingPerimeter: roofBearingLoop.points,
    bearingSource: roofBearingLoop.source,
    bearingWarnings: roofBearingLoop.warnings,
    roofSystem,
    roofBeamTopElevationMeters,
    segmentFrames,
    exteriorSegmentIds,
  });
  layoutWarnings.push(
    ...resolvedRoofSystem.warnings.map((warning) => warning.message),
  );

  if (
    resolvedRoofSystem.supported &&
    resolvedRoofSystem.gableEndSegmentIds.length > 0
  ) {
    const roofGableSegmentIds = new Set(resolvedRoofSystem.gableEndSegmentIds);
    const nonGableEntries = panelEntries.filter(
      (entry) =>
        !isAboveGradeInfillPanel(entry.panel) ||
        !roofGableSegmentIds.has(entry.panel.hostSegmentId),
    );
    const fullWidthGableEntries = input.wallLayout.segments.flatMap(
      (segment, index) => {
        if (!roofGableSegmentIds.has(segment.id)) return [];
        const frame = segmentFrames.find(
          (candidate) => candidate.segmentId === segment.id,
        );
        if (!frame) return [];
        const bounds = resolveInfillPanelBoundsForSegment({
          panelId: `infill-${segment.id}-gable-${index}`,
          segmentId: segment.id,
          segment,
          frame,
          columns: frameSystem.columns,
          beams: frameSystem.beams,
        });
        return bounds
          ? [
              {
                bounds,
                panel: infillPanelFromResolvedBounds({
                  bounds,
                  wall,
                  beams: frameSystem.beams,
                }),
              },
            ]
          : [];
      },
    );
    panelEntries = [...nonGableEntries, ...fullWidthGableEntries];
  }

  const panels = panelEntries.map((entry) => entry.panel);
  const resolvedInfillPanelBounds = panelEntries.map((entry) => entry.bounds);
  const aboveGradePanelBounds = resolvedInfillPanelBounds.filter((_, index) =>
    isAboveGradeInfillPanel(panels[index]!),
  );

  for (const segment of input.wallLayout.segments) {
    const segmentEntries = panelEntries.filter(
      (entry) => entry.panel.hostSegmentId === segment.id,
    );
    const frame = segmentFrames.find(
      (candidate) => candidate.segmentId === segment.id,
    );
    if (!frame) continue;

    for (const { panel, bounds } of segmentEntries) {
      const matchingBelowGradeEntry = isAboveGradeInfillPanel(panel)
        ? segmentEntries.find(
            (entry) =>
              entry.panel.infillZone === "below_grade" &&
              Math.abs(entry.bounds.startStationMeters - bounds.startStationMeters) <=
                0.002 &&
              Math.abs(entry.bounds.endStationMeters - bounds.endStationMeters) <=
                0.002,
          )
        : undefined;
      const courseIndexOffset = matchingBelowGradeEntry
        ? countPanelVerticalCourses({
            panelBottomElevationMeters:
              matchingBelowGradeEntry.panel.bottomElevationMeters,
            panelTopElevationMeters:
              matchingBelowGradeEntry.panel.topElevationMeters,
            nominalCourseHeightMeters: module.nominalModuleHeightMeters,
          })
        : 0;
      const segmentOpenings = isAboveGradeInfillPanel(panel)
        ? roughOpenings.filter(
            (opening) =>
              (opening as ResolvedCmuOpening & { wallSegmentId?: string })
                .wallSegmentId === segment.id,
          )
        : [];
      const solved = solveInfillPanelBlocks({
        panel,
        bounds,
        frame,
        wall,
        courseIndexOffset,
        openings: segmentOpenings,
        logBoundsForDev: import.meta.env.DEV,
      });
      allBlocks.push(...solved.blocks);
      allLintels.push(...solved.lintels);
      totalFull += solved.fullBlockCount;
      totalHalf += solved.halfBlockCount;
      totalCut += solved.cutBlockCount;
      totalTopClosure += solved.topClosureCutBlockCount;
      layoutWarnings.push(...solved.warnings);

      if (!isAboveGradeInfillPanel(panel)) {
        continue;
      }

      const isRoofGableEnd =
        resolvedRoofSystem.supported &&
        exteriorSegmentIds.has(panel.hostSegmentId) &&
        resolvedRoofSystem.gableEndSegmentIds.includes(panel.hostSegmentId);

      if (isRoofGableEnd) {
        const gableResult = solveGableEndMasonryBlocks({
          panel,
          frame,
          wall,
          roofSystem,
          resolvedRoof: resolvedRoofSystem,
          roofBeamTopElevationMeters,
          infillCenterlineInwardOffsetMeters:
            bounds.infillCenterlineInwardOffsetMeters,
        });
        allBlocks.push(...gableResult.blocks);
        totalFull += gableResult.fullBlockCount;
        totalHalf += gableResult.halfBlockCount;
        totalCut += gableResult.cutBlockCount;
        layoutWarnings.push(...gableResult.warnings);

        const capResult = solveRakedCapPlacementsWithWarnings({
          gableEndSegmentId: panel.hostSegmentId,
          panelId: panel.id,
          frame,
          panelStartStation: panel.startStationMeters,
          panelEndStation: panel.endStationMeters,
          panelBottomElevationMeters: panel.bottomElevationMeters,
          blocks: gableResult.blocks,
          roofSystem,
          resolvedRoof: resolvedRoofSystem,
          wallDepthMeters: frame.wallThicknessMeters ?? module.blockDepthMeters,
          moduleHeightMeters: module.nominalModuleHeightMeters,
          infillCenterlineInwardOffsetMeters:
            bounds.infillCenterlineInwardOffsetMeters,
        });
        rakedCapPlacements.push(...capResult.placements);
        layoutWarnings.push(...capResult.warnings);
        resolvedRoofSystem = {
          ...resolvedRoofSystem,
          gableEnds: [
            ...resolvedRoofSystem.gableEnds,
            buildResolvedGableEnd({
              hostSegmentId: panel.hostSegmentId,
              panelStartStation: panel.startStationMeters,
              panelEndStation: panel.endStationMeters,
              blocks: gableResult.blocks,
              rakedCapPlacements: capResult.placements,
              warnings: capResult.warnings.map((message) => ({
                code: "insufficient_raked_cap_depth",
                message,
                severity: "review" as const,
              })),
            }),
          ],
        };
        continue;
      }

      const gable = input.gableEndSystem.gableEnds.find(
        (g) => g.hostWallSegmentId === panel.hostSegmentId,
      );
      if (gable) {
        gablePlacements.push(
          ...solveGableEndPlacements({
            settings: gable,
            panelId: panel.id,
            frame,
            panelStartStation: panel.startStationMeters,
            panelEndStation: panel.endStationMeters,
            bottomElevationMeters: panel.bottomElevationMeters,
            moduleLengthMeters: module.nominalModuleLengthMeters,
            moduleHeightMeters: module.nominalModuleHeightMeters,
            blockDepthMeters: module.blockDepthMeters,
          }),
        );
      }
    }
  }

  if (resolvedRoofSystem.supported) {
    const gableCmuBlocks = allBlocks.filter(
      (block) => block.source === "gable_end_solver",
    );
    resolvedRoofSystem = {
      ...resolvedRoofSystem,
      gableCmuAreaSquareMeters: totalGableCmuAreaSquareMeters(gableCmuBlocks),
      rakedCapVolumeCubicMeters:
        totalRakedCapVolumeCubicMeters(rakedCapPlacements),
    };
  }

  const wallCmuLayout: CmuLayoutResult = {
    ...emptyCmuLayout(wall),
    blocks: allBlocks,
    totalBlocks: allBlocks.length,
    segmentFrames,
    roughOpenings,
    lintels: allLintels,
    counts: {
      full: totalFull,
      half: totalHalf,
      cut: totalCut,
      end: 0,
      corner: 0,
      jamb: allBlocks.filter((block) => block.source === "opening_jamb_closure")
        .length,
      lintel_bond_beam: allLintels.filter(
        (lintel) => lintel.kind === "bond_beam_lintel",
      ).length,
    },
    topClosureCutBlockCount: totalTopClosure,
    warnings: layoutWarnings,
    cornerAssemblies: [],
  };

  const exteriorFootprint = resolvedWallGeometry.exteriorFacePolygon;
  const boundsBySegment = new Map(
    aboveGradePanelBounds.map((bounds) => [bounds.hostSegmentId, bounds]),
  );
  const wallSegments = segmentFrames.map((frame) => {
    const panelBounds = boundsBySegment.get(frame.segmentId);
    const clearHeightMeters =
      panelBounds?.clearHeightMeters ?? frame.wallHeightMeters;
    const baseElevationMeters = panelBounds?.bottomElevationMeters ?? 0;
    const infillCenterlineInwardOffsetMeters =
      panelBounds?.infillCenterlineInwardOffsetMeters ?? 0;
    return {
      segmentId: frame.segmentId,
      lengthMeters: frame.lengthMeters,
      heightMeters: clearHeightMeters,
      thicknessMeters: frame.wallThicknessMeters,
      x:
        (frame.centerlineStart.x + frame.centerlineEnd.x) / 2 +
        frame.inwardNormal.x * infillCenterlineInwardOffsetMeters,
      y: baseElevationMeters + clearHeightMeters / 2,
      z:
        (frame.centerlineStart.z + frame.centerlineEnd.z) / 2 +
        frame.inwardNormal.z * infillCenterlineInwardOffsetMeters,
      rotationY: frame.rotationY,
      infillCenterlineInwardOffsetMeters,
    };
  });

  const blockInstances = allBlocks.map((block) => ({
    id: block.id,
    panelId: block.panelId,
    segmentId: block.segmentId ?? block.face,
    course: block.course,
    courseIndex: block.courseIndex,
    moduleIndex: block.moduleIndex,
    blockType: block.blockType,
    unitType: block.unitType,
    kind: block.kind,
    stationMeters: block.stationMeters,
    cornerId: block.cornerId,
    nominalLengthMeters: block.nominalLengthMeters,
    actualLengthMeters: block.actualLengthMeters,
    heightMeters: block.heightMeters,
    physicalHeightMeters: block.physicalHeightMeters,
    depthMeters: block.depthMeters,
    source: block.source,
    wallFace: block.wallFace,
    infillBand: block.infillBand,
    terminalClosure: block.terminalClosure,
    startAlongMeters: block.startAlongMeters,
    endAlongMeters: block.endAlongMeters,
    x: block.x,
    y: block.y,
    z: block.z,
    rotationY: block.rotationY,
    lengthMeters: block.lengthMeters,
  }));

  const boundaryViolations = findExteriorFootprintBoundaryViolations(
    blockInstances,
    exteriorFootprint,
    wall.wallThicknessMeters || input.wallLayout.defaultWallThicknessMeters,
  );

  const elevations = resolveFoundationElevations({
    foundation: foundationSettings,
    wallHeightMeters,
  });
  const volumeResult = resolveStructuralConcreteVolumes({
    columns: frameSystem.columns,
    beams: frameSystem.beams,
    footings: [...isolatedFootings, ...wallFootings.map((footing) => ({
      widthMeters: footing.widthMeters,
      lengthMeters: Math.hypot(
        footing.endPoint.x - footing.startPoint.x,
        footing.endPoint.z - footing.startPoint.z,
      ),
      thicknessMeters: footing.thicknessMeters,
    }))],
    elevations,
  });
  const interiorFacePolygon = resolvedFootprint?.interiorFacePolygon ?? [];
  const interiorFloorSlab = resolveInteriorFloorSlab({
    foundation: foundationSettings,
    interiorFacePolygon,
  });
  const floorTileLayout = resolveFloorTileLayout({
    interiorFacePolygon,
    floorTileFinish: foundationSettings.floorTileFinish,
    interiorFloorSlabEnabled: interiorFloorSlab.enabled,
  });
  const maxCeilingHeightMeters = Math.max(
    0,
    elevations.roofBeamBottomY -
      foundationSettings.plywoodCeiling.tubeSizeMeters,
  );
  const plywoodCeilingLayout = resolvePlywoodCeilingLayout({
    interiorFacePolygon,
    plywoodCeiling: foundationSettings.plywoodCeiling,
    maxCeilingHeightMeters,
  });
  const structuralConcreteVolumeBreakdown: StructuralConcreteVolumeBreakdown = {
    ...volumeResult,
    interiorFloorSlabVolumeCubicMeters: interiorFloorSlab.volumeCubicMeters,
    gradeBeamVolumeCubicMeters: volumeResult.plinthBeamVolumeCubicMeters,
    ringBeamVolumeCubicMeters: volumeResult.roofBeamVolumeCubicMeters,
    columnBelowGradeVolumeCubicMeters:
      volumeResult.columnBelowPlinthVolumeCubicMeters,
    columnAboveGradeVolumeCubicMeters:
      volumeResult.columnAbovePlinthVolumeCubicMeters,
  };
  const structuralConcreteVolumeCubicMeters =
    structuralConcreteVolumeBreakdown.totalDeduplicatedVolumeCubicMeters +
    interiorFloorSlab.volumeCubicMeters;

  return {
    sourcePath: "layout_graph",
    wallSegments,
    blockInstances,
    cornerCourseLayouts: [],
    exteriorFootprint,
    resolvedFootprint,
    boundaryViolations,
    blockCount: allBlocks.length,
    bondPattern: wall.bondPattern ?? "running_bond",
    wallCmuLayout,
    frameSystem,
    foundationSettings,
    isolatedFootings,
    wallFootings,
    infillSystem: { ...normalizeCmuInfillSystem(input.infillSystem), panels },
    gableEndSystem: input.gableEndSystem,
    structuralConcreteVolumeCubicMeters,
    structuralConcreteVolumeBreakdown,
    gablePlacements,
    rakedCapPlacements,
    resolvedRoofSystem,
    resolvedInfillPanelBounds,
    interiorFloorSlab,
    floorTileLayout,
    plywoodCeilingLayout,
  };
}

export function generateBearingWallGeometryFromLayout(params: {
  wallLayout: DesignWallLayoutParameters;
  wall: CmuWallSystemParameters;
  resolvedWallGeometry?: ResolvedWallLayoutGeometry;
}): Pick<
  DesignGeometryResult,
  | "wallSegments"
  | "blockInstances"
  | "cornerCourseLayouts"
  | "exteriorFootprint"
  | "resolvedFootprint"
  | "boundaryViolations"
  | "blockCount"
  | "bondPattern"
  | "wallCmuLayout"
> {
  const resolvedWallGeometry =
    params.resolvedWallGeometry ??
    resolveWallLayoutGeometry(params.wallLayout, params.wall);
  const resolvedFootprint =
    resolvedBuildingFootprintFromWallLayout(resolvedWallGeometry);
  const wallCmuLayout = generateCmuLayoutFromWallLayout(
    params.wallLayout,
    params.wall,
    resolvedWallGeometry,
  );
  const exteriorFootprint = wallCmuLayout.segmentFrames?.length
    ? resolvedWallGeometry.exteriorFacePolygon
    : [];
  const wallSegments = (wallCmuLayout.segmentFrames ?? []).map((frame) => ({
    segmentId: frame.segmentId,
    lengthMeters: frame.lengthMeters,
    heightMeters: frame.wallHeightMeters,
    thicknessMeters: frame.wallThicknessMeters,
    x:
      (frame.start.x + frame.end.x) / 2 +
      frame.inwardNormal.x * (frame.wallThicknessMeters / 2),
    y: frame.wallHeightMeters / 2,
    z:
      (frame.start.z + frame.end.z) / 2 +
      frame.inwardNormal.z * (frame.wallThicknessMeters / 2),
    rotationY: frame.rotationY,
  }));
  const blockInstances = wallCmuLayout.blocks.map((block) => ({
    id: block.id,
    segmentId: block.segmentId ?? block.face,
    course: block.course,
    courseIndex: block.courseIndex,
    moduleIndex: block.moduleIndex,
    blockType: block.blockType,
    unitType: block.unitType,
    kind: block.kind,
    stationMeters: block.stationMeters,
    cornerId: block.cornerId,
    nominalLengthMeters: block.nominalLengthMeters,
    actualLengthMeters: block.actualLengthMeters,
    heightMeters: block.heightMeters,
    physicalHeightMeters: block.physicalHeightMeters,
    depthMeters: block.depthMeters,
    source: block.source,
    wallFace: block.wallFace,
    infillBand: block.infillBand,
    terminalClosure: block.terminalClosure,
    startAlongMeters: block.startAlongMeters,
    endAlongMeters: block.endAlongMeters,
    x: block.x,
    y: block.y,
    z: block.z,
    rotationY: block.rotationY,
    lengthMeters: block.lengthMeters,
  }));
  const boundaryViolations = findExteriorFootprintBoundaryViolations(
    blockInstances,
    exteriorFootprint,
    params.wall.wallThicknessMeters ||
      params.wallLayout.defaultWallThicknessMeters,
  );
  return {
    wallSegments,
    blockInstances,
    cornerCourseLayouts:
      wallCmuLayout.cornerAssemblies?.map((assembly) => ({
        cornerId: assembly.cornerId,
        nodeId: assembly.cornerId.replace(/^corner-/, ""),
        courseIndex: assembly.courseIndex,
        ownerSegmentId: assembly.ownerSegmentId,
        buttingSegmentId: assembly.buttingSegmentId,
        cornerType:
          assembly.cornerType === "convex_outside"
            ? "outside"
            : assembly.cornerType === "concave_inside"
              ? "inside"
              : assembly.cornerType,
        strategy: "interlocked_running_bond" as const,
        ownerStartTrim: assembly.ownerSetbackMeters,
        buttingStartTrim: assembly.buttingSetbackMeters,
        generatedUnitType:
          assembly.generatedUnitType === "corner"
            ? "corner_block"
            : assembly.generatedUnitType === "half"
              ? "half_block"
              : assembly.generatedUnitType === "cut"
                ? "cut_block"
                : "full_block",
      })) ?? [],
    exteriorFootprint,
    resolvedFootprint,
    boundaryViolations,
    blockCount: wallCmuLayout.blocks.length,
    bondPattern: params.wall.bondPattern ?? "running_bond",
    wallCmuLayout,
  };
}

export function defaultFrameSystemsForPreset(): {
  frameSystem: StructuralFrameSystemParameters;
  infillSystem: CmuInfillSystemParameters;
  gableEndSystem: GableEndSystemParameters;
} {
  return {
    frameSystem: {
      kind: "structural_frame_system",
      buildingSystemMode: "reinforced_concrete_frame_with_cmu_infill",
      defaultColumnWidthMeters: 0.35,
      defaultColumnDepthMeters: 0.35,
      defaultGradeBeamWidthMeters: 0.3,
      defaultGradeBeamDepthMeters: 0.45,
      defaultRingBeamWidthMeters: 0.25,
      defaultRingBeamDepthMeters: 0.3,
      columns: [],
      beams: [],
    },
    infillSystem: createEmptyCmuInfillSystem(),
    gableEndSystem: createEmptyGableEndSystem(),
  };
}

export function createDefaultGableEnd(
  hostSegmentId: string,
  eaveElevationMeters: number,
): GableEndSettings {
  return {
    kind: "gable_end",
    id: `gable-${hostSegmentId}`,
    hostWallSegmentId: hostSegmentId,
    eaveElevationMeters,
    peakMode: "rise_above_eave",
    peakRiseMeters: 1.2,
    ridgePosition: "centered",
    roofToMasonryClearanceMeters: 0.1016,
    roofClearanceMeasurement: "perpendicular_to_roof_slope",
    bondPattern: "running_bond",
  };
}
