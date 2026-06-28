import {
  fittingDefinition,
} from './plumbingFittingCompatibility';
import type { PlumbingFitting, PlumbingFittingType } from '../plumbingFittingTypes';
import type {
  PlumbingElevationMode,
  PlumbingMaterial,
  PlumbingNode,
  PlumbingPoint3D,
  PlumbingRun,
  PlumbingRunSystem,
  PlumbingSystem,
} from '../plumbingTypes';

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function pointsNearlyEqual(a: PlumbingPoint3D, b: PlumbingPoint3D): boolean {
  return Math.hypot(a.x - b.x, a.z - b.z) <= 0.01;
}

function angleBetween(a: PlumbingPoint3D, b: PlumbingPoint3D, c: PlumbingPoint3D): number {
  const v1 = { x: a.x - b.x, z: a.z - b.z };
  const v2 = { x: c.x - b.x, z: c.z - b.z };
  const dot = v1.x * v2.x + v1.z * v2.z;
  const mag = Math.hypot(v1.x, v1.z) * Math.hypot(v2.x, v2.z);
  if (mag <= 0) return 180;
  return Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180 / Math.PI;
}

function distance3d(a: PlumbingPoint3D, b: PlumbingPoint3D): number {
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
}

function interpolatePoint(a: PlumbingPoint3D, b: PlumbingPoint3D, t: number): PlumbingPoint3D {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

function pathLength(points: readonly PlumbingPoint3D[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (previous && current) total += distance3d(previous, current);
  }
  return total;
}

function pointAtPathDistance(points: readonly PlumbingPoint3D[], targetDistance: number): PlumbingPoint3D | null {
  let traversed = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (!previous || !current) continue;
    const segmentLength = distance3d(previous, current);
    if (segmentLength <= 0.0001) continue;
    if (traversed + segmentLength >= targetDistance) {
      return interpolatePoint(previous, current, (targetDistance - traversed) / segmentLength);
    }
    traversed += segmentLength;
  }
  return null;
}

const METERS_PER_FOOT = 0.3048;
export const MIN_PIPE_STUB_AFTER_COUPLER_FT = 4 / 12;

function pathVertexDistances(points: readonly PlumbingPoint3D[]): number[] {
  const distances: number[] = [];
  let traversed = 0;
  points.forEach((point, index) => {
    if (index === 0) {
      distances.push(0);
      return;
    }
    const previous = points[index - 1];
    if (previous) traversed += distance3d(previous, point);
    distances.push(traversed);
  });
  return distances;
}

export function solveCouplerSplitDistances(params: {
  runLengthFt: number;
  stickLengthFt: number;
  protectedDistancesFt?: readonly number[];
  minStubFt?: number;
}): number[] {
  const minStubFt = params.minStubFt ?? MIN_PIPE_STUB_AFTER_COUPLER_FT;
  if (
    !Number.isFinite(params.runLengthFt) ||
    !Number.isFinite(params.stickLengthFt) ||
    !Number.isFinite(minStubFt) ||
    params.runLengthFt <= params.stickLengthFt ||
    params.stickLengthFt <= 0 ||
    minStubFt <= 0
  ) {
    return [];
  }

  const protectedDistances = [...(params.protectedDistancesFt ?? []), 0, params.runLengthFt]
    .filter((distance) => Number.isFinite(distance) && distance >= 0 && distance <= params.runLengthFt)
    .sort((a, b) => a - b);
  const splitDistances: number[] = [];

  for (let distance = params.stickLengthFt; distance < params.runLengthFt; distance += params.stickLengthFt) {
    const lowerProtection = Math.max(
      0,
      ...protectedDistances.filter((candidate) => candidate <= distance),
      splitDistances[splitDistances.length - 1] ?? 0,
    );
    const upperProtection = Math.min(
      params.runLengthFt,
      ...protectedDistances.filter((candidate) => candidate >= distance),
    );
    const lowerLimit = lowerProtection + minStubFt;
    const upperLimit = upperProtection - minStubFt;
    if (lowerLimit > upperLimit) continue;
    splitDistances.push(Math.max(lowerLimit, Math.min(distance, upperLimit)));
  }

  return splitDistances;
}

