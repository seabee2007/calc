import type { FasciaPlacement, RoofPlane, RoofSystemSettings, RoofVec3 } from '../types';
import {
  CORRUGATED_SHEET_DISPLAY_THICKNESS_METERS,
  normalizeOutwardRoofNormal,
  offsetPointAlongRoofNormal,
  PURLIN_PROFILE_DEPTH_METERS,
  PURLIN_TO_CHORD_CLEARANCE_METERS,
  PURLIN_TO_SHEET_CLEARANCE_METERS,
  TRUSS_CHORD_PROFILE_METERS,
  elevationOnRoofPlaneAtPoint,
} from './roofFramingResolver';

const EDGE_KEY_PRECISION = 3;
const MIN_FASCIA_EDGE_LENGTH_METERS = 0.05;

function pointKey(point: RoofVec3): string {
  return `${point.x.toFixed(EDGE_KEY_PRECISION)}:${point.z.toFixed(EDGE_KEY_PRECISION)}`;
}

function canonicalEdgeKey(start: RoofVec3, end: RoofVec3): string {
  const startKey = pointKey(start);
  const endKey = pointKey(end);
  return startKey <= endKey ? `${startKey}|${endKey}` : `${endKey}|${startKey}`;
}

function segmentLength(start: RoofVec3, end: RoofVec3): number {
  return Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z);
}

function planSegmentLength(start: RoofVec3, end: RoofVec3): number {
  return Math.hypot(end.x - start.x, end.z - start.z);
}

function planCentroid(plane: RoofPlane): Pick<RoofVec3, 'x' | 'z'> {
  return {
    x: plane.corners.reduce((sum, corner) => sum + corner.x, 0) / plane.corners.length,
    z: plane.corners.reduce((sum, corner) => sum + corner.z, 0) / plane.corners.length,
  };
}

function faceOutwardNormalForEdge(params: {
  plane: RoofPlane;
  start: RoofVec3;
  end: RoofVec3;
}): RoofVec3 {
  const edgeX = params.end.x - params.start.x;
  const edgeZ = params.end.z - params.start.z;
  const edgeLength = Math.hypot(edgeX, edgeZ) || 1;
  const candidate = { x: -edgeZ / edgeLength, z: edgeX / edgeLength };
  const midpoint = {
    x: (params.start.x + params.end.x) / 2,
    z: (params.start.z + params.end.z) / 2,
  };
  const centroid = planCentroid(params.plane);
  const toCentroid = { x: centroid.x - midpoint.x, z: centroid.z - midpoint.z };
  const pointsTowardPlane = candidate.x * toCentroid.x + candidate.z * toCentroid.z > 0;
  return pointsTowardPlane
    ? { x: -candidate.x, y: 0, z: -candidate.z }
    : { x: candidate.x, y: 0, z: candidate.z };
}

function displayPlaneForSupportPlane(
  supportPlane: RoofPlane,
  displayPlanes: readonly RoofPlane[],
): RoofPlane {
  return (
    displayPlanes.find((plane) => plane.id.replace(/-cladding-display$/, '') === supportPlane.id) ??
    supportPlane
  );
}

function pointOnSheetUndersideAtSupportEdge(params: {
  supportPoint: RoofVec3;
  displayPlane: RoofPlane;
  normal: RoofVec3;
}): RoofVec3 {
  const sheetTopY =
    elevationOnRoofPlaneAtPoint(params.displayPlane, params.supportPoint.x, params.supportPoint.z) ??
    params.supportPoint.y;
  return offsetPointAlongRoofNormal(
    {
      x: params.supportPoint.x,
      y: sheetTopY,
      z: params.supportPoint.z,
    },
    params.normal,
    -CORRUGATED_SHEET_DISPLAY_THICKNESS_METERS,
  );
}

function fasciaFaceDepthMeters(params: {
  planeNormal: RoofVec3;
  purlinsEnabled: boolean;
  bottomExtensionBelowFrameMeters: number;
}): number {
  const normal = normalizeOutwardRoofNormal(params.planeNormal);
  const framingStackAlongRoofNormal =
    TRUSS_CHORD_PROFILE_METERS +
    (params.purlinsEnabled
      ? PURLIN_TO_CHORD_CLEARANCE_METERS + PURLIN_PROFILE_DEPTH_METERS + PURLIN_TO_SHEET_CLEARANCE_METERS
      : 0);
  const framingStackVerticalDepth = framingStackAlongRoofNormal * Math.max(0, normal.y);
  return Math.max(0.0254, framingStackVerticalDepth + Math.max(0, params.bottomExtensionBelowFrameMeters));
}

