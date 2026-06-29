import { useCallback, useEffect, useId, useMemo, useRef, useState, type PointerEvent } from 'react';
import type {
  DesignBuilderInteractionEvent,
  DesignBuilderSnapMode,
  DesignBuilderToolMode,
  Design2DViewType,
  DesignAngleAnnotation,
  DesignAnnotation,
  DesignDimensionAnnotation,
  Design2dDrawingStyleMode,
  DesignWallLayoutParameters,
  PlacedDesignComponent,
  ResolvedRoofSystem,
  RoofSystemSettings,
  StructuralBeam,
  StructuralColumn,
  WallFooting,
} from '../types';
import type { HelperMeasurement } from '../domain/designComponentPlacement';
import {
  buildDesignRenderModel,
  type DesignRenderModel,
  type DesignRenderRcComponent,
} from '../domain/designRenderModel';
import type { DesignSnapTarget } from '../domain/designSnapRules';
import { resolveSnap } from '../snapping/snapEngine';
import type { PlanPoint, SnapGeometry, SnapResult, SnapSettings } from '../snapping/snapTypes';
import type { SegmentFrame } from '../geometry/designGeometry';
import type { ResolvedOpeningPlacement } from '../domain/openingPlacementResolver';
import {
  buildPlanDisplayNodeById,
  buildPlanOpeningGeometry,
  buildPlanStripSnapPoints,
  buildSegmentFaceSnapPoints,
  buildSegmentPlanFootprint,
  buildWallRunsExcludingRoughOpenings,
  hitTestPlanOpeningGeometry,
  resolvePlanWallRunEndpoints,
  resolveSegmentDisplayEndpoints,
  type SegmentPlanFootprintEndpointAdjustments,
} from '../domain/planOpeningGraphics';
import {
  PlanOpeningSymbol,
  buildPlanOpeningRenderItem,
} from '../domain/planOpeningSymbols';
import {
  DEFAULT_PLAN_VIEWPORT,
  createPlanCameraController,
  type PlanViewportState,
} from '../domain/pointerPlanMapping';
import {
  MIN_CELL_PX,
  computePlanGridState,
  formatPlanGridSpacingMeters,
  projectCellWidthPx,
} from '../domain/planGridState';
import { fitPlanToLayout, logDesignFramingDiagnostics, resetPlanView, type DesignLayoutBounds } from '../domain/designLayoutBounds';
import { listOrthogonalGuideDirections, resolveDrawWallGuidance, type OrthogonalClosureAssist } from '../domain/wallLayoutRules';
import { resolveCmuModuleConfig } from '../domain/cmuModuleRules';
import { DESIGN_BUILDER_COPY } from '../domain/designBuilderCopy';
import { formatDrawWallStatusChip } from '../domain/designDrawWallFeedback';
import {
  renderDrawingPrimitive,
  resolve2dDrawingStyle,
  type DrawingPrimitive,
} from '../domain/design2dDrawingPrimitives';
import {
  DEFAULT_RIDGE_CAP_WIDTH_METERS,
  PURLIN_PROFILE_WIDTH_METERS,
  TRUSS_CHORD_PROFILE_METERS,
} from '../domain/roofFramingResolver';
import { resolveTrussDesignSummary } from '../domain/trussDesignCalculations';
import {
  TrussReferenceSheetDrawing,
  type TrussReferenceSheetPlacement,
} from './TrussReferenceSheetDrawing';
import {
  createCmuSepticTank,
  hitTestSepticTank,
  type PlumbingEquipment,
  type PlumbingFixture,
  type PlumbingFixtureType,
  type PlumbingRunDraft,
  type PlumbingSelection,
  type PlumbingSystem,
  type PlumbingToolMode,
  type PlumbingValidationIssue,
  type SepticTankModel,
} from '../plumbing';
import { DrawPlumbingPlan } from '../plumbing/canvas2d/drawPlumbingPlan';
import { hitTestPlumbingSystem } from '../plumbing/canvas2d/plumbingHitTesting';

const MIN_SEGMENT_LENGTH_METERS = 0.08;
const COLUMN_DRAG_THRESHOLD_PX = 4;
const FALLBACK_SURFACE_SIZE = { width: 900, height: 520 };
const PLAN_RULER_TICK_INTERVAL_METERS = 5;
const PLAN_RULER_TICK_MAX_METERS = 40;
const PLAN_RULER_TICKS_METERS = Array.from(
  { length: PLAN_RULER_TICK_MAX_METERS / PLAN_RULER_TICK_INTERVAL_METERS + 1 },
  (_, index) => index * PLAN_RULER_TICK_INTERVAL_METERS,
);

export type PlanOpeningCanvasItem = {
  openingId: string;
  openingType: 'door' | 'window';
  resolved: ResolvedOpeningPlacement;
  isValid: boolean;
  statusKind?: 'clean' | 'half_block' | 'cut_block' | 'invalid';
  swingDirection?: 'left' | 'right';
  swingType?: 'inswing' | 'outswing';
};

export type PlanOpeningCanvasPreview = {
  resolvedPlacement: ResolvedOpeningPlacement;
  openingType: 'door' | 'window';
  isValid: boolean;
  statusKind?: 'clean' | 'half_block' | 'cut_block' | 'invalid';
  swingDirection?: 'left' | 'right';
  swingType?: 'inswing' | 'outswing';
};

type ColumnDragState = {
  status: 'candidate' | 'dragging-column';
  pointerId: number;
  columnId: string;
  source: 'frame' | 'component';
  nodeId?: string;
  componentId?: string;
  originalPosition: { x: number; z: number };
  previewPosition: { x: number; z: number };
  widthMeters: number;
  depthMeters: number;
  footer?: {
    id: string;
    widthMeters: number;
    lengthMeters: number;
  };
  startPointer: { clientX: number; clientY: number };
};

type PlanColumnHit = {
  id: string;
  source: 'frame' | 'component';
  nodeId?: string;
  componentId?: string;
  position: { x: number; z: number };
  widthMeters: number;
  depthMeters: number;
  footer?: {
    id: string;
    widthMeters: number;
    lengthMeters: number;
  };
};

type PlanComponentHit = {
  id: string;
  sourceComponentId: string;
  type: DesignRenderRcComponent['type'];
  position: { x: number; z: number };
  widthMeters: number;
  depthMeters: number;
  lengthMeters?: number;
  footer?: {
    id: string;
    widthMeters: number;
    lengthMeters: number;
  };
};

type DimensionSnapPoint = {
  point: { x: number; z: number };
  type: string;
  componentId?: string;
  snapResult?: SnapResult;
};

type DimensionDraftState =
  | { step: 'start'; start: DimensionSnapPoint }
  | { step: 'offset'; start: DimensionSnapPoint; end: DimensionSnapPoint; offsetPoint: { x: number; z: number } };

type AngleDraftState =
  | { step: 'vertex'; start: DimensionSnapPoint }
  | { step: 'end'; start: DimensionSnapPoint; vertex: DimensionSnapPoint; previewEnd?: DimensionSnapPoint };

type RoofPlanDisplayOptions = {
  showHatch: boolean;
  showSlopeArrows: boolean;
  showDimensions: boolean;
  showReferenceLines: boolean;
  showTrussDesignDetail: boolean;
};

function planViewTitle(viewType: Design2DViewType): string {
  switch (viewType) {
    case 'roof-plan':
      return 'Roof Plan';
    case 'electrical-plan':
      return 'Electrical Plan';
    case 'plumbing-plan':
      return 'Plumbing Plan';
    case 'elevation-view':
      return 'Elevation View';
    case 'foundation-plan':
    default:
      return 'Foundation Plan';
  }
}

function roofPlanPerimeterPoints(roof: ResolvedRoofSystem | null): Array<{ x: number; z: number }> {
  if (!roof?.supported) return [];
  const source = roof.roofSheetPerimeter.length >= 3
    ? roof.roofSheetPerimeter
    : roof.claddingPerimeter.length >= 3
      ? roof.claddingPerimeter
      : roof.eaveFootprint;
  return source.map((point) => ({ x: point.x, z: point.z }));
}

type RoofShadowReferenceEdge = {
  id: string;
  start: { x: number; z: number };
  end: { x: number; z: number };
};

function planEdgeKey(start: { x: number; z: number }, end: { x: number; z: number }): string {
  const startKey = `${start.x.toFixed(4)}:${start.z.toFixed(4)}`;
  const endKey = `${end.x.toFixed(4)}:${end.z.toFixed(4)}`;
  return startKey <= endKey ? `${startKey}|${endKey}` : `${endKey}|${startKey}`;
}

function collectRoofShadowReferenceEdges(roof: ResolvedRoofSystem | null): RoofShadowReferenceEdge[] {
  if (!roof?.supported || roof.roofTopPlanes.length === 0) return [];
  const perimeter = roof.eaveFootprint.length >= 3 ? roof.eaveFootprint : roofPlanPerimeterPoints(roof);
  const perimeterEdgeKeys = new Set<string>();
  perimeter.forEach((point, index) => {
    const next = perimeter[(index + 1) % perimeter.length];
    if (!next) return;
    perimeterEdgeKeys.add(planEdgeKey(point, next));
  });

  const edges = new Map<string, RoofShadowReferenceEdge>();
  roof.roofTopPlanes.forEach((plane) => {
    plane.corners.forEach((corner, index) => {
      const next = plane.corners[(index + 1) % plane.corners.length];
      if (!next) return;
      if (Math.hypot(next.x - corner.x, next.z - corner.z) <= 0.001) return;
      const key = planEdgeKey(corner, next);
      if (perimeterEdgeKeys.has(key) || edges.has(key)) return;
      edges.set(key, {
        id: `${plane.id}-edge-${index}`,
        start: { x: corner.x, z: corner.z },
        end: { x: next.x, z: next.z },
      });
    });
  });

  return Array.from(edges.values());
}

function pointInPlanPolygon(point: { x: number; z: number }, polygon: Array<{ x: number; z: number }>): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const currentPoint = polygon[index]!;
    const previousPoint = polygon[previous]!;
    const crossesZ = currentPoint.z > point.z !== previousPoint.z > point.z;
    if (!crossesZ) continue;
    const crossingX = ((previousPoint.x - currentPoint.x) * (point.z - currentPoint.z)) / (previousPoint.z - currentPoint.z) + currentPoint.x;
    if (point.x < crossingX) inside = !inside;
  }
  return inside;
}

function distanceToPlanSegment(point: { x: number; z: number }, start: { x: number; z: number }, end: { x: number; z: number }): number {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared <= 0.000001) return Math.hypot(point.x - start.x, point.z - start.z);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared));
  const projected = {
    x: start.x + dx * t,
    z: start.z + dz * t,
  };
  return Math.hypot(point.x - projected.x, point.z - projected.z);
}

function resolveDimensionPlanGeometry(annotation: DesignDimensionAnnotation): {
  start: { x: number; z: number };
  end: { x: number; z: number };
  dimensionStart: { x: number; z: number };
  dimensionEnd: { x: number; z: number };
} | null {
  const start = annotation.points.start;
  const end = annotation.points.end;
  const offset = annotation.offsetPoint;
  let dimensionStart = { ...start };
  let dimensionEnd = { ...end };
  if (annotation.dimensionKind === 'horizontal') {
    dimensionStart = { x: start.x, z: offset.z };
    dimensionEnd = { x: end.x, z: offset.z };
  } else if (annotation.dimensionKind === 'vertical') {
    dimensionStart = { x: offset.x, z: start.z };
    dimensionEnd = { x: offset.x, z: end.z };
  } else {
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const length = Math.hypot(dx, dz);
    if (length <= 0.000001) return null;
    const normal = { x: -dz / length, z: dx / length };
    const midpoint = { x: (start.x + end.x) / 2, z: (start.z + end.z) / 2 };
    const offsetDistance = (offset.x - midpoint.x) * normal.x + (offset.z - midpoint.z) * normal.z;
    dimensionStart = { x: start.x + normal.x * offsetDistance, z: start.z + normal.z * offsetDistance };
    dimensionEnd = { x: end.x + normal.x * offsetDistance, z: end.z + normal.z * offsetDistance };
  }
  return { start, end, dimensionStart, dimensionEnd };
}

function roofPitchLabel(roof: ResolvedRoofSystem): string | null {
  if (!Number.isFinite(roof.roofRunMeters) || !Number.isFinite(roof.roofRiseMeters) || roof.roofRunMeters <= 0) return null;
  const risePer12 = (roof.roofRiseMeters / roof.roofRunMeters) * 12;
  if (!Number.isFinite(risePer12) || risePer12 <= 0) return null;
  return `${risePer12.toFixed(1)}:12`;
}

type RoofPlanBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  centerX: number;
  centerZ: number;
};

function resolveTrussReferenceSheetPlacement(params: {
  roofPlanBounds: RoofPlanBounds;
  summary: NonNullable<ReturnType<typeof resolveTrussDesignSummary>>;
}): TrussReferenceSheetPlacement {
  const roofWidthMeters = Math.max(
    params.roofPlanBounds.maxX - params.roofPlanBounds.minX,
    params.roofPlanBounds.maxZ - params.roofPlanBounds.minZ,
  );
  const representativeSpanMeters = params.summary.geometry?.spanMeters ?? roofWidthMeters;
  const sheetWidthMeters = Math.max(roofWidthMeters * 2, representativeSpanMeters * 1.8, 14);
  const sheetHeightMeters = Math.max(sheetWidthMeters * 0.42, 7);
  const gapMeters = 10;
  const outerPaddingMeters = 0.28;
  const headerHeightMeters = 0.82;
  const panelGapMeters = 0.24;
  const contentX = outerPaddingMeters;
  const contentY = headerHeightMeters + 0.12;
  const contentWidth = sheetWidthMeters - outerPaddingMeters * 2;
  const contentHeight = sheetHeightMeters - contentY - outerPaddingMeters;
  const trussPanelWidth = Math.max(6.5, contentWidth * 0.6);
  const notesPanelWidth = Math.max(4.2, contentWidth - trussPanelWidth - panelGapMeters);

  return {
    origin: {
      x: params.roofPlanBounds.maxX + gapMeters,
      z: params.roofPlanBounds.maxZ,
    },
    widthMeters: sheetWidthMeters,
    heightMeters: sheetHeightMeters,
    trussPanel: {
      x: contentX,
      y: contentY,
      width: trussPanelWidth,
      height: contentHeight,
    },
    notesPanel: {
      x: contentX + trussPanelWidth + panelGapMeters,
      y: contentY,
      width: notesPanelWidth,
      height: contentHeight,
    },
  };
}

type PartitionWallFootprintSegmentRef = {
  segment: DesignWallLayoutParameters['segments'][number];
  index: number;
};

function directionFromNodeForPartitionSegment(
  segment: DesignWallLayoutParameters['segments'][number],
  nodeId: string,
  nodesById: ReadonlyMap<string, { x: number; z: number }>,
): { x: number; z: number } | null {
  const start = nodesById.get(segment.startNodeId);
  const end = nodesById.get(segment.endNodeId);
  if (!start || !end) return null;
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const length = Math.hypot(dx, dz);
  if (length <= 0.001) return null;
  return segment.startNodeId === nodeId
    ? { x: dx / length, z: dz / length }
    : { x: -dx / length, z: -dz / length };
}

function isStraightThroughPartitionWallJoint(params: {
  refs: readonly PartitionWallFootprintSegmentRef[];
  nodeId: string;
  nodesById: ReadonlyMap<string, { x: number; z: number }>;
}): boolean {
  if (params.refs.length !== 2) return false;
  const directions = params.refs
    .map((ref) => directionFromNodeForPartitionSegment(ref.segment, params.nodeId, params.nodesById))
    .filter((direction): direction is { x: number; z: number } => direction != null);
  if (directions.length !== 2) return false;
  const dot = directions[0]!.x * directions[1]!.x + directions[0]!.z * directions[1]!.z;
  return dot < -0.95;
}

function resolvePartitionWallFootprintEndpointAdjustments(params: {
  layout: DesignWallLayoutParameters;
  framesBySegmentId: ReadonlyMap<string, SegmentFrame>;
}): Map<string, SegmentPlanFootprintEndpointAdjustments> {
  const adjustments = new Map<string, SegmentPlanFootprintEndpointAdjustments>();
  const nodesById = new Map(params.layout.nodes.map((node) => [node.id, { x: node.x, z: node.z }]));
  const refsByNodeId = new Map<string, PartitionWallFootprintSegmentRef[]>();

  params.layout.segments.forEach((segment, index) => {
    if (segment.wallRole !== 'partition' || !params.framesBySegmentId.has(segment.id)) return;
    const ref = { segment, index };
    refsByNodeId.set(segment.startNodeId, [...(refsByNodeId.get(segment.startNodeId) ?? []), ref]);
    refsByNodeId.set(segment.endNodeId, [...(refsByNodeId.get(segment.endNodeId) ?? []), ref]);
  });

  refsByNodeId.forEach((refs, nodeId) => {
    if (refs.length < 2) return;
    if (isStraightThroughPartitionWallJoint({ refs, nodeId, nodesById })) return;

    const orderedRefs = [...refs].sort((a, b) => a.index - b.index);
    const owner =
      orderedRefs.find((ref) => ref.segment.endNodeId === nodeId) ??
      orderedRefs[0];
    if (!owner) return;

    orderedRefs.forEach((ref) => {
      const frame = params.framesBySegmentId.get(ref.segment.id);
      const halfWallThickness = Math.max(0, (frame?.wallThicknessMeters ?? 0) / 2);
      if (halfWallThickness <= 0) return;
      const current = adjustments.get(ref.segment.id) ?? {};
      const ownsJoint = ref.segment.id === owner.segment.id;
      if (ref.segment.startNodeId === nodeId) {
        current.startMeters = ownsJoint ? -halfWallThickness : halfWallThickness;
      } else {
        current.endMeters = ownsJoint ? halfWallThickness : -halfWallThickness;
      }
      adjustments.set(ref.segment.id, current);
    });
  });

  return adjustments;
}

