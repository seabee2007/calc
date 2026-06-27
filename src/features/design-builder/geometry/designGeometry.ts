import type {
  CmuWallSystemParameters,
  DesignWallDimensionBasis,
  DesignWallLayoutParameters,
  GableRoofSystemParameters,
  SteelTrussSystemParameters,
  ThickenedEdgeSlabParameters,
  WallOpeningParameters,
} from '../types';
import {
  analyzeCmuModuleFit,
  resolveCmuModuleConfig,
  summarizeWallModuleFits,
  validateCmuOpenings,
  type CmuModuleFitResult,
} from '../domain/cmuModuleRules';
import {
  buildModuleFitReportFromPlacements,
  unresolvedModuleFitReport,
  type ModuleFitReport,
} from '../domain/moduleFitReport';
import { deriveExteriorBounds } from '../domain/wallLayoutRules';
import {
  buildLayoutLintelCourseAssemblies,
  lintelCourseClosureToBlockType,
  type LintelCourseAssembly,
  type LintelCourseClosurePlacement,
} from '../domain/lintelCourseClosureSolver';
import {
  blockOverlapsOpeningAssembly,
  buildDerivedOpeningSupports,
  buildLayoutLintelBearingSupportBlocks,
  buildLayoutLintelSolidPlacements,
  buildLegacyJambGroutFillPlacements,
  buildLegacyLintelBearingSupportBlocks,
  buildLegacyLintelSolidPlacements,
  buildLintelGroutFillPlacements,
  buildSillGroutFillPlacements,
  deduplicateGroutFillPlacements,
  groutFillsToJambGroutCells,
  lintelSolidToInstance,
  resolveLintelCourseIndex,
  resolveEffectiveLintelSpan,
  resolveOpeningUnitDisposition,
  resolveUnitSegmentsAroundOpenings,
  resolveLintelModuleSpan,
  summarizeGroutFillPlacements,
  supportBlockPlacementToBlockInstance,
  type DerivedOpeningSupport,
  type GroutFillPlacement,
  type LintelSolidKind,
  type OpeningSupportBlockPlacement,
  type OpeningUnitSplitSegment,
  type ResolvedLintelSpan,
  type SegmentFrameLike,
} from '../domain/openingAssemblySolver';
import {
  classifyClosureGapLength,
  closureClassificationToBlockType,
  computeOpeningJambGapsForCourse,
  openingJambGapToCourseClosure,
  shouldPlaceJambClosureBlock,
  type CourseUnitSpan,
  type OpeningClosureRole,
} from '../domain/openingCourseClosureSolver';
import { resolveCmuCoreGeometry } from '../domain/cmuCoreGeometry';
import {
  buildClosureGroutFillPlacements,
  buildLayoutJambGroutFillPlacementsFromBlocks,
} from '../domain/groutCellPlacements';
import {
  calculateCmuOpeningGroutSummary,
  OPENING_GROUT_CONCEPTUAL_WARNING,
  OPENING_GROUT_CORE_WARNING,
  resolveCmuOpenings,
  type CmuOpeningGroutSummary,
  type ResolvedCmuOpening,
} from '../domain/cmuOpeningRules';
import {
  defaultFrameSystemsForPreset,
  generateFrameInfillGeometry,
} from './structuralFrameGeometry';
import { createDefaultFoundationSettings } from '../domain/foundationElevations';
import { createDefaultRoofSystemSettings, normalizeRoofSystemSettings } from '../domain/roofSystemDefaults';

export type DesignGeometrySourcePath = 'blank' | 'layout_graph' | 'legacy_preset' | 'manual_masonry';

export type DesignGeometryState = {
  revision: number;
  lastReason?: string;
};

export type DimensionBasis = DesignWallDimensionBasis;
const DEFAULT_MINIMUM_CUT_BLOCK_LENGTH_METERS = 0.1;

export interface DesignGeometryInput {
  sourcePath: DesignGeometrySourcePath;
  wallLayout: DesignWallLayoutParameters | null;
  wall: CmuWallSystemParameters;
  slab: ThickenedEdgeSlabParameters;
  roof: GableRoofSystemParameters;
  truss: SteelTrussSystemParameters;
  buildingSystemMode?: import('../types').BuildingSystemMode;
  frameSystem?: import('../types').StructuralFrameSystemParameters;
  foundationSettings?: import('../types').StructuralFoundationSettings;
  infillSystem?: import('../types').CmuInfillSystemParameters;
  gableEndSystem?: import('../types').GableEndSystemParameters;
  roofSystem?: import('../types').RoofSystemSettings;
}

export interface DesignGeometryWallSegment {
  segmentId: string;
  lengthMeters: number;
  heightMeters: number;
  thicknessMeters: number;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  infillCenterlineInwardOffsetMeters?: number;
}

export type SegmentFrame = {
  segmentId: string;
  start: { x: number; z: number };
  end: { x: number; z: number };
  exteriorStart: { x: number; z: number };
  exteriorEnd: { x: number; z: number };
  interiorStart: { x: number; z: number };
  interiorEnd: { x: number; z: number };
  centerlineStart: { x: number; z: number };
  centerlineEnd: { x: number; z: number };
  lengthMeters: number;
  tangent: { x: number; z: number };
  inwardNormal: { x: number; z: number };
  outwardNormal: { x: number; z: number };
  rotationY: number;
  wallHeightMeters: number;
  wallThicknessMeters: number;
};

export type OrderedPerimeterSegment = {
  segmentId: string;
  startNodeId: string;
  endNodeId: string;
  index: number;
  tangent: { x: number; z: number };
  startPoint: { x: number; z: number };
  endPoint: { x: number; z: number };
};

export type ResolvedWallLayoutGeometry = {
  dimensionBasis: DimensionBasis;
  sourcePolyline: DesignGeometryPoint[];
  exteriorFacePolygon: DesignGeometryPoint[];
  interiorFacePolygon: DesignGeometryPoint[];
  centerlinePolyline: DesignGeometryPoint[];
  orderedPerimeter: OrderedPerimeterSegment[];
  winding: 'clockwise' | 'counterclockwise';
};

export type ResolvedBuildingFootprint = {
  dimensionBasis: DimensionBasis;
  exteriorFacePolygon: DesignGeometryPoint[];
  interiorFacePolygon: DesignGeometryPoint[];
  centerlinePolygon: DesignGeometryPoint[];
  orderedPerimeterSegments: OrderedPerimeterSegment[];
  winding: 'clockwise' | 'counterclockwise';
};

export type LayoutCornerAssembly = {
  cornerId: string;
  courseIndex: number;
  phase?: 0 | 1;
  incomingSegmentId: string;
  outgoingSegmentId: string;
  ownerSegmentId: string;
  buttingSegmentId: string;
  incomingEndStationMeters?: number;
  outgoingStartStationMeters?: number;
  exteriorCornerPoint: { x: number; z: number };
  ownerCloser: 'full' | 'half' | 'corner';
  buttingCloser: 'full' | 'half' | 'end';
  ownerCloserType?: 'full' | 'half' | 'corner';
  buttingCloserType?: 'full' | 'half' | 'end';
  ownerSetbackMeters: number;
  buttingSetbackMeters: number;
  cornerType: 'convex_outside' | 'concave_inside' | 'end' | 'tee';
  generatedUnitType: 'full' | 'half' | 'corner' | 'end' | 'cut';
  strategy: 'interlocked_running_bond';
};

export type ClockwisePerimeter = {
  winding: 'clockwise';
  startNodeId: string;
  segments: Array<{
    segmentId: string;
    startNodeId: string;
    endNodeId: string;
    tangent: { x: number; z: number };
    outwardNormal: { x: number; z: number };
    inwardNormal: { x: number; z: number };
    lengthMeters: number;
    incomingCornerId?: string;
    outgoingCornerId?: string;
    exteriorStart: { x: number; z: number };
    exteriorEnd: { x: number; z: number };
    rotationY: number;
  }>;
};

export type CmuCornerCourseAssembly = {
  cornerId: string;
  courseIndex: number;
  phase: 0 | 1;
  incomingSegmentId: string;
  outgoingSegmentId: string;
  ownerSegmentId: string;
  buttingSegmentId: string;
  incomingEndStationMeters: number;
  outgoingStartStationMeters: number;
  ownerCloserType: 'full' | 'half' | 'corner';
  buttingCloserType: 'full' | 'half' | 'end';
  exteriorCornerPoint: { x: number; z: number };
};

export type SegmentSolutionScore = {
  cutUnits: number;
  halfUnits: number;
  fullUnits: number;
  cornerIntegrityPenalty: number;
};

export type ValidationResult = {
  valid: boolean;
  warnings: string[];
};

export type CmuSegmentCoursePlan = {
  segmentId: string;
  courseIndex: number;
  startStationMeters: number;
  endStationMeters: number;
  startCornerId?: string;
  endCornerId?: string;
  ownerAtStart: boolean;
  ownerAtEnd: boolean;
  buttingAtStart: boolean;
  buttingAtEnd: boolean;
  units: CmuCourseUnit[];
  score: SegmentSolutionScore;
  validation: ValidationResult;
};

export type CmuCoursePlan = {
  courseIndex: number;
  phase: 0 | 1;
  elevationY: number;
  perimeter: ClockwisePerimeter;
  cornerAssemblies: CmuCornerCourseAssembly[];
  segmentPlans: CmuSegmentCoursePlan[];
};

export interface DesignGeometryBlockInstance {
  id: string;
  panelId?: string;
  segmentId: string;
  course: number;
  courseIndex?: number;
  moduleIndex?: number;
  blockType: CmuBlockType;
  unitType?: CmuUnitPlacement['unitType'];
  kind?: CmuUnitPlacement['kind'];
  stationMeters?: number;
  cornerId?: string;
  nominalLengthMeters?: number;
  actualLengthMeters?: number;
  heightMeters?: number;
  physicalHeightMeters?: number;
  depthMeters?: number;
  source?: CmuUnitPlacement['source'];
  terminalClosure?: TerminalClosureUnit;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  lengthMeters: number;
}

export interface DesignGeometryPoint {
  x: number;
  z: number;
}

export interface DesignGeometryBoundaryViolation {
  blockId: string;
  segmentId: string;
  course: number;
  blockType: CmuBlockType;
}

export interface CmuCornerCourseLayout {
  cornerId: string;
  nodeId: string;
  courseIndex: number;
  ownerSegmentId: string;
  buttingSegmentId: string;
  cornerType: 'outside' | 'inside' | 'end' | 'tee';
  strategy: 'interlocked_running_bond' | 'butt' | 'pilaster';
  ownerStartTrim: number;
  buttingStartTrim: number;
  generatedUnitType: 'corner_block' | 'full_block' | 'half_block' | 'end_block' | 'cut_block';
  warning?: string;
}

export interface DesignGeometryResult {
  sourcePath: DesignGeometrySourcePath;
  wallSegments: DesignGeometryWallSegment[];
  blockInstances: DesignGeometryBlockInstance[];
  cornerCourseLayouts: CmuCornerCourseLayout[];
  exteriorFootprint: DesignGeometryPoint[];
  resolvedFootprint: ResolvedBuildingFootprint | null;
  boundaryViolations: DesignGeometryBoundaryViolation[];
  blockCount: number;
  bondPattern: NonNullable<CmuWallSystemParameters['bondPattern']>;
  wallCmuLayout: CmuLayoutResult;
  buildingSystemMode?: import('../types').BuildingSystemMode;
  frameSystem?: import('../types').StructuralFrameSystemParameters;
  foundationSettings?: import('../types').StructuralFoundationSettings;
  isolatedFootings?: import('../types').IsolatedFooting[];
  infillSystem?: import('../types').CmuInfillSystemParameters;
  gableEndSystem?: import('../types').GableEndSystemParameters;
  structuralConcreteVolumeCubicMeters?: number;
  structuralConcreteVolumeBreakdown?: import('./structuralFrameGeometry').StructuralConcreteVolumeBreakdown;
  gablePlacements?: import('../types').GableCmuPlacement[];
  rakedCapPlacements?: import('../types').RakedCapPlacement[];
  resolvedRoofSystem?: import('../types').ResolvedRoofSystem | null;
  resolvedInfillPanelBounds?: import('../domain/infillPanelBoundsResolver').ResolvedInfillPanelBounds[];
  interiorFloorSlab?: import('../domain/interiorFloorSlab').ResolvedInteriorFloorSlab;
  floorTileLayout?: import('../types').ResolvedFloorTileLayout;
  plywoodCeilingLayout?: import('../types').ResolvedPlywoodCeilingLayout;
}

export interface CmuBlockInstance {
  id: string;
  face: CmuBlockInstanceWallFace;
  segmentId?: string;
  course: number;
  courseIndex?: number;
  moduleIndex?: number;
  blockType: CmuBlockType;
  unitType?: CmuUnitPlacement['unitType'];
  kind?: CmuUnitPlacement['kind'];
  stationMeters?: number;
  cornerId?: string;
  nominalLengthMeters?: number;
  actualLengthMeters?: number;
  heightMeters?: number;
  physicalHeightMeters?: number;
  depthMeters?: number;
  source?: CmuUnitPlacement['source'];
  terminalClosure?: TerminalClosureUnit;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  lengthMeters: number;
  startAlongMeters: number;
  endAlongMeters: number;
  wallFace?: CmuBlockInstanceWallFace | string;
  infillBand?: 'above_grade' | 'below_grade' | 'gable' | 'main';
  nearOpeningId?: string;
  closureRole?: OpeningClosureRole;
  adjacentTo?: 'rough_opening_start' | 'rough_opening_end';
}

export type CmuUnitPlacement = {
  id: string;
  segmentId: string;
  cornerId?: string;
  openingId?: string;
  courseIndex: number;
  moduleIndex: number;
  unitType: 'full' | 'half' | 'end' | 'corner' | 'jamb' | 'bond_beam' | 'cut';
  kind?:
    | 'stretcher'
    | 'corner_block'
    | 'half_block'
    | 'end_block'
    | 'cut_block'
    | 'cut_height_block'
    | 'jamb_block'
    | 'bond_beam_block';
  startStationMeters?: number;
  endStationMeters?: number;
  nominalLengthMeters: number;
  actualLengthMeters: number;
  heightMeters: number;
  physicalHeightMeters?: number;
  depthMeters: number;
  center: { x: number; y: number; z: number };
  rotationY: number;
  source:
    | 'corner_assembly'
    | 'wall_run'
    | 'opening_closure'
    | 'terminal_closure'
    | 'auto_layout'
    | 'closed_perimeter_solver'
    | 'manual_override'
    | 'opening_assembly_solver'
    | 'opening_jamb_closure'
    | 'lintel_closure'
    | 'infill_panel_solver'
    | 'panel_top_closure'
    | 'gable_end_solver'
    | 'rc_frame_infill'
    | 'below_grade_rc_infill';
  openingId?: string;
  adjacentTo?: 'rough_opening_start' | 'rough_opening_end';
  terminalClosure?: TerminalClosureUnit;
};

export type CmuBlockPlacement = CmuUnitPlacement & {
  stationMeters: number;
  lengthMeters: number;
};

export type MasonryCourseContext = {
  courseIndex: number;
  coursePhase: 0 | 1;
  elevationY: number;
  bondPattern: 'running_bond' | 'stack_bond';
  orderedPerimeterSegmentIds: string[];
  globalJointOffset: number;
};

export type CmuBlockType =
  | 'full'
  | 'half'
  | 'end'
  | 'corner'
  | 'jamb'
  | 'lintel_bond_beam'
  | 'cut';

export type TerminalClosureUnit = {
  segmentId: string;
  courseIndex: number;
  direction: 'clockwise';
  startStationMeters: number;
  endStationMeters: number;
  remainingLengthMeters: number;
  unitType: 'cut';
  location: 'outgoing_corner';
  reason: 'non_modular_terminal_closure';
};

export interface CmuLintelInstance {
  id: string;
  face: CmuBlockInstanceWallFace;
  openingId: string;
  courseIndex?: number;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  lengthMeters: number;
  heightMeters: number;
  depthMeters?: number;
  bearingLeftMeters?: number;
  bearingRightMeters?: number;
  segmentId?: string;
  hostSegmentId?: string;
  kind?: LintelSolidKind;
  source?: 'opening_assembly_solver';
}

export interface CmuPilasterInstance {
  id: string;
  face: CmuBlockInstanceWallFace;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  heightMeters: number;
  nodeId?: string;
}

export interface CmuJambGroutCellInstance {
  id: string;
  face: CmuBlockInstanceWallFace;
  openingId: string;
  courseIndex: number;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  heightMeters: number;
  widthMeters: number;
  segmentId?: string;
}

export type CmuOpeningClosureType =
  | 'none'
  | 'half_block'
  | 'end_block'
  | 'jamb_block'
  | 'cut_block'
  | 'grout_fill'
  | 'shim_gap';

export interface CmuOpeningCourseClosure {
  openingId: string;
  wallFace: CmuBlockInstanceWallFace;
  courseIndex: number;
  courseBottom: number;
  courseTop: number;
  side: 'left' | 'right';
  roughOpeningEdge: number;
  nearestBlockEdge: number;
  residualGap: number;
  closureType: CmuOpeningClosureType;
  suggestedUnitType?: string;
  groutVolume?: number;
  warning?: string;
}

export interface CmuLayoutResult {
  blocks: CmuBlockInstance[];
  unitPlacements: CmuUnitPlacement[];
  lintels: CmuLintelInstance[];
  pilasters: CmuPilasterInstance[];
  roughOpenings: ResolvedCmuOpening[];
  jambGroutCells: CmuJambGroutCellInstance[];
  groutFillPlacements: GroutFillPlacement[];
  openingCourseClosures: CmuOpeningCourseClosure[];
  lintelCourseAssemblies: LintelCourseAssembly[];
  derivedOpeningSupports: DerivedOpeningSupport[];
  openingGrout: CmuOpeningGroutSummary;
  terminalClosures: TerminalClosureUnit[];
  counts: Record<CmuBlockType, number>;
  totalBlocks: number;
  courseCount: number;
  moduleFits: ReturnType<typeof summarizeWallModuleFits>;
  moduleFitReport: ModuleFitReport;
  coursePlans?: CmuCoursePlan[];
  warnings: string[];
  topClosureCutBlockCount?: number;
  bondBeamLengthMeters: number;
  groutedCellCount: number;
  segmentFrames?: SegmentFrame[];
  cornerAssemblies?: LayoutCornerAssembly[];
}

export function normalizeBondPattern(
  bondPattern: CmuWallSystemParameters['bondPattern'],
): NonNullable<CmuWallSystemParameters['bondPattern']> {
  return bondPattern === 'stack_bond' ? 'stack_bond' : 'running_bond';
}

export function createMasonryCourseContext(params: {
  courseIndex: number;
  moduleHeightMeters: number;
  nominalModuleLengthMeters: number;
  bondPattern: CmuWallSystemParameters['bondPattern'];
  orderedPerimeterSegmentIds: readonly string[];
}): MasonryCourseContext {
  const bondPattern = normalizeBondPattern(params.bondPattern);
  const coursePhase = (params.courseIndex % 2) as 0 | 1;
  return {
    courseIndex: params.courseIndex,
    coursePhase,
    elevationY: params.courseIndex * params.moduleHeightMeters,
    bondPattern,
    orderedPerimeterSegmentIds: [...params.orderedPerimeterSegmentIds],
    globalJointOffset: bondPattern === 'running_bond' && coursePhase === 1 ? params.nominalModuleLengthMeters / 2 : 0,
  };
}

