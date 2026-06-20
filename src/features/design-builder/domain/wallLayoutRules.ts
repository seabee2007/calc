import type {
  CmuWallSystemParameters,
  DesignWallBondStrategy,
  DesignWallCornerOverride,
  DesignWallDimensionBasis,
  DesignWallLayoutParameters,
  DesignWallNode,
  DesignWallSegment,
  WallOpeningParameters,
} from '../types';
import { analyzeCmuModuleFit, resolveCmuModuleConfig, snapLengthToCmuModule } from './cmuModuleRules';

export const DEFAULT_GRID_SPACING_METERS = 0.1;
export const MIN_WALL_SEGMENT_LENGTH_METERS = 0.08;
export const ENDPOINT_SNAP_TOLERANCE_METERS = 0.3;

export function createWallLayoutId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`}`;
}

export function createEmptyWallLayout(
  overrides: Partial<DesignWallLayoutParameters> = {},
): DesignWallLayoutParameters {
  return {
    kind: 'wall_layout',
    dimensionBasis: 'outside_face',
    nodes: [],
    segments: [],
    isFootprintClosed: false,
    defaultWallHeightMeters: 2.8,
    defaultWallThicknessMeters: 0.19,
    snapToGrid: true,
    snapToModule: true,
    gridSpacingMeters: DEFAULT_GRID_SPACING_METERS,
    orthogonalLock: true,
    cornerOverrides: [],
    ...overrides,
  };
}

export function createBlankWallLayout(overrides: {
  defaultWallHeightMeters?: number;
  defaultWallThicknessMeters?: number;
  dimensionBasis?: DesignWallDimensionBasis;
} = {}): DesignWallLayoutParameters {
  return createEmptyWallLayout({
    dimensionBasis: overrides.dimensionBasis ?? 'outside_face',
    defaultWallHeightMeters: overrides.defaultWallHeightMeters ?? 2.8,
    defaultWallThicknessMeters: overrides.defaultWallThicknessMeters ?? 0.19,
  });
}

export function segmentLength(segment: DesignWallSegment, nodes: readonly DesignWallNode[]): number {
  const start = nodes.find((node) => node.id === segment.startNodeId);
  const end = nodes.find((node) => node.id === segment.endNodeId);
  if (!start || !end) return 0;
  return Math.hypot(end.x - start.x, end.z - start.z);
}

export function segmentAngleRadians(segment: DesignWallSegment, nodes: readonly DesignWallNode[]): number {
  const start = nodes.find((node) => node.id === segment.startNodeId);
  const end = nodes.find((node) => node.id === segment.endNodeId);
  if (!start || !end) return 0;
  return Math.atan2(end.z - start.z, end.x - start.x);
}

export function segmentCenterlineOffset(
  thicknessMeters: number,
  basis: DesignWallDimensionBasis,
): number {
  if (basis === 'wall_centerline') return 0;
  if (basis === 'inside_clear') return thicknessMeters / 2;
  return -thicknessMeters / 2;
}

export function offsetPointInward(
  x: number,
  z: number,
  angleRadians: number,
  thicknessMeters: number,
  basis: DesignWallDimensionBasis,
): { x: number; z: number } {
  const offset = segmentCenterlineOffset(thicknessMeters, basis);
  const normalX = -Math.sin(angleRadians);
  const normalZ = Math.cos(angleRadians);
  return {
    x: x + normalX * offset,
    z: z + normalZ * offset,
  };
}

export function snapPlanPoint(
  x: number,
  z: number,
  layout: DesignWallLayoutParameters,
  moduleLengthMeters?: number,
): { x: number; z: number } {
  let nextX = x;
  let nextZ = z;
  if (layout.snapToGrid && layout.gridSpacingMeters > 0) {
    nextX = Math.round(nextX / layout.gridSpacingMeters) * layout.gridSpacingMeters;
    nextZ = Math.round(nextZ / layout.gridSpacingMeters) * layout.gridSpacingMeters;
  }
  if (layout.snapToModule && moduleLengthMeters && moduleLengthMeters > 0) {
    nextX = Math.round(nextX / moduleLengthMeters) * moduleLengthMeters;
    nextZ = Math.round(nextZ / moduleLengthMeters) * moduleLengthMeters;
  }
  return { x: nextX, z: nextZ };
}

export function constrainAngle(
  start: Pick<DesignWallNode, 'x' | 'z'>,
  targetX: number,
  targetZ: number,
  orthogonalLock: boolean,
  shiftHeld = false,
): { x: number; z: number } {
  const dx = targetX - start.x;
  const dz = targetZ - start.z;
  const length = Math.hypot(dx, dz);
  if (length <= 0) return { x: start.x, z: start.z };
  let angle = Math.atan2(dz, dx);
  if (orthogonalLock || shiftHeld) {
    const step = Math.PI / 4;
    angle = Math.round(angle / step) * step;
  }
  return {
    x: start.x + Math.cos(angle) * length,
    z: start.z + Math.sin(angle) * length,
  };
}

