import type { PlumbingFitting, PlumbingFittingSystem, PlumbingFittingType } from '../plumbingFittingTypes';
import type {
  PlumbingElevationMode,
  PlumbingEquipment,
  PlumbingMaterial,
  PlumbingPipeSchedule,
  PlumbingPoint3D,
  PlumbingRun,
  PlumbingSystem,
  PlumbingValidationIssue,
} from '../plumbingTypes';
import { ipc2024MinimumDrainageSlopeInPerFt } from './ipcDrainageSlope';
import { solveCouplerSplitDistances } from './plumbingFittingGeneration';
import {
  defaultPlumbingElevationDefaults,
  resolvePlumbingEquipmentPosition,
  resolvePlumbingRunPath,
  type PlumbingElevationDefaults,
} from '../three/plumbingElevationResolver';

const METERS_PER_FOOT = 0.3048;
const FEET_PER_METER = 1 / METERS_PER_FOOT;
const POINT_TOLERANCE_M = 0.06;
const DBOX_LENGTH_M = 0.48;

export type SolvedPipeEndpointRole =
  | 'raw-run-start'
  | 'raw-run-end'
  | 'coupler'
  | 'fitting-port'
  | 'equipment-port'
  | 'd-box-inlet'
  | 'd-box-outlet';

export type SolvedPipePiece = {
  id: string;
  sourceRunId: string;
  sourceSegmentIndex?: number;
  start: PlumbingPoint3D;
  end: PlumbingPoint3D;
  startRole: SolvedPipeEndpointRole;
  endRole: SolvedPipeEndpointRole;
  diameterInches: number | null;
  material: PlumbingMaterial;
  schedule?: PlumbingPipeSchedule;
  slopeInPerFt?: number;
  elevationMode: PlumbingElevationMode;
  lengthFt: number;
};

export type SolvedFittingPort = {
  id: string;
  pipePieceId?: string;
  center: PlumbingPoint3D;
  direction: PlumbingPoint3D;
  diameterInches: number | null;
};

export type SolvedPlumbingFitting = {
  id: string;
  sourceFittingId?: string;
  sourceRunId?: string;
  type: PlumbingFittingType;
  system: PlumbingFittingSystem;
  position: PlumbingPoint3D;
  diameterInches: number | null;
  secondaryDiameterInches?: number | null;
  material: PlumbingMaterial;
  schedule?: PlumbingPipeSchedule;
  ports: SolvedFittingPort[];
  connectedPipePieceIds: string[];
  isAutoSolved: boolean;
};

export type SolvedFixtureConnection = {
  id: string;
  fixtureId: string;
  connectedPipePieceIds: string[];
};

export type SolvedEquipmentConnection = {
  id: string;
  equipmentId: string;
  equipmentNodeId?: string;
  portId: string;
  position: PlumbingPoint3D;
  connectedPipePieceIds: string[];
};

export type SolvedPlumbingModel = {
  pipePieces: SolvedPipePiece[];
  fittings: SolvedPlumbingFitting[];
  fixtures: SolvedFixtureConnection[];
  equipment: SolvedEquipmentConnection[];
  validationIssues: PlumbingValidationIssue[];
  consumedPersistedFittingIds: Set<string>;
};

type SolverOptions = {
  elevationDefaults?: Partial<PlumbingElevationDefaults>;
};

type CutPointKind = 'endpoint' | 'vertex' | 'manual-fitting' | 'coupler';

type CutPoint = {
  distanceM: number;
  point: PlumbingPoint3D;
  role: SolvedPipeEndpointRole;
  kind: CutPointKind;
  fittingId?: string;
  couplerIndex?: number;
};

type AddedPathResult = {
  pieceIds: string[];
  couplerFittings: SolvedPlumbingFitting[];
};

function clonePoint(point: PlumbingPoint3D): PlumbingPoint3D {
  return { x: point.x, y: point.y, z: point.z };
}

function distanceMeters(a: PlumbingPoint3D, b: PlumbingPoint3D): number {
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
}

function planDistanceMeters(a: PlumbingPoint3D, b: PlumbingPoint3D): number {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

function pathDistances(points: readonly PlumbingPoint3D[]): number[] {
  const distances = [0];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    distances.push((distances[index - 1] ?? 0) + (previous && current ? distanceMeters(previous, current) : 0));
  }
  return distances;
}

function pathLengthMeters(points: readonly PlumbingPoint3D[]): number {
  const distances = pathDistances(points);
  return distances[distances.length - 1] ?? 0;
}

function interpolatePoint(a: PlumbingPoint3D, b: PlumbingPoint3D, t: number): PlumbingPoint3D {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

function pointAtPathDistance(points: readonly PlumbingPoint3D[], targetDistanceM: number): PlumbingPoint3D | null {
  let traversed = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (!previous || !current) continue;
    const length = distanceMeters(previous, current);
    if (length <= 0.000001) continue;
    if (traversed + length >= targetDistanceM) {
      return interpolatePoint(previous, current, (targetDistanceM - traversed) / length);
    }
    traversed += length;
  }
  return points[points.length - 1] ? clonePoint(points[points.length - 1]!) : null;
}

function sourceSegmentIndexForDistance(distances: readonly number[], distanceM: number): number | undefined {
  for (let index = 1; index < distances.length; index += 1) {
    if (distanceM <= (distances[index] ?? 0) + 0.000001) return index;
  }
  return distances.length > 1 ? distances.length - 1 : undefined;
}