export function buildDesignGeometryInputFromLayout(params: {
  wallLayout: DesignWallLayoutParameters | null;
  cmuSettings: CmuWallSystemParameters;
  openings?: WallOpeningParameters[];
  slabSettings: ThickenedEdgeSlabParameters;
  roofSettings: GableRoofSystemParameters;
  trussSettings: SteelTrussSystemParameters;
  buildingSystemMode?: import('../types').BuildingSystemMode;
  frameSystem?: import('../types').StructuralFrameSystemParameters;
  foundationSettings?: import('../types').StructuralFoundationSettings;
  infillSystem?: import('../types').CmuInfillSystemParameters;
  gableEndSystem?: import('../types').GableEndSystemParameters;
  roofSystem?: import('../types').RoofSystemSettings;
}): DesignGeometryInput {
  const hasLayoutGraph = Boolean(params.wallLayout && params.wallLayout.segments.length > 0);
  const hasManualMasonry = Boolean(params.cmuSettings.manualMasonryCourseRuns?.length);
  return {
    sourcePath: hasLayoutGraph ? 'layout_graph' : hasManualMasonry ? 'manual_masonry' : 'blank',
    wallLayout: hasLayoutGraph ? params.wallLayout : null,
    wall: {
      ...params.cmuSettings,
      bondPattern: normalizeBondPattern(params.cmuSettings.bondPattern),
      openings: params.openings ?? params.cmuSettings.openings,
    },
    slab: params.slabSettings,
    roof: params.roofSettings,
    truss: params.trussSettings,
    buildingSystemMode: params.buildingSystemMode,
    frameSystem: params.frameSystem,
    foundationSettings: params.foundationSettings,
    infillSystem: params.infillSystem,
    gableEndSystem: params.gableEndSystem,
    roofSystem: params.roofSystem,
  };
}

export function generateDesignGeometry(input: DesignGeometryInput): DesignGeometryResult {
  const wall = {
    ...input.wall,
    bondPattern: normalizeBondPattern(input.wall.bondPattern),
  };
  if (import.meta.env.DEV && !input.wall.bondPattern) {
    console.warn('[DesignBuilder] Missing bond pattern; defaulting to running_bond.');
  }
  if (input.sourcePath === 'blank' || input.sourcePath === 'manual_masonry') {
    const wallCmuLayout = emptyCmuLayout({ ...wall, openings: [] });
    return {
      sourcePath: input.sourcePath,
      wallSegments: [],
      blockInstances: [],
      cornerCourseLayouts: [],
      exteriorFootprint: [],
      resolvedFootprint: null,
      boundaryViolations: [],
      blockCount: 0,
      bondPattern: normalizeBondPattern(wall.bondPattern),
      wallCmuLayout,
    };
  }
  if (input.sourcePath !== 'layout_graph' || !input.wallLayout) {
    const wallCmuLayout = generateCmuLayout(wall);
    return {
      sourcePath: 'legacy_preset',
      wallSegments: [],
      blockInstances: wallCmuLayout.blocks.map((block) => ({
        id: block.id,
        segmentId: block.face,
        course: block.course,
        blockType: block.blockType,
        x: block.x,
        y: block.y,
        z: block.z,
        rotationY: block.rotationY,
        lengthMeters: block.lengthMeters,
      })),
      cornerCourseLayouts: [],
      exteriorFootprint: [],
      resolvedFootprint: null,
      boundaryViolations: [],
      blockCount: wallCmuLayout.totalBlocks,
      bondPattern: wall.bondPattern ?? 'running_bond',
      wallCmuLayout,
      buildingSystemMode: input.buildingSystemMode ?? 'reinforced_concrete_frame_with_cmu_infill',
    };
  }

  if (input.buildingSystemMode === 'reinforced_concrete_frame_with_cmu_infill') {
    const defaults = defaultFrameSystemsForPreset();
    return generateFrameInfillGeometry({
      buildingSystemMode: input.buildingSystemMode,
      wallLayout: input.wallLayout,
      wall,
      slab: input.slab,
      frameSystem: input.frameSystem ?? defaults.frameSystem,
      foundationSettings: input.foundationSettings ?? createDefaultFoundationSettings(),
      roofSystem: normalizeRoofSystemSettings(input.roofSystem ?? createDefaultRoofSystemSettings()),
      infillSystem: input.infillSystem ?? defaults.infillSystem,
      gableEndSystem: input.gableEndSystem ?? defaults.gableEndSystem,
    });
  }

  const resolvedWallGeometry = resolveWallLayoutGeometry(input.wallLayout, wall);
  const resolvedFootprint = resolvedBuildingFootprintFromWallLayout(resolvedWallGeometry);
  const wallCmuLayout = generateCmuLayoutFromWallLayout(input.wallLayout, wall, resolvedWallGeometry);
  const exteriorFootprint = wallCmuLayout.segmentFrames?.length ? resolvedWallGeometry.exteriorFacePolygon : [];
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
    wall.wallThicknessMeters || input.wallLayout.defaultWallThicknessMeters,
  );
  if (import.meta.env.DEV && boundaryViolations.length > 0) {
    console.warn('[DesignBuilder] CMU unit outside exterior footprint', {
      boundaryViolations,
      exteriorFootprint,
      dimensionBasis: resolvedWallGeometry.dimensionBasis,
    });
  }
  return {
    sourcePath: 'layout_graph',
    wallSegments,
    blockInstances,
    cornerCourseLayouts: wallCmuLayout.cornerAssemblies?.map((assembly) => ({
      cornerId: assembly.cornerId,
      nodeId: assembly.cornerId.replace(/^corner-/, ''),
      courseIndex: assembly.courseIndex,
      ownerSegmentId: assembly.ownerSegmentId,
      buttingSegmentId: assembly.buttingSegmentId,
      cornerType: assembly.cornerType === 'convex_outside' ? 'outside' : assembly.cornerType === 'concave_inside' ? 'inside' : assembly.cornerType,
      strategy: 'interlocked_running_bond',
      ownerStartTrim: assembly.ownerSetbackMeters,
      buttingStartTrim: assembly.buttingSetbackMeters,
      generatedUnitType: generatedCornerUnitType(assembly.generatedUnitType),
    })) ?? [],
    exteriorFootprint,
    resolvedFootprint,
    boundaryViolations,
    blockCount: wallCmuLayout.blocks.length,
    bondPattern: wall.bondPattern ?? 'running_bond',
    wallCmuLayout,
  };
}

export function generateCmuBlockInstances(params: CmuWallSystemParameters): CmuBlockInstance[] {
  if (!params.showIndividualBlocks) return [];
  return generateCmuLayout(params).blocks;
}

export function generateCmuLayoutFromWallLayout(
  layout: DesignWallLayoutParameters,
  params: CmuWallSystemParameters,
  resolvedGeometry = resolveWallLayoutGeometry(layout, params),
): CmuLayoutResult {
  const moduleConfig = resolveCmuModuleConfig(params);
  const moduleLength = moduleConfig.moduleLengthMeters;
  const moduleHeight = moduleConfig.moduleHeightMeters;
  const actualFullLength = moduleConfig.actualLengthMeters ?? Math.max(0.01, moduleLength - moduleConfig.mortarJointMeters);
  const actualHeight = moduleConfig.actualHeightMeters ?? Math.max(0.01, moduleHeight - moduleConfig.mortarJointMeters);
  if (moduleLength <= 0 || moduleHeight <= 0) return emptyCmuLayout(params);

  const warnings: string[] = [];
  const segmentFrames = buildSegmentFrames(layout, params, warnings, resolvedGeometry);
  const frameById = new Map(segmentFrames.map((frame) => [frame.segmentId, frame]));
  const courseCount = Math.max(1, ...segmentFrames.map((frame) => courseCountFromHeight(frame.wallHeightMeters, moduleHeight)));
  const clockwisePerimeter = buildClockwisePerimeter(resolvedGeometry);
  if (!clockwisePerimeter) {
    warnings.push('Closed CMU perimeter could not be normalized clockwise; no closed-loop masonry units were generated.');
  }
  const coursePlans = clockwisePerimeter
    ? buildCmuCoursePlans({
        perimeter: clockwisePerimeter,
        courseCount,
        moduleLength,
        actualFullLength,
        moduleHeight,
        wallThicknessMeters: params.wallThicknessMeters,
        bondPattern: params.bondPattern,
      })
    : [];
  coursePlans.forEach((plan) => {
    plan.segmentPlans.forEach((segmentPlan) => {
      if (!segmentPlan.validation.valid) {
        warnings.push(...segmentPlan.validation.warnings.map((warning) => `${segmentPlan.segmentId} course ${segmentPlan.courseIndex + 1}: ${warning}`));
      }
    });
  });
  if (import.meta.env.DEV && globalThis.localStorage?.getItem('arden:designBuilder:showCmuCourseDiagnostics') === 'true' && coursePlans.length > 0) {
    console.table(coursePlans.flatMap((plan) =>
      plan.segmentPlans.map((segmentPlan, clockwiseOrder) => {
        const terminalCut = segmentPlan.units.find((unit) => unit.terminalClosureReason);
        return {
          courseIndex: plan.courseIndex,
          segmentId: segmentPlan.segmentId,
          clockwiseOrder,
          incomingCornerCondition: segmentPlan.ownerAtStart ? 'owner' : segmentPlan.buttingAtStart ? 'butting' : 'none',
          outgoingCornerCondition: segmentPlan.ownerAtEnd ? 'owner' : segmentPlan.buttingAtEnd ? 'butting' : 'none',
          availableLength: Number((segmentPlan.endStationMeters - segmentPlan.startStationMeters).toFixed(3)),
          placements: segmentPlan.units.map((unit) => placementKindForCourseUnit(unit, segmentPlan)).join(' | '),
          fullBlocks: segmentPlan.units.filter((unit) => unit.unitType === 'full').length,
          halfBlocks: segmentPlan.units.filter((unit) => unit.unitType === 'half').length,
          cutBlocks: segmentPlan.units.filter((unit) => unit.unitType === 'cut').length,
          terminalCutLength: terminalCut ? Number(terminalCut.lengthMeters.toFixed(3)) : 0,
          cutLocation: terminalCut ? 'outgoing_corner' : '',
          cutReason: terminalCut?.terminalClosureReason ?? '',
        };
      }),
    ));
  }
  const cornerAssemblies: LayoutCornerAssembly[] = coursePlans.flatMap((plan) =>
    plan.cornerAssemblies.map((assembly) => ({
      cornerId: assembly.cornerId,
      courseIndex: assembly.courseIndex,
      phase: assembly.phase,
      incomingSegmentId: assembly.incomingSegmentId,
      outgoingSegmentId: assembly.outgoingSegmentId,
      ownerSegmentId: assembly.ownerSegmentId,
      buttingSegmentId: assembly.buttingSegmentId,
      incomingEndStationMeters: assembly.incomingEndStationMeters,
      outgoingStartStationMeters: assembly.outgoingStartStationMeters,
      exteriorCornerPoint: assembly.exteriorCornerPoint,
      ownerCloser: assembly.ownerCloserType,
      buttingCloser: assembly.buttingCloserType,
      ownerCloserType: assembly.ownerCloserType,
      buttingCloserType: assembly.buttingCloserType,
      ownerSetbackMeters: assembly.ownerSegmentId === assembly.incomingSegmentId
        ? 0
        : assembly.outgoingStartStationMeters,
      buttingSetbackMeters: assembly.buttingSegmentId === assembly.outgoingSegmentId
        ? assembly.outgoingStartStationMeters
        : Math.max(0, (frameById.get(assembly.incomingSegmentId)?.lengthMeters ?? 0) - assembly.incomingEndStationMeters),
      cornerType: 'convex_outside',
      generatedUnitType: assembly.ownerCloserType,
      strategy: 'interlocked_running_bond',
    })),
  );

  const roughOpenings = params.openings
    .map((opening) => resolveLayoutOpeningGeometry({ opening, segmentFrame: opening.wallSegmentId ? frameById.get(opening.wallSegmentId) : undefined, wallSettings: params }))
    .filter((opening): opening is ResolvedCmuOpening => opening != null);
  const resolvedLintelSpans = buildResolvedLintelSpanMap(roughOpenings, moduleLength, (opening) => {
    const segmentId = getLayoutOpeningSegmentId(opening) ?? '';
    return frameById.get(segmentId)?.lengthMeters ?? 0;
  });
  const blocks: CmuBlockInstance[] = [];
  const unitPlacements: CmuUnitPlacement[] = [];
  const counts = createEmptyCounts();
  coursePlans.forEach((plan) => {
    let globalModuleIndex = 0;
    plan.segmentPlans.forEach((segmentPlan) => {
      const perimeterSegment = plan.perimeter.segments.find((segment) => segment.segmentId === segmentPlan.segmentId);
      const frame = frameById.get(segmentPlan.segmentId);
      if (!perimeterSegment || !frame) return;
      const stationAlignment = resolveSegmentStationAlignment(frame, perimeterSegment);
      const segmentOpenings = roughOpenings.filter((opening) => getLayoutOpeningSegmentId(opening) === frame.segmentId);
      segmentPlan.units.forEach((unit, column) => {
        const masonrySpan = {
          startAlongMeters: unit.startAlongMeters,
          endAlongMeters: unit.endAlongMeters,
        };
        const frameSpan = stationAlignment.masonrySpanToFrame(masonrySpan);
        const courseBottomMeters = plan.courseIndex * moduleHeight;
        const courseTopMeters = plan.courseIndex * moduleHeight + actualHeight;
        const segments = resolveUnitSegmentsAroundOpenings({
          startAlongMeters: frameSpan.startAlongMeters,
          endAlongMeters: frameSpan.endAlongMeters,
          openings: segmentOpenings,
          courseIndex: plan.courseIndex,
          courseBottomMeters,
          courseTopMeters,
          moduleHeightMeters: moduleHeight,
          moduleLengthMeters: moduleLength,
          wallLengthMeters: frame.lengthMeters,
          resolvedLintelSpans,
        });
        if (segments.length === 0) return;
        const isFirstUnit = column === 0;
        const isLastUnit = column === segmentPlan.units.length - 1;
        const defaultBlockType =
          unit.unitType === 'cut'
            ? 'cut'
            : unit.unitType === 'half'
              ? 'half'
              : (isFirstUnit && segmentPlan.ownerAtStart) || (isLastUnit && segmentPlan.ownerAtEnd)
                ? 'corner'
                : (isFirstUnit && segmentPlan.buttingAtStart) || (isLastUnit && segmentPlan.buttingAtEnd)
                  ? 'end'
                  : 'full';
        const terminalClosure: TerminalClosureUnit | undefined =
          unit.terminalClosureReason && segments.length === 1 && segments[0].source === 'wall_run'
            ? {
                segmentId: frame.segmentId,
                courseIndex: plan.courseIndex,
                direction: 'clockwise',
                startStationMeters: frameSpan.startAlongMeters,
                endStationMeters: frameSpan.endAlongMeters,
                remainingLengthMeters: unit.lengthMeters,
                unitType: 'cut',
                location: 'outgoing_corner',
                reason: unit.terminalClosureReason,
              }
            : undefined;
        segments.forEach((segment, segmentIndex) => {
          const isJambClosure = segment.source === 'opening_jamb_closure';
          const blockType = blockTypeForOpeningSegment(segment, moduleLength, defaultBlockType);
          const placementStartAlongMeters = segment.startAlongMeters;
          const placementEndAlongMeters = segment.endAlongMeters;
          const placementLengthMeters = segment.lengthMeters;
          const actualLengthMeters = actualLengthForOpeningSegment(segment, unit.lengthMeters);
          const placement = createCmuBlockPlacement({
            id:
              segments.length === 1
                ? `${frame.segmentId}-${plan.courseIndex}-${globalModuleIndex}`
                : `${frame.segmentId}-${plan.courseIndex}-${globalModuleIndex}-s${segmentIndex}`,
            segmentId: frame.segmentId,
            cornerId: isFirstUnit ? segmentPlan.startCornerId : isLastUnit ? segmentPlan.endCornerId : undefined,
            courseIndex: plan.courseIndex,
            moduleIndex: globalModuleIndex,
            unitType: placementUnitFromBlockType(blockType),
            stationMeters: placementStartAlongMeters,
            nominalLengthMeters: placementLengthMeters,
            actualLengthMeters,
            heightMeters: actualHeight,
            depthMeters: frame.wallThicknessMeters,
            wallStart: resolveSegmentWallLayoutStart(frame),
            tangent: frame.tangent,
            inwardNormal: frame.inwardNormal,
            moduleHeightMeters: moduleHeight,
            rotationY: frame.rotationY,
            source: isJambClosure
              ? 'opening_jamb_closure'
              : terminalClosure
                ? 'terminal_closure'
                : blockType === 'corner' || blockType === 'end'
                  ? 'corner_assembly'
                  : 'wall_run',
            kind:
              blockType === 'corner'
                ? 'corner_block'
                : blockType === 'end'
                  ? 'end_block'
                  : blockType === 'half'
                    ? 'half_block'
                    : blockType === 'cut'
                      ? 'cut_block'
                      : 'stretcher',
            startStationMeters: placementStartAlongMeters,
            endStationMeters: placementEndAlongMeters,
            terminalClosure: isJambClosure ? undefined : terminalClosure,
            openingId: segment.openingId,
            adjacentTo: segment.adjacentTo,
          });
          globalModuleIndex += 1;
          unitPlacements.push(placement);
          blocks.push({
            id: placement.id,
            face: 'north',
            segmentId: frame.segmentId,
            cornerId: placement.cornerId,
            course: plan.courseIndex,
            courseIndex: placement.courseIndex,
            moduleIndex: placement.moduleIndex,
            blockType,
            unitType: placement.unitType,
            kind: placement.kind,
            stationMeters: placement.stationMeters,
            nominalLengthMeters: placement.nominalLengthMeters,
            actualLengthMeters: placement.actualLengthMeters,
            heightMeters: placement.heightMeters,
            depthMeters: placement.depthMeters,
            source: placement.source,
            terminalClosure: placement.terminalClosure,
            x: placement.center.x,
            y: placement.center.y,
            z: placement.center.z,
            rotationY: placement.rotationY,
            lengthMeters: placement.lengthMeters,
            startAlongMeters: placementStartAlongMeters,
            endAlongMeters: placementEndAlongMeters,
            nearOpeningId: segment.openingId,
            adjacentTo: segment.adjacentTo,
          });
          counts[blockType] += 1;
        });
      });
    });
  });

  const lintelSolids = buildLayoutLintelSolidPlacements(
    roughOpenings,
    frameById,
    moduleHeight,
    actualHeight,
    moduleLength,
    resolvedLintelSpans,
  );
  const lintelSupportBlocks = buildLayoutLintelBearingSupportBlocks(
    roughOpenings,
    frameById,
    moduleLength,
    moduleHeight,
    actualHeight,
    resolvedLintelSpans,
  );
  const lintels = lintelSolids.map(lintelSolidToInstance);
  lintels.forEach(() => {
    counts.lintel_bond_beam += 1;
  });
  appendSupportBlocksToLayout(lintelSupportBlocks, blocks, counts);
  const layoutCourseUnitsBySegment = new Map<string, { startAlongMeters: number; endAlongMeters: number }[]>();
  coursePlans.forEach((plan) => {
    plan.segmentPlans.forEach((segmentPlan) => {
      const masonryUnits = segmentPlan.units.map((unit) => ({
        startAlongMeters: unit.startAlongMeters,
        endAlongMeters: unit.endAlongMeters,
      }));
      layoutCourseUnitsBySegment.set(`${segmentPlan.segmentId}-${plan.courseIndex}`, masonryUnits);
    });
  });
  const lintelCourseAssemblies = buildLayoutLintelCourseAssemblies({
    openings: roughOpenings,
    framesById: frameById,
    moduleLengthMeters: moduleLength,
    moduleHeightMeters: moduleHeight,
    actualHeightMeters: actualHeight,
    resolvedLintelSpans,
    courseUnitsBySegmentCourse: layoutCourseUnitsBySegment,
    placedBlocksBySegmentCourse: placedCourseBlocksBySegmentCourse(blocks),
    openingsBySegmentId: getLayoutOpeningSegmentId,
    runningBond: normalizeBondPattern(params.bondPattern) === 'running_bond',
  });
  appendLintelCourseClosuresToLayout(lintelCourseAssemblies, blocks, counts);
  const closureKeys = new Set<string>();
  const segmentStationAlignments = new Map<string, ReturnType<typeof resolveSegmentStationAlignment>>();
  if (clockwisePerimeter) {
    clockwisePerimeter.segments.forEach((perimeterSegment) => {
      const alignmentFrame = frameById.get(perimeterSegment.segmentId);
      if (alignmentFrame) {
        segmentStationAlignments.set(
          perimeterSegment.segmentId,
          resolveSegmentStationAlignment(alignmentFrame, perimeterSegment),
        );
      }
    });
  }
  const openingCourseClosures = appendOpeningJambClosureBlocks({
    openings: roughOpenings,
    lintelSupportBlocks,
    moduleLength,
    moduleHeight,
    actualHeight,
    actualFullLength,
    wallThickness: params.wallThicknessMeters,
    courseCount,
    runningBond: normalizeBondPattern(params.bondPattern) === 'running_bond',
    cornerCondition: params.cornerCondition,
    fillFactor: params.coreFillFactor ?? 0.5,
    groutWastePercent: params.groutWastePercent ?? 0.1,
    wallLengthByFace: {
      north: params.lengthMeters,
      south: params.lengthMeters,
      east: params.widthMeters,
      west: params.widthMeters,
    },
    resolvedLintelSpans,
    segmentFrames: frameById,
    segmentStationAlignments,
    openingsBySegmentId: getLayoutOpeningSegmentId,
    courseUnitsResolver: (segmentId, courseIndex) =>
      layoutCourseUnitsBySegment.get(`${segmentId}-${courseIndex}`),
    blocks,
    counts,
    closureKeys,
  });

  const purgedBlocks = purgeBlocksInsideOpeningVoids({
    blocks,
    openings: roughOpenings,
    frameById,
    moduleHeight,
    moduleLength,
    actualHeight,
    resolvedLintelSpans,
  });
  blocks.splice(0, blocks.length, ...purgedBlocks);
  Object.keys(counts).forEach((key) => {
    counts[key as CmuBlockType] = 0;
  });
  blocks.forEach((block) => {
    counts[block.blockType] += 1;
  });
  lintels.forEach(() => {
    counts.lintel_bond_beam += 1;
  });

  const core = resolveCmuCoreGeometry(params);
  const wastePercent = Math.max(0, params.groutWastePercent ?? 0.1) * 100;
  const jambGroutFills = buildLayoutJambGroutFillPlacementsFromBlocks({
    openings: roughOpenings,
    framesById: frameById,
    blocks,
    moduleLengthMeters: moduleLength,
    moduleHeightMeters: moduleHeight,
    actualHeightMeters: actualHeight,
    core,
    wastePercent,
  });
  const lintelGroutFills = buildLintelGroutFillPlacements(
    params,
    roughOpenings,
    (opening, alongMeters, y) => {
    const segmentId = getLayoutOpeningSegmentId(opening) ?? '';
    const frame = frameById.get(segmentId);
    if (!frame) return null;
    const point = pointOnSegmentFrame(frame, alongMeters, frame.wallThicknessMeters / 2);
    return {
      hostSegmentId: segmentId,
      center: { x: point.x, y, z: point.z },
      rotationY: frame.rotationY,
      depthMeters: frame.wallThicknessMeters,
    };
  },
    resolvedLintelSpans,
    new Map(
      roughOpenings.map((opening) => {
        const segmentId = getLayoutOpeningSegmentId(opening) ?? '';
        return [opening.id, frameById.get(segmentId)?.lengthMeters ?? 0];
      }),
    ),
  );
  const sillGroutFills = buildSillGroutFillPlacements(params, roughOpenings, params.openings, (opening, alongMeters, y) => {
    const segmentId = getLayoutOpeningSegmentId(opening) ?? '';
    const frame = frameById.get(segmentId);
    if (!frame) return null;
    const point = pointOnSegmentFrame(frame, alongMeters, frame.wallThicknessMeters / 2);
    return {
      hostSegmentId: segmentId,
      center: { x: point.x, y, z: point.z },
      rotationY: frame.rotationY,
      depthMeters: frame.wallThicknessMeters,
    };
  });
  const closureGroutFills = buildClosureGroutFillPlacements({
    closures: openingCourseClosures,
    openings: roughOpenings,
    framesById: frameById,
    moduleHeightMeters: moduleHeight,
    actualHeightMeters: actualHeight,
    wallThicknessMeters: params.wallThicknessMeters,
    wastePercent,
  });
  const { placements: groutFillPlacements, overlapDeduplicationCubicMeters } = deduplicateGroutFillPlacements([
    ...jambGroutFills,
    ...lintelGroutFills,
    ...sillGroutFills,
    ...closureGroutFills,
  ]);
  const jambGroutCells = groutFillsToJambGroutCells(groutFillPlacements);
  const derivedOpeningSupports = buildDerivedOpeningSupports({
    openings: roughOpenings,
    resolvedSpans: resolvedLintelSpans,
    supportBlocks: lintelSupportBlocks,
    groutPlacements: groutFillPlacements,
  });

  const pilasters = layout.nodes.map((node) => ({
    id: `pilaster-${node.id}`,
    face: 'north' as const,
    nodeId: node.id,
    x: node.x,
    y: params.heightMeters / 2,
    z: node.z,
    rotationY: 0,
    heightMeters: params.heightMeters,
  }));
  const wallLengthTotal = segmentFrames.reduce((sum, frame) => sum + frame.lengthMeters, 0);
  const bondBeamGroutVolumeCubicMeters = params.bondBeamEnabled
    ? wallLengthTotal * params.wallThicknessMeters * moduleHeight * (params.coreFillFactor ?? 0.5) * (1 + (params.groutWastePercent ?? 0.1))
    : 0;
  const groutSummary = summarizeGroutFillPlacements({
    placements: groutFillPlacements,
    overlapDeduplicationCubicMeters,
    bondBeamGroutVolumeCubicMeters,
    coreGeometry: core,
  });
  const openingGrout = {
    resolvedOpenings: [...roughOpenings],
    actualOpeningAreaSquareMeters: roughOpenings.reduce((sum, opening) => sum + opening.actualAreaSquareMeters, 0),
    roughOpeningAreaSquareMeters: roughOpenings.reduce((sum, opening) => sum + opening.roughOpeningAreaSquareMeters, 0),
    jambGroutCellCount: groutSummary.jambGroutCellCount,
    lintelGroutedCellCount: groutSummary.lintelGroutedCellCount,
    lintelCount: lintels.length,
    lintelLengthMeters: lintels.reduce((sum, lintel) => sum + lintel.lengthMeters, 0),
    jambGroutVolumeCubicMeters: groutSummary.jambGroutVolumeCubicMeters,
    closureGroutVolumeCubicMeters: groutSummary.closureGroutVolumeCubicMeters,
    lintelGroutVolumeCubicMeters: groutSummary.lintelGroutVolumeCubicMeters,
    openingGroutVolumeCubicMeters:
      groutSummary.jambGroutVolumeCubicMeters +
      groutSummary.lintelGroutVolumeCubicMeters +
      groutSummary.sillGroutVolumeCubicMeters +
      groutSummary.closureGroutVolumeCubicMeters,
    sillGroutVolumeCubicMeters: groutSummary.sillGroutVolumeCubicMeters,
    bondBeamGroutVolumeCubicMeters: groutSummary.bondBeamGroutVolumeCubicMeters,
    overlapDeduplicationCubicMeters,
    groutFillPlacements,
    groutFillPlacementIds: groutSummary.groutFillPlacementIds,
    coreGeometry: core,
    totalGroutVolumeCubicMeters: groutSummary.totalGroutVolumeCubicMeters,
    courseClosureCutBlockCount: openingCourseClosures.filter((closure) => closure.closureType === 'cut_block').length,
    lintelBearingSupportBlockCount: lintelSupportBlocks.length,
    lintelBearingHalfBlockCount: lintelSupportBlocks.filter((block) => block.blockType === 'half_block').length,
    lintelBearingCutBlockCount: lintelSupportBlocks.filter((block) => block.blockType === 'cut_block').length,
    coreFillFactor: params.coreFillFactor ?? 0.5,
    groutWastePercent: params.groutWastePercent ?? 0.1,
    warnings: buildOpeningAssemblyWarnings(params, roughOpenings, groutFillPlacements),
  };
  const footprintBounds = deriveExteriorBounds(layout);
  const moduleFitReport = footprintBounds
    ? buildModuleFitReportFromPlacements({
        placements: unitPlacements,
        requestedFootprint: {
          lengthMeters: footprintBounds.exteriorLengthMeters,
          widthMeters: footprintBounds.exteriorWidthMeters,
        },
        resolvedFootprint: {
          lengthMeters: footprintBounds.exteriorLengthMeters,
          widthMeters: footprintBounds.exteriorWidthMeters,
        },
        coursePlans,
        layout,
        dimensionBasis: layout.dimensionBasis,
        hasLayoutError: !clockwisePerimeter,
      })
    : unresolvedModuleFitReport({
        requestedFootprint: {
          lengthMeters: params.lengthMeters,
          widthMeters: params.widthMeters,
        },
      });
  return {
    blocks,
    unitPlacements,
    lintels,
    pilasters,
    roughOpenings,
    jambGroutCells,
    groutFillPlacements,
    openingCourseClosures,
    lintelCourseAssemblies,
    derivedOpeningSupports,
    openingGrout,
    terminalClosures: unitPlacements.flatMap((placement) => placement.terminalClosure ? [placement.terminalClosure] : []),
    counts,
    totalBlocks: Object.values(counts).reduce((sum, value) => sum + value, 0),
    courseCount,
    moduleFits: summarizeWallModuleFits(params),
    moduleFitReport,
    warnings: [...new Set([...warnings, ...openingGrout.warnings])],
    bondBeamLengthMeters: params.bondBeamEnabled ? wallLengthTotal : 0,
    groutedCellCount: Math.ceil(wallLengthTotal / Math.max(0.1, params.groutedCellSpacingMeters ?? 1.2)),
    segmentFrames,
    cornerAssemblies,
    coursePlans,
  };
}