function edgeRole(params: {
  roofType: RoofSystemSettings['roofType'];
  plane: RoofPlane;
  start: RoofVec3;
  end: RoofVec3;
}): FasciaPlacement['edgeRole'] {
  const lowestY = Math.min(...params.plane.corners.map((corner) => corner.y));
  const bothAtEave =
    Math.abs(params.start.y - lowestY) <= 0.04 &&
    Math.abs(params.end.y - lowestY) <= 0.04;
  if (params.roofType === 'gable') {
    return bothAtEave ? 'side_eave' : 'gable_rake';
  }
  return bothAtEave ? 'hip_eave' : 'roof_perimeter';
}

export function resolveRoofFasciaPlacements(params: {
  roofSystem: RoofSystemSettings;
  claddingDisplayPlanes: readonly RoofPlane[];
  supportRoofTopPlanes: readonly RoofPlane[];
}): FasciaPlacement[] {
  if (!params.roofSystem.fascia.enabled) {
    return [];
  }

  const edgeRefs = new Map<string, Array<{ plane: RoofPlane; start: RoofVec3; end: RoofVec3 }>>();

  for (const plane of params.supportRoofTopPlanes) {
    if (plane.corners.length < 3) continue;
    for (let index = 0; index < plane.corners.length; index += 1) {
      const start = plane.corners[index]!;
      const end = plane.corners[(index + 1) % plane.corners.length]!;
      if (planSegmentLength(start, end) <= MIN_FASCIA_EDGE_LENGTH_METERS) {
        continue;
      }
      const key = canonicalEdgeKey(start, end);
      const refs = edgeRefs.get(key) ?? [];
      refs.push({ plane, start, end });
      edgeRefs.set(key, refs);
    }
  }

  const placements: FasciaPlacement[] = [];
  for (const refs of edgeRefs.values()) {
    if (refs.length !== 1) {
      continue;
    }
    const ref = refs[0]!;
    const displayPlane = displayPlaneForSupportPlane(ref.plane, params.claddingDisplayPlanes);
    const normal = normalizeOutwardRoofNormal(displayPlane.normal);
    const topStart = pointOnSheetUndersideAtSupportEdge({
      supportPoint: ref.start,
      displayPlane,
      normal,
    });
    const topEnd = pointOnSheetUndersideAtSupportEdge({
      supportPoint: ref.end,
      displayPlane,
      normal,
    });
    const faceDepthMeters = fasciaFaceDepthMeters({
      planeNormal: normal,
      purlinsEnabled: params.roofSystem.purlins.enabled,
      bottomExtensionBelowFrameMeters: params.roofSystem.fascia.bottomExtensionBelowFrameMeters,
    });
    const bottomStart = { ...topStart, y: topStart.y - faceDepthMeters };
    const bottomEnd = { ...topEnd, y: topEnd.y - faceDepthMeters };
    const role = edgeRole({
      roofType: params.roofSystem.roofType,
      plane: ref.plane,
      start: ref.start,
      end: ref.end,
    });
    const faceOutwardNormal = faceOutwardNormalForEdge({
      plane: ref.plane,
      start: ref.start,
      end: ref.end,
    });

    placements.push({
      id: `${ref.plane.id}-fascia-${placements.length}`,
      sourcePlaneId: ref.plane.id.replace(/-cladding-display$/, ''),
      edgeRole: role,
      topStart,
      topEnd,
      bottomStart,
      bottomEnd,
      outwardNormal: normal,
      faceOutwardNormal,
      lengthMeters: segmentLength(topStart, topEnd),
      faceDepthMeters,
    });
  }

  return placements.sort((left, right) => left.id.localeCompare(right.id));
}

export function totalRoofFasciaLengthMeters(placements: readonly FasciaPlacement[]): number {
  return placements.reduce((sum, placement) => sum + placement.lengthMeters, 0);
}