function normalizedDirection(from: PlumbingPoint3D, to: PlumbingPoint3D): PlumbingPoint3D {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dy, dz);
  if (length <= 0.000001) return { x: 1, y: 0, z: 0 };
  return { x: dx / length, y: dy / length, z: dz / length };
}

function normalizedPlanDirection(from: PlumbingPoint3D, to: PlumbingPoint3D): PlumbingPoint3D {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dz);
  if (length <= 0.000001) return { x: 1, y: 0, z: 0 };
  return { x: dx / length, y: 0, z: dz / length };
}

function reverseDirection(direction: PlumbingPoint3D): PlumbingPoint3D {
  return { x: -direction.x, y: -direction.y, z: -direction.z };
}

function dotPlan(a: PlumbingPoint3D, b: PlumbingPoint3D): number {
  return a.x * b.x + a.z * b.z;
}

function rotatePlanDirection(direction: PlumbingPoint3D, radians: number): PlumbingPoint3D {
  const normalized = normalizedPlanDirection({ x: 0, y: 0, z: 0 }, direction);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: normalized.x * cos - normalized.z * sin,
    y: 0,
    z: normalized.x * sin + normalized.z * cos,
  };
}

function angleBetweenPlanDirections(a: PlumbingPoint3D, b: PlumbingPoint3D): number {
  const mag = Math.hypot(a.x, a.z) * Math.hypot(b.x, b.z);
  if (mag <= 0.000001) return 0;
  const dot = a.x * b.x + a.z * b.z;
  return Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180 / Math.PI;
}

function classifyDBoxInletFitting(angleDeg: number): PlumbingFittingType {
  const angle = Math.abs(angleDeg);
  if (angle < 5) return 'coupling';
  if (angle <= 30) return 'elbow_22_5';
  if (angle <= 60) return 'elbow_45';
  return 'elbow_90_long_sweep';
}

function resolvedIssue(params: Omit<PlumbingValidationIssue, 'id'>): PlumbingValidationIssue {
  return {
    id: `solver-${params.code}-${params.objectId ?? params.objectKind}`,
    ...params,
  };
}

function isSolvedSanitaryRun(run: PlumbingRun): boolean {
  return run.system === 'sanitary' && run.elevationMode === 'under_slab';
}

export function isLegacyAutoSolvedSanitaryCoupling(fitting: PlumbingFitting): boolean {
  return fitting.system === 'sanitary' && fitting.type === 'coupling' && fitting.isAutoGenerated === true;
}

export function isLegacyAutoSolvedCoupler(fitting: PlumbingFitting): boolean {
  return isLegacyAutoSolvedSanitaryCoupling(fitting);
}

function sanitarySlopeInPerFt(run: PlumbingRun): number {
  return run.slopeInPerFt != null && Number.isFinite(run.slopeInPerFt) && run.slopeInPerFt > 0
    ? run.slopeInPerFt
    : ipc2024MinimumDrainageSlopeInPerFt(run.diameterInches);
}

function rotateLocalPoint(point: PlumbingPoint3D, rotationRadians: number): PlumbingPoint3D {
  const radians = Number.isFinite(rotationRadians) ? -rotationRadians : 0;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: point.x * cos - point.z * sin,
    y: point.y,
    z: point.x * sin + point.z * cos,
  };
}

function addPoints(a: PlumbingPoint3D, b: PlumbingPoint3D): PlumbingPoint3D {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function distributionBoxEquipmentForNode(system: PlumbingSystem, nodeId: string): PlumbingEquipment | null {
  return system.equipment.find((equipment) =>
    equipment.equipmentType === 'distribution_box' &&
    equipment.connectionNodeIds.includes(nodeId)) ?? null;
}

function distributionBoxPortWorld(params: {
  portId: 'inlet' | 'outlet';
  equipment: PlumbingEquipment | null;
  nodePosition: PlumbingPoint3D;
  targetY: number;
  elevationDefaults: PlumbingElevationDefaults;
}): { position: PlumbingPoint3D; outwardDirection: PlumbingPoint3D; equipmentId?: string } {
  const localX = params.portId === 'inlet' ? -DBOX_LENGTH_M / 2 : DBOX_LENGTH_M / 2;
  const localDirectionX = params.portId === 'inlet' ? -1 : 1;
  if (!params.equipment) {
    return {
      position: { ...params.nodePosition, y: params.targetY },
      outwardDirection: { x: localDirectionX, y: 0, z: 0 },
    };
  }
  const equipmentPosition = resolvePlumbingEquipmentPosition({
    equipment: params.equipment,
    defaults: params.elevationDefaults,
  });
  const localPort = { x: localX, y: 0, z: 0 };
  const localDirection = { x: localDirectionX, y: 0, z: 0 };
  return {
    position: {
      ...addPoints(equipmentPosition, rotateLocalPoint(localPort, params.equipment.rotationRadians)),
      y: params.targetY,
    },
    outwardDirection: rotateLocalPoint(localDirection, params.equipment.rotationRadians),
    equipmentId: params.equipment.id,
  };
}

function resolvePathElevationsToDownstream(params: {
  points: readonly PlumbingPoint3D[];
  downstreamY: number;
  slopeInPerFt: number;
}): PlumbingPoint3D[] {
  if (params.points.length === 0) return [];
  const planDistances = [0];
  for (let index = 1; index < params.points.length; index += 1) {
    const previous = params.points[index - 1];
    const current = params.points[index];
    planDistances.push((planDistances[index - 1] ?? 0) + (previous && current ? planDistanceMeters(previous, current) : 0));
  }
  const total = planDistances[planDistances.length - 1] ?? 0;
  return params.points.map((point, index) => ({
    x: point.x,
    y: params.downstreamY + (total - (planDistances[index] ?? 0)) * (params.slopeInPerFt / 12),
    z: point.z,
  }));
}

function planDistancePointToSegmentMeters(point: PlumbingPoint3D, start: PlumbingPoint3D, end: PlumbingPoint3D): number {
  const sx = end.x - start.x;
  const sz = end.z - start.z;
  const lengthSq = sx * sx + sz * sz;
  if (lengthSq <= 0.000001) return planDistanceMeters(point, start);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * sx + (point.z - start.z) * sz) / lengthSq));
  const projected = {
    x: start.x + sx * t,
    y: point.y,
    z: start.z + sz * t,
  };
  return planDistanceMeters(point, projected);
}

