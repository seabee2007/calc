import type { DesignWallLayoutParameters, DesignWallSegment, StructuralBeam } from '../types';
import type { SegmentFrame } from '../geometry/designGeometry';

export type PlanVec2 = { x: number; z: number };

export type FootprintBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  centerX: number;
  centerZ: number;
};

export type ResolveOuterRoofBeamBearingLoopInput = {
  layout: DesignWallLayoutParameters;
  segmentFrames: readonly SegmentFrame[];
  roofBeams: readonly StructuralBeam[];
  fallbackExteriorFootprint: readonly PlanVec2[];
};

export type ResolvedRoofBearingLoop = {
  points: PlanVec2[];
  source: 'roof_beam_outer_faces' | 'wall_exterior_fallback';
  warnings: string[];
};

export type LocalRectangularBasis = {
  localX: PlanVec2;
  localZ: PlanVec2;
  center: PlanVec2;
};

export type RectangularFootprintAnalysis = {
  supported: boolean;
  lengthMeters: number;
  widthMeters: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  centerX: number;
  centerZ: number;
  localX: PlanVec2;
  localZ: PlanVec2;
  /** CCW bearing corners aligned with layout perimeter order. */
  bearingCorners: PlanVec2[];
  /** Segment ids for edges parallel to localX. */
  localXSegmentIds: string[];
  /** Segment ids for edges parallel to localZ. */
  localZSegmentIds: string[];
  /** Span of the footprint along localX. */
  localXSpanMeters: number;
  /** Span of the footprint along localZ. */
  localZSpanMeters: number;
  /** @deprecated Alias for localXSegmentIds when axis-aligned south/north walls. */
  axisXSegmentIds: string[];
  /** @deprecated Alias for localZSegmentIds when axis-aligned east/west walls. */
  axisZSegmentIds: string[];
};

export type RidgeAxis = 'localX' | 'localZ';

const ORTHOGONAL_TOLERANCE = 0.08;
const MIN_EDGE_LENGTH_METERS = 0.1;
const COLLINEAR_TOLERANCE = 0.001;

export function footprintBounds(footprint: readonly PlanVec2[]): FootprintBounds {
  const xs = footprint.map((point) => point.x);
  const zs = footprint.map((point) => point.z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
  };
}

function vec2Length(v: PlanVec2): number {
  return Math.hypot(v.x, v.z);
}

function normalizeVec2(v: PlanVec2): PlanVec2 {
  const len = vec2Length(v) || 1;
  return { x: v.x / len, z: v.z / len };
}

function perpendicularCCW(v: PlanVec2): PlanVec2 {
  return { x: -v.z, z: v.x };
}

