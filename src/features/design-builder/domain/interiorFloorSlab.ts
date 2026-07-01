import type { InteriorFloorSlabSettings, RcFrameFoundationSettings } from '../types';
import { TOP_OF_PLINTH_BEAM_Y } from './foundationElevations';
import { normalizeRcFrameFoundationSettings } from './rcFrameFoundationMigration';

export const DEFAULT_INTERIOR_FLOOR_SLAB_THICKNESS_METERS = 0.125;
const SLAB_FOOTPRINT_EPSILON_METERS = 1e-6;

type SlabFootprintPoint = { x: number; z: number };
type SlabContactBeam = {
  kind: string;
  startPoint: SlabFootprintPoint;
  endPoint: SlabFootprintPoint;
  widthMeters: number;
  hostSegmentId?: string;
};
type SlabContactSegmentFrame = {
  segmentId: string;
  tangent: SlabFootprintPoint;
  inwardNormal: SlabFootprintPoint;
};
type SlabContactLine = {
  point: SlabFootprintPoint;
  tangent: SlabFootprintPoint;
};

export type ResolvedInteriorFloorSlab = {
  enabled: boolean;
  thicknessMeters: number;
  footprintPolygon: SlabFootprintPoint[];
  bottomElevationMeters: number;
  topElevationMeters: number;
  areaSquareMeters: number;
  volumeCubicMeters: number;
};

export function defaultInteriorFloorSlabSettings(): InteriorFloorSlabSettings {
  return {
    enabled: true,
    thicknessMeters: DEFAULT_INTERIOR_FLOOR_SLAB_THICKNESS_METERS,
  };
}

export function resolveInteriorFloorSlabSettings(
  foundation: RcFrameFoundationSettings | import('../types').StructuralFoundationSettings | undefined,
): InteriorFloorSlabSettings {
  const normalized = normalizeRcFrameFoundationSettings(foundation);
  return {
    ...defaultInteriorFloorSlabSettings(),
    ...normalized.interiorFloorSlab,
  };
}

export function polygonAreaSquareMeters(polygon: readonly { x: number; z: number }[]): number {
  if (polygon.length < 3) return 0;
  let sum = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]!;
    const next = polygon[(index + 1) % polygon.length]!;
    sum += current.x * next.z - next.x * current.z;
  }
  return Math.abs(sum) / 2;
}

function cloneFootprint(polygon: readonly SlabFootprintPoint[]): SlabFootprintPoint[] {
  return polygon.map((point) => ({ x: point.x, z: point.z }));
}

function vectorLength(vector: SlabFootprintPoint): number {
  return Math.hypot(vector.x, vector.z);
}

function normalizeVector(vector: SlabFootprintPoint): SlabFootprintPoint | null {
  const length = vectorLength(vector);
  if (length <= SLAB_FOOTPRINT_EPSILON_METERS) return null;
  return { x: vector.x / length, z: vector.z / length };
}

function cross(a: SlabFootprintPoint, b: SlabFootprintPoint): number {
  return a.x * b.z - a.z * b.x;
}

function dot(a: SlabFootprintPoint, b: SlabFootprintPoint): number {
  return a.x * b.x + a.z * b.z;
}

function beamSpanLengthMeters(beam: SlabContactBeam): number {
  return Math.hypot(
    beam.endPoint.x - beam.startPoint.x,
    beam.endPoint.z - beam.startPoint.z,
  );
}

function selectRepresentativeBeam(beams: readonly SlabContactBeam[]): SlabContactBeam | null {
  return beams.reduce<SlabContactBeam | null>((best, beam) => {
    if (beam.widthMeters <= 0 || beamSpanLengthMeters(beam) <= SLAB_FOOTPRINT_EPSILON_METERS) {
      return best;
    }
    if (!best || beamSpanLengthMeters(beam) > beamSpanLengthMeters(best)) {
      return beam;
    }
    return best;
  }, null);
}

function contactLineForBeam(
  beam: SlabContactBeam,
  frame: SlabContactSegmentFrame,
): SlabContactLine | null {
  const beamTangent = normalizeVector({
    x: beam.endPoint.x - beam.startPoint.x,
    z: beam.endPoint.z - beam.startPoint.z,
  });
  const frameInwardNormal = normalizeVector(frame.inwardNormal);
  if (!beamTangent || !frameInwardNormal) return null;

  const leftNormal = { x: -beamTangent.z, z: beamTangent.x };
  const inwardNormal =
    dot(leftNormal, frameInwardNormal) >= 0
      ? leftNormal
      : { x: -leftNormal.x, z: -leftNormal.z };
  const halfWidth = Math.max(0, beam.widthMeters) / 2;
  return {
    point: {
      x: (beam.startPoint.x + beam.endPoint.x) / 2 + inwardNormal.x * halfWidth,
      z: (beam.startPoint.z + beam.endPoint.z) / 2 + inwardNormal.z * halfWidth,
    },
    tangent: beamTangent,
  };
}