function distanceAlongPathForPoint(points: readonly PlumbingPoint3D[], point: PlumbingPoint3D): number | null {
  let traversed = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (!previous || !current) continue;
    const segmentLength = distanceMeters(previous, current);
    if (segmentLength <= 0.000001) continue;
    const candidateLength = distanceMeters(previous, point) + distanceMeters(point, current);
    if (Math.abs(candidateLength - segmentLength) <= POINT_TOLERANCE_M) {
      return traversed + distanceMeters(previous, point);
    }
    traversed += segmentLength;
  }
  return null;
}

function mergeCutPoint(cutPoints: CutPoint[], candidate: CutPoint, totalLengthM: number): void {
  const distanceM = Math.max(0, Math.min(totalLengthM, candidate.distanceM));
  const existing = cutPoints.find((cutPoint) => Math.abs(cutPoint.distanceM - distanceM) <= 0.001);
  if (existing) {
    if (candidate.kind === 'coupler' && existing.kind !== 'coupler') return;
    Object.assign(existing, { ...candidate, distanceM });
    return;
  }
  cutPoints.push({ ...candidate, distanceM });
}

function fittingCutPointsForRun(params: {
  system: PlumbingSystem;
  run: PlumbingRun;
  points: readonly PlumbingPoint3D[];
}): CutPoint[] {
  return (params.system.fittings ?? [])
    .filter((fitting) =>
      fitting.connectedRunIds.includes(params.run.id) &&
      !isLegacyAutoSolvedCoupler(fitting))
    .map((fitting) => {
      const node = params.system.nodes.find((candidate) => candidate.id === fitting.nodeId);
      if (!node) return null;
      const distanceM = distanceAlongPathForPoint(params.points, node.position);
      if (distanceM == null) return null;
      const point = pointAtPathDistance(params.points, distanceM);
      if (!point) return null;
      return {
        distanceM,
        point,
        role: 'fitting-port' as const,
        kind: 'manual-fitting' as const,
        fittingId: fitting.id,
      };
    })
    .filter((cutPoint): cutPoint is CutPoint => Boolean(cutPoint));
}

function portForPieceAtPosition(piece: SolvedPipePiece, position: PlumbingPoint3D, index: number): SolvedFittingPort {
  const startDistance = distanceMeters(piece.start, position);
  const endDistance = distanceMeters(piece.end, position);
  const otherPoint = startDistance <= endDistance ? piece.end : piece.start;
  return {
    id: `port-${index + 1}`,
    pipePieceId: piece.id,
    center: clonePoint(position),
    direction: normalizedDirection(position, otherPoint),
    diameterInches: piece.diameterInches,
  };
}

function adjustedWyeBranchDirection(mainPorts: readonly SolvedFittingPort[], rawBranch: SolvedFittingPort): PlumbingPoint3D {
  if (Math.abs(rawBranch.direction.y) > 0.45) {
    return normalizedDirection({ x: 0, y: 0, z: 0 }, rawBranch.direction);
  }
  const raw = normalizedPlanDirection({ x: 0, y: 0, z: 0 }, rawBranch.direction);
  const bestMainDot = Math.max(
    ...mainPorts.map((port) => Math.abs(dotPlan(raw, normalizedPlanDirection({ x: 0, y: 0, z: 0 }, port.direction)))),
  );
  if (bestMainDot > 0.35 && bestMainDot < 0.9) return raw;
  const candidates = mainPorts.flatMap((port) => {
    const main = normalizedPlanDirection({ x: 0, y: 0, z: 0 }, port.direction);
    return [
      rotatePlanDirection(main, Math.PI / 4),
      rotatePlanDirection(main, -Math.PI / 4),
    ];
  });
  return candidates.sort((a, b) => dotPlan(b, raw) - dotPlan(a, raw))[0] ?? raw;
}