interface DesignBuilderPlanCanvasProps {
  layout: DesignWallLayoutParameters;
  toolMode: DesignBuilderToolMode;
  snapSpacingMeters?: number;
  snapMode?: DesignBuilderSnapMode;
  viewport?: PlanViewportState;
  layoutBounds?: DesignLayoutBounds | null;
  viewCommand?: { id: number; action: 'fit' | 'reset' | 'grid_scale'; spacingMeters?: number } | null;
  onViewportChange?: (viewport: PlanViewportState) => void;
  onUserViewportChange?: () => void;
  draftEnd?: { x: number; z: number } | null;
  activeNodeId?: string | null;
  drawStartNodeId?: string | null;
  selectedSegmentId?: string | null;
  selectedNodeId?: string | null;
  selectedOpeningId?: string | null;
  selectedComponentId?: string | null;
  segmentFrames?: readonly SegmentFrame[];
  openingItems?: readonly PlanOpeningCanvasItem[];
  openingPreview?: PlanOpeningCanvasPreview | null;
  snapTarget?: DesignSnapTarget | null;
  snapSettings?: SnapSettings;
  snapCycleIndex?: number;
  horizontalSnapLock?: boolean;
  verticalSnapLock?: boolean;
  shiftConstraintLabel?: string | null;
  previewMetrics?: { lengthMeters: number; angleDegrees: number } | null;
  orthogonalClosureAssist?: OrthogonalClosureAssist | null;
  closureCornerSnap?: { point: { x: number; z: number }; captured: boolean } | null;
  frameSystem?: import('../types').StructuralFrameSystemParameters;
  isolatedFootings?: readonly import('../types').IsolatedFooting[];
  wallFootings?: readonly WallFooting[];
  resolvedRoofSystem?: ResolvedRoofSystem | null;
  roofSystem?: RoofSystemSettings;
  roofPlanDisplay?: RoofPlanDisplayOptions;
  selectedObjectType?: import('../types').DesignObjectType | null;
  selectedAnnotationId?: string | null;
  drawingStyleMode?: Design2dDrawingStyleMode;
  active2DView?: Design2DViewType;
  annotations?: readonly DesignAnnotation[];
  placedComponents?: readonly PlacedDesignComponent[];
  componentPreview?: PlacedDesignComponent | null;
  plumbingSystem?: PlumbingSystem;
  activePlumbingFixtureType?: PlumbingFixtureType | null;
  plumbingEquipmentPreview?: PlumbingEquipment | null;
  activePlumbingToolMode?: PlumbingToolMode;
  plumbingFixtureRotationRad?: number;
  plumbingRunDraft?: PlumbingRunDraft | null;
  selectedPlumbingObject?: PlumbingSelection | null;
  plumbingValidationIssues?: readonly PlumbingValidationIssue[];
  septicTankPlacementActive?: boolean;
  septicTankPlacementRotationRad?: number;
  selectedSepticTankId?: string | null;
  designRenderModel?: DesignRenderModel;
  helperMeasurements?: readonly HelperMeasurement[];
  onComponentPointer?: (event: { phase: 'preview' | 'commit'; xMeters: number; zMeters: number }) => void;
  onPlumbingFixturePointer?: (event: { phase: 'preview' | 'commit'; xMeters: number; zMeters: number; rotationRad?: number }) => void;
  onPlumbingPlanPointer?: (event: { phase: 'preview' | 'commit'; xMeters: number; zMeters: number; shiftHeld?: boolean }) => void;
  onPlumbingSelect?: (selection: PlumbingSelection) => void;
  onSepticTankPointer?: (event: { phase: 'preview' | 'commit'; xMeters: number; zMeters: number; rotationRad: number }) => void;
  onSepticTankSelect?: (tankId: string) => void;
  onAnnotationCreate?: (annotation: DesignAnnotation) => void;
  onInteraction: (event: DesignBuilderInteractionEvent) => void;
}

