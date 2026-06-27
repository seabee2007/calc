import type {
  CmuWallSystemParameters,
  DesignWallBondStrategy,
  DesignWallCornerOverride,
  DesignWallDimensionBasis,
  DesignWallLayoutParameters,
  DesignWallNode,
  DesignWallRole,
  DesignWallSegment,
  WallOpeningParameters,
} from '../types';
import { analyzeCmuModuleFit, resolveCmuModuleConfig, snapLengthToCmuModule } from './cmuModuleRules';

export const DEFAULT_GRID_SPACING_METERS = 0.1;
export const MIN_WALL_SEGMENT_LENGTH_METERS = 0.08;
export const ENDPOINT_SNAP_TOLERANCE_METERS = 0.3;
export const GUIDE_CAPTURE_RADIUS_PX = 12;
export const NODE_CAPTURE_RADIUS_PX = 18;

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
  _orthogonalLock: boolean,
  shiftHeld = false,
): { x: number; z: number } {
  const dx = targetX - start.x;
  const dz = targetZ - start.z;
  const length = Math.hypot(dx, dz);
  if (length <= 0 || !shiftHeld) return { x: targetX, z: targetZ };
  const step = Math.PI / 4;
  const angle = Math.round(Math.atan2(dz, dx) / step) * step;
  return {
    x: start.x + Math.cos(angle) * length,
    z: start.z + Math.sin(angle) * length,
  };
}

export type DrawWallGuideKind = 'free' | 'perpendicular' | 'parallel';

export type DrawWallGuidance = {
  point: { x: number; z: number };
  kind: DrawWallGuideKind;
  label?: string;
  guideLine?: { start: { x: number; z: number }; end: { x: number; z: number } };
  secondaryGuideLine?: { start: { x: number; z: number }; end: { x: number; z: number } };
  lengthMeters?: number;
  angleDegrees?: number;
};

export type GuideDirectionCandidate = {
  direction: { x: number; z: number };
  label: string;
  kind: DrawWallGuideKind;
};

function normalizeVector(dx: number, dz: number): { x: number; z: number } | null {
  const length = Math.hypot(dx, dz);
  if (length <= 1e-9) return null;
  return { x: dx / length, z: dz / length };
}

function projectPointOnRay(
  start: Pick<DesignWallNode, 'x' | 'z'>,
  point: { x: number; z: number },
  direction: { x: number; z: number },
) {
  const distance = (point.x - start.x) * direction.x + (point.z - start.z) * direction.z;
  return {
    distance,
    point: {
      x: start.x + direction.x * distance,
      z: start.z + direction.z * distance,
    },
  };
}

function measureAngleDegrees(start: Pick<DesignWallNode, 'x' | 'z'>, point: { x: number; z: number }): number {
  const dx = point.x - start.x;
  const dz = point.z - start.z;
  return ((Math.atan2(dz, dx) * 180) / Math.PI + 360) % 360;
}

export function listOrthogonalGuideDirections(params: {
  layout: DesignWallLayoutParameters;
  activeNodeId: string;
}): GuideDirectionCandidate[] {
  const activeNode = params.layout.nodes.find((node) => node.id === params.activeNodeId);
  if (!activeNode) return [];
  const directions: GuideDirectionCandidate[] = [
    { direction: { x: 1, z: 0 }, label: '90°', kind: 'perpendicular' },
    { direction: { x: -1, z: 0 }, label: '90°', kind: 'perpendicular' },
    { direction: { x: 0, z: 1 }, label: '90°', kind: 'perpendicular' },
    { direction: { x: 0, z: -1 }, label: '90°', kind: 'perpendicular' },
  ];
  const firstSegment = params.layout.segments[0];
  if (!firstSegment) return directions;
  const firstStart = params.layout.nodes.find((node) => node.id === firstSegment.startNodeId);
  const firstEnd = params.layout.nodes.find((node) => node.id === firstSegment.endNodeId);
  if (!firstStart || !firstEnd) return directions;
  const firstDirection = normalizeVector(firstEnd.x - firstStart.x, firstEnd.z - firstStart.z);
  if (!firstDirection) return directions;
  directions.push(
    { direction: firstDirection, label: 'Parallel', kind: 'parallel' },
    { direction: { x: -firstDirection.x, z: -firstDirection.z }, label: 'Parallel', kind: 'parallel' },
    { direction: { x: -firstDirection.z, z: firstDirection.x }, label: '90°', kind: 'perpendicular' },
    { direction: { x: firstDirection.z, z: -firstDirection.x }, label: '90°', kind: 'perpendicular' },
  );
  return directions;
}

