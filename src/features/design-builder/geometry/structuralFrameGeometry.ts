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
} from '../types';
import type {
  CmuBlockInstance,
  CmuLayoutResult,
  DesignGeometryResult,
  ResolvedWallLayoutGeometry,
  SegmentFrame,
} from './designGeometry';
import {
  emptyCmuLayout,
  findExteriorFootprintBoundaryViolations,
  generateCmuLayoutFromWallLayout,
  getSegmentFramesForWallLayout,
  resolveWallLayoutGeometry,
  resolvedBuildingFootprintFromWallLayout,
} from './designGeometry';
import {
  reconcileStructuralFrameWithFoundation,
} from '../domain/structuralFrameLayout';
import {
  createDefaultFoundationSettings,
  resolveFoundationElevations,
  resolveStructuralConcreteVolumes,
} from '../domain/foundationElevations';
import {
  resolveInfillPanelsWithBounds,
  solveInfillPanelBlocks,
} from '../domain/cmuInfillPanelSolver';
import type { ResolvedInfillPanelBounds } from '../domain/infillPanelBoundsResolver';
import { solveGableEndPlacements } from '../domain/gableEndSolver';
import { resolveCmuModuleDefinition } from '../domain/cmuModuleRules';
import { createEmptyCmuInfillSystem, createEmptyGableEndSystem } from '../domain/structuralFrameDefaults';
import { createDefaultRoofSystemSettings } from '../domain/roofSystemDefaults';
import { resolveRoofSystem } from '../domain/roofSystemResolver';
import { resolveOuterRoofBeamBearingLoop } from '../domain/roofFootprintSupport';
import {
  buildResolvedGableEnd,
  solveRoofGableEndPlacements,
} from '../domain/roofGableSolver';
import {
  solveRakedCapPlacements,
  totalGableCmuAreaSquareMeters,
  totalRakedCapVolumeCubicMeters,
} from '../domain/rakedCapSolver';

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
  infillSystem: CmuInfillSystemParameters;
  gableEndSystem: GableEndSystemParameters;
  structuralConcreteVolumeCubicMeters: number;
  structuralConcreteVolumeBreakdown: StructuralConcreteVolumeBreakdown;
  gablePlacements: import('../types').GableCmuPlacement[];
  rakedCapPlacements: RakedCapPlacement[];
  resolvedRoofSystem: ResolvedRoofSystem | null;
  resolvedInfillPanelBounds: ResolvedInfillPanelBounds[];
};