function intersectLines(
  previous: SlabContactLine,
  current: SlabContactLine,
): SlabFootprintPoint | null {
  const denominator = cross(previous.tangent, current.tangent);
  if (Math.abs(denominator) <= SLAB_FOOTPRINT_EPSILON_METERS) return null;
  const delta = {
    x: current.point.x - previous.point.x,
    z: current.point.z - previous.point.z,
  };
  const t = cross(delta, current.tangent) / denominator;
  return {
    x: previous.point.x + previous.tangent.x * t,
    z: previous.point.z + previous.tangent.z * t,
  };
}

function pushDistinctPoint(points: SlabFootprintPoint[], point: SlabFootprintPoint): void {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.z)) return;
  const prior = points.at(-1);
  if (
    prior &&
    Math.abs(prior.x - point.x) <= SLAB_FOOTPRINT_EPSILON_METERS &&
    Math.abs(prior.z - point.z) <= SLAB_FOOTPRINT_EPSILON_METERS
  ) {
    return;
  }
  points.push(point);
}

function closeDistinctPolygon(points: SlabFootprintPoint[]): SlabFootprintPoint[] {
  const first = points[0];
  const last = points.at(-1);
  if (
    first &&
    last &&
    Math.abs(first.x - last.x) <= SLAB_FOOTPRINT_EPSILON_METERS &&
    Math.abs(first.z - last.z) <= SLAB_FOOTPRINT_EPSILON_METERS
  ) {
    points.pop();
  }
  return points;
}

export function resolveInteriorFloorSlabFootprint(params: {
  interiorFacePolygon: readonly SlabFootprintPoint[];
  beams?: readonly SlabContactBeam[];
  segmentFrames?: readonly SlabContactSegmentFrame[];
  orderedPerimeterSegmentIds?: readonly string[];
}): SlabFootprintPoint[] {
  const fallback = cloneFootprint(params.interiorFacePolygon);
  const orderedSegmentIds = [...new Set(params.orderedPerimeterSegmentIds ?? [])];
  if (orderedSegmentIds.length < 3 || !params.beams?.length || !params.segmentFrames?.length) {
    return fallback;
  }

  const framesBySegmentId = new Map(
    params.segmentFrames.map((frame) => [frame.segmentId, frame]),
  );
  const beamsBySegmentId = new Map<string, SlabContactBeam[]>();
  for (const beam of params.beams) {
    if (
      (beam.kind !== 'plinth_beam' && beam.kind !== 'grade_beam') ||
      !beam.hostSegmentId ||
      beam.widthMeters <= 0
    ) {
      continue;
    }
    const beams = beamsBySegmentId.get(beam.hostSegmentId) ?? [];
    beams.push(beam);
    beamsBySegmentId.set(beam.hostSegmentId, beams);
  }

  const contactLines: SlabContactLine[] = [];
  for (const segmentId of orderedSegmentIds) {
    const frame = framesBySegmentId.get(segmentId);
    const beam = selectRepresentativeBeam(beamsBySegmentId.get(segmentId) ?? []);
    if (!frame || !beam) {
      return fallback;
    }
    const contactLine = contactLineForBeam(beam, frame);
    if (!contactLine) return fallback;
    contactLines.push(contactLine);
  }

  const footprint: SlabFootprintPoint[] = [];
  for (let index = 0; index < contactLines.length; index += 1) {
    const previous = contactLines[(index + contactLines.length - 1) % contactLines.length]!;
    const current = contactLines[index]!;
    const intersection = intersectLines(previous, current);
    pushDistinctPoint(footprint, intersection ?? current.point);
  }
  const closed = closeDistinctPolygon(footprint);
  if (closed.length < 3 || polygonAreaSquareMeters(closed) <= SLAB_FOOTPRINT_EPSILON_METERS) {
    return fallback;
  }
  return closed;
}

export function resolveInteriorFloorSlab(params: {
  foundation: RcFrameFoundationSettings | import('../types').StructuralFoundationSettings | undefined;
  interiorFacePolygon: readonly { x: number; z: number }[];
  footprintPolygon?: readonly { x: number; z: number }[];
}): ResolvedInteriorFloorSlab {
  const settings = resolveInteriorFloorSlabSettings(params.foundation);
  const enabled = settings.enabled && settings.thicknessMeters > 0;
  const thicknessMeters = enabled ? settings.thicknessMeters : 0;
  const footprintPolygon = enabled
    ? cloneFootprint(params.footprintPolygon ?? params.interiorFacePolygon)
    : [];
  const areaSquareMeters = enabled ? polygonAreaSquareMeters(footprintPolygon) : 0;
  return {
    enabled,
    thicknessMeters,
    footprintPolygon,
    topElevationMeters: TOP_OF_PLINTH_BEAM_Y,
    bottomElevationMeters: TOP_OF_PLINTH_BEAM_Y - thicknessMeters,
    areaSquareMeters,
    volumeCubicMeters: areaSquareMeters * thicknessMeters,
  };
}