function fittingForBend(system: PlumbingRunSystem, bendDegrees: number): PlumbingFittingType {
  const turn = Math.abs(180 - bendDegrees);
  if (Math.abs(turn - 90) <= 15) return system === 'sanitary' ? 'elbow_90_long_sweep' : 'elbow_90';
  if (Math.abs(turn - 45) <= 12) return 'elbow_45';
  if (Math.abs(turn - 22.5) <= 8) return 'elbow_22_5';
  return 'offset_bend';
}

function primaryRunAtNode(runs: PlumbingRun[], nodeId: string): PlumbingRun | null {
  return runs.find((run) => run.startNodeId === nodeId || run.endNodeId === nodeId) ?? null;
}

function fittingForConnectedRuns(runs: PlumbingRun[]): PlumbingFittingType {
  const systems = new Set(runs.map((run) => run.system));
  const system = systems.size === 1 ? runs[0]?.system : null;
  const materials = new Set(runs.map((run) => run.material));
  const diameters = new Set(runs.map((run) => run.diameterInches ?? null));
  if (runs.length >= 3) {
    if (system === 'sanitary' || system === 'vent') return 'wye';
    return diameters.size > 1 ? 'reducing_tee' : 'tee';
  }
  if (materials.size > 1) return 'transition_coupling';
  if (diameters.size > 1) return 'reducing_coupling';
  return 'coupling';
}

function primaryRunForFitting(runs: PlumbingRun[], type: PlumbingFittingType, nodeId: string): PlumbingRun | null {
  if (type === 'wye' || type === 'combo_wye_45' || type === 'reducing_tee') {
    const runsByDiameter = [...runs].sort((a, b) => (b.diameterInches ?? 0) - (a.diameterInches ?? 0));
    return runsByDiameter[0] ?? null;
  }
  return primaryRunAtNode(runs, nodeId);
}

function ensureAutoNode(params: {
  nodes: PlumbingNode[];
  point: PlumbingPoint3D;
  system: PlumbingRunSystem;
  label: string;
}): { nodes: PlumbingNode[]; nodeId: string } {
  const existing = params.nodes.find((node) => node.system === params.system && pointsNearlyEqual(node.position, params.point));
  if (existing) return { nodes: params.nodes, nodeId: existing.id };
  const node: PlumbingNode = {
    id: createId('plumbing-auto-fitting-node'),
    kind: params.label.toLowerCase().includes('wye') ? 'wye' : 'fitting',
    system: params.system,
    position: params.point,
    label: params.label,
  };
  return { nodes: [...params.nodes, node], nodeId: node.id };
}

function makeFitting(params: {
  type: PlumbingFittingType;
  system: PlumbingRunSystem;
  nodeId: string;
  connectedRunIds: string[];
  diameterInches: number | null;
  secondaryDiameterInches?: number | null;
  material: PlumbingMaterial;
  schedule?: PlumbingRun['schedule'];
  elevationMode: PlumbingElevationMode;
  rotationRad?: number;
}): PlumbingFitting {
  return {
    id: createId(`plumbing-fitting-${params.type}`),
    type: params.type,
    system: params.system,
    nodeId: params.nodeId,
    connectedRunIds: params.connectedRunIds,
    diameterInches: params.diameterInches,
    secondaryDiameterInches: params.secondaryDiameterInches,
    material: params.material,
    schedule: params.schedule,
    rotationRad: params.rotationRad ?? 0,
    elevationMode: params.elevationMode,
    labelVisible: true,
    isAutoGenerated: true,
  };
}