export function resolveShiftConstrainedPoint(params: {
  layout: DesignWallLayoutParameters;
  activeNodeId: string;
  rawPoint: { x: number; z: number };
}): { point: { x: number; z: number }; label: string; kind: DrawWallGuideKind } {
  const activeNode = params.layout.nodes.find((node) => node.id === params.activeNodeId);
  if (!activeNode) {
    return { point: params.rawPoint, label: 'Free angle', kind: 'free' };
  }
  const candidates = listOrthogonalGuideDirections(params);
  const ranked = candidates
    .map((candidate) => {
      const projection = projectPointOnRay(activeNode, params.rawPoint, candidate.direction);
      return {
        candidate,
        point: projection.point,
        error: Math.hypot(params.rawPoint.x - projection.point.x, params.rawPoint.z - projection.point.z),
      };
    })
    .sort((a, b) => a.error - b.error);
  const best = ranked[0];
  if (!best) return { point: params.rawPoint, label: 'Free angle', kind: 'free' };
  return {
    point: best.point,
    label: best.candidate.kind === 'parallel' ? 'Locked parallel' : 'Locked 90°',
    kind: best.candidate.kind,
  };
}

export function resolveDrawWallGuidance(params: {
  layout: DesignWallLayoutParameters;
  activeNodeId: string;
  rawPoint: { x: number; z: number };
  orthogonalLock: boolean;
}): DrawWallGuidance {
  const activeNode = params.layout.nodes.find((node) => node.id === params.activeNodeId);
  if (!activeNode) {
    return { point: params.rawPoint, kind: 'free' };
  }
  const lengthMeters = Math.hypot(params.rawPoint.x - activeNode.x, params.rawPoint.z - activeNode.z);
  const angleDegrees = measureAngleDegrees(activeNode, params.rawPoint);
  if (!params.orthogonalLock) {
    return { point: params.rawPoint, kind: 'free', lengthMeters, angleDegrees };
  }

  const candidates = listOrthogonalGuideDirections(params);
  const ranked = candidates
    .map((candidate) => {
      const projection = projectPointOnRay(activeNode, params.rawPoint, candidate.direction);
      if (projection.distance <= 0) return null;
      return {
        candidate,
        projection,
      };
    })
    .filter((candidate): candidate is {
      candidate: GuideDirectionCandidate;
      projection: ReturnType<typeof projectPointOnRay>;
    } => candidate != null)
    .sort(
      (a, b) =>
        Math.hypot(params.rawPoint.x - a.projection.point.x, params.rawPoint.z - a.projection.point.z) -
        Math.hypot(params.rawPoint.x - b.projection.point.x, params.rawPoint.z - b.projection.point.z),
    );
  const nearest = ranked[0];
  if (!nearest) {
    return { point: params.rawPoint, kind: 'free', lengthMeters, angleDegrees };
  }

  const guidedLengthMeters = Math.hypot(
    nearest.projection.point.x - activeNode.x,
    nearest.projection.point.z - activeNode.z,
  );
  const guidedAngleDegrees = measureAngleDegrees(activeNode, nearest.projection.point);
  const rayLength = Math.max(1, guidedLengthMeters);
  return {
    point: nearest.projection.point,
    kind: nearest.candidate.kind,
    label: nearest.candidate.label,
    guideLine: {
      start: activeNode,
      end: {
        x: activeNode.x + nearest.candidate.direction.x * rayLength,
        z: activeNode.z + nearest.candidate.direction.z * rayLength,
      },
    },
    lengthMeters: guidedLengthMeters,
    angleDegrees: guidedAngleDegrees,
  };
}

export const ORTHOGONAL_TOLERANCE_DEGREES = 3;

export type OrthogonalClosureAssist = {
  candidatePoint: { x: number; z: number };
  firstNode: { x: number; z: number };
  isEligible: boolean;
  closingLengthMeters: number;
  closingAngleDegrees: number;
};

function angleBetweenDirectionsDegrees(
  left: { x: number; z: number },
  right: { x: number; z: number },
): number {
  const leftLength = Math.hypot(left.x, left.z);
  const rightLength = Math.hypot(right.x, right.z);
  if (leftLength <= 1e-9 || rightLength <= 1e-9) return 0;
  const dot = (left.x * right.x + left.z * right.z) / (leftLength * rightLength);
  const clamped = Math.max(-1, Math.min(1, dot));
  return (Math.acos(clamped) * 180) / Math.PI;
}

