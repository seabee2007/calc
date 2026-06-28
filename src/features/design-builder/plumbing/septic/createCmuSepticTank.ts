import { defaultPipeScheduleForMaterial } from '../plumbingDefaults';
import { defaultStockLengthForPipe } from '../domain/plumbingStockLengths';
import type { PlumbingEquipment, PlumbingNode, PlumbingRun, PlumbingSystem } from '../plumbingTypes';
import type { PlumbingFitting, PlumbingFittingType } from '../plumbingFittingTypes';
import {
  IPC_2024_MIN_SEPTIC_SETBACK_FROM_BUILDING_M,
  ipc2024MinimumDrainageSlopeInPerFt,
  minimumDrainageDropMeters,
} from '../domain/ipcDrainageSlope';
import {
  DEFAULT_SEPTIC_CONSTRUCTION,
  defaultCmuSepticGeometry,
  defaultSepticDesignBasis,
  defaultSmallHouseCmuSepticTankPreset,
} from './septicDefaults';
import { localToWorld, sideLocalPoint } from './septicGeometry';
import type { SepticPoint2D } from './septicGeometry';
import type { SepticCodeProfileId, SepticTankModel, SepticTankSide } from './septicTypes';

function createId(prefix: string, seed?: string): string {
  return `${prefix}-${seed ?? Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function nextSepticMark(tanks: readonly SepticTankModel[]): string {
  const used = tanks
    .map((tank) => Number(tank.mark.replace(/^ST-/, '')))
    .filter((value) => Number.isFinite(value));
  return `ST-${used.length > 0 ? Math.max(...used) + 1 : 1}`;
}

function polygonBounds(points: readonly SepticPoint2D[]) {
  return points.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      maxX: Math.max(bounds.maxX, point.x),
      minZ: Math.min(bounds.minZ, point.z),
      maxZ: Math.max(bounds.maxZ, point.z),
    }),
    { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity },
  );
}

function boundsCenter(bounds: ReturnType<typeof polygonBounds>): SepticPoint2D {
  return { x: (bounds.minX + bounds.maxX) / 2, z: (bounds.minZ + bounds.maxZ) / 2 };
}

function pushPointOutsideBuildingSetback(
  point: SepticPoint2D,
  buildingFootprint: readonly SepticPoint2D[] | undefined,
  minSetbackM = IPC_2024_MIN_SEPTIC_SETBACK_FROM_BUILDING_M,
): SepticPoint2D {
  if (!buildingFootprint || buildingFootprint.length === 0) return point;
  const bounds = polygonBounds(buildingFootprint);
  const dx = Math.max(0, Math.max(bounds.minX - point.x, point.x - bounds.maxX));
  const dz = Math.max(0, Math.max(bounds.minZ - point.z, point.z - bounds.maxZ));
  const distance = Math.hypot(dx, dz);
  if (distance >= minSetbackM) return point;
  const center = boundsCenter(bounds);
  const direction = { x: point.x - center.x, z: point.z - center.z };
  const directionLength = Math.hypot(direction.x, direction.z);
  const unit = directionLength > 0.0001
    ? { x: direction.x / directionLength, z: direction.z / directionLength }
    : { x: 0, z: 1 };
  const deficit = minSetbackM - distance;
  return {
    x: point.x + unit.x * deficit,
    z: point.z + unit.z * deficit,
  };
}

export function septicTankInletInvertElevation(tank: SepticTankModel): number {
  return tank.placement.topSlabTopElevationM -
    tank.geometry.topSlabThicknessM -
    tank.geometry.freeboardM;
}

export function septicTankOutletInvertElevation(tank: SepticTankModel): number {
  return septicTankInletInvertElevation(tank) - tank.geometry.inletInvertAboveOutletM;
}

function adjustedTankForExistingSanitarySlope(system: PlumbingSystem | undefined, tank: SepticTankModel): SepticTankModel {
  if (!system) return tank;
  const inlet = localToWorld(tank, sideLocalPoint(tank, tank.inletSide));
  const sanitaryNodes = system.nodes.filter((node) =>
    node.system === 'sanitary' &&
    !node.septicTankId &&
    (node.kind === 'building_drain_exit' || node.kind === 'run_tap' || node.kind === 'riser_bottom' || node.kind === 'fixture_connection'),
  );
  const requiredInletElevation = sanitaryNodes.reduce((lowest, node) => {
    const planLengthMeters = Math.hypot(node.position.x - inlet.x, node.position.z - inlet.z);
    const connectedDiameter = system.runs.find((run) =>
      run.system === 'sanitary' && (run.startNodeId === node.id || run.endNodeId === node.id),
    )?.diameterInches ?? 4;
    const fall = minimumDrainageDropMeters({ diameterInches: connectedDiameter, planLengthMeters });
    return Math.min(lowest, node.position.y - fall);
  }, septicTankInletInvertElevation(tank));
  const currentInletElevation = septicTankInletInvertElevation(tank);
  if (currentInletElevation <= requiredInletElevation) return tank;
  const extraDepth = currentInletElevation - requiredInletElevation;
  return {
    ...tank,
    placement: {
      ...tank.placement,
      burialDepthBelowGradeM: tank.placement.burialDepthBelowGradeM + extraDepth,
      topSlabTopElevationM: tank.placement.topSlabTopElevationM - extraDepth,
    },
  };
}

function distributionBoxPointForTank(tank: SepticTankModel, buildingFootprint?: readonly SepticPoint2D[]): SepticPoint2D {
  const inlet = localToWorld(tank, sideLocalPoint(tank, tank.inletSide));
  const buildingCenter = buildingFootprint && buildingFootprint.length > 0
    ? boundsCenter(polygonBounds(buildingFootprint))
    : { x: 0, z: 0 };
  const towardBuilding = { x: buildingCenter.x - inlet.x, z: buildingCenter.z - inlet.z };
  const length = Math.hypot(towardBuilding.x, towardBuilding.z);
  if (length > 0.0001) {
    return {
      x: inlet.x + towardBuilding.x / length * 1.2,
      z: inlet.z + towardBuilding.z / length * 1.2,
    };
  }
  const local = sideLocalPoint(tank, tank.inletSide);
  const localLength = Math.hypot(local.x, local.z);
  const outward = localLength > 0.0001 ? { x: local.x / localLength, z: local.z / localLength } : { x: -1, z: 0 };
  const worldDirection = {
    x: outward.x * Math.cos(tank.placement.rotationRad) - outward.z * Math.sin(tank.placement.rotationRad),
    z: outward.x * Math.sin(tank.placement.rotationRad) + outward.z * Math.cos(tank.placement.rotationRad),
  };
  return {
    x: inlet.x + worldDirection.x * 1.2,
    z: inlet.z + worldDirection.z * 1.2,
  };
}

function createSepticDistributionBox(params: {
  tank: SepticTankModel;
  system: PlumbingSystem;
  buildingFootprint?: readonly SepticPoint2D[];
}): { equipment: PlumbingEquipment; node: PlumbingNode; run: PlumbingRun } {
  const point = distributionBoxPointForTank(params.tank, params.buildingFootprint);
  const inletNodeId = params.tank.connectionNodes.inletNodeId;
  const nodeId = `${params.tank.id}-distribution-box-node`;
  const equipmentId = `${params.tank.id}-distribution-box`;
  const inlet = localToWorld(params.tank, sideLocalPoint(params.tank, params.tank.inletSide));
  const planLengthMeters = Math.max(0.001, Math.hypot(point.x - inlet.x, point.z - inlet.z));
  const slopeInPerFt = ipc2024MinimumDrainageSlopeInPerFt(4);
  const inletY = septicTankInletInvertElevation(params.tank);
  const boxY = inletY + planLengthMeters * (slopeInPerFt / 12);
  const position = { x: point.x, y: boxY, z: point.z };
  const equipment: PlumbingEquipment = {
    id: equipmentId,
    equipmentType: 'distribution_box',
    label: 'D-Box',
    position,
    rotationRadians: params.tank.placement.rotationRad,
    connectionNodeIds: [nodeId],
  };
  const node: PlumbingNode = {
    id: nodeId,
    kind: 'distribution_box',
    system: 'sanitary',
    position,
    equipmentId,
    label: 'Distribution box',
  };
  const stock = defaultStockLengthForPipe({ material: 'pvc', system: 'sanitary' });
  const run: PlumbingRun = {
    id: `${params.tank.id}-distribution-box-to-septic-run`,
    system: 'sanitary',
    startNodeId: nodeId,
    endNodeId: inletNodeId,
    path: [position, { x: inlet.x, y: inletY, z: inlet.z }],
    diameterInches: 4,
    material: 'pvc',
    schedule: defaultPipeScheduleForMaterial('pvc'),
    stockLengthFt: stock.stockLengthFt,
    stockLengthPreset: stock.stockLengthPreset,
    stockLengthKind: stock.stockLengthKind,
    slopeInPerFt,
    elevationMode: 'under_slab',
    labelVisible: true,
  };
  return { equipment, node, run };
}

function canConnectToDistributionBox(node: PlumbingNode): boolean {
  return node.system === 'sanitary' &&
    !node.septicTankId &&
    node.kind !== 'distribution_box' &&
    node.kind !== 'septic_inlet' &&
    node.kind !== 'septic_outlet' &&
    node.kind !== 'septic_access' &&
    node.kind !== 'riser_top';
}

function planUnitVector(from: { x: number; z: number }, to: { x: number; z: number }): { x: number; z: number } {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dz);
  return length > 0.0001 ? { x: dx / length, z: dz / length } : { x: 1, z: 0 };
}

function classifyDBoxInletFitting(angleDeg: number): PlumbingFittingType {
  const angle = Math.abs(angleDeg);
  if (angle < 5) return 'coupling';
  if (angle <= 30) return 'elbow_22_5';
  if (angle <= 60) return 'elbow_45';
  return 'elbow_90_long_sweep';
}

function angleBetweenPlanDirections(a: { x: number; z: number }, b: { x: number; z: number }): number {
  const dot = a.x * b.x + a.z * b.z;
  return Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
}

function findDistributionBoxSourceNode(system: PlumbingSystem, distributionBoxNode: PlumbingNode): PlumbingNode | null {
  const outgoingNodeIds = new Set(system.runs.filter((run) => run.system === 'sanitary').map((run) => run.startNodeId));
  const incomingNodeIds = new Set(system.runs.filter((run) => run.system === 'sanitary').map((run) => run.endNodeId));
  const terminalCandidates = system.nodes.filter((node) =>
    canConnectToDistributionBox(node) &&
    incomingNodeIds.has(node.id) &&
    !outgoingNodeIds.has(node.id),
  );
  const fallbackCandidates = system.nodes.filter((node) => canConnectToDistributionBox(node));
  const candidates = terminalCandidates.length > 0 ? terminalCandidates : fallbackCandidates;
  if (candidates.length === 0) return null;
  return candidates.reduce((best, node) => {
    const bestDistance = Math.hypot(best.position.x - distributionBoxNode.position.x, best.position.z - distributionBoxNode.position.z);
    const distance = Math.hypot(node.position.x - distributionBoxNode.position.x, node.position.z - distributionBoxNode.position.z);
    return distance < bestDistance ? node : best;
  }, candidates[0]!);
}

function createDistributionBoxInletConnection(params: {
  sourceNode: PlumbingNode;
  distributionBoxNode: PlumbingNode;
  septicInletNode?: PlumbingNode | null;
}): { nodes: PlumbingNode[]; runs: PlumbingRun[]; fittings: PlumbingFitting[] } {
  const diameterInches = 4;
  const pipeDiameterM = diameterInches * 0.0254;
  const slopeInPerFt = ipc2024MinimumDrainageSlopeInPerFt(diameterInches);
  const inletAxis = params.septicInletNode
    ? planUnitVector(params.distributionBoxNode.position, params.septicInletNode.position)
    : { x: Math.cos(0), z: Math.sin(0) };
  const stubLengthM = Math.max(pipeDiameterM * 4, 0.35);
  const stubStartPosition = {
    x: params.distributionBoxNode.position.x - inletAxis.x * stubLengthM,
    y: params.distributionBoxNode.position.y + stubLengthM * (slopeInPerFt / 12),
    z: params.distributionBoxNode.position.z - inletAxis.z * stubLengthM,
  };
  const approachLengthMeters = Math.max(
    0.001,
    Math.hypot(
      params.sourceNode.position.x - stubStartPosition.x,
      params.sourceNode.position.z - stubStartPosition.z,
    ),
  );
  const requiredSourceY = stubStartPosition.y + approachLengthMeters * (slopeInPerFt / 12);
  const sourcePosition = {
    ...params.sourceNode.position,
    y: Math.max(params.sourceNode.position.y, requiredSourceY),
  };
  const incomingDirection = planUnitVector(sourcePosition, stubStartPosition);
  const fittingType = classifyDBoxInletFitting(angleBetweenPlanDirections(incomingDirection, inletAxis));
  const fittingNodeId = `${params.distributionBoxNode.id}-inlet-elbow-node`;
  const approachRunId = `${params.distributionBoxNode.id}-inlet-approach-run`;
  const stubRunId = `${params.distributionBoxNode.id}-inlet-stub-run`;
  const stock = defaultStockLengthForPipe({ material: 'pvc', system: 'sanitary' });
  const runBase = {
    system: 'sanitary' as const,
    diameterInches,
    material: 'pvc' as const,
    schedule: defaultPipeScheduleForMaterial('pvc'),
    stockLengthFt: stock.stockLengthFt,
    stockLengthPreset: stock.stockLengthPreset,
    stockLengthKind: stock.stockLengthKind,
    slopeInPerFt,
    elevationMode: 'under_slab' as const,
    labelVisible: true,
  };
  return {
    nodes: [{
      id: fittingNodeId,
      kind: fittingType === 'coupling' ? 'fitting' : 'fitting',
      system: 'sanitary',
      position: stubStartPosition,
      label: fittingType === 'coupling' ? 'D-box inlet coupling' : 'D-box inlet elbow',
    }],
    runs: [
      {
        ...runBase,
        id: approachRunId,
        startNodeId: params.sourceNode.id,
        endNodeId: fittingNodeId,
        path: [sourcePosition, stubStartPosition],
      },
      {
        ...runBase,
        id: stubRunId,
        startNodeId: fittingNodeId,
        endNodeId: params.distributionBoxNode.id,
        path: [stubStartPosition, params.distributionBoxNode.position],
      },
    ],
    fittings: [{
      id: `${params.distributionBoxNode.id}-inlet-${fittingType}`,
      type: fittingType,
      system: 'sanitary',
      nodeId: fittingNodeId,
      connectedRunIds: [approachRunId, stubRunId],
      diameterInches,
      material: 'pvc',
      schedule: defaultPipeScheduleForMaterial('pvc'),
      rotationRad: 0,
      elevationMode: 'under_slab',
      labelVisible: true,
      isAutoGenerated: true,
    }],
  };
}

function createMissingDistributionBoxInletRun(params: {
  system: PlumbingSystem;
  distributionBoxNode: PlumbingNode;
}): { nodes: PlumbingNode[]; runs: PlumbingRun[]; fittings: PlumbingFitting[] } | null {
  const alreadyConnected = params.system.runs.some((run) =>
    run.system === 'sanitary' &&
    run.endNodeId === params.distributionBoxNode.id &&
    run.startNodeId !== params.distributionBoxNode.id,
  );
  if (alreadyConnected) return null;
  const sourceNode = findDistributionBoxSourceNode(params.system, params.distributionBoxNode);
  if (!sourceNode) return null;
  const septicInletRun = params.system.runs.find((run) =>
    run.system === 'sanitary' &&
    run.startNodeId === params.distributionBoxNode.id &&
    params.system.nodes.some((node) => node.id === run.endNodeId && node.kind === 'septic_inlet'));
  const septicInletNode = septicInletRun
    ? params.system.nodes.find((node) => node.id === septicInletRun.endNodeId)
    : null;
  return createDistributionBoxInletConnection({
    sourceNode,
    distributionBoxNode: params.distributionBoxNode,
    septicInletNode,
  });
}

export function ensureSanitaryDrainConnectedToDistributionBox(system: PlumbingSystem): PlumbingSystem {
  const inletConnections = system.nodes
    .filter((node) => node.kind === 'distribution_box' && node.system === 'sanitary')
    .map((distributionBoxNode) => createMissingDistributionBoxInletRun({ system, distributionBoxNode }))
    .filter((connection): connection is { nodes: PlumbingNode[]; runs: PlumbingRun[]; fittings: PlumbingFitting[] } => Boolean(connection));
  return inletConnections.length > 0
    ? {
      ...system,
      nodes: [...system.nodes, ...inletConnections.flatMap((connection) => connection.nodes)],
      runs: [...system.runs, ...inletConnections.flatMap((connection) => connection.runs)],
      fittings: [...(system.fittings ?? []), ...inletConnections.flatMap((connection) => connection.fittings)],
    }
    : system;
}

export function createCmuSepticTank(params: {
  system?: PlumbingSystem;
  centerX: number;
  centerZ: number;
  rotationRad?: number;
  codeProfileId?: SepticCodeProfileId;
  inletSide?: SepticTankSide;
  outletSide?: SepticTankSide;
  buildingFootprint?: readonly SepticPoint2D[];
  idSeed?: string;
  now?: string;
}): SepticTankModel {
  const now = params.now ?? new Date().toISOString();
  const tankId = createId('cmu-septic-tank', params.idSeed);
  const placementPoint = pushPointOutsideBuildingSetback(
    { x: params.centerX, z: params.centerZ },
    params.buildingFootprint,
  );
  const tank: SepticTankModel = {
    id: tankId,
    kind: 'cmu_septic_tank',
    name: defaultSmallHouseCmuSepticTankPreset.name,
    mark: nextSepticMark(params.system?.septicTanks ?? []),
    placement: {
      centerX: placementPoint.x,
      centerZ: placementPoint.z,
      rotationRad: params.rotationRad ?? 0,
      gradeElevationM: 0,
      burialDepthBelowGradeM: 0.3,
      topSlabTopElevationM: -0.3,
    },
    designBasis: defaultSepticDesignBasis(params.codeProfileId ?? 'conceptual'),
    geometry: defaultCmuSepticGeometry(),
    construction: { ...DEFAULT_SEPTIC_CONSTRUCTION },
    connectionNodes: {
      inletNodeId: `${tankId}-inlet-node`,
      outletNodeId: `${tankId}-outlet-node`,
      cleanoutNodeIds: [`${tankId}-access-node-1`, `${tankId}-access-node-2`],
    },
    inletSide: params.inletSide ?? 'west',
    outletSide: params.outletSide ?? 'east',
    labelVisible: true,
    showCutaway3d: true,
    createdAt: now,
    updatedAt: now,
  };
  return adjustedTankForExistingSanitarySlope(params.system, tank);
}

export function createCmuSepticTankNodes(tank: SepticTankModel): PlumbingNode[] {
  const inlet = localToWorld(tank, sideLocalPoint(tank, tank.inletSide));
  const outlet = localToWorld(tank, sideLocalPoint(tank, tank.outletSide));
  const firstAccess = localToWorld(tank, {
    x: -tank.geometry.insideLengthM * 0.18,
    z: 0,
  });
  const secondAccess = localToWorld(tank, {
    x: tank.geometry.insideLengthM * 0.28,
    z: 0,
  });
  return [
    {
      id: tank.connectionNodes.inletNodeId,
      kind: 'septic_inlet',
      system: 'sanitary',
      position: { x: inlet.x, y: septicTankInletInvertElevation(tank), z: inlet.z },
      septicTankId: tank.id,
      label: 'Septic inlet',
    },
    {
      id: tank.connectionNodes.outletNodeId,
      kind: 'septic_outlet',
      system: 'sanitary',
      position: { x: outlet.x, y: septicTankOutletInvertElevation(tank), z: outlet.z },
      septicTankId: tank.id,
      label: 'Future leach field outlet',
    },
    {
      id: tank.connectionNodes.cleanoutNodeIds[0],
      kind: 'septic_access',
      system: 'sanitary',
      position: { x: firstAccess.x, y: tank.placement.topSlabTopElevationM, z: firstAccess.z },
      septicTankId: tank.id,
      label: 'Access opening 1',
    },
    {
      id: tank.connectionNodes.cleanoutNodeIds[1],
      kind: 'septic_access',
      system: 'sanitary',
      position: { x: secondAccess.x, y: tank.placement.topSlabTopElevationM, z: secondAccess.z },
      septicTankId: tank.id,
      label: 'Access opening 2',
    },
  ];
}

export function addCmuSepticTankToPlumbingSystem(params: {
  system: PlumbingSystem;
  centerX: number;
  centerZ: number;
  rotationRad?: number;
  buildingFootprint?: readonly SepticPoint2D[];
  idSeed?: string;
}): { system: PlumbingSystem; tank: SepticTankModel } {
  const tank = createCmuSepticTank({ ...params, system: params.system });
  const nodes = createCmuSepticTankNodes(tank);
  const distributionBox = createSepticDistributionBox({
    tank,
    system: params.system,
    buildingFootprint: params.buildingFootprint,
  });
  const baseSystem: PlumbingSystem = {
    ...params.system,
    septicTanks: [...params.system.septicTanks, tank],
    equipment: [...params.system.equipment, distributionBox.equipment],
    nodes: [...params.system.nodes, ...nodes, distributionBox.node],
    runs: [...params.system.runs, distributionBox.run],
  };
  return {
    tank,
    system: ensureSanitaryDrainConnectedToDistributionBox(baseSystem),
  };
}