type LayoutResolvedOpening = ResolvedCmuOpening & {
  wallSegmentId?: string;
  worldX?: number;
  worldZ?: number;
  rotationY?: number;
  wallThicknessMeters?: number;
};

export function resolveWallLayoutGeometry(
  layout: DesignWallLayoutParameters,
  wall: Pick<CmuWallSystemParameters, 'wallThicknessMeters'>,
  warnings: string[] = [],
): ResolvedWallLayoutGeometry {
  const orderedPerimeter = buildOrderedPerimeter(layout, warnings);
  const sourcePolyline = orderedPerimeter.map((item) => item.startPoint);
  const wallThicknessMeters = Math.max(0, layout.defaultWallThicknessMeters || wall.wallThicknessMeters || 0);
  const dimensionBasis = layout.dimensionBasis ?? 'outside_face';
  const sourceWinding = signedPolygonArea(sourcePolyline) >= 0 ? 'counterclockwise' : 'clockwise';
  const offsetPolygon = (inwardOffsetMeters: number) =>
    offsetClosedPolyline(sourcePolyline, inwardOffsetMeters, sourceWinding);

  if (sourcePolyline.length < 3) {
    return {
      dimensionBasis,
      sourcePolyline,
      exteriorFacePolygon: [],
      interiorFacePolygon: [],
      centerlinePolyline: [],
      orderedPerimeter,
      winding: sourceWinding,
    };
  }

  const offsetsByBasis: Record<DimensionBasis, { exterior: number; centerline: number; interior: number }> = {
    outside_face: { exterior: 0, centerline: wallThicknessMeters / 2, interior: wallThicknessMeters },
    inside_clear: { exterior: -wallThicknessMeters, centerline: -wallThicknessMeters / 2, interior: 0 },
    wall_centerline: { exterior: -wallThicknessMeters / 2, centerline: 0, interior: wallThicknessMeters / 2 },
  };
  const offsets = offsetsByBasis[dimensionBasis];

  return {
    dimensionBasis,
    sourcePolyline,
    exteriorFacePolygon: offsetPolygon(offsets.exterior),
    interiorFacePolygon: offsetPolygon(offsets.interior),
    centerlinePolyline: offsetPolygon(offsets.centerline),
    orderedPerimeter,
    winding: sourceWinding,
  };
}

export function resolvedBuildingFootprintFromWallLayout(
  resolved: ResolvedWallLayoutGeometry,
): ResolvedBuildingFootprint | null {
  if (resolved.exteriorFacePolygon.length < 3) return null;
  return {
    dimensionBasis: resolved.dimensionBasis,
    exteriorFacePolygon: resolved.exteriorFacePolygon.map((point) => ({ ...point })),
    interiorFacePolygon: resolved.interiorFacePolygon.map((point) => ({ ...point })),
    centerlinePolygon: resolved.centerlinePolyline.map((point) => ({ ...point })),
    orderedPerimeterSegments: resolved.orderedPerimeter.map((segment) => ({
      ...segment,
      tangent: { ...segment.tangent },
      startPoint: { ...segment.startPoint },
      endPoint: { ...segment.endPoint },
    })),
    winding: resolved.winding,
  };
}

export function getExteriorPerimeterSegmentIds(
  layout: DesignWallLayoutParameters,
  wall: Pick<CmuWallSystemParameters, 'wallThicknessMeters'> = {
    wallThicknessMeters: layout.defaultWallThicknessMeters,
  },
): Set<string> {
  const warnings: string[] = [];
  const resolved = resolveWallLayoutGeometry(layout, wall, warnings);
  return new Set(resolved.orderedPerimeter.map((item) => item.segmentId));
}

/** Exterior-face run origin; block centers sit at origin + tangent×station + inward×(depth/2). */
export function resolveSegmentWallLayoutStart(frame: SegmentFrame): { x: number; z: number } {
  const halfThickness = frame.wallThicknessMeters / 2;
  return {
    x: frame.centerlineStart.x - frame.inwardNormal.x * halfThickness,
    z: frame.centerlineStart.z - frame.inwardNormal.z * halfThickness,
  };
}

export function hasResolvableExteriorShell(
  layout: DesignWallLayoutParameters,
  wall: Pick<CmuWallSystemParameters, 'wallThicknessMeters'> = {
    wallThicknessMeters: layout.defaultWallThicknessMeters,
  },
): boolean {
  const warnings: string[] = [];
  const resolved = resolveWallLayoutGeometry(layout, wall, warnings);
  return resolved.exteriorFacePolygon.length >= 3;
}

export function getStructuralColumnNodeIds(
  layout: DesignWallLayoutParameters,
  exteriorSegmentIds: Set<string>,
): string[] {
  const warnings: string[] = [];
  const resolved = resolveWallLayoutGeometry(
    layout,
    { wallThicknessMeters: layout.defaultWallThicknessMeters },
    warnings,
  );
  const perimeterNodeIds = new Set(resolved.orderedPerimeter.map((item) => item.startNodeId));
  const nodeById = new Map(layout.nodes.map((node) => [node.id, node]));
  const exteriorSegmentsByNode = new Map<string, DesignWallLayoutParameters['segments']>();
  for (const segment of layout.segments) {
    if (!exteriorSegmentIds.has(segment.id)) continue;
    for (const nodeId of [segment.startNodeId, segment.endNodeId]) {
      exteriorSegmentsByNode.set(nodeId, [...(exteriorSegmentsByNode.get(nodeId) ?? []), segment]);
    }
  }

  return [...perimeterNodeIds].filter((nodeId) => {
    const exteriorSegments = exteriorSegmentsByNode.get(nodeId) ?? [];
    if (exteriorSegments.length < 2) return true;

    const outwardDirections = exteriorSegments
      .map((segment) => {
        const start = nodeById.get(segment.startNodeId);
        const end = nodeById.get(segment.endNodeId);
        if (!start || !end) return null;
        const dx = end.x - start.x;
        const dz = end.z - start.z;
        const length = Math.hypot(dx, dz);
        if (length <= 0) return null;
        return segment.startNodeId === nodeId
          ? { x: dx / length, z: dz / length }
          : { x: -dx / length, z: -dz / length };
      })
      .filter((direction): direction is { x: number; z: number } => direction != null);

    if (outwardDirections.length === 2) {
      const dot =
        outwardDirections[0]!.x * outwardDirections[1]!.x +
        outwardDirections[0]!.z * outwardDirections[1]!.z;
      // Straight-through T-junction on a wall run: skip column; keep true corners.
      if (dot < -0.95) return false;
    }
    return true;
  });
}

export function getSegmentFramesForWallLayout(
  layout: DesignWallLayoutParameters,
  wall: CmuWallSystemParameters,
  warnings: string[] = [],
): SegmentFrame[] {
  return buildSegmentFrames(layout, wall, warnings);
}

function buildSegmentFrames(
  layout: DesignWallLayoutParameters,
  wall: CmuWallSystemParameters,
  warnings: string[],
  resolvedGeometry = resolveWallLayoutGeometry(layout, wall, warnings),
): SegmentFrame[] {
  const perimeter = resolvedGeometry.orderedPerimeter;
  const exteriorByNodeId = new Map(perimeter.map((item, index) => [item.startNodeId, resolvedGeometry.exteriorFacePolygon[index]]));
  const interiorByNodeId = new Map(perimeter.map((item, index) => [item.startNodeId, resolvedGeometry.interiorFacePolygon[index]]));
  const centerlineByNodeId = new Map(perimeter.map((item, index) => [item.startNodeId, resolvedGeometry.centerlinePolyline[index]]));
  const orderedIds = new Set(perimeter.map((item) => item.segmentId));
  const frameSources = [
    ...perimeter
      .map((item) => {
        const segment = layout.segments.find((candidate) => candidate.id === item.segmentId);
        return segment ? { segment, startNodeId: item.startNodeId, endNodeId: item.endNodeId } : null;
      })
      .filter((source): source is { segment: DesignWallLayoutParameters['segments'][number]; startNodeId: string; endNodeId: string } => source != null),
    ...layout.segments
      .filter((segment) => !orderedIds.has(segment.id))
      .map((segment) => ({ segment, startNodeId: segment.startNodeId, endNodeId: segment.endNodeId })),
  ];

  return frameSources.map(({ segment, startNodeId, endNodeId }) => {
    const fallbackStart = layout.nodes.find((node) => node.id === startNodeId);
    const fallbackEnd = layout.nodes.find((node) => node.id === endNodeId);
    const exteriorStart = exteriorByNodeId.get(startNodeId) ?? fallbackStart;
    const exteriorEnd = exteriorByNodeId.get(endNodeId) ?? fallbackEnd;
    const interiorStart = interiorByNodeId.get(startNodeId) ?? exteriorStart;
    const interiorEnd = interiorByNodeId.get(endNodeId) ?? exteriorEnd;
    const centerlineStart = centerlineByNodeId.get(startNodeId) ?? exteriorStart;
    const centerlineEnd = centerlineByNodeId.get(endNodeId) ?? exteriorEnd;
    if (!exteriorStart || !exteriorEnd || !interiorStart || !interiorEnd || !centerlineStart || !centerlineEnd) return null;
    const isPerimeterSegment = orderedIds.has(segment.id);
    const runStart = isPerimeterSegment ? exteriorStart : centerlineStart;
    const runEnd = isPerimeterSegment ? exteriorEnd : centerlineEnd;
    const dx = runEnd.x - runStart.x;
    const dz = runEnd.z - runStart.z;
    const lengthMeters = Math.hypot(dx, dz);
    if (lengthMeters <= 0) return null;
    const tangent = { x: dx / lengthMeters, z: dz / lengthMeters };
    const inwardSign = resolvedGeometry.winding === 'counterclockwise' ? 1 : -1;
    const inwardNormal = resolvedGeometry.exteriorFacePolygon.length >= 3
      ? { x: -tangent.z * inwardSign, z: tangent.x * inwardSign }
      : { x: 0, z: 0 };
    return {
      segmentId: segment.id,
      start: { x: runStart.x, z: runStart.z },
      end: { x: runEnd.x, z: runEnd.z },
      exteriorStart: { x: exteriorStart.x, z: exteriorStart.z },
      exteriorEnd: { x: exteriorEnd.x, z: exteriorEnd.z },
      interiorStart: { x: interiorStart.x, z: interiorStart.z },
      interiorEnd: { x: interiorEnd.x, z: interiorEnd.z },
      centerlineStart: { x: centerlineStart.x, z: centerlineStart.z },
      centerlineEnd: { x: centerlineEnd.x, z: centerlineEnd.z },
      lengthMeters,
      tangent,
      inwardNormal,
      outwardNormal: { x: -inwardNormal.x, z: -inwardNormal.z },
      rotationY: -Math.atan2(dz, dx),
      wallHeightMeters: segment.wallHeightMeters || layout.defaultWallHeightMeters || wall.heightMeters,
      wallThicknessMeters: segment.wallThicknessMeters || layout.defaultWallThicknessMeters || wall.wallThicknessMeters,
    } satisfies SegmentFrame;
  }).filter((frame): frame is SegmentFrame => frame != null);
}

