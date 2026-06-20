import type { DesignBuilderSnapMode, DesignWallLayoutParameters } from '../types';
import { ENDPOINT_SNAP_TOLERANCE_METERS } from './wallLayoutRules';

export type DesignSnapTarget = {
  type: 'node' | 'endpoint' | 'line' | 'cmu_module' | 'grid' | 'raw';
  point: { x: number; z: number };
  distancePx: number;
  priority: number;
  sourceId?: string;
  label?: string;
  valid: boolean;
};

export function resolveDesignSnapPoint(params: {
  layout: DesignWallLayoutParameters;
  point: { x: number; z: number };
  snapMode: DesignBuilderSnapMode;
  moduleLengthMeters?: number;
  pixelsPerMeter?: number;
}): DesignSnapTarget {
  const pixelsPerMeter = params.pixelsPerMeter ?? 48;
  const nodeSnap = findNearestNodeSnap(params.layout, params.point, ENDPOINT_SNAP_TOLERANCE_METERS, pixelsPerMeter);
  if (nodeSnap) return nodeSnap;

  const lineSnap = findNearestLineSnap(params.layout, params.point, ENDPOINT_SNAP_TOLERANCE_METERS, pixelsPerMeter);
  if (lineSnap) return lineSnap;

  if (params.snapMode === 'cmu_module' && params.moduleLengthMeters && params.moduleLengthMeters > 0) {
    const snapped = {
      x: Math.round(params.point.x / params.moduleLengthMeters) * params.moduleLengthMeters,
      z: Math.round(params.point.z / params.moduleLengthMeters) * params.moduleLengthMeters,
    };
    return {
      type: 'cmu_module',
      point: snapped,
      distancePx: distance(params.point, snapped) * pixelsPerMeter,
      priority: 5,
      label: 'CMU module',
      valid: true,
    };
  }

  if (params.snapMode === 'grid' && params.layout.gridSpacingMeters > 0) {
    const snapped = {
      x: Math.round(params.point.x / params.layout.gridSpacingMeters) * params.layout.gridSpacingMeters,
      z: Math.round(params.point.z / params.layout.gridSpacingMeters) * params.layout.gridSpacingMeters,
    };
    return {
      type: 'grid',
      point: snapped,
      distancePx: distance(params.point, snapped) * pixelsPerMeter,
      priority: 6,
      label: 'Grid',
      valid: true,
    };
  }

  return {
    type: 'raw',
    point: params.point,
    distancePx: 0,
    priority: 7,
    label: 'Raw cursor',
    valid: true,
  };
}

function findNearestNodeSnap(
  layout: DesignWallLayoutParameters,
  point: { x: number; z: number },
  toleranceMeters: number,
  pixelsPerMeter: number,
): DesignSnapTarget | null {
  let best: DesignSnapTarget | null = null;
  layout.nodes.forEach((node) => {
    const distanceMeters = distance(point, node);
    if (distanceMeters > toleranceMeters) return;
    if (best && distanceMeters * pixelsPerMeter >= best.distancePx) return;
    best = {
      type: 'node',
      point: { x: node.x, z: node.z },
      distancePx: distanceMeters * pixelsPerMeter,
      priority: 1,
      sourceId: node.id,
      label: 'Corner',
      valid: true,
    };
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
    const distanceMeters = distance(point, projected.point);
    if (distanceMeters > toleranceMeters) return;
    if (best && distanceMeters * pixelsPerMeter >= best.distancePx) return;
    best = {
      type: projected.isEndpoint ? 'endpoint' : 'line',
      point: projected.point,
      distancePx: distanceMeters * pixelsPerMeter,
      priority: projected.isEndpoint ? 2 : 3,
      sourceId: projected.isEndpoint ? projected.endpointNodeId : segment.id,
      label: projected.isEndpoint ? 'Endpoint' : 'Wall line',
      valid: true,
    };
  });
  return best;
}

function projectPointToSegment(
  point: { x: number; z: number },
  start: { id: string; x: number; z: number },
  end: { id: string; x: number; z: number },
) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSq = dx * dx + dz * dz;
  const t = lengthSq <= 0 ? 0 : Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSq));
  const projected = { x: start.x + dx * t, z: start.z + dz * t };
  if (t <= 0.02) return { point: { x: start.x, z: start.z }, isEndpoint: true, endpointNodeId: start.id };
  if (t >= 0.98) return { point: { x: end.x, z: end.z }, isEndpoint: true, endpointNodeId: end.id };
  return { point: projected, isEndpoint: false, endpointNodeId: undefined };
}

function distance(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
