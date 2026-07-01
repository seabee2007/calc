import type {
  DesignWallLayoutParameters,
  PlacedDesignComponent,
  RcFrameFoundationSettings,
  StructuralBeam,
  StructuralColumn,
  StructuralFoundationSettings,
  StructuralFrameSystemParameters,
  WallFooting,
} from "../types";
import type { SegmentFrame } from "../geometry/designGeometry";
import {
  getExteriorPerimeterSegmentIds,
  getStructuralColumnNodeIds,
} from "../geometry/designGeometry";
import { resolveInsideFaceStation } from "./infillPanelBoundsResolver";
import {
  normalizeRcFrameFoundationSettings,
  plinthBeamElevations,
  resolveColumnGeometry,
  resolveFoundationElevations,
  roofBeamElevations,
  tieBeamElevations,
  TOP_OF_PLINTH_BEAM_Y,
} from "./foundationElevations";
import { createIsolatedFootingsForColumns } from "./isolatedFootingLayout";
import type { IsolatedFooting } from "../types";
import {
  DEFAULT_RC_INTERMEDIATE_SUPPORT_SPACING_METERS,
  DEFAULT_RC_COLUMN_DEPTH_METERS,
  DEFAULT_RC_COLUMN_WIDTH_METERS,
} from "./structuralFrameDefaults";

const MANUAL_COLUMN_NODE_TOLERANCE_METERS = 0.2;
const MANUAL_COLUMN_SEGMENT_TOLERANCE_METERS = 0.25;
const MANUAL_COLUMN_POSITION_MATCH_TOLERANCE_METERS = 0.025;
const MANUAL_COLUMN_DIMENSION_MATCH_TOLERANCE_METERS = 0.001;

export type ColumnFootprint = {
  column: StructuralColumn;
  exteriorMinX: number;
  exteriorMaxX: number;
  exteriorMinZ: number;
  exteriorMaxZ: number;
  insideFaceAlongSegment: (segmentId: string, station: number) => number;
};

export type FrameLayoutResult = {
  frameSystem: StructuralFrameSystemParameters;
  isolatedFootings: IsolatedFooting[];
  wallFootings: WallFooting[];
};

function columnIdForNode(nodeId: string): string {
  return `col-${nodeId}`;
}

function columnIdForSegmentStation(
  segmentId: string,
  supportIndex: number,
): string {
  return `col-${segmentId}-support-${supportIndex}`;
}

function beamId(
  kind: StructuralBeam["kind"],
  segmentId: string,
  bayIndex?: number,
): string {
  return bayIndex == null
    ? `beam-${kind}-${segmentId}`
    : `beam-${kind}-${segmentId}-${bayIndex}`;
}

function resolveFoundation(
  params: StructuralFoundationSettings | RcFrameFoundationSettings | undefined,
): RcFrameFoundationSettings {
  return normalizeRcFrameFoundationSettings(params);
}

function resolveColumnDimensions(
  foundation: RcFrameFoundationSettings,
  frameSystem: StructuralFrameSystemParameters,
): { widthMeters: number; depthMeters: number } {
  return {
    widthMeters:
      foundation.columns.widthMeters ||
      frameSystem.defaultColumnWidthMeters ||
      DEFAULT_RC_COLUMN_WIDTH_METERS,
    depthMeters:
      foundation.columns.depthMeters ||
      frameSystem.defaultColumnDepthMeters ||
      DEFAULT_RC_COLUMN_DEPTH_METERS,
  };
}