export default function DesignBuilderPlanCanvas({
  layout,
  toolMode,
  snapSpacingMeters,
  snapMode = 'grid',
  viewport = DEFAULT_PLAN_VIEWPORT,
  layoutBounds = null,
  viewCommand = null,
  onViewportChange,
  onUserViewportChange,
  draftEnd = null,
  activeNodeId = null,
  drawStartNodeId = null,
  selectedSegmentId = null,
  selectedNodeId = null,
  selectedOpeningId = null,
  selectedComponentId = null,
  segmentFrames = [],
  openingItems = [],
  openingPreview = null,
  snapTarget = null,
  snapSettings,
  snapCycleIndex = 0,
  horizontalSnapLock = false,
  verticalSnapLock = false,
  shiftConstraintLabel = null,
  previewMetrics = null,
  orthogonalClosureAssist = null,
  closureCornerSnap = null,
  frameSystem,
  isolatedFootings = [],
  wallFootings = [],
  resolvedRoofSystem = null,
  roofSystem,
  roofPlanDisplay = {
    showHatch: true,
    showSlopeArrows: true,
    showDimensions: true,
    showReferenceLines: true,
    showTrussDesignDetail: true,
  },
  selectedObjectType = null,
  selectedAnnotationId = null,
  drawingStyleMode = 'architectural',
  active2DView = 'foundation-plan',
  annotations = [],
  placedComponents = [],
  componentPreview = null,
  plumbingSystem,
  activePlumbingFixtureType = null,
  plumbingEquipmentPreview = null,
  activePlumbingToolMode = 'select',
  plumbingFixtureRotationRad = 0,
  plumbingRunDraft = null,
  selectedPlumbingObject = null,
  plumbingValidationIssues = [],
  septicTankPlacementActive = false,
  septicTankPlacementRotationRad = 0,
  designRenderModel,
  helperMeasurements = [],
  onComponentPointer,
  onPlumbingFixturePointer,
  onPlumbingPlanPointer,
  onPlumbingSelect,
  onSepticTankPointer,
  onSepticTankSelect,
  onAnnotationCreate,
  onInteraction,
}: DesignBuilderPlanCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const panDragRef = useRef<{ x: number; y: number } | null>(null);
  const componentPointerIdRef = useRef<number | null>(null);
  const columnDragStateRef = useRef<ColumnDragState | null>(null);
  const spaceHeldRef = useRef(false);
  const lastViewCommandIdRef = useRef<number | null>(null);
  const [surfaceSize, setSurfaceSize] = useState(FALLBACK_SURFACE_SIZE);
  const [hoveredOpeningId, setHoveredOpeningId] = useState<string | null>(null);
  const [cursorPoint, setCursorPoint] = useState<{ x: number; z: number } | null>(null);
  const [columnDragState, setColumnDragStateSnapshot] = useState<ColumnDragState | null>(null);
  const [dimensionDraft, setDimensionDraft] = useState<DimensionDraftState | null>(null);
  const [angleDraft, setAngleDraft] = useState<AngleDraftState | null>(null);
  const [dimensionSnap, setDimensionSnap] = useState<DimensionSnapPoint | null>(null);
  const roofClipReactId = useId();
  const roofClipId = `roof-plan-clip-${roofClipReactId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const drawingStyle = useMemo(() => resolve2dDrawingStyle(drawingStyleMode), [drawingStyleMode]);
  const architecturalDrawing = drawingStyleMode === 'architectural';
  const sheetBackerFill = architecturalDrawing ? drawingStyle.sheetFill : drawingStyle.viewportFill;
  const viewportBackerFill = drawingStyle.viewportFill;
  const referenceStroke = drawingStyle.referenceStroke;
  const permanentStroke = drawingStyle.lineStroke;
  const mutedStroke = drawingStyle.mutedStroke;
  const concreteFill = drawingStyle.concreteFill;
  const structuralFill = drawingStyle.structuralFill;
  const selectionStroke = drawingStyle.selectionStroke;
  const previewStroke = drawingStyle.previewStroke;
  const previewFill = drawingStyle.previewFill;
  const textBackerStroke = architecturalDrawing ? drawingStyle.sheetFill : '#0f172a';
  const isRoofPlanView = active2DView === 'roof-plan';
  const isPlumbingPlanView = active2DView === 'plumbing-plan';
  const showStructuralPlanGeometry = active2DView === 'foundation-plan';
  const showRoofTrussReferenceSheet =
    isRoofPlanView &&
    roofPlanDisplay.showTrussDesignDetail &&
    resolvedRoofSystem?.supported === true;
  const roofPlanPerimeter = useMemo(() => roofPlanPerimeterPoints(resolvedRoofSystem), [resolvedRoofSystem]);
  const roofPlanBounds = useMemo(() => {
    if (roofPlanPerimeter.length === 0) return null;
    const xs = roofPlanPerimeter.map((point) => point.x);
    const zs = roofPlanPerimeter.map((point) => point.z);
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minZ: Math.min(...zs),
      maxZ: Math.max(...zs),
      centerX: (Math.min(...xs) + Math.max(...xs)) / 2,
      centerZ: (Math.min(...zs) + Math.max(...zs)) / 2,
    };
  }, [roofPlanPerimeter]);
  const trussDesignSummary = useMemo(() => {
    if (!showRoofTrussReferenceSheet || !resolvedRoofSystem?.supported) return null;
    return resolveTrussDesignSummary({
      roof: resolvedRoofSystem,
      roofSettings: roofSystem,
    });
  }, [resolvedRoofSystem, roofSystem, showRoofTrussReferenceSheet]);
  const trussReferenceSheetPlacement = useMemo(() => {
    if (!trussDesignSummary || !roofPlanBounds) return null;
    return resolveTrussReferenceSheetPlacement({
      roofPlanBounds,
      summary: trussDesignSummary,
    });
  }, [roofPlanBounds, trussDesignSummary]);
  const roofShadowReferenceEdges = useMemo(
    () => collectRoofShadowReferenceEdges(resolvedRoofSystem),
    [resolvedRoofSystem],
  );

  const setColumnDragState = useCallback((next: ColumnDragState | null) => {
    columnDragStateRef.current = next;
    setColumnDragStateSnapshot(next);
  }, []);

  const framesBySegmentId = useMemo(
    () => new Map(segmentFrames.map((frame) => [frame.segmentId, frame])),
    [segmentFrames],
  );

  const partitionWallFootprintEndpointAdjustmentsBySegmentId = useMemo(
    () => resolvePartitionWallFootprintEndpointAdjustments({ layout, framesBySegmentId }),
    [framesBySegmentId, layout],
  );

  const foundationPlanBeams = useMemo(
    () => (frameSystem?.beams ?? []).filter((beam) => beam.kind === 'plinth_beam' || beam.kind === 'grade_beam'),
    [frameSystem?.beams],
  );

  const planDisplayNodeById = useMemo(
    () => buildPlanDisplayNodeById({ layout, framesBySegmentId }),
    [framesBySegmentId, layout],
  );
  const roughOpeningsBySegmentId = useMemo(() => {
    const bySegment = new Map<string, { roughOpeningStartMeters: number; roughOpeningEndMeters: number }[]>();
    openingItems.forEach((item) => {
      const list = bySegment.get(item.resolved.hostSegmentId) ?? [];
      list.push({
        roughOpeningStartMeters: item.resolved.roughOpeningStartMeters,
        roughOpeningEndMeters: item.resolved.roughOpeningEndMeters,
      });
      bySegment.set(item.resolved.hostSegmentId, list);
    });
    if (openingPreview?.resolvedPlacement) {
      const preview = openingPreview.resolvedPlacement;
      const list = bySegment.get(preview.hostSegmentId) ?? [];
      const alreadyListed = list.some(
        (gap) =>
          Math.abs(gap.roughOpeningStartMeters - preview.roughOpeningStartMeters) < 0.001 &&
          Math.abs(gap.roughOpeningEndMeters - preview.roughOpeningEndMeters) < 0.001,
      );
      if (!alreadyListed) {
        list.push({
          roughOpeningStartMeters: preview.roughOpeningStartMeters,
          roughOpeningEndMeters: preview.roughOpeningEndMeters,
        });
      }
      bySegment.set(preview.hostSegmentId, list);
    }
    return bySegment;
  }, [openingItems, openingPreview]);

  const openingRenderItems = useMemo(
    () =>
      openingItems.map((item) => {
        const frame = framesBySegmentId.get(item.resolved.hostSegmentId);
        if (!frame) return null;
        return buildPlanOpeningRenderItem({
          key: item.openingId,
          openingType: item.openingType,
          resolved: item.resolved,
          frame,
          isValid: item.isValid,
          statusKind: item.statusKind,
          selected: selectedOpeningId === item.openingId,
          hovered: hoveredOpeningId === item.openingId,
          placing: false,
          zoom: viewport.zoom,
          swingDirection: item.swingDirection,
          swingType: item.swingType,
        });
      }).filter((item): item is NonNullable<typeof item> => item != null),
    [framesBySegmentId, hoveredOpeningId, openingItems, selectedOpeningId, viewport.zoom],
  );

  const previewRenderItem = useMemo(() => {
    if (!openingPreview) return null;
    const frame = framesBySegmentId.get(openingPreview.resolvedPlacement.hostSegmentId);
    if (!frame) return null;
    return buildPlanOpeningRenderItem({
      key: 'placement-preview',
      openingType: openingPreview.openingType,
      resolved: openingPreview.resolvedPlacement,
      frame,
      isValid: openingPreview.isValid,
      statusKind: openingPreview.statusKind,
      selected: false,
      hovered: false,
      placing: true,
      zoom: viewport.zoom,
      swingDirection: openingPreview.swingDirection,
      swingType: openingPreview.swingType,
    });
  }, [framesBySegmentId, openingPreview, viewport.zoom]);

  const emitSegmentPick = useCallback(
    (phase: 'preview' | 'commit', point: { x: number; z: number }) => {
      onInteraction({
        kind: 'segment_pick',
        toolMode,
        phase,
        planX: point.x,
        planZ: point.z,
      });
    },
    [onInteraction, toolMode],
  );

  const updateHoveredOpening = useCallback(
    (point: { x: number; z: number } | null) => {
      if (!point || openingItems.length === 0) {
        setHoveredOpeningId(null);
        return;
      }
      let bestId: string | null = null;
      let bestDistance = Number.POSITIVE_INFINITY;
      openingItems.forEach((item) => {
        const frame = framesBySegmentId.get(item.resolved.hostSegmentId);
        if (!frame) return;
        const geometry = buildPlanOpeningGeometry(item.resolved, frame);
        if (!hitTestPlanOpeningGeometry({ planX: point.x, planZ: point.z, geometry })) return;
        const distance = Math.hypot(point.x - geometry.center.x, point.z - geometry.center.z);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestId = item.openingId;
        }
      });
      setHoveredOpeningId(bestId);
    },
    [framesBySegmentId, openingItems],
  );

  const contentBounds = useMemo(() => {
    if (layoutBounds) {
      return {
        minX: layoutBounds.minX,
        maxX: layoutBounds.maxX,
        minZ: layoutBounds.minZ,
        maxZ: layoutBounds.maxZ,
      };
    }
    if (layout.nodes.length === 0) return null;
    const xs = layout.nodes.map((node) => node.x);
    const zs = layout.nodes.map((node) => node.z);
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minZ: Math.min(...zs),
      maxZ: Math.max(...zs),
    };
  }, [layout.nodes, layoutBounds]);

  const controller = useMemo(
    () => createPlanCameraController(viewport, surfaceSize),
    [surfaceSize, viewport],
  );

  const displayMinorRef = useRef<number | undefined>(undefined);
  const resolvedSnapSpacing = Math.max(0.001, snapSpacingMeters ?? layout.gridSpacingMeters);
  const planGridState = useMemo(() => {
    const next = computePlanGridState(viewport, surfaceSize, resolvedSnapSpacing, displayMinorRef.current);
    displayMinorRef.current = next.displayMinorSpacingMeters;
    return next;
  }, [resolvedSnapSpacing, surfaceSize, viewport]);

  const visibleBounds = controller.visibleWorldBounds();
  const minorGridStep = planGridState.displayMinorSpacingMeters;
  const majorGridStep = planGridState.displayMajorSpacingMeters;
  const minorCellPx = projectCellWidthPx(minorGridStep, viewport);
  const showMinorGrid = minorCellPx >= MIN_CELL_PX;

  const planToSurfacePoint = useCallback(
    (point: { x: number; z: number }) => {
      const screen = controller.planToScreenPoint(point);
      return { sx: screen.x, sy: screen.y };
    },
    [controller],
  );

  const committedRenderModel = useMemo(
    () => designRenderModel ?? buildDesignRenderModel({ placedComponents }),
    [designRenderModel, placedComponents],
  );
  const previewRenderModel = useMemo(
    () => buildDesignRenderModel({ placedComponents: componentPreview ? [componentPreview] : [] }),
    [componentPreview],
  );

  const screenFromEvent = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return null;
      const eventSurfaceSize = { width: rect.width, height: rect.height };
      if (eventSurfaceSize.width > 0 && eventSurfaceSize.height > 0) {
        setSurfaceSize((current) =>
          Math.abs(current.width - eventSurfaceSize.width) < 0.5 && Math.abs(current.height - eventSurfaceSize.height) < 0.5
            ? current
            : eventSurfaceSize,
        );
      }
      return createPlanCameraController(viewport, eventSurfaceSize).screenToPlanPoint(event.clientX, event.clientY, rect.left, rect.top);
    },
    [viewport],
  );

  const snapColumnDragPoint = useCallback(
    (point: { x: number; z: number }) => {
      if (snapMode === 'off') return point;
      const spacing = Math.max(0.001, snapSpacingMeters ?? layout.gridSpacingMeters);
      return {
        x: Math.round(point.x / spacing) * spacing,
        z: Math.round(point.z / spacing) * spacing,
      };
    },
    [layout.gridSpacingMeters, snapMode, snapSpacingMeters],
  );

  const hitTestPlanComponent = useCallback(
    (point: { x: number; z: number }): PlanComponentHit | null => {
      const handleToleranceMeters = Math.max(0.08, 10 / Math.max(1, viewport.zoom));
      for (const component of [...committedRenderModel.rcComponents].reverse()) {
        if (component.type !== 'column') continue;
        const dx = point.x - component.position.x;
        const dz = point.z - component.position.z;
        const bodyHit =
          Math.abs(dx) <= component.dimensions.width / 2 + handleToleranceMeters &&
          Math.abs(dz) <= component.dimensions.depth / 2 + handleToleranceMeters;
        const centerHandleHit = Math.hypot(dx, dz) <= Math.max(handleToleranceMeters, 0.12);
        if (!bodyHit && !centerHandleHit) continue;
        return {
          id: component.id,
          sourceComponentId: component.sourceComponentId,
          type: component.type,
          position: { x: component.position.x, z: component.position.z },
          widthMeters: component.dimensions.width,
          depthMeters: component.dimensions.depth,
          lengthMeters: component.dimensions.length ?? component.dimensions.width,
          footer: component.footer
            ? {
                id: component.footer.id,
                widthMeters: component.footer.widthMeters,
                lengthMeters: component.footer.lengthMeters,
              }
            : undefined,
        };
      }
      for (const component of [...committedRenderModel.rcComponents].reverse()) {
        const dx = point.x - component.position.x;
        const dz = point.z - component.position.z;
        const widthMeters = component.dimensions.width;
        const depthMeters = component.dimensions.depth;
        const lengthMeters = component.dimensions.length ?? widthMeters;
        const hitWidth = component.type === 'slab' ? lengthMeters : widthMeters;
        const hitDepth = component.type === 'slab' ? widthMeters : depthMeters;
        const bodyHit =
          Math.abs(dx) <= hitWidth / 2 + handleToleranceMeters &&
          Math.abs(dz) <= hitDepth / 2 + handleToleranceMeters;
        const footerHit =
          component.type === 'column' && component.footer
            ? Math.abs(dx) <= component.footer.widthMeters / 2 + handleToleranceMeters &&
              Math.abs(dz) <= component.footer.lengthMeters / 2 + handleToleranceMeters
            : false;
        const centerHandleHit =
          component.type === 'column' && Math.hypot(dx, dz) <= Math.max(handleToleranceMeters, 0.12);
        if (!bodyHit && !footerHit && !centerHandleHit) continue;
        return {
          id: component.id,
          sourceComponentId: component.sourceComponentId,
          type: component.type,
          position: { x: component.position.x, z: component.position.z },
          widthMeters,
          depthMeters,
          lengthMeters,
          footer: component.footer
            ? {
                id: component.footer.id,
                widthMeters: component.footer.widthMeters,
                lengthMeters: component.footer.lengthMeters,
              }
            : undefined,
        };
      }
      return null;
    },
    [committedRenderModel.rcComponents, viewport.zoom],
  );

  const hitTestPlanColumn = useCallback(
    (point: { x: number; z: number }): PlanColumnHit | null => {
      const handleToleranceMeters = Math.max(0.08, 10 / Math.max(1, viewport.zoom));

      const componentHit = hitTestPlanComponent(point);
      if (componentHit?.type === 'column') {
        return {
          id: componentHit.id,
          source: 'component',
          componentId: componentHit.sourceComponentId,
          position: componentHit.position,
          widthMeters: componentHit.widthMeters,
          depthMeters: componentHit.depthMeters,
          footer: componentHit.footer,
        };
      }

      for (const column of [...(frameSystem?.columns ?? [])].reverse()) {
        if (!column.hostNodeId) continue;
        const dx = point.x - column.position.x;
        const dz = point.z - column.position.z;
        const footing = isolatedFootings.find((item) => item.columnId === column.id);
        const bodyHit =
          Math.abs(dx) <= column.widthMeters / 2 + handleToleranceMeters &&
          Math.abs(dz) <= column.depthMeters / 2 + handleToleranceMeters;
        const footerHit =
          footing != null &&
          Math.abs(dx) <= footing.widthMeters / 2 + handleToleranceMeters &&
          Math.abs(dz) <= footing.lengthMeters / 2 + handleToleranceMeters;
        const centerHandleHit = Math.hypot(dx, dz) <= Math.max(handleToleranceMeters, 0.12);
        if (bodyHit || footerHit || centerHandleHit) {
          return {
            id: column.id,
            source: 'frame',
            nodeId: column.hostNodeId,
            position: column.position,
            widthMeters: column.widthMeters,
            depthMeters: column.depthMeters,
            footer: footing
              ? {
                  id: footing.id,
                  widthMeters: footing.widthMeters,
                  lengthMeters: footing.lengthMeters,
                }
              : undefined,
          };
        }
      }
      return null;
    },
    [frameSystem?.columns, hitTestPlanComponent, isolatedFootings, viewport.zoom],
  );

  const dimensionSnapPoints = useMemo<DimensionSnapPoint[]>(() => {
    const points: DimensionSnapPoint[] = [];
    const add = (point: { x: number; z: number }, type: string, componentId?: string) => {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.z)) return;
      points.push({ point, type, componentId });
    };
    const addRectSnapPoints = (
      center: { x: number; z: number },
      widthMeters: number,
      depthMeters: number,
      typePrefix: string,
      componentId?: string,
    ) => {
      const halfW = widthMeters / 2;
      const halfD = depthMeters / 2;
      add(center, `${typePrefix}-center`, componentId);
      add({ x: center.x - halfW, z: center.z - halfD }, `${typePrefix}-corner`, componentId);
      add({ x: center.x + halfW, z: center.z - halfD }, `${typePrefix}-corner`, componentId);
      add({ x: center.x + halfW, z: center.z + halfD }, `${typePrefix}-corner`, componentId);
      add({ x: center.x - halfW, z: center.z + halfD }, `${typePrefix}-corner`, componentId);
      add({ x: center.x, z: center.z - halfD }, `${typePrefix}-edge-midpoint`, componentId);
      add({ x: center.x + halfW, z: center.z }, `${typePrefix}-edge-midpoint`, componentId);
      add({ x: center.x, z: center.z + halfD }, `${typePrefix}-edge-midpoint`, componentId);
      add({ x: center.x - halfW, z: center.z }, `${typePrefix}-edge-midpoint`, componentId);
    };
    const addSegmentSnapPoints = (start: { x: number; z: number }, end: { x: number; z: number }, typePrefix: string, componentId?: string) => {
      add(start, `${typePrefix}-endpoint`, componentId);
      add(end, `${typePrefix}-endpoint`, componentId);
      add({ x: (start.x + end.x) / 2, z: (start.z + end.z) / 2 }, `${typePrefix}-midpoint`, componentId);
    };
    if (isRoofPlanView) {
      roofPlanPerimeter.forEach((point, index) => {
        add(point, 'roof-corner', `roof-corner-${index}`);
        const next = roofPlanPerimeter[(index + 1) % roofPlanPerimeter.length];
        if (next) addSegmentSnapPoints(point, next, 'roof-edge', `roof-edge-${index}`);
      });
      if (resolvedRoofSystem?.ridgeStart && resolvedRoofSystem.ridgeEnd) {
        addSegmentSnapPoints(
          { x: resolvedRoofSystem.ridgeStart.x, z: resolvedRoofSystem.ridgeStart.z },
          { x: resolvedRoofSystem.ridgeEnd.x, z: resolvedRoofSystem.ridgeEnd.z },
          'roof-ridge',
          'roof-ridge',
        );
      }
      resolvedRoofSystem?.hipFramingMembers.forEach((member) => {
        addSegmentSnapPoints(
          { x: member.start.x, z: member.start.z },
          { x: member.end.x, z: member.end.z },
          `roof-${member.memberKind}`,
          member.id,
        );
      });
      resolvedRoofSystem?.roofTopPlanes.forEach((plane) => {
        plane.corners.forEach((corner, index) => add({ x: corner.x, z: corner.z }, 'roof-plane-corner', `${plane.id}-${index}`));
      });
      return points;
    }
    layout.nodes.forEach((node) => {
      const displayPoint = planDisplayNodeById.get(node.id) ?? node;
      add(displayPoint, 'wall-node');
    });
    layout.segments.forEach((segment) => {
      const endpoints = resolveSegmentDisplayEndpoints({ segment, layout, planDisplayNodeById });
      if (!endpoints) return;
      add(endpoints.displayStart, 'wall-endpoint');
      add(endpoints.displayEnd, 'wall-endpoint');
      add({
        x: (endpoints.displayStart.x + endpoints.displayEnd.x) / 2,
        z: (endpoints.displayStart.z + endpoints.displayEnd.z) / 2,
      }, 'wall-midpoint');
      const frame = framesBySegmentId.get(segment.id);
      if (frame) {
        buildSegmentFaceSnapPoints(frame).forEach((snap) => {
          add(snap.point, snap.type, segment.id);
        });
      }
    });
    frameSystem?.columns.forEach((column) => {
      addRectSnapPoints(column.position, column.widthMeters, column.depthMeters, 'column', column.id);
    });
    frameSystem?.beams.forEach((beam) => {
      add({ x: beam.startPoint.x, z: beam.startPoint.z }, 'beam-endpoint', beam.id);
      add({ x: beam.endPoint.x, z: beam.endPoint.z }, 'beam-endpoint', beam.id);
    });
    isolatedFootings.forEach((footing) => {
      addRectSnapPoints(footing.position, footing.widthMeters, footing.lengthMeters, 'footing', footing.id);
    });
    wallFootings.forEach((footing) => {
      buildPlanStripSnapPoints({
        start: footing.startPoint,
        end: footing.endPoint,
        widthMeters: footing.widthMeters,
        typePrefix: 'wall-footing',
      }).forEach((snap) => {
        add(snap.point, snap.type, footing.id);
      });
    });
    committedRenderModel.rcComponents.forEach((component) => {
      addRectSnapPoints(
        { x: component.position.x, z: component.position.z },
        component.dimensions.length ?? component.dimensions.width,
        component.dimensions.depth,
        component.type,
        component.sourceComponentId,
      );
    });
    openingItems.forEach((item) => {
      try {
        const geometry = buildPlanOpeningGeometry(item.resolved);
        add(geometry.roughStart, 'opening-jamb', item.openingId);
        add(geometry.roughEnd, 'opening-jamb', item.openingId);
      } catch {
        // Some tests and legacy drafts may carry partial opening resolution data.
      }
    });
    return points;
  }, [
    committedRenderModel.rcComponents,
    frameSystem?.beams,
    frameSystem?.columns,
    framesBySegmentId,
    isolatedFootings,
    isRoofPlanView,
    layout,
    openingItems,
    planDisplayNodeById,
    resolvedRoofSystem,
    roofPlanPerimeter,
    wallFootings,
  ]);

  const snapGeometry = useMemo<SnapGeometry>(() => {
    const points = dimensionSnapPoints.map((candidate) => ({
      id: candidate.componentId ?? candidate.type,
      point: candidate.point,
      snapType: candidate.type.includes('midpoint') || candidate.type.includes('center') ? 'midpoint' as const : 'endpoint' as const,
      label: candidate.type.includes('midpoint') || candidate.type.includes('center') ? 'Midpoint' : 'Endpoint',
    }));
    const segments = layout.segments.flatMap((segment) => {
      const endpoints = resolveSegmentDisplayEndpoints({ segment, layout, planDisplayNodeById });
      if (!endpoints) return [];
      return [{
        id: segment.id,
        start: endpoints.displayStart,
        end: endpoints.displayEnd,
      }];
    });
    if (isRoofPlanView && roofPlanPerimeter.length > 1) {
      roofPlanPerimeter.forEach((point, index) => {
        const next = roofPlanPerimeter[(index + 1) % roofPlanPerimeter.length];
        if (!next) return;
        segments.push({ id: `roof-edge-${index}`, start: point, end: next });
      });
    }
    return { points, segments };
  }, [dimensionSnapPoints, isRoofPlanView, layout, planDisplayNodeById, roofPlanPerimeter]);

  const resolvePrecisionSnap = useCallback(
    (
      point: PlanPoint,
      options?: {
        altHeld?: boolean;
        shiftHeld?: boolean;
        basePoint?: PlanPoint | null;
      },
    ): SnapResult => {
      const rawScreen = controller.planToScreenPoint(point);
      return resolveSnap({
        rawWorldPoint: point,
        rawScreenPoint: rawScreen,
        planToScreenPoint: controller.planToScreenPoint,
        currentToolMode: toolMode,
        commandState: { basePoint: options?.basePoint ?? null },
        geometry: snapGeometry,
        settings: {
          ...(snapSettings ?? {
            snapMode,
            gridSpacingMeters: snapSpacingMeters ?? layout.gridSpacingMeters,
            tolerancePx: 12,
            tolerancePreset: 'normal' as const,
            objectSnap: {
              enabled: true,
              endpoint: true,
              midpoint: true,
              intersection: true,
              nearest: false,
              perpendicular: true,
              extension: false,
            },
            orthogonal: false,
            polar: true,
            polarAnglesDegrees: [0, 15, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330],
          }),
          snapMode,
          gridSpacingMeters: snapSpacingMeters ?? layout.gridSpacingMeters,
        },
        keyboard: {
          altHeld: options?.altHeld,
          shiftHeld: options?.shiftHeld,
          tabCycleIndex: snapCycleIndex,
          horizontalLock: horizontalSnapLock,
          verticalLock: verticalSnapLock,
        },
      });
    },
    [
      controller.planToScreenPoint,
      horizontalSnapLock,
      layout.gridSpacingMeters,
      snapCycleIndex,
      snapGeometry,
      snapMode,
      snapSettings,
      snapSpacingMeters,
      toolMode,
      verticalSnapLock,
    ],
  );

  const dimensionSnapFromResult = useCallback((result: SnapResult): DimensionSnapPoint => {
    const existing = dimensionSnapPoints.find((candidate) =>
      Math.hypot(candidate.point.x - result.worldPoint.x, candidate.point.z - result.worldPoint.z) <= 0.001 &&
      (!result.sourceId || candidate.componentId === result.sourceId || candidate.type === result.sourceId)
    );
    return {
      point: result.worldPoint,
      type: existing?.type ?? (result.snapped ? result.snapType : 'free-point'),
      componentId: existing?.componentId ?? result.sourceId,
      snapResult: result,
    };
  }, [dimensionSnapPoints]);

  const resolveDimensionSnap = useCallback(
    (
      point: { x: number; z: number },
      options?: { altHeld?: boolean; shiftHeld?: boolean; basePoint?: PlanPoint | null },
    ): DimensionSnapPoint => {
      return dimensionSnapFromResult(resolvePrecisionSnap(point, options));
    },
    [dimensionSnapFromResult, resolvePrecisionSnap],
  );

  const inferDimensionKind = useCallback((start: { x: number; z: number }, end: { x: number; z: number }): DesignDimensionAnnotation['dimensionKind'] => {
    if (Math.abs(start.z - end.z) <= 0.05) return 'horizontal';
    if (Math.abs(start.x - end.x) <= 0.05) return 'vertical';
    return 'aligned';
  }, []);

  const measuredDimensionValue = useCallback((start: { x: number; z: number }, end: { x: number; z: number }, kind: DesignDimensionAnnotation['dimensionKind']) => {
    if (kind === 'horizontal') return Math.abs(end.x - start.x);
    if (kind === 'vertical') return Math.abs(end.z - start.z);
    return Math.hypot(end.x - start.x, end.z - start.z);
  }, []);

  const measuredAngleDegrees = useCallback((
    start: { x: number; z: number },
    vertex: { x: number; z: number },
    end: { x: number; z: number },
  ) => {
    const ax = start.x - vertex.x;
    const az = start.z - vertex.z;
    const bx = end.x - vertex.x;
    const bz = end.z - vertex.z;
    const aLength = Math.hypot(ax, az);
    const bLength = Math.hypot(bx, bz);
    if (aLength <= 0.0001 || bLength <= 0.0001) return 0;
    const dot = (ax * bx + az * bz) / (aLength * bLength);
    return (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI;
  }, []);

  const visibleDimensionAnnotations = useMemo(
    () =>
      annotations
        .filter((annotation): annotation is DesignDimensionAnnotation => annotation.type === 'dimension' && annotation.viewType === active2DView)
        .filter((annotation) => {
          if (!isRoofPlanView || roofPlanPerimeter.length < 3) return true;
          return !pointInPlanPolygon(annotation.offsetPoint, roofPlanPerimeter);
        }),
    [active2DView, annotations, isRoofPlanView, roofPlanPerimeter],
  );

  const hitTestDimensionAnnotation = useCallback(
    (point: { x: number; z: number }): DesignDimensionAnnotation | null => {
      const toleranceMeters = Math.max(0.08, 10 / Math.max(1, viewport.zoom));
      for (let index = visibleDimensionAnnotations.length - 1; index >= 0; index -= 1) {
        const annotation = visibleDimensionAnnotations[index]!;
        const geometry = resolveDimensionPlanGeometry(annotation);
        if (!geometry) continue;
        const segments = [
          { start: geometry.dimensionStart, end: geometry.dimensionEnd },
          { start: geometry.start, end: geometry.dimensionStart },
          { start: geometry.end, end: geometry.dimensionEnd },
        ];
        if (segments.some((segment) => distanceToPlanSegment(point, segment.start, segment.end) <= toleranceMeters)) {
          return annotation;
        }
      }
      return null;
    },
    [viewport.zoom, visibleDimensionAnnotations],
  );

  const cancelColumnDrag = useCallback(() => {
    const activeDrag = columnDragStateRef.current;
    if (!activeDrag) return;
    svgRef.current?.releasePointerCapture?.(activeDrag.pointerId);
    setColumnDragState(null);
  }, [setColumnDragState]);

  const updateSurfaceSize = useCallback(() => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    setSurfaceSize((current) =>
      Math.abs(current.width - rect.width) < 0.5 && Math.abs(current.height - rect.height) < 0.5
        ? current
        : { width: rect.width, height: rect.height },
    );
  }, []);

  useEffect(() => {
    if (!viewCommand || lastViewCommandIdRef.current === viewCommand.id) return;
    lastViewCommandIdRef.current = viewCommand.id;
    if (viewCommand.action === 'reset') {
      onViewportChange?.(resetPlanView());
      return;
    }
    if (viewCommand.action === 'grid_scale') {
      return;
    }
    const nextViewport = fitPlanToLayout(layoutBounds, surfaceSize);
    logDesignFramingDiagnostics({
      mode: 'plan',
      bounds: layoutBounds,
      cameraTargetX: nextViewport.centerX,
      cameraTargetZ: nextViewport.centerZ,
    });
    onViewportChange?.(nextViewport);
  }, [layout.gridSpacingMeters, layoutBounds, onViewportChange, surfaceSize, viewCommand, viewport]);

  useEffect(() => {
    updateSurfaceSize();
    const svg = svgRef.current;
    if (!svg) return undefined;
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateSurfaceSize);
      return () => window.removeEventListener('resize', updateSurfaceSize);
    }
    const observer = new ResizeObserver(updateSurfaceSize);
    observer.observe(svg);
    return () => observer.disconnect();
  }, [updateSurfaceSize]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') spaceHeldRef.current = true;
      if (event.key === 'Escape' && columnDragStateRef.current) {
        cancelColumnDrag();
      }
      if (event.key === 'Escape' && dimensionDraft) {
        setDimensionDraft(null);
        setDimensionSnap(null);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') spaceHeldRef.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [cancelColumnDrag, dimensionDraft]);

  useEffect(() => {
    const planSurface = svgRef.current;
    if (!planSurface) return undefined;
    const onPlanWheel = (event: WheelEvent) => {
      if (!planSurface.contains(event.target as Node)) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = planSurface.getBoundingClientRect();
      const eventSurfaceSize = { width: rect.width, height: rect.height };
      setSurfaceSize((current) =>
        Math.abs(current.width - eventSurfaceSize.width) < 0.5 && Math.abs(current.height - eventSurfaceSize.height) < 0.5
          ? current
          : eventSurfaceSize,
      );
      onUserViewportChange?.();
      onViewportChange?.(
        createPlanCameraController(viewport, eventSurfaceSize).zoomAtPointer(event.clientX, event.clientY, event.deltaY, rect.left, rect.top),
      );
    };
    planSurface.addEventListener('wheel', onPlanWheel, { passive: false });
    return () => planSurface.removeEventListener('wheel', onPlanWheel);
  }, [onUserViewportChange, onViewportChange, viewport]);


  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const activeColumnDrag = columnDragStateRef.current;
    if (activeColumnDrag && activeColumnDrag.pointerId === event.pointerId) {
      const point = screenFromEvent(event);
      if (!point) return;
      const previewPosition = snapColumnDragPoint(point);
      setCursorPoint(previewPosition);
      const movedEnough =
        activeColumnDrag.status === 'dragging-column' ||
        Math.hypot(
          event.clientX - activeColumnDrag.startPointer.clientX,
          event.clientY - activeColumnDrag.startPointer.clientY,
        ) >= COLUMN_DRAG_THRESHOLD_PX;
      setColumnDragState({
        ...activeColumnDrag,
        status: movedEnough ? 'dragging-column' : 'candidate',
        previewPosition,
      });
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (panDragRef.current) {
      const next = controller.panByPointerDelta(event.clientX - panDragRef.current.x, event.clientY - panDragRef.current.y);
      panDragRef.current = { x: event.clientX, y: event.clientY };
      onUserViewportChange?.();
      onViewportChange?.(next);
      return;
    }
    const point = screenFromEvent(event);
    if (!point) return;
    setCursorPoint(point);
    if (toolMode === 'select' || toolMode === 'move_opening') {
      updateHoveredOpening(point);
    } else {
      setHoveredOpeningId(null);
    }
    if (isPlumbingPlanView && septicTankPlacementActive) {
      onSepticTankPointer?.({
        phase: 'preview',
        xMeters: point.x,
        zMeters: point.z,
        rotationRad: septicTankPlacementRotationRad,
      });
      return;
    }
    if (isPlumbingPlanView && activePlumbingFixtureType) {
      onPlumbingFixturePointer?.({ phase: 'preview', xMeters: point.x, zMeters: point.z, rotationRad: plumbingFixtureRotationRad });
      return;
    }
    if (isPlumbingPlanView && activePlumbingToolMode !== 'select' && activePlumbingToolMode !== 'label' && activePlumbingToolMode !== 'validate') {
      onPlumbingPlanPointer?.({ phase: 'preview', xMeters: point.x, zMeters: point.z, shiftHeld: event.shiftKey });
      return;
    }
    if (toolMode === 'place_component') {
      onComponentPointer?.({ phase: 'preview', xMeters: point.x, zMeters: point.z });
      return;
    }
    if (toolMode === 'place_dimension' || toolMode === 'place_angle') {
      const snapped = resolveDimensionSnap(point, {
        altHeld: event.altKey,
        shiftHeld: event.shiftKey,
        basePoint:
          dimensionDraft?.step === 'offset'
            ? dimensionDraft.end.point
            : angleDraft?.step === 'end'
              ? angleDraft.vertex.point
              : null,
      });
      setDimensionSnap(snapped);
      if (dimensionDraft?.step === 'offset') {
        setDimensionDraft({ ...dimensionDraft, offsetPoint: event.altKey ? point : snapped.point });
      }
      if (toolMode === 'place_angle' && angleDraft?.step === 'end') {
        setAngleDraft({ ...angleDraft, previewEnd: snapped });
      }
      return;
    }
    if (toolMode === 'draw_wall') {
      const activeNode = activeNodeId ? layout.nodes.find((node) => node.id === activeNodeId) : null;
      const snapped = resolvePrecisionSnap(point, {
        altHeld: event.altKey,
        shiftHeld: event.shiftKey,
        basePoint: activeNode ?? null,
      });
      onInteraction({
        kind: 'draw_preview',
        toolMode,
        phase: 'preview',
        planX: snapped.worldPoint.x,
        planZ: snapped.worldPoint.z,
        nodeId: activeNodeId ?? undefined,
        shiftHeld: event.shiftKey,
        altHeld: event.altKey,
      });
    }
    if (toolMode === 'move_wall_node' && activeNodeId) {
      onInteraction({
        kind: 'move_node',
        toolMode,
        phase: 'preview',
        planX: point.x,
        planZ: point.z,
        nodeId: activeNodeId,
      });
    }
    if (toolMode === 'place_door' || toolMode === 'place_window' || (toolMode === 'move_opening' && selectedOpeningId)) {
      emitSegmentPick('preview', point);
    }
  };

  const handleContextMenu = (event: PointerEvent<SVGSVGElement>) => {
    if (columnDragStateRef.current) {
      event.preventDefault();
      event.stopPropagation();
      cancelColumnDrag();
      return;
    }
    if (toolMode === 'place_component') {
      event.preventDefault();
      onInteraction({ kind: 'cancel', toolMode });
      return;
    }
    if (toolMode === 'place_dimension' || toolMode === 'place_angle') {
      event.preventDefault();
      setDimensionDraft(null);
      setAngleDraft(null);
      setDimensionSnap(null);
      return;
    }
    if (toolMode !== 'draw_wall') return;
    event.preventDefault();
    onInteraction({ kind: 'undo_last_segment', toolMode });
  };

  const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button === 1 || (event.button === 0 && spaceHeldRef.current)) {
      event.preventDefault();
      panDragRef.current = { x: event.clientX, y: event.clientY };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (event.button !== 0) return;
    const point = screenFromEvent(event);
    if (!point) return;
    setCursorPoint(point);
    if (isPlumbingPlanView && septicTankPlacementActive) {
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      onSepticTankPointer?.({
        phase: 'preview',
        xMeters: point.x,
        zMeters: point.z,
        rotationRad: septicTankPlacementRotationRad,
      });
      return;
    }
    if (isPlumbingPlanView && activePlumbingFixtureType) {
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      onPlumbingFixturePointer?.({ phase: 'preview', xMeters: point.x, zMeters: point.z, rotationRad: plumbingFixtureRotationRad });
      return;
    }
    if (isPlumbingPlanView && activePlumbingToolMode !== 'select' && activePlumbingToolMode !== 'label' && activePlumbingToolMode !== 'validate') {
      event.preventDefault();
      event.stopPropagation();
      onPlumbingPlanPointer?.({ phase: 'commit', xMeters: point.x, zMeters: point.z, shiftHeld: event.shiftKey });
      return;
    }
    if (toolMode === 'place_component') {
      componentPointerIdRef.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
      onComponentPointer?.({ phase: 'preview', xMeters: point.x, zMeters: point.z });
      return;
    }
    if (toolMode === 'place_dimension') {
      event.preventDefault();
      event.stopPropagation();
      const snapped = resolveDimensionSnap(point, {
        altHeld: event.altKey,
        shiftHeld: event.shiftKey,
        basePoint: dimensionDraft?.step === 'offset' ? dimensionDraft.end.point : null,
      });
      setDimensionSnap(snapped);
      if (!dimensionDraft) {
        setDimensionDraft({ step: 'start', start: snapped });
        return;
      }
      if (dimensionDraft.step === 'start') {
        setDimensionDraft({
          step: 'offset',
          start: dimensionDraft.start,
          end: snapped,
          offsetPoint: event.altKey ? point : snapped.point,
        });
        return;
      }
      const kind = inferDimensionKind(dimensionDraft.start.point, dimensionDraft.end.point);
      const now = new Date().toISOString();
      onAnnotationCreate?.({
        id: `dimension-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'dimension',
        viewType: active2DView,
        points: {
          start: dimensionDraft.start.point,
          end: dimensionDraft.end.point,
        },
        offsetPoint: event.altKey ? point : snapped.point,
        dimensionKind: kind,
        measuredValue: measuredDimensionValue(dimensionDraft.start.point, dimensionDraft.end.point, kind),
        unit: 'm',
        references: {
          startComponentId: dimensionDraft.start.componentId,
          endComponentId: dimensionDraft.end.componentId,
          startSnapType: dimensionDraft.start.type,
          endSnapType: dimensionDraft.end.type,
        },
        createdAt: now,
        updatedAt: now,
      });
      setDimensionDraft(null);
      setDimensionSnap(null);
      return;
    }
    if (toolMode === 'place_angle') {
      event.preventDefault();
      event.stopPropagation();
      const snapped = resolveDimensionSnap(point, {
        altHeld: event.altKey,
        shiftHeld: event.shiftKey,
        basePoint: angleDraft?.step === 'end' ? angleDraft.vertex.point : null,
      });
      setDimensionSnap(snapped);
      if (!angleDraft) {
        setAngleDraft({ step: 'vertex', start: snapped });
        return;
      }
      if (angleDraft.step === 'vertex') {
        setAngleDraft({ step: 'end', start: angleDraft.start, vertex: snapped });
        return;
      }
      const now = new Date().toISOString();
      const measuredValueDegrees = measuredAngleDegrees(
        angleDraft.start.point,
        angleDraft.vertex.point,
        snapped.point,
      );
      onAnnotationCreate?.({
        id: `angle-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'angle',
        viewType: active2DView,
        points: {
          start: angleDraft.start.point,
          vertex: angleDraft.vertex.point,
          end: snapped.point,
        },
        measuredValueDegrees,
        references: {
          startSnapType: angleDraft.start.type,
          vertexSnapType: angleDraft.vertex.type,
          endSnapType: snapped.type,
        },
        createdAt: now,
        updatedAt: now,
      });
      setAngleDraft(null);
      setDimensionSnap(null);
      return;
    }
    if (toolMode === 'draw_wall') {
      const activeNode = activeNodeId ? layout.nodes.find((node) => node.id === activeNodeId) : null;
      const snapped = resolvePrecisionSnap(point, {
        altHeld: event.altKey,
        shiftHeld: event.shiftKey,
        basePoint: activeNode ?? null,
      });
      onInteraction({
        kind: 'draw_point',
        toolMode,
        phase: event.detail === 2 ? 'commit' : 'commit',
        planX: snapped.worldPoint.x,
        planZ: snapped.worldPoint.z,
        nodeId: activeNodeId ?? undefined,
        shiftHeld: event.shiftKey,
        altHeld: event.altKey,
      });
      return;
    }
    if (toolMode === 'move_wall_node') {
      const hitNode = layout.nodes.find((node) => Math.hypot(node.x - point.x, node.z - point.z) < 0.25);
      if (hitNode) {
        onInteraction({ kind: 'select_node', toolMode, nodeId: hitNode.id });
      }
      return;
    }
    if (toolMode === 'place_door' || toolMode === 'place_window') {
      emitSegmentPick('preview', point);
      return;
    }
    if (toolMode === 'move_opening' && selectedOpeningId) {
      emitSegmentPick('preview', point);
      return;
    }
    if (toolMode === 'select' || toolMode === 'delete') {
      if (isPlumbingPlanView && plumbingSystem) {
        const plumbingHit = hitTestPlumbingSystem({
          system: plumbingSystem,
          point,
          toleranceMeters: Math.max(0.08, 10 / Math.max(1, viewport.zoom)),
        });
        if (plumbingHit.kind !== 'none') {
          event.preventDefault();
          event.stopPropagation();
          onPlumbingSelect?.(plumbingHit);
          return;
        }
        const septicHit = hitTestSepticTank(point, plumbingSystem.septicTanks);
        if (septicHit) {
          event.preventDefault();
          event.stopPropagation();
          onPlumbingSelect?.({ kind: 'septic-tank', id: septicHit.id });
          onSepticTankSelect?.(septicHit.id);
          return;
        }
      }
      const hitDimension = hitTestDimensionAnnotation(point);
      if (hitDimension) {
        event.preventDefault();
        event.stopPropagation();
        onInteraction({
          kind: toolMode === 'delete' ? 'annotation_delete' : 'annotation_select',
          toolMode,
          phase: 'commit',
          annotationId: hitDimension.id,
          planX: point.x,
          planZ: point.z,
        });
        return;
      }
      const hitComponent = hitTestPlanComponent(point);
      if (hitComponent) {
        event.preventDefault();
        event.stopPropagation();
        if (toolMode === 'delete') {
          onInteraction({
            kind: 'component_delete',
            toolMode,
            phase: 'commit',
            componentId: hitComponent.sourceComponentId,
            planX: point.x,
            planZ: point.z,
          });
          return;
        }
        onInteraction({
          kind: 'component_select',
          toolMode,
          phase: 'commit',
          componentId: hitComponent.sourceComponentId,
          componentType: hitComponent.type,
          planX: point.x,
          planZ: point.z,
        });
        if (hitComponent.type !== 'column') {
          return;
        }
        event.currentTarget.setPointerCapture(event.pointerId);
        setColumnDragState({
          status: 'candidate',
          pointerId: event.pointerId,
          columnId: hitComponent.id,
          source: 'component',
          componentId: hitComponent.sourceComponentId,
          originalPosition: hitComponent.position,
          previewPosition: hitComponent.position,
          widthMeters: hitComponent.widthMeters,
          depthMeters: hitComponent.depthMeters,
          footer: hitComponent.footer,
          startPointer: { clientX: event.clientX, clientY: event.clientY },
        });
        return;
      }
      const hitColumn = toolMode === 'select' ? hitTestPlanColumn(point) : null;
      if (hitColumn) {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        setColumnDragState({
          status: 'candidate',
          pointerId: event.pointerId,
          columnId: hitColumn.id,
          source: hitColumn.source,
          nodeId: hitColumn.nodeId,
          componentId: hitColumn.componentId,
          originalPosition: hitColumn.position,
          previewPosition: hitColumn.position,
          widthMeters: hitColumn.widthMeters,
          depthMeters: hitColumn.depthMeters,
          footer: hitColumn.footer,
          startPointer: { clientX: event.clientX, clientY: event.clientY },
        });
        if (hitColumn.source === 'frame' && hitColumn.nodeId) {
          onInteraction({ kind: 'select_node', toolMode, nodeId: hitColumn.nodeId });
        } else if (hitColumn.source === 'component') {
          onInteraction({
            kind: 'component_select',
            toolMode,
            phase: 'commit',
            componentId: hitColumn.componentId ?? hitColumn.id,
            componentType: 'column',
            planX: point.x,
            planZ: point.z,
          });
        }
        return;
      }
      const hitNode = layout.nodes.find((node) => Math.hypot(node.x - point.x, node.z - point.z) < 0.25);
      if (hitNode) {
        onInteraction({ kind: 'select_node', toolMode, nodeId: hitNode.id });
        return;
      }
      onInteraction({
        kind: 'segment_pick',
        toolMode,
        phase: 'commit',
        planX: point.x,
        planZ: point.z,
      });
    }
  };

  const handlePointerUp = (event: PointerEvent<SVGSVGElement>) => {
    const activeColumnDrag = columnDragStateRef.current;
    if (activeColumnDrag && activeColumnDrag.pointerId === event.pointerId) {
      const point = screenFromEvent(event);
      const previewPosition = point ? snapColumnDragPoint(point) : activeColumnDrag.previewPosition;
      setColumnDragState(null);
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
      if (activeColumnDrag.status === 'dragging-column') {
        if (activeColumnDrag.source === 'component' && activeColumnDrag.componentId) {
          onInteraction({
            kind: 'component_move',
            toolMode,
            phase: 'commit',
            planX: previewPosition.x,
            planZ: previewPosition.z,
            componentId: activeColumnDrag.componentId,
          });
        } else if (activeColumnDrag.nodeId) {
          onInteraction({
            kind: 'move_node',
            toolMode,
            phase: 'commit',
            planX: previewPosition.x,
            planZ: previewPosition.z,
            nodeId: activeColumnDrag.nodeId,
          });
        }
      }
      return;
    }
    if (panDragRef.current) {
      panDragRef.current = null;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      return;
    }
    if (toolMode === 'place_door' || toolMode === 'place_window') {
      const point = screenFromEvent(event);
      if (!point) return;
      emitSegmentPick('commit', point);
      return;
    }
    if (toolMode === 'place_component') {
      const point = screenFromEvent(event);
      if (componentPointerIdRef.current === event.pointerId) {
        componentPointerIdRef.current = null;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      }
      if (!point) return;
      setCursorPoint(point);
      onComponentPointer?.({ phase: 'commit', xMeters: point.x, zMeters: point.z });
      return;
    }
    if (isPlumbingPlanView && septicTankPlacementActive) {
      const point = screenFromEvent(event);
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      if (!point) return;
      setCursorPoint(point);
      onSepticTankPointer?.({
        phase: 'commit',
        xMeters: point.x,
        zMeters: point.z,
        rotationRad: septicTankPlacementRotationRad,
      });
      return;
    }
    if (isPlumbingPlanView && activePlumbingFixtureType) {
      const point = screenFromEvent(event);
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      if (!point) return;
      setCursorPoint(point);
      onPlumbingFixturePointer?.({ phase: 'commit', xMeters: point.x, zMeters: point.z, rotationRad: plumbingFixtureRotationRad });
      return;
    }
    if (toolMode === 'move_opening' && selectedOpeningId) {
      const point = screenFromEvent(event);
      if (!point) return;
      emitSegmentPick('commit', point);
      return;
    }
    if (toolMode !== 'move_wall_node' || !activeNodeId) return;
    const point = screenFromEvent(event);
    if (!point) return;
    onInteraction({
      kind: 'move_node',
      toolMode,
      phase: 'commit',
      planX: point.x,
      planZ: point.z,
      nodeId: activeNodeId,
    });
  };

  const handlePointerCancel = (event: PointerEvent<SVGSVGElement>) => {
    const activeColumnDrag = columnDragStateRef.current;
    if (!activeColumnDrag || activeColumnDrag.pointerId !== event.pointerId) return;
    setColumnDragState(null);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const isMajorGridLine = (value: number, majorStep: number) =>
    Math.abs(value / majorStep - Math.round(value / majorStep)) < Math.max(majorStep * 0.001, 0.0001);

  const gridLines = [];
  for (let x = Math.floor(visibleBounds.minX / minorGridStep) * minorGridStep; x <= visibleBounds.maxX; x += minorGridStep) {
    const major = isMajorGridLine(x, majorGridStep);
    if (!showMinorGrid && !major) continue;
    const start = planToSurfacePoint({ x, z: visibleBounds.minZ });
    const end = planToSurfacePoint({ x, z: visibleBounds.maxZ });
    gridLines.push(
      <line
        key={`gx-${x}`}
        x1={start.sx}
        y1={start.sy}
        x2={end.sx}
        y2={end.sy}
        stroke={major ? drawingStyle.gridMajorStroke : drawingStyle.gridStroke}
        strokeOpacity={architecturalDrawing ? (major ? 0.42 : 0.24) : (major ? 0.18 : 0.08)}
        strokeWidth={major ? drawingStyle.weights.reference + 0.3 : drawingStyle.weights.reference}
        pointerEvents="none"
        data-grid-kind={major ? 'major' : 'minor'}
        data-grid-spacing-meters={major ? majorGridStep : minorGridStep}
      />,
    );
  }
  for (let z = Math.floor(visibleBounds.minZ / minorGridStep) * minorGridStep; z <= visibleBounds.maxZ; z += minorGridStep) {
    const major = isMajorGridLine(z, majorGridStep);
    if (!showMinorGrid && !major) continue;
    const start = planToSurfacePoint({ x: visibleBounds.minX, z });
    const end = planToSurfacePoint({ x: visibleBounds.maxX, z });
    gridLines.push(
      <line
        key={`gz-${z}`}
        x1={start.sx}
        y1={start.sy}
        x2={end.sx}
        y2={end.sy}
        stroke={major ? drawingStyle.gridMajorStroke : drawingStyle.gridStroke}
        strokeOpacity={architecturalDrawing ? (major ? 0.42 : 0.24) : (major ? 0.18 : 0.08)}
        strokeWidth={major ? drawingStyle.weights.reference + 0.3 : drawingStyle.weights.reference}
        pointerEvents="none"
        data-grid-kind={major ? 'major' : 'minor'}
        data-grid-spacing-meters={major ? majorGridStep : minorGridStep}
      />,
    );
  }

  const activeNodeRaw = layout.nodes.find((node) => node.id === activeNodeId) ?? null;
  const activeNode = activeNodeRaw
    ? (planDisplayNodeById.get(activeNodeRaw.id) ?? { x: activeNodeRaw.x, z: activeNodeRaw.z })
    : null;
  const drawGuidance = activeNode && draftEnd && toolMode === 'draw_wall' && layout.orthogonalLock
    ? resolveDrawWallGuidance({
        layout,
        activeNodeId: activeNode.id,
        rawPoint: draftEnd,
        orthogonalLock: true,
      })
    : null;
  const orthogonalGuideRays = useMemo(() => {
    if (!activeNode || toolMode !== 'draw_wall' || !layout.orthogonalLock) return [];
    const rayLength = Math.max(4, Math.max(surfaceSize.width, surfaceSize.height) / Math.max(1, viewport.zoom) * 0.35);
    const directions = listOrthogonalGuideDirections({
      layout,
      activeNodeId: activeNode.id,
    });
    return directions.map((candidate) => ({
      start: activeNode,
      end: {
        x: activeNode.x + candidate.direction.x * rayLength,
        z: activeNode.z + candidate.direction.z * rayLength,
      },
      label: candidate.label,
    }));
  }, [activeNode, layout, surfaceSize.height, surfaceSize.width, toolMode, viewport.zoom]);
  const previewLength = activeNode && draftEnd ? Math.hypot(draftEnd.x - activeNode.x, draftEnd.z - activeNode.z) : 0;
  const invalidPreview = Boolean(activeNode && draftEnd && previewLength < MIN_SEGMENT_LENGTH_METERS);
  const shiftConstrained = Boolean(shiftConstraintLabel);
  const previewMidpoint = activeNode && draftEnd ? planToSurfacePoint({ x: (activeNode.x + draftEnd.x) / 2, z: (activeNode.z + draftEnd.z) / 2 }) : null;
  const snapMarker = draftEnd ? planToSurfacePoint(draftEnd) : null;
  const closureAssistMarker = orthogonalClosureAssist?.isEligible
    ? planToSurfacePoint(orthogonalClosureAssist.candidatePoint)
    : null;
  const closureCornerMarker = closureCornerSnap ? planToSurfacePoint(closureCornerSnap.point) : null;
  const closureAssistMidpoint =
    orthogonalClosureAssist?.isEligible
      ? planToSurfacePoint({
          x: (orthogonalClosureAssist.candidatePoint.x + orthogonalClosureAssist.firstNode.x) / 2,
          z: (orthogonalClosureAssist.candidatePoint.z + orthogonalClosureAssist.firstNode.z) / 2,
        })
      : null;
  const snapCaptured = Boolean(snapTarget?.captured && snapTarget.type !== 'raw');
  const closureAssistActive = Boolean(orthogonalClosureAssist?.isEligible);
  const originPoint = planToSurfacePoint({ x: 0, z: 0 });
  const xAxisStart = planToSurfacePoint({ x: visibleBounds.minX, z: 0 });
  const xAxisEnd = planToSurfacePoint({ x: visibleBounds.maxX, z: 0 });
  const yAxisStart = planToSurfacePoint({ x: 0, z: visibleBounds.minZ });
  const yAxisEnd = planToSurfacePoint({ x: 0, z: visibleBounds.maxZ });
  const planAnnotationPrimitives: DrawingPrimitive[] = [];
  if (architecturalDrawing) {
    planAnnotationPrimitives.push({
      kind: 'text',
      key: 'plan-title',
      x: surfaceSize.width / 2,
      y: isRoofPlanView ? 24 : 30,
      text: planViewTitle(active2DView),
      anchor: 'middle',
      size: isRoofPlanView ? 11 : 12,
      weight: 'bold',
      data: { 'data-drawing-annotation': 'plan-title' },
    });
  }

  const renderDimensionGraphic = (params: {
    id: string;
    start: { x: number; z: number };
    end: { x: number; z: number };
    offsetPoint: { x: number; z: number };
    kind: DesignDimensionAnnotation['dimensionKind'];
    label?: string;
    preview?: boolean;
    selected?: boolean;
  }) => {
    const start = planToSurfacePoint(params.start);
    const end = planToSurfacePoint(params.end);
    const offset = planToSurfacePoint(params.offsetPoint);
    const measured = measuredDimensionValue(params.start, params.end, params.kind);
    const selectedStroke = '#0891b2';
    const color = params.preview ? previewStroke : params.selected ? selectedStroke : drawingStyle.lineStroke;
    const referenceColor = params.preview ? previewStroke : params.selected ? selectedStroke : drawingStyle.referenceStroke;
    const dimensionStrokeWidth = params.preview ? 1.8 : params.selected ? 2 : 1.1;
    const referenceStrokeWidth = params.preview ? 1.2 : params.selected ? 1.1 : 0.8;
    const label = params.label ?? `${measured.toFixed(2)} m`;
    let d1 = { x: start.sx, y: start.sy };
    let d2 = { x: end.sx, y: end.sy };
    if (params.kind === 'horizontal') {
      d1 = { x: start.sx, y: offset.sy };
      d2 = { x: end.sx, y: offset.sy };
    } else if (params.kind === 'vertical') {
      d1 = { x: offset.sx, y: start.sy };
      d2 = { x: offset.sx, y: end.sy };
    } else {
      const dx = end.sx - start.sx;
      const dy = end.sy - start.sy;
      const length = Math.max(1, Math.hypot(dx, dy));
      const normal = { x: -dy / length, y: dx / length };
      const midpoint = { x: (start.sx + end.sx) / 2, y: (start.sy + end.sy) / 2 };
      const offsetDistance = (offset.sx - midpoint.x) * normal.x + (offset.sy - midpoint.y) * normal.y;
      d1 = { x: start.sx + normal.x * offsetDistance, y: start.sy + normal.y * offsetDistance };
      d2 = { x: end.sx + normal.x * offsetDistance, y: end.sy + normal.y * offsetDistance };
    }
    const tick = 5;
    const textX = (d1.x + d2.x) / 2;
    const textY = (d1.y + d2.y) / 2 - 6;
    return (
      <g
        key={params.id}
        pointerEvents="none"
        data-canvas-layer={params.preview ? 'active-dimension-preview' : 'permanent-dimensions'}
        data-dimension-id={params.id}
        data-dimension-selected={params.selected ? 'true' : undefined}
      >
        <line x1={start.sx} y1={start.sy} x2={d1.x} y2={d1.y} stroke={referenceColor} strokeWidth={referenceStrokeWidth} strokeDasharray={params.preview ? '4 3' : undefined} />
        <line x1={end.sx} y1={end.sy} x2={d2.x} y2={d2.y} stroke={referenceColor} strokeWidth={referenceStrokeWidth} strokeDasharray={params.preview ? '4 3' : undefined} />
        <line x1={d1.x} y1={d1.y} x2={d2.x} y2={d2.y} stroke={color} strokeWidth={dimensionStrokeWidth} />
        <line x1={d1.x - tick} y1={d1.y + tick} x2={d1.x + tick} y2={d1.y - tick} stroke={color} strokeWidth={dimensionStrokeWidth} />
        <line x1={d2.x - tick} y1={d2.y + tick} x2={d2.x + tick} y2={d2.y - tick} stroke={color} strokeWidth={dimensionStrokeWidth} />
        <text
          x={textX}
          y={textY}
          textAnchor="middle"
          fill={params.preview ? previewStroke : params.selected ? selectedStroke : drawingStyle.textFill}
          fontSize={10}
          fontWeight={700}
          paintOrder="stroke"
          stroke={textBackerStroke}
          strokeWidth={3}
        >
          {label}
        </text>
      </g>
    );
  };

  const renderedDimensionAnnotations = visibleDimensionAnnotations
    .map((annotation) =>
      renderDimensionGraphic({
        id: annotation.id,
        start: annotation.points.start,
        end: annotation.points.end,
        offsetPoint: annotation.offsetPoint,
        kind: annotation.dimensionKind,
        label: annotation.labelOverride,
        selected: annotation.id === selectedAnnotationId,
      }),
    );

  const renderAngleGraphic = (params: {
    id: string;
    start: { x: number; z: number };
    vertex: { x: number; z: number };
    end: { x: number; z: number };
    label?: string;
    preview?: boolean;
  }) => {
    const start = planToSurfacePoint(params.start);
    const vertex = planToSurfacePoint(params.vertex);
    const end = planToSurfacePoint(params.end);
    const measured = measuredAngleDegrees(params.start, params.vertex, params.end);
    const color = params.preview ? previewStroke : drawingStyle.lineStroke;
    const radius = Math.max(18, Math.min(48, Math.hypot(start.sx - vertex.sx, start.sy - vertex.sy) * 0.35, Math.hypot(end.sx - vertex.sx, end.sy - vertex.sy) * 0.35));
    const rawStartDegrees = (Math.atan2(start.sy - vertex.sy, start.sx - vertex.sx) * 180) / Math.PI;
    const rawEndDegrees = (Math.atan2(end.sy - vertex.sy, end.sx - vertex.sx) * 180) / Math.PI;
    let arcStartDegrees = rawStartDegrees;
    let arcEndDegrees = rawEndDegrees;
    let sweepDegrees = ((arcEndDegrees - arcStartDegrees) % 360 + 360) % 360;
    if (sweepDegrees > 180) {
      arcStartDegrees = rawEndDegrees;
      arcEndDegrees = rawStartDegrees;
      sweepDegrees = 360 - sweepDegrees;
    }
    const startRadians = (arcStartDegrees * Math.PI) / 180;
    const endRadians = (arcEndDegrees * Math.PI) / 180;
    const arcStart = {
      x: vertex.sx + Math.cos(startRadians) * radius,
      y: vertex.sy + Math.sin(startRadians) * radius,
    };
    const arcEnd = {
      x: vertex.sx + Math.cos(endRadians) * radius,
      y: vertex.sy + Math.sin(endRadians) * radius,
    };
    const midRadians = ((arcStartDegrees + sweepDegrees / 2) * Math.PI) / 180;
    const labelPoint = {
      x: vertex.sx + Math.cos(midRadians) * (radius + 16),
      y: vertex.sy + Math.sin(midRadians) * (radius + 16),
    };
    const label = params.label ?? `${measured.toFixed(0)}°`;
    return (
      <g key={params.id} pointerEvents="none" data-canvas-layer={params.preview ? 'active-angle-preview' : 'permanent-angles'} data-angle-id={params.id}>
        <line x1={vertex.sx} y1={vertex.sy} x2={start.sx} y2={start.sy} stroke={color} strokeWidth={params.preview ? 1.5 : 1} strokeDasharray={params.preview ? '4 3' : undefined} />
        <line x1={vertex.sx} y1={vertex.sy} x2={end.sx} y2={end.sy} stroke={color} strokeWidth={params.preview ? 1.5 : 1} strokeDasharray={params.preview ? '4 3' : undefined} />
        <path
          d={`M ${arcStart.x} ${arcStart.y} A ${radius} ${radius} 0 0 1 ${arcEnd.x} ${arcEnd.y}`}
          fill="none"
          stroke={color}
          strokeWidth={params.preview ? 1.8 : 1.2}
        />
        <text
          x={labelPoint.x}
          y={labelPoint.y}
          textAnchor="middle"
          fill={params.preview ? previewStroke : drawingStyle.textFill}
          fontSize={10}
          fontWeight={700}
          paintOrder="stroke"
          stroke={textBackerStroke}
          strokeWidth={3}
        >
          {label}
        </text>
      </g>
    );
  };

  const renderedAngleAnnotations = annotations
    .filter((annotation): annotation is DesignAngleAnnotation => annotation.type === 'angle' && annotation.viewType === active2DView)
    .map((annotation) =>
      renderAngleGraphic({
        id: annotation.id,
        start: annotation.points.start,
        vertex: annotation.points.vertex,
        end: annotation.points.end,
        label: annotation.labelOverride ?? `${annotation.measuredValueDegrees.toFixed(0)}°`,
      }),
    );

  const renderedAnglePreview =
    angleDraft?.step === 'end' && angleDraft.previewEnd
      ? renderAngleGraphic({
          id: 'angle-preview',
          start: angleDraft.start.point,
          vertex: angleDraft.vertex.point,
          end: angleDraft.previewEnd.point,
          preview: true,
        })
      : null;

  const renderedDimensionPreview =
    dimensionDraft?.step === 'offset'
      ? renderDimensionGraphic({
          id: 'dimension-preview',
          start: dimensionDraft.start.point,
          end: dimensionDraft.end.point,
          offsetPoint: dimensionDraft.offsetPoint,
          kind: inferDimensionKind(dimensionDraft.start.point, dimensionDraft.end.point),
          preview: true,
        })
      : null;

  const renderPlanMaterialStrip = (
    key: string,
    startPoint: { x: number; z: number },
    endPoint: { x: number; z: number },
    widthMeters: number,
    options: {
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
      opacity?: number;
      strokeDasharray?: string;
      data?: Record<string, string>;
    } = {},
  ) => {
    const start = planToSurfacePoint(startPoint);
    const end = planToSurfacePoint(endPoint);
    const dx = end.sx - start.sx;
    const dy = end.sy - start.sy;
    const length = Math.hypot(dx, dy);
    if (length < 2) return null;
    const half = Math.max(1.5, (Math.max(0.01, widthMeters) * viewport.zoom) / 2);
    const nx = (-dy / length) * half;
    const ny = (dx / length) * half;
    const points = [
      `${start.sx + nx},${start.sy + ny}`,
      `${end.sx + nx},${end.sy + ny}`,
      `${end.sx - nx},${end.sy - ny}`,
      `${start.sx - nx},${start.sy - ny}`,
    ].join(' ');
    return (
      <polygon
        key={key}
        points={points}
        fill={options.fill ?? 'none'}
        stroke={options.stroke ?? permanentStroke}
        strokeWidth={options.strokeWidth ?? drawingStyle.weights.light}
        strokeDasharray={options.strokeDasharray}
        opacity={options.opacity ?? 1}
        strokeLinejoin="round"
        pointerEvents="none"
        {...options.data}
      />
    );
  };

  const renderRoofPlanDrawing = () => {
    if (!isRoofPlanView) return null;
    if (!resolvedRoofSystem?.supported || roofPlanPerimeter.length < 3) {
      return (
        <g pointerEvents="none" data-canvas-layer="roof-plan">
          <text
            x={surfaceSize.width / 2}
            y={78}
            textAnchor="middle"
            fill={mutedStroke}
            fontSize={11}
            fontWeight={700}
            data-roof-plan-warning="true"
          >
            Complex roof geometry needs manual refinement
          </text>
        </g>
      );
    }

    const polygonPoints = roofPlanPerimeter
      .map((point) => {
        const surface = planToSurfacePoint(point);
        return `${surface.sx},${surface.sy}`;
      })
      .join(' ');
    const roof = resolvedRoofSystem;
    const pitch = roofPitchLabel(roof);
    const ridgeStart = roof.ridgeStart ? { x: roof.ridgeStart.x, z: roof.ridgeStart.z } : null;
    const ridgeEnd = roof.ridgeEnd ? { x: roof.ridgeEnd.x, z: roof.ridgeEnd.z } : null;
    const ridgeVector = ridgeStart && ridgeEnd ? { x: ridgeEnd.x - ridgeStart.x, z: ridgeEnd.z - ridgeStart.z } : { x: 1, z: 0 };
    const ridgeLength = Math.max(0.001, Math.hypot(ridgeVector.x, ridgeVector.z));
    const ridgeUnit = { x: ridgeVector.x / ridgeLength, z: ridgeVector.z / ridgeLength };
    const hatchNormal = { x: -ridgeUnit.z, z: ridgeUnit.x };
    const roofPlanProjectionSpan = roofPlanBounds
      ? Math.max(roofPlanBounds.maxX - roofPlanBounds.minX, roofPlanBounds.maxZ - roofPlanBounds.minZ)
      : 0;
    const renderPlanMemberFootprint = (
      key: string,
      startPoint: { x: number; z: number },
      endPoint: { x: number; z: number },
      widthMeters: number,
      options: {
        fill?: string;
        stroke?: string;
        strokeWidth?: number;
        opacity?: number;
        data?: Record<string, string>;
        clip?: boolean;
      } = {},
    ) => {
      const start = planToSurfacePoint(startPoint);
      const end = planToSurfacePoint(endPoint);
      const dx = end.sx - start.sx;
      const dy = end.sy - start.sy;
      const length = Math.hypot(dx, dy);
      if (length < 2) return null;
      const half = Math.max(1.5, (Math.max(0.01, widthMeters) * viewport.zoom) / 2);
      const nx = (-dy / length) * half;
      const ny = (dx / length) * half;
      const points = [
        `${start.sx + nx},${start.sy + ny}`,
        `${end.sx + nx},${end.sy + ny}`,
        `${end.sx - nx},${end.sy - ny}`,
        `${start.sx - nx},${start.sy - ny}`,
      ].join(' ');
      return (
        <polygon
          key={key}
          points={points}
          fill={options.fill ?? (architecturalDrawing ? '#e5e7eb' : '#475569')}
          stroke={options.stroke ?? permanentStroke}
          strokeWidth={options.strokeWidth ?? drawingStyle.weights.light}
          opacity={options.opacity ?? 1}
          clipPath={options.clip === false ? undefined : `url(#${roofClipId})`}
          strokeLinejoin="round"
          pointerEvents="none"
          {...options.data}
        />
      );
    };
    const hatchLines = roofPlanDisplay.showHatch && roofPlanBounds
      ? Array.from({ length: Math.max(0, Math.ceil(((roofPlanBounds.maxX - roofPlanBounds.minX) + (roofPlanBounds.maxZ - roofPlanBounds.minZ)) / 0.35)) }, (_, index) => {
          const offset = index * 0.35 - (roofPlanBounds.maxX - roofPlanBounds.minX + roofPlanBounds.maxZ - roofPlanBounds.minZ) / 2;
          const center = { x: roofPlanBounds.centerX + hatchNormal.x * offset, z: roofPlanBounds.centerZ + hatchNormal.z * offset };
          const half = Math.max(roofPlanBounds.maxX - roofPlanBounds.minX, roofPlanBounds.maxZ - roofPlanBounds.minZ) * 0.75;
          const start = planToSurfacePoint({ x: center.x - ridgeUnit.x * half, z: center.z - ridgeUnit.z * half });
          const end = planToSurfacePoint({ x: center.x + ridgeUnit.x * half, z: center.z + ridgeUnit.z * half });
          return (
            <line
              key={`roof-hatch-${index}`}
              x1={start.sx}
              y1={start.sy}
              x2={end.sx}
              y2={end.sy}
              stroke={referenceStroke}
              strokeWidth={0.8}
              strokeOpacity={0.2}
              clipPath={`url(#${roofClipId})`}
              data-roof-plan-hatch="true"
            />
          );
        })
      : [];
    const purlinFootprints = roof.purlinPlacements.map((purlin) =>
      renderPlanMemberFootprint(
        purlin.id,
        { x: purlin.start.x, z: purlin.start.z },
        { x: purlin.end.x, z: purlin.end.z },
        PURLIN_PROFILE_WIDTH_METERS,
        {
          fill: architecturalDrawing ? '#f1f5f9' : '#475569',
          stroke: mutedStroke,
          strokeWidth: drawingStyle.weights.light,
          opacity: 0.9,
          data: { 'data-roof-plan-purlin': purlin.slopePlaneId },
        },
      ),
    );
    const inferredPurlinLines = roof.purlinPlacements.length === 0 && roofPlanDisplay.showHatch && roofPlanBounds
      ? Array.from({ length: Math.max(0, Math.floor(roofPlanProjectionSpan / 0.65) + 1) }, (_, index) => {
          const count = Math.max(1, Math.floor(roofPlanProjectionSpan / 0.65) + 1);
          const offset = (index / Math.max(1, count - 1) - 0.5) * roofPlanProjectionSpan;
          const center = { x: roofPlanBounds.centerX + hatchNormal.x * offset, z: roofPlanBounds.centerZ + hatchNormal.z * offset };
          const half = roofPlanProjectionSpan * 0.72;
          const start = planToSurfacePoint({ x: center.x - ridgeUnit.x * half, z: center.z - ridgeUnit.z * half });
          const end = planToSurfacePoint({ x: center.x + ridgeUnit.x * half, z: center.z + ridgeUnit.z * half });
          return (
            <line
              key={`roof-inferred-purlin-${index}`}
              x1={start.sx}
              y1={start.sy}
              x2={end.sx}
              y2={end.sy}
              stroke={mutedStroke}
              strokeWidth={drawingStyle.weights.light + 0.35}
              strokeOpacity={0.58}
              clipPath={`url(#${roofClipId})`}
              data-roof-plan-framing-line="inferred-purlin"
            />
          );
        })
      : [];
    const trussMemberFootprints = roof.trussPlacements.flatMap((truss) =>
      truss.members.map((member) => {
        const isPrimary = member.memberKind === 'bottom_chord' || member.memberKind.startsWith('top_chord');
        return renderPlanMemberFootprint(
          `${truss.id}-${member.id}`,
          { x: member.start.x, z: member.start.z },
          { x: member.end.x, z: member.end.z },
          TRUSS_CHORD_PROFILE_METERS,
          {
            fill: isPrimary ? (architecturalDrawing ? '#e5e7eb' : '#334155') : (architecturalDrawing ? '#f8fafc' : '#475569'),
            stroke: isPrimary ? permanentStroke : mutedStroke,
            strokeWidth: isPrimary ? drawingStyle.weights.medium : drawingStyle.weights.light + 0.35,
            opacity: isPrimary ? 0.96 : 0.84,
            data: {
              'data-roof-plan-truss-member': member.memberKind,
              'data-roof-plan-truss-id': truss.id,
            },
          },
        );
      }),
    );
    const hipMemberFootprints = roof.hipFramingMembers.map((member) => {
      const isPrimary = member.memberKind === 'ridge' || member.memberKind === 'hip';
      const isSupportFrame = member.memberKind.startsWith('ridge_end_frame') || member.memberKind === 'hip_corner_support';
      return renderPlanMemberFootprint(
        member.id,
        { x: member.start.x, z: member.start.z },
        { x: member.end.x, z: member.end.z },
        TRUSS_CHORD_PROFILE_METERS,
        {
          fill: isPrimary
            ? (architecturalDrawing ? '#e5e7eb' : '#334155')
            : (architecturalDrawing ? '#f8fafc' : '#475569'),
          stroke: isPrimary ? permanentStroke : mutedStroke,
          strokeWidth: isPrimary ? drawingStyle.weights.medium : drawingStyle.weights.light + 0.35,
          opacity: isPrimary ? 0.96 : isSupportFrame ? 0.78 : 0.86,
          data: {
            'data-roof-plan-member': member.memberKind,
            'data-roof-plan-hip-framing-member': member.memberKind,
            'data-roof-plan-hip-framing-id': member.id,
            ...(member.slopePlaneId ? { 'data-roof-plan-slope-plane': member.slopePlaneId } : {}),
          },
        },
      );
    });
    const inferredTrussLines = roof.trussPlacements.length === 0 && ridgeStart && ridgeEnd && roofPlanBounds
      ? Array.from({ length: Math.max(2, Math.floor(ridgeLength / 0.8) + 1) }, (_, index) => {
          const count = Math.max(2, Math.floor(ridgeLength / 0.8) + 1);
          const t = index / Math.max(1, count - 1);
          const ridgePoint = {
            x: ridgeStart.x + ridgeVector.x * t,
            z: ridgeStart.z + ridgeVector.z * t,
          };
          const half = roofPlanProjectionSpan * 0.58;
          const start = planToSurfacePoint({ x: ridgePoint.x - hatchNormal.x * half, z: ridgePoint.z - hatchNormal.z * half });
          const end = planToSurfacePoint({ x: ridgePoint.x + hatchNormal.x * half, z: ridgePoint.z + hatchNormal.z * half });
          return (
            <line
              key={`roof-inferred-truss-${index}`}
              x1={start.sx}
              y1={start.sy}
              x2={end.sx}
              y2={end.sy}
              stroke={permanentStroke}
              strokeWidth={drawingStyle.weights.light + 0.5}
              strokeOpacity={0.62}
              clipPath={`url(#${roofClipId})`}
              data-roof-plan-framing-line="inferred-truss"
            />
          );
        })
      : [];
    const planeLines = roof.roofTopPlanes.map((plane) => (
      <polyline
        key={`roof-plane-${plane.id}`}
        points={[...plane.corners, plane.corners[0]!]
          .filter(Boolean)
          .map((corner) => {
            const surface = planToSurfacePoint({ x: corner.x, z: corner.z });
            return `${surface.sx},${surface.sy}`;
          })
          .join(' ')}
        fill="none"
        stroke={referenceStroke}
        strokeWidth={drawingStyle.weights.light + 0.2}
        strokeOpacity={0.68}
        pointerEvents="none"
        data-roof-plan-plane={plane.id}
      />
    ));
    const slopeArrows = roofPlanDisplay.showSlopeArrows
      ? roof.roofTopPlanes.map((plane) => {
          const centroid = plane.corners.reduce((sum, corner) => ({ x: sum.x + corner.x, z: sum.z + corner.z }), { x: 0, z: 0 });
          centroid.x /= Math.max(1, plane.corners.length);
          centroid.z /= Math.max(1, plane.corners.length);
          const ridgeMid = ridgeStart && ridgeEnd
            ? { x: (ridgeStart.x + ridgeEnd.x) / 2, z: (ridgeStart.z + ridgeEnd.z) / 2 }
            : { x: roofPlanBounds?.centerX ?? centroid.x, z: roofPlanBounds?.centerZ ?? centroid.z };
          const direction = { x: centroid.x - ridgeMid.x, z: centroid.z - ridgeMid.z };
          const length = Math.max(0.001, Math.hypot(direction.x, direction.z));
          const unit = length > 0.001 ? { x: direction.x / length, z: direction.z / length } : { x: 0, z: 1 };
          const arrowStart = planToSurfacePoint({ x: centroid.x - unit.x * 0.32, z: centroid.z - unit.z * 0.32 });
          const arrowEnd = planToSurfacePoint({ x: centroid.x + unit.x * 0.42, z: centroid.z + unit.z * 0.42 });
          const headLeft = planToSurfacePoint({ x: centroid.x + unit.x * 0.28 - unit.z * 0.12, z: centroid.z + unit.z * 0.28 + unit.x * 0.12 });
          const headRight = planToSurfacePoint({ x: centroid.x + unit.x * 0.28 + unit.z * 0.12, z: centroid.z + unit.z * 0.28 - unit.x * 0.12 });
          return (
            <g key={`roof-slope-${plane.id}`} pointerEvents="none" data-roof-plan-slope-arrow={plane.id}>
              <line x1={arrowStart.sx} y1={arrowStart.sy} x2={arrowEnd.sx} y2={arrowEnd.sy} stroke={mutedStroke} strokeWidth={1.4} />
              <polyline points={`${headLeft.sx},${headLeft.sy} ${arrowEnd.sx},${arrowEnd.sy} ${headRight.sx},${headRight.sy}`} fill="none" stroke={mutedStroke} strokeWidth={1.4} />
              {pitch ? (
                <text
                  x={arrowEnd.sx + 6}
                  y={arrowEnd.sy - 6}
                  fill={drawingStyle.textFill}
                  fontSize={9}
                  fontWeight={700}
                  paintOrder="stroke"
                  stroke={textBackerStroke}
                  strokeWidth={2.5}
                >
                  {pitch}
                </text>
              ) : null}
            </g>
          );
        })
      : [];

    return (
      <g pointerEvents="none" data-canvas-layer="roof-plan" data-roof-plan-type={roof.roofType}>
        <defs>
          <clipPath id={roofClipId}>
            <polygon points={polygonPoints} />
          </clipPath>
        </defs>
        {roofPlanDisplay.showReferenceLines && roof.structuralBearingPerimeter.length >= 3 ? (
          <polygon
            points={roof.structuralBearingPerimeter
              .map((point) => {
                const surface = planToSurfacePoint({ x: point.x, z: point.z });
                return `${surface.sx},${surface.sy}`;
              })
              .join(' ')}
            fill="none"
            stroke={referenceStroke}
            strokeWidth={drawingStyle.weights.light}
            strokeDasharray="8 5"
            strokeOpacity={0.54}
            data-roof-plan-bearing="true"
          />
        ) : null}
        <polygon
          points={polygonPoints}
          fill={architecturalDrawing ? '#f8fafc' : 'none'}
          fillOpacity={0.36}
          stroke={selectedObjectType === 'gable_roof_system' ? selectionStroke : permanentStroke}
          strokeWidth={selectedObjectType === 'gable_roof_system' ? drawingStyle.weights.selection : drawingStyle.weights.medium + 0.6}
          data-roof-plan-outline="true"
        />
        {hatchLines}
        {inferredPurlinLines}
        {purlinFootprints}
        {planeLines}
        {inferredTrussLines}
        {trussMemberFootprints}
        {hipMemberFootprints}
        {ridgeStart && ridgeEnd ? (
          <>
            {(roof.ridgeCapPlacements.length > 0
              ? roof.ridgeCapPlacements
              : roof.ridgeCapPlacement
                ? [roof.ridgeCapPlacement]
                : [{
                    id: 'fallback',
                    start: { ...ridgeStart, y: roof.peakElevationMeters },
                    end: { ...ridgeEnd, y: roof.peakElevationMeters },
                    widthMeters: DEFAULT_RIDGE_CAP_WIDTH_METERS,
                  }]
            ).map((cap) =>
              renderPlanMemberFootprint(
                `roof-ridge-cap-${cap.id}`,
                { x: cap.start.x, z: cap.start.z },
                { x: cap.end.x, z: cap.end.z },
                cap.widthMeters,
                {
                  fill: architecturalDrawing ? '#d1d5db' : '#64748b',
                  stroke: selectedObjectType === 'gable_roof_system' ? selectionStroke : permanentStroke,
                  strokeWidth: selectedObjectType === 'gable_roof_system' ? drawingStyle.weights.selection : drawingStyle.weights.medium,
                  opacity: 0.96,
                  data: {
                    'data-roof-plan-ridge': 'true',
                    'data-roof-plan-ridge-cap': 'true',
                    'data-roof-plan-covering': 'ridge_cap',
                  },
                  clip: false,
                },
              ),
            )}
            <text
              x={planToSurfacePoint({ x: (ridgeStart.x + ridgeEnd.x) / 2, z: (ridgeStart.z + ridgeEnd.z) / 2 }).sx}
              y={planToSurfacePoint({ x: (ridgeStart.x + ridgeEnd.x) / 2, z: (ridgeStart.z + ridgeEnd.z) / 2 }).sy - 10}
              textAnchor="middle"
              fill={drawingStyle.textFill}
              fontSize={8.5}
              fontWeight={700}
              paintOrder="stroke"
              stroke={textBackerStroke}
              strokeWidth={2.5}
              data-roof-plan-callout="ridge"
            >
              {`RIDGE ${roof.ridgeLengthMeters.toFixed(2)} m`}
            </text>
          </>
        ) : null}
        {slopeArrows}
        {roofPlanDisplay.showDimensions && roofPlanBounds ? (
          <>
            {renderDimensionGraphic({
              id: 'roof-overall-length',
              start: { x: roofPlanBounds.minX, z: roofPlanBounds.maxZ },
              end: { x: roofPlanBounds.maxX, z: roofPlanBounds.maxZ },
              offsetPoint: { x: roofPlanBounds.centerX, z: roofPlanBounds.maxZ + 0.95 },
              kind: 'horizontal',
            })}
            {renderDimensionGraphic({
              id: 'roof-overall-width',
              start: { x: roofPlanBounds.maxX, z: roofPlanBounds.minZ },
              end: { x: roofPlanBounds.maxX, z: roofPlanBounds.maxZ },
              offsetPoint: { x: roofPlanBounds.maxX + 0.75, z: roofPlanBounds.centerZ },
              kind: 'vertical',
            })}
          </>
        ) : null}
      </g>
    );
  };

  const renderTrussReferenceSheet = () => {
    if (!isRoofPlanView || !trussDesignSummary || !trussReferenceSheetPlacement) return null;

    const sheetOriginSurface = planToSurfacePoint(trussReferenceSheetPlacement.origin);

    return (
      <g
        pointerEvents="none"
        data-canvas-layer="roof-truss-reference-sheet"
        data-testid="roof-truss-reference-sheet"
        data-reference-sheet-placement="model-space"
        data-origin-x-meters={trussReferenceSheetPlacement.origin.x.toFixed(3)}
        data-origin-z-meters={trussReferenceSheetPlacement.origin.z.toFixed(3)}
        data-sheet-width-meters={trussReferenceSheetPlacement.widthMeters.toFixed(3)}
        data-sheet-height-meters={trussReferenceSheetPlacement.heightMeters.toFixed(3)}
        transform={`translate(${sheetOriginSurface.sx} ${sheetOriginSurface.sy}) scale(${viewport.zoom})`}
      >
        <TrussReferenceSheetDrawing
          summary={trussDesignSummary}
          placement={trussReferenceSheetPlacement}
          drawingStyleMode={drawingStyleMode}
        />
      </g>
    );
  };

  const renderPlanRcComponent = (component: DesignRenderRcComponent, preview = false) => {
    const selected = !preview && selectedComponentId === component.sourceComponentId;
    const center = planToSurfacePoint({ x: component.position.x, z: component.position.z });
    const widthMeters = component.dimensions.width;
    const depthMeters = component.dimensions.depth;
    const lengthMeters = component.dimensions.length ?? widthMeters;
    const widthPx = Math.max(6, widthMeters * viewport.zoom);
    const depthPx = Math.max(6, depthMeters * viewport.zoom);
    const lengthPx = Math.max(8, lengthMeters * viewport.zoom);
    const common = {
      pointerEvents: 'none' as const,
      opacity: preview ? 0.72 : 1,
      'data-component-id': component.id,
      'data-component-type': component.type,
      'data-component-system': component.system,
    };
    if (component.type === 'column') {
      const footerWidthPx = Math.max(widthPx + 10, (component.footer?.widthMeters ?? widthMeters * 2) * viewport.zoom);
      const footerLengthPx = Math.max(depthPx + 10, (component.footer?.lengthMeters ?? depthMeters * 2) * viewport.zoom);
      return (
        <g key={component.id} {...common}>
          {component.footer ? (
            <>
              <rect
                x={center.sx - footerWidthPx / 2}
                y={center.sy - footerLengthPx / 2}
                width={footerWidthPx}
                height={footerLengthPx}
                fill={preview ? previewFill : architecturalDrawing ? '#f1f5f9' : '#78716c55'}
                stroke={preview ? previewStroke : selected ? selectionStroke : architecturalDrawing ? mutedStroke : '#57534e'}
                strokeWidth={selected ? 2 : 1.2}
                strokeDasharray={preview ? '6 4' : undefined}
                data-component-footer-id={component.footer.id}
              />
            </>
          ) : null}
          <rect
            x={center.sx - widthPx / 2}
            y={center.sy - depthPx / 2}
            width={widthPx}
            height={depthPx}
            fill={preview ? previewFill : concreteFill}
            stroke={preview ? previewStroke : selected ? selectionStroke : permanentStroke}
            strokeWidth={preview || selected ? 2 : 1.6}
            strokeDasharray={preview ? '4 3' : undefined}
            data-component-column-body-id={component.id}
          />
          <line x1={center.sx - widthPx * 0.8} y1={center.sy} x2={center.sx + widthPx * 0.8} y2={center.sy} stroke={preview ? previewStroke : referenceStroke} strokeWidth={1} strokeOpacity={preview ? 0.8 : 0.7} />
          <line x1={center.sx} y1={center.sy - depthPx * 0.8} x2={center.sx} y2={center.sy + depthPx * 0.8} stroke={preview ? previewStroke : referenceStroke} strokeWidth={1} strokeOpacity={preview ? 0.8 : 0.7} />
          {selected
            ? [
                [-1, -1],
                [1, -1],
                [1, 1],
                [-1, 1],
              ].map(([dx, dy]) => (
                <rect
                  key={`${component.id}-${dx}-${dy}`}
                  x={center.sx + dx * (widthPx / 2) - 4}
                  y={center.sy + dy * (depthPx / 2) - 4}
                  width={8}
                  height={8}
                  fill={selectionStroke}
                  stroke={textBackerStroke}
                  strokeWidth={1}
                />
              ))
            : null}
        </g>
      );
    }
    if (component.type === 'slab') {
      return (
        <rect
          key={component.id}
          x={center.sx - lengthPx / 2}
          y={center.sy - widthPx / 2}
          width={lengthPx}
          height={widthPx}
          fill={preview ? previewFill : architecturalDrawing ? '#eef2f7' : '#94a3b833'}
          stroke={preview ? previewStroke : selected ? selectionStroke : mutedStroke}
          strokeWidth={preview || selected ? 2 : 1.5}
          strokeDasharray={preview ? '5 4' : undefined}
          {...common}
        />
      );
    }
    if (component.type === 'footer') {
      const markerSizePx = Math.max(6, Math.min(widthPx, depthPx) / 3);
      return (
        <g key={component.id} pointerEvents="none">
          <rect
            x={center.sx - widthPx / 2}
            y={center.sy - depthPx / 2}
            width={widthPx}
            height={depthPx}
            fill={preview ? previewFill : architecturalDrawing ? '#f1f5f9' : '#78716c55'}
            stroke={preview ? previewStroke : selected ? selectionStroke : architecturalDrawing ? mutedStroke : '#57534e'}
            strokeWidth={selected ? 2.2 : preview ? 2 : 1.5}
            {...common}
          />
          <rect
            x={center.sx - markerSizePx / 2}
            y={center.sy - markerSizePx / 2}
            width={markerSizePx}
            height={markerSizePx}
            fill={preview ? previewFill : structuralFill}
            stroke={preview ? previewStroke : selected ? selectionStroke : permanentStroke}
            strokeWidth={preview || selected ? 1.8 : 1.3}
            data-component-footer-column-marker-id={component.id}
          />
          <line
            x1={center.sx - markerSizePx * 0.7}
            y1={center.sy}
            x2={center.sx + markerSizePx * 0.7}
            y2={center.sy}
            stroke={preview ? previewStroke : selected ? selectionStroke : referenceStroke}
            strokeWidth={0.8}
            strokeOpacity={preview ? 0.8 : 0.6}
          />
          <line
            x1={center.sx}
            y1={center.sy - markerSizePx * 0.7}
            x2={center.sx}
            y2={center.sy + markerSizePx * 0.7}
            stroke={preview ? previewStroke : selected ? selectionStroke : referenceStroke}
            strokeWidth={0.8}
            strokeOpacity={preview ? 0.8 : 0.6}
          />
        </g>
      );
    }
    return (
      <rect
        key={component.id}
        x={center.sx - widthPx / 2}
        y={center.sy - depthPx / 2}
        width={widthPx}
        height={depthPx}
        fill={preview ? previewFill : concreteFill}
        stroke={preview ? previewStroke : selected ? selectionStroke : permanentStroke}
        strokeWidth={preview || selected ? 2 : 1.5}
        strokeDasharray={preview ? '4 3' : undefined}
        {...common}
      />
    );
  };

  const helperAnchor = componentPreview?.viewPlacement.plan
    ? planToSurfacePoint({
        x: componentPreview.viewPlacement.plan.xMeters,
        z: componentPreview.viewPlacement.plan.zMeters,
      })
    : null;

  const renderColumnDragPreview = () => {
    if (columnDragState?.status !== 'dragging-column') return null;
    const columns = frameSystem?.columns ?? [];
    const beams = frameSystem?.beams ?? [];
    const draggedColumn = columns.find((column) => column.id === columnDragState.columnId);

    const delta = {
      x: columnDragState.previewPosition.x - columnDragState.originalPosition.x,
      z: columnDragState.previewPosition.z - columnDragState.originalPosition.z,
    };
    const originalCenter = planToSurfacePoint(columnDragState.originalPosition);
    const previewCenter = planToSurfacePoint(columnDragState.previewPosition);
    const halfW = Math.max(4, (columnDragState.widthMeters * viewport.zoom) / 2);
    const halfD = Math.max(4, (columnDragState.depthMeters * viewport.zoom) / 2);
    const connectedBeams =
      columnDragState.source === 'frame' && draggedColumn
        ? beams.filter(
            (beam) => beam.startColumnId === draggedColumn.id || beam.endColumnId === draggedColumn.id,
          )
        : [];
    const moveEndpoint = (point: { x: number; y: number; z: number }, active: boolean) => ({
      x: active ? point.x + delta.x : point.x,
      z: active ? point.z + delta.z : point.z,
    });

    return (
      <g pointerEvents="none" data-column-drag-preview="true" data-column-drag-column-id={columnDragState.columnId}>
        {connectedBeams.map((beam: StructuralBeam) => {
          return renderPlanMaterialStrip(
            `drag-beam-${beam.id}`,
            moveEndpoint(beam.startPoint, beam.startColumnId === columnDragState.columnId),
            moveEndpoint(beam.endPoint, beam.endColumnId === columnDragState.columnId),
            beam.widthMeters,
            {
              fill: 'none',
              stroke: previewStroke,
              strokeWidth: 1.8,
              strokeDasharray: '8 5',
              opacity: 0.88,
              data: { 'data-column-drag-beam-preview': beam.id },
            },
          );
        })}
        {columnDragState.footer ? (
          (() => {
            const center = planToSurfacePoint({
              x: columnDragState.originalPosition.x + delta.x,
              z: columnDragState.originalPosition.z + delta.z,
            });
            const halfFootingW = Math.max(8, (columnDragState.footer.widthMeters * viewport.zoom) / 2);
            const halfFootingL = Math.max(8, (columnDragState.footer.lengthMeters * viewport.zoom) / 2);
            return (
              <g data-column-drag-footer-preview={columnDragState.footer.id}>
                <rect
                  x={center.sx - halfFootingW}
                  y={center.sy - halfFootingL}
                  width={halfFootingW * 2}
                  height={halfFootingL * 2}
                  fill="#22d3ee22"
                  stroke="#67e8f9"
                  strokeWidth={1.6}
                  strokeDasharray="7 4"
                />
                <path
                  d={`M ${center.sx - halfFootingW} ${center.sy + halfFootingL} L ${center.sx + halfFootingW} ${center.sy - halfFootingL}`}
                  stroke="#67e8f9"
                  strokeOpacity={0.58}
                  strokeWidth={1}
                />
              </g>
            );
          })()
        ) : null}
        <rect
          x={originalCenter.sx - halfW}
          y={originalCenter.sy - halfD}
          width={halfW * 2}
          height={halfD * 2}
          fill="none"
          stroke="#94a3b8"
          strokeOpacity={0.68}
          strokeWidth={1.4}
          strokeDasharray="3 4"
          data-column-original-outline="true"
        />
        <line
          x1={originalCenter.sx}
          y1={originalCenter.sy}
          x2={previewCenter.sx}
          y2={previewCenter.sy}
          stroke="#22d3ee"
          strokeOpacity={0.7}
          strokeWidth={1.5}
          strokeDasharray="5 5"
        />
        <rect
          x={previewCenter.sx - halfW}
          y={previewCenter.sy - halfD}
          width={halfW * 2}
          height={halfD * 2}
          fill={structuralFill}
          stroke={previewStroke}
          strokeWidth={2.2}
          strokeDasharray="5 3"
        />
        <rect
          x={previewCenter.sx + 14}
          y={previewCenter.sy + 14}
          width={178}
          height={66}
          rx={6}
          fill="#020617"
          fillOpacity={0.88}
          stroke="#155e75"
          strokeOpacity={0.9}
        />
        <text x={previewCenter.sx + 24} y={previewCenter.sy + 34} fill="#67e8f9" fontSize={11} fontWeight={800} paintOrder="stroke" stroke="#020617" strokeWidth={3}>
          {`Column X ${columnDragState.previewPosition.x.toFixed(2)} m / Y ${columnDragState.previewPosition.z.toFixed(2)} m`}
        </text>
        <text x={previewCenter.sx + 24} y={previewCenter.sy + 52} fill="#cbd5e1" fontSize={11} fontWeight={650} paintOrder="stroke" stroke="#020617" strokeWidth={3}>
          {`Delta ${delta.x >= 0 ? '+' : ''}${delta.x.toFixed(2)} m / ${delta.z >= 0 ? '+' : ''}${delta.z.toFixed(2)} m`}
        </text>
        <text x={previewCenter.sx + 24} y={previewCenter.sy + 70} fill="#cbd5e1" fontSize={11} fontWeight={650} paintOrder="stroke" stroke="#020617" strokeWidth={3}>
          {`Connected beams: ${connectedBeams.length}`}
        </text>
      </g>
    );
  };

  const showPlanNodeMarkers =
    showStructuralPlanGeometry &&
    (!architecturalDrawing ||
      (frameSystem?.columns.length ?? 0) === 0 ||
      toolMode === 'draw_wall' ||
      toolMode === 'move_wall_node' ||
      selectedNodeId != null);

  const plumbingFixturePreview =
    isPlumbingPlanView && activePlumbingFixtureType && !septicTankPlacementActive && cursorPoint
      ? ({
          id: 'plumbing-fixture-preview',
          fixtureType: activePlumbingFixtureType,
          mark: 'PREVIEW',
          displayName: 'Preview fixture',
          position: { x: cursorPoint.x, y: 0, z: cursorPoint.z },
          rotationRadians: plumbingFixtureRotationRad,
          connectionNodeIds: {},
        } satisfies PlumbingFixture)
      : null;

  const septicTankPreview: SepticTankModel | null =
    isPlumbingPlanView && septicTankPlacementActive && cursorPoint
      ? createCmuSepticTank({
          centerX: cursorPoint.x,
          centerZ: cursorPoint.z,
          rotationRad: septicTankPlacementRotationRad,
          idSeed: 'preview',
          now: new Date(0).toISOString(),
        })
      : null;

  const renderPlumbingPlan = () => {
    if (!isPlumbingPlanView || !plumbingSystem) return null;
    return (
      <DrawPlumbingPlan
        layout={layout}
        planDisplayNodeById={planDisplayNodeById}
        project={planToSurfacePoint}
        zoom={viewport.zoom}
        plumbingSystem={plumbingSystem}
        foundationPlanBeams={foundationPlanBeams}
        wallFootings={wallFootings}
        isolatedFootings={isolatedFootings}
        frameSystem={frameSystem}
        fixturePreview={plumbingFixturePreview}
        equipmentPreview={plumbingEquipmentPreview}
        septicTankPreview={septicTankPreview}
        runDraft={plumbingRunDraft}
        selected={selectedPlumbingObject}
        validationIssues={plumbingValidationIssues}
      />
    );
  };

  return (
    <div className="relative h-full min-h-[420px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 text-slate-100 dark:border-slate-700" data-drawing-style-mode={drawingStyleMode}>
      <div
        className="absolute left-3 top-3 rounded-full border border-cyan-700 bg-slate-900/90 px-3 py-1 text-xs font-medium text-cyan-200"
        data-view-grid-meters={planGridState.displayMinorSpacingMeters}
        data-snap-spacing-meters={planGridState.snapSpacingMeters}
      >
        {toolMode === 'draw_wall'
          ? formatDrawWallStatusChip({
              snapMode,
              gridSpacingMeters: layout.gridSpacingMeters,
              orthogonalLock: layout.orthogonalLock,
              shiftConstraintLabel,
              snapTarget,
            })
          : (
            <>
              Plan layout · {layout.dimensionBasis === 'outside_face' ? 'Outside face' : layout.dimensionBasis} · View grid{' '}
              {formatPlanGridSpacingMeters(planGridState.displayMinorSpacingMeters)} · Snap{' '}
              {snapMode === 'off' ? 'off' : formatPlanGridSpacingMeters(planGridState.snapSpacingMeters)}
            </>
          )}
      </div>
      {layout.segments.length === 0 ? (
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-lg bg-slate-900/70 px-3 py-1.5 text-xs text-slate-300">
          {DESIGN_BUILDER_COPY.hints.blankPlan}
        </div>
      ) : null}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${surfaceSize.width} ${surfaceSize.height}`}
        preserveAspectRatio="none"
        className="plan-surface h-full w-full overscroll-contain touch-none"
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onContextMenu={handleContextMenu}
        aria-label="Design Builder wall layout plan view"
      >
        <rect width={surfaceSize.width} height={surfaceSize.height} fill={viewportBackerFill} data-canvas-layer="background" />
        <rect
          x={architecturalDrawing ? 18 : 0}
          y={architecturalDrawing ? 18 : 0}
          width={architecturalDrawing ? Math.max(0, surfaceSize.width - 36) : surfaceSize.width}
          height={architecturalDrawing ? Math.max(0, surfaceSize.height - 36) : surfaceSize.height}
          fill={sheetBackerFill}
          stroke={architecturalDrawing ? drawingStyle.sheetStroke : 'none'}
          strokeWidth={architecturalDrawing ? 1 : 0}
          pointerEvents="none"
          data-canvas-layer="drawing-sheet"
        />
        {gridLines}
        <line x1={xAxisStart.sx} y1={xAxisStart.sy} x2={xAxisEnd.sx} y2={xAxisEnd.sy} stroke={referenceStroke} strokeWidth={1.2} strokeOpacity={0.7} pointerEvents="none" data-axis="x" />
        <line x1={yAxisStart.sx} y1={yAxisStart.sy} x2={yAxisEnd.sx} y2={yAxisEnd.sy} stroke={referenceStroke} strokeWidth={1.2} strokeOpacity={0.7} pointerEvents="none" data-axis="y" />
        <line x1={originPoint.sx - 10} y1={originPoint.sy} x2={originPoint.sx + 10} y2={originPoint.sy} stroke={referenceStroke} strokeWidth={1.4} pointerEvents="none" data-origin-crosshair="x" />
        <line x1={originPoint.sx} y1={originPoint.sy - 10} x2={originPoint.sx} y2={originPoint.sy + 10} stroke={referenceStroke} strokeWidth={1.4} pointerEvents="none" data-origin-crosshair="y" />
        <circle cx={originPoint.sx} cy={originPoint.sy} r={4} fill={referenceStroke} pointerEvents="none" data-origin-marker="true" />
        <text x={originPoint.sx + 8} y={originPoint.sy - 8} fill={drawingStyle.textFill} fontSize={10} fontWeight={700} pointerEvents="none">0,0</text>
        <text x={xAxisEnd.sx - 6} y={originPoint.sy - 6} textAnchor="end" fill={mutedStroke} fontSize={10} fontWeight={600} pointerEvents="none">+X East</text>
        <text x={originPoint.sx + 6} y={yAxisStart.sy + 14} fill={mutedStroke} fontSize={10} fontWeight={600} pointerEvents="none">+Y North</text>
        {planAnnotationPrimitives.map((primitive) => renderDrawingPrimitive(primitive, drawingStyle))}
        {PLAN_RULER_TICKS_METERS.flatMap((tick) => {
          const marks = [];
          if (tick >= visibleBounds.minX && tick <= visibleBounds.maxX) {
            const alongX = planToSurfacePoint({ x: tick, z: 0 });
            marks.push(
              <g key={`tick-x-${tick}`} pointerEvents="none">
                <line x1={alongX.sx} y1={originPoint.sy - 4} x2={alongX.sx} y2={originPoint.sy + 4} stroke={referenceStroke} strokeWidth={1} />
                <text x={alongX.sx} y={originPoint.sy + 14} textAnchor="middle" fill={mutedStroke} fontSize={9}>{tick} m</text>
              </g>,
            );
          }
          if (tick !== 0 && tick >= visibleBounds.minZ && tick <= visibleBounds.maxZ) {
            const alongZ = planToSurfacePoint({ x: 0, z: tick });
            marks.push(
              <g key={`tick-z-${tick}`} pointerEvents="none">
                <line x1={originPoint.sx - 4} y1={alongZ.sy} x2={originPoint.sx + 4} y2={alongZ.sy} stroke={referenceStroke} strokeWidth={1} />
                <text x={originPoint.sx - 8} y={alongZ.sy + 3} textAnchor="end" fill={mutedStroke} fontSize={9}>{tick} m</text>
              </g>,
            );
          }
          return marks;
        })}
        {!isRoofPlanView ? (
          <>
            <text x={surfaceSize.width / 2} y={architecturalDrawing ? 52 : 18} textAnchor="middle" fill={mutedStroke} fontSize={11} fontWeight={700} pointerEvents="none">North (+Y)</text>
            <text x={surfaceSize.width / 2} y={surfaceSize.height - 10} textAnchor="middle" fill={mutedStroke} fontSize={11} fontWeight={700} pointerEvents="none">South</text>
            <text x={surfaceSize.width - 12} y={surfaceSize.height / 2} textAnchor="end" fill={mutedStroke} fontSize={11} fontWeight={700} pointerEvents="none">East (+X)</text>
            <text x={12} y={surfaceSize.height / 2} textAnchor="start" fill={mutedStroke} fontSize={11} fontWeight={700} pointerEvents="none">West</text>
          </>
        ) : null}
        {renderRoofPlanDrawing()}
        {renderTrussReferenceSheet()}
        {showStructuralPlanGeometry ? layout.segments.map((segment) => {
          const endpoints = resolveSegmentDisplayEndpoints({
            segment,
            layout,
            planDisplayNodeById,
          });
          if (!endpoints) return null;
          const { displayStart, displayEnd } = endpoints;
          const selected = selectedSegmentId === segment.id;
          const stroke = toolMode === 'delete' && selected ? '#f97316' : selected ? selectionStroke : permanentStroke;
          const strokeWidth = selected ? drawingStyle.weights.selection + 2 : drawingStyle.weights.heavy;
          const frame = framesBySegmentId.get(segment.id);
          const roughOpenings = roughOpeningsBySegmentId.get(segment.id) ?? [];
          if (frame && roughOpenings.length > 0) {
            const runs = buildWallRunsExcludingRoughOpenings({
              segmentLengthMeters: frame.lengthMeters,
              roughOpenings,
            });
            return (
              <g key={segment.id}>
                {runs.map((run, index) => {
                  const runEndpoints = resolvePlanWallRunEndpoints({
                    frame,
                    run,
                    displayStart,
                    displayEnd,
                  });
                  const runStart = planToSurfacePoint(runEndpoints.start);
                  const runEnd = planToSurfacePoint(runEndpoints.end);
                  return (
                    <g key={`${segment.id}-run-${index}`}>
                      <line
                        x1={runStart.sx}
                        y1={runStart.sy}
                        x2={runEnd.sx}
                        y2={runEnd.sy}
                        stroke="transparent"
                        strokeWidth={18}
                        strokeLinecap="round"
                        pointerEvents="none"
                        data-selectable="true"
                        data-selectable-type="wall_segment"
                        data-segment-id={segment.id}
                      />
                      <line
                        x1={runStart.sx}
                        y1={runStart.sy}
                        x2={runEnd.sx}
                        y2={runEnd.sy}
                        stroke={stroke}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        pointerEvents="none"
                        data-segment-id={segment.id}
                        data-wall-run="true"
                        data-plan-wall-visible="true"
                      />
                    </g>
                  );
                })}
              </g>
            );
          }
          const wallFootprint =
            frame && segment.wallRole === 'partition'
              ? buildSegmentPlanFootprint(
                frame,
                partitionWallFootprintEndpointAdjustmentsBySegmentId.get(segment.id),
              )
              : null;
          if (wallFootprint) {
            const footprintPoints = wallFootprint.corners
              .map((point) => {
                const screenPoint = planToSurfacePoint(point);
                return `${screenPoint.sx},${screenPoint.sy}`;
              })
              .join(' ');
            const faceAStart = planToSurfacePoint(wallFootprint.faceA.start);
            const faceAEnd = planToSurfacePoint(wallFootprint.faceA.end);
            const faceBStart = planToSurfacePoint(wallFootprint.faceB.start);
            const faceBEnd = planToSurfacePoint(wallFootprint.faceB.end);
            const centerStart = planToSurfacePoint(frame.centerlineStart);
            const centerEnd = planToSurfacePoint(frame.centerlineEnd);
            return (
              <g key={segment.id}>
                <line
                  x1={centerStart.sx}
                  y1={centerStart.sy}
                  x2={centerEnd.sx}
                  y2={centerEnd.sy}
                  stroke="transparent"
                  strokeWidth={18}
                  strokeLinecap="round"
                  pointerEvents="none"
                  data-selectable="true"
                  data-selectable-type="wall_segment"
                  data-segment-id={segment.id}
                />
                <polygon
                  points={footprintPoints}
                  fill={structuralFill}
                  fillOpacity={selected ? 0.3 : 0.16}
                  stroke={stroke}
                  strokeWidth={selected ? drawingStyle.weights.selection : drawingStyle.weights.normal}
                  pointerEvents="none"
                  data-plan-wall-visible="true"
                  data-plan-wall-footprint="true"
                  data-segment-id={segment.id}
                />
                <line
                  x1={faceAStart.sx}
                  y1={faceAStart.sy}
                  x2={faceAEnd.sx}
                  y2={faceAEnd.sy}
                  stroke={stroke}
                  strokeWidth={selected ? drawingStyle.weights.selection : drawingStyle.weights.normal}
                  pointerEvents="none"
                  data-plan-wall-face="true"
                  data-segment-id={segment.id}
                />
                <line
                  x1={faceBStart.sx}
                  y1={faceBStart.sy}
                  x2={faceBEnd.sx}
                  y2={faceBEnd.sy}
                  stroke={stroke}
                  strokeWidth={selected ? drawingStyle.weights.selection : drawingStyle.weights.normal}
                  pointerEvents="none"
                  data-plan-wall-face="true"
                  data-segment-id={segment.id}
                />
              </g>
            );
          }
          const a = planToSurfacePoint(displayStart);
          const b = planToSurfacePoint(displayEnd);
          return (
            <g key={segment.id}>
              <line
                x1={a.sx}
                y1={a.sy}
                x2={b.sx}
                y2={b.sy}
                stroke="transparent"
                strokeWidth={18}
                strokeLinecap="round"
                pointerEvents="none"
                data-selectable="true"
                data-selectable-type="wall_segment"
                data-segment-id={segment.id}
              />
              <line
                x1={a.sx}
                y1={a.sy}
                x2={b.sx}
                y2={b.sy}
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                pointerEvents="none"
                data-plan-wall-visible="true"
              />
            </g>
          );
        }) : null}
        {showStructuralPlanGeometry ? orthogonalGuideRays.map((guide, index) => {
          const start = planToSurfacePoint(guide.start);
          const end = planToSurfacePoint(guide.end);
          return (
            <line
              key={`perpendicular-guide-${index}`}
              x1={start.sx}
              y1={start.sy}
              x2={end.sx}
              y2={end.sy}
              stroke="#22d3ee"
              strokeOpacity={0.55}
              strokeWidth={2}
              strokeDasharray="6 6"
              pointerEvents="none"
            />
          );
        }) : null}
        {showStructuralPlanGeometry && drawGuidance?.guideLine && !shiftConstrained ? (
          (() => {
            const start = planToSurfacePoint(drawGuidance.guideLine.start);
            const end = planToSurfacePoint(drawGuidance.guideLine.end);
            return (
              <line
                x1={start.sx}
                y1={start.sy}
                x2={end.sx}
                y2={end.sy}
                stroke="#22d3ee"
                strokeOpacity={0.55}
                strokeWidth={2}
                strokeDasharray="8 5"
                pointerEvents="none"
              />
            );
          })()
        ) : null}
        {showStructuralPlanGeometry && orthogonalClosureAssist?.isEligible ? (
          (() => {
            const start = planToSurfacePoint(orthogonalClosureAssist.candidatePoint);
            const end = planToSurfacePoint(orthogonalClosureAssist.firstNode);
            return (
              <>
                <line
                  x1={start.sx}
                  y1={start.sy}
                  x2={end.sx}
                  y2={end.sy}
                  stroke="#67e8f9"
                  strokeOpacity={0.45}
                  strokeWidth={2}
                  strokeDasharray="5 7"
                  strokeLinecap="round"
                  pointerEvents="none"
                  data-orthogonal-closure-assist="true"
                />
                {closureAssistMidpoint ? (
                  <text
                    x={closureAssistMidpoint.sx + 8}
                    y={closureAssistMidpoint.sy + 14}
                    fill="#7dd3fc"
                    fontSize={11}
                    fontWeight={600}
                    paintOrder="stroke"
                    stroke="#0f172a"
                    strokeWidth={3}
                    pointerEvents="none"
                    data-orthogonal-closure-label="true"
                  >
                    {`Final leg: ${orthogonalClosureAssist.closingLengthMeters.toFixed(2)} m · ${orthogonalClosureAssist.closingAngleDegrees}°`}
                  </text>
                ) : null}
              </>
            );
          })()
        ) : null}
        {showStructuralPlanGeometry && activeNode && draftEnd ? (
          (() => {
            const a = planToSurfacePoint(activeNode);
            const b = planToSurfacePoint(draftEnd);
            return (
              <line
                x1={a.sx}
                y1={a.sy}
                x2={b.sx}
                y2={b.sy}
                stroke={invalidPreview ? '#fb7185' : shiftConstrained ? '#22d3ee' : '#fbbf24'}
                strokeWidth={shiftConstrained ? 3 : 3}
                strokeDasharray={shiftConstrained ? undefined : '8 6'}
                strokeLinecap="round"
                pointerEvents="none"
              />
            );
          })()
        ) : null}
        {showStructuralPlanGeometry && snapMarker ? (
          <circle
            cx={snapMarker.sx}
            cy={snapMarker.sy}
            r={snapCaptured || closureAssistActive ? 7 : 6}
            fill={snapCaptured ? '#22d3ee' : closureAssistActive ? 'none' : 'none'}
            stroke={invalidPreview ? '#fb7185' : snapCaptured ? '#22d3ee' : closureAssistActive ? '#22d3ee' : '#fbbf24'}
            strokeOpacity={closureAssistActive && !snapCaptured ? 0.85 : 0.95}
            strokeWidth={snapCaptured || closureAssistActive ? 2.5 : 2}
            pointerEvents="none"
            data-snap-captured={snapCaptured ? 'true' : 'false'}
            data-closure-assist-marker={closureAssistActive ? 'true' : 'false'}
          />
        ) : null}
        {showStructuralPlanGeometry && closureCornerMarker && !closureAssistActive ? (
          <circle
            cx={closureCornerMarker.sx}
            cy={closureCornerMarker.sy}
            r={7}
            fill={closureCornerSnap?.captured ? '#22d3ee' : 'none'}
            stroke="#22d3ee"
            strokeOpacity={0.85}
            strokeWidth={2.5}
            pointerEvents="none"
            data-closure-corner-snap="true"
          />
        ) : null}
        {showStructuralPlanGeometry && previewMidpoint && previewLength > 0 ? (
          <text
            x={previewMidpoint.sx + 8}
            y={previewMidpoint.sy - 8}
            fill={invalidPreview ? '#fecdd3' : shiftConstrained ? '#a5f3fc' : '#fde68a'}
            fontSize={12}
            fontWeight={700}
            paintOrder="stroke"
            stroke="#0f172a"
            strokeWidth={4}
            pointerEvents="none"
          >
            {`${(previewMetrics?.lengthMeters ?? previewLength).toFixed(2)} m · ${(previewMetrics?.angleDegrees ?? 0).toFixed(0)}°`}
          </text>
        ) : null}
        {showStructuralPlanGeometry && (shiftConstraintLabel ?? drawGuidance?.label) && snapMarker ? (
          <text
            x={snapMarker.sx + 12}
            y={snapMarker.sy - 14}
            fill="#67e8f9"
            fontSize={12}
            fontWeight={800}
            paintOrder="stroke"
            stroke="#0f172a"
            strokeWidth={4}
            pointerEvents="none"
          >
            {shiftConstraintLabel ?? drawGuidance?.label}
          </text>
        ) : null}
        {!isRoofPlanView && resolvedRoofSystem?.supported && resolvedRoofSystem.eaveFootprint.length >= 3 ? (
          <>
            <polygon
              points={resolvedRoofSystem.eaveFootprint
                .map((point) => {
                  const surface = planToSurfacePoint({ x: point.x, z: point.z });
                  return `${surface.sx},${surface.sy}`;
                })
                .join(' ')}
              fill="none"
              stroke={
                selectedObjectType === 'gable_roof_system' || selectedObjectType === 'gable_end_system'
                  ? selectionStroke
                  : referenceStroke
              }
              strokeOpacity={selectedObjectType === 'gable_roof_system' ? 0.95 : 0.45}
              strokeWidth={selectedObjectType === 'gable_roof_system' ? 2 : 1.5}
              strokeDasharray="6 4"
              pointerEvents="none"
              data-roof-shadow-outline="true"
            />
            {roofShadowReferenceEdges.length > 0
              ? roofShadowReferenceEdges.map((edge) => {
                  const start = planToSurfacePoint(edge.start);
                  const end = planToSurfacePoint(edge.end);
                  return (
                    <line
                      key={`roof-shadow-edge-${edge.id}`}
                      x1={start.sx}
                      y1={start.sy}
                      x2={end.sx}
                      y2={end.sy}
                      stroke={selectedObjectType === 'gable_roof_system' ? selectionStroke : mutedStroke}
                      strokeOpacity={selectedObjectType === 'gable_roof_system' ? 0.95 : 0.55}
                      strokeWidth={selectedObjectType === 'gable_roof_system' ? 2.5 : 1.5}
                      pointerEvents="none"
                      data-roof-shadow-plane-edge={edge.id}
                    />
                  );
                })
              : resolvedRoofSystem.ridgeStart && resolvedRoofSystem.ridgeEnd ? (
                <line
                  x1={planToSurfacePoint({
                    x: resolvedRoofSystem.ridgeStart.x,
                    z: resolvedRoofSystem.ridgeStart.z,
                  }).sx}
                  y1={planToSurfacePoint({
                    x: resolvedRoofSystem.ridgeStart.x,
                    z: resolvedRoofSystem.ridgeStart.z,
                  }).sy}
                  x2={planToSurfacePoint({
                    x: resolvedRoofSystem.ridgeEnd.x,
                    z: resolvedRoofSystem.ridgeEnd.z,
                  }).sx}
                  y2={planToSurfacePoint({
                    x: resolvedRoofSystem.ridgeEnd.x,
                    z: resolvedRoofSystem.ridgeEnd.z,
                  }).sy}
                  stroke={selectedObjectType === 'gable_roof_system' ? selectionStroke : mutedStroke}
                  strokeOpacity={selectedObjectType === 'gable_roof_system' ? 0.95 : 0.55}
                  strokeWidth={selectedObjectType === 'gable_roof_system' ? 2.5 : 1.5}
                  pointerEvents="none"
                  data-roof-shadow-ridge="fallback"
                />
              ) : null}
            {resolvedRoofSystem.trussStations.length > 0 && resolvedRoofSystem.ridgeStart && resolvedRoofSystem.ridgeEnd
              ? resolvedRoofSystem.trussStations.map((station, index) => {
                  const ridgeVector = {
                    x: resolvedRoofSystem.ridgeEnd!.x - resolvedRoofSystem.ridgeStart!.x,
                    z: resolvedRoofSystem.ridgeEnd!.z - resolvedRoofSystem.ridgeStart!.z,
                  };
                  const ridgeLength = Math.hypot(ridgeVector.x, ridgeVector.z);
                  if (ridgeLength <= 0.001) return null;
                  const stationOnRidge = Math.max(0, Math.min(ridgeLength, station));
                  const ridgeUnit = {
                    x: ridgeVector.x / ridgeLength,
                    z: ridgeVector.z / ridgeLength,
                  };
                  const planPoint = {
                    x: resolvedRoofSystem.ridgeStart!.x + ridgeUnit.x * stationOnRidge,
                    z: resolvedRoofSystem.ridgeStart!.z + ridgeUnit.z * stationOnRidge,
                  };
                  const surface = planToSurfacePoint(planPoint);
                  return (
                    <line
                      key={`truss-station-${index}`}
                      x1={surface.sx - 4}
                      y1={surface.sy}
                      x2={surface.sx + 4}
                      y2={surface.sy}
                      stroke={selectedObjectType === 'gable_roof_system' ? selectionStroke : referenceStroke}
                      strokeWidth={1.5}
                      pointerEvents="none"
                      data-roof-shadow-truss-station={station.toFixed(3)}
                    />
                  );
                })
              : null}
            {resolvedRoofSystem.gableEndSegmentIds.map((segmentId) => {
              const frame = framesBySegmentId.get(segmentId);
              if (!frame) return null;
              const midpoint = planToSurfacePoint({
                x: (frame.start.x + frame.end.x) / 2,
                z: (frame.start.z + frame.end.z) / 2,
              });
              return (
                <circle
                  key={`gable-end-${segmentId}`}
                  cx={midpoint.sx}
                  cy={midpoint.sy}
                  r={selectedObjectType === 'gable_end_system' ? 5 : 3}
                  fill={selectedObjectType === 'gable_end_system' ? selectionStroke : mutedStroke}
                  fillOpacity={0.85}
                  pointerEvents="none"
                />
              );
            })}
          </>
        ) : null}
        {showStructuralPlanGeometry ? foundationPlanBeams.map((beam) => {
            const stroke = architecturalDrawing ? permanentStroke : '#57534e';
            return renderPlanMaterialStrip(
              beam.id,
              { x: beam.startPoint.x, z: beam.startPoint.z },
              { x: beam.endPoint.x, z: beam.endPoint.z },
              beam.widthMeters,
              {
                fill: architecturalDrawing ? 'none' : `${stroke}55`,
                stroke,
                strokeWidth: architecturalDrawing ? drawingStyle.weights.medium : 1.5,
                data: {
                  'data-foundation-beam-id': beam.id,
                  'data-foundation-beam-kind': beam.kind,
                },
              },
            );
          }) : null}
        {showStructuralPlanGeometry ? wallFootings.map((footing) =>
          renderPlanMaterialStrip(
            footing.id,
            footing.startPoint,
            footing.endPoint,
            footing.widthMeters,
            {
              fill: architecturalDrawing ? 'none' : '#78716c44',
              stroke: architecturalDrawing ? mutedStroke : '#57534e',
              strokeWidth: architecturalDrawing ? drawingStyle.weights.medium : 1.4,
              data: {
                'data-foundation-wall-footing-id': footing.id,
                'data-foundation-wall-footing-segment-id': footing.hostSegmentId,
              },
            },
          )
        ) : null}
        {showStructuralPlanGeometry ? isolatedFootings.map((footing) => {
          const center = planToSurfacePoint(footing.position);
          const halfW = (footing.widthMeters * viewport.zoom) / 2;
          const halfL = (footing.lengthMeters * viewport.zoom) / 2;
          const footingColumn = frameSystem?.columns.find((column) => column.id === footing.columnId);
          const selected =
            selectedNodeId != null &&
            footingColumn?.hostNodeId === selectedNodeId;
          return (
            <rect
              key={footing.id}
              x={center.sx - halfW}
              y={center.sy - halfL}
              width={halfW * 2}
              height={halfL * 2}
              fill={selected ? (architecturalDrawing ? '#e0f2fe' : '#dbeafe') : architecturalDrawing ? '#f1f5f9' : '#78716c55'}
              stroke={selected ? selectionStroke : architecturalDrawing ? mutedStroke : '#57534e'}
              strokeWidth={selected ? 2.2 : 1.5}
              pointerEvents="none"
              data-foundation-footing-id={footing.id}
              data-foundation-footing-column-id={footing.columnId}
            />
          );
        }) : null}
        {showStructuralPlanGeometry ? frameSystem?.columns.map((column) => {
          const center = planToSurfacePoint(column.position);
          const halfW = (column.widthMeters * viewport.zoom) / 2;
          const halfD = (column.depthMeters * viewport.zoom) / 2;
          const selected = selectedNodeId != null && column.hostNodeId === selectedNodeId;
          return (
            <g key={column.id} pointerEvents="none">
              <rect
                x={center.sx - halfW}
                y={center.sy - halfD}
                width={halfW * 2}
                height={halfD * 2}
                fill={selected ? (architecturalDrawing ? '#e0f2fe' : '#dbeafe') : structuralFill}
                stroke={selected ? selectionStroke : permanentStroke}
                strokeWidth={selected ? 2.2 : 1.5}
              />
              <line x1={center.sx - halfW * 1.4} y1={center.sy} x2={center.sx + halfW * 1.4} y2={center.sy} stroke={selected ? selectionStroke : referenceStroke} strokeWidth={1} strokeOpacity={selected ? 0.95 : 0.55} />
              <line x1={center.sx} y1={center.sy - halfD * 1.4} x2={center.sx} y2={center.sy + halfD * 1.4} stroke={selected ? selectionStroke : referenceStroke} strokeWidth={1} strokeOpacity={selected ? 0.95 : 0.55} />
              {selected
                ? [
                    [-1, -1],
                    [1, -1],
                    [1, 1],
                    [-1, 1],
                  ].map(([dx, dy]) => (
                    <rect
                      key={`${dx}-${dy}`}
                      x={center.sx + dx * halfW - 4}
                      y={center.sy + dy * halfD - 4}
                      width={8}
                      height={8}
                      fill={selectionStroke}
                      stroke={textBackerStroke}
                      strokeWidth={1}
                    />
                  ))
                : null}
            </g>
          );
        }) : null}
        {showStructuralPlanGeometry ? committedRenderModel.rcComponents.map((component) => renderPlanRcComponent(component)) : null}
        {showStructuralPlanGeometry ? openingRenderItems.map((item) => (
          <PlanOpeningSymbol key={item.key} item={item} project={planToSurfacePoint} zoom={viewport.zoom} drawingStyle={drawingStyle} />
        )) : null}
        {renderPlumbingPlan()}
        <g data-canvas-layer="permanent-dimensions">
          {renderedDimensionAnnotations}
          {renderedAngleAnnotations}
        </g>
        {showStructuralPlanGeometry ? previewRenderModel.rcComponents.map((component) => renderPlanRcComponent(component, true)) : null}
        {showStructuralPlanGeometry && previewRenderItem ? (
          <PlanOpeningSymbol item={previewRenderItem} project={planToSurfacePoint} zoom={viewport.zoom} drawingStyle={drawingStyle} />
        ) : null}
        {showStructuralPlanGeometry ? renderColumnDragPreview() : null}
        {dimensionDraft?.step === 'start' ? (
          (() => {
            const point = planToSurfacePoint(dimensionDraft.start.point);
            return (
              <circle
                cx={point.sx}
                cy={point.sy}
                r={5}
                fill={previewStroke}
                stroke={textBackerStroke}
                strokeWidth={1.5}
                pointerEvents="none"
                data-canvas-layer="active-dimension-preview"
                data-dimension-pending-point="true"
              />
            );
          })()
        ) : null}
        {renderedDimensionPreview}
        {angleDraft ? (
          (() => {
            const pendingPoints =
              angleDraft.step === 'vertex'
                ? [angleDraft.start.point]
                : [angleDraft.start.point, angleDraft.vertex.point];
            return (
              <g pointerEvents="none" data-canvas-layer="active-angle-preview">
                {pendingPoints.map((pendingPoint, index) => {
                  const point = planToSurfacePoint(pendingPoint);
                  return (
                    <circle
                      key={`angle-pending-${index}`}
                      cx={point.sx}
                      cy={point.sy}
                      r={5}
                      fill={previewStroke}
                      stroke={textBackerStroke}
                      strokeWidth={1.5}
                      data-angle-pending-point="true"
                    />
                  );
                })}
              </g>
            );
          })()
        ) : null}
        {renderedAnglePreview}
        {(toolMode === 'place_dimension' || toolMode === 'place_angle') && dimensionSnap ? (
          (() => {
            const point = planToSurfacePoint(dimensionSnap.point);
            const label = dimensionSnap.snapResult?.label ?? dimensionSnap.type;
            const markerType = dimensionSnap.snapResult?.snapType ?? 'none';
            return (
              <g pointerEvents="none" data-canvas-layer="handles-control-points">
                {markerType === 'endpoint' ? (
                  <rect x={point.sx - 4} y={point.sy - 4} width={8} height={8} fill="none" stroke={previewStroke} strokeWidth={1.8} />
                ) : markerType === 'midpoint' ? (
                  <path d={`M ${point.sx} ${point.sy - 5} L ${point.sx + 5} ${point.sy + 4} L ${point.sx - 5} ${point.sy + 4} Z`} fill="none" stroke={previewStroke} strokeWidth={1.8} />
                ) : markerType === 'intersection' ? (
                  <>
                    <line x1={point.sx - 5} y1={point.sy - 5} x2={point.sx + 5} y2={point.sy + 5} stroke={previewStroke} strokeWidth={1.8} />
                    <line x1={point.sx + 5} y1={point.sy - 5} x2={point.sx - 5} y2={point.sy + 5} stroke={previewStroke} strokeWidth={1.8} />
                  </>
                ) : (
                  <circle cx={point.sx} cy={point.sy} r={4} fill="none" stroke={previewStroke} strokeWidth={1.8} />
                )}
                <text
                  x={point.sx + 8}
                  y={point.sy - 8}
                  fill={previewStroke}
                  fontSize={11}
                  fontWeight={700}
                  paintOrder="stroke"
                  stroke={textBackerStroke}
                  strokeWidth={3}
                  data-snap-label="true"
                >
                  {label}
                </text>
                <circle
                  cx={point.sx}
                  cy={point.sy}
                  r={0}
                  fill="none"
                  data-dimension-snap-marker={dimensionSnap.type}
                  data-angle-snap-marker={toolMode === 'place_angle' ? dimensionSnap.type : undefined}
                />
              </g>
            );
          })()
        ) : null}
        {helperAnchor && helperMeasurements.length > 0 ? (
          <g pointerEvents="none">
            <rect
              x={helperAnchor.sx + 14}
              y={helperAnchor.sy + 12}
              width={190}
              height={Math.max(34, helperMeasurements.length * 18 + 12)}
              rx={8}
              fill="#020617"
              fillOpacity={0.86}
              stroke="#155e75"
              strokeOpacity={0.85}
            />
            {helperMeasurements.map((measurement, index) => (
              <text
                key={measurement.id}
                x={helperAnchor.sx + 24}
                y={helperAnchor.sy + 34 + index * 18}
                fill={index === 0 ? '#67e8f9' : '#cbd5e1'}
                fontSize={11}
                fontWeight={index === 0 ? 800 : 600}
                paintOrder="stroke"
                stroke="#020617"
                strokeWidth={3}
              >
                {`${measurement.label}: ${measurement.value}`}
              </text>
            ))}
          </g>
        ) : null}
        {showPlanNodeMarkers ? layout.nodes.map((node) => {
          const displayPoint = planDisplayNodeById.get(node.id) ?? node;
          const point = planToSurfacePoint(displayPoint);
          const selected = selectedNodeId === node.id || activeNodeId === node.id;
          return (
            <circle
              key={node.id}
              cx={point.sx}
              cy={point.sy}
              r={selected ? 8 : 5}
              fill={selected ? '#22d3ee' : '#e2e8f0'}
              stroke="#0f172a"
              strokeWidth={2}
              pointerEvents="none"
              data-plan-node-id={node.id}
            />
          );
        }) : null}
      </svg>
      <div className="pointer-events-none absolute bottom-3 right-3 rounded-xl border border-slate-700 bg-slate-900/90 px-2.5 py-2 text-[11px] font-bold text-slate-100 shadow-sm" aria-label="Plan orientation north up">
        <div className="flex items-center gap-2">
          <svg width="28" height="34" viewBox="0 0 28 34" aria-hidden>
            <path d="M14 3 L22 17 H16 V31 H12 V17 H6 Z" fill="#22d3ee" />
            <path d="M14 31 H24" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <div>
            <div>N</div>
            <div className="text-[10px] font-semibold text-slate-400">North up</div>
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-2 text-[11px] font-bold text-slate-100 shadow-sm" aria-label="Plan coordinate widget">
        <div className="text-cyan-200">Plan Coordinates</div>
        <div className="font-mono text-slate-200">
          X {cursorPoint ? cursorPoint.x.toFixed(2) : '0.00'} m / Y {cursorPoint ? cursorPoint.z.toFixed(2) : '0.00'} m
        </div>
        <div className="text-[10px] font-semibold text-slate-400">North / East</div>
      </div>
    </div>
  );
}
