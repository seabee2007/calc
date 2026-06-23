import type { SegmentFrame } from '../geometry/designGeometry';
import type { ResolvedOpeningPlacement } from './openingPlacementResolver';
import type { DesignWallLayoutParameters, WallOpeningParameters } from '../types';

export type PlanPoint = { x: number; z: number };

export type PlanOpeningColorState = 'valid' | 'warning' | 'invalid';

export type PlanWallRun = {
  startAlongMeters: number;
  endAlongMeters: number;
};

export type PlanOpeningGeometry = {
  hostSegmentId: string;
  center: { x: number; z: number };
  roughStart: { x: number; z: number };
  roughEnd: { x: number; z: number };
  actualStart: { x: number; z: number };
  actualEnd: { x: number; z: number };
  tangent: { x: number; z: number };
  inwardNormal: { x: number; z: number };
  outwardNormal: { x: number; z: number };
  actualWidthMeters: number;
  roughWidthMeters: number;
};

export type PlanOpeningPick = {
  openingId: string;
  distanceMeters: number;
};

const DEFAULT_PICK_TOLERANCE_METERS = 0.35;

export function openingColorState(params: {
  isValid: boolean;
  statusKind?: 'clean' | 'half_block' | 'cut_block' | 'invalid';
}): PlanOpeningColorState {
  if (!params.isValid || params.statusKind === 'invalid') return 'invalid';
  if (params.statusKind === 'half_block' || params.statusKind === 'cut_block') return 'warning';
  return 'valid';
}

export function openingStrokeColor(state: PlanOpeningColorState): string {
  if (state === 'invalid') return '#fb7185';
  if (state === 'warning') return '#fbbf24';
  return '#22d3ee';
}

export function openingFillColor(state: PlanOpeningColorState, alpha = 0.18): string {
  if (state === 'invalid') return `rgba(251, 113, 133, ${alpha})`;
  if (state === 'warning') return `rgba(251, 191, 36, ${alpha})`;
  return `rgba(34, 211, 238, ${alpha})`;
}

export function planPointOnWall(frame: SegmentFrame, alongMeters: number): PlanPoint {
  return {
    x: frame.centerlineStart.x + frame.tangent.x * alongMeters,
    z: frame.centerlineStart.z + frame.tangent.z * alongMeters,
  };
}

export function buildPlanDisplayNodeById(params: {
  layout: DesignWallLayoutParameters;
  framesBySegmentId: Map<string, SegmentFrame>;
}): Map<string, PlanPoint> {
  const points = new Map<string, PlanPoint>();
  const nodesById = new Map(params.layout.nodes.map((node) => [node.id, node]));

  params.layout.segments.forEach((segment) => {
    const frame = params.framesBySegmentId.get(segment.id);
    const startNode = nodesById.get(segment.startNodeId);
    const endNode = nodesById.get(segment.endNodeId);

    if (startNode) {
      points.set(
        segment.startNodeId,
        frame?.centerlineStart ?? { x: startNode.x, z: startNode.z },
      );
    }
    if (endNode) {
      points.set(
        segment.endNodeId,
        frame?.centerlineEnd ?? { x: endNode.x, z: endNode.z },
      );
    }
  });

  return points;
}

export function resolveSegmentDisplayEndpoints(params: {
  segment: { startNodeId: string; endNodeId: string };
  layout: DesignWallLayoutParameters;
  planDisplayNodeById: Map<string, PlanPoint>;
}): { displayStart: PlanPoint; displayEnd: PlanPoint } | null {
  const startNode = params.layout.nodes.find((node) => node.id === params.segment.startNodeId);
  const endNode = params.layout.nodes.find((node) => node.id === params.segment.endNodeId);
  if (!startNode || !endNode) return null;

  const rawStart: PlanPoint = { x: startNode.x, z: startNode.z };
  const rawEnd: PlanPoint = { x: endNode.x, z: endNode.z };

  return {
    displayStart: params.planDisplayNodeById.get(params.segment.startNodeId) ?? rawStart,
    displayEnd: params.planDisplayNodeById.get(params.segment.endNodeId) ?? rawEnd,
  };
}

export function resolvePlanWallRunEndpoints(params: {
  frame: SegmentFrame;
  run: PlanWallRun;
  displayStart: PlanPoint;
  displayEnd: PlanPoint;
}): { start: PlanPoint; end: PlanPoint } {
  const atStart = params.run.startAlongMeters <= 0.001;
  const atEnd = params.run.endAlongMeters >= params.frame.lengthMeters - 0.001;
  return {
    start: atStart ? params.displayStart : planPointOnWall(params.frame, params.run.startAlongMeters),
    end: atEnd ? params.displayEnd : planPointOnWall(params.frame, params.run.endAlongMeters),
  };
}