function numberValue(value: unknown, fallback: number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function positiveNumber(value: unknown, fallback: number): number {
  const numeric = numberValue(value, fallback);
  return numeric > 0 ? numeric : fallback;
}

function planPositionForComponent(
  component: PlacedDesignComponent,
): { x: number; z: number } | null {
  if (component.viewPlacement.plan) {
    return {
      x: component.viewPlacement.plan.xMeters,
      z: component.viewPlacement.plan.zMeters,
    };
  }
  if (component.viewPlacement.world) {
    return {
      x: component.viewPlacement.world.xMeters,
      z: component.viewPlacement.world.zMeters,
    };
  }
  return null;
}

export function manualFrameColumnIdForComponent(componentId: string): string {
  return `manual-column-${componentId}`;
}

function distanceMeters(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function projectPointToFrameCenterline(
  point: { x: number; z: number },
  frame: SegmentFrame,
): { point: { x: number; z: number }; stationMeters: number; distanceMeters: number } {
  const rawStation =
    (point.x - frame.centerlineStart.x) * frame.tangent.x +
    (point.z - frame.centerlineStart.z) * frame.tangent.z;
  const stationMeters = Math.max(0, Math.min(frame.lengthMeters, rawStation));
  const projected = {
    x: frame.centerlineStart.x + frame.tangent.x * stationMeters,
    z: frame.centerlineStart.z + frame.tangent.z * stationMeters,
  };
  return {
    point: projected,
    stationMeters,
    distanceMeters: distanceMeters(point, projected),
  };
}

function resolveManualColumnHost(params: {
  point: { x: number; z: number };
  layout: DesignWallLayoutParameters;
  segmentFrames: readonly SegmentFrame[];
  widthMeters: number;
  depthMeters: number;
}): { position: { x: number; z: number }; hostNodeId?: string; hostSegmentId?: string } {
  const maxColumnDimension = Math.max(params.widthMeters, params.depthMeters);
  const nodeToleranceMeters = Math.max(MANUAL_COLUMN_NODE_TOLERANCE_METERS, maxColumnDimension);
  const segmentToleranceMeters = Math.max(MANUAL_COLUMN_SEGMENT_TOLERANCE_METERS, maxColumnDimension);
  const exteriorSegmentIds = getExteriorPerimeterSegmentIds(params.layout);
  const exteriorNodeIds = getStructuralColumnNodeIds(params.layout, exteriorSegmentIds);
  const nodeById = new Map(params.layout.nodes.map((node) => [node.id, node]));
  const nearestNode = exteriorNodeIds
    .map((nodeId) => {
      const node = nodeById.get(nodeId);
      if (!node) return null;
      return {
        node,
        distance: distanceMeters(params.point, node),
      };
    })
    .filter((entry): entry is { node: { id: string; x: number; z: number }; distance: number } => entry != null)
    .filter((entry) => entry.distance <= nodeToleranceMeters)
    .sort((a, b) => a.distance - b.distance || a.node.id.localeCompare(b.node.id))[0];

  if (nearestNode) {
    return {
      position: { x: nearestNode.node.x, z: nearestNode.node.z },
      hostNodeId: nearestNode.node.id,
    };
  }

  const nearestSegment = params.segmentFrames
    .filter((frame) => exteriorSegmentIds.has(frame.segmentId))
    .map((frame) => ({
      frame,
      projection: projectPointToFrameCenterline(params.point, frame),
    }))
    .filter((entry) => entry.projection.distanceMeters <= segmentToleranceMeters)
    .sort((a, b) => a.projection.distanceMeters - b.projection.distanceMeters || a.frame.segmentId.localeCompare(b.frame.segmentId))[0];

  if (nearestSegment) {
    return {
      position: nearestSegment.projection.point,
      hostSegmentId: nearestSegment.frame.segmentId,
    };
  }

  return { position: params.point };
}

function columnsAreNearEqual(
  left: Pick<StructuralColumn, "position" | "widthMeters" | "depthMeters">,
  right: Pick<StructuralColumn, "position" | "widthMeters" | "depthMeters">,
): boolean {
  return (
    distanceMeters(left.position, right.position) <= MANUAL_COLUMN_POSITION_MATCH_TOLERANCE_METERS &&
    Math.abs(left.widthMeters - right.widthMeters) <= MANUAL_COLUMN_DIMENSION_MATCH_TOLERANCE_METERS &&
    Math.abs(left.depthMeters - right.depthMeters) <= MANUAL_COLUMN_DIMENSION_MATCH_TOLERANCE_METERS
  );
}

export function promotePlacedColumnComponentToFrameColumn(params: {
  component: PlacedDesignComponent;
  layout: DesignWallLayoutParameters;
  segmentFrames: readonly SegmentFrame[];
  frameSystem: StructuralFrameSystemParameters;
  foundation: StructuralFoundationSettings | RcFrameFoundationSettings | undefined;
  wallHeightMeters: number;
}): { column: StructuralColumn; added: boolean } | null {
  if (params.component.type !== "column") return null;
  const point = planPositionForComponent(params.component);
  if (!point) return null;
  const foundation = resolveFoundation(params.foundation);
  const defaultDimensions = resolveColumnDimensions(foundation, params.frameSystem);
  const widthMeters = positiveNumber(params.component.parameters.widthMeters, defaultDimensions.widthMeters);
  const depthMeters = positiveNumber(params.component.parameters.depthMeters, defaultDimensions.depthMeters);
  const host = resolveManualColumnHost({
    point,
    layout: params.layout,
    segmentFrames: params.segmentFrames,
    widthMeters,
    depthMeters,
  });
  const elevations = resolveFoundationElevations({
    foundation,
    wallHeightMeters: params.wallHeightMeters,
  });
  const column: StructuralColumn = {
    id: manualFrameColumnIdForComponent(params.component.id),
    name: `Manual Column ${params.component.id}`,
    kind: "rc_column",
    position: host.position,
    widthMeters,
    depthMeters,
    ...resolveColumnGeometry({
      column: { widthMeters, depthMeters },
      elevations,
    }),
    hostNodeId: host.hostNodeId,
    hostSegmentId: host.hostSegmentId,
    source: "manual_frame_layout",
  };
  const existing =
    params.frameSystem.columns.find((candidate) => candidate.id === column.id) ??
    params.frameSystem.columns.find((candidate) => columnsAreNearEqual(candidate, column));
  if (existing) return { column: existing, added: false };
  return { column, added: true };
}

export function promotePlacedColumnComponentsToFrameColumns(params: {
  placedComponents: readonly PlacedDesignComponent[];
  layout: DesignWallLayoutParameters;
  segmentFrames: readonly SegmentFrame[];
  frameSystem: StructuralFrameSystemParameters;
  foundation: StructuralFoundationSettings | RcFrameFoundationSettings | undefined;
  wallHeightMeters: number;
}): {
  frameSystem: StructuralFrameSystemParameters;
  remainingPlacedComponents: PlacedDesignComponent[];
  promotedColumnIds: string[];
  changed: boolean;
} {
  let frameSystem = params.frameSystem;
  const promotedComponentIds = new Set<string>();
  const promotedFooterIds = new Set<string>();
  const promotedColumnIds: string[] = [];

  for (const component of params.placedComponents) {
    if (component.type !== "column") continue;
    const result = promotePlacedColumnComponentToFrameColumn({
      component,
      layout: params.layout,
      segmentFrames: params.segmentFrames,
      frameSystem,
      foundation: params.foundation,
      wallHeightMeters: params.wallHeightMeters,
    });
    if (!result) continue;
    promotedComponentIds.add(component.id);
    for (const connectedId of component.references?.connectedComponentIds ?? []) {
      promotedFooterIds.add(connectedId);
    }
    promotedColumnIds.push(result.column.id);
    if (result.added) {
      frameSystem = {
        ...frameSystem,
        columns: [...frameSystem.columns, result.column],
      };
    }
  }

  const remainingPlacedComponents = params.placedComponents.filter((component) => {
    if (promotedComponentIds.has(component.id)) return false;
    if (component.type === "footer" && component.references?.hostId && promotedComponentIds.has(component.references.hostId)) return false;
    if (promotedFooterIds.has(component.id)) return false;
    return true;
  });

  return {
    frameSystem,
    remainingPlacedComponents,
    promotedColumnIds,
    changed:
      frameSystem !== params.frameSystem ||
      remainingPlacedComponents.length !== params.placedComponents.length,
  };
}

export function columnExteriorBounds(column: StructuralColumn): {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
} {
  const halfW = column.widthMeters / 2;
  const halfD = column.depthMeters / 2;
  return {
    minX: column.position.x - halfW,
    maxX: column.position.x + halfW,
    minZ: column.position.z - halfD,
    maxZ: column.position.z + halfD,
  };
}

/** Station on segment where column inside face meets infill (segment-local, meters from exterior start). */
export function columnInsideFaceStationOnSegment(
  column: StructuralColumn,
  frame: SegmentFrame,
  side: "start" | "end",
): number {
  return resolveInsideFaceStation({ column, frame, side });
}

export function createCornerColumnsForLayout(params: {
  layout: DesignWallLayoutParameters;
  segmentFrames: SegmentFrame[];
  frameSystem: StructuralFrameSystemParameters;
  wallHeightMeters: number;
  foundation:
    StructuralFoundationSettings | RcFrameFoundationSettings | undefined;
}): StructuralColumn[] {
  const foundation = resolveFoundation(params.foundation);
  const elevations = resolveFoundationElevations({
    foundation,
    wallHeightMeters: params.wallHeightMeters,
  });
  const { width, depth } = {
    width: resolveColumnDimensions(foundation, params.frameSystem).widthMeters,
    depth: resolveColumnDimensions(foundation, params.frameSystem).depthMeters,
  };
  const exteriorSegmentIds = getExteriorPerimeterSegmentIds(params.layout);
  const nodeIds = new Set(
    getStructuralColumnNodeIds(params.layout, exteriorSegmentIds),
  );
  const nodeById = new Map(params.layout.nodes.map((n) => [n.id, n]));
  const columns: StructuralColumn[] = [];
  for (const nodeId of nodeIds) {
    const node = nodeById.get(nodeId);
    if (!node) continue;
    const geometry = resolveColumnGeometry({
      column: { widthMeters: width, depthMeters: depth },
      elevations,
    });
    columns.push({
      id: columnIdForNode(nodeId),
      name: `Corner Column ${nodeId}`,
      kind: "rc_column",
      position: { x: node.x, z: node.z },
      widthMeters: width,
      depthMeters: depth,
      ...geometry,
      hostNodeId: nodeId,
      source: "auto_frame_layout",
    });
  }
  return columns;
}

function columnStationOnFrame(
  column: StructuralColumn,
  frame: SegmentFrame,
): number {
  return (
    (column.position.x - frame.start.x) * frame.tangent.x +
    (column.position.z - frame.start.z) * frame.tangent.z
  );
}

function intermediateSupportStations(params: {
  spanMeters: number;
  spacingMeters: number;
}): number[] {
  const spacingMeters = Math.max(0.1, params.spacingMeters);
  const bayCount = Math.max(1, Math.ceil(params.spanMeters / spacingMeters));
  if (bayCount <= 1) return [];
  const bayLength = params.spanMeters / bayCount;
  return Array.from(
    { length: bayCount - 1 },
    (_, index) => bayLength * (index + 1),
  );
}

function createIntermediateColumnsForLayout(params: {
  layout: DesignWallLayoutParameters;
  segmentFrames: SegmentFrame[];
  frameSystem: StructuralFrameSystemParameters;
  wallHeightMeters: number;
  foundation: RcFrameFoundationSettings;
}): StructuralColumn[] {
  if (params.foundation.columns.placementMode !== "corners_and_intermediate")
    return [];
  const elevations = resolveFoundationElevations({
    foundation: params.foundation,
    wallHeightMeters: params.wallHeightMeters,
  });
  const dimensions = resolveColumnDimensions(
    params.foundation,
    params.frameSystem,
  );
  const exteriorSegmentIds = getExteriorPerimeterSegmentIds(params.layout);
  const columns: StructuralColumn[] = [];
  for (const frame of params.segmentFrames) {
    if (!exteriorSegmentIds.has(frame.segmentId)) continue;
    const stations = intermediateSupportStations({
      spanMeters: frame.lengthMeters,
      spacingMeters:
        params.foundation.columns.intermediateSpacingMeters ||
        DEFAULT_RC_INTERMEDIATE_SUPPORT_SPACING_METERS,
    });
    stations.forEach((stationMeters, index) => {
      const geometry = resolveColumnGeometry({
        column: {
          widthMeters: dimensions.widthMeters,
          depthMeters: dimensions.depthMeters,
        },
        elevations,
      });
      columns.push({
        id: columnIdForSegmentStation(frame.segmentId, index + 1),
        name: `Intermediate Column ${frame.segmentId} ${index + 1}`,
        kind: "rc_column",
        position: {
          x: frame.start.x + frame.tangent.x * stationMeters,
          z: frame.start.z + frame.tangent.z * stationMeters,
        },
        widthMeters: dimensions.widthMeters,
        depthMeters: dimensions.depthMeters,
        ...geometry,
        hostSegmentId: frame.segmentId,
        source: "auto_frame_layout",
      });
    });
  }
  return columns;
}

function createAutoColumnsForLayout(params: {
  layout: DesignWallLayoutParameters;
  segmentFrames: SegmentFrame[];
  frameSystem: StructuralFrameSystemParameters;
  wallHeightMeters: number;
  foundation: RcFrameFoundationSettings;
}): StructuralColumn[] {
  return [
    ...createCornerColumnsForLayout(params),
    ...createIntermediateColumnsForLayout(params),
  ];
}

function wallFootingIdForSegment(segmentId: string): string {
  return `wall-footing-${segmentId}`;
}

type PartitionFootingEndpointAdjustments = {
  startMeters: number;
  endMeters: number;
};

type PartitionFootingSegmentRef = {
  segment: DesignWallLayoutParameters["segments"][number];
  index: number;
};

const PARTITION_WALL_FOOTING_WIDTH_MULTIPLIER = 3;
const PARTITION_WALL_FOOTING_MIN_WIDTH_METERS = 0.6;
const PARTITION_WALL_FOOTING_THICKNESS_METERS = 0.15;

function partitionWallFootingWidthMeters(wallThicknessMeters: number): number {
  return Math.max(
    PARTITION_WALL_FOOTING_MIN_WIDTH_METERS,
    wallThicknessMeters * PARTITION_WALL_FOOTING_WIDTH_MULTIPLIER,
  );
}

function directionFromNodeForSegment(
  segment: DesignWallLayoutParameters["segments"][number],
  nodeId: string,
  nodesById: Map<string, { x: number; z: number }>,
): { x: number; z: number } | null {
  const start = nodesById.get(segment.startNodeId);
  const end = nodesById.get(segment.endNodeId);
  if (!start || !end) return null;
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const length = Math.hypot(dx, dz);
  if (length <= 0) return null;
  return segment.startNodeId === nodeId
    ? { x: dx / length, z: dz / length }
    : { x: -dx / length, z: -dz / length };
}

function isStraightThroughPartitionFootingJoint(params: {
  refs: readonly PartitionFootingSegmentRef[];
  nodeId: string;
  nodesById: Map<string, { x: number; z: number }>;
}): boolean {
  if (params.refs.length !== 2) return false;
  const directions = params.refs
    .map((ref) => directionFromNodeForSegment(ref.segment, params.nodeId, params.nodesById))
    .filter((direction): direction is { x: number; z: number } => direction != null);
  if (directions.length !== 2) return false;
  const dot = directions[0]!.x * directions[1]!.x + directions[0]!.z * directions[1]!.z;
  return dot < -0.95;
}

function resolvePartitionFootingEndpointAdjustments(params: {
  layout: DesignWallLayoutParameters;
  segmentFrames: readonly SegmentFrame[];
  footingWidthBySegmentId: ReadonlyMap<string, number>;
}): Map<string, PartitionFootingEndpointAdjustments> {
  const adjustments = new Map<string, PartitionFootingEndpointAdjustments>();
  const nodesById = new Map(params.layout.nodes.map((node) => [node.id, { x: node.x, z: node.z }]));
  const refsByNodeId = new Map<string, PartitionFootingSegmentRef[]>();
  const frameIds = new Set(params.segmentFrames.map((frame) => frame.segmentId));

  params.layout.segments.forEach((segment, index) => {
    if (segment.wallRole !== "partition" || !frameIds.has(segment.id)) return;
    const ref = { segment, index };
    refsByNodeId.set(segment.startNodeId, [...(refsByNodeId.get(segment.startNodeId) ?? []), ref]);
    refsByNodeId.set(segment.endNodeId, [...(refsByNodeId.get(segment.endNodeId) ?? []), ref]);
  });

  refsByNodeId.forEach((refs, nodeId) => {
    if (refs.length < 2) return;
    if (isStraightThroughPartitionFootingJoint({ refs, nodeId, nodesById })) return;

    const orderedRefs = [...refs].sort((a, b) => a.index - b.index);
    const owner =
      orderedRefs.find((ref) => ref.segment.endNodeId === nodeId) ??
      orderedRefs[0];
    if (!owner) return;

    orderedRefs.forEach((ref) => {
      const halfFootingWidth = Math.max(0, (params.footingWidthBySegmentId.get(ref.segment.id) ?? 0) / 2);
      if (halfFootingWidth <= 0) return;
      const current = adjustments.get(ref.segment.id) ?? { startMeters: 0, endMeters: 0 };
      const ownsJoint = ref.segment.id === owner.segment.id;
      if (ref.segment.startNodeId === nodeId) {
        current.startMeters = ownsJoint ? -halfFootingWidth : halfFootingWidth;
      } else {
        current.endMeters = ownsJoint ? halfFootingWidth : -halfFootingWidth;
      }
      adjustments.set(ref.segment.id, current);
    });
  });

  return adjustments;
}

function createWallFootingsForPartitionSegments(params: {
  layout: DesignWallLayoutParameters;
  segmentFrames: SegmentFrame[];
  foundation: RcFrameFoundationSettings;
  topOfPlinthBeamY: number;
}): WallFooting[] {
  const settings = params.foundation.isolatedFootings;
  if (!settings.enabled || !settings.autoCreateAtStructuralColumns) return [];

  const segmentById = new Map(params.layout.segments.map((segment) => [segment.id, segment]));
  const topElevationMeters =
    params.topOfPlinthBeamY - Math.max(0, settings.dropBelowPlinthBeamMeters) / 2;
  const thicknessMeters = PARTITION_WALL_FOOTING_THICKNESS_METERS;
  const bottomElevationMeters = topElevationMeters - thicknessMeters;
  const footingWidthBySegmentId = new Map(
    params.segmentFrames.map((frame) => [
      frame.segmentId,
      partitionWallFootingWidthMeters(frame.wallThicknessMeters),
    ]),
  );
  const endpointAdjustments = resolvePartitionFootingEndpointAdjustments({
    layout: params.layout,
    segmentFrames: params.segmentFrames,
    footingWidthBySegmentId,
  });

  return params.segmentFrames.flatMap((frame) => {
    const segment = segmentById.get(frame.segmentId);
    if (!segment) return [];
    if (segment.wallRole !== "partition") return [];
    if (frame.lengthMeters <= 0.05) return [];
    const widthMeters =
      footingWidthBySegmentId.get(frame.segmentId) ??
      partitionWallFootingWidthMeters(frame.wallThicknessMeters);
    const adjustments = endpointAdjustments.get(frame.segmentId) ?? { startMeters: 0, endMeters: 0 };
    const startPoint = {
      x: frame.centerlineStart.x + frame.tangent.x * adjustments.startMeters,
      z: frame.centerlineStart.z + frame.tangent.z * adjustments.startMeters,
    };
    const endPoint = {
      x: frame.centerlineEnd.x + frame.tangent.x * adjustments.endMeters,
      z: frame.centerlineEnd.z + frame.tangent.z * adjustments.endMeters,
    };

    return [{
      id: wallFootingIdForSegment(segment.id),
      name: `Wall Footing ${segment.id}`,
      hostSegmentId: segment.id,
      startPoint,
      endPoint,
      widthMeters,
      thicknessMeters,
      topElevationMeters,
      bottomElevationMeters,
      centerElevationMeters: topElevationMeters - thicknessMeters / 2,
      source: "auto_partition_wall" as const,
    }];
  });
}

function beamBetweenColumns(params: {
  kind: StructuralBeam["kind"];
  startCol: StructuralColumn;
  endCol: StructuralColumn;
  segmentId: string;
  bayIndex?: number;
  widthMeters: number;
  depthMeters: number;
  baseElevationMeters: number;
  topElevationMeters: number;
}): StructuralBeam {
  const startFace = facePointToward(params.startCol, params.endCol.position);
  const endFace = facePointToward(params.endCol, params.startCol.position);
  return {
    id: beamId(params.kind, params.segmentId, params.bayIndex),
    name: `${params.kind} ${params.segmentId}`,
    kind: params.kind,
    startColumnId: params.startCol.id,
    endColumnId: params.endCol.id,
    startPoint: {
      x: startFace.x,
      y: params.baseElevationMeters,
      z: startFace.z,
    },
    endPoint: { x: endFace.x, y: params.baseElevationMeters, z: endFace.z },
    widthMeters: params.widthMeters,
    depthMeters: params.depthMeters,
    baseElevationMeters: params.baseElevationMeters,
    topElevationMeters: params.topElevationMeters,
    hostSegmentId: params.segmentId,
    source: "auto_frame_layout",
  };
}

/** Face-to-face point on column toward target (not center-to-center). */
function facePointToward(
  column: StructuralColumn,
  target: { x: number; z: number },
): { x: number; z: number } {
  const dx = target.x - column.position.x;
  const dz = target.z - column.position.z;
  const len = Math.hypot(dx, dz) || 1;
  const nx = dx / len;
  const nz = dz / len;
  const halfExtent = Math.max(column.widthMeters, column.depthMeters) / 2;
  return {
    x: column.position.x + nx * halfExtent,
    z: column.position.z + nz * halfExtent,
  };
}

export function createPerimeterBeamsForLayout(params: {
  layout: DesignWallLayoutParameters;
  segmentFrames?: SegmentFrame[];
  columns: StructuralColumn[];
  frameSystem: StructuralFrameSystemParameters;
  foundation:
    StructuralFoundationSettings | RcFrameFoundationSettings | undefined;
  wallHeightMeters: number;
}): StructuralBeam[] {
  const foundation = resolveFoundation(params.foundation);
  const colByNode = new Map<string, StructuralColumn>();
  for (const col of params.columns) {
    if (col.hostNodeId) colByNode.set(col.hostNodeId, col);
  }

  const plinthElevations = plinthBeamElevations(foundation);
  const roofElevations = roofBeamElevations(
    params.wallHeightMeters,
    foundation,
  );
  const tieElevations = tieBeamElevations(foundation, params.wallHeightMeters);
  const exteriorSegmentIds = getExteriorPerimeterSegmentIds(params.layout);
  const segmentFrameById = new Map(
    (params.segmentFrames ?? []).map((frame) => [frame.segmentId, frame]),
  );

  const beams: StructuralBeam[] = [];
  for (const seg of params.layout.segments) {
    const isExterior = exteriorSegmentIds.has(seg.id);
    const frame = segmentFrameById.get(seg.id);
    const startCol = colByNode.get(seg.startNodeId);
    const endCol = colByNode.get(seg.endNodeId);
    const segmentColumns =
      isExterior && frame
        ? params.columns
            .filter((column) => {
              if (
                column.hostNodeId === seg.startNodeId ||
                column.hostNodeId === seg.endNodeId
              )
                return true;
              return column.hostSegmentId === seg.id;
            })
            .map((column) => ({
              column,
              station:
                column.hostNodeId === seg.startNodeId
                  ? 0
                  : column.hostNodeId === seg.endNodeId
                    ? frame.lengthMeters
                    : columnStationOnFrame(column, frame),
            }))
            .filter(
              (entry) =>
                entry.station >= -0.001 &&
                entry.station <= frame.lengthMeters + 0.001,
            )
            .sort((a, b) => a.station - b.station)
            .map((entry) => entry.column)
        : [startCol, endCol].filter(
            (column): column is StructuralColumn => column != null,
          );
    if (segmentColumns.length < 2) continue;

    const includePlinthBeam =
      foundation.plinthBeam.enabled &&
      (isExterior
        ? foundation.plinthBeam.followsExteriorSegments
        : foundation.plinthBeam.followsInteriorSegments);

    for (let index = 0; index < segmentColumns.length - 1; index += 1) {
      const startSupport = segmentColumns[index]!;
      const endSupport = segmentColumns[index + 1]!;
      const bayIndex = segmentColumns.length > 2 ? index : undefined;
      if (includePlinthBeam) {
        beams.push(
          beamBetweenColumns({
            kind: "plinth_beam",
            startCol: startSupport,
            endCol: endSupport,
            segmentId: seg.id,
            bayIndex,
            widthMeters: foundation.plinthBeam.widthMeters,
            depthMeters: foundation.plinthBeam.depthMeters,
            baseElevationMeters: plinthElevations.baseElevationMeters,
            topElevationMeters: plinthElevations.topElevationMeters,
          }),
        );
      }

      if (foundation.roofBeam.enabled && isExterior) {
        beams.push(
          beamBetweenColumns({
            kind: "roof_beam",
            startCol: startSupport,
            endCol: endSupport,
            segmentId: seg.id,
            bayIndex,
            widthMeters: foundation.roofBeam.widthMeters,
            depthMeters: foundation.roofBeam.depthMeters,
            baseElevationMeters: roofElevations.baseElevationMeters,
            topElevationMeters: roofElevations.topElevationMeters,
          }),
        );
      }

      if (foundation.tieBeam.enabled && isExterior) {
        beams.push(
          beamBetweenColumns({
            kind: "tie_beam",
            startCol: startSupport,
            endCol: endSupport,
            segmentId: seg.id,
            bayIndex,
            widthMeters: foundation.tieBeam.widthMeters,
            depthMeters: foundation.tieBeam.depthMeters,
            baseElevationMeters: tieElevations.baseElevationMeters,
            topElevationMeters: tieElevations.topElevationMeters,
          }),
        );
      }
    }
  }
  return beams;
}

export function autoFrameLayout(params: {
  layout: DesignWallLayoutParameters;
  segmentFrames: SegmentFrame[];
  frameSystem: StructuralFrameSystemParameters;
  foundation:
    StructuralFoundationSettings | RcFrameFoundationSettings | undefined;
}): FrameLayoutResult {
  return reconcileStructuralFrameWithFoundation({
    layout: params.layout,
    segmentFrames: params.segmentFrames,
    frameSystem: params.frameSystem,
    foundation: params.foundation,
    wallHeightMeters: params.layout.defaultWallHeightMeters,
  });
}

export function reconcileStructuralFrameWithFoundation(params: {
  layout: DesignWallLayoutParameters;
  segmentFrames: SegmentFrame[];
  frameSystem: StructuralFrameSystemParameters;
  foundation:
    StructuralFoundationSettings | RcFrameFoundationSettings | undefined;
  wallHeightMeters: number;
}): FrameLayoutResult {
  const foundation = resolveFoundation(params.foundation);
  const wallHeight = params.wallHeightMeters;
  const generatedAutoColumns = createAutoColumnsForLayout({
    layout: params.layout,
    segmentFrames: params.segmentFrames,
    frameSystem: params.frameSystem,
    wallHeightMeters: wallHeight,
    foundation,
  });
  const existingByHostNodeId = new Map(
    params.frameSystem.columns
      .filter((column) => column.hostNodeId)
      .map((column) => [column.hostNodeId!, column]),
  );
  const existingById = new Map(
    params.frameSystem.columns.map((column) => [column.id, column]),
  );
  const generatedHostNodeIds = new Set(
    generatedAutoColumns.map((column) => column.hostNodeId).filter(Boolean),
  );
  const generatedIds = new Set(generatedAutoColumns.map((column) => column.id));
  const columns =
    params.frameSystem.columns.length > 0
      ? [
          ...generatedAutoColumns.map((generated) => {
            const existing = generated.hostNodeId
              ? existingByHostNodeId.get(generated.hostNodeId)
              : undefined;
            const existingByGeneratedId = existingById.get(generated.id);
            return existing || existingByGeneratedId
              ? {
                  ...(existing ?? existingByGeneratedId!),
                  position: generated.position,
                  hostSegmentId: generated.hostSegmentId,
                }
              : generated;
          }),
          ...params.frameSystem.columns.filter((column) =>
            column.hostNodeId
              ? !generatedHostNodeIds.has(column.hostNodeId) &&
                column.source !== "auto_frame_layout"
              : !generatedIds.has(column.id) &&
                column.source !== "auto_frame_layout",
          ),
        ]
      : generatedAutoColumns;

  const resolvedBeams = createPerimeterBeamsForLayout({
    layout: params.layout,
    segmentFrames: params.segmentFrames,
    columns,
    frameSystem: params.frameSystem,
    foundation,
    wallHeightMeters: wallHeight,
  });

  const elevations = resolveFoundationElevations({
    foundation,
    wallHeightMeters: wallHeight,
  });
  const reconciledColumns = columns.map((column) => ({
    ...column,
    ...resolveColumnGeometry({
      column,
      elevations,
    }),
  }));
  const isolatedFootings = createIsolatedFootingsForColumns({
    columns: reconciledColumns,
    foundation,
    topOfFootingY: elevations.topOfFootingY,
  });
  const wallFootings = createWallFootingsForPartitionSegments({
    layout: params.layout,
    segmentFrames: params.segmentFrames,
    foundation,
    topOfPlinthBeamY: elevations.bottomOfPlinthBeamY,
  });

  return {
    frameSystem: {
      ...params.frameSystem,
      buildingSystemMode: "reinforced_concrete_frame_with_cmu_infill",
      columns: reconciledColumns,
      beams: resolvedBeams,
    },
    isolatedFootings,
    wallFootings,
  };
}

export function findColumnAtNode(
  columns: StructuralColumn[],
  nodeId: string,
): StructuralColumn | undefined {
  return columns.find((c) => c.hostNodeId === nodeId);
}

export function beamSpanLengthMeters(beam: StructuralBeam): number {
  return Math.hypot(
    beam.endPoint.x - beam.startPoint.x,
    beam.endPoint.z - beam.startPoint.z,
  );
}

export function columnVolumeCubicMeters(column: StructuralColumn): number {
  return column.widthMeters * column.depthMeters * column.heightMeters;
}

export function beamVolumeCubicMeters(beam: StructuralBeam): number {
  return beamSpanLengthMeters(beam) * beam.widthMeters * beam.depthMeters;
}

/** Subtract approximate intersection volume at column/beam joints. */
export function beamColumnIntersectionVolumeCubicMeters(
  column: StructuralColumn,
  beam: StructuralBeam,
): number {
  const overlapW = Math.min(column.widthMeters, beam.widthMeters);
  const overlapD = Math.min(column.depthMeters, beam.depthMeters);
  const overlapH = Math.min(
    column.topElevationMeters - column.baseElevationMeters,
    beam.topElevationMeters - beam.baseElevationMeters,
  );
  return overlapW * overlapD * overlapH;
}

export function deduplicatedStructuralConcreteVolumeCubicMeters(params: {
  columns: StructuralColumn[];
  beams: StructuralBeam[];
}): number {
  let total = 0;
  for (const col of params.columns) {
    total += columnVolumeCubicMeters(col);
  }
  for (const beam of params.beams) {
    total += beamVolumeCubicMeters(beam);
  }
  for (const beam of params.beams) {
    const startCol = params.columns.find((c) => c.id === beam.startColumnId);
    const endCol = params.columns.find((c) => c.id === beam.endColumnId);
    if (startCol)
      total -= beamColumnIntersectionVolumeCubicMeters(startCol, beam);
    if (endCol) total -= beamColumnIntersectionVolumeCubicMeters(endCol, beam);
  }
  return Math.max(0, total);
}

export { TOP_OF_PLINTH_BEAM_Y, TOP_OF_PLINTH_BEAM_Y as TOP_OF_GRADE_BEAM_Y };
