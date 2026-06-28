import type { PlanPoint, ScreenPoint, SnapCandidate, SnapSegment, SnapType } from './snapTypes';

const WORLD_PRECISION = 1000;
const DEDUPE_SCREEN_EPSILON_PX = 2;

export function distanceScreen(a: ScreenPoint, b: ScreenPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function distanceWorld(a: PlanPoint, b: PlanPoint): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export function roundPlanPoint(point: PlanPoint): PlanPoint {
  return {
    x: Math.round(point.x * WORLD_PRECISION) / WORLD_PRECISION,
    z: Math.round(point.z * WORLD_PRECISION) / WORLD_PRECISION,
  };
}

export function midpoint(start: PlanPoint, end: PlanPoint): PlanPoint {
  return roundPlanPoint({ x: (start.x + end.x) / 2, z: (start.z + end.z) / 2 });
}

export function projectPointToSegment(point: PlanPoint, segment: SnapSegment): {
  point: PlanPoint;
  t: number;
  isEndpoint: boolean;
} {
  const dx = segment.end.x - segment.start.x;
  const dz = segment.end.z - segment.start.z;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared <= 1e-12) {
    return { point: roundPlanPoint(segment.start), t: 0, isEndpoint: true };
  }
  const t = Math.max(0, Math.min(1, ((point.x - segment.start.x) * dx + (point.z - segment.start.z) * dz) / lengthSquared));
  return {
    point: roundPlanPoint({ x: segment.start.x + dx * t, z: segment.start.z + dz * t }),
    t,
    isEndpoint: t <= 0.001 || t >= 0.999,
  };
}

export function segmentIntersection(a: SnapSegment, b: SnapSegment): PlanPoint | null {
  const r = { x: a.end.x - a.start.x, z: a.end.z - a.start.z };
  const s = { x: b.end.x - b.start.x, z: b.end.z - b.start.z };
  const denominator = cross(r, s);
  if (Math.abs(denominator) <= 1e-9) return null;
  const qp = { x: b.start.x - a.start.x, z: b.start.z - a.start.z };
  const t = cross(qp, s) / denominator;
  const u = cross(qp, r) / denominator;
  if (t < -1e-6 || t > 1 + 1e-6 || u < -1e-6 || u > 1 + 1e-6) return null;
  return roundPlanPoint({ x: a.start.x + t * r.x, z: a.start.z + t * r.z });
}

export function angleBetweenVectorsDegrees(
  a: PlanPoint,
  vertex: PlanPoint,
  b: PlanPoint,
): number {
  const ax = a.x - vertex.x;
  const az = a.z - vertex.z;
  const bx = b.x - vertex.x;
  const bz = b.z - vertex.z;
  const denominator = Math.hypot(ax, az) * Math.hypot(bx, bz);
  if (denominator <= 1e-9) return 0;
  const cosine = Math.max(-1, Math.min(1, (ax * bx + az * bz) / denominator));
  return (Math.acos(cosine) * 180) / Math.PI;
}

export function orthogonalPoint(base: PlanPoint, raw: PlanPoint): PlanPoint {
  const dx = raw.x - base.x;
  const dz = raw.z - base.z;
  return Math.abs(dx) >= Math.abs(dz)
    ? roundPlanPoint({ x: raw.x, z: base.z })
    : roundPlanPoint({ x: base.x, z: raw.z });
}

export function axisLockedPoint(base: PlanPoint, raw: PlanPoint, axis: 'x' | 'z'): PlanPoint {
  return axis === 'x'
    ? roundPlanPoint({ x: raw.x, z: base.z })
    : roundPlanPoint({ x: base.x, z: raw.z });
}

export function polarPoint(base: PlanPoint, raw: PlanPoint, anglesDegrees: readonly number[]): {
  point: PlanPoint;
  angleDegrees: number;
} {
  const dx = raw.x - base.x;
  const dz = raw.z - base.z;
  const length = Math.hypot(dx, dz);
  if (length <= 1e-9) return { point: roundPlanPoint(raw), angleDegrees: 0 };
  const rawDegrees = normalizeDegrees((Math.atan2(dz, dx) * 180) / Math.PI);
  const angleDegrees = anglesDegrees.reduce((best, angle) =>
    angleDistance(rawDegrees, angle) < angleDistance(rawDegrees, best) ? angle : best,
  );
  const radians = (angleDegrees * Math.PI) / 180;
  return {
    point: roundPlanPoint({ x: base.x + Math.cos(radians) * length, z: base.z + Math.sin(radians) * length }),
    angleDegrees,
  };
}

export function snappedGridPoint(raw: PlanPoint, spacingMeters: number): PlanPoint {
  const spacing = Math.max(0.001, spacingMeters);
  return roundPlanPoint({
    x: Math.round(raw.x / spacing) * spacing,
    z: Math.round(raw.z / spacing) * spacing,
  });
}

export function dedupeCandidates(candidates: readonly SnapCandidate[]): SnapCandidate[] {
  const deduped: SnapCandidate[] = [];
  [...candidates]
    .sort((a, b) => (a.priority !== b.priority ? a.priority - b.priority : a.distancePx - b.distancePx))
    .forEach((candidate) => {
      const existingIndex = deduped.findIndex((existing) =>
        distanceScreen(existing.screenPoint, candidate.screenPoint) <= DEDUPE_SCREEN_EPSILON_PX,
      );
      if (existingIndex === -1) {
        deduped.push(candidate);
        return;
      }
      const existing = deduped[existingIndex]!;
      if (candidate.priority < existing.priority || (candidate.priority === existing.priority && candidate.distancePx < existing.distancePx)) {
        deduped[existingIndex] = candidate;
      }
    });
  return deduped.sort((a, b) => (a.priority !== b.priority ? a.priority - b.priority : a.distancePx - b.distancePx));
}

export function makeCandidate(params: {
  rawScreenPoint: ScreenPoint;
  worldPoint: PlanPoint;
  planToScreenPoint: (point: PlanPoint) => ScreenPoint;
  snapType: SnapType;
  priority: number;
  sourceId?: string;
  label?: string;
  confidence?: number;
}): SnapCandidate {
  const worldPoint = roundPlanPoint(params.worldPoint);
  const screenPoint = params.planToScreenPoint(worldPoint);
  return {
    worldPoint,
    screenPoint,
    snapType: params.snapType,
    priority: params.priority,
    sourceId: params.sourceId,
    label: params.label,
    distancePx: distanceScreen(params.rawScreenPoint, screenPoint),
    confidence: params.confidence ?? 1,
  };
}

function cross(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return a.x * b.z - a.z * b.x;
}

function normalizeDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

function angleDistance(a: number, b: number): number {
  const diff = Math.abs(normalizeDegrees(a) - normalizeDegrees(b));
  return Math.min(diff, 360 - diff);
}