function portsForIntentFitting(params: {
  fitting: PlumbingFitting;
  pieces: readonly SolvedPipePiece[];
  position: PlumbingPoint3D;
}): SolvedFittingPort[] {
  const ports = params.pieces.map((piece, index) => portForPieceAtPosition(piece, params.position, index));
  if ((params.fitting.type !== 'wye' && params.fitting.type !== 'combo_wye_45') || ports.length < 3) {
    return ports;
  }

  let mainPair: [number, number] | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let a = 0; a < ports.length; a += 1) {
    for (let b = a + 1; b < ports.length; b += 1) {
      const first = ports[a]!;
      const second = ports[b]!;
      const firstDiameter = first.diameterInches ?? params.fitting.diameterInches ?? 0;
      const secondDiameter = second.diameterInches ?? params.fitting.diameterInches ?? 0;
      const opposition = -dotPlan(
        normalizedPlanDirection({ x: 0, y: 0, z: 0 }, first.direction),
        normalizedPlanDirection({ x: 0, y: 0, z: 0 }, second.direction),
      );
      const score = opposition * 10 + firstDiameter + secondDiameter;
      if (score > bestScore) {
        bestScore = score;
        mainPair = [a, b];
      }
    }
  }

  if (!mainPair) return ports;
  const mainIndexes = new Set(mainPair);
  const branchIndex = ports.findIndex((_port, index) => !mainIndexes.has(index));
  if (branchIndex < 0) return ports;

  const runIn = {
    ...ports[mainPair[0]]!,
    id: 'run_in',
    diameterInches: params.fitting.diameterInches ?? ports[mainPair[0]]!.diameterInches,
  };
  const runOut = {
    ...ports[mainPair[1]]!,
    id: 'run_out',
    diameterInches: params.fitting.diameterInches ?? ports[mainPair[1]]!.diameterInches,
  };
  const branch = {
    ...ports[branchIndex]!,
    id: 'branch',
    direction: adjustedWyeBranchDirection([runIn, runOut], ports[branchIndex]!),
    diameterInches: params.fitting.secondaryDiameterInches ?? ports[branchIndex]!.diameterInches,
  };
  const extraPorts = ports
    .filter((_port, index) => !mainIndexes.has(index) && index !== branchIndex)
    .map((port, index) => ({ ...port, id: `extra-${index + 1}` }));
  return [runIn, runOut, branch, ...extraPorts];
}

function closestEndpointToPoint(piece: SolvedPipePiece, point: PlumbingPoint3D): {
  point: PlumbingPoint3D;
  otherPoint: PlumbingPoint3D;
  distanceM: number;
} {
  const startDistance = distanceMeters(piece.start, point);
  const endDistance = distanceMeters(piece.end, point);
  return startDistance <= endDistance
    ? { point: piece.start, otherPoint: piece.end, distanceM: startDistance }
    : { point: piece.end, otherPoint: piece.start, distanceM: endDistance };
}

export function isRenderableSolvedCoupling(
  fitting: SolvedPlumbingFitting,
  pieceById: Map<string, SolvedPipePiece>,
): boolean {
  if (fitting.type !== 'coupling') return true;
  if (fitting.connectedPipePieceIds.length !== 2) return false;
  const uniquePieceIds = new Set(fitting.connectedPipePieceIds);
  if (uniquePieceIds.size !== 2) return false;
  const first = pieceById.get(fitting.connectedPipePieceIds[0]!);
  const second = pieceById.get(fitting.connectedPipePieceIds[1]!);
  if (!first || !second) return false;

  const firstEndpoint = closestEndpointToPoint(first, fitting.position);
  const secondEndpoint = closestEndpointToPoint(second, fitting.position);
  if (firstEndpoint.distanceM > POINT_TOLERANCE_M || secondEndpoint.distanceM > POINT_TOLERANCE_M) return false;
  if (distanceMeters(firstEndpoint.point, secondEndpoint.point) > POINT_TOLERANCE_M) return false;
  if (distanceMeters(firstEndpoint.point, fitting.position) > POINT_TOLERANCE_M) return false;

  const firstDirection = normalizedDirection(fitting.position, firstEndpoint.otherPoint);
  const secondDirection = normalizedDirection(fitting.position, secondEndpoint.otherPoint);
  const dot = firstDirection.x * secondDirection.x +
    firstDirection.y * secondDirection.y +
    firstDirection.z * secondDirection.z;
  return dot <= -0.9;
}

export function getRenderableSolvedPlumbingFittings(model: SolvedPlumbingModel): SolvedPlumbingFitting[] {
  const pieceById = new Map(model.pipePieces.map((piece) => [piece.id, piece]));
  return model.fittings.filter((fitting) => isRenderableSolvedCoupling(fitting, pieceById));
}

