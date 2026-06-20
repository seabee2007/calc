import type { DesignBuilderSnapMode, DesignWallLayoutParameters } from '../types';
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
  drawContext?: {
    activeNodeId?: string | null;
    drawStartNodeId?: string | null;
    orthogonalLock?: boolean;
    shiftHeld?: boolean;
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
  const releaseMeters = SNAP_RELEASE_RADIUS_PX / pixelsPerMeter;
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
    const distanceMeters = distance(params.point, node);
    if (distanceMeters > captureMeters) return;
    candidates.push({
      type: 'node',
      point: { x: node.x, z: node.z },
      distancePx: distanceMeters * pixelsPerMeter,
      priority: 1,
      sourceId: node.id,
      label: 'Corner',
      valid: true,
      captured: true,
    });
  });

  const endpointSnap = findNearestEndpointSnap(params.layout, params.point, captureMeters, pixelsPerMeter);
  if (endpointSnap) candidates.push(endpointSnap);

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

  const lineSnap = findNearestLineSnap(params.layout, params.point, captureMeters, pixelsPerMeter);
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
    return candidates[0];
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

function findNearestEndpointSnap(
  layout: DesignWallLayoutParameters,
  point: { x: number; z: number },
  toleranceMeters: number,
  pixelsPerMeter: number,
): DesignSnapTarget | null {
  let best: DesignSnapTarget | null = null;
  layout.segments.forEach((segment) => {
    const start = layout.nodes.find((node) => node.id === segment.startNodeId);
    const end = layout.nodes.find((node) => node.id === segment.endNodeId);
    [start, end].forEach((node) => {
      if (!node) return;
      const distanceMeters = distance(point, node);
      if (distanceMeters > toleranceMeters) return;
      if (best && distanceMeters * pixelsPerMeter >= best.distancePx) return;
      best = {
        type: 'endpoint',
        point: { x: node.x, z: node.z },
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
): DesignSnapTarget | null {
  let best: DesignSnapTarget | null = null;
  layout.segments.forEach((segment) => {
    const start = layout.nodes.find((node) => node.id === segment.startNodeId);
    const end = layout.nodes.find((node) => node.id === segment.endNodeId);
    if (!start || !end) return;
    const projected = projectPointToSegment(point, start, end);
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