export function areDirectionsPerpendicular(
  left: { x: number; z: number },
  right: { x: number; z: number },
  toleranceDegrees = ORTHOGONAL_TOLERANCE_DEGREES,
): boolean {
  const angle = angleBetweenDirectionsDegrees(left, right);
  return Math.abs(angle - 90) <= toleranceDegrees;
}

function nearPlanPoint(
  left: { x: number; z: number },
  right: { x: number; z: number },
  toleranceMeters = 1e-4,
): boolean {
  return Math.hypot(left.x - right.x, left.z - right.z) <= toleranceMeters;
}

function segmentCrossesCommittedInterior(params: {
  start: { x: number; z: number };
  end: { x: number; z: number };
  layout: DesignWallLayoutParameters;
}): boolean {
  return params.layout.segments.some((segment) => {
    const segStart = params.layout.nodes.find((node) => node.id === segment.startNodeId);
    const segEnd = params.layout.nodes.find((node) => node.id === segment.endNodeId);
    if (!segStart || !segEnd) return false;
    if (!segmentIntersection(params.start, params.end, segStart, segEnd)) return false;
    const touchesAtEndpoint =
      nearPlanPoint(params.start, segStart) ||
      nearPlanPoint(params.start, segEnd) ||
      nearPlanPoint(params.end, segStart) ||
      nearPlanPoint(params.end, segEnd);
    return !touchesAtEndpoint;
  });
}

export function resolveOrthogonalCornerPoint(params: {
  layout: DesignWallLayoutParameters;
  activeNodeId: string;
}): { x: number; z: number } | null {
  if (params.layout.segments.length < 2) return null;
  const firstSegment = params.layout.segments[0];
  const lastSegment = params.layout.segments[params.layout.segments.length - 1];
  if (lastSegment.endNodeId !== params.activeNodeId) return null;
  const firstNode = params.layout.nodes.find((node) => node.id === firstSegment.startNodeId);
  const previousNode = params.layout.nodes.find((node) => node.id === lastSegment.startNodeId);
  const activeNode = params.layout.nodes.find((node) => node.id === params.activeNodeId);
  if (!firstNode || !previousNode || !activeNode) return null;
  return {
    x: activeNode.x + (firstNode.x - previousNode.x),
    z: activeNode.z + (firstNode.z - previousNode.z),
  };
}

