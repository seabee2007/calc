import type { FasciaPlacement, PurlinPlacement, RoofPlane, RoofSystemSettings, RoofVec3 } from '../types';
import {
  CORRUGATED_SHEET_DISPLAY_THICKNESS_METERS,
  normalizeOutwardRoofNormal,
  PURLIN_PROFILE_DEPTH_METERS,
  PURLIN_PROFILE_WIDTH_METERS,
  PURLIN_TO_CHORD_CLEARANCE_METERS,
  PURLIN_TO_SHEET_CLEARANCE_METERS,
  TRUSS_CHORD_PROFILE_METERS,
  elevationOnRoofPlaneAtPoint,
} from './roofFramingResolver';

const EDGE_KEY_PRECISION = 3;
const MIN_FASCIA_EDGE_LENGTH_METERS = 0.05;
const FASCIA_SOFFIT_LAP_METERS = 0.05;

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

function horizontalUnitFromSegment(start: RoofVec3, end: RoofVec3): RoofVec3 {
  const x = end.x - start.x;
  const z = end.z - start.z;
  const length = Math.hypot(x, z);
  if (length <= 1e-8) {
    return { x: 1, y: 0, z: 0 };
  }
  return { x: x / length, y: 0, z: z / length };
}

function verticalEavePurlinOutboardAxis(purlin: PurlinPlacement): RoofVec3 {
  const normal = normalizeOutwardRoofNormal(purlin.planeNormal);
  const runAxis = horizontalUnitFromSegment(purlin.start, purlin.end);
  let outboardAxis = {
    x: runAxis.z * normal.y,
    y: 0,
    z: -runAxis.x * normal.y,
  };
  let outboardLength = Math.hypot(outboardAxis.x, outboardAxis.z);
  if (outboardLength <= 1e-8) {
    outboardAxis = { x: -runAxis.z, y: 0, z: runAxis.x };
    outboardLength = Math.hypot(outboardAxis.x, outboardAxis.z);
  }
  if (outboardLength <= 1e-8) {
    outboardAxis = { x: 1, y: 0, z: 0 };
    outboardLength = 1;
  }
  outboardAxis = {
    x: outboardAxis.x / outboardLength,
    y: 0,
    z: outboardAxis.z / outboardLength,
  };

  const roofSlopeAlongOutboard =
    normal.y === 0 ? 0 : -(normal.x * outboardAxis.x + normal.z * outboardAxis.z) / normal.y;
  return roofSlopeAlongOutboard > 0
    ? { x: -outboardAxis.x, y: 0, z: -outboardAxis.z }
    : outboardAxis;
}

function eavePurlinForPlane(
  purlins: readonly PurlinPlacement[] | undefined,
  planeId: string,
): PurlinPlacement | null {
  return purlins?.find((purlin) => purlin.slopePlaneId === planeId && purlin.rowIndex === 0) ?? null;
}

function movePointToPurlinOutboardFace(point: RoofVec3, purlin: PurlinPlacement): RoofVec3 {
  const runAxis = horizontalUnitFromSegment(purlin.start, purlin.end);
  const spanLength =
    Math.hypot(purlin.end.x - purlin.start.x, purlin.end.z - purlin.start.z) || 1;
  const stationMeters =
    (point.x - purlin.start.x) * runAxis.x + (point.z - purlin.start.z) * runAxis.z;
  const t = Math.max(0, Math.min(1, stationMeters / spanLength));
  const center = {
    x: purlin.start.x + (purlin.end.x - purlin.start.x) * t,
    y: purlin.start.y + (purlin.end.y - purlin.start.y) * t,
    z: purlin.start.z + (purlin.end.z - purlin.start.z) * t,
  };
  const outboardAxis = verticalEavePurlinOutboardAxis(purlin);
  return {
    x: center.x + outboardAxis.x * (PURLIN_PROFILE_WIDTH_METERS / 2),
    y: point.y,
    z: center.z + outboardAxis.z * (PURLIN_PROFILE_WIDTH_METERS / 2),
  };
}

function pointOnSheetUndersideAtSupportEdge(params: {
  supportPoint: RoofVec3;
  displayPlane: RoofPlane;
  normal: RoofVec3;
}): RoofVec3 {
  const sheetTopY =
    elevationOnRoofPlaneAtPoint(params.displayPlane, params.supportPoint.x, params.supportPoint.z) ??
    params.supportPoint.y;
  const normalized = normalizeOutwardRoofNormal(params.normal);
  return {
    x: params.supportPoint.x,
    y: sheetTopY - CORRUGATED_SHEET_DISPLAY_THICKNESS_METERS / Math.max(0.001, normalized.y),
    z: params.supportPoint.z,
  };
}

function fasciaFaceDepthMeters(params: {
  planeNormal: RoofVec3;
  purlinsEnabled: boolean;
  soffitEnabled: boolean;
  bottomExtensionBelowFrameMeters: number;
}): number {
  const normal = normalizeOutwardRoofNormal(params.planeNormal);
  const framingStackAlongRoofNormal =
    TRUSS_CHORD_PROFILE_METERS +
    (params.purlinsEnabled
      ? PURLIN_TO_CHORD_CLEARANCE_METERS + PURLIN_PROFILE_DEPTH_METERS + PURLIN_TO_SHEET_CLEARANCE_METERS
      : 0);
  const framingStackVerticalDepth = framingStackAlongRoofNormal * Math.max(0, normal.y);
  const soffitLap = params.soffitEnabled ? FASCIA_SOFFIT_LAP_METERS : 0;
  return Math.max(
    0.0254,
    framingStackVerticalDepth + Math.max(0, params.bottomExtensionBelowFrameMeters) + soffitLap,
  );
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

function endpointIsAtEave(point: RoofVec3, plane: RoofPlane): boolean {
  const lowestY = Math.min(...plane.corners.map((corner) => corner.y));
  return Math.abs(point.y - lowestY) <= 0.04;
}

export function resolveRoofFasciaPlacements(params: {
  roofSystem: RoofSystemSettings;
  claddingDisplayPlanes: readonly RoofPlane[];
  supportRoofTopPlanes: readonly RoofPlane[];
  purlinPlacements?: readonly PurlinPlacement[];
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
    const role = edgeRole({
      roofType: params.roofSystem.roofType,
      plane: ref.plane,
      start: ref.start,
      end: ref.end,
    });
    const eavePurlin = eavePurlinForPlane(params.purlinPlacements, ref.plane.id);
    const supportStart = eavePurlin && endpointIsAtEave(ref.start, ref.plane)
      ? movePointToPurlinOutboardFace(ref.start, eavePurlin)
      : ref.start;
    const supportEnd = eavePurlin && endpointIsAtEave(ref.end, ref.plane)
      ? movePointToPurlinOutboardFace(ref.end, eavePurlin)
      : ref.end;
    const topStart = pointOnSheetUndersideAtSupportEdge({
      supportPoint: supportStart,
      displayPlane,
      normal,
    });
    const topEnd = pointOnSheetUndersideAtSupportEdge({
      supportPoint: supportEnd,
      displayPlane,
      normal,
    });
    const faceDepthMeters = fasciaFaceDepthMeters({
      planeNormal: normal,
      purlinsEnabled: params.roofSystem.purlins.enabled,
      soffitEnabled: params.roofSystem.soffit.enabled,
      bottomExtensionBelowFrameMeters: params.roofSystem.fascia.bottomExtensionBelowFrameMeters,
    });
    const bottomStart = { ...topStart, y: topStart.y - faceDepthMeters };
    const bottomEnd = { ...topEnd, y: topEnd.y - faceDepthMeters };
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