export function projectExactSegmentLength(
  start: Pick<DesignWallNode, 'x' | 'z'>,
  targetX: number,
  targetZ: number,
  exactLengthMeters: number,
): { x: number; z: number } {
  const dx = targetX - start.x;
  const dz = targetZ - start.z;
  const current = Math.hypot(dx, dz);
  if (current <= 0) return { x: start.x + exactLengthMeters, z: start.z };
  const scale = exactLengthMeters / current;
  return { x: start.x + dx * scale, z: start.z + dz * scale };
}

export function findNearestNode(
  nodes: readonly DesignWallNode[],
  x: number,
  z: number,
  toleranceMeters: number,
): DesignWallNode | null {
  let best: DesignWallNode | null = null;
  let bestDistance = toleranceMeters;
  nodes.forEach((node) => {
    const distance = Math.hypot(node.x - x, node.z - z);
    if (distance <= bestDistance) {
      best = node;
      bestDistance = distance;
    }
  });
  return best;
}

export function cleanupWallLayoutGraph(
  layout: DesignWallLayoutParameters,
  toleranceMeters = ENDPOINT_SNAP_TOLERANCE_METERS,
): DesignWallLayoutParameters {
  const nodes: DesignWallNode[] = [];
  const nodeIdMap = new Map<string, string>();
  layout.nodes.forEach((node) => {
    const existing = findNearestNode(nodes, node.x, node.z, toleranceMeters);
    if (existing) {
      nodeIdMap.set(node.id, existing.id);
      return;
    }
    nodes.push(node);
    nodeIdMap.set(node.id, node.id);
  });

  const segmentKeys = new Set<string>();
  const segments: DesignWallSegment[] = [];
  layout.segments.forEach((segment) => {
    const startNodeId = nodeIdMap.get(segment.startNodeId) ?? segment.startNodeId;
    const endNodeId = nodeIdMap.get(segment.endNodeId) ?? segment.endNodeId;
    if (startNodeId === endNodeId) return;
    const start = nodes.find((node) => node.id === startNodeId);
    const end = nodes.find((node) => node.id === endNodeId);
    if (!start || !end) return;
    if (Math.hypot(end.x - start.x, end.z - start.z) < MIN_WALL_SEGMENT_LENGTH_METERS) return;
    const key = [startNodeId, endNodeId].sort().join(':');
    if (segmentKeys.has(key)) return;
    segmentKeys.add(key);
    segments.push({ ...segment, startNodeId, endNodeId });
  });

  const usedNodeIds = new Set<string>();
  segments.forEach((segment) => {
    usedNodeIds.add(segment.startNodeId);
    usedNodeIds.add(segment.endNodeId);
  });
  const cleaned = {
    ...layout,
    nodes: nodes.filter((node) => usedNodeIds.has(node.id)),
    segments,
  };
  return {
    ...cleaned,
    isFootprintClosed: detectClosedFootprint(cleaned),
  };
}

export function addWallSegment(
  layout: DesignWallLayoutParameters,
  startNodeId: string,
  endX: number,
  endZ: number,
  options?: { exactLengthMeters?: number; wallHeightMeters?: number; wallThicknessMeters?: number },
): DesignWallLayoutParameters {
  const start = layout.nodes.find((node) => node.id === startNodeId);
  if (!start) return layout;
  let point = { x: endX, z: endZ };
  if (options?.exactLengthMeters != null && options.exactLengthMeters > 0) {
    point = projectExactSegmentLength(start, endX, endZ, options.exactLengthMeters);
  }
  const existingEnd = findNearestNode(layout.nodes, point.x, point.z, Math.max(ENDPOINT_SNAP_TOLERANCE_METERS, layout.gridSpacingMeters));
  if (existingEnd?.id === startNodeId) return layout;
  if (!existingEnd && Math.hypot(point.x - start.x, point.z - start.z) < MIN_WALL_SEGMENT_LENGTH_METERS) return layout;
  const endNodeId = existingEnd?.id ?? createWallLayoutId('node');
  const nodes = existingEnd
    ? layout.nodes
    : [...layout.nodes, { id: endNodeId, x: point.x, z: point.z }];
  const segment: DesignWallSegment = {
    id: createWallLayoutId('segment'),
    startNodeId,
    endNodeId,
    wallHeightMeters: options?.wallHeightMeters ?? layout.defaultWallHeightMeters,
    wallThicknessMeters: options?.wallThicknessMeters ?? layout.defaultWallThicknessMeters,
  };
  const next = {
    ...layout,
    nodes,
    segments: [...layout.segments, segment],
  };
  return cleanupWallLayoutGraph({
    ...next,
    isFootprintClosed: detectClosedFootprint(next),
  });
}

