import type { SegmentFrame } from '../geometry/designGeometry';
import type { DesignBuilderSnapMode, DesignWallLayoutParameters } from '../types';
import { buildPlanDisplayNodeById, type PlanPoint } from './planOpeningGraphics';
import {
  GUIDE_CAPTURE_RADIUS_PX,
  NODE_CAPTURE_RADIUS_PX,
  resolveShiftConstrainedPoint,
} from './wallLayoutRules';

export const SNAP_CAPTURE_RADIUS_PX = NODE_CAPTURE_RADIUS_PX;
export const SNAP_RELEASE_RADIUS_PX = 26;

export type DesignSnapTarget = {
  type: 'node' | 'endpoint' | 'line' | 'cmu_module' | 'grid' | 'raw' | 'guide';
  point: { x: number; z: number };
  distancePx: number;
  priority: number;
  sourceId?: string;
  label?: string;
  valid: boolean;
  captured: boolean;
};

export function resolveDesignSnapPoint(params: {
  layout: DesignWallLayoutParameters;
  point: { x: number; z: number };
  snapMode: DesignBuilderSnapMode;
  moduleLengthMeters?: number;
  pixelsPerMeter?: number;
  altHeld?: boolean;
  segmentFrames?: readonly SegmentFrame[];
  drawContext?: {
    activeNodeId?: string | null;
    drawStartNodeId?: string | null;
    orthogonalLock?: boolean;
    shiftHeld?: boolean;
    closureCornerCandidate?: { x: number; z: number } | null;
  };
  previousSnap?: DesignSnapTarget | null;
}): DesignSnapTarget {
  if (params.altHeld) {
    return {
      type: 'raw',
      point: params.point,
      distancePx: 0,
      priority: 9,
      valid: true,
      captured: false,
    };
  }

  const pixelsPerMeter = Math.max(1, params.pixelsPerMeter ?? 48);
  const captureMeters = NODE_CAPTURE_RADIUS_PX / pixelsPerMeter;
  const guideCaptureMeters = GUIDE_CAPTURE_RADIUS_PX / pixelsPerMeter;
  const snapNodeById = buildSnapNodeById(params.layout, params.segmentFrames);
  const candidates: DesignSnapTarget[] = [];

  if (
    params.previousSnap &&
    params.previousSnap.type !== 'raw' &&
    distance(params.point, params.previousSnap.point) * pixelsPerMeter <= SNAP_RELEASE_RADIUS_PX
  ) {
    candidates.push({
      ...params.previousSnap,
      distancePx: distance(params.point, params.previousSnap.point) * pixelsPerMeter,
      captured: true,
    });
  }

  params.layout.nodes.forEach((node) => {
    const snapPoint = snapPointForNode(node, snapNodeById);
    const distanceMeters = distance(params.point, snapPoint);
    if (distanceMeters > captureMeters) return;
    candidates.push({
      type: 'node',
      point: snapPoint,
      distancePx: distanceMeters * pixelsPerMeter,
      priority: 1,
      sourceId: node.id,
      label: 'Corner',
      valid: true,
      captured: true,
    });
  });

  const endpointSnap = findNearestEndpointSnap(params.layout, params.point, captureMeters, pixelsPerMeter, snapNodeById);
  if (endpointSnap) candidates.push(endpointSnap);

  if (params.drawContext?.shiftHeld && params.drawContext.closureCornerCandidate) {
    const corner = params.drawContext.closureCornerCandidate;
    const distanceMeters = distance(params.point, corner);
    candidates.push({
      type: 'guide',
      point: corner,
      distancePx: distanceMeters * pixelsPerMeter,
      priority: 1,
      label: 'Rectangle corner',
      valid: true,
      captured: distanceMeters * pixelsPerMeter <= guideCaptureMeters,
    });
  }

  if (params.drawContext?.shiftHeld && params.drawContext.activeNodeId && params.drawContext.orthogonalLock) {
    const constrained = resolveShiftConstrainedPoint({
      layout: params.layout,
      activeNodeId: params.drawContext.activeNodeId,
      rawPoint: params.point,
    });
    const guidanceDistance = distance(params.point, constrained.point);
    candidates.push({
      type: 'guide',
      point: constrained.point,
      distancePx: guidanceDistance * pixelsPerMeter,
      priority: 2,
      label: constrained.label,
      valid: true,
      captured: guidanceDistance * pixelsPerMeter <= guideCaptureMeters,
    });
  }

  const lineSnap = findNearestLineSnap(params.layout, params.point, captureMeters, pixelsPerMeter, snapNodeById);
  if (lineSnap) candidates.push(lineSnap);

  if (params.snapMode === 'cmu_module' && params.moduleLengthMeters && params.moduleLengthMeters > 0) {
    const snapped = {
      x: Math.round(params.point.x / params.moduleLengthMeters) * params.moduleLengthMeters,
      z: Math.round(params.point.z / params.moduleLengthMeters) * params.moduleLengthMeters,
    };
    const distanceMeters = distance(params.point, snapped);
    if (distanceMeters <= captureMeters) {
      candidates.push({
        type: 'cmu_module',
        point: snapped,
        distancePx: distanceMeters * pixelsPerMeter,
        priority: 7,
        label: 'Module',
        valid: true,
        captured: true,
      });
    }
  }

  if (params.snapMode === 'grid' && params.layout.gridSpacingMeters > 0) {
    const snapped = {
      x: Math.round(params.point.x / params.layout.gridSpacingMeters) * params.layout.gridSpacingMeters,
      z: Math.round(params.point.z / params.layout.gridSpacingMeters) * params.layout.gridSpacingMeters,
    };
    const distanceMeters = distance(params.point, snapped);
    if (distanceMeters <= captureMeters) {
      candidates.push({
        type: 'grid',
        point: snapped,
        distancePx: distanceMeters * pixelsPerMeter,
        priority: 8,
        label: 'Grid',
        valid: true,
        captured: true,
      });
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => (a.priority !== b.priority ? a.priority - b.priority : a.distancePx - b.distancePx));
    const winner = candidates[0]!;
    return winner;
  }

  return {
    type: 'raw',
    point: params.point,
    distancePx: 0,
    priority: 9,
    label: undefined,
    valid: true,
    captured: false,
  };
}