function addPiecesForPath(params: {
  run: PlumbingRun;
  points: readonly PlumbingPoint3D[];
  startRole: SolvedPipeEndpointRole;
  endRole: SolvedPipeEndpointRole;
  pipePieces: SolvedPipePiece[];
  fittingCutPoints?: readonly CutPoint[];
  pieceIdPrefix?: string;
  firstPieceIndex?: number;
  forceSinglePieceId?: string;
  addCouplers?: boolean;
}): AddedPathResult {
  const totalLengthM = pathLengthMeters(params.points);
  if (params.points.length < 2 || totalLengthM <= 0.000001) return { pieceIds: [], couplerFittings: [] };

  const distances = pathDistances(params.points);
  const cutPoints: CutPoint[] = [
    {
      distanceM: 0,
      point: clonePoint(params.points[0]!),
      role: params.startRole,
      kind: 'endpoint',
    },
    {
      distanceM: totalLengthM,
      point: clonePoint(params.points[params.points.length - 1]!),
      role: params.endRole,
      kind: 'endpoint',
    },
  ];

  for (let index = 1; index < params.points.length - 1; index += 1) {
    const point = params.points[index];
    const distanceM = distances[index];
    if (!point || distanceM == null) continue;
    mergeCutPoint(cutPoints, {
      distanceM,
      point: clonePoint(point),
      role: 'fitting-port',
      kind: 'vertex',
    }, totalLengthM);
  }

  (params.fittingCutPoints ?? []).forEach((cutPoint) => mergeCutPoint(cutPoints, cutPoint, totalLengthM));

  const protectedDistancesFt = cutPoints
    .filter((cutPoint) => cutPoint.distanceM > 0.001 && cutPoint.distanceM < totalLengthM - 0.001 && cutPoint.kind !== 'coupler')
    .map((cutPoint) => cutPoint.distanceM * FEET_PER_METER);
  const couplerDistancesM = params.addCouplers === false ||
    params.run.stockLengthKind !== 'stick' ||
    !Number.isFinite(params.run.stockLengthFt) ||
    params.run.stockLengthFt <= 0
    ? []
    : solveCouplerSplitDistances({
      runLengthFt: totalLengthM * FEET_PER_METER,
      stickLengthFt: params.run.stockLengthFt,
      protectedDistancesFt,
    }).map((distance) => distance * METERS_PER_FOOT);

  couplerDistancesM.forEach((distanceM, index) => {
    const point = pointAtPathDistance(params.points, distanceM);
    if (!point) return;
    mergeCutPoint(cutPoints, {
      distanceM,
      point,
      role: 'coupler',
      kind: 'coupler',
      couplerIndex: index,
    }, totalLengthM);
  });

  cutPoints.sort((a, b) => a.distanceM - b.distanceM);
  const pieceIds: string[] = [];
  const pieceByAdjacentCutIndex = new Map<number, SolvedPipePiece>();
  let pieceIndex = params.firstPieceIndex ?? 0;

  for (let index = 1; index < cutPoints.length; index += 1) {
    const start = cutPoints[index - 1]!;
    const end = cutPoints[index]!;
    const lengthM = distanceMeters(start.point, end.point);
    if (lengthM <= 0.000001) continue;
    const pieceId = params.forceSinglePieceId && cutPoints.length === 2
      ? params.forceSinglePieceId
      : `${params.pieceIdPrefix ?? params.run.id}:piece:${pieceIndex}`;
    const piece: SolvedPipePiece = {
      id: pieceId,
      sourceRunId: params.run.id,
      sourceSegmentIndex: sourceSegmentIndexForDistance(distances, start.distanceM),
      start: clonePoint(start.point),
      end: clonePoint(end.point),
      startRole: start.role,
      endRole: end.role,
      diameterInches: params.run.diameterInches,
      material: params.run.material,
      schedule: params.run.schedule,
      slopeInPerFt: params.run.slopeInPerFt,
      elevationMode: params.run.elevationMode,
      lengthFt: lengthM * FEET_PER_METER,
    };
    params.pipePieces.push(piece);
    pieceIds.push(piece.id);
    pieceByAdjacentCutIndex.set(index - 1, piece);
    pieceIndex += 1;
  }

  const couplerFittings = cutPoints
    .map((cutPoint, index) => ({ cutPoint, index }))
    .filter(({ cutPoint }) => cutPoint.kind === 'coupler')
    .map(({ cutPoint, index }) => {
      const beforePiece = pieceByAdjacentCutIndex.get(index - 1);
      const afterPiece = pieceByAdjacentCutIndex.get(index);
      const connected = [beforePiece, afterPiece].filter((piece): piece is SolvedPipePiece => Boolean(piece));
      return {
        id: `${params.run.id}:coupler:${cutPoint.couplerIndex ?? index}`,
        sourceRunId: params.run.id,
        type: 'coupling' as const,
        system: params.run.system,
        position: clonePoint(cutPoint.point),
        diameterInches: params.run.diameterInches,
        material: params.run.material,
        schedule: params.run.schedule,
        ports: connected.map((piece, portIndex) => portForPieceAtPosition(piece, cutPoint.point, portIndex)),
        connectedPipePieceIds: connected.map((piece) => piece.id),
        isAutoSolved: true,
      };
    });

  return { pieceIds, couplerFittings };
}

function isAlreadyNormalizedDBoxStubRun(system: PlumbingSystem, run: PlumbingRun): boolean {
  if (run.id.includes('inlet-stub-run')) return true;
  return (system.fittings ?? []).some((fitting) =>
    fitting.connectedRunIds.includes(run.id) &&
    fitting.connectedRunIds.some((runId) => runId !== run.id) &&
    fitting.isAutoGenerated &&
    fitting.id.includes('inlet'));
}

function addEquipmentConnection(params: {
  model: SolvedPlumbingModel;
  equipmentId?: string;
  equipmentNodeId: string;
  sourceRunId: string;
  portId: string;
  position: PlumbingPoint3D;
  connectedPipePieceIds: string[];
}): void {
  if (!params.equipmentId) return;
  params.model.equipment.push({
    id: `${params.equipmentId}:${params.portId}:${params.sourceRunId}`,
    equipmentId: params.equipmentId,
    equipmentNodeId: params.equipmentNodeId,
    portId: params.portId,
    position: clonePoint(params.position),
    connectedPipePieceIds: [...params.connectedPipePieceIds],
  });
}