export function buildClockwisePerimeter(
  resolvedGeometry: ResolvedWallLayoutGeometry,
): ClockwisePerimeter | null {
  if (resolvedGeometry.orderedPerimeter.length < 3 || resolvedGeometry.exteriorFacePolygon.length < 3) return null;
  const ordered = resolvedGeometry.orderedPerimeter.map((segment, index) => ({
    segment,
    startPoint: resolvedGeometry.exteriorFacePolygon[index],
    endPoint: resolvedGeometry.exteriorFacePolygon[(index + 1) % resolvedGeometry.exteriorFacePolygon.length],
  }));
  const clockwiseSources = resolvedGeometry.winding === 'clockwise'
    ? ordered
    : [...ordered].reverse().map((item) => ({
        segment: {
          ...item.segment,
          startNodeId: item.segment.endNodeId,
          endNodeId: item.segment.startNodeId,
        },
        startPoint: item.endPoint,
        endPoint: item.startPoint,
      }));
  const startIndex = clockwiseSources.reduce((bestIndex, item, index) => {
    const best = clockwiseSources[bestIndex];
    if (item.startPoint.z < best.startPoint.z - 1e-9) return index;
    if (Math.abs(item.startPoint.z - best.startPoint.z) <= 1e-9 && item.startPoint.x < best.startPoint.x) return index;
    return bestIndex;
  }, 0);
  const rotated = [
    ...clockwiseSources.slice(startIndex),
    ...clockwiseSources.slice(0, startIndex),
  ];
  const segments = rotated.map((item, index) => {
    const dx = item.endPoint.x - item.startPoint.x;
    const dz = item.endPoint.z - item.startPoint.z;
    const lengthMeters = Math.hypot(dx, dz);
    const tangent = lengthMeters > 0 ? { x: dx / lengthMeters, z: dz / lengthMeters } : { x: 1, z: 0 };
    const inwardNormal = { x: tangent.z, z: -tangent.x };
    return {
      segmentId: item.segment.segmentId,
      startNodeId: item.segment.startNodeId,
      endNodeId: item.segment.endNodeId,
      tangent,
      outwardNormal: { x: -inwardNormal.x, z: -inwardNormal.z },
      inwardNormal,
      lengthMeters,
      incomingCornerId: `corner-${item.segment.startNodeId}`,
      outgoingCornerId: `corner-${item.segment.endNodeId}`,
      exteriorStart: { x: item.startPoint.x, z: item.startPoint.z },
      exteriorEnd: { x: item.endPoint.x, z: item.endPoint.z },
      rotationY: -Math.atan2(dz, dx),
      index,
    };
  });
  return {
    winding: 'clockwise',
    startNodeId: segments[0]?.startNodeId ?? '',
    segments,
  };
}

function buildOrderedPerimeter(
  layout: DesignWallLayoutParameters,
  warnings: string[],
): OrderedPerimeterSegment[] {
  if (layout.segments.length < 3) {
    warnings.push('Wall layout is not a closed perimeter; corner assemblies use open-wall fallback.');
    return [];
  }

  const walkExteriorLoop = (first: DesignWallSegment): OrderedPerimeterSegment[] | null => {
    const ordered: OrderedPerimeterSegment[] = [];
    const visited = new Set<string>();
    const firstStartNode = layout.nodes.find((node) => node.id === first.startNodeId);
    const firstEndNode = layout.nodes.find((node) => node.id === first.endNodeId);
    if (!firstStartNode || !firstEndNode) return null;
    const firstLength = Math.hypot(firstEndNode.x - firstStartNode.x, firstEndNode.z - firstStartNode.z);
    if (firstLength <= 0) return null;
    ordered.push({
      segmentId: first.id,
      startNodeId: first.startNodeId,
      endNodeId: first.endNodeId,
      index: 0,
      tangent: { x: (firstEndNode.x - firstStartNode.x) / firstLength, z: (firstEndNode.z - firstStartNode.z) / firstLength },
      startPoint: { x: firstStartNode.x, z: firstStartNode.z },
      endPoint: { x: firstEndNode.x, z: firstEndNode.z },
    });
    visited.add(first.id);
    let currentNodeId = first.endNodeId;
    let incomingTangent = ordered[0]!.tangent;
    for (let index = 1; index <= layout.segments.length; index += 1) {
      if (currentNodeId === first.startNodeId && ordered.length >= 3) break;

      const touching = layout.segments.filter(
        (segment) => !visited.has(segment.id) && (segment.startNodeId === currentNodeId || segment.endNodeId === currentNodeId),
      );
      if (touching.length === 0) {
        if (currentNodeId === first.startNodeId && ordered.length >= 3) break;
        return null;
      }

      let segment = touching[0]!;
      if (touching.length > 1) {
        let bestDot = -Infinity;
        for (const candidate of touching) {
          const candidateNextNodeId =
            candidate.startNodeId === currentNodeId ? candidate.endNodeId : candidate.startNodeId;
          const startNode = layout.nodes.find((node) => node.id === currentNodeId);
          const nextNode = layout.nodes.find((node) => node.id === candidateNextNodeId);
          if (!startNode || !nextNode) continue;
          const candidateLength = Math.hypot(nextNode.x - startNode.x, nextNode.z - startNode.z);
          if (candidateLength <= 0) continue;
          const outTangent = {
            x: (nextNode.x - startNode.x) / candidateLength,
            z: (nextNode.z - startNode.z) / candidateLength,
          };
          const dot = incomingTangent.x * outTangent.x + incomingTangent.z * outTangent.z;
          if (dot > bestDot) {
            bestDot = dot;
            segment = candidate;
          }
        }
      }

      const startNode = layout.nodes.find((node) => node.id === currentNodeId);
      const nextNodeId = segment.startNodeId === currentNodeId ? segment.endNodeId : segment.startNodeId;
      const endNode = layout.nodes.find((node) => node.id === nextNodeId);
      if (!startNode || !endNode) return null;
      const length = Math.hypot(endNode.x - startNode.x, endNode.z - startNode.z);
      if (length <= 0) return null;
      const tangent = { x: (endNode.x - startNode.x) / length, z: (endNode.z - startNode.z) / length };
      ordered.push({
        segmentId: segment.id,
        startNodeId: currentNodeId,
        endNodeId: nextNodeId,
        index,
        tangent,
        startPoint: { x: startNode.x, z: startNode.z },
        endPoint: { x: endNode.x, z: endNode.z },
      });
      visited.add(segment.id);
      incomingTangent = tangent;
      currentNodeId = nextNodeId;
    }
    if (currentNodeId !== first.startNodeId || ordered.length < 3) return null;
    return ordered;
  };

  let bestLoop: OrderedPerimeterSegment[] | null = null;
  let bestArea = 0;
  for (const candidateStart of layout.segments) {
    const loop = walkExteriorLoop(candidateStart);
    if (!loop) continue;
    const area = Math.abs(signedPolygonArea(loop.map((item) => item.startPoint)));
    if (area > bestArea) {
      bestArea = area;
      bestLoop = loop;
    }
  }

  if (!bestLoop) {
    warnings.push('Wall layout perimeter could not be closed; using safe flush corner fallback.');
    return [];
  }
  return bestLoop;
}

function offsetClosedPolyline(
  points: readonly DesignGeometryPoint[],
  inwardOffsetMeters: number,
  winding: ResolvedWallLayoutGeometry['winding'],
): DesignGeometryPoint[] {
  if (points.length < 3 || Math.abs(inwardOffsetMeters) <= 1e-9) {
    return points.map((point) => ({ x: point.x, z: point.z }));
  }
  const inwardSign = winding === 'counterclockwise' ? 1 : -1;
  return points.map((point, index) => {
    const previous = points[(index + points.length - 1) % points.length];
    const next = points[(index + 1) % points.length];
    const previousOffset = offsetSegmentLine(previous, point, inwardOffsetMeters, inwardSign);
    const nextOffset = offsetSegmentLine(point, next, inwardOffsetMeters, inwardSign);
    return intersectInfiniteLines(previousOffset.start, previousOffset.end, nextOffset.start, nextOffset.end) ?? nextOffset.start;
  });
}

function offsetSegmentLine(
  start: DesignGeometryPoint,
  end: DesignGeometryPoint,
  inwardOffsetMeters: number,
  inwardSign: 1 | -1,
): { start: DesignGeometryPoint; end: DesignGeometryPoint } {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const length = Math.hypot(dx, dz);
  if (length <= 0) return { start, end };
  const inwardNormal = { x: (-dz / length) * inwardSign, z: (dx / length) * inwardSign };
  return {
    start: { x: start.x + inwardNormal.x * inwardOffsetMeters, z: start.z + inwardNormal.z * inwardOffsetMeters },
    end: { x: end.x + inwardNormal.x * inwardOffsetMeters, z: end.z + inwardNormal.z * inwardOffsetMeters },
  };
}

function intersectInfiniteLines(
  aStart: DesignGeometryPoint,
  aEnd: DesignGeometryPoint,
  bStart: DesignGeometryPoint,
  bEnd: DesignGeometryPoint,
): DesignGeometryPoint | null {
  const ax = aEnd.x - aStart.x;
  const az = aEnd.z - aStart.z;
  const bx = bEnd.x - bStart.x;
  const bz = bEnd.z - bStart.z;
  const denominator = ax * bz - az * bx;
  if (Math.abs(denominator) <= 1e-9) return null;
  const cx = bStart.x - aStart.x;
  const cz = bStart.z - aStart.z;
  const t = (cx * bz - cz * bx) / denominator;
  return { x: aStart.x + ax * t, z: aStart.z + az * t };
}

function generatedCornerUnitType(
  unitType: LayoutCornerAssembly['generatedUnitType'],
): CmuCornerCourseLayout['generatedUnitType'] {
  switch (unitType) {
    case 'full':
      return 'full_block';
    case 'half':
      return 'half_block';
    case 'end':
      return 'end_block';
    case 'cut':
      return 'cut_block';
    case 'corner':
    default:
      return 'corner_block';
  }
}

function resolveLayoutOpeningGeometry(params: {
  opening: WallOpeningParameters;
  segmentFrame?: SegmentFrame;
  wallSettings: CmuWallSystemParameters;
}): LayoutResolvedOpening | null {
  const frame = params.segmentFrame;
  if (!frame) return null;
  const allowance = Math.max(0, params.opening.roughOpeningAllowanceMeters ?? 0.05);
  const actualWidthMeters = Math.max(0, params.opening.widthMeters);
  const actualHeightMeters = Math.max(0, params.opening.heightMeters);
  let roughOpeningWidthMeters = Math.max(
    actualWidthMeters,
    params.opening.roughOpeningWidthMeters ?? actualWidthMeters + allowance * 2,
  );
  let roughOpeningHeightMeters = Math.max(
    actualHeightMeters,
    params.opening.roughOpeningHeightMeters ?? actualHeightMeters + allowance * 2,
  );
  const moduleConfig = resolveCmuModuleConfig(params.wallSettings);
  const moduleLength = moduleConfig.moduleLengthMeters;
  const moduleHeight = moduleConfig.moduleHeightMeters;
  const rawCenterStation = params.opening.placementUsesCenterStation
    ? params.opening.positionAlongSegment ?? params.opening.offsetMeters ?? 0
    : (params.opening.positionAlongSegment ?? params.opening.offsetMeters ?? 0) + actualWidthMeters / 2;
  let actualStartAlongMeters = Math.max(
    0,
    Math.min(Math.max(0, frame.lengthMeters - actualWidthMeters), rawCenterStation - actualWidthMeters / 2),
  );
  let actualEndAlongMeters = roundMeters(actualStartAlongMeters + actualWidthMeters);
  let actualCenterStation = actualStartAlongMeters + actualWidthMeters / 2;
  let roughStartAlongMeters = Math.max(
    0,
    Math.min(Math.max(0, frame.lengthMeters - roughOpeningWidthMeters), actualCenterStation - roughOpeningWidthMeters / 2),
  );
  let roughEndAlongMeters = roughStartAlongMeters + roughOpeningWidthMeters;
  if (params.wallSettings.snapToModule && moduleLength > 0) {
    roughStartAlongMeters = Math.max(0, Math.floor((actualCenterStation - roughOpeningWidthMeters / 2) / moduleLength) * moduleLength);
    roughEndAlongMeters = Math.min(frame.lengthMeters, Math.ceil((actualCenterStation + roughOpeningWidthMeters / 2) / moduleLength) * moduleLength);
    if (roughEndAlongMeters - roughStartAlongMeters < actualWidthMeters) {
      roughStartAlongMeters = Math.max(0, actualCenterStation - actualWidthMeters / 2);
      roughEndAlongMeters = Math.min(frame.lengthMeters, actualCenterStation + actualWidthMeters / 2);
    }
    roughOpeningWidthMeters = Math.max(actualWidthMeters, roughEndAlongMeters - roughStartAlongMeters);
  }
  const roughCenterStation = roughStartAlongMeters + roughOpeningWidthMeters / 2;
  if (params.wallSettings.snapToModule && moduleHeight > 0) {
    roughOpeningHeightMeters = Math.max(actualHeightMeters, Math.ceil(roughOpeningHeightMeters / moduleHeight) * moduleHeight);
  }
  const roughBottomMeters = params.opening.type === 'door'
    ? 0
    : Math.max(0, (params.opening.sillHeightMeters ?? 0) - (roughOpeningHeightMeters - actualHeightMeters) / 2);
  const lintelType = params.opening.lintelType ?? params.wallSettings.lintelType ?? 'bond_beam';
  const lintelBearingMeters = Math.max(moduleLength / 2, params.opening.lintelBearingMeters ?? params.wallSettings.lintelBearingMeters ?? 0.2);
  const lintelCourseCount = Math.max(1, params.opening.lintelCourseCount ?? params.wallSettings.lintelCourseCount ?? 1);
  const centerWorld = {
    x: frame.centerlineStart.x + frame.tangent.x * actualCenterStation,
    z: frame.centerlineStart.z + frame.tangent.z * actualCenterStation,
  };

  return {
    id: params.opening.id,
    type: params.opening.type,
    wallFace: params.opening.wallFace,
    wallSegmentId: frame.segmentId,
    actualWidthMeters,
    actualHeightMeters,
    actualAreaSquareMeters: actualWidthMeters * actualHeightMeters,
    roughOpeningWidthMeters,
    roughOpeningHeightMeters,
    roughOpeningAreaSquareMeters: roughOpeningWidthMeters * roughOpeningHeightMeters,
    roughStartAlongMeters: roundMeters(roughStartAlongMeters),
    roughEndAlongMeters: roundMeters(roughEndAlongMeters),
    roughBottomMeters: roundMeters(roughBottomMeters),
    roughTopMeters: roundMeters(roughBottomMeters + roughOpeningHeightMeters),
    actualStartAlongMeters: roundMeters(actualStartAlongMeters),
    actualEndAlongMeters,
    actualBottomMeters: params.opening.type === 'door' ? 0 : params.opening.sillHeightMeters ?? 0,
    actualTopMeters: (params.opening.type === 'door' ? 0 : params.opening.sillHeightMeters ?? 0) + actualHeightMeters,
    lintelType,
    lintelBearingMeters,
    lintelCourseCount,
    lintelLengthMeters: lintelType === 'none'
      ? 0
      : Math.min(frame.lengthMeters, actualWidthMeters + lintelBearingMeters * 2),
    lintelHeightMeters: moduleConfig.moduleHeightMeters * lintelCourseCount,
    jambGroutEnabled: params.opening.jambGroutEnabled ?? true,
    jambRebarEnabled: params.opening.jambRebarEnabled ?? false,
    groutCellsEachSide: Math.max(0, params.opening.groutCellsEachSide ?? params.wallSettings.jambCellsEachSide ?? 1),
    jambGroutCellCount: (params.opening.jambGroutEnabled ?? true)
      ? Math.max(0, params.opening.groutCellsEachSide ?? params.wallSettings.jambCellsEachSide ?? 1) * 2
      : 0,
    groutCellsAboveOpening: Math.max(0, params.opening.groutCellsAboveOpening ?? 0),
    groutCellsBelowWindow: params.opening.type === 'window' ? Math.max(0, params.opening.groutCellsBelowWindow ?? 0) : 0,
    openingFrameMaterial: params.opening.openingFrameMaterial ?? 'none',
    worldX: centerWorld.x,
    worldZ: centerWorld.z,
    rotationY: frame.rotationY,
  };
}

/** Layout-graph world positions for wall openings (required for 3D frame rendering). */
export function resolveLayoutRoughOpeningsFromWall(params: {
  wall: CmuWallSystemParameters;
  segmentFrames: readonly SegmentFrame[];
}): ResolvedCmuOpening[] {
  const frameById = new Map(params.segmentFrames.map((frame) => [frame.segmentId, frame]));
  return params.wall.openings
    .map((opening) =>
      resolveLayoutOpeningGeometry({
        opening,
        segmentFrame: opening.wallSegmentId ? frameById.get(opening.wallSegmentId) : undefined,
        wallSettings: params.wall,
      }),
    )
    .filter((opening): opening is ResolvedCmuOpening => opening != null);
}

export function getLayoutOpeningSegmentId(opening: ResolvedCmuOpening): string | undefined {
  return (opening as LayoutResolvedOpening).wallSegmentId;
}

function pointOnSegmentFrame(frame: SegmentFrame, alongMeters: number, inwardOffsetMeters: number): DesignGeometryPoint {
  const halfThickness = frame.wallThicknessMeters / 2;
  if (Math.abs(inwardOffsetMeters - halfThickness) <= 0.001) {
    return {
      x: frame.centerlineStart.x + frame.tangent.x * alongMeters,
      z: frame.centerlineStart.z + frame.tangent.z * alongMeters,
    };
  }
  const layoutStart = resolveSegmentWallLayoutStart(frame);
  return {
    x: layoutStart.x + frame.tangent.x * alongMeters + frame.inwardNormal.x * inwardOffsetMeters,
    z: layoutStart.z + frame.tangent.z * alongMeters + frame.inwardNormal.z * inwardOffsetMeters,
  };
}

type SegmentStationSpan = {
  startAlongMeters: number;
  endAlongMeters: number;
};

function resolveSegmentStationAlignment(
  frame: SegmentFrame,
  perimeterSegment: ClockwisePerimeter['segments'][number],
): {
  tangentsAligned: boolean;
  masonrySpanToFrame: (span: SegmentStationSpan) => SegmentStationSpan;
} {
  const tangentsAligned =
    frame.tangent.x * perimeterSegment.tangent.x + frame.tangent.z * perimeterSegment.tangent.z >= 0;
  const lengthMeters = frame.lengthMeters;
  return {
    tangentsAligned,
    masonrySpanToFrame: ({ startAlongMeters, endAlongMeters }) =>
      tangentsAligned
        ? { startAlongMeters, endAlongMeters }
        : {
            startAlongMeters: lengthMeters - endAlongMeters,
            endAlongMeters: lengthMeters - startAlongMeters,
          },
  };
}