function buildSnapNodeById(
  layout: DesignWallLayoutParameters,
  segmentFrames?: readonly SegmentFrame[],
): Map<string, PlanPoint> | null {
  if (!segmentFrames || segmentFrames.length === 0) return null;
  return buildPlanDisplayNodeById({
    layout,
    framesBySegmentId: new Map(segmentFrames.map((frame) => [frame.segmentId, frame])),
  });
}

function snapPointForNode(
  node: { id: string; x: number; z: number },
  snapNodeById: Map<string, PlanPoint> | null,
): PlanPoint {
  return snapNodeById?.get(node.id) ?? { x: node.x, z: node.z };
}

function findNearestEndpointSnap(
  layout: DesignWallLayoutParameters,
  point: { x: number; z: number },
  toleranceMeters: number,
  pixelsPerMeter: number,
  snapNodeById: Map<string, PlanPoint> | null,
): DesignSnapTarget | null {
  let best: DesignSnapTarget | null = null;
  layout.segments.forEach((segment) => {
    const start = layout.nodes.find((node) => node.id === segment.startNodeId);
    const end = layout.nodes.find((node) => node.id === segment.endNodeId);
    [start, end].forEach((node) => {
      if (!node) return;
      const snapPoint = snapPointForNode(node, snapNodeById);
      const distanceMeters = distance(point, snapPoint);
      if (distanceMeters > toleranceMeters) return;
      if (best && distanceMeters * pixelsPerMeter >= best.distancePx) return;
      best = {
        type: 'endpoint',
        point: snapPoint,
        distancePx: distanceMeters * pixelsPerMeter,
        priority: 3,
        sourceId: node.id,
        label: 'Endpoint',
        valid: true,
        captured: true,
      };
    });
  });
  return best;
}

function findNearestLineSnap(
  layout: DesignWallLayoutParameters,
  point: { x: number; z: number },
  toleranceMeters: number,
  pixelsPerMeter: number,
  snapNodeById: Map<string, PlanPoint> | null,
): DesignSnapTarget | null {
  let best: DesignSnapTarget | null = null;
  layout.segments.forEach((segment) => {
    const start = layout.nodes.find((node) => node.id === segment.startNodeId);
    const end = layout.nodes.find((node) => node.id === segment.endNodeId);
    if (!start || !end) return;
    const displayStart = snapPointForNode(start, snapNodeById);
    const displayEnd = snapPointForNode(end, snapNodeById);
    const projected = projectPointToSegment(point, displayStart, displayEnd);
    if (projected.isEndpoint) return;
    const distanceMeters = distance(point, projected.point);
    if (distanceMeters > toleranceMeters) return;
    if (best && distanceMeters * pixelsPerMeter >= best.distancePx) return;
    best = {
      type: 'line',
      point: projected.point,
      distancePx: distanceMeters * pixelsPerMeter,
      priority: 6,
      sourceId: segment.id,
      label: 'Wall line',
      valid: true,
      captured: true,
    };
  });
  return best;
}

function projectPointToSegment(
  point: { x: number; z: number },
  start: { x: number; z: number },
  end: { x: number; z: number },
): { point: { x: number; z: number }; isEndpoint: boolean; endpointNodeId?: string } {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared <= 0) {
    return { point: { x: start.x, z: start.z }, isEndpoint: true, endpointNodeId: undefined };
  }
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared));
  const projected = { x: start.x + dx * t, z: start.z + dz * t };
  const atStart = t <= 0.001;
  const atEnd = t >= 0.999;
  return {
    point: projected,
    isEndpoint: atStart || atEnd,
    endpointNodeId: atStart ? undefined : atEnd ? undefined : undefined,
  };
}

function distance(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
