import type {
  BuildingSystemMode,
  CmuInfillSystemParameters,
  CmuWallSystemParameters,
  DesignWallLayoutParameters,
  GableEndSettings,
  GableEndSystemParameters,
  IsolatedFooting,
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

export type StructuralFrameGeometryInput = {
  buildingSystemMode: BuildingSystemMode;
  wallLayout: DesignWallLayoutParameters;
  wall: CmuWallSystemParameters;
  slab: ThickenedEdgeSlabParameters;
  frameSystem: StructuralFrameSystemParameters;
  foundationSettings: StructuralFoundationSettings;
  infillSystem: CmuInfillSystemParameters;
  gableEndSystem: GableEndSystemParameters;
};

export type StructuralConcreteVolumeBreakdown = {
  gradeBeamVolumeCubicMeters: number;
  ringBeamVolumeCubicMeters: number;
  columnBelowGradeVolumeCubicMeters: number;
  columnAboveGradeVolumeCubicMeters: number;
  footingVolumeCubicMeters: number;
  totalDeduplicatedVolumeCubicMeters: number;
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
  const structuralConcreteVolumeBreakdown = resolveStructuralConcreteVolumes({
    columns: frameSystem.columns,
    beams: frameSystem.beams,
    footings: isolatedFootings,
    bottomOfGradeBeamY: elevations.bottomOfGradeBeamY,
    topOfGradeBeamY: elevations.topOfGradeBeamY,
  });
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