function blockTypeForOpeningSegment(
  segment: OpeningUnitSplitSegment,
  moduleLengthMeters: number,
  defaultBlockType: CmuBlockType,
): CmuBlockType {
  if (segment.source !== 'opening_jamb_closure') {
    return defaultBlockType;
  }
  const classification = classifyClosureGapLength(segment.lengthMeters, moduleLengthMeters, false);
  return closureClassificationToBlockType(classification) ?? 'cut';
}

function actualLengthForOpeningSegment(
  segment: OpeningUnitSplitSegment,
  unitActualLengthMeters: number,
): number {
  return segment.source === 'opening_jamb_closure' ? segment.lengthMeters : unitActualLengthMeters;
}

export function logOpeningCoursePlacementsTableForDev(
  unitPlacements: readonly CmuUnitPlacement[],
  opening: ResolvedCmuOpening,
  moduleHeightMeters: number,
  segmentId?: string,
): void {
  if (!import.meta.env.DEV) return;
  const hostSegmentId = segmentId ?? opening.wallSegmentId ?? opening.wallFace ?? '';
  const lintelCourseIndex = resolveLintelCourseIndex(opening.roughTopMeters, moduleHeightMeters);
  const rows = unitPlacements
    .filter((placement) => {
      if (placement.segmentId !== hostSegmentId) return false;
      if (placement.courseIndex >= lintelCourseIndex) return false;
      const courseBottom = placement.courseIndex * moduleHeightMeters;
      const courseTop = courseBottom + placement.heightMeters;
      return courseBottom < opening.roughTopMeters && courseTop > opening.roughBottomMeters;
    })
    .map((placement) => ({
      course: placement.courseIndex,
      kind: placement.kind,
      source: placement.source,
      start: placement.startStationMeters ?? placement.stationMeters,
      end: placement.endStationMeters,
      length: (placement.endStationMeters ?? 0) - (placement.startStationMeters ?? placement.stationMeters ?? 0),
    }));
  console.table(rows);
}

function blockOverlapsOpeningVoid(params: {
  block: CmuBlockInstance;
  opening: ResolvedCmuOpening;
  frame: SegmentFrame;
  moduleHeight: number;
  moduleLength: number;
  actualHeight: number;
  resolvedLintelSpans: ReadonlyMap<string, ResolvedLintelSpan>;
}): boolean {
  if (params.block.source === 'lintel_closure') return false;
  if (params.block.source === 'opening_jamb_closure') return false;
  const courseIndex = params.block.courseIndex ?? params.block.course ?? 0;
  const courseBottomMeters = courseIndex * params.moduleHeight;
  const courseTopMeters = courseBottomMeters + (params.block.heightMeters ?? params.actualHeight);
  const startAlongMeters = params.block.startAlongMeters ?? params.block.stationMeters ?? 0;
  const endAlongMeters =
    params.block.endAlongMeters ?? startAlongMeters + (params.block.actualLengthMeters ?? params.block.lengthMeters);
  const disposition = resolveOpeningUnitDisposition({
    opening: params.opening,
    startAlongMeters,
    endAlongMeters,
    courseIndex,
    courseBottomMeters,
    courseTopMeters,
    moduleHeightMeters: params.moduleHeight,
    moduleLengthMeters: params.moduleLength,
    wallLengthMeters: params.frame.lengthMeters,
    resolvedLintelSpans: params.resolvedLintelSpans,
  });
  return disposition.action === 'skip';
}

function purgeBlocksInsideOpeningVoids(params: {
  blocks: CmuBlockInstance[];
  openings: readonly ResolvedCmuOpening[];
  frameById: ReadonlyMap<string, SegmentFrame>;
  moduleHeight: number;
  moduleLength: number;
  actualHeight: number;
  resolvedLintelSpans: ReadonlyMap<string, ResolvedLintelSpan>;
}): CmuBlockInstance[] {
  return params.blocks.filter((block) => {
    const segmentId = block.segmentId;
    if (!segmentId) return true;
    const frame = params.frameById.get(segmentId);
    if (!frame) return true;
    const segmentOpenings = params.openings.filter((opening) => getLayoutOpeningSegmentId(opening) === segmentId);
    return !segmentOpenings.some((opening) =>
      blockOverlapsOpeningVoid({
        block,
        opening,
        frame,
        moduleHeight: params.moduleHeight,
        moduleLength: params.moduleLength,
        actualHeight: params.actualHeight,
        resolvedLintelSpans: params.resolvedLintelSpans,
      }),
    );
  });
}

function calculateLayoutOpeningGroutSummary(
  params: CmuWallSystemParameters,
  openings: readonly ResolvedCmuOpening[],
  moduleHeight: number,
  wallLengthTotal: number,
): CmuOpeningGroutSummary {
  const coreFillFactor = Math.max(0, Math.min(1, params.coreFillFactor ?? 0.5));
  const groutWastePercent = Math.max(0, params.groutWastePercent ?? 0.1);
  const wasteMultiplier = 1 + groutWastePercent;
  const wallThickness = Math.max(0, params.wallThicknessMeters);
  const moduleConfig = resolveCmuModuleConfig(params);
  const cellCoreArea = moduleConfig.moduleLengthMeters * wallThickness * coreFillFactor;
  const jambGroutVolumeCubicMeters = openings.reduce((sum, opening) => {
    if (!opening.jambGroutEnabled) return sum;
    const groutedHeight = Math.min(params.heightMeters, opening.roughOpeningHeightMeters + opening.lintelHeightMeters);
    return sum + opening.jambGroutCellCount * cellCoreArea * groutedHeight * wasteMultiplier;
  }, 0);
  const lintelGroutVolumeCubicMeters = openings.reduce((sum, opening) => {
    if (opening.lintelType === 'none' || !params.lintelBondBeamEnabled) return sum;
    return sum + opening.lintelLengthMeters * wallThickness * opening.lintelHeightMeters * coreFillFactor * wasteMultiplier;
  }, 0);
  const bondBeamGroutVolumeCubicMeters = params.bondBeamEnabled
    ? wallLengthTotal * wallThickness * moduleHeight * coreFillFactor * wasteMultiplier
    : 0;
  return {
    resolvedOpenings: [...openings],
    actualOpeningAreaSquareMeters: openings.reduce((sum, opening) => sum + opening.actualAreaSquareMeters, 0),
    roughOpeningAreaSquareMeters: openings.reduce((sum, opening) => sum + opening.roughOpeningAreaSquareMeters, 0),
    jambGroutCellCount: openings.reduce((sum, opening) => sum + opening.jambGroutCellCount, 0),
    lintelCount: openings.filter((opening) => opening.lintelType !== 'none').length,
    lintelLengthMeters: openings.reduce((sum, opening) => sum + opening.lintelLengthMeters, 0),
    jambGroutVolumeCubicMeters,
    closureGroutVolumeCubicMeters: 0,
    lintelGroutVolumeCubicMeters,
    bondBeamGroutVolumeCubicMeters,
    totalGroutVolumeCubicMeters: jambGroutVolumeCubicMeters + lintelGroutVolumeCubicMeters + bondBeamGroutVolumeCubicMeters,
    courseClosureCutBlockCount: 0,
    coreFillFactor,
    groutWastePercent,
    warnings: ['Opening grout/reinforcement quantities are generated from wall-layout segment geometry.'],
  };
}

function wallLengthForLegacyOpening(
  opening: ResolvedCmuOpening,
  params: CmuWallSystemParameters,
): number {
  return opening.wallFace === 'north' || opening.wallFace === 'south'
    ? params.lengthMeters
    : params.widthMeters;
}

function buildResolvedLintelSpanMap(
  openings: readonly ResolvedCmuOpening[],
  moduleLengthMeters: number,
  wallLengthForOpening: (opening: ResolvedCmuOpening) => number,
): Map<string, ResolvedLintelSpan> {
  return new Map(
    openings.map((opening) => [
      opening.id,
      resolveLintelModuleSpan(opening, moduleLengthMeters, wallLengthForOpening(opening)),
    ]),
  );
}

function placedCourseBlocksBySegmentCourse(
  blocks: readonly CmuBlockInstance[],
): Map<string, CourseUnitSpan[]> {
  const grouped = new Map<string, CourseUnitSpan[]>();
  blocks.forEach((block) => {
    if (block.source === 'lintel_closure') return;
    const segmentId = block.segmentId ?? block.face;
    const courseIndex = block.courseIndex ?? block.course ?? 0;
    const startAlongMeters = block.startAlongMeters ?? block.stationMeters ?? 0;
    const endAlongMeters =
      block.endAlongMeters ?? startAlongMeters + (block.actualLengthMeters ?? block.lengthMeters);
    const key = `${segmentId}-${courseIndex}`;
    const existing = grouped.get(key) ?? [];
    existing.push({ startAlongMeters, endAlongMeters });
    grouped.set(key, existing);
  });
  grouped.forEach((spans, key) => {
    grouped.set(
      key,
      spans.sort((left, right) => left.startAlongMeters - right.startAlongMeters),
    );
  });
  return grouped;
}

function appendLintelCourseClosuresToLayout(
  assemblies: readonly LintelCourseAssembly[],
  blocks: CmuBlockInstance[],
  counts: Record<CmuBlockType, number>,
): void {
  assemblies.forEach((assembly) => {
    [...assembly.leftPlacements, ...assembly.rightPlacements].forEach((placement) => {
      appendLintelCourseClosurePlacement(placement, blocks, counts);
    });
  });
}

function buildLegacySegmentFramesById(params: CmuWallSystemParameters): Map<string, SegmentFrameLike> {
  const wallThickness = Math.max(0, params.wallThicknessMeters);
  const halfLength = params.lengthMeters / 2;
  const halfWidth = params.widthMeters / 2;
  const inset = wallThickness / 2;
  return new Map([
    [
      'north',
      {
        segmentId: 'north',
        start: { x: -halfLength, z: -halfWidth + inset },
        tangent: { x: 1, z: 0 },
        inwardNormal: { x: 0, z: 1 },
        rotationY: 0,
        lengthMeters: params.lengthMeters,
        wallThicknessMeters: wallThickness,
      },
    ],
    [
      'south',
      {
        segmentId: 'south',
        start: { x: halfLength, z: halfWidth - inset },
        tangent: { x: -1, z: 0 },
        inwardNormal: { x: 0, z: -1 },
        rotationY: Math.PI,
        lengthMeters: params.lengthMeters,
        wallThicknessMeters: wallThickness,
      },
    ],
    [
      'east',
      {
        segmentId: 'east',
        start: { x: halfLength - inset, z: halfWidth },
        tangent: { x: 0, z: -1 },
        inwardNormal: { x: -1, z: 0 },
        rotationY: Math.PI / 2,
        lengthMeters: params.widthMeters,
        wallThicknessMeters: wallThickness,
      },
    ],
    [
      'west',
      {
        segmentId: 'west',
        start: { x: -halfLength + inset, z: -halfWidth },
        tangent: { x: 0, z: 1 },
        inwardNormal: { x: 1, z: 0 },
        rotationY: -Math.PI / 2,
        lengthMeters: params.widthMeters,
        wallThicknessMeters: wallThickness,
      },
    ],
  ]);
}

function appendLintelCourseClosurePlacement(
  placement: LintelCourseClosurePlacement,
  blocks: CmuBlockInstance[],
  counts: Record<CmuBlockType, number>,
): void {
  const blockType = lintelCourseClosureToBlockType(placement.kind);
  const wallFaces = new Set<CmuBlockInstanceWallFace>(['north', 'east', 'south', 'west']);
  const legacyFace = wallFaces.has(placement.hostSegmentId as CmuBlockInstanceWallFace)
    ? (placement.hostSegmentId as CmuBlockInstanceWallFace)
    : 'north';
  blocks.push({
    id: placement.id,
    face: legacyFace,
    segmentId: wallFaces.has(placement.hostSegmentId as CmuBlockInstanceWallFace) ? undefined : placement.hostSegmentId,
    course: placement.courseIndex,
    courseIndex: placement.courseIndex,
    blockType,
    unitType: blockType === 'full' ? 'full' : blockType === 'half' ? 'half' : 'cut',
    x: placement.center.x,
    y: placement.center.y,
    z: placement.center.z,
    rotationY: placement.rotationY,
    lengthMeters: placement.lengthMeters,
    actualLengthMeters: placement.lengthMeters,
    heightMeters: placement.heightMeters,
    depthMeters: placement.depthMeters,
    startAlongMeters: placement.startAlongMeters,
    endAlongMeters: placement.endAlongMeters,
    source: 'lintel_closure',
    nearOpeningId: placement.openingId,
    closureRole:
      placement.side === 'left' ? 'lintel_left_bearing' : 'lintel_right_bearing',
  });
  counts[blockType] += 1;
}

function appendSupportBlocksToLayout(
  supportBlocks: OpeningSupportBlockPlacement[],
  blocks: CmuBlockInstance[],
  counts: Record<CmuBlockType, number>,
) {
  const wallFaces = new Set<CmuBlockInstanceWallFace>(['north', 'east', 'south', 'west']);
  supportBlocks.forEach((support) => {
    const legacyFace = wallFaces.has(support.hostSegmentId as CmuBlockInstanceWallFace)
      ? (support.hostSegmentId as CmuBlockInstanceWallFace)
      : 'north';
    const block = supportBlockPlacementToBlockInstance(support, legacyFace);
    blocks.push({
      id: block.id,
      face: block.face,
      segmentId: wallFaces.has(support.hostSegmentId as CmuBlockInstanceWallFace) ? undefined : support.hostSegmentId,
      course: block.course,
      courseIndex: block.courseIndex,
      blockType: block.blockType === 'half_block' ? 'half' : 'cut',
      unitType: block.blockType === 'half_block' ? 'half' : 'cut',
      x: block.x,
      y: block.y,
      z: block.z,
      rotationY: block.rotationY,
      lengthMeters: block.lengthMeters,
      heightMeters: block.heightMeters,
      depthMeters: block.depthMeters,
      startAlongMeters: block.startAlongMeters,
      endAlongMeters: block.endAlongMeters,
      source: block.source,
      nearOpeningId: block.openingId,
      closureRole: block.closureRole,
    });
    counts[block.blockType === 'half_block' ? 'half' : 'cut'] += 1;
  });
}

function appendOpeningJambClosureBlocks(params: {
  openings: readonly ResolvedCmuOpening[];
  lintelSupportBlocks: readonly OpeningSupportBlockPlacement[];
  moduleLength: number;
  moduleHeight: number;
  actualHeight: number;
  actualFullLength: number;
  wallThickness: number;
  courseCount: number;
  runningBond: boolean;
  cornerCondition?: CmuWallSystemParameters['cornerCondition'];
  fillFactor?: number;
  groutWastePercent?: number;
  wallLengthByFace: Record<CmuBlockInstanceWallFace, number>;
  resolvedLintelSpans: ReadonlyMap<string, ResolvedLintelSpan>;
  legacyWallFaces?: readonly {
    face: CmuBlockInstanceWallFace;
    length: number;
    x?: number;
    z?: number;
    rotationY: number;
  }[];
  segmentFrames?: ReadonlyMap<string, SegmentFrame>;
  segmentStationAlignments?: ReadonlyMap<string, ReturnType<typeof resolveSegmentStationAlignment>>;
  openingsBySegmentId?: (opening: ResolvedCmuOpening) => string | undefined;
  courseUnitsResolver?: (
    segmentId: string,
    courseIndex: number,
  ) => readonly { startAlongMeters: number; endAlongMeters: number }[] | undefined;
  blocks: CmuBlockInstance[];
  counts: Record<CmuBlockType, number>;
  closureKeys: Set<string>;
}): CmuOpeningCourseClosure[] {
  const closures: CmuOpeningCourseClosure[] = [];
  const fillFactor = params.fillFactor ?? 0.5;
  const wasteMultiplier = 1 + Math.max(0, params.groutWastePercent ?? 0.1);

  params.openings.forEach((opening) => {
    const wallFace = opening.wallFace ?? 'north';
    const segmentId = params.openingsBySegmentId?.(opening) ?? wallFace;
    const legacyWall = params.legacyWallFaces?.find((wall) => wall.face === wallFace);
    const frame = params.segmentFrames?.get(segmentId);
    const wallLength = frame?.lengthMeters ?? params.wallLengthByFace[wallFace];
    const horizontalWall = wallFace === 'north' || wallFace === 'south';

    for (let course = 0; course < params.courseCount; course += 1) {
      const courseBottom = course * params.moduleHeight;
      const courseTop = courseBottom + params.moduleHeight;
      const lintelCourseIndex = resolveLintelCourseIndex(opening.roughTopMeters, params.moduleHeight);
      if (opening.lintelType !== 'none' && course === lintelCourseIndex) {
        continue;
      }
      const horizontalOwnsCorners = !params.runningBond || course % 2 === 0;
      const ownsCorner = horizontalWall ? horizontalOwnsCorners : !horizontalOwnsCorners;
      const cornerTrim =
        (params.cornerCondition ?? 'interlocked') === 'interlocked' && !ownsCorner ? params.wallThickness : 0;
      const globalJointOffset =
        params.runningBond && course % 2 === 1 ? params.moduleLength / 2 : 0;
      const courseUnits =
        params.courseUnitsResolver?.(segmentId, course) ??
        buildCourseUnits({
          wallLength: Math.max(params.moduleLength / 2, wallLength - cornerTrim * 2),
          moduleLength: params.moduleLength,
          actualFullLength: params.actualFullLength,
          runningBond: params.runningBond,
          course,
          globalJointOffset,
        }).map((unit) => ({
          startAlongMeters: unit.startAlongMeters + cornerTrim,
          endAlongMeters: unit.endAlongMeters + cornerTrim,
        }));
      const stationAlignment = params.segmentStationAlignments?.get(segmentId);
      const alignedCourseUnits = stationAlignment
        ? courseUnits.map((unit) => stationAlignment.masonrySpanToFrame(unit))
        : courseUnits;

      const gaps = computeOpeningJambGapsForCourse({
        opening,
        courseIndex: course,
        courseBottomMeters: courseBottom,
        courseTopMeters: courseTop,
        courseUnits: alignedCourseUnits,
        moduleLengthMeters: params.moduleLength,
        moduleHeightMeters: params.moduleHeight,
        wallLengthMeters: wallLength,
        groutEnabled: opening.jambGroutEnabled,
        resolvedLintelSpans: params.resolvedLintelSpans,
      });

      gaps.forEach((gap) => {
        closures.push(
          openingJambGapToCourseClosure({
            gap,
            wallFace,
            wallThickness: params.wallThickness,
            courseHeight: params.moduleHeight,
            fillFactor,
            wasteMultiplier,
            opening,
          }) as CmuOpeningCourseClosure,
        );

        if (
          !shouldPlaceJambClosureBlock({
            gap,
            opening,
            moduleHeightMeters: params.moduleHeight,
            lintelSupportBlocks: params.lintelSupportBlocks,
          })
        ) {
          return;
        }

        const key = `${segmentId}-${opening.id}-${course}-${gap.side}`;
        if (params.closureKeys.has(key)) return;
        params.closureKeys.add(key);
        // Jamb closure geometry is emitted per nominal unit via resolveUnitSegmentsAroundOpenings.
      });
    }
  });

  return closures;
}