export function resolveOrthogonalClosureAssist(params: {
  layout: DesignWallLayoutParameters;
  activeNodeId: string;
  candidatePoint: { x: number; z: number };
}): OrthogonalClosureAssist | null {
  if (params.layout.segments.length < 2) return null;

  const firstSegment = params.layout.segments[0];
  const lastSegment = params.layout.segments[params.layout.segments.length - 1];
  if (lastSegment.endNodeId !== params.activeNodeId) return null;

  const activeNode = params.layout.nodes.find((node) => node.id === params.activeNodeId);
  const firstNode = params.layout.nodes.find((node) => node.id === firstSegment.startNodeId);
  const previousNode = params.layout.nodes.find((node) => node.id === lastSegment.startNodeId);
  if (!activeNode || !firstNode || !previousNode) return null;

  const committedNodeCount = params.layout.segments.length + 1;
  if (committedNodeCount < 3) return null;

  const activeLengthMeters = Math.hypot(
    params.candidatePoint.x - activeNode.x,
    params.candidatePoint.z - activeNode.z,
  );
  if (activeLengthMeters < MIN_WALL_SEGMENT_LENGTH_METERS) return null;

  const distanceToFirstNode = Math.hypot(
    params.candidatePoint.x - firstNode.x,
    params.candidatePoint.z - firstNode.z,
  );
  if (distanceToFirstNode < MIN_WALL_SEGMENT_LENGTH_METERS) return null;
  if (nearPlanPoint(params.candidatePoint, activeNode, MIN_WALL_SEGMENT_LENGTH_METERS)) return null;

  const previousVector = {
    x: activeNode.x - previousNode.x,
    z: activeNode.z - previousNode.z,
  };
  const activeVector = {
    x: params.candidatePoint.x - activeNode.x,
    z: params.candidatePoint.z - activeNode.z,
  };
  const closingVector = {
    x: firstNode.x - params.candidatePoint.x,
    z: firstNode.z - params.candidatePoint.z,
  };

  if (!areDirectionsPerpendicular(previousVector, activeVector)) return null;
  if (!areDirectionsPerpendicular(activeVector, closingVector)) return null;

  const closingLengthMeters = Math.hypot(closingVector.x, closingVector.z);
  if (closingLengthMeters < MIN_WALL_SEGMENT_LENGTH_METERS) return null;

  if (
    segmentCrossesCommittedInterior({
      start: activeNode,
      end: params.candidatePoint,
      layout: params.layout,
    })
  ) {
    return null;
  }
  if (
    segmentCrossesCommittedInterior({
      start: params.candidatePoint,
      end: firstNode,
      layout: params.layout,
    })
  ) {
    return null;
  }

  const closingAngleDegrees = Math.round(angleBetweenDirectionsDegrees(activeVector, closingVector));

  return {
    candidatePoint: params.candidatePoint,
    firstNode,
    isEligible: true,
    closingLengthMeters,
    closingAngleDegrees,
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
  options?: {
    exactLengthMeters?: number;
    wallHeightMeters?: number;
    wallThicknessMeters?: number;
    wallRole?: DesignWallRole;
  },
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
    wallRole: options?.wallRole,
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

/** Next draw anchor when resuming an open chain; null when the user must pick a start on existing geometry. */
export function resolveActiveDrawNodeId(layout: DesignWallLayoutParameters): string | null {
  if (layout.segments.length === 0) return null;
  if (layout.isFootprintClosed || detectClosedFootprint(layout)) return null;
  return layout.segments.at(-1)?.endNodeId ?? null;
}

function segmentIntersection(
  aStart: { x: number; z: number },
  aEnd: { x: number; z: number },
  bStart: { x: number; z: number },
  bEnd: { x: number; z: number },
): boolean {
  const orientation = (p: { x: number; z: number }, q: { x: number; z: number }, r: { x: number; z: number }) => {
    const value = (q.z - p.z) * (r.x - q.x) - (q.x - p.x) * (r.z - q.z);
    if (Math.abs(value) < 1e-9) return 0;
    return value > 0 ? 1 : 2;
  };
  const onSegment = (p: { x: number; z: number }, q: { x: number; z: number }, r: { x: number; z: number }) =>
    Math.min(p.x, r.x) - 1e-6 <= q.x &&
    q.x <= Math.max(p.x, r.x) + 1e-6 &&
    Math.min(p.z, r.z) - 1e-6 <= q.z &&
    q.z <= Math.max(p.z, r.z) + 1e-6;

  const o1 = orientation(aStart, aEnd, bStart);
  const o2 = orientation(aStart, aEnd, bEnd);
  const o3 = orientation(bStart, bEnd, aStart);
  const o4 = orientation(bStart, bEnd, aEnd);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(aStart, bStart, aEnd)) return true;
  if (o2 === 0 && onSegment(aStart, bEnd, aEnd)) return true;
  if (o3 === 0 && onSegment(bStart, aStart, bEnd)) return true;
  if (o4 === 0 && onSegment(bStart, aEnd, bEnd)) return true;
  return false;
}

export function closingSegmentWouldIntersect(layout: DesignWallLayoutParameters): boolean {
  if (layout.segments.length < 3) return false;
  const firstSegment = layout.segments[0];
  const lastSegment = layout.segments[layout.segments.length - 1];
  const closingStart = layout.nodes.find((node) => node.id === lastSegment.endNodeId);
  const closingEnd = layout.nodes.find((node) => node.id === firstSegment.startNodeId);
  if (!closingStart || !closingEnd) return false;
  return layout.segments.some((segment, index) => {
    if (index === 0 || index === layout.segments.length - 1) return false;
    const start = layout.nodes.find((node) => node.id === segment.startNodeId);
    const end = layout.nodes.find((node) => node.id === segment.endNodeId);
    if (!start || !end) return false;
    return segmentIntersection(closingStart, closingEnd, start, end);
  });
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
      { id: createWallLayoutId('segment'), startNodeId: sw, endNodeId: se, wallRole: 'exterior', ...segmentDefaults },
      { id: createWallLayoutId('segment'), startNodeId: se, endNodeId: ne, wallRole: 'exterior', ...segmentDefaults },
      { id: createWallLayoutId('segment'), startNodeId: ne, endNodeId: nw, wallRole: 'exterior', ...segmentDefaults },
      { id: createWallLayoutId('segment'), startNodeId: nw, endNodeId: sw, wallRole: 'exterior', ...segmentDefaults },
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
    positionAlongSegment: hit.positionAlongSegment + opening.widthMeters / 2,
    placementUsesCenterStation: true,
    offsetMeters: hit.positionAlongSegment,
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