function addSolvedDBoxRun(params: {
  system: PlumbingSystem;
  run: PlumbingRun;
  dboxNodeId: string;
  resolvedPoints: readonly PlumbingPoint3D[];
  model: SolvedPlumbingModel;
  elevationDefaults: PlumbingElevationDefaults;
}): void {
  const dboxNode = params.system.nodes.find((node) => node.id === params.dboxNodeId);
  if (!dboxNode || params.resolvedPoints.length < 2) return;
  const downstreamPoint = params.resolvedPoints[params.resolvedPoints.length - 1]!;
  const equipment = distributionBoxEquipmentForNode(params.system, dboxNode.id);
  const port = distributionBoxPortWorld({
    portId: 'inlet',
    equipment,
    nodePosition: dboxNode.position,
    targetY: downstreamPoint.y,
    elevationDefaults: params.elevationDefaults,
  });
  const slope = sanitarySlopeInPerFt(params.run);

  if (isAlreadyNormalizedDBoxStubRun(params.system, params.run)) {
    const startPoint = params.resolvedPoints[0]!;
    const stubPoints = resolvePathElevationsToDownstream({
      points: [startPoint, port.position],
      downstreamY: port.position.y,
      slopeInPerFt: slope,
    });
    const pieceResult = addPiecesForPath({
      run: params.run,
      points: stubPoints,
      startRole: 'fitting-port',
      endRole: 'd-box-inlet',
      pipePieces: params.model.pipePieces,
      forceSinglePieceId: `${params.run.id}:dbox-inlet-stub`,
      addCouplers: false,
    });
    addEquipmentConnection({
      model: params.model,
      equipmentId: port.equipmentId,
      equipmentNodeId: dboxNode.id,
      sourceRunId: params.run.id,
      portId: 'inlet',
      position: port.position,
      connectedPipePieceIds: pieceResult.pieceIds,
    });
    return;
  }

  const diameterM = params.run.diameterInches != null && Number.isFinite(params.run.diameterInches)
    ? params.run.diameterInches * 0.0254
    : 4 * 0.0254;
  const stubLengthM = Math.max(diameterM * 4, 0.35);
  const fittingPoint: PlumbingPoint3D = {
    x: port.position.x + port.outwardDirection.x * stubLengthM,
    y: port.position.y + stubLengthM * (slope / 12),
    z: port.position.z + port.outwardDirection.z * stubLengthM,
  };
  const approachPlanPoints = [
    ...params.resolvedPoints.slice(0, -1).map((point) => ({ x: point.x, y: point.y, z: point.z })),
    fittingPoint,
  ];
  const approachPoints = resolvePathElevationsToDownstream({
    points: approachPlanPoints,
    downstreamY: fittingPoint.y,
    slopeInPerFt: slope,
  });
  const approachCutPoints = fittingCutPointsForRun({
    system: params.system,
    run: params.run,
    points: approachPoints,
  });
  const approachResult = addPiecesForPath({
    run: params.run,
    points: approachPoints,
    startRole: 'raw-run-start',
    endRole: 'fitting-port',
    pipePieces: params.model.pipePieces,
    fittingCutPoints: approachCutPoints,
    addCouplers: true,
  });
  params.model.fittings.push(...approachResult.couplerFittings);

  const stubPoints = resolvePathElevationsToDownstream({
    points: [fittingPoint, port.position],
    downstreamY: port.position.y,
    slopeInPerFt: slope,
  });
  const stubResult = addPiecesForPath({
    run: params.run,
    points: stubPoints,
    startRole: 'fitting-port',
    endRole: 'd-box-inlet',
    pipePieces: params.model.pipePieces,
    forceSinglePieceId: `${params.run.id}:dbox-inlet-stub`,
    addCouplers: false,
  });

  const approachPiece = approachResult.pieceIds.length > 0
    ? params.model.pipePieces.find((piece) => piece.id === approachResult.pieceIds[approachResult.pieceIds.length - 1])
    : null;
  const stubPiece = stubResult.pieceIds.length > 0
    ? params.model.pipePieces.find((piece) => piece.id === stubResult.pieceIds[0])
    : null;
  const incomingDirection = approachPiece
    ? normalizedPlanDirection(fittingPoint, approachPiece.start)
    : reverseDirection(port.outwardDirection);
  const outletDirection = normalizedPlanDirection(fittingPoint, port.position);
  const fittingType = classifyDBoxInletFitting(angleBetweenPlanDirections(incomingDirection, outletDirection));
  const connectedPieces = [approachPiece, stubPiece].filter((piece): piece is SolvedPipePiece => Boolean(piece));
  params.model.fittings.push({
    id: `${params.run.id}:dbox-inlet-fitting`,
    sourceRunId: params.run.id,
    type: fittingType,
    system: 'sanitary',
    position: clonePoint(fittingPoint),
    diameterInches: params.run.diameterInches,
    material: params.run.material,
    schedule: params.run.schedule,
    ports: connectedPieces.map((piece, index) => portForPieceAtPosition(piece, fittingPoint, index)),
    connectedPipePieceIds: connectedPieces.map((piece) => piece.id),
    isAutoSolved: true,
  });

  addEquipmentConnection({
    model: params.model,
    equipmentId: port.equipmentId,
    equipmentNodeId: dboxNode.id,
    sourceRunId: params.run.id,
    portId: 'inlet',
    position: port.position,
    connectedPipePieceIds: stubResult.pieceIds,
  });
}