export function generateFrameInfillGeometry(
  input: StructuralFrameGeometryInput,
): DesignGeometryResult & StructuralFrameGeometryExtras {
  const wall = { ...input.wall, bondPattern: input.wall.bondPattern ?? 'running_bond' };
  const resolvedWallGeometry = resolveWallLayoutGeometry(input.wallLayout, wall);
  const resolvedFootprint = resolvedBuildingFootprintFromWallLayout(resolvedWallGeometry);
  const segmentFrames = getSegmentFramesForWallLayout(input.wallLayout, wall);

  const foundationSettings = input.foundationSettings ?? createDefaultFoundationSettings();
  const wallHeightMeters = input.wallLayout.defaultWallHeightMeters;

  const reconciled = reconcileStructuralFrameWithFoundation({
    layout: input.wallLayout,
    segmentFrames,
    frameSystem: input.frameSystem,
    foundation: foundationSettings,
    wallHeightMeters,
  });
  const frameSystem = reconciled.frameSystem;
  const isolatedFootings = reconciled.isolatedFootings;

  const panelEntries = resolveInfillPanelsWithBounds({
    layout: input.wallLayout,
    segmentFrames,
    columns: frameSystem.columns,
    beams: frameSystem.beams,
    wall,
    existingPanels: input.infillSystem.panels,
  });
  const panels = panelEntries.map((entry) => entry.panel);
  const resolvedInfillPanelBounds = panelEntries.map((entry) => entry.bounds);

  const module = resolveCmuModuleDefinition(wall);
  const allBlocks: CmuBlockInstance[] = [];
  let totalFull = 0;
  let totalHalf = 0;
  let totalCut = 0;
  let totalTopClosure = 0;
  const layoutWarnings: string[] = [];
  const gablePlacements: import('../types').GableCmuPlacement[] = [];
  const rakedCapPlacements: RakedCapPlacement[] = [];

  const roofBeam =
    frameSystem.beams.find((beam) => beam.kind === 'roof_beam') ??
    frameSystem.beams.find((beam) => beam.kind === 'ring_beam');
  const foundationElevations = resolveFoundationElevations({ foundation: foundationSettings, wallHeightMeters });
  const roofBeamTopElevationMeters =
    roofBeam?.topElevationMeters ?? foundationElevations.roofBeamTopY;
  const roofSystem = input.roofSystem ?? createDefaultRoofSystemSettings();
  const roofBearingLoop = resolveOuterRoofBeamBearingLoop({
    layout: input.wallLayout,
    segmentFrames,
    roofBeams: frameSystem.beams,
    fallbackExteriorFootprint: resolvedWallGeometry.exteriorFacePolygon,
  });
  let resolvedRoofSystem = resolveRoofSystem({
    layout: input.wallLayout,
    wallExteriorFootprint: resolvedWallGeometry.exteriorFacePolygon,
    structuralBearingPerimeter: roofBearingLoop.points,
    bearingSource: roofBearingLoop.source,
    bearingWarnings: roofBearingLoop.warnings,
    roofSystem,
    roofBeamTopElevationMeters,
  });
  layoutWarnings.push(...resolvedRoofSystem.warnings.map((warning) => warning.message));

  for (const { panel, bounds } of panelEntries) {
    const frame = segmentFrames.find((f) => f.segmentId === panel.hostSegmentId);
    if (!frame) continue;
    const solved = solveInfillPanelBlocks({
      panel,
      bounds,
      frame,
      wall,
      logBoundsForDev: import.meta.env.DEV,
    });
    allBlocks.push(...solved.blocks);
    totalFull += solved.fullBlockCount;
    totalHalf += solved.halfBlockCount;
    totalCut += solved.cutBlockCount;
    totalTopClosure += solved.topClosureCutBlockCount;
    layoutWarnings.push(...solved.warnings);

    const isRoofGableEnd =
      resolvedRoofSystem.supported &&
      resolvedRoofSystem.gableEndSegmentIds.includes(panel.hostSegmentId);

    if (isRoofGableEnd) {
      const gablePlacementsForPanel = solveRoofGableEndPlacements({
        panelId: panel.id,
        hostSegmentId: panel.hostSegmentId,
        frame,
        panelStartStation: panel.startStationMeters,
        panelEndStation: panel.endStationMeters,
        roofBeamTopElevationMeters,
        roofSystem,
        resolvedRoof: resolvedRoofSystem,
        moduleLengthMeters: module.nominalModuleLengthMeters,
        moduleHeightMeters: module.nominalModuleHeightMeters,
        blockDepthMeters: module.blockDepthMeters,
      });
      gablePlacements.push(...gablePlacementsForPanel);
      const caps = solveRakedCapPlacements({
        gableEndSegmentId: panel.hostSegmentId,
        panelId: panel.id,
        frame,
        panelStartStation: panel.startStationMeters,
        panelEndStation: panel.endStationMeters,
        placements: gablePlacementsForPanel,
        roofSystem,
        resolvedRoof: resolvedRoofSystem,
        wallDepthMeters: module.blockDepthMeters,
      });
      rakedCapPlacements.push(...caps);
      resolvedRoofSystem = {
        ...resolvedRoofSystem,
        gableEnds: [
          ...resolvedRoofSystem.gableEnds,
          buildResolvedGableEnd({
            hostSegmentId: panel.hostSegmentId,
            frame,
            panelStartStation: panel.startStationMeters,
            panelEndStation: panel.endStationMeters,
            roofSystem,
            resolvedRoof: resolvedRoofSystem,
            placements: gablePlacementsForPanel,
            rakedCapPlacements: caps,
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

  if (resolvedRoofSystem.supported) {
    resolvedRoofSystem = {
      ...resolvedRoofSystem,
      gableCmuAreaSquareMeters: totalGableCmuAreaSquareMeters(gablePlacements),
      rakedCapVolumeCubicMeters: totalRakedCapVolumeCubicMeters(rakedCapPlacements),
    };
  }

  const wallCmuLayout: CmuLayoutResult = {
    ...emptyCmuLayout(wall),
    blocks: allBlocks,
    totalBlocks: allBlocks.length,
    segmentFrames,
    counts: {
      full: totalFull,
      half: totalHalf,
      cut: totalCut,
      end: 0,
      corner: 0,
      jamb: 0,
      lintel_bond_beam: 0,
    },
    topClosureCutBlockCount: totalTopClosure,
    warnings: layoutWarnings,
    cornerAssemblies: [],
  };

  const exteriorFootprint = resolvedWallGeometry.exteriorFacePolygon;
  const boundsBySegment = new Map(resolvedInfillPanelBounds.map((bounds) => [bounds.hostSegmentId, bounds]));
  const wallSegments = segmentFrames.map((frame) => {
    const panelBounds = boundsBySegment.get(frame.segmentId);
    const clearHeightMeters = panelBounds?.clearHeightMeters ?? frame.wallHeightMeters;
    const baseElevationMeters = panelBounds?.bottomElevationMeters ?? 0;
    return {
      segmentId: frame.segmentId,
      lengthMeters: frame.lengthMeters,
      heightMeters: clearHeightMeters,
      thicknessMeters: frame.wallThicknessMeters,
      x: (frame.start.x + frame.end.x) / 2 + frame.inwardNormal.x * (frame.wallThicknessMeters / 2),
      y: baseElevationMeters + clearHeightMeters / 2,
      z: (frame.start.z + frame.end.z) / 2 + frame.inwardNormal.z * (frame.wallThicknessMeters / 2),
      rotationY: frame.rotationY,
    };
  });

  const blockInstances = allBlocks.map((block) => ({
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
    terminalClosure: block.terminalClosure,
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
    footings: isolatedFootings,
    elevations,
  });
  const structuralConcreteVolumeBreakdown: StructuralConcreteVolumeBreakdown = {
    ...volumeResult,
    gradeBeamVolumeCubicMeters: volumeResult.plinthBeamVolumeCubicMeters,
    ringBeamVolumeCubicMeters: volumeResult.roofBeamVolumeCubicMeters,
    columnBelowGradeVolumeCubicMeters: volumeResult.columnBelowPlinthVolumeCubicMeters,
    columnAboveGradeVolumeCubicMeters: volumeResult.columnAbovePlinthVolumeCubicMeters,
  };
  const structuralConcreteVolumeCubicMeters =
    structuralConcreteVolumeBreakdown.totalDeduplicatedVolumeCubicMeters;

  return {
    sourcePath: 'layout_graph',
    wallSegments,
    blockInstances,
    cornerCourseLayouts: [],
    exteriorFootprint,
    resolvedFootprint,
    boundaryViolations,
    blockCount: allBlocks.length,
    bondPattern: wall.bondPattern ?? 'running_bond',
    wallCmuLayout,
    frameSystem,
    foundationSettings,
    isolatedFootings,
    infillSystem: { kind: 'cmu_infill_system', panels },
    gableEndSystem: input.gableEndSystem,
    structuralConcreteVolumeCubicMeters,
    structuralConcreteVolumeBreakdown,
    gablePlacements,
    rakedCapPlacements,
    resolvedRoofSystem,
    resolvedInfillPanelBounds,
  };
}

export function generateBearingWallGeometryFromLayout(params: {
  wallLayout: DesignWallLayoutParameters;
  wall: CmuWallSystemParameters;
  resolvedWallGeometry?: ResolvedWallLayoutGeometry;
}): Pick<
  DesignGeometryResult,
  | 'wallSegments'
  | 'blockInstances'
  | 'cornerCourseLayouts'
  | 'exteriorFootprint'
  | 'resolvedFootprint'
  | 'boundaryViolations'
  | 'blockCount'
  | 'bondPattern'
  | 'wallCmuLayout'
> {
  const resolvedWallGeometry =
    params.resolvedWallGeometry ?? resolveWallLayoutGeometry(params.wallLayout, params.wall);
  const resolvedFootprint = resolvedBuildingFootprintFromWallLayout(resolvedWallGeometry);
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
    x: (frame.start.x + frame.end.x) / 2 + frame.inwardNormal.x * (frame.wallThicknessMeters / 2),
    y: frame.wallHeightMeters / 2,
    z: (frame.start.z + frame.end.z) / 2 + frame.inwardNormal.z * (frame.wallThicknessMeters / 2),
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
    depthMeters: block.depthMeters,
    source: block.source,
    terminalClosure: block.terminalClosure,
    x: block.x,
    y: block.y,
    z: block.z,
    rotationY: block.rotationY,
    lengthMeters: block.lengthMeters,
  }));
  const boundaryViolations = findExteriorFootprintBoundaryViolations(
    blockInstances,
    exteriorFootprint,
    params.wall.wallThicknessMeters || params.wallLayout.defaultWallThicknessMeters,
  );
  return {
    wallSegments,
    blockInstances,
    cornerCourseLayouts:
      wallCmuLayout.cornerAssemblies?.map((assembly) => ({
        cornerId: assembly.cornerId,
        nodeId: assembly.cornerId.replace(/^corner-/, ''),
        courseIndex: assembly.courseIndex,
        ownerSegmentId: assembly.ownerSegmentId,
        buttingSegmentId: assembly.buttingSegmentId,
        cornerType:
          assembly.cornerType === 'convex_outside'
            ? 'outside'
            : assembly.cornerType === 'concave_inside'
              ? 'inside'
              : assembly.cornerType,
        strategy: 'interlocked_running_bond' as const,
        ownerStartTrim: assembly.ownerSetbackMeters,
        buttingStartTrim: assembly.buttingSetbackMeters,
        generatedUnitType:
          assembly.generatedUnitType === 'corner'
            ? 'corner_block'
            : assembly.generatedUnitType === 'half'
              ? 'half_block'
              : assembly.generatedUnitType === 'cut'
                ? 'cut_block'
                : 'full_block',
      })) ?? [],
    exteriorFootprint,
    resolvedFootprint,
    boundaryViolations,
    blockCount: wallCmuLayout.blocks.length,
    bondPattern: params.wall.bondPattern ?? 'running_bond',
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
      kind: 'structural_frame_system',
      buildingSystemMode: 'cmu_bearing_wall',
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

export function createDefaultGableEnd(hostSegmentId: string, eaveElevationMeters: number): GableEndSettings {
  return {
    kind: 'gable_end',
    id: `gable-${hostSegmentId}`,
    hostWallSegmentId: hostSegmentId,
    eaveElevationMeters,
    peakMode: 'rise_above_eave',
    peakRiseMeters: 1.2,
    ridgePosition: 'centered',
    roofToMasonryClearanceMeters: 0.1016,
    roofClearanceMeasurement: 'perpendicular_to_roof_slope',
    bondPattern: 'running_bond',
  };
}