function addAutoCouplersToRun(params: {
  run: PlumbingRun;
  nodes: PlumbingNode[];
  autoFittings: PlumbingFitting[];
}): { run: PlumbingRun; nodes: PlumbingNode[]; autoFittings: PlumbingFitting[] } {
  if (params.run.stockLengthKind !== 'stick' || !Number.isFinite(params.run.stockLengthFt) || params.run.stockLengthFt <= 0) {
    return params;
  }
  const stickLengthM = params.run.stockLengthFt * METERS_PER_FOOT;
  const totalLengthM = pathLength(params.run.path);
  if (!Number.isFinite(totalLengthM) || totalLengthM <= stickLengthM) return params;
  const vertexDistancesM = pathVertexDistances(params.run.path);
  const protectedDistancesFt = vertexDistancesM
    .slice(1, -1)
    .map((distance) => distance / METERS_PER_FOOT);
  const couplerPoints: PlumbingPoint3D[] = [];
  const splitDistancesM = solveCouplerSplitDistances({
    runLengthFt: totalLengthM / METERS_PER_FOOT,
    stickLengthFt: params.run.stockLengthFt,
    protectedDistancesFt,
  }).map((distance) => distance * METERS_PER_FOOT);
  for (const distance of splitDistancesM) {
    const point = pointAtPathDistance(params.run.path, distance);
    if (!point) continue;
    couplerPoints.push(point);
  }
  if (couplerPoints.length === 0) return params;
  const nodes = [...params.nodes];
  const autoFittings = [...params.autoFittings];
  couplerPoints.forEach((point) => {
    const ensured = ensureAutoNode({
      nodes,
      point,
      system: params.run.system,
      label: 'Pipe coupling',
    });
    nodes.splice(0, nodes.length, ...ensured.nodes);
    autoFittings.push(makeFitting({
      type: 'coupling',
      system: params.run.system,
      nodeId: ensured.nodeId,
      connectedRunIds: [params.run.id],
      diameterInches: params.run.diameterInches,
      material: params.run.material,
      schedule: params.run.schedule,
      elevationMode: params.run.elevationMode,
    }));
  });
  return {
    run: params.run,
    nodes,
    autoFittings,
  };
}

export function reconcileAutoGeneratedPlumbingFittings(system: PlumbingSystem): PlumbingSystem {
  const manualFittings = (system.fittings ?? []).filter((fitting) => !fitting.isAutoGenerated);
  const preservedGeneratedFittings = (system.fittings ?? []).filter((fitting) =>
    fitting.isAutoGenerated &&
    (fitting.id.includes('plumbing-rough-in-') || fitting.id.includes('distribution-box-node-inlet')));
  let nodes = [...system.nodes];
  let runs = [...system.runs];
  const autoFittings: PlumbingFitting[] = [];

  runs = runs.map((run) => {
    const result = addAutoCouplersToRun({ run, nodes, autoFittings });
    nodes = result.nodes;
    autoFittings.splice(0, autoFittings.length, ...result.autoFittings);
    return result.run;
  });

  runs.forEach((run) => {
    for (let index = 1; index < run.path.length - 1; index += 1) {
      const previous = run.path[index - 1];
      const current = run.path[index];
      const next = run.path[index + 1];
      if (!previous || !current || !next) continue;
      const bendDegrees = angleBetween(previous, current, next);
      if (Math.abs(180 - bendDegrees) < 5) continue;
      const type = fittingForBend(run.system, bendDegrees);
      const definition = fittingDefinition(type);
      const ensured = ensureAutoNode({
        nodes,
        point: current,
        system: run.system,
        label: definition?.label ?? 'Pipe fitting',
      });
      nodes = ensured.nodes;
      autoFittings.push(makeFitting({
        type,
        system: run.system,
        nodeId: ensured.nodeId,
        connectedRunIds: [run.id],
        diameterInches: run.diameterInches,
        material: run.material,
        schedule: run.schedule,
        elevationMode: run.elevationMode,
      }));
    }
  });

  nodes.forEach((node) => {
    const connectedRuns = runs.filter((run) => run.startNodeId === node.id || run.endNodeId === node.id);
    if (connectedRuns.length < 2) return;
    const type = fittingForConnectedRuns(connectedRuns);
    const primaryRun = primaryRunForFitting(connectedRuns, type, node.id);
    if (!primaryRun) return;
    autoFittings.push(makeFitting({
      type,
      system: primaryRun.system,
      nodeId: node.id,
      connectedRunIds: connectedRuns.map((run) => run.id),
      diameterInches: primaryRun.diameterInches,
      secondaryDiameterInches: connectedRuns.find((run) => run.diameterInches !== primaryRun.diameterInches)?.diameterInches,
      material: primaryRun.material,
      schedule: primaryRun.schedule,
      elevationMode: primaryRun.elevationMode,
    }));
  });

  return {
    ...system,
    nodes,
    runs,
    fittings: [...manualFittings, ...preservedGeneratedFittings, ...autoFittings],
  };
}