function addSolvedDBoxOutletRun(params: {
  system: PlumbingSystem;
  run: PlumbingRun;
  dboxNodeId: string;
  resolvedPoints: readonly PlumbingPoint3D[];
  model: SolvedPlumbingModel;
  elevationDefaults: PlumbingElevationDefaults;
}): void {
  const dboxNode = params.system.nodes.find((node) => node.id === params.dboxNodeId);
  if (!dboxNode || params.resolvedPoints.length < 2) return;
  const equipment = distributionBoxEquipmentForNode(params.system, dboxNode.id);
  const port = distributionBoxPortWorld({
    portId: 'outlet',
    equipment,
    nodePosition: dboxNode.position,
    targetY: params.resolvedPoints[0]!.y,
    elevationDefaults: params.elevationDefaults,
  });
  const downstreamPoint = params.resolvedPoints[params.resolvedPoints.length - 1]!;
  const outletPath = resolvePathElevationsToDownstream({
    points: [port.position, ...params.resolvedPoints.slice(1)],
    downstreamY: downstreamPoint.y,
    slopeInPerFt: sanitarySlopeInPerFt(params.run),
  });
  const fittingCutPoints = fittingCutPointsForRun({
    system: params.system,
    run: params.run,
    points: outletPath,
  });
  const result = addPiecesForPath({
    run: params.run,
    points: outletPath,
    startRole: 'd-box-outlet',
    endRole: 'raw-run-end',
    pipePieces: params.model.pipePieces,
    fittingCutPoints,
    addCouplers: true,
  });
  params.model.fittings.push(...result.couplerFittings);
  addEquipmentConnection({
    model: params.model,
    equipmentId: port.equipmentId,
    equipmentNodeId: dboxNode.id,
    sourceRunId: params.run.id,
    portId: 'outlet',
    position: outletPath[0] ?? port.position,
    connectedPipePieceIds: result.pieceIds.slice(0, 1),
  });
}

function addSolvedNormalRun(params: {
  system: PlumbingSystem;
  run: PlumbingRun;
  points: readonly PlumbingPoint3D[];
  model: SolvedPlumbingModel;
}): void {
  const fittingCutPoints = fittingCutPointsForRun({
    system: params.system,
    run: params.run,
    points: params.points,
  });
  const result = addPiecesForPath({
    run: params.run,
    points: params.points,
    startRole: 'raw-run-start',
    endRole: 'raw-run-end',
    pipePieces: params.model.pipePieces,
    fittingCutPoints,
    addCouplers: true,
  });
  params.model.fittings.push(...result.couplerFittings);
}

function piecesConnectedToFitting(params: {
  pieces: readonly SolvedPipePiece[];
  fitting: PlumbingFitting;
  position: PlumbingPoint3D;
}): SolvedPipePiece[] {
  const connectedRunIds = new Set(params.fitting.connectedRunIds);
  const endpointMatches = params.pieces.filter((piece) =>
    connectedRunIds.has(piece.sourceRunId) &&
    (planDistanceMeters(piece.start, params.position) <= POINT_TOLERANCE_M ||
      planDistanceMeters(piece.end, params.position) <= POINT_TOLERANCE_M));
  if (endpointMatches.length > 0) return endpointMatches;
  return params.pieces.filter((piece) =>
    connectedRunIds.has(piece.sourceRunId) &&
    planDistancePointToSegmentMeters(params.position, piece.start, piece.end) <= POINT_TOLERANCE_M);
}

function solvedPositionForFitting(position: PlumbingPoint3D, pieces: readonly SolvedPipePiece[]): PlumbingPoint3D {
  const endpoint = pieces
    .flatMap((piece) => [piece.start, piece.end])
    .find((point) => planDistanceMeters(point, position) <= POINT_TOLERANCE_M);
  if (endpoint) return clonePoint(endpoint);
  return clonePoint(position);
}

function addCompatibleIntentFittings(params: {
  system: PlumbingSystem;
  model: SolvedPlumbingModel;
  solvedRunIds: Set<string>;
}): void {
  (params.system.fittings ?? []).forEach((fitting) => {
    const touchesSolvedRun = fitting.connectedRunIds.some((runId) => params.solvedRunIds.has(runId));
    if (!touchesSolvedRun) return;
    if (isLegacyAutoSolvedSanitaryCoupling(fitting)) {
      params.model.consumedPersistedFittingIds.add(fitting.id);
      return;
    }
    const node = params.system.nodes.find((candidate) => candidate.id === fitting.nodeId);
    if (!node) {
      if (fitting.system === 'sanitary' && !fitting.isAutoGenerated) {
        params.model.consumedPersistedFittingIds.add(fitting.id);
      }
      return;
    }
    const connectedPieces = piecesConnectedToFitting({
      pieces: params.model.pipePieces,
      fitting,
      position: node.position,
    });
    if (connectedPieces.length === 0) {
      if (!fitting.isAutoGenerated) {
        if (fitting.system === 'sanitary') {
          params.model.consumedPersistedFittingIds.add(fitting.id);
        }
        params.model.validationIssues.push(resolvedIssue({
          severity: 'warning',
          code: 'manual_fitting_not_on_solved_route',
          objectKind: 'fitting',
          objectId: fitting.id,
          message: 'Manual fitting is not compatible with the solved sanitary route.',
        }));
      }
      return;
    }
    if (fitting.system === 'sanitary') {
      params.model.consumedPersistedFittingIds.add(fitting.id);
    }
    const position = solvedPositionForFitting(node.position, connectedPieces);
    params.model.fittings.push({
      id: fitting.id,
      sourceFittingId: fitting.id,
      type: fitting.type,
      system: fitting.system,
      position,
      diameterInches: fitting.diameterInches,
      secondaryDiameterInches: fitting.secondaryDiameterInches,
      material: fitting.material,
      schedule: fitting.schedule,
      ports: portsForIntentFitting({ fitting, pieces: connectedPieces, position }),
      connectedPipePieceIds: connectedPieces.map((piece) => piece.id),
      isAutoSolved: fitting.isAutoGenerated,
    });
  });
}