export function moveWallNode(
  layout: DesignWallLayoutParameters,
  nodeId: string,
  x: number,
  z: number,
): DesignWallLayoutParameters {
  return cleanupWallLayoutGraph({
    ...layout,
    nodes: layout.nodes.map((node) => (node.id === nodeId ? { ...node, x, z } : node)),
    isFootprintClosed: detectClosedFootprint({
      ...layout,
      nodes: layout.nodes.map((node) => (node.id === nodeId ? { ...node, x, z } : node)),
    }),
  });
}

export function detectClosedFootprint(layout: DesignWallLayoutParameters): boolean {
  if (layout.segments.length < 3 || layout.nodes.length < 3) return false;
  const degree = new Map<string, number>();
  layout.segments.forEach((segment) => {
    degree.set(segment.startNodeId, (degree.get(segment.startNodeId) ?? 0) + 1);
    degree.set(segment.endNodeId, (degree.get(segment.endNodeId) ?? 0) + 1);
  });
  const values = [...degree.values()];
  if (values.length === 0) return false;
  return values.every((count) => count === 2);
}

export function closeFootprint(layout: DesignWallLayoutParameters): DesignWallLayoutParameters {
  if (layout.segments.length === 0 || layout.nodes.length === 0) return layout;
  const firstSegment = layout.segments[0];
  const lastSegment = layout.segments[layout.segments.length - 1];
  if (lastSegment.endNodeId === firstSegment.startNodeId) {
    return { ...layout, isFootprintClosed: true };
  }
  const closingSegment: DesignWallSegment = {
    id: createWallLayoutId('segment'),
    startNodeId: lastSegment.endNodeId,
    endNodeId: firstSegment.startNodeId,
    wallHeightMeters: layout.defaultWallHeightMeters,
    wallThicknessMeters: layout.defaultWallThicknessMeters,
  };
  const next = {
    ...layout,
    segments: [...layout.segments, closingSegment],
  };
  return cleanupWallLayoutGraph({ ...next, isFootprintClosed: detectClosedFootprint(next) });
}

export function removeLastSegment(layout: DesignWallLayoutParameters): DesignWallLayoutParameters {
  if (layout.segments.length === 0) return layout;
  const removed = layout.segments[layout.segments.length - 1];
  const segments = layout.segments.slice(0, -1);
  const usedNodeIds = new Set<string>();
  segments.forEach((segment) => {
    usedNodeIds.add(segment.startNodeId);
    usedNodeIds.add(segment.endNodeId);
  });
  const orphanEnd = !usedNodeIds.has(removed.endNodeId);
  return cleanupWallLayoutGraph({
    ...layout,
    segments,
    nodes: orphanEnd ? layout.nodes.filter((node) => node.id !== removed.endNodeId) : layout.nodes,
    isFootprintClosed: detectClosedFootprint({ ...layout, segments }),
  });
}

export function deleteWallSegment(
  layout: DesignWallLayoutParameters,
  segmentId: string,
): DesignWallLayoutParameters {
  const segments = layout.segments.filter((segment) => segment.id !== segmentId);
  const usedNodeIds = new Set<string>();
  segments.forEach((segment) => {
    usedNodeIds.add(segment.startNodeId);
    usedNodeIds.add(segment.endNodeId);
  });
  return cleanupWallLayoutGraph({
    ...layout,
    segments,
    nodes: layout.nodes.filter((node) => usedNodeIds.has(node.id)),
    isFootprintClosed: detectClosedFootprint({ ...layout, segments }),
  });
}

export function summarizeSegmentModuleFit(
  segment: DesignWallSegment,
  layout: DesignWallLayoutParameters,
  wall: CmuWallSystemParameters,
) {
  const length = segmentLength(segment, layout.nodes);
  const module = resolveCmuModuleConfig(wall);
  const snappedLength =
    layout.snapToModule && wall.snapToModule
      ? snapLengthToCmuModule(length, module.moduleLengthMeters)
      : length;
  return {
    segmentId: segment.id,
    lengthMeters: length,
    snappedLengthMeters: snappedLength,
    fit: analyzeCmuModuleFit(snappedLength, module.moduleLengthMeters),
  };
}

export function deriveExteriorBounds(layout: DesignWallLayoutParameters): {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  exteriorLengthMeters: number;
  exteriorWidthMeters: number;
} | null {
  if (layout.nodes.length === 0) return null;
  const xs = layout.nodes.map((node) => node.x);
  const zs = layout.nodes.map((node) => node.z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    exteriorLengthMeters: maxX - minX,
    exteriorWidthMeters: maxZ - minZ,
  };
}

