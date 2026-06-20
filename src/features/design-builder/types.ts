export type DesignUnitSystem = 'metric' | 'imperial';
export type DesignModelType = 'cmu_building';
export type DesignModelStatus = 'draft' | 'ready_for_estimate' | 'committed';

export type DesignObjectType =
  | 'building_footprint'
  | 'thickened_edge_slab'
  | 'cmu_wall_system'
  | 'door_opening'
  | 'window_opening'
  | 'gable_roof_system'
  | 'steel_truss_system';

export type DesignQuantitySource = 'parametric_design_builder';
export type DesignQuantityConfidence = 'calculated_from_parameters';

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
  kind: 'rectangle';
  lengthMeters: number;
  widthMeters: number;
}

export interface ThickenedEdgeSlabParameters {
  kind: 'thickened_edge_slab';
  lengthMeters: number;
  widthMeters: number;
  slabThicknessMeters: number;
  edgeWidthMeters: number;
  edgeDepthMeters: number;
  edgeMode: 'replaces_slab_at_perimeter' | 'adds_below_slab';
}

export type DesignWallDimensionBasis = 'outside_face' | 'wall_centerline' | 'inside_clear';
export type ModuleFitMode = 'exact' | 'snap_during_draw' | 'resolve_after_draw';

export type FoundationSetout = {
  slabEdgeOffsetMeters: number;
  thickenedEdgeWidthMeters: number;
  thickenedEdgeDepthMeters: number;
  wallBearingOffsetMeters: number;
};

export type DesignWallCornerType = 'outside' | 'inside' | 'end' | 'tee' | 'cross';

export type DesignWallBondStrategy = 'interlock' | 'butt' | 'pilaster' | 'control_joint';

export interface DesignWallNode {
  id: string;
  x: number;
  z: number;
}

export interface DesignWallSegment {
  id: string;
  startNodeId: string;
  endNodeId: string;
  wallHeightMeters: number;
  wallThicknessMeters: number;
  cmuSystemId?: string;
  cornerStrategyOverride?: DesignWallBondStrategy;
}

export interface DesignWallCornerOverride {
  nodeId: string;
  bondStrategy: DesignWallBondStrategy;
}

export interface DesignWallLayoutParameters {
  kind: 'wall_layout';
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
  type: 'door' | 'window';
  /** @deprecated Legacy face label; prefer wallSegmentId + positionAlongSegment */
  wallFace?: 'north' | 'east' | 'south' | 'west';
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
  lintelType?: 'bond_beam' | 'precast_concrete' | 'steel_placeholder' | 'none';
  lintelBearingMeters?: number;
  lintelCourseCount?: number;
  jambGroutEnabled?: boolean;
  jambRebarEnabled?: boolean;
  groutCellsEachSide?: number;
  groutCellsAboveOpening?: number;
  groutCellsBelowWindow?: number;
  sillCondition?: 'none' | 'reinforced_sill' | 'grouted_sill_course';
  openingFrameMaterial?: 'hollow_metal' | 'vinyl' | 'wood' | 'aluminum' | 'none';
  notes?: string;
}

export type CmuUnitType =
  | 'full'
  | 'half'
  | 'end'
  | 'corner'
  | 'jamb'
  | 'bond_beam_lintel'
  | 'cap'
  | 'cut';

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
  kind: 'cmu_wall_system';
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
  bondPattern?: 'running_bond' | 'stack_bond';
  cornerCondition?: 'interlocked' | 'butt';
  endCondition?: 'return_corner' | 'plain_end';
  lintelType?: 'bond_beam' | 'precast_concrete' | 'none';
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
  kind: 'gable_roof_system';
  lengthMeters: number;
  widthMeters: number;
  pitchRisePerRun: number;
  overhangMeters: number;
  ridgeDirection: 'length';
}

export interface SteelTrussSystemParameters {
  kind: 'steel_truss_system';
  buildingLengthMeters: number;
  spacingMeters: number;
}

export type DesignObjectParameters =
  | RectangleFootprintParameters
  | ThickenedEdgeSlabParameters
  | CmuWallSystemParameters
  | DesignWallLayoutParameters
  | WallOpeningParameters
  | GableRoofSystemParameters
  | SteelTrussSystemParameters;

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
  | 'full_block'
  | 'half_block'
  | 'end_block'
  | 'jamb_block'
  | 'bond_beam_block'
  | 'grout_rebar_cell';

export type MasonryToolMode =
  | 'select'
  | 'full_block'
  | 'half_block'
  | 'end_block'
  | 'jamb_block'
  | 'bond_beam_block'
  | 'grout_rebar_cell'
  | 'erase';

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
  direction: 'forward' | 'reverse';
  source: 'manual' | 'manual_3d_brush';
  /** @deprecated Prefer origin.x */
  originX: number;
  /** @deprecated Prefer origin.z */
  originZ: number;
  orientation: 'east' | 'west' | 'north' | 'south';
}

export interface MasonryCellOverride {
  id: string;
  wallSegmentId: string;
  courseIndex: number;
  moduleIndex: number;
  action: 'remove' | 'replace' | 'grout_cell';
  replacementUnitType?: MasonryCourseRun['unitType'];
}

export interface ManualMasonryPlacementPreview {
  originX: number;
  originZ: number;
  courseIndex: number;
  startModuleIndex: number;
  unitType: MasonryUnitType;
  count: number;
  orientation: 'east' | 'west' | 'north' | 'south';
  valid: boolean;
}

export type DesignBuilderToolMode =
  | 'select'
  | 'draw_wall'
  | 'move_wall_node'
  | 'place_door'
  | 'place_window'
  | 'move_opening'
  | 'delete';

export type DesignBuilderSnapMode = 'grid' | 'cmu_module' | 'off';

export type DesignBuilderLayoutMode = 'blank' | 'editing' | 'demo_loaded';

export type DesignBuilderSelection =
  | { kind: 'wall_segment'; id: string }
  | { kind: 'wall_node'; id: string }
  | { kind: 'opening'; id: string }
  | { kind: 'none' };

export type DesignBuilderInteractionKind =
  | 'select_object'
  | 'select_opening'
  | 'clear_selection'
  | 'select_node'
  | 'select_segment'
  | 'wall_pick'
  | 'segment_pick'
  | 'opening_move'
  | 'place_commit'
  | 'draw_point'
  | 'draw_preview'
  | 'move_node'
  | 'cancel'
  | 'undo_last_segment';

export interface DesignBuilderInteractionEvent {
  kind: DesignBuilderInteractionKind;
  toolMode: DesignBuilderToolMode;
  phase?: 'preview' | 'commit';
  wallFace?: NonNullable<WallOpeningParameters['wallFace']>;
  offsetMeters?: number;
  wallSegmentId?: string;
  positionAlongSegment?: number;
  nodeId?: string;
  openingId?: string;
  openingType?: WallOpeningParameters['type'];
  objectType?: DesignObjectType;
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
  | 'clean'
  | 'half_block'
  | 'cut_block'
  | 'invalid';

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