export function buildPlanOpeningGeometry(
  resolved: ResolvedOpeningPlacement,
  frame: SegmentFrame,
): PlanOpeningGeometry {
  return {
    hostSegmentId: resolved.hostSegmentId,
    center: planPointOnWall(frame, resolved.positionAlongSegmentMeters),
    roughStart: planPointOnWall(frame, resolved.roughOpeningStartMeters),
    roughEnd: planPointOnWall(frame, resolved.roughOpeningEndMeters),
    actualStart: planPointOnWall(frame, resolved.actualOpeningStartMeters),
    actualEnd: planPointOnWall(frame, resolved.actualOpeningEndMeters),
    tangent: { ...frame.tangent },
    inwardNormal: { ...frame.inwardNormal },
    outwardNormal: { ...frame.outwardNormal },
    actualWidthMeters: resolved.actualOpeningEndMeters - resolved.actualOpeningStartMeters,
    roughWidthMeters: resolved.roughOpeningEndMeters - resolved.roughOpeningStartMeters,
  };
}

export function buildWallRunsExcludingRoughOpenings(params: {
  segmentLengthMeters: number;
  roughOpenings: readonly { roughOpeningStartMeters: number; roughOpeningEndMeters: number }[];
}): PlanWallRun[] {
  const gaps = [...params.roughOpenings]
    .map((opening) => ({
      start: Math.max(0, opening.roughOpeningStartMeters),
      end: Math.min(params.segmentLengthMeters, opening.roughOpeningEndMeters),
    }))
    .filter((gap) => gap.end > gap.start + 0.001)
    .sort((a, b) => a.start - b.start);
  const runs: PlanWallRun[] = [];
  let cursor = 0;
  gaps.forEach((gap) => {
    if (gap.start > cursor + 0.001) {
      runs.push({ startAlongMeters: cursor, endAlongMeters: gap.start });
    }
    cursor = Math.max(cursor, gap.end);
  });
  if (cursor < params.segmentLengthMeters - 0.001) {
    runs.push({ startAlongMeters: cursor, endAlongMeters: params.segmentLengthMeters });
  }
  return runs;
}

export function distancePointToSegment(
  point: { x: number; z: number },
  start: { x: number; z: number },
  end: { x: number; z: number },
): number {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSq = dx * dx + dz * dz;
  if (lengthSq <= 0) return Math.hypot(point.x - start.x, point.z - start.z);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSq));
  const projX = start.x + dx * t;
  const projZ = start.z + dz * t;
  return Math.hypot(point.x - projX, point.z - projZ);
}

export function hitTestPlanOpeningGeometry(params: {
  planX: number;
  planZ: number;
  geometry: PlanOpeningGeometry;
  toleranceMeters?: number;
}): boolean {
  const tolerance = params.toleranceMeters ?? DEFAULT_PICK_TOLERANCE_METERS;
  const point = { x: params.planX, z: params.planZ };
  const roughDistance = distancePointToSegment(point, params.geometry.roughStart, params.geometry.roughEnd);
  if (roughDistance <= tolerance) return true;
  const actualDistance = distancePointToSegment(point, params.geometry.actualStart, params.geometry.actualEnd);
  return actualDistance <= tolerance * 0.85;
}

export function pickOpeningAtPlanPoint(params: {
  planX: number;
  planZ: number;
  openings: readonly WallOpeningParameters[];
  resolvedByOpeningId: ReadonlyMap<string, ResolvedOpeningPlacement>;
  framesBySegmentId: ReadonlyMap<string, SegmentFrame>;
  toleranceMeters?: number;
}): PlanOpeningPick | null {
  let best: PlanOpeningPick | null = null;
  params.openings.forEach((opening) => {
    const resolved = params.resolvedByOpeningId.get(opening.id);
    const frame = resolved ? params.framesBySegmentId.get(resolved.hostSegmentId) : null;
    if (!resolved || !frame) return;
    const geometry = buildPlanOpeningGeometry(resolved, frame);
    const hit = hitTestPlanOpeningGeometry({
      planX: params.planX,
      planZ: params.planZ,
      geometry,
      toleranceMeters: params.toleranceMeters,
    });
    if (!hit) return;
    const distance = Math.hypot(params.planX - geometry.center.x, params.planZ - geometry.center.z);
    if (!best || distance < best.distanceMeters) {
      best = { openingId: opening.id, distanceMeters: distance };
    }
  });
  return best;
}

export function shouldShowOpeningLabel(params: {
  zoom: number;
  selected: boolean;
  hovered: boolean;
  placing: boolean;
}): boolean {
  return params.selected || params.hovered || params.placing || params.zoom >= 28;
}

export function openingMarkerScale(zoom: number): number {
  return Math.max(0.65, Math.min(1.15, zoom / 36));
}

export function formatOpeningWidthLabel(widthMeters: number): string {
  return `${widthMeters.toFixed(2)} m`;
}

export function formatRoughOpeningLabel(widthMeters: number): string {
  return `RO ${widthMeters.toFixed(2)} m`;
}