function roundMeters(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function generateCmuLayout(params: CmuWallSystemParameters): CmuLayoutResult {
  const moduleConfig = resolveCmuModuleConfig(params);
  const moduleLength = moduleConfig.moduleLengthMeters;
  const moduleHeight = moduleConfig.moduleHeightMeters;
  const actualFullLength = moduleConfig.actualLengthMeters ?? Math.max(0.01, moduleLength - moduleConfig.mortarJointMeters);
  const actualHeight = moduleConfig.actualHeightMeters ?? Math.max(0.01, moduleHeight - moduleConfig.mortarJointMeters);
  if (moduleLength <= 0 || moduleHeight <= 0) return emptyCmuLayout(params);
  if (params.lengthMeters <= 0 || params.widthMeters <= 0 || params.heightMeters <= 0) return emptyCmuLayout(params);

  const blocks: CmuBlockInstance[] = [];
  const unitPlacements: CmuUnitPlacement[] = [];
  const roughOpenings = resolveCmuOpenings(params);
  const resolvedLintelSpans = buildResolvedLintelSpanMap(
    roughOpenings,
    moduleLength,
    (opening) => wallLengthForLegacyOpening(opening, params),
  );
  const lintelSolids = buildLegacyLintelSolidPlacements(params, roughOpenings, resolvedLintelSpans);
  const lintelSupportBlocks = buildLegacyLintelBearingSupportBlocks(params, roughOpenings, resolvedLintelSpans);
  const lintels = lintelSolids.map(lintelSolidToInstance);
  const pilasters = generatePilasterInstances(params);
  const courseCount = courseCountFromHeight(params.heightMeters, moduleHeight);
  const core = resolveCmuCoreGeometry(params);
  const wastePercent = Math.max(0, params.groutWastePercent ?? 0.1) * 100;
  const jambGroutFills = buildLegacyJambGroutFillPlacements(params, roughOpenings, courseCount);
  const wallInset = Math.max(0, params.wallThicknessMeters) / 2;
  const resolveLegacyPlacement = (opening: ResolvedCmuOpening, alongMeters: number, y: number) => {
    const wallFace = opening.wallFace ?? 'north';
    const wallLength = wallFace === 'north' || wallFace === 'south' ? params.lengthMeters : params.widthMeters;
    const centeredAlong = alongMeters - wallLength / 2;
    const rotationY = wallFace === 'east' || wallFace === 'west' ? Math.PI / 2 : 0;
    const x =
      wallFace === 'east'
        ? params.lengthMeters / 2 - wallInset
        : wallFace === 'west'
          ? -params.lengthMeters / 2 + wallInset
          : centeredAlong;
    const z =
      wallFace === 'north'
        ? -params.widthMeters / 2 + wallInset
        : wallFace === 'south'
          ? params.widthMeters / 2 - wallInset
          : centeredAlong;
    return {
      hostSegmentId: wallFace,
      center: { x, y, z },
      rotationY,
      depthMeters: params.wallThicknessMeters,
    };
  };
  const lintelGroutFills = buildLintelGroutFillPlacements(
    params,
    roughOpenings,
    (opening, along, y) => resolveLegacyPlacement(opening, along, y),
    resolvedLintelSpans,
    new Map(roughOpenings.map((opening) => [opening.id, wallLengthForLegacyOpening(opening, params)])),
  );
  const sillGroutFills = buildSillGroutFillPlacements(params, roughOpenings, params.openings, (opening, along, y) =>
    resolveLegacyPlacement(opening, along, y),
  );
  const { placements: groutFillPlacements, overlapDeduplicationCubicMeters } = deduplicateGroutFillPlacements([
    ...jambGroutFills,
    ...lintelGroutFills,
    ...sillGroutFills,
  ]);
  const jambGroutCells = groutFillsToJambGroutCells(groutFillPlacements);
  const derivedOpeningSupports = buildDerivedOpeningSupports({
    openings: roughOpenings,
    resolvedSpans: resolvedLintelSpans,
    supportBlocks: lintelSupportBlocks,
    groutPlacements: groutFillPlacements,
  });
  const bondBeamLength = params.bondBeamEnabled ? 2 * (params.lengthMeters + params.widthMeters) : 0;
  const bondBeamGroutVolumeCubicMeters = bondBeamLength
    ? bondBeamLength * params.wallThicknessMeters * moduleHeight * (params.coreFillFactor ?? 0.5) * (1 + (params.groutWastePercent ?? 0.1))
    : 0;
  const counts = createEmptyCounts();
  const moduleFits = summarizeWallModuleFits(params);
  const closureKeys = new Set<string>();
  const legacyCourseUnitsBySegment = new Map<string, { startAlongMeters: number; endAlongMeters: number }[]>();
  const wallThickness = Math.max(0, params.wallThicknessMeters);
  const wallFaces = [
    { face: 'north', length: params.lengthMeters, z: -params.widthMeters / 2 + wallThickness / 2, rotationY: 0, fit: moduleFits.north },
    { face: 'south', length: params.lengthMeters, z: params.widthMeters / 2 - wallThickness / 2, rotationY: 0, fit: moduleFits.south },
    { face: 'east', length: params.widthMeters, x: params.lengthMeters / 2 - wallThickness / 2, rotationY: Math.PI / 2, fit: moduleFits.east },
    { face: 'west', length: params.widthMeters, x: -params.lengthMeters / 2 + wallThickness / 2, rotationY: Math.PI / 2, fit: moduleFits.west },
  ] as const;

  for (const wall of wallFaces) {
    for (let course = 0; course < courseCount; course += 1) {
      const runningBond = (params.bondPattern ?? 'running_bond') === 'running_bond';
      const courseContext = createMasonryCourseContext({
        courseIndex: course,
        moduleHeightMeters: moduleHeight,
        nominalModuleLengthMeters: moduleLength,
        bondPattern: params.bondPattern,
        orderedPerimeterSegmentIds: wallFaces.map((face) => face.face),
      });
      const horizontalWall = wall.face === 'north' || wall.face === 'south';
      const horizontalOwnsCorners = !runningBond || course % 2 === 0;
      const ownsCorner = horizontalWall ? horizontalOwnsCorners : !horizontalOwnsCorners;
      const cornerTrim = (params.cornerCondition ?? 'interlocked') === 'interlocked' && !ownsCorner ? wallThickness : 0;
      const effectiveWallLength = Math.max(moduleLength / 2, wall.length - cornerTrim * 2);
      const courseUnits = buildCourseUnits({
        wallLength: effectiveWallLength,
        moduleLength,
        actualFullLength,
        runningBond,
        course,
        globalJointOffset: courseContext.globalJointOffset,
      });
      legacyCourseUnitsBySegment.set(
        `${wall.face}-${course}`,
        courseUnits.map((unit) => ({
          startAlongMeters: unit.startAlongMeters + cornerTrim,
          endAlongMeters: unit.endAlongMeters + cornerTrim,
        })),
      );
      courseUnits.forEach((unit, column) => {
        const stationMeters = unit.nominalStartMeters + cornerTrim;
        const startAlongMeters = unit.startAlongMeters + cornerTrim;
        const endAlongMeters = unit.endAlongMeters + cornerTrim;
        const courseBottomMeters = course * moduleHeight;
        const courseTopMeters = course * moduleHeight + actualHeight;
        const wallOpenings = roughOpenings.filter((opening) => opening.wallFace === wall.face);
        const segments = resolveUnitSegmentsAroundOpenings({
          startAlongMeters,
          endAlongMeters,
          openings: wallOpenings,
          courseIndex: course,
          courseBottomMeters,
          courseTopMeters,
          moduleHeightMeters: moduleHeight,
          moduleLengthMeters: moduleLength,
          wallLengthMeters: wall.length,
          resolvedLintelSpans,
        });
        if (segments.length === 0) return;
        const defaultBlockType = resolveBlockType(
          params,
          { ...unit, startAlongMeters, endAlongMeters },
          wall.length,
          wall.fit,
          ownsCorner,
        );
        const terminalClosure: TerminalClosureUnit | undefined =
          unit.terminalClosureReason && segments.length === 1 && segments[0].source === 'wall_run'
            ? {
                segmentId: wall.face,
                courseIndex: course,
                direction: 'clockwise',
                startStationMeters: stationMeters,
                endStationMeters: endAlongMeters,
                remainingLengthMeters: unit.lengthMeters,
                unitType: 'cut',
                location: 'outgoing_corner',
                reason: unit.terminalClosureReason,
              }
            : undefined;
        segments.forEach((segment, segmentIndex) => {
          const isJambClosure = segment.source === 'opening_jamb_closure';
          const blockType = blockTypeForOpeningSegment(segment, moduleLength, defaultBlockType);
          const placementStartAlongMeters = segment.startAlongMeters;
          const placementEndAlongMeters = segment.endAlongMeters;
          const placementLengthMeters = segment.lengthMeters;
          const actualLengthMeters = actualLengthForOpeningSegment(segment, unit.lengthMeters);
          const centeredAlong = placementStartAlongMeters - wall.length / 2 + actualLengthMeters / 2;
          const y = course * moduleHeight + actualHeight / 2;
          const x = 'x' in wall ? wall.x : centeredAlong;
          const z = 'z' in wall ? wall.z : centeredAlong;
          const placement: CmuUnitPlacement = {
            id:
              segments.length === 1
                ? `${wall.face}-${course}-${column}`
                : `${wall.face}-${course}-${column}-s${segmentIndex}`,
            segmentId: wall.face,
            courseIndex: course,
            moduleIndex: column,
            unitType: placementUnitFromBlockType(blockType),
            kind:
              blockType === 'corner'
                ? 'corner_block'
                : blockType === 'end'
                  ? 'end_block'
                  : blockType === 'half'
                    ? 'half_block'
                    : blockType === 'cut'
                      ? 'cut_block'
                      : 'stretcher',
            nominalLengthMeters: placementLengthMeters,
            actualLengthMeters,
            heightMeters: actualHeight,
            depthMeters: wallThickness,
            center: { x, y, z },
            rotationY: wall.rotationY,
            source: isJambClosure ? 'opening_jamb_closure' : 'auto_layout',
            terminalClosure: isJambClosure ? undefined : terminalClosure,
            startStationMeters: placementStartAlongMeters,
            endStationMeters: placementEndAlongMeters,
            openingId: segment.openingId,
            adjacentTo: segment.adjacentTo,
          };
          unitPlacements.push(placement);
          blocks.push({
            id: placement.id,
            face: wall.face,
            course,
            courseIndex: placement.courseIndex,
            moduleIndex: placement.moduleIndex,
            blockType,
            unitType: placement.unitType,
            stationMeters: placementStartAlongMeters,
            nominalLengthMeters: placement.nominalLengthMeters,
            actualLengthMeters: placement.actualLengthMeters,
            heightMeters: placement.heightMeters,
            depthMeters: placement.depthMeters,
            source: placement.source,
            terminalClosure: placement.terminalClosure,
            x,
            y,
            z,
            rotationY: wall.rotationY,
            lengthMeters: actualLengthMeters,
            startAlongMeters: placementStartAlongMeters,
            endAlongMeters: placementEndAlongMeters,
            nearOpeningId: segment.openingId,
            adjacentTo: segment.adjacentTo,
          });
          counts[blockType] += 1;
        });
      });
    }
  }

  lintels.forEach(() => {
    counts.lintel_bond_beam += 1;
  });
  appendSupportBlocksToLayout(lintelSupportBlocks, blocks, counts);
  const legacyPlacedBlocksBySegmentCourse = placedCourseBlocksBySegmentCourse(blocks);
  const legacyFramesById = buildLegacySegmentFramesById(params);
  const lintelCourseAssemblies = buildLayoutLintelCourseAssemblies({
    openings: roughOpenings,
    framesById: legacyFramesById,
    moduleLengthMeters: moduleLength,
    moduleHeightMeters: moduleHeight,
    actualHeightMeters: actualHeight,
    resolvedLintelSpans,
    courseUnitsBySegmentCourse: legacyCourseUnitsBySegment,
    placedBlocksBySegmentCourse: legacyPlacedBlocksBySegmentCourse,
    openingsBySegmentId: (opening) => opening.wallFace ?? 'north',
    runningBond: (params.bondPattern ?? 'running_bond') === 'running_bond',
  });
  appendLintelCourseClosuresToLayout(lintelCourseAssemblies, blocks, counts);
  const openingCourseClosures = appendOpeningJambClosureBlocks({
    openings: roughOpenings,
    lintelSupportBlocks,
    moduleLength,
    moduleHeight,
    actualHeight,
    actualFullLength,
    wallThickness,
    courseCount,
    runningBond: (params.bondPattern ?? 'running_bond') === 'running_bond',
    cornerCondition: params.cornerCondition,
    fillFactor: params.coreFillFactor ?? 0.5,
    groutWastePercent: params.groutWastePercent ?? 0.1,
    wallLengthByFace: {
      north: params.lengthMeters,
      south: params.lengthMeters,
      east: params.widthMeters,
      west: params.widthMeters,
    },
    resolvedLintelSpans,
    legacyWallFaces: wallFaces,
    blocks,
    counts,
    closureKeys,
  });
  const closureGroutVolumeCubicMeters = openingCourseClosures.reduce(
    (sum, closure) => sum + (closure.closureType === 'grout_fill' ? closure.groutVolume ?? 0 : 0),
    0,
  );
  const groutSummary = summarizeGroutFillPlacements({
    placements: groutFillPlacements,
    overlapDeduplicationCubicMeters,
    closureGroutVolumeCubicMeters,
    bondBeamGroutVolumeCubicMeters,
    coreGeometry: core,
  });
  const openingGrout: CmuOpeningGroutSummary = {
    resolvedOpenings: roughOpenings,
    actualOpeningAreaSquareMeters: roughOpenings.reduce((sum, opening) => sum + opening.actualAreaSquareMeters, 0),
    roughOpeningAreaSquareMeters: roughOpenings.reduce((sum, opening) => sum + opening.roughOpeningAreaSquareMeters, 0),
    jambGroutCellCount: groutSummary.jambGroutCellCount,
    lintelGroutedCellCount: groutSummary.lintelGroutedCellCount,
    lintelCount: lintels.length,
    lintelLengthMeters: lintels.reduce((sum, lintel) => sum + lintel.lengthMeters, 0),
    jambGroutVolumeCubicMeters: groutSummary.jambGroutVolumeCubicMeters,
    closureGroutVolumeCubicMeters: groutSummary.closureGroutVolumeCubicMeters,
    lintelGroutVolumeCubicMeters: groutSummary.lintelGroutVolumeCubicMeters,
    openingGroutVolumeCubicMeters:
      groutSummary.jambGroutVolumeCubicMeters +
      groutSummary.lintelGroutVolumeCubicMeters +
      groutSummary.sillGroutVolumeCubicMeters +
      groutSummary.closureGroutVolumeCubicMeters,
    sillGroutVolumeCubicMeters: groutSummary.sillGroutVolumeCubicMeters,
    bondBeamGroutVolumeCubicMeters: groutSummary.bondBeamGroutVolumeCubicMeters,
    overlapDeduplicationCubicMeters,
    groutFillPlacements,
    groutFillPlacementIds: groutSummary.groutFillPlacementIds,
    coreGeometry: core,
    totalGroutVolumeCubicMeters: groutSummary.totalGroutVolumeCubicMeters,
    courseClosureCutBlockCount: openingCourseClosures.filter((closure) => closure.closureType === 'cut_block').length,
    lintelBearingSupportBlockCount: lintelSupportBlocks.length,
    lintelBearingHalfBlockCount: lintelSupportBlocks.filter((block) => block.blockType === 'half_block').length,
    lintelBearingCutBlockCount: lintelSupportBlocks.filter((block) => block.blockType === 'cut_block').length,
    coreFillFactor: params.coreFillFactor ?? 0.5,
    groutWastePercent: params.groutWastePercent ?? 0.1,
    warnings: buildOpeningAssemblyWarnings(params, roughOpenings, groutFillPlacements),
  };
  const warnings = [
    ...validateCmuOpenings(params),
    ...openingGrout.warnings,
    ...openingCourseClosures.flatMap((closure) => (closure.warning ? [closure.warning] : [])),
    ...moduleFitWarnings(moduleFits),
    ...(params.bondPattern === 'stack_bond' ? ['Stack bond may require reinforcement/design review.'] : []),
  ];
  const moduleFitReport = buildModuleFitReportFromPlacements({
    placements: unitPlacements,
    requestedFootprint: {
      lengthMeters: params.lengthMeters,
      widthMeters: params.widthMeters,
    },
    resolvedFootprint: {
      lengthMeters: params.lengthMeters,
      widthMeters: params.widthMeters,
    },
    hasLayoutError: params.lengthMeters <= 0 || params.widthMeters <= 0,
  });

  return {
    blocks,
    unitPlacements,
    lintels,
    pilasters,
    roughOpenings,
    jambGroutCells,
    groutFillPlacements,
    openingCourseClosures,
    lintelCourseAssemblies,
    derivedOpeningSupports,
    openingGrout,
    terminalClosures: unitPlacements.flatMap((placement) => placement.terminalClosure ? [placement.terminalClosure] : []),
    counts,
    totalBlocks: Object.values(counts).reduce((sum, value) => sum + value, 0),
    courseCount,
    moduleFits,
    moduleFitReport,
    warnings,
    bondBeamLengthMeters: params.bondBeamEnabled ? 2 * (params.lengthMeters + params.widthMeters) : 0,
    groutedCellCount: Math.ceil((2 * (params.lengthMeters + params.widthMeters)) / Math.max(0.1, params.groutedCellSpacingMeters ?? 1.2)),
  };
}

function overlapsOpening(
  openings: readonly ResolvedCmuOpening[],
  face: CmuBlockInstanceWallFace,
  block: {
    startAlongMeters: number;
    endAlongMeters: number;
    bottomMeters: number;
    topMeters: number;
    courseIndex: number;
  },
  moduleHeightMeters: number,
  moduleLengthMeters: number,
  wallLengthMeters: number,
  resolvedLintelSpans: ReadonlyMap<string, ResolvedLintelSpan>,
): boolean {
  return openings.some((opening) => {
    if (opening.wallFace !== face) return false;
    return blockOverlapsOpeningAssembly({
      opening,
      startAlongMeters: block.startAlongMeters,
      endAlongMeters: block.endAlongMeters,
      courseIndex: block.courseIndex,
      courseBottomMeters: block.bottomMeters,
      courseTopMeters: block.topMeters,
      moduleHeightMeters,
      moduleLengthMeters,
      wallLengthMeters,
      resolvedLintelSpans,
    });
  });
}

export type CmuBlockInstanceWallFace = 'north' | 'east' | 'south' | 'west';

export interface DesignGeometrySummary {
  blockInstances: CmuBlockInstance[];
  slab: ThickenedEdgeSlabParameters;
  wall: CmuWallSystemParameters;
  roof: GableRoofSystemParameters;
  truss: SteelTrussSystemParameters;
}

export function emptyCmuLayout(params?: CmuWallSystemParameters): CmuLayoutResult {
  const roughOpenings = params ? resolveCmuOpenings(params) : [];
  const openingGrout = params ? calculateCmuOpeningGroutSummary(params) : emptyOpeningGroutSummary();
  const moduleFitReport = params
    ? unresolvedModuleFitReport({
        requestedFootprint: {
          lengthMeters: params.lengthMeters,
          widthMeters: params.widthMeters,
        },
      })
    : unresolvedModuleFitReport({
        requestedFootprint: { lengthMeters: 0, widthMeters: 0 },
      });
  return {
    blocks: [],
    unitPlacements: [],
    lintels: [],
    pilasters: [],
    roughOpenings,
    jambGroutCells: [],
    groutFillPlacements: [],
    openingCourseClosures: [],
    lintelCourseAssemblies: [],
    derivedOpeningSupports: [],
    openingGrout,
    terminalClosures: [],
    counts: createEmptyCounts(),
    totalBlocks: 0,
    courseCount: 0,
    moduleFits: params ? summarizeWallModuleFits(params) : {
      north: analyzeCmuModuleFit(0, 0.4),
      south: analyzeCmuModuleFit(0, 0.4),
      east: analyzeCmuModuleFit(0, 0.4),
      west: analyzeCmuModuleFit(0, 0.4),
    },
    moduleFitReport,
    warnings: [],
    bondBeamLengthMeters: 0,
    groutedCellCount: 0,
  };
}

function emptyOpeningGroutSummary(): CmuOpeningGroutSummary {
  return {
    resolvedOpenings: [],
    actualOpeningAreaSquareMeters: 0,
    roughOpeningAreaSquareMeters: 0,
    jambGroutCellCount: 0,
    lintelCount: 0,
    lintelLengthMeters: 0,
    jambGroutVolumeCubicMeters: 0,
    closureGroutVolumeCubicMeters: 0,
    lintelGroutVolumeCubicMeters: 0,
    sillGroutVolumeCubicMeters: 0,
    bondBeamGroutVolumeCubicMeters: 0,
    overlapDeduplicationCubicMeters: 0,
    groutFillPlacements: [],
    groutFillPlacementIds: [],
    totalGroutVolumeCubicMeters: 0,
    courseClosureCutBlockCount: 0,
    coreFillFactor: 0.5,
    groutWastePercent: 0,
    warnings: [],
  };
}

function buildOpeningAssemblyWarnings(
  params: CmuWallSystemParameters,
  openings: readonly ResolvedCmuOpening[],
  groutFills: readonly GroutFillPlacement[],
): string[] {
  const warnings: string[] = [OPENING_GROUT_CORE_WARNING, OPENING_GROUT_CONCEPTUAL_WARNING];
  const moduleConfig = resolveCmuModuleConfig(params);
  const minBearing = Math.max(moduleConfig.moduleLengthMeters / 2, params.lintelBearingMeters ?? 0.2);
  const minCut = moduleConfig.moduleLengthMeters / 4;
  const createsSmallJambCut = (station: number) => {
    const tolerance = 0.005;
    const remainder = ((station % moduleConfig.moduleLengthMeters) + moduleConfig.moduleLengthMeters) % moduleConfig.moduleLengthMeters;
    if (remainder <= tolerance || remainder >= moduleConfig.moduleLengthMeters - tolerance) return false;
    return remainder < minCut || moduleConfig.moduleLengthMeters - remainder < minCut;
  };

  openings.forEach((opening) => {
    if (opening.lintelType !== 'none' && opening.lintelBearingMeters < minBearing) {
      warnings.push(`Lintel bearing below configured minimum for opening ${opening.id}.`);
    }
    if (!params.snapToModule && (createsSmallJambCut(opening.roughStartAlongMeters) || createsSmallJambCut(opening.roughEndAlongMeters))) {
      warnings.push(`Opening ${opening.id} creates a jamb cut smaller than the minimum structural cut.`);
    }
    if (opening.jambGroutEnabled && !groutFills.some((fill) => fill.openingId === opening.id && fill.kind === 'jamb_cell')) {
      warnings.push(`Opening jamb does not align to available CMU cells for opening ${opening.id}.`);
    }
  });

  const byHost = new Map<string, ResolvedCmuOpening[]>();
  openings.forEach((opening) => {
    const host = (opening as ResolvedCmuOpening & { wallSegmentId?: string }).wallSegmentId ?? opening.wallFace ?? 'north';
    const list = byHost.get(host) ?? [];
    list.push(opening);
    byHost.set(host, list);
  });
  byHost.forEach((hostOpenings) => {
    const sorted = [...hostOpenings].sort((a, b) => a.roughStartAlongMeters - b.roughStartAlongMeters);
    for (let index = 1; index < sorted.length; index += 1) {
      if (sorted[index - 1].roughEndAlongMeters > sorted[index].roughStartAlongMeters) {
        warnings.push('Opening assembly overlaps another opening.');
        break;
      }
    }
  });

  return [...new Set(warnings)];
}

function createEmptyCounts(): Record<CmuBlockType, number> {
  return {
    full: 0,
    half: 0,
    end: 0,
    corner: 0,
    jamb: 0,
    lintel_bond_beam: 0,
    cut: 0,
  };
}

function resolveBlockType(
  params: CmuWallSystemParameters,
  unit: CmuCourseUnit,
  wallLength: number,
  fit: CmuModuleFitResult,
  ownsCorner = true,
): CmuBlockType {
  const nearStart = unit.startAlongMeters <= Math.max(0.005, params.mortarJointMeters);
  const nearEnd = unit.endAlongMeters >= wallLength - Math.max(0.005, params.mortarJointMeters);
  if (unit.unitType === 'cut') return 'cut';
  if (unit.unitType === 'half') return 'half';
  if ((params.cornerCondition ?? 'interlocked') === 'interlocked' && ownsCorner && (nearStart || nearEnd)) return 'corner';
  if ((params.cornerCondition ?? 'interlocked') === 'interlocked' && !ownsCorner && (nearStart || nearEnd)) return 'end';
  if ((params.endCondition ?? 'return_corner') === 'plain_end' && (nearStart || nearEnd)) return 'end';
  if (fit.fit === 'cut' && nearEnd) return 'cut';
  return 'full';
}

interface CmuCourseUnit {
  unitType: 'full' | 'half' | 'cut';
  nominalStartMeters: number;
  nominalLengthMeters: number;
  startAlongMeters: number;
  endAlongMeters: number;
  lengthMeters: number;
  source?: 'corner_assembly' | 'wall_run' | 'terminal_closure';
  terminalClosureReason?: TerminalClosureUnit['reason'];
}

type CmuStructuralModuleRules = {
  moduleLengthMeters: number;
  actualFullLengthMeters: number;
  mortarJointMeters: number;
  cornerSetbackMeters: number;
  minimumCutLengthMeters: number;
};

type CmuStructuralWarning = {
  segmentId: string;
  courseIndex: number;
  message: string;
};

function buildCourseUnits(params: {
  wallLength: number;
  moduleLength: number;
  actualFullLength: number;
  runningBond: boolean;
  course: number;
  globalJointOffset?: number;
}): CmuCourseUnit[] {
  const units: CmuCourseUnit[] = [];
  const halfModule = params.moduleLength / 2;
  const tolerance = 0.005;
  let cursor = 0;

  const courseOffset = params.globalJointOffset ?? 0;
  if (courseOffset > tolerance && params.wallLength > halfModule + tolerance) {
    units.push(makeCourseUnit('half', cursor, halfModule, params.actualFullLength / 2, params.wallLength));
    cursor += courseOffset;
  }

  while (cursor < params.wallLength - tolerance) {
    const remaining = params.wallLength - cursor;
    if (remaining >= params.moduleLength - tolerance) {
      units.push(makeCourseUnit('full', cursor, params.moduleLength, params.actualFullLength, params.wallLength));
      cursor += params.moduleLength;
    } else if (Math.abs(remaining - halfModule) <= tolerance) {
      units.push(makeCourseUnit('half', cursor, halfModule, params.actualFullLength / 2, params.wallLength));
      cursor += halfModule;
    } else {
      if (remaining < DEFAULT_MINIMUM_CUT_BLOCK_LENGTH_METERS && units.at(-1)?.unitType === 'full') {
        units.pop();
        cursor -= params.moduleLength;
      }
      const cutLength = params.wallLength - cursor;
      units.push({
        ...makeCourseUnit('cut', cursor, cutLength, cutLength, params.wallLength),
        terminalClosureReason: 'non_modular_terminal_closure',
      });
      cursor = params.wallLength;
    }
  }

  return units;
}

function buildStructuralSegmentCourseUnits(params: {
  segmentId: string;
  courseIndex: number;
  wallLength: number;
  ownerAtStart: boolean;
  ownerAtEnd: boolean;
  buttingAtStart: boolean;
  buttingAtEnd: boolean;
  rules: CmuStructuralModuleRules;
  warnings: CmuStructuralWarning[];
  previousCourseUnits?: readonly CmuCourseUnit[];
}): CmuCourseUnit[] {
  const tolerance = 0.005;
  const units: CmuCourseUnit[] = [];
  const wallLength = Math.max(0, params.wallLength);
  const moduleLength = params.rules.moduleLengthMeters;
  const actualFullLength = params.rules.actualFullLengthMeters;
  const cornerSetback = Math.min(params.rules.cornerSetbackMeters, Math.max(0, wallLength / 2));

  if (params.ownerAtStart && wallLength >= moduleLength - tolerance) {
    units.push({
      ...makeCourseUnit('full', 0, moduleLength, actualFullLength, wallLength),
      source: 'corner_assembly',
    });
  }

  if (params.ownerAtEnd && wallLength >= moduleLength - tolerance) {
    units.push({
      ...makeCourseUnit('full', Math.max(0, wallLength - moduleLength), moduleLength, actualFullLength, wallLength),
      source: 'corner_assembly',
    });
  }

  const runStart = params.ownerAtStart
    ? Math.min(moduleLength, wallLength)
    : params.buttingAtStart
      ? cornerSetback
      : 0;
  const runEnd = params.ownerAtEnd
    ? Math.max(runStart, wallLength - moduleLength)
    : params.buttingAtEnd
      ? Math.max(runStart, wallLength - cornerSetback)
      : wallLength;

  units.push(
    ...buildStaggeredWallRunUnits({
      segmentId: params.segmentId,
      courseIndex: params.courseIndex,
      runStart,
      runEnd,
      wallLength,
      rules: params.rules,
      warnings: params.warnings,
      previousCourseUnits: params.previousCourseUnits,
    }),
  );

  return units.sort((a, b) => a.nominalStartMeters - b.nominalStartMeters);
}

function buildStaggeredWallRunUnits(params: {
  segmentId: string;
  courseIndex: number;
  runStart: number;
  runEnd: number;
  wallLength: number;
  rules: CmuStructuralModuleRules;
  warnings: CmuStructuralWarning[];
  previousCourseUnits?: readonly CmuCourseUnit[];
}): CmuCourseUnit[] {
  const tolerance = 0.005;
  const runLength = Math.max(0, params.runEnd - params.runStart);
  if (runLength <= tolerance) return [];

  const moduleLength = params.rules.moduleLengthMeters;
  const fullCount = Math.floor((runLength + tolerance) / moduleLength);
  const fullLength = fullCount * moduleLength;
  const remainder = runLength - fullLength;
  const units: CmuCourseUnit[] = [];
  const pushFull = (moduleStart: number) => {
    units.push({
      ...makeCourseUnit('full', moduleStart, moduleLength, params.rules.actualFullLengthMeters, params.wallLength),
      source: 'wall_run',
    });
  };

  if (Math.abs(remainder) <= tolerance) {
    for (let index = 0; index < fullCount; index += 1) {
      pushFull(params.runStart + index * moduleLength);
    }
    return units;
  }

  const shouldSplitCut = remainder >= params.rules.minimumCutLengthMeters * 2 - tolerance;
  const cutNominalLengths = shouldSplitCut
    ? [remainder / 2, remainder - remainder / 2]
    : [remainder];
  if (remainder < params.rules.minimumCutLengthMeters - tolerance) {
    params.warnings.push({
      segmentId: params.segmentId,
      courseIndex: params.courseIndex,
      message: `Wall-run cut ${roundMeters(remainder).toFixed(3)} m is smaller than the minimum structural cut ${roundMeters(params.rules.minimumCutLengthMeters).toFixed(3)} m.`,
    });
  }

  const buildCandidateUnits = (cutInsertionIndexes: readonly number[]) => {
    const candidate: CmuCourseUnit[] = [];
    const candidatePushFull = (moduleStart: number) => {
      candidate.push({
        ...makeCourseUnit('full', moduleStart, moduleLength, params.rules.actualFullLengthMeters, params.wallLength),
        source: 'wall_run',
      });
    };
    let cursor = params.runStart;
    let cutIndex = 0;
    for (let fullIndex = 0; fullIndex <= fullCount; fullIndex += 1) {
      while (cutInsertionIndexes[cutIndex] === fullIndex) {
        const nominalCutLength = cutNominalLengths[cutIndex] ?? cutNominalLengths.at(-1) ?? remainder;
        candidate.push({
          ...makeCourseUnit('cut', cursor, nominalCutLength, Math.max(0.02, nominalCutLength - params.rules.mortarJointMeters), params.wallLength),
          source: 'wall_run',
        });
        cursor += nominalCutLength;
        cutIndex += 1;
      }
      if (fullIndex < fullCount) {
        candidatePushFull(cursor);
        cursor += moduleLength;
      }
    }
    return candidate;
  };

  const headJointsForUnits = (candidateUnits: readonly CmuCourseUnit[]) => {
    const stations = candidateUnits.flatMap((unit) => [unit.nominalStartMeters, unit.nominalStartMeters + unit.nominalLengthMeters]);
    return [...new Set(stations
      .filter((station) => station > tolerance && station < params.wallLength - tolerance)
      .map((station) => roundMeters(station)))];
  };
  const previousJoints = params.previousCourseUnits ? headJointsForUnits(params.previousCourseUnits) : [];
  const middleCutIndex = Math.floor(fullCount / 2);
  const preferredCutIndex = Math.max(
    0,
    Math.min(fullCount, middleCutIndex + (params.courseIndex % 2 === 0 ? 1 : -1)),
  );
  const candidateCutIndexes = shouldSplitCut
    ? Array.from({ length: fullCount + 1 }, (_, firstIndex) =>
      Array.from({ length: fullCount - firstIndex }, (_, offset) => [firstIndex, firstIndex + offset + 1]),
    ).flat()
    : Array.from({ length: fullCount + 1 }, (_, cutInsertionIndex) => [cutInsertionIndex]);
  const candidate = candidateCutIndexes.map((cutInsertionIndexes) => {
    const candidateUnits = buildCandidateUnits(cutInsertionIndexes);
    const candidateJoints = headJointsForUnits(candidateUnits);
    const stackedJointCount = previousJoints.filter((joint) =>
      candidateJoints.some((candidateJoint) => Math.abs(candidateJoint - joint) <= Math.max(0.006, moduleLength * 0.025)),
    ).length;
    const distanceFromPreferred = cutInsertionIndexes.reduce((total, cutInsertionIndex) => total + Math.abs(cutInsertionIndex - preferredCutIndex), 0);
    const distanceFromMiddle = cutInsertionIndexes.reduce((total, cutInsertionIndex) => total + Math.abs(cutInsertionIndex - middleCutIndex), 0);
    return {
      cutInsertionIndexes,
      units: candidateUnits,
      stackedJointCount,
      distanceFromPreferred,
      distanceFromMiddle,
      spreadPenalty: cutInsertionIndexes.length > 1 ? Math.abs((cutInsertionIndexes.at(-1) ?? 0) - cutInsertionIndexes[0] - 2) : 0,
    };
  }).sort((a, b) =>
    a.stackedJointCount - b.stackedJointCount ||
    a.spreadPenalty - b.spreadPenalty ||
    a.distanceFromPreferred - b.distanceFromPreferred ||
    a.distanceFromMiddle - b.distanceFromMiddle,
  )[0];
  units.push(...candidate.units);

  return units;
}

function scoreSegmentCourseUnits(units: readonly CmuCourseUnit[], cornerIntegrityPenalty = 0): SegmentSolutionScore {
  const wallRunUnits = units.filter((unit) => unit.source !== 'corner_assembly');
  return {
    cutUnits: wallRunUnits.filter((unit) => unit.unitType === 'cut').length,
    halfUnits: wallRunUnits.filter((unit) => unit.unitType === 'half').length,
    fullUnits: wallRunUnits.filter((unit) => unit.unitType === 'full').length,
    cornerIntegrityPenalty,
  };
}

export function validateSegmentCoursePlacement(plan: CmuSegmentCoursePlan): ValidationResult {
  const wallRunUnits = plan.units.filter((unit) => unit.source !== 'corner_assembly');
  const halfUnitCount = wallRunUnits.filter((unit) => unit.unitType === 'half').length;
  const cutUnitCount = wallRunUnits.filter((unit) => unit.unitType === 'cut').length;
  const hasBookendHalves = wallRunUnits[0]?.unitType === 'half' && wallRunUnits[wallRunUnits.length - 1]?.unitType === 'half';
  if (halfUnitCount > 1 && hasBookendHalves && cutUnitCount === 0) {
    return {
      valid: false,
      warnings: ['Uninterrupted segment course contains redundant half blocks at both ends.'],
    };
  }
  return { valid: true, warnings: [] };
}

export function buildCmuCoursePlans(params: {
  perimeter: ClockwisePerimeter;
  courseCount: number;
  moduleLength: number;
  actualFullLength: number;
  moduleHeight: number;
  wallThicknessMeters?: number;
  bondPattern: CmuWallSystemParameters['bondPattern'];
}): CmuCoursePlan[] {
  const plans: CmuCoursePlan[] = [];
  const runningBond = normalizeBondPattern(params.bondPattern) === 'running_bond';
  const structuralRules: CmuStructuralModuleRules = {
    moduleLengthMeters: params.moduleLength,
    actualFullLengthMeters: params.actualFullLength,
    mortarJointMeters: Math.max(0, params.moduleLength - params.actualFullLength),
    cornerSetbackMeters: runningBond ? params.moduleLength / 2 : 0,
    minimumCutLengthMeters: params.moduleLength / 4,
  };
  const structuralWarnings: CmuStructuralWarning[] = [];
  for (let courseIndex = 0; courseIndex < params.courseCount; courseIndex += 1) {
    const phase = (runningBond ? courseIndex % 2 : 0) as 0 | 1;
    const cornerAssemblies = params.perimeter.segments.map((outgoingSegment, index) => {
      const incomingSegment = params.perimeter.segments[(index + params.perimeter.segments.length - 1) % params.perimeter.segments.length];
      const incomingOwns = phase === 0;
      return {
        cornerId: outgoingSegment.incomingCornerId ?? `corner-${outgoingSegment.startNodeId}`,
        courseIndex,
        phase,
        incomingSegmentId: incomingSegment.segmentId,
        outgoingSegmentId: outgoingSegment.segmentId,
        ownerSegmentId: incomingOwns ? incomingSegment.segmentId : outgoingSegment.segmentId,
        buttingSegmentId: incomingOwns ? outgoingSegment.segmentId : incomingSegment.segmentId,
        incomingEndStationMeters: incomingOwns
          ? incomingSegment.lengthMeters
          : Math.max(0, incomingSegment.lengthMeters - structuralRules.cornerSetbackMeters),
        outgoingStartStationMeters: incomingOwns ? structuralRules.cornerSetbackMeters : 0,
        ownerCloserType: 'corner',
        buttingCloserType: 'end',
        exteriorCornerPoint: { ...outgoingSegment.exteriorStart },
      } satisfies CmuCornerCourseAssembly;
    });
    const cornerByOutgoing = new Map(cornerAssemblies.map((assembly) => [assembly.outgoingSegmentId, assembly]));
    const cornerByIncoming = new Map(cornerAssemblies.map((assembly) => [assembly.incomingSegmentId, assembly]));
    const segmentPlans = params.perimeter.segments.map((segment) => {
      const startAssembly = cornerByOutgoing.get(segment.segmentId);
      const endAssembly = cornerByIncoming.get(segment.segmentId);
      const startStationMeters = startAssembly?.outgoingStartStationMeters ?? 0;
      const endStationMeters = endAssembly?.incomingEndStationMeters ?? segment.lengthMeters;
      const previousCourseUnits = plans.at(-1)?.segmentPlans.find(
        (previousSegmentPlan) => previousSegmentPlan.segmentId === segment.segmentId,
      )?.units;
      const units = buildStructuralSegmentCourseUnits({
        segmentId: segment.segmentId,
        courseIndex,
        wallLength: segment.lengthMeters,
        ownerAtStart: startAssembly?.ownerSegmentId === segment.segmentId,
        ownerAtEnd: endAssembly?.ownerSegmentId === segment.segmentId,
        buttingAtStart: startAssembly?.buttingSegmentId === segment.segmentId,
        buttingAtEnd: endAssembly?.buttingSegmentId === segment.segmentId,
        rules: structuralRules,
        warnings: structuralWarnings,
        previousCourseUnits,
      });
      const segmentWarnings = structuralWarnings
        .filter((warning) => warning.segmentId === segment.segmentId && warning.courseIndex === courseIndex)
        .map((warning) => warning.message);
      const draftPlan = {
        segmentId: segment.segmentId,
        courseIndex,
        startStationMeters,
        endStationMeters,
        startCornerId: startAssembly?.cornerId,
        endCornerId: endAssembly?.cornerId,
        ownerAtStart: startAssembly?.ownerSegmentId === segment.segmentId,
        ownerAtEnd: endAssembly?.ownerSegmentId === segment.segmentId,
        buttingAtStart: startAssembly?.buttingSegmentId === segment.segmentId,
        buttingAtEnd: endAssembly?.buttingSegmentId === segment.segmentId,
        units,
        score: scoreSegmentCourseUnits(units),
        validation: { valid: segmentWarnings.length === 0, warnings: segmentWarnings },
      } satisfies CmuSegmentCoursePlan;
      const validation = validateSegmentCoursePlacement(draftPlan);
      return {
        ...draftPlan,
        validation: {
          valid: draftPlan.validation.valid && validation.valid,
          warnings: [...draftPlan.validation.warnings, ...validation.warnings],
        },
      } satisfies CmuSegmentCoursePlan;
    });
    plans.push({
      courseIndex,
      phase,
      elevationY: courseIndex * params.moduleHeight,
      perimeter: params.perimeter,
      cornerAssemblies,
      segmentPlans,
    });
  }
  if (runningBond) {
    applyRunningBondJointValidation(plans, params.moduleLength);
  }
  return plans;
}

function applyRunningBondJointValidation(plans: CmuCoursePlan[], moduleLengthMeters: number) {
  const tolerance = Math.max(0.006, moduleLengthMeters * 0.025);
  for (let courseIndex = 0; courseIndex < plans.length - 1; courseIndex += 1) {
    const current = plans[courseIndex];
    const next = plans[courseIndex + 1];
    current.segmentPlans.forEach((plan) => {
      const nextPlan = next.segmentPlans.find((candidate) => candidate.segmentId === plan.segmentId);
      if (!nextPlan) return;
      const currentJoints = interiorHeadJoints(plan);
      const nextJoints = interiorHeadJoints(nextPlan);
      const stacked = currentJoints.find((joint) => nextJoints.some((candidate) => Math.abs(candidate - joint) <= tolerance));
      if (stacked == null) return;
      const warning = `Stacked CMU head joint near ${roundMeters(stacked).toFixed(3)} m between courses ${courseIndex + 1} and ${courseIndex + 2}.`;
      plan.validation = {
        valid: false,
        warnings: [...plan.validation.warnings, warning],
      };
      nextPlan.validation = {
        valid: false,
        warnings: [...nextPlan.validation.warnings, warning],
      };
    });
  }
}

function interiorHeadJoints(plan: CmuSegmentCoursePlan): number[] {
  const tolerance = 0.005;
  const starts = plan.units.map((unit) => unit.nominalStartMeters).filter((station) => station > tolerance);
  const ends = plan.units.map((unit) => unit.nominalStartMeters + unit.nominalLengthMeters).filter((station) => station < plan.endStationMeters - tolerance);
  return [...new Set([...starts, ...ends].map((station) => roundMeters(station)))];
}

function placementUnitFromBlockType(blockType: CmuBlockType): CmuBlockPlacement['unitType'] {
  if (blockType === 'lintel_bond_beam') return 'bond_beam';
  return blockType;
}

function placementKindForCourseUnit(unit: CmuCourseUnit, plan: CmuSegmentCoursePlan): NonNullable<CmuUnitPlacement['kind']> {
  if (unit.source === 'corner_assembly') return 'corner_block';
  if (unit.unitType === 'cut') return 'cut_block';
  if (unit.unitType === 'half') return 'half_block';
  const isFirst = plan.units[0] === unit;
  const isLast = plan.units[plan.units.length - 1] === unit;
  if ((isFirst && plan.ownerAtStart) || (isLast && plan.ownerAtEnd)) return 'corner_block';
  if ((isFirst && plan.buttingAtStart) || (isLast && plan.buttingAtEnd)) return 'end_block';
  return 'stretcher';
}

export function createCmuBlockPlacement(params: {
  id?: string;
  segmentId: string;
  cornerId?: string;
  courseIndex: number;
  moduleIndex: number;
  unitType: CmuBlockPlacement['unitType'];
  stationMeters: number;
  nominalLengthMeters: number;
  actualLengthMeters: number;
  heightMeters: number;
  physicalHeightMeters?: number;
  depthMeters: number;
  wallStart: { x: number; z: number };
  tangent: { x: number; z: number };
  inwardNormal: { x: number; z: number };
  moduleHeightMeters: number;
  rotationY: number;
  source?: CmuUnitPlacement['source'];
  kind?: CmuUnitPlacement['kind'];
  startStationMeters?: number;
  endStationMeters?: number;
  terminalClosure?: TerminalClosureUnit;
  openingId?: string;
  adjacentTo?: 'rough_opening_start' | 'rough_opening_end';
}): CmuBlockPlacement {
  const centerStation = params.stationMeters + params.nominalLengthMeters / 2;
  return {
    id: params.id ?? `${params.segmentId}-${params.courseIndex}-${params.moduleIndex}`,
    segmentId: params.segmentId,
    cornerId: params.cornerId,
    courseIndex: params.courseIndex,
    moduleIndex: params.moduleIndex,
    unitType: params.unitType,
    kind: params.kind,
    startStationMeters: params.startStationMeters,
    endStationMeters: params.endStationMeters,
    nominalLengthMeters: params.nominalLengthMeters,
    actualLengthMeters: params.actualLengthMeters,
    heightMeters: params.heightMeters,
    depthMeters: params.depthMeters,
    stationMeters: params.stationMeters,
    lengthMeters: params.actualLengthMeters,
    center: {
      x: params.wallStart.x + params.tangent.x * centerStation + params.inwardNormal.x * (params.depthMeters / 2),
      y: params.courseIndex * params.moduleHeightMeters + params.heightMeters / 2,
      z: params.wallStart.z + params.tangent.z * centerStation + params.inwardNormal.z * (params.depthMeters / 2),
    },
    rotationY: params.rotationY,
    source: params.source ?? 'auto_layout',
    terminalClosure: params.terminalClosure,
    openingId: params.openingId,
    adjacentTo: params.adjacentTo,
  };
}

export function generateLayoutWallGeometry(
  layout: DesignWallLayoutParameters,
  wall: CmuWallSystemParameters,
): Pick<DesignGeometryResult, 'wallSegments' | 'blockInstances' | 'cornerCourseLayouts' | 'exteriorFootprint' | 'boundaryViolations'> {
  const resolvedGeometry = resolveWallLayoutGeometry(layout, wall);
  const wallCmuLayout = generateCmuLayoutFromWallLayout(layout, wall, resolvedGeometry);
  const exteriorFootprint = resolvedGeometry.exteriorFacePolygon;
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
    wall.wallThicknessMeters || layout.defaultWallThicknessMeters,
  );
  return {
    wallSegments,
    blockInstances,
    cornerCourseLayouts: wallCmuLayout.cornerAssemblies?.map((assembly) => ({
      cornerId: assembly.cornerId,
      nodeId: assembly.cornerId.replace(/^corner-/, ''),
      courseIndex: assembly.courseIndex,
      ownerSegmentId: assembly.ownerSegmentId,
      buttingSegmentId: assembly.buttingSegmentId,
      cornerType: assembly.cornerType === 'convex_outside' ? 'outside' : assembly.cornerType === 'concave_inside' ? 'inside' : assembly.cornerType,
      strategy: 'interlocked_running_bond',
      ownerStartTrim: assembly.ownerSetbackMeters,
      buttingStartTrim: assembly.buttingSetbackMeters,
      generatedUnitType: generatedCornerUnitType(assembly.generatedUnitType),
    })) ?? [],
    exteriorFootprint,
    boundaryViolations,
  };
}

