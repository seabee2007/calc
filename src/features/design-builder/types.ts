import type { PlumbingSelection } from './plumbing/plumbingTypes';

export type DesignUnitSystem = "metric" | "imperial";
export type DesignModelType = "cmu_building" | "frame_cmu_building";
export type DesignModelStatus = "draft" | "ready_for_estimate" | "committed";

export type BuildingSystemMode =
  "cmu_bearing_wall" | "reinforced_concrete_frame_with_cmu_infill";

/** Internal 2D component placement projection. */
export type BuilderViewMode = "plan" | "elevation";

/** User-facing Design Builder mode. */
export type DesignBuilderViewMode = "2d" | "3d";

export type Design2DViewType =
  | "foundation-plan"
  | "roof-plan"
  | "electrical-plan"
  | "plumbing-plan"
  | "elevation-view";

export type DesignBuilderStoredViewMode = DesignBuilderViewMode;

export function builderViewModeFromStored(
  stored: DesignBuilderStoredViewMode | string | undefined,
): DesignBuilderViewMode {
  return stored === "3d" ? "3d" : "2d";
}

export function storedViewModeFromBuilder(
  mode: DesignBuilderViewMode,
): DesignBuilderStoredViewMode {
  return mode;
}

export type DesignComponentDivision =
  | "Structure"
  | "Openings"
  | "Plumbing"
  | "Electrical"
  | "HVAC"
  | "Roofing"
  | "Finishes"
  | "Casework"
  | "Site Utilities";

export type DesignComponentCategory = "structure" | "openings" | "future";

export type DesignComponentType =
  | "column"
  | "footer"
  | "tie_beam"
  | "plinth_beam"
  | "slab"
  | "roof_beam"
  | "door"
  | "window";

export interface PlanPlacementData {
  xMeters: number;
  zMeters: number;
  rotationRadians?: number;
}

export type ElevationFace = "north" | "east" | "south" | "west";

export interface ElevationPlacementData {
  face: ElevationFace;
  xMeters: number;
  zMeters: number;
}

export interface WorldPlacementData {
  xMeters: number;
  yMeters: number;
  zMeters: number;
}

export interface DesignComponentViewPlacement {
  plan?: PlanPlacementData;
  elevation?: ElevationPlacementData;
  world?: WorldPlacementData;
}

export interface PlacedDesignComponent {
  id: string;
  type: DesignComponentType;
  division: DesignComponentDivision;
  category: DesignComponentCategory;
  viewPlacement: DesignComponentViewPlacement;
  parameters: Record<string, unknown>;
  derived: Record<string, unknown>;
  references?: {
    hostId?: string;
    connectedComponentIds?: string[];
    elevationFace?: string;
    gridlineId?: string;
  };
  metadata: {
    createdAt: string;
    updatedAt: string;
  };
}

export interface DesignPoint2D {
  x: number;
  z: number;
}

export type DesignDimensionKind = "horizontal" | "vertical" | "aligned";