function validateSolvedModel(model: SolvedPlumbingModel, system: PlumbingSystem): void {
  const pieceById = new Map(model.pipePieces.map((piece) => [piece.id, piece]));

  model.pipePieces.forEach((piece) => {
    if (piece.lengthFt <= 0 || !Number.isFinite(piece.lengthFt)) {
      model.validationIssues.push(resolvedIssue({
        severity: 'warning',
        code: 'solved_pipe_endpoint_missing',
        objectKind: 'run',
        objectId: piece.sourceRunId,
        message: 'Solved pipe piece has invalid endpoints.',
      }));
    }
    if (
      piece.slopeInPerFt != null &&
      Number.isFinite(piece.slopeInPerFt) &&
      piece.slopeInPerFt < ipc2024MinimumDrainageSlopeInPerFt(piece.diameterInches)
    ) {
      model.validationIssues.push(resolvedIssue({
        severity: 'warning',
        code: 'sanitary_drain_path_slope_below_ipc',
        objectKind: 'run',
        objectId: piece.sourceRunId,
        message: `Solved sanitary pipe slope is below the IPC 2024 minimum for ${piece.diameterInches ?? 'unknown'} in. pipe.`,
      }));
    }
  });

  model.fittings
    .filter((fitting) => fitting.type === 'coupling')
    .forEach((fitting) => {
      const connected = fitting.connectedPipePieceIds
        .map((id) => model.pipePieces.find((piece) => piece.id === id))
        .filter((piece): piece is SolvedPipePiece => Boolean(piece));
      if (fitting.sourceRunId && connected.some((piece) => piece.lengthFt < 4 / 12 - 0.001)) {
        model.validationIssues.push(resolvedIssue({
          severity: 'warning',
          code: 'solved_coupler_min_stub_violation',
          objectKind: 'run',
          objectId: fitting.sourceRunId,
          message: 'Solved coupling leaves less than 4 in. of pipe on one side.',
        }));
      }
      if (!isRenderableSolvedCoupling(fitting, pieceById)) {
        model.validationIssues.push(resolvedIssue({
          severity: 'warning',
          code: 'solved_coupling_not_contiguous',
          objectKind: fitting.sourceFittingId ? 'fitting' : 'run',
          objectId: fitting.sourceFittingId ?? fitting.sourceRunId,
          message: 'Solved coupling does not connect two contiguous pipe piece endpoints.',
        }));
      }
    });

  const distributionBoxNodeIds = new Set(
    system.nodes
      .filter((node) => node.kind === 'distribution_box' && node.system === 'sanitary')
      .map((node) => node.id),
  );
  system.runs
    .filter((run) => isSolvedSanitaryRun(run) && distributionBoxNodeIds.has(run.endNodeId))
    .forEach((run) => {
      if (!model.pipePieces.some((piece) => piece.sourceRunId === run.id && piece.endRole === 'd-box-inlet')) {
        model.validationIssues.push(resolvedIssue({
          severity: 'warning',
          code: 'solved_dbox_inlet_not_port_aligned',
          objectKind: 'run',
          objectId: run.id,
          message: 'Sanitary run ending at a distribution box was not solved to the D-box inlet port.',
        }));
      }
    });
}

export function solvePlumbingModel(
  system: PlumbingSystem,
  options: SolverOptions = {},
): SolvedPlumbingModel {
  const elevationDefaults: PlumbingElevationDefaults = {
    ...defaultPlumbingElevationDefaults,
    ...(options.elevationDefaults ?? {}),
  };
  const model: SolvedPlumbingModel = {
    pipePieces: [],
    fittings: [],
    fixtures: [],
    equipment: [],
    validationIssues: [],
    consumedPersistedFittingIds: new Set<string>(),
  };
  const solvedRunIds = new Set<string>();

  system.runs.forEach((run) => {
    if (!isSolvedSanitaryRun(run)) return;
    solvedRunIds.add(run.id);
    const resolved = resolvePlumbingRunPath({ system, run, defaults: elevationDefaults });
    const dboxEndNode = system.nodes.find((node) => node.id === run.endNodeId && node.kind === 'distribution_box');
    if (dboxEndNode) {
      addSolvedDBoxRun({
        system,
        run,
        dboxNodeId: dboxEndNode.id,
        resolvedPoints: resolved.points,
        model,
        elevationDefaults,
      });
      return;
    }
    const dboxStartNode = system.nodes.find((node) => node.id === run.startNodeId && node.kind === 'distribution_box');
    if (dboxStartNode) {
      addSolvedDBoxOutletRun({
        system,
        run,
        dboxNodeId: dboxStartNode.id,
        resolvedPoints: resolved.points,
        model,
        elevationDefaults,
      });
      return;
    }
    addSolvedNormalRun({
      system,
      run,
      points: resolved.points,
      model,
    });
  });

  addCompatibleIntentFittings({ system, model, solvedRunIds });
  validateSolvedModel(model, system);
  return model;
}