export function createOutsideFaceRectangleLayout(params: {
  lengthMeters: number;
  widthMeters: number;
  wallHeightMeters?: number;
  wallThicknessMeters?: number;
}): DesignWallLayoutParameters {
  const halfLength = params.lengthMeters / 2;
  const halfWidth = params.widthMeters / 2;
  const sw = createWallLayoutId('node');
  const se = createWallLayoutId('node');
  const ne = createWallLayoutId('node');
  const nw = createWallLayoutId('node');
  const height = params.wallHeightMeters ?? 2.8;
  const thickness = params.wallThicknessMeters ?? 0.19;
  const segmentDefaults = { wallHeightMeters: height, wallThicknessMeters: thickness };
  return {
    kind: 'wall_layout',
    dimensionBasis: 'outside_face',
    nodes: [
      { id: sw, x: -halfLength, z: -halfWidth },
      { id: se, x: halfLength, z: -halfWidth },
      { id: ne, x: halfLength, z: halfWidth },
      { id: nw, x: -halfLength, z: halfWidth },
    ],
    segments: [
      { id: createWallLayoutId('segment'), startNodeId: sw, endNodeId: se, ...segmentDefaults },
      { id: createWallLayoutId('segment'), startNodeId: se, endNodeId: ne, ...segmentDefaults },
      { id: createWallLayoutId('segment'), startNodeId: ne, endNodeId: nw, ...segmentDefaults },
      { id: createWallLayoutId('segment'), startNodeId: nw, endNodeId: sw, ...segmentDefaults },
    ],
    isFootprintClosed: true,
    defaultWallHeightMeters: height,
    defaultWallThicknessMeters: thickness,
    snapToGrid: true,
    snapToModule: true,
    gridSpacingMeters: DEFAULT_GRID_SPACING_METERS,
    orthogonalLock: true,
    cornerOverrides: [],
  };
}

export function resolveSegmentAtPoint(
  layout: DesignWallLayoutParameters,
  x: number,
  z: number,
  toleranceMeters = 0.35,
): { segment: DesignWallSegment; positionAlongSegment: number; distance: number } | null {
  let best: { segment: DesignWallSegment; positionAlongSegment: number; distance: number } | null = null;
  layout.segments.forEach((segment) => {
    const start = layout.nodes.find((node) => node.id === segment.startNodeId);
    const end = layout.nodes.find((node) => node.id === segment.endNodeId);
    if (!start || !end) return;
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const lengthSq = dx * dx + dz * dz;
    if (lengthSq <= 0) return;
    const t = Math.max(0, Math.min(1, ((x - start.x) * dx + (z - start.z) * dz) / lengthSq));
    const projX = start.x + dx * t;
    const projZ = start.z + dz * t;
    const distance = Math.hypot(x - projX, z - projZ);
    const length = Math.sqrt(lengthSq);
    if (distance <= toleranceMeters && (!best || distance < best.distance)) {
      best = {
        segment,
        positionAlongSegment: t * length,
        distance,
      };
    }
  });
  return best;
}

export function migrateOpeningToSegment(
  opening: WallOpeningParameters,
  layout: DesignWallLayoutParameters,
  wall: CmuWallSystemParameters,
): WallOpeningParameters {
  if (opening.wallSegmentId && opening.positionAlongSegment != null) return opening;
  if (!opening.wallFace || opening.offsetMeters == null) return opening;
  const bounds = deriveExteriorBounds(layout);
  if (!bounds) return opening;
  const { minX, maxX, minZ, maxZ } = bounds;
  const pointByFace: Record<NonNullable<WallOpeningParameters['wallFace']>, { x: number; z: number }> = {
    south: { x: minX + opening.offsetMeters, z: minZ },
    north: { x: minX + opening.offsetMeters, z: maxZ },
    east: { x: maxX, z: minZ + opening.offsetMeters },
    west: { x: minX, z: minZ + opening.offsetMeters },
  };
  const point = pointByFace[opening.wallFace];
  const hit = resolveSegmentAtPoint(layout, point.x, point.z, 0.5);
  if (!hit) return opening;
  return {
    ...opening,
    wallSegmentId: hit.segment.id,
    positionAlongSegment: hit.positionAlongSegment,
  };
}

export function openingsForSegment(
  openings: readonly WallOpeningParameters[],
  segmentId: string,
): WallOpeningParameters[] {
  return openings.filter((opening) => opening.wallSegmentId === segmentId);
}

export function applyCornerOverride(
  overrides: readonly DesignWallCornerOverride[],
  nodeId: string,
  bondStrategy: DesignWallBondStrategy,
): DesignWallCornerOverride[] {
  const filtered = overrides.filter((item) => item.nodeId !== nodeId);
  return [...filtered, { nodeId, bondStrategy }];
}
