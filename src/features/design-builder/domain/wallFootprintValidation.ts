import type { DesignWallLayoutParameters, DesignWallNode, DesignWallSegment, DesignWarning } from '../types';
import { detectClosedFootprint } from './wallLayoutRules';

export const ORTHOGONAL_COMMIT_TOLERANCE_METERS = 1e-6;
export const STRICT_ORTHOGONAL_ANGLE_TOLERANCE_DEG = 0.01;
export const STRICT_FOOTPRINT_LENGTH_TOLERANCE_M = 0.005;

export type FootprintOrthogonalityIssue =
  | 'closed_footprint_non_orthogonal'
  | 'opposite_wall_lengths_mismatch'
  | 'opposite_wall_not_parallel'
  | 'closure_corner_not_exact';

type OrderedFourCornerFootprint = {
  nodes: [DesignWallNode, DesignWallNode, DesignWallNode, DesignWallNode];
  segments: [DesignWallSegment, DesignWallSegment, DesignWallSegment, DesignWallSegment];
};

function distance(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function vector(from: { x: number; z: number }, to: { x: number; z: number }): { x: number; z: number } {
  return { x: to.x - from.x, z: to.z - from.z };
}

function vectorLength(v: { x: number; z: number }): number {
  return Math.hypot(v.x, v.z);
}

function angleBetweenDegrees(left: { x: number; z: number }, right: { x: number; z: number }): number {
  const leftLength = vectorLength(left);
  const rightLength = vectorLength(right);
  if (leftLength <= ORTHOGONAL_COMMIT_TOLERANCE_METERS || rightLength <= ORTHOGONAL_COMMIT_TOLERANCE_METERS) {
    return 0;
  }
  const dot = (left.x * right.x + left.z * right.z) / (leftLength * rightLength);
  return (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI;
}

function perpendicularErrorDegrees(left: { x: number; z: number }, right: { x: number; z: number }): number {
  return Math.abs(angleBetweenDegrees(left, right) - 90);
}

function parallelErrorDegrees(left: { x: number; z: number }, right: { x: number; z: number }): number {
  const angle = angleBetweenDegrees(left, right);
  return Math.min(Math.abs(angle), Math.abs(180 - angle));
}

function warning(code: FootprintOrthogonalityIssue, message: string): DesignWarning {
  return { code, message, severity: 'review' };
}

function candidateFootprintSegments(layout: DesignWallLayoutParameters): DesignWallSegment[] {
  const exterior = layout.segments.filter((segment) => segment.wallRole !== 'partition');
  if (exterior.length === 4) return exterior;
  if (layout.segments.length === 4) return [...layout.segments];
  return [];
}

export function resolveOrderedFourCornerFootprint(
  layout: DesignWallLayoutParameters,
): OrderedFourCornerFootprint | null {
  const segments = candidateFootprintSegments(layout);
  if (segments.length !== 4) return null;

  const nodeById = new Map(layout.nodes.map((node) => [node.id, node]));
  const firstSegment = segments[0];
  if (!firstSegment) return null;
  const firstNode = nodeById.get(firstSegment.startNodeId);
  const secondNode = nodeById.get(firstSegment.endNodeId);
  if (!firstNode || !secondNode) return null;

  const orderedSegments: DesignWallSegment[] = [firstSegment];
  const orderedNodes: DesignWallNode[] = [firstNode, secondNode];
  const remaining = segments.slice(1);
  let currentNodeId = firstSegment.endNodeId;

  while (remaining.length > 0) {
    const nextIndex = remaining.findIndex(
      (segment) => segment.startNodeId === currentNodeId || segment.endNodeId === currentNodeId,
    );
    if (nextIndex < 0) return null;

    const [nextSegment] = remaining.splice(nextIndex, 1);
    if (!nextSegment) return null;
    orderedSegments.push(nextSegment);

    const nextNodeId =
      nextSegment.startNodeId === currentNodeId ? nextSegment.endNodeId : nextSegment.startNodeId;
    if (remaining.length === 0) {
      if (nextNodeId !== firstSegment.startNodeId) return null;
      break;
    }
    if (nextNodeId === firstSegment.startNodeId) return null;
    const nextNode = nodeById.get(nextNodeId);
    if (!nextNode) return null;
    orderedNodes.push(nextNode);
    currentNodeId = nextNodeId;
  }

  if (orderedNodes.length !== 4 || orderedSegments.length !== 4) return null;
  return {
    nodes: orderedNodes as [DesignWallNode, DesignWallNode, DesignWallNode, DesignWallNode],
    segments: orderedSegments as [DesignWallSegment, DesignWallSegment, DesignWallSegment, DesignWallSegment],
  };
}

export function validateStrictOrthogonalFootprint(layout: DesignWallLayoutParameters): DesignWarning[] {
  if (!layout.isFootprintClosed && !detectClosedFootprint(layout)) return [];
  const footprint = resolveOrderedFourCornerFootprint(layout);
  if (!footprint) return [];

  const [n0, n1, n2, n3] = footprint.nodes;
  const edges = [
    vector(n0, n1),
    vector(n1, n2),
    vector(n2, n3),
    vector(n3, n0),
  ];
  const lengths = edges.map(vectorLength);
  const warnings: DesignWarning[] = [];

  const hasNonOrthogonalCorner = edges.some((edge, index) => {
    const next = edges[(index + 1) % edges.length]!;
    return perpendicularErrorDegrees(edge, next) > STRICT_ORTHOGONAL_ANGLE_TOLERANCE_DEG;
  });
  if (hasNonOrthogonalCorner) {
    warnings.push(
      warning(
        'closed_footprint_non_orthogonal',
        'Closed footprint is not an exact orthogonal rectangle; roof generation requires square corners.',
      ),
    );
  }

  const hasNonParallelOpposite =
    parallelErrorDegrees(edges[0]!, edges[2]!) > STRICT_ORTHOGONAL_ANGLE_TOLERANCE_DEG ||
    parallelErrorDegrees(edges[1]!, edges[3]!) > STRICT_ORTHOGONAL_ANGLE_TOLERANCE_DEG;
  if (hasNonParallelOpposite) {
    warnings.push(
      warning(
        'opposite_wall_not_parallel',
        'Opposite footprint walls are not exactly parallel; repair the rectangle before generating the roof.',
      ),
    );
  }

  const hasLengthMismatch =
    Math.abs(lengths[0]! - lengths[2]!) > STRICT_FOOTPRINT_LENGTH_TOLERANCE_M ||
    Math.abs(lengths[1]! - lengths[3]!) > STRICT_FOOTPRINT_LENGTH_TOLERANCE_M;
  if (hasLengthMismatch) {
    warnings.push(
      warning(
        'opposite_wall_lengths_mismatch',
        'Opposite footprint wall lengths do not match within strict rectangular tolerance.',
      ),
    );
  }

  const expectedFourth = {
    x: n2.x + (n0.x - n1.x),
    z: n2.z + (n0.z - n1.z),
  };
  if (distance(n3, expectedFourth) > STRICT_FOOTPRINT_LENGTH_TOLERANCE_M) {
    warnings.push(
      warning(
        'closure_corner_not_exact',
        'The closing footprint corner is not the exact orthogonal rectangle corner.',
      ),
    );
  }

  return warnings;
}

export function repairFootprintToExactOrthogonalRectangle(
  layout: DesignWallLayoutParameters,
): DesignWallLayoutParameters | null {
  const footprint = resolveOrderedFourCornerFootprint(layout);
  if (!footprint) return null;

  const [n0, n1, n2, n3] = footprint.nodes;
  const width = vector(n0, n1);
  const widthLength = vectorLength(width);
  if (widthLength <= ORTHOGONAL_COMMIT_TOLERANCE_METERS) return null;

  const unitWidth = { x: width.x / widthLength, z: width.z / widthLength };
  const unitHeight = { x: -unitWidth.z, z: unitWidth.x };
  const rawHeight = vector(n1, n2);
  const projectedHeightMeters = rawHeight.x * unitHeight.x + rawHeight.z * unitHeight.z;
  if (Math.abs(projectedHeightMeters) <= ORTHOGONAL_COMMIT_TOLERANCE_METERS) return null;

  const heightVector = {
    x: unitHeight.x * projectedHeightMeters,
    z: unitHeight.z * projectedHeightMeters,
  };
  const repairedSecondCorner = {
    x: n1.x + heightVector.x,
    z: n1.z + heightVector.z,
  };
  const repairedFourthCorner = {
    x: n0.x + heightVector.x,
    z: n0.z + heightVector.z,
  };

  const nextNodes = layout.nodes.map((node) => {
    if (node.id === n2.id) return { ...node, ...repairedSecondCorner };
    if (node.id === n3.id) return { ...node, ...repairedFourthCorner };
    return node;
  });
  const next = {
    ...layout,
    nodes: nextNodes,
  };
  return {
    ...next,
    isFootprintClosed: detectClosedFootprint(next),
  };
}