export interface DesignDimensionAnnotation {
  id: string;
  type: "dimension";
  viewType: Design2DViewType;
  points: {
    start: DesignPoint2D;
    end: DesignPoint2D;
  };
  offsetPoint: DesignPoint2D;
  dimensionKind: DesignDimensionKind;
  measuredValue: number;
  unit: "m" | "ft" | "in";
  labelOverride?: string;
  references?: {
    startComponentId?: string;
    endComponentId?: string;
    startSnapType?: string;
    endSnapType?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface DesignAngleAnnotation {
  id: string;
  type: "angle";
  viewType: Design2DViewType;
  points: {
    start: DesignPoint2D;
    vertex: DesignPoint2D;
    end: DesignPoint2D;
  };
  measuredValueDegrees: number;
  labelOverride?: string;
  references?: {
    startSnapType?: string;
    vertexSnapType?: string;
    endSnapType?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export type DesignAnnotation = DesignDimensionAnnotation | DesignAngleAnnotation;

export interface DesignBuilderElevationViewState {
  face: ElevationFace;
  cursorX?: number;
  cursorZ?: number;
}

export const BUILDING_SYSTEM_MODE_LABELS: Record<BuildingSystemMode, string> = {
  cmu_bearing_wall: "CMU Bearing Wall",
  reinforced_concrete_frame_with_cmu_infill: "RC Frame + CMU Infill",
};

export type DesignObjectType =
  | "building_footprint"
  | "wall_layout"
  | "thickened_edge_slab"
  | "cmu_wall_system"
  | "structural_frame_system"
  | "cmu_infill_system"
  | "gable_end_system"
  | "door_opening"
  | "window_opening"
  | "gable_roof_system"
  | "steel_truss_system";

export type DesignQuantitySource = "parametric_design_builder";
export type DesignQuantityConfidence = "calculated_from_parameters";

export interface DesignModel {
  id: string;
  projectId: string;
  estimateId: string | null;
  name: string;
  unitSystem: DesignUnitSystem;
  modelType: DesignModelType;
  status: DesignModelStatus;
  createdBy: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DesignModelObject {
  id: string;
  designModelId: string;
  projectId: string;
  objectType: DesignObjectType;
  name: string;
  parentObjectId: string | null;
  parameters: DesignObjectParameters;
  quantitySummary: Record<string, unknown>;
  estimateMapping: Record<string, unknown>;
  geometryCache: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface DesignQuantityItem {
  id: string;
  designModelId: string;
  designObjectId: string;
  projectId: string;
  estimateId: string | null;
  estimateLineId: string | null;
  quantityType: string;
  description: string;
  quantity: number;
  unit: string;
  formula: string;
  source: DesignQuantitySource;
  confidence: DesignQuantityConfidence;
  parameterSnapshot: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface RectangleFootprintParameters {
  kind: "rectangle";
  lengthMeters: number;
  widthMeters: number;
}

export interface ThickenedEdgeSlabParameters {
  kind: "thickened_edge_slab";
  lengthMeters: number;
  widthMeters: number;
  slabThicknessMeters: number;
  edgeWidthMeters: number;
  edgeDepthMeters: number;
  edgeMode: "replaces_slab_at_perimeter" | "adds_below_slab";
}

export type DesignWallDimensionBasis =
  "outside_face" | "wall_centerline" | "inside_clear";
export type ModuleFitMode = "exact" | "snap_during_draw" | "resolve_after_draw";

export type FoundationSetout = {
  slabEdgeOffsetMeters: number;
  thickenedEdgeWidthMeters: number;
  thickenedEdgeDepthMeters: number;
  wallBearingOffsetMeters: number;
};

export type DesignWallCornerType =
  "outside" | "inside" | "end" | "tee" | "cross";

export type DesignWallBondStrategy =
  "interlock" | "butt" | "pilaster" | "control_joint";

export interface DesignWallNode {
  id: string;
  x: number;
  z: number;
}

export type DesignWallRole = "exterior" | "partition";

export interface DesignWallSegment {
  id: string;
  startNodeId: string;
  endNodeId: string;
  wallHeightMeters: number;
  wallThicknessMeters: number;
  wallRole?: DesignWallRole;
  cmuSystemId?: string;
  cornerStrategyOverride?: DesignWallBondStrategy;
}

export interface DesignWallCornerOverride {
  nodeId: string;
  bondStrategy: DesignWallBondStrategy;
}

export interface DesignWallLayoutParameters {
  kind: "wall_layout";
  dimensionBasis: DesignWallDimensionBasis;
  nodes: DesignWallNode[];
  segments: DesignWallSegment[];
  isFootprintClosed: boolean;
  defaultWallHeightMeters: number;
  defaultWallThicknessMeters: number;
  snapToGrid: boolean;
  snapToModule: boolean;
  gridSpacingMeters: number;
  orthogonalLock: boolean;
  cornerOverrides: DesignWallCornerOverride[];
}

export interface GeneratedWallCorner {
  id: string;
  nodeId: string;
  connectedWallSegmentIds: string[];
  cornerType: DesignWallCornerType;
  bondStrategy: DesignWallBondStrategy;
}

export interface WallOpeningParameters {
  id: string;
  type: "door" | "window";
  /** @deprecated Legacy face label; prefer wallSegmentId + positionAlongSegment */
  wallFace?: "north" | "east" | "south" | "west";
  /** @deprecated Legacy offset; prefer positionAlongSegment */
  offsetMeters?: number;
  wallSegmentId?: string;
  positionAlongSegment?: number;
  /** When true, positionAlongSegment stores opening center station on the host segment. */
  placementUsesCenterStation?: boolean;
  /** Actual door/window unit width. Rough opening is derived unless explicitly overridden. */
  widthMeters: number;
  /** Actual door/window unit height. Rough opening is derived unless explicitly overridden. */
  heightMeters: number;
  sillHeightMeters?: number;
  roughOpeningWidthMeters?: number;
  roughOpeningHeightMeters?: number;
  roughOpeningAllowanceMeters?: number;
  lintelType?: "bond_beam" | "precast_concrete" | "steel_placeholder" | "none";
  lintelBearingMeters?: number;
  lintelCourseCount?: number;
  jambGroutEnabled?: boolean;
  jambRebarEnabled?: boolean;
  groutCellsEachSide?: number;
  groutCellsAboveOpening?: number;
  groutCellsBelowWindow?: number;
  sillCondition?: "none" | "reinforced_sill" | "grouted_sill_course";
  openingFrameMaterial?:
    "hollow_metal" | "vinyl" | "wood" | "aluminum" | "none";
  /** Door plan/3D handing when hinge is viewed from increasing wall-station direction. */
  swingDirection?: "left" | "right";
  /** Door plan/3D swing relative to wall interior side. */
  swingType?: "inswing" | "outswing";
  notes?: string;
}

export type CmuUnitType =
  | "full"
  | "half"
  | "end"
  | "corner"
  | "jamb"
  | "bond_beam_lintel"
  | "cap"
  | "cut";

export interface CmuCoreGeometry {
  coreCount: number;
  coreLengthMeters: number;
  coreWidthMeters: number;
  coreHeightMeters: number;
  shellThicknessMeters: number;
  webThicknessMeters: number;
}

export interface CmuBlockModuleConfig {
  familyName: string;
  nominalLengthMeters: number;
  nominalHeightMeters: number;
  nominalDepthMeters: number;
  actualLengthMeters?: number;
  actualHeightMeters?: number;
  mortarJointMeters: number;
  moduleLengthMeters: number;
  moduleHeightMeters: number;
  availableUnitTypes: CmuUnitType[];
  cmuCoreGeometry?: CmuCoreGeometry;
}

export interface CmuWallSystemParameters {
  kind: "cmu_wall_system";
  lengthMeters: number;
  widthMeters: number;
  heightMeters: number;
  wallThicknessMeters: number;
  blockLengthMeters: number;
  blockHeightMeters: number;
  blockDepthMeters: number;
  mortarJointMeters: number;
  blockModule?: CmuBlockModuleConfig;
  snapToModule?: boolean;
  bondPattern?: "running_bond" | "stack_bond";
  cornerCondition?: "interlocked" | "butt";
  endCondition?: "return_corner" | "plain_end";
  lintelType?: "bond_beam" | "precast_concrete" | "none";
  lintelBearingMeters?: number;
  lintelCourseCount?: number;
  bondBeamEnabled?: boolean;
  lintelBondBeamEnabled?: boolean;
  coreFillFactor?: number;
  groutWastePercent?: number;
  jambCellsEachSide?: number;
  verticalReinforcementSpacingMeters?: number;
  groutedCellSpacingMeters?: number;
  pilasterEnabled?: boolean;
  wasteFactor: number;
  openings: WallOpeningParameters[];
  manualMasonryCourseRuns?: MasonryCourseRun[];
  manualMasonryCellOverrides?: MasonryCellOverride[];
  showIndividualBlocks: boolean;
}

export interface GableRoofSystemParameters {
  kind: "gable_roof_system";
  lengthMeters: number;
  widthMeters: number;
  pitchRisePerRun: number;
  overhangMeters: number;
  ridgeDirection: "length";
}

export interface SteelTrussSystemParameters {
  kind: "steel_truss_system";
  buildingLengthMeters: number;
  spacingMeters: number;
}

export type StructuralColumnKind = "rc_column" | "tie_column";

export interface StructuralColumn {
  id: string;
  name: string;
  kind: StructuralColumnKind;
  position: { x: number; z: number };
  widthMeters: number;
  depthMeters: number;
  heightMeters: number;
  baseElevationMeters: number;
  topElevationMeters: number;
  hostNodeId?: string;
  hostSegmentId?: string;
  reinforcement?: {
    enabled: boolean;
    notes?: string;
  };
  source: "user" | "auto_frame_layout";
}

export type StructuralBeamKind =
  | "grade_beam"
  | "ring_beam"
  | "plinth_beam"
  | "roof_beam"
  | "tie_beam"
  | "lintel_beam";

export interface StructuralBeam {
  id: string;
  name: string;
  kind: StructuralBeamKind;
  startColumnId?: string;
  endColumnId?: string;
  startPoint: { x: number; y: number; z: number };
  endPoint: { x: number; y: number; z: number };
  widthMeters: number;
  depthMeters: number;
  baseElevationMeters: number;
  topElevationMeters: number;
  hostSegmentId?: string;
  source: "user" | "auto_frame_layout";
}

export interface StructuralBeamSettings {
  enabled: boolean;
  widthMeters: number;
  depthMeters: number;
}

export interface PlinthBeamSettings extends StructuralBeamSettings {
  followsExteriorSegments: boolean;
  followsInteriorSegments: boolean;
}

export interface InteriorFloorSlabSettings {
  enabled: boolean;
  thicknessMeters: number;
}

export type FloorTileSizeKey =
  | "300x300"
  | "400x400"
  | "500x500"
  | "600x600"
  | "800x800"
  | "300x600"
  | "600x1200";

export type FloorGroutJointWidth = "none" | "1/16" | "1/8" | "3/16" | "1/4";

export interface InteriorFloorTileSettings {
  enabled: boolean;
  tileSizeKey: FloorTileSizeKey;
  groutJointWidth: FloorGroutJointWidth;
  thinsetThicknessMeters: number;
  wasteFactor: number;
}

export type FloorTilePlacementKind = "full" | "cut";

export interface FloorTilePlacement {
  id: string;
  kind: FloorTilePlacementKind;
  /** Grid center for the nominal tile module (includes grout pitch spacing). */
  center: { x: number; z: number };
  widthMeters: number;
  depthMeters: number;
  /** Clipped render bounds after floor polygon intersection (perimeter cuts). */
  renderCenter: { x: number; z: number };
  renderWidthMeters: number;
  renderDepthMeters: number;
  /** Exact clipped tile footprint after floor polygon intersection. */
  renderPolygon?: { x: number; z: number }[];
  installedAreaSquareMeters: number;
  rotationY: number;
}

export interface ResolvedFloorTileLayout {
  enabled: boolean;
  tileSizeKey: FloorTileSizeKey;
  tileWidthMeters: number;
  tileDepthMeters: number;
  groutJointMeters: number;
  thinsetThicknessMeters: number;
  wasteFactor: number;
  floorAreaSquareMeters: number;
  installedAreaSquareMeters: number;
  fullTileCount: number;
  cutTileCount: number;
  totalTileCount: number;
  orderTileCount: number;
  thinsetVolumeCubicMeters: number;
  thinsetBags: number;
  groutVolumeCubicMeters: number;
  groutBags: number;
  placements: FloorTilePlacement[];
}

export interface PlywoodCeilingSettings {
  enabled: boolean;
  /** Bottom elevation of the metal tube frame (meters above plinth top). */
  ceilingHeightMeters: number;
  plywoodColor: string;
  sheetWidthMeters: number;
  sheetLengthMeters: number;
  sheetThicknessMeters: number;
  braceSpacingMeters: number;
  tubeSizeMeters: number;
  staggerOffsetMeters: number;
  panelGapMeters: number;
  wasteFactor: number;
}

export type PlywoodCeilingMemberKind = "perimeter" | "cross_brace";

export interface PlywoodCeilingMemberPlacement {
  id: string;
  kind: PlywoodCeilingMemberKind;
  start: { x: number; y: number; z: number };
  end: { x: number; y: number; z: number };
  widthMeters: number;
  heightMeters: number;
}

export type PlywoodCeilingPanelKind = "full" | "cut";

export interface PlywoodCeilingPanelPlacement {
  id: string;
  kind: PlywoodCeilingPanelKind;
  center: { x: number; y: number; z: number };
  widthMeters: number;
  lengthMeters: number;
  thicknessMeters: number;
}

export interface ResolvedPlywoodCeilingLayout {
  enabled: boolean;
  ceilingHeightMeters: number;
  frameBottomElevationMeters: number;
  plywoodColor: string;
  sheetWidthMeters: number;
  sheetLengthMeters: number;
  sheetThicknessMeters: number;
  braceSpacingMeters: number;
  tubeSizeMeters: number;
  ceilingAreaSquareMeters: number;
  fullPanelCount: number;
  cutPanelCount: number;
  totalPanelCount: number;
  orderPanelCount: number;
  longAxis: "x" | "z";
  shortSpanMeters: number;
  longSpanMeters: number;
  warnings: string[];
  frameMembers: PlywoodCeilingMemberPlacement[];
  panelPlacements: PlywoodCeilingPanelPlacement[];
}

export type ColumnPlacementMode =
  | "corners_only"
  | "corners_and_junctions"
  | "corners_and_intermediate"
  | "manual";

/** @deprecated Legacy persisted shape — migrate via rcFrameFoundationMigration */
export interface GradeBeamSettings {
  enabled: boolean;
  widthMeters: number;
  depthMeters: number;
  followsExteriorSegments: boolean;
  followsInteriorSegments: boolean;
}

/** @deprecated Legacy persisted shape — migrate via rcFrameFoundationMigration */
export interface LegacyIsolatedFootingSettings {
  enabled: boolean;
  placementMode: "at_columns" | "manual";
  footingWidthMeters: number;
  footingLengthMeters: number;
  footingThicknessMeters: number;
  dropBelowGradeBeamMeters: number;
  autoCreateAtStructuralColumns: boolean;
}

/** @deprecated Legacy persisted shape — migrate via rcFrameFoundationMigration */
export interface LegacyStructuralFoundationSettings {
  gradeBeam: GradeBeamSettings;
  /** @deprecated Migrates to roofBeam */
  ringBeam?: StructuralBeamSettings;
  isolatedFootings: LegacyIsolatedFootingSettings;
}

export type IsolatedFootingSettings = LegacyIsolatedFootingSettings;

export interface RcFrameFoundationSettings {
  plinthBeam: PlinthBeamSettings;
  /** Cast-in-place floor slab between plinth beams; top flush with plinth top, thickness measured downward. */
  interiorFloorSlab: InteriorFloorSlabSettings;
  /** Interior floor tile finish (thinset + tile + grout) over the cast slab. */
  floorTileFinish: InteriorFloorTileSettings;
  /** Plywood ceiling with metal tube frame and staggered panels. */
  plywoodCeiling: PlywoodCeilingSettings;
  roofBeam: StructuralBeamSettings;
  tieBeam: StructuralBeamSettings;
  columns: {
    widthMeters: number;
    depthMeters: number;
    /** Vertical extent from top of plinth beam (Y=0) to top of column / roof beam top. */
    heightAbovePlinthMeters: number;
    placementMode: ColumnPlacementMode;
    intermediateSpacingMeters: number;
  };
  isolatedFootings: {
    enabled: boolean;
    widthMeters: number;
    lengthMeters: number;
    thicknessMeters: number;
    /** Vertical distance from bottom of plinth beam down to top of isolated footing. */
    dropBelowPlinthBeamMeters: number;
    autoCreateAtStructuralColumns: boolean;
  };
}

/** @deprecated Use RcFrameFoundationSettings */
export type StructuralFoundationSettings =
  LegacyStructuralFoundationSettings | RcFrameFoundationSettings;

export interface IsolatedFooting {
  id: string;
  name: string;
  columnId: string;
  position: { x: number; z: number };
  widthMeters: number;
  lengthMeters: number;
  thicknessMeters: number;
  topElevationMeters: number;
  bottomElevationMeters: number;
  centerElevationMeters: number;
  source: "auto_at_column" | "user";
}

export interface WallFooting {
  id: string;
  name: string;
  hostSegmentId: string;
  startPoint: { x: number; z: number };
  endPoint: { x: number; z: number };
  widthMeters: number;
  thicknessMeters: number;
  topElevationMeters: number;
  bottomElevationMeters: number;
  centerElevationMeters: number;
  source: "auto_partition_wall";
}

export type FoundationViewMode =
  "full_model" | "cutaway_below_grade" | "structural_frame_only";

export type DesignVisualStyle = "technical" | "material_preview";
export type Design2dDrawingStyleMode = "builder" | "architectural";

export type CmuInfillSupportType = "column" | "wall_end" | "opening_jamb";

export type CmuInfillBottomSupportType =
  "plinth_beam" | "grade_beam" | "slab" | "foundation" | "tie_beam";

export type CmuInfillTopSupportType =
  "roof_beam" | "ring_beam" | "roof_line" | "gable_profile" | "plinth_beam";

export type CmuInfillZone = "above_grade" | "below_grade";

export interface DesignMasonrySettings {
  blockModule?: CmuBlockModuleConfig;
  bondPattern: "running_bond" | "stack_bond";
  snapToModule: boolean;
  wasteFactor: number;
}

export interface CmuInfillPanel {
  id: string;
  hostSegmentId: string;
  /** Defaults to above_grade when omitted (legacy persisted designs). */
  infillZone?: CmuInfillZone;
  leftSupportType: CmuInfillSupportType;
  leftSupportId?: string;
  rightSupportType: CmuInfillSupportType;
  rightSupportId?: string;
  bottomSupportType: CmuInfillBottomSupportType;
  bottomSupportId?: string;
  topSupportType: CmuInfillTopSupportType;
  topSupportId?: string;
  startStationMeters: number;
  endStationMeters: number;
  bottomElevationMeters: number;
  topElevationMeters: number;
  masonrySettings: DesignMasonrySettings;
}

export type CmuInfillPlasterFinish = "smooth" | "textured";

export interface CmuInfillPlasterSettings {
  /** Exterior face plaster; legacy enabled/finish/profile fields map to this side. */
  enabled: boolean;
  finish: CmuInfillPlasterFinish;
  profileLabel: string;
  interiorEnabled: boolean;
  interiorFinish: CmuInfillPlasterFinish;
  interiorProfileLabel: string;
}

export interface GableEndSettings {
  kind: "gable_end";
  id: string;
  hostWallSegmentId: string;
  eaveElevationMeters: number;
  peakMode: "rise_above_eave" | "absolute_elevation";
  peakRiseMeters?: number;
  peakElevationMeters?: number;
  ridgePosition: "centered" | "custom";
  ridgeOffsetMeters?: number;
  roofToMasonryClearanceMeters: number;
  roofClearanceMeasurement: "perpendicular_to_roof_slope";
  bondPattern: "running_bond" | "stack_bond";
}

export type GableCmuPlacementKind = "stretcher" | "half_block" | "cut_block";

export interface GableCmuPlacement {
  id: string;
  panelId: string;
  courseIndex: number;
  kind: GableCmuPlacementKind;
  polygonProfile?: Array<{ x: number; y: number }>;
  volumeCubicMeters?: number;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  lengthMeters: number;
  heightMeters: number;
  depthMeters: number;
  source: "gable_panel_solver";
}

export type ModuleFitStatus =
  | "fully_modular"
  | "bond_modular"
  | "cut_required"
  | "opening_conflict"
  | "unresolved";

export interface ModuleFitCandidate {
  requestedDimensionMeters: number;
  candidateDimensionMeters: number;
  adjustmentMeters: number;
  status: ModuleFitStatus;
  fullBlockCount: number;
  halfBlockCount: number;
  cutBlockCount: number;
  explanation: string;
}

export interface StructuralFrameSystemParameters {
  kind: "structural_frame_system";
  buildingSystemMode: BuildingSystemMode;
  defaultColumnWidthMeters: number;
  defaultColumnDepthMeters: number;
  defaultGradeBeamWidthMeters: number;
  defaultGradeBeamDepthMeters: number;
  defaultRingBeamWidthMeters: number;
  defaultRingBeamDepthMeters: number;
  columns: StructuralColumn[];
  beams: StructuralBeam[];
}

export interface CmuInfillSystemParameters {
  kind: "cmu_infill_system";
  panels: CmuInfillPanel[];
  plaster?: CmuInfillPlasterSettings;
}

export interface GableEndSystemParameters {
  kind: "gable_end_system";
  gableEnds: GableEndSettings[];
}

export type RoofType = "hip" | "gable";

export type RoofRidgeDirection =
  "along_longest_axis" | "along_shortest_axis" | "along_selected_wall_pair";

export type RoofSupportSystem = "steel_trusses" | "steel_hip_framing";

/** @deprecated Use RoofSupportSystem */
export type RoofSupportStyle = "rafter_reference" | "truss_reference";

export interface RoofSystemSettings {
  enabled: boolean;
  roofType: RoofType;
  supportSystem: RoofSupportSystem;
  peakHeightAboveRoofBeamMeters: number;
  /** Side-eave overhang, perpendicular to ridge. */
  eaveOverhangMeters: number;
  /** Rake/gable-end overhang, parallel to ridge. */
  gableEndOverhangMeters: number;
  roofAssemblyThicknessMeters: number;
  ridgeDirection: RoofRidgeDirection;
  selectedRidgeWallSegmentId?: string;
  /** @deprecated Migrated to supportSystem */
  supportStyle?: RoofSupportStyle;
  steelTrusses: {
    enabled: boolean;
    maxSpacingMeters: number;
    hipInteriorTrussCount: number;
    profileLabel: string;
    webSteelAllowanceFactor: number;
    basePlateEnabled: boolean;
    basePlateWidthMeters: number;
    basePlateLengthMeters: number;
    basePlateThicknessMeters: number;
    anchorBoltsPerBearing: number;
  };
  purlins: {
    enabled: boolean;
    profileLabel: string;
    maxSpacingMeters: number;
  };
  corrugatedMetal: {
    enabled: boolean;
    sheetTypeLabel: string;
    wastePercent: number;
    ridgeCapEnabled: boolean;
    ridgeCapLapAllowancePercent: number;
  };
  fascia: {
    enabled: boolean;
    profileLabel: string;
    bottomExtensionBelowFrameMeters: number;
  };
  soffit: {
    enabled: boolean;
    profileLabel: string;
  };
  gable: {
    enabled: boolean;
    /** Minimum concrete depth between highest CMU corner and roof underside. */
    rakeClearanceMeters: number;
    rakedConcreteCapEnabled: boolean;
    /** @deprecated Use rakedConcreteCapEnabled */
    capEnabled?: boolean;
    capMaterial: "cast_in_place_concrete";
    /** Through-wall thickness of the raked cap (defaults to gable wall thickness). */
    rakedConcreteCapWallDepthMeters?: number;
    rakedConcreteCapDepthMeters: number;
    /** @deprecated Use rakedConcreteCapDepthMeters / rakedConcreteCapWallDepthMeters */
    capDepthMeters?: number;
    /** Vertical corrugated sheet on exterior of end trusses, roof beam to ridge. */
    closeInWithRoofingEnabled: boolean;
  };
}

/** Canonical alias for roof configuration */
export type RoofSettings = RoofSystemSettings;

export type RoofDisplayMode =
  | "full_roof"
  | "roof_cladding_only"
  | "steel_framing_only"
  | "gable_masonry_only"
  | "foundation_frame_roof";

export type PurlinPlacement = {
  id: string;
  slopePlaneId: string;
  rowIndex: number;
  start: RoofVec3;
  end: RoofVec3;
  /** Outward normal of the supporting roof slope (top flange faces this direction). */
  planeNormal: RoofVec3;
};

export type SteelMemberKind =
  | "top_chord_left"
  | "top_chord_right"
  | "top_chord_left_eave_extension"
  | "top_chord_right_eave_extension"
  | "bottom_chord"
  | "vertical_web"
  | "diagonal_web";

export type SteelMemberSegment = {
  id: string;
  memberKind: SteelMemberKind;
  start: RoofVec3;
  end: RoofVec3;
};

export type TrussPlacement = {
  id: string;
  stationMeters: number;
  /** Full structural bearing points on the roof-beam outer-face datum. */
  bearingLeft: RoofVec3;
  bearingRight: RoofVec3;
  /** Inboard plate centers; these do not shrink the structural truss span. */
  basePlateCenterLeft?: RoofVec3;
  basePlateCenterRight?: RoofVec3;
  apex: RoofVec3;
  /** World-axis classification of the ridge direction for this truss plane. */
  ridgeAxis: "x" | "z";
  planeNormal: RoofVec3;
  members: SteelMemberSegment[];
};

export type HipFramingMemberKind =
  | "ridge"
  | "hip"
  | "common"
  | "jack"
  | "hip_corner_support"
  | "hip_jack_bottom_chord"
  | "ridge_end_frame"
  | "ridge_end_frame_web"
  | "ridge_end_frame_bottom";

export type HipFramingMember = {
  id: string;
  start: RoofVec3;
  end: RoofVec3;
  memberKind: HipFramingMemberKind;
  lengthMeters: number;
  slopePlaneId?: string;
  source: "hip_roof_framing_solver";
};

export type RidgeCapPlacement = {
  id: string;
  start: RoofVec3;
  end: RoofVec3;
  widthMeters: number;
  thicknessMeters: number;
  roofAngleRadians: number;
  adjacentPlaneIds?: string[];
};

export type FasciaPlacement = {
  id: string;
  sourcePlaneId: string;
  edgeRole: "side_eave" | "gable_rake" | "hip_eave" | "roof_perimeter";
  topStart: RoofVec3;
  topEnd: RoofVec3;
  bottomStart: RoofVec3;
  bottomEnd: RoofVec3;
  outwardNormal: RoofVec3;
  faceOutwardNormal: RoofVec3;
  lengthMeters: number;
  faceDepthMeters: number;
};

export type SoffitPlacement = {
  id: string;
  edgeRole: "side_eave" | "gable_return" | "hip_eave" | "roof_perimeter";
  innerStart: RoofVec3;
  innerEnd: RoofVec3;
  outerEnd: RoofVec3;
  outerStart: RoofVec3;
  areaSquareMeters: number;
};

export type RoofLayerVisibility = {
  roofCladding: boolean;
  ridgeCap: boolean;
  fascia: boolean;
  soffit: boolean;
  steelTrusses: boolean;
  purlins: boolean;
  gableEndCmu: boolean;
  rakedConcreteCap: boolean;
};

export type DesignWarning = {
  code: string;
  message: string;
  severity: "review" | "error";
};

export type RoofVec3 = { x: number; y: number; z: number };

export type RoofPlane = {
  id: string;
  corners: RoofVec3[];
  normal: RoofVec3;
};

export type GableEndRoofingClosure = {
  id: string;
  hostWallSegmentId: string;
  /** Profile polygon on exterior truss face (CCW from outside). */
  corners: RoofVec3[];
  outwardNormal: RoofVec3;
  /** Horizontal axis used for the gable profile (the other plan axis is held constant). */
  profileSpanAxis: "x" | "z";
  areaSquareMeters: number;
};

export type GableCourseAssembly = {
  courseIndex: number;
  topElevationMeters: number;
  startStationMeters: number;
  endStationMeters: number;
};

export type RakedCapPlacement = {
  id: string;
  gableEndSegmentId: string;
  slope: "left" | "right";
  startStationMeters: number;
  endStationMeters: number;
  startBottomY: number;
  endBottomY: number;
  startTopY: number;
  endTopY: number;
  wallDepthMeters: number;
  centerlineInwardOffsetMeters?: number;
  concreteVolumeCubicMeters: number;
  source: "gable_raked_concrete_cap";
};

/** Canonical resolved raked concrete cap segment. */
export type ResolvedRakedConcreteCap = RakedCapPlacement;

export type ResolvedGableEnd = {
  hostSegmentId: string;
  leftRoofUnderside?: RoofPlane;
  rightRoofUnderside?: RoofPlane;
  masonryCourses: GableCourseAssembly[];
  rakedCapPlacements: RakedCapPlacement[];
  cmuUnitPlacements: import("../geometry/designGeometry").CmuBlockInstance[];
  warnings: DesignWarning[];
};

export type ExteriorRoofBeamBounds = {
  footprint: RoofVec3[];
  center: RoofVec3;
  widthMeters: number;
  depthMeters: number;
};

export type ResolvedRoofSystem = {
  supported: boolean;
  unsupportedMessage?: string;
  roofType: RoofType;
  roofBearingSource?: "roof_beam_outer_faces" | "wall_exterior_fallback";
  exteriorRoofBeamBounds: ExteriorRoofBeamBounds;
  /** Outer roof-beam bearing line (building exterior envelope). */
  structuralBearingPerimeter: RoofVec3[];
  /** Cladding outline: bearing perimeter + eave overhang. */
  claddingPerimeter: RoofVec3[];
  /** Visible sheet outline, including small corrugated-metal lap past the eave purlin. */
  roofSheetPerimeter: RoofVec3[];
  /** @deprecated Alias for claddingPerimeter — plan/3D eave outline. */
  eaveFootprint: RoofVec3[];
  /** Cladding ridge endpoints (includes gable-end overhang). */
  ridgeStart?: RoofVec3;
  ridgeEnd?: RoofVec3;
  structuralRidgeStart?: RoofVec3;
  structuralRidgeEnd?: RoofVec3;
  claddingRidgeStart?: RoofVec3;
  claddingRidgeEnd?: RoofVec3;
  structuralRidgeLengthMeters: number;
  claddingRidgeLengthMeters: number;
  gableEndOverhangMeters: number;
  ridgeCapPlacement: RidgeCapPlacement | null;
  ridgeCapPlacements: RidgeCapPlacement[];
  peakPoint?: RoofVec3;
  roofBeamTopElevationMeters: number;
  roofBeamTopY: number;
  peakElevationMeters: number;
  roofPeakY: number;
  roofAssemblyThicknessMeters: number;
  /** Structural slope reference — used by gable/raked-cap solvers (unchanged). */
  roofTopPlanes: RoofPlane[];
  /** Elevated cladding outer surface for 3D display when purlins are enabled. */
  claddingDisplayPlanes: RoofPlane[];
  roofUndersidePlanes: RoofPlane[];
  gableEndSegmentIds: string[];
  rafterRunMeters: number;
  rafterRiseMeters: number;
  rafterLengthMeters: number;
  /** Structural half-span run — pitch source of truth; unchanged by side eave overhang. */
  structuralRafterRunMeters: number;
  /** Horizontal half-span run including side eave overhang. */
  claddingRafterRunMeters: number;
  /** Slope length from cladding eave to ridge at fixed pitch. */
  claddingRafterLengthMeters: number;
  roofPitchRadians: number;
  roofRunMeters: number;
  roofRiseMeters: number;
  roofMemberReferenceLengthMeters: number;
  ridgeLengthMeters: number;
  roofSurfaceAreaSquareMeters: number;
  trussCount: number;
  actualTrussSpacingMeters: number;
  trussStations: number[];
  trussPlacements: TrussPlacement[];
  purlinRowsPerSlope: number;
  actualPurlinSpacingMeters: number;
  purlinPlacements: PurlinPlacement[];
  hipFramingMembers: HipFramingMember[];
  gableCmuAreaSquareMeters: number;
  rakedCapVolumeCubicMeters: number;
  gableEnds: ResolvedGableEnd[];
  gableEndRoofingClosures: GableEndRoofingClosure[];
  fasciaPlacements: FasciaPlacement[];
  soffitPlacements: SoffitPlacement[];
  warnings: DesignWarning[];
};

export type DesignObjectParameters =
  | RectangleFootprintParameters
  | ThickenedEdgeSlabParameters
  | CmuWallSystemParameters
  | DesignWallLayoutParameters
  | WallOpeningParameters
  | GableRoofSystemParameters
  | SteelTrussSystemParameters
  | StructuralFrameSystemParameters
  | CmuInfillSystemParameters
  | GableEndSystemParameters;

export interface CreateDesignModelInput {
  id?: string;
  projectId: string;
  estimateId?: string | null;
  name: string;
  unitSystem: DesignUnitSystem;
  modelType?: DesignModelType;
  status?: DesignModelStatus;
  createdBy: string;
  metadata?: Record<string, unknown>;
}

export interface UpsertDesignModelObjectInput {
  id?: string;
  designModelId: string;
  projectId: string;
  objectType: DesignObjectType;
  name: string;
  parentObjectId?: string | null;
  parameters: DesignObjectParameters;
  quantitySummary?: Record<string, unknown>;
  estimateMapping?: Record<string, unknown>;
  geometryCache?: Record<string, unknown> | null;
}

export interface CreateDesignQuantityItemInput {
  designModelId: string;
  designObjectId: string;
  projectId: string;
  estimateId?: string | null;
  estimateLineId?: string | null;
  quantityType: string;
  description: string;
  quantity: number;
  unit: string;
  formula: string;
  parameterSnapshot: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface DesignEstimatePreviewLine {
  id: string;
  designModelId: string;
  designObjectId: string;
  quantityType: string;
  description: string;
  quantity: number;
  unit: string;
  formula: string;
  parameterSnapshot: Record<string, unknown>;
  source: DesignQuantitySource;
  confidence: DesignQuantityConfidence;
  divisionCode: string;
  divisionName: string;
}

export interface DesignBuilderCameraSnapshot {
  position: [number, number, number];
  target: [number, number, number];
}

export type MasonryUnitType =
  | "full_block"
  | "half_block"
  | "end_block"
  | "jamb_block"
  | "bond_beam_block"
  | "grout_rebar_cell";

export type MasonryToolMode =
  | "select"
  | "full_block"
  | "half_block"
  | "end_block"
  | "jamb_block"
  | "bond_beam_block"
  | "grout_rebar_cell"
  | "erase";

export interface MasonryCourseRun {
  id: string;
  wallSegmentId: string;
  origin: { x: number; y: number; z: number };
  tangent: { x: number; z: number };
  courseIndex: number;
  startModuleIndex: number;
  unitType: MasonryUnitType;
  count: number;
  moduleLengthMeters: number;
  moduleHeightMeters: number;
  wallThicknessMeters: number;
  direction: "forward" | "reverse";
  source: "manual" | "manual_3d_brush";
  /** @deprecated Prefer origin.x */
  originX: number;
  /** @deprecated Prefer origin.z */
  originZ: number;
  orientation: "east" | "west" | "north" | "south";
}

export interface MasonryCellOverride {
  id: string;
  wallSegmentId: string;
  courseIndex: number;
  moduleIndex: number;
  action: "remove" | "replace" | "grout_cell";
  replacementUnitType?: MasonryCourseRun["unitType"];
}

export interface ManualMasonryPlacementPreview {
  originX: number;
  originZ: number;
  courseIndex: number;
  startModuleIndex: number;
  unitType: MasonryUnitType;
  count: number;
  orientation: "east" | "west" | "north" | "south";
  valid: boolean;
}

export type DesignBuilderToolMode =
  | "select"
  | "draw_wall"
  | "move_wall_node"
  | "place_door"
  | "place_window"
  | "place_component"
  | "place_dimension"
  | "place_angle"
  | "move_opening"
  | "delete";

export type DesignBuilderSnapMode = "grid" | "cmu_module" | "off";

export type DesignBuilderLayoutMode = "blank" | "editing" | "demo_loaded";

export type DesignBuilderSelection =
  | { kind: "wall_segment"; id: string }
  | { kind: "wall_node"; id: string }
  | { kind: "opening"; id: string }
  | { kind: "structural_column"; id: string }
  | { kind: "structural_beam"; id: string }
  | { kind: "cmu_infill_panel"; id: string }
  | { kind: "gable_end"; id: string }
  | { kind: "none" };

export type DesignBuilderInteractionKind =
  | "select_object"
  | "select_opening"
  | "clear_selection"
  | "select_node"
  | "select_segment"
  | "wall_pick"
  | "segment_pick"
  | "opening_move"
  | "component_preview"
  | "component_place"
  | "component_select"
  | "component_delete"
  | "component_move"
  | "select_plumbing"
  | "annotation_select"
  | "annotation_delete"
  | "place_commit"
  | "draw_point"
  | "draw_preview"
  | "move_node"
  | "cancel"
  | "undo_last_segment";

export interface DesignBuilderInteractionEvent {
  kind: DesignBuilderInteractionKind;
  toolMode: DesignBuilderToolMode;
  phase?: "preview" | "commit";
  wallFace?: NonNullable<WallOpeningParameters["wallFace"]>;
  offsetMeters?: number;
  wallSegmentId?: string;
  positionAlongSegment?: number;
  nodeId?: string;
  openingId?: string;
  openingType?: WallOpeningParameters["type"];
  componentType?: DesignComponentType;
  componentId?: string;
  annotationId?: string;
  objectType?: DesignObjectType;
  plumbingSelection?: PlumbingSelection;
  widthMeters?: number;
  heightMeters?: number;
  sillHeightMeters?: number;
  planX?: number;
  planZ?: number;
  hitPointX?: number;
  hitPointY?: number;
  hitPointZ?: number;
  shiftHeld?: boolean;
  altHeld?: boolean;
}

export type OpeningPlacementStatusKind =
  "clean" | "half_block" | "cut_block" | "invalid";

export interface OpeningPlacementStatus {
  kind: OpeningPlacementStatusKind;
  label: string;
  warnings: string[];
  isValid: boolean;
}

export interface OpeningPlacementValidation {
  isValid: boolean;
  warnings: string[];
}