function dist2(a: PlanVec2, b: PlanVec2): number {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

export function midpoint2(a: PlanVec2, b: PlanVec2): PlanVec2 {
  return { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
}

function dot2(a: PlanVec2, b: PlanVec2): number {
  return a.x * b.x + a.z * b.z;
}

function cross2(a: PlanVec2, b: PlanVec2): number {
  return a.x * b.z - a.z * b.x;
}

function pointsClose(a: PlanVec2, b: PlanVec2, toleranceMeters = 0.001): boolean {
  return dist2(a, b) <= toleranceMeters;
}

function removeClosingDuplicate(points: readonly PlanVec2[]): PlanVec2[] {
  if (points.length > 1 && pointsClose(points[0]!, points[points.length - 1]!)) {
    return points.slice(0, -1).map((point) => ({ ...point }));
  }
  return points.map((point) => ({ ...point }));
}

function simplifyCollinearClosedLoop(points: readonly PlanVec2[]): PlanVec2[] {
  let simplified = removeClosingDuplicate(points).filter((point, index, source) => {
    const previous = source[index - 1];
    return !previous || !pointsClose(previous, point);
  });

  let changed = true;
  while (changed && simplified.length > 3) {
    changed = false;
    const next: PlanVec2[] = [];
    for (let index = 0; index < simplified.length; index += 1) {
      const prev = simplified[(index - 1 + simplified.length) % simplified.length]!;
      const curr = simplified[index]!;
      const after = simplified[(index + 1) % simplified.length]!;
      const incoming = { x: curr.x - prev.x, z: curr.z - prev.z };
      const outgoing = { x: after.x - curr.x, z: after.z - curr.z };
      const incomingLength = vec2Length(incoming);
      const outgoingLength = vec2Length(outgoing);
      const cross = Math.abs(cross2(incoming, outgoing));
      if (
        incomingLength > MIN_EDGE_LENGTH_METERS &&
        outgoingLength > MIN_EDGE_LENGTH_METERS &&
        cross <= COLLINEAR_TOLERANCE * incomingLength * outgoingLength &&
        dot2(incoming, outgoing) > 0
      ) {
        changed = true;
        continue;
      }
      next.push(curr);
    }
    simplified = next;
  }

  return simplified;
}

/** Intersect two infinite lines defined by point pairs. */
export function intersectInfiniteLines2D(
  a1: PlanVec2,
  a2: PlanVec2,
  b1: PlanVec2,
  b2: PlanVec2,
): PlanVec2 | null {
  const dax = a2.x - a1.x;
  const daz = a2.z - a1.z;
  const dbx = b2.x - b1.x;
  const dbz = b2.z - b1.z;
  const denom = dax * dbz - daz * dbx;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((b1.x - a1.x) * dbz - (b1.z - a1.z) * dbx) / denom;
  return { x: a1.x + dax * t, z: a1.z + daz * t };
}

/** Intersect ray from `origin` along `dir` with finite segment `segStart`-`segEnd`. */
export function intersectRayWithSegment2D(
  origin: PlanVec2,
  dir: PlanVec2,
  segStart: PlanVec2,
  segEnd: PlanVec2,
): PlanVec2 | null {
  const denom = dir.x * (segEnd.z - segStart.z) - dir.z * (segEnd.x - segStart.x);
  if (Math.abs(denom) < 1e-9) return null;
  const dx = segStart.x - origin.x;
  const dz = segStart.z - origin.z;
  const t = (dx * (segEnd.z - segStart.z) - dz * (segEnd.x - segStart.x)) / denom;
  if (t < -1e-6) return null;
  const u =
    ((origin.x + dir.x * t - segStart.x) * (segEnd.x - segStart.x) +
      (origin.z + dir.z * t - segStart.z) * (segEnd.z - segStart.z)) /
    (dist2(segStart, segEnd) ** 2 || 1);
  if (u < -0.001 || u > 1.001) return null;
  return { x: origin.x + dir.x * t, z: origin.z + dir.z * t };
}

export function distancePointToLine2D(point: PlanVec2, lineStart: PlanVec2, lineEnd: PlanVec2): number {
  const dx = lineEnd.x - lineStart.x;
  const dz = lineEnd.z - lineStart.z;
  const len = Math.hypot(dx, dz) || 1;
  return Math.abs((point.x - lineStart.x) * dz - (point.z - lineStart.z) * dx) / len;
}

/** Offset each edge outward by `offsetMeters`; corners are line-line intersections (true miters). */
export function offsetClosedPolygonOutward(
  polygon: readonly PlanVec2[],
  offsetMeters: number,
): PlanVec2[] {
  if (polygon.length < 3 || offsetMeters <= 0) {
    return polygon.map((point) => ({ ...point }));
  }
  const n = polygon.length;
  let signedArea = 0;
  for (let index = 0; index < n; index += 1) {
    const current = polygon[index]!;
    const next = polygon[(index + 1) % n]!;
    signedArea += current.x * next.z - next.x * current.z;
  }
  const ccw = signedArea > 0;

  const offsetLines: Array<{ start: PlanVec2; end: PlanVec2 }> = [];
  for (let index = 0; index < n; index += 1) {
    const start = polygon[index]!;
    const end = polygon[(index + 1) % n]!;
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const len = Math.hypot(dx, dz) || 1;
    const nx = ccw ? dz / len : -dz / len;
    const nz = ccw ? -dx / len : dx / len;
    offsetLines.push({
      start: { x: start.x + nx * offsetMeters, z: start.z + nz * offsetMeters },
      end: { x: end.x + nx * offsetMeters, z: end.z + nz * offsetMeters },
    });
  }

  const corners: PlanVec2[] = [];
  for (let index = 0; index < n; index += 1) {
    const prev = offsetLines[(index - 1 + n) % n]!;
    const curr = offsetLines[index]!;
    const corner = intersectInfiniteLines2D(prev.start, prev.end, curr.start, curr.end);
    corners.push(corner ?? curr.start);
  }
  return corners;
}

/** Offset each polygon edge outward by its own distance; corners are offset-line intersections. */
export function offsetClosedPolygonWithEdgeOffsets(
  polygon: readonly PlanVec2[],
  edgeOffsetMeters: readonly number[],
): PlanVec2[] {
  if (polygon.length < 3) {
    return polygon.map((point) => ({ ...point }));
  }
  const n = polygon.length;
  if (edgeOffsetMeters.length !== n) {
    return polygon.map((point) => ({ ...point }));
  }
  if (edgeOffsetMeters.every((offset) => offset <= 0)) {
    return polygon.map((point) => ({ ...point }));
  }

  let signedArea = 0;
  for (let index = 0; index < n; index += 1) {
    const current = polygon[index]!;
    const next = polygon[(index + 1) % n]!;
    signedArea += current.x * next.z - next.x * current.z;
  }
  const ccw = signedArea > 0;

  const offsetLines: Array<{ start: PlanVec2; end: PlanVec2 }> = [];
  for (let index = 0; index < n; index += 1) {
    const offsetMeters = Math.max(0, edgeOffsetMeters[index] ?? 0);
    const start = polygon[index]!;
    const end = polygon[(index + 1) % n]!;
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const len = Math.hypot(dx, dz) || 1;
    const nx = ccw ? dz / len : -dz / len;
    const nz = ccw ? -dx / len : dx / len;
    offsetLines.push({
      start: { x: start.x + nx * offsetMeters, z: start.z + nz * offsetMeters },
      end: { x: end.x + nx * offsetMeters, z: end.z + nz * offsetMeters },
    });
  }

  const corners: PlanVec2[] = [];
  for (let index = 0; index < n; index += 1) {
    const prev = offsetLines[(index - 1 + n) % n]!;
    const curr = offsetLines[index]!;
    const corner = intersectInfiniteLines2D(prev.start, prev.end, curr.start, curr.end);
    corners.push(corner ?? curr.start);
  }
  return corners;
}

export function resolveGableRoofEdgeOffsets(params: {
  bearing: readonly PlanVec2[];
  ridgeAxis: RidgeAxis;
  eaveOverhangMeters: number;
  gableEndOverhangMeters: number;
}): number[] {
  if (params.bearing.length !== 4) {
    return params.bearing.map(() => 0);
  }
  const evenLong = longEdgesAreEven(params.bearing);
  const ridgeParallelToEvenEdges =
    (params.ridgeAxis === 'localX' && evenLong) || (params.ridgeAxis === 'localZ' && !evenLong);
  return params.bearing.map((_, index) => {
    const isEvenEdge = index % 2 === 0;
    const isEaveEdge = ridgeParallelToEvenEdges ? isEvenEdge : !isEvenEdge;
    return isEaveEdge ? params.eaveOverhangMeters : params.gableEndOverhangMeters;
  });
}

function segmentTangent(
  segment: DesignWallSegment,
  nodes: DesignWallLayoutParameters['nodes'],
): { x: number; z: number; length: number } | null {
  const start = nodes.find((node) => node.id === segment.startNodeId);
  const end = nodes.find((node) => node.id === segment.endNodeId);
  if (!start || !end) return null;
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const length = Math.hypot(dx, dz);
  if (length <= 0.001) return null;
  return { x: dx / length, z: dz / length, length };
}

function isRightAngle(a: PlanVec2, b: PlanVec2): boolean {
  return Math.abs(dot2(a, b)) < ORTHOGONAL_TOLERANCE;
}

function orderedSegmentFrames(segmentFrames: readonly SegmentFrame[]): SegmentFrame[] {
  if (segmentFrames.length <= 1) return [...segmentFrames];
  const ordered: SegmentFrame[] = [];
  const used = new Set<string>();
  let current = segmentFrames[0]!;
  ordered.push(current);
  used.add(current.segmentId);
  while (ordered.length < segmentFrames.length) {
    const endPoint = current.end;
    const next = segmentFrames.find(
      (frame) =>
        !used.has(frame.segmentId) &&
        (dist2(frame.start, endPoint) < 0.02 || dist2(frame.end, endPoint) < 0.02),
    );
    if (!next) break;
    if (dist2(next.end, endPoint) < dist2(next.start, endPoint)) {
      ordered.push({
        ...next,
        start: next.end,
        end: next.start,
        exteriorStart: next.exteriorEnd,
        exteriorEnd: next.exteriorStart,
        interiorStart: next.interiorEnd,
        interiorEnd: next.interiorStart,
        centerlineStart: next.centerlineEnd,
        centerlineEnd: next.centerlineStart,
        tangent: { x: -next.tangent.x, z: -next.tangent.z },
        inwardNormal: { x: -next.inwardNormal.x, z: -next.inwardNormal.z },
        outwardNormal: { x: -next.outwardNormal.x, z: -next.outwardNormal.z },
        rotationY: next.rotationY + Math.PI,
      });
    } else {
      ordered.push(next);
    }
    used.add(next.segmentId);
    current = ordered[ordered.length - 1]!;
  }
  return ordered.length === segmentFrames.length ? ordered : [...segmentFrames];
}

function outerFaceLineForBeam(frame: SegmentFrame, beam: StructuralBeam): { start: PlanVec2; end: PlanVec2 } {
  const half = beam.widthMeters / 2;
  const outward = frame.outwardNormal;
  return {
    start: {
      x: frame.centerlineStart.x + outward.x * half,
      z: frame.centerlineStart.z + outward.z * half,
    },
    end: {
      x: frame.centerlineEnd.x + outward.x * half,
      z: frame.centerlineEnd.z + outward.z * half,
    },
  };
}

/** Resolve the true outer-face loop of perimeter roof beams via offset-line intersections. */
export function resolveOuterRoofBeamBearingLoop(
  input: ResolveOuterRoofBeamBearingLoopInput,
): ResolvedRoofBearingLoop {
  const warnings: string[] = [];
  const fallback = (): ResolvedRoofBearingLoop => {
    if (input.fallbackExteriorFootprint.length < 4) {
      warnings.push('Roof bearing loop fell back: missing exterior footprint.');
    }
    const simplifiedFallback = simplifyCollinearClosedLoop(input.fallbackExteriorFootprint);
    return {
      points: simplifiedFallback.length >= 4
        ? simplifiedFallback
        : input.fallbackExteriorFootprint.map((point) => ({ ...point })),
      source: 'wall_exterior_fallback',
      warnings,
    };
  };

  if (!input.layout.isFootprintClosed || input.layout.segments.length < 4) {
    warnings.push('Roof bearing loop fell back to wall exterior: footprint is not a closed quadrilateral.');
    return fallback();
  }

  const roofBeamBySegmentId = new Map<string, StructuralBeam>();
  for (const beam of input.roofBeams) {
    if (beam.kind !== 'roof_beam' && beam.kind !== 'ring_beam') continue;
    if (beam.hostSegmentId) roofBeamBySegmentId.set(beam.hostSegmentId, beam);
  }

  const orderedFrames = orderedSegmentFrames(input.segmentFrames);
  const outerLines: Array<{ start: PlanVec2; end: PlanVec2 }> = [];
  for (const frame of orderedFrames) {
    const beam = roofBeamBySegmentId.get(frame.segmentId);
    if (!beam) {
      warnings.push(`Roof bearing loop fell back: missing roof beam on segment ${frame.segmentId}.`);
      return fallback();
    }
    if (beam.widthMeters <= 0) {
      warnings.push(`Roof bearing loop fell back: invalid roof beam width on segment ${frame.segmentId}.`);
      return fallback();
    }
    outerLines.push(outerFaceLineForBeam(frame, beam));
  }

  if (outerLines.length < 4) {
    warnings.push('Roof bearing loop fell back: could not resolve four outer roof-beam faces.');
    return fallback();
  }

  const points: PlanVec2[] = [];
  for (let index = 0; index < outerLines.length; index += 1) {
    const curr = outerLines[index]!;
    let prev: { start: PlanVec2; end: PlanVec2 } | null = null;
    for (let offset = 1; offset < outerLines.length; offset += 1) {
      const candidate = outerLines[(index - offset + outerLines.length) % outerLines.length]!;
      if (intersectInfiniteLines2D(candidate.start, candidate.end, curr.start, curr.end)) {
        prev = candidate;
        break;
      }
    }
    if (!prev) {
      warnings.push('Roof bearing loop fell back: parallel roof-beam outer faces at a corner.');
      return fallback();
    }
    const corner = intersectInfiniteLines2D(prev.start, prev.end, curr.start, curr.end);
    if (!corner) {
      warnings.push('Roof bearing loop fell back: parallel roof-beam outer faces at a corner.');
      return fallback();
    }
    points.push(corner);
  }

  const simplifiedPoints = simplifyCollinearClosedLoop(points);
  if (simplifiedPoints.length !== 4) {
    warnings.push('Roof bearing loop fell back: roof-beam outer faces do not simplify to four corners.');
    return fallback();
  }

  return { points: simplifiedPoints, source: 'roof_beam_outer_faces', warnings };
}

export function resolveCladdingPerimeterFromBearing(
  bearingPerimeter: readonly PlanVec2[],
  eaveOverhangMeters: number,
): PlanVec2[] {
  return offsetClosedPolygonOutward(
    simplifyCollinearClosedLoop(bearingPerimeter),
    Math.max(0, eaveOverhangMeters),
  );
}

export function deriveLocalRectangularBasis(firstEdgeTangent: PlanVec2): LocalRectangularBasis {
  const localX = normalizeVec2(firstEdgeTangent);
  const localZ = normalizeVec2(perpendicularCCW(localX));
  return { localX, localZ, center: { x: 0, z: 0 } };
}

export function analyzeRectangularFootprint(params: {
  layout: DesignWallLayoutParameters;
  exteriorFootprint: readonly PlanVec2[];
}): RectangularFootprintAnalysis {
  const empty: RectangularFootprintAnalysis = {
    supported: false,
    lengthMeters: 0,
    widthMeters: 0,
    minX: 0,
    maxX: 0,
    minZ: 0,
    maxZ: 0,
    centerX: 0,
    centerZ: 0,
    localX: { x: 1, z: 0 },
    localZ: { x: 0, z: 1 },
    bearingCorners: [],
    localXSegmentIds: [],
    localZSegmentIds: [],
    localXSpanMeters: 0,
    localZSpanMeters: 0,
    axisXSegmentIds: [],
    axisZSegmentIds: [],
  };

  if (!params.layout.isFootprintClosed || params.layout.segments.length < 4) {
    return empty;
  }
  const corners = simplifyCollinearClosedLoop(params.exteriorFootprint);
  if (corners.length !== 4) {
    return empty;
  }

  const bounds = footprintBounds(corners);
  const edgeLengths = corners.map((_, index) =>
    dist2(corners[index]!, corners[(index + 1) % 4]!),
  );
  if (edgeLengths.some((length) => length < MIN_EDGE_LENGTH_METERS)) {
    return empty;
  }

  const edge0 = {
    x: corners[1]!.x - corners[0]!.x,
    z: corners[1]!.z - corners[0]!.z,
  };
  const localX = normalizeVec2(edge0);
  const localZ = normalizeVec2(perpendicularCCW(localX));

  for (let index = 0; index < 4; index += 1) {
    const next = (index + 1) % 4;
    const edge = {
      x: corners[next]!.x - corners[index]!.x,
      z: corners[next]!.z - corners[index]!.z,
    };
    const edgeDir = normalizeVec2(edge);
    const nextEdge = {
      x: corners[(next + 1) % 4]!.x - corners[next]!.x,
      z: corners[(next + 1) % 4]!.z - corners[next]!.z,
    };
    const nextDir = normalizeVec2(nextEdge);
    if (!isRightAngle(edgeDir, nextDir)) {
      return empty;
    }
  }

  const tangents = params.layout.segments.map((segment) => ({
    segmentId: segment.id,
    tangent: segmentTangent(segment, params.layout.nodes),
  }));
  if (tangents.some((entry) => !entry.tangent)) {
    return empty;
  }

  const localXSegmentIds: string[] = [];
  const localZSegmentIds: string[] = [];
  for (const entry of tangents) {
    const tangent = entry.tangent!;
    const alongLocalX = Math.abs(dot2(tangent, localX)) >= Math.abs(dot2(tangent, localZ));
    if (alongLocalX) {
      localXSegmentIds.push(entry.segmentId);
    } else {
      localZSegmentIds.push(entry.segmentId);
    }
  }

  const lengthAlongLocalX =
    (Math.abs(dot2({ x: corners[1]!.x - corners[0]!.x, z: corners[1]!.z - corners[0]!.z }, localX)) +
      Math.abs(dot2({ x: corners[3]!.x - corners[2]!.x, z: corners[3]!.z - corners[2]!.z }, localX))) /
    2;
  const lengthAlongLocalZ =
    (Math.abs(dot2({ x: corners[2]!.x - corners[1]!.x, z: corners[2]!.z - corners[1]!.z }, localZ)) +
      Math.abs(dot2({ x: corners[0]!.x - corners[3]!.x, z: corners[0]!.z - corners[3]!.z }, localZ))) /
    2;

  const lengthMeters = Math.max(lengthAlongLocalX, lengthAlongLocalZ);
  const widthMeters = Math.min(lengthAlongLocalX, lengthAlongLocalZ);

  return {
    supported: true,
    lengthMeters,
    widthMeters,
    ...bounds,
    localX,
    localZ,
    bearingCorners: corners,
    localXSegmentIds,
    localZSegmentIds,
    localXSpanMeters: lengthAlongLocalX,
    localZSpanMeters: lengthAlongLocalZ,
    axisXSegmentIds: localXSegmentIds,
    axisZSegmentIds: localZSegmentIds,
  };
}

export const UNSUPPORTED_ROOF_FOOTPRINT_MESSAGE =
  'Roof generation currently supports closed rectangular four-sided footprints.';

export function resolveRidgeAxis(
  analysis: RectangularFootprintAnalysis,
  ridgeDirection: 'along_longest_axis' | 'along_shortest_axis' | 'along_selected_wall_pair',
  selectedRidgeWallSegmentId?: string,
): RidgeAxis {
  const longAxis: RidgeAxis = 'localX';
  const shortAxis: RidgeAxis = 'localZ';
  const longIsLocalX = analysis.lengthMeters >= analysis.widthMeters - 0.001;

  if (ridgeDirection === 'along_shortest_axis') {
    return longIsLocalX ? shortAxis : longAxis;
  }
  if (ridgeDirection === 'along_selected_wall_pair' && selectedRidgeWallSegmentId) {
    if (analysis.localXSegmentIds.includes(selectedRidgeWallSegmentId)) {
      return 'localX';
    }
    if (analysis.localZSegmentIds.includes(selectedRidgeWallSegmentId)) {
      return 'localZ';
    }
  }
  return longIsLocalX ? longAxis : shortAxis;
}

/** True when even-indexed edges (0 and 2) are the longer pair. */
export function longEdgesAreEven(corners: readonly PlanVec2[]): boolean {
  const e0 = dist2(corners[0]!, corners[1]!);
  const e1 = dist2(corners[1]!, corners[2]!);
  const e2 = dist2(corners[2]!, corners[3]!);
  const e3 = dist2(corners[3]!, corners[0]!);
  return (e0 + e2) / 2 >= (e1 + e3) / 2 - 0.001;
}

export function gableEndSegmentIdsForRidgeAxis(
  analysis: RectangularFootprintAnalysis,
  ridgeAxis: RidgeAxis,
): string[] {
  const evenLong = longEdgesAreEven(analysis.bearingCorners);
  const ridgeParallelToLocalX =
    (ridgeAxis === 'localX' && evenLong) || (ridgeAxis === 'localZ' && !evenLong);
  return ridgeParallelToLocalX ? analysis.localZSegmentIds : analysis.localXSegmentIds;
}

export function projectToLocal(point: PlanVec2, origin: PlanVec2, localX: PlanVec2, localZ: PlanVec2): PlanVec2 {
  const dx = point.x - origin.x;
  const dz = point.z - origin.z;
  return { x: dot2({ x: dx, z: dz }, localX), z: dot2({ x: dx, z: dz }, localZ) };
}

/** @deprecated Use offsetClosedPolygonOutward — kept for any legacy callers. */
export function offsetFootprintOutward(
  footprint: readonly PlanVec2[],
  overhangMeters: number,
): PlanVec2[] {
  return offsetClosedPolygonOutward(footprint, overhangMeters);
}