function signedPolygonArea(points: readonly DesignGeometryPoint[]): number {
  if (points.length < 3) return 0;
  return points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.z - next.x * point.z;
  }, 0) / 2;
}

export function findExteriorFootprintBoundaryViolations(
  blocks: readonly DesignGeometryBlockInstance[],
  exteriorFootprint: readonly DesignGeometryPoint[],
  wallThicknessMeters: number,
  toleranceMeters = 0.006,
): DesignGeometryBoundaryViolation[] {
  if (exteriorFootprint.length < 3) return [];
  return blocks
    .filter((block) =>
      !(block.source === 'corner_assembly' && block.blockType === 'corner') &&
      blockFootprintCorners(block, wallThicknessMeters).some((corner) => !pointInPolygonOrOnBoundary(corner, exteriorFootprint, toleranceMeters)),
    )
    .map((block) => ({
      blockId: block.id,
      segmentId: block.segmentId,
      course: block.course,
      blockType: block.blockType,
    }));
}

function blockFootprintCorners(
  block: DesignGeometryBlockInstance,
  wallThicknessMeters: number,
): DesignGeometryPoint[] {
  const halfLength = block.lengthMeters / 2;
  const halfDepth = (block.depthMeters ?? wallThicknessMeters) / 2;
  const cos = Math.cos(block.rotationY);
  const sin = Math.sin(block.rotationY);
  const localPoints = [
    { x: -halfLength, z: -halfDepth },
    { x: halfLength, z: -halfDepth },
    { x: halfLength, z: halfDepth },
    { x: -halfLength, z: halfDepth },
  ];
  return localPoints.map((point) => ({
    x: block.x + point.x * cos - point.z * sin,
    z: block.z - point.x * sin + point.z * cos,
  }));
}

function pointInPolygonOrOnBoundary(
  point: DesignGeometryPoint,
  polygon: readonly DesignGeometryPoint[],
  toleranceMeters: number,
): boolean {
  if (polygon.some((start, index) => distancePointToSegment(point, start, polygon[(index + 1) % polygon.length]) <= toleranceMeters)) {
    return true;
  }
  let inside = false;
  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const current = polygon[index];
    const previous = polygon[previousIndex];
    const intersects =
      current.z > point.z !== previous.z > point.z &&
      point.x < ((previous.x - current.x) * (point.z - current.z)) / (previous.z - current.z) + current.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function distancePointToSegment(
  point: DesignGeometryPoint,
  start: DesignGeometryPoint,
  end: DesignGeometryPoint,
): number {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSq = dx * dx + dz * dz;
  if (lengthSq <= 0) return Math.hypot(point.x - start.x, point.z - start.z);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSq));
  return Math.hypot(point.x - (start.x + dx * t), point.z - (start.z + dz * t));
}

function courseCountFromHeight(heightMeters: number, moduleHeight: number): number {
  return Math.max(1, Math.ceil(Math.max(0, heightMeters) / Math.max(0.001, moduleHeight)));
}

function buildLayoutOpeningGroutSummary(params: {
  params: CmuWallSystemParameters;
  base: CmuOpeningGroutSummary;
  jambGroutCells: readonly CmuJambGroutCellInstance[];
  openingCourseClosures: readonly CmuOpeningCourseClosure[];
  moduleHeight: number;
}): CmuOpeningGroutSummary {
  const moduleConfig = resolveCmuModuleConfig(params.params);
  const wallThickness = Math.max(0, params.params.wallThicknessMeters);
  const fillFactor = Math.max(0, Math.min(1, params.params.coreFillFactor ?? 0.5));
  const wasteMultiplier = 1 + Math.max(0, params.params.groutWastePercent ?? 0.1);
  const cellCoreArea = moduleConfig.moduleLengthMeters * wallThickness * fillFactor;
  const jambGroutVolumeCubicMeters = params.jambGroutCells.reduce(
    (sum, cell) => sum + cellCoreArea * cell.heightMeters * wasteMultiplier,
    0,
  );
  const closureGroutVolumeCubicMeters = params.openingCourseClosures.reduce(
    (sum, closure) => sum + (closure.closureType === 'grout_fill' ? closure.groutVolume ?? 0 : 0),
    0,
  );
  const courseClosureCutBlockCount = params.openingCourseClosures.filter(
    (closure) => closure.closureType === 'cut_block',
  ).length;

  return {
    ...params.base,
    jambGroutCellCount: params.jambGroutCells.length,
    jambGroutVolumeCubicMeters,
    closureGroutVolumeCubicMeters,
    courseClosureCutBlockCount,
    totalGroutVolumeCubicMeters:
      jambGroutVolumeCubicMeters +
      closureGroutVolumeCubicMeters +
      params.base.lintelGroutVolumeCubicMeters +
      params.base.bondBeamGroutVolumeCubicMeters,
    warnings: [
      ...new Set([
        ...params.base.warnings,
        'Jamb grout volume is based on selected grouted cells and course closure conditions, not the full rough opening area.',
        ...params.openingCourseClosures.flatMap((closure) => (closure.warning ? [closure.warning] : [])),
      ]),
    ],
  };
}

function makeCourseUnit(
  unitType: CmuCourseUnit['unitType'],
  moduleStart: number,
  moduleSpan: number,
  actualLength: number,
  wallLength: number,
): CmuCourseUnit {
  const inset = Math.max(0, moduleSpan - actualLength) / 2;
  const startAlongMeters = moduleStart + inset;
  const endAlongMeters = Math.min(wallLength, moduleStart + moduleSpan - inset);
  return {
    unitType,
    nominalStartMeters: moduleStart,
    nominalLengthMeters: moduleSpan,
    startAlongMeters,
    endAlongMeters,
    lengthMeters: Math.max(0.02, endAlongMeters - startAlongMeters),
  };
}

function generateLintelInstances(
  params: CmuWallSystemParameters,
  moduleConfig: ReturnType<typeof resolveCmuModuleConfig>,
  openings: readonly ResolvedCmuOpening[],
): CmuLintelInstance[] {
  if ((params.lintelType ?? 'bond_beam') === 'none') return [];
  return openings
    .filter((opening) => opening.lintelType !== 'none')
    .map((opening) => {
    const wallFace = opening.wallFace ?? 'north';
    const wallLength = wallFace === 'north' || wallFace === 'south'
      ? params.lengthMeters
      : params.widthMeters;
    const length = Math.min(wallLength, opening.lintelLengthMeters);
    const along = (opening.roughStartAlongMeters + opening.roughEndAlongMeters) / 2;
    const centeredAlong = along - wallLength / 2;
    const lintelHeightMeters = moduleConfig.actualHeightMeters ?? Math.max(0.01, moduleConfig.moduleHeightMeters - moduleConfig.mortarJointMeters);
    const lintelCourseIndex = Math.max(0, Math.ceil(opening.roughTopMeters / moduleConfig.moduleHeightMeters));
    const y = lintelCourseIndex * moduleConfig.moduleHeightMeters + lintelHeightMeters / 2;
    const rotationY = wallFace === 'east' || wallFace === 'west' ? Math.PI / 2 : 0;
    const x = wallFace === 'east'
      ? params.lengthMeters / 2
      : wallFace === 'west'
        ? -params.lengthMeters / 2
        : centeredAlong;
    const z = wallFace === 'north'
      ? -params.widthMeters / 2
      : wallFace === 'south'
        ? params.widthMeters / 2
        : centeredAlong;
    return {
      id: `lintel-${opening.id}`,
      face: wallFace,
      openingId: opening.id,
      courseIndex: lintelCourseIndex,
      x,
      y,
      z,
      rotationY,
      lengthMeters: length,
      heightMeters: lintelHeightMeters,
      depthMeters: params.wallThicknessMeters,
      bearingLeftMeters: opening.lintelBearingMeters,
      bearingRightMeters: opening.lintelBearingMeters,
    };
  });
}

function generateJambGroutCellInstances(
  params: CmuWallSystemParameters,
  openings: readonly ResolvedCmuOpening[],
  courseCount: number,
): CmuJambGroutCellInstance[] {
  const moduleConfig = resolveCmuModuleConfig(params);
  const cellWidth = moduleConfig.moduleLengthMeters;
  const cellHeight = moduleConfig.moduleHeightMeters;
  const cells: CmuJambGroutCellInstance[] = [];

  openings.forEach((opening) => {
    if (!opening.jambGroutEnabled || opening.groutCellsEachSide <= 0) return;
    const wallFace = opening.wallFace ?? 'north';
    const wallLength = wallFace === 'north' || wallFace === 'south'
      ? params.lengthMeters
      : params.widthMeters;
    const rotationY = wallFace === 'east' || wallFace === 'west' ? Math.PI / 2 : 0;
    const sides = [
      { side: 'left', edge: opening.roughStartAlongMeters, direction: -1 },
      { side: 'right', edge: opening.roughEndAlongMeters, direction: 1 },
    ] as const;

    for (let course = 0; course < courseCount; course += 1) {
      const courseBottom = course * cellHeight;
      const courseTop = courseBottom + cellHeight;
      if (courseBottom >= opening.roughTopMeters || courseTop <= opening.roughBottomMeters) continue;
      const y = courseBottom + cellHeight / 2;
      sides.forEach((side) => {
        for (let index = 0; index < opening.groutCellsEachSide; index += 1) {
          const centerAlong = side.edge + side.direction * (index + 0.5) * cellWidth;
          if (centerAlong < 0 || centerAlong > wallLength) continue;
          const centeredAlong = centerAlong - wallLength / 2;
          const x = wallFace === 'east'
            ? params.lengthMeters / 2
            : wallFace === 'west'
              ? -params.lengthMeters / 2
              : centeredAlong;
          const z = wallFace === 'north'
            ? -params.widthMeters / 2
            : wallFace === 'south'
              ? params.widthMeters / 2
              : centeredAlong;

          cells.push({
            id: `jamb-grout-${opening.id}-${side.side}-${index}-course-${course}`,
            face: wallFace,
            openingId: opening.id,
            courseIndex: course,
            x,
            y,
            z,
            rotationY,
            heightMeters: cellHeight,
            widthMeters: cellWidth,
          });
        }
      });
    }
  });

  return cells;
}

function generatePilasterInstances(params: CmuWallSystemParameters): CmuPilasterInstance[] {
  if (!params.pilasterEnabled) return [];
  const positions: CmuPilasterInstance[] = [];
  const corners = [
    { id: 'north-west', x: -params.lengthMeters / 2, z: -params.widthMeters / 2, face: 'north' as const, rotationY: 0 },
    { id: 'north-east', x: params.lengthMeters / 2, z: -params.widthMeters / 2, face: 'north' as const, rotationY: 0 },
    { id: 'south-west', x: -params.lengthMeters / 2, z: params.widthMeters / 2, face: 'south' as const, rotationY: 0 },
    { id: 'south-east', x: params.lengthMeters / 2, z: params.widthMeters / 2, face: 'south' as const, rotationY: 0 },
  ];
  corners.forEach((corner) => {
    positions.push({
      id: `pilaster-${corner.id}`,
      face: corner.face,
      x: corner.x,
      y: params.heightMeters / 2,
      z: corner.z,
      rotationY: corner.rotationY,
      heightMeters: params.heightMeters,
    });
  });
  params.openings.forEach((opening) => {
    const wallFace = opening.wallFace ?? 'north';
    const offsetMeters = opening.offsetMeters ?? opening.positionAlongSegment ?? 0;
    const wallLength = wallFace === 'north' || wallFace === 'south' ? params.lengthMeters : params.widthMeters;
    [offsetMeters, offsetMeters + opening.widthMeters].forEach((along, index) => {
      const centeredAlong = along - wallLength / 2;
      const x = wallFace === 'east'
        ? params.lengthMeters / 2
        : wallFace === 'west'
          ? -params.lengthMeters / 2
          : centeredAlong;
      const z = wallFace === 'north'
        ? -params.widthMeters / 2
        : wallFace === 'south'
          ? params.widthMeters / 2
          : centeredAlong;
      positions.push({
        id: `pilaster-${opening.id}-${index}`,
        face: wallFace,
        x,
        y: params.heightMeters / 2,
        z,
        rotationY: wallFace === 'east' || wallFace === 'west' ? Math.PI / 2 : 0,
        heightMeters: params.heightMeters,
      });
    });
  });
  return positions;
}

function moduleFitWarnings(fits: ReturnType<typeof summarizeWallModuleFits>): string[] {
  return Object.entries(fits)
    .filter(([, fit]) => fit.fit === 'cut')
    .map(([face, fit]) => `${face} wall creates cut blocks. Suggested clean lengths: ${fit.suggestedLengthsMeters.join('m or ')}m.`);
}
