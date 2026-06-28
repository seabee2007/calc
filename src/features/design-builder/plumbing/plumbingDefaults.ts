import { getPlumbingFixtureDefinition } from './plumbingFixtureLibrary';
import type {
  PlumbingFixture,
  PlumbingFixtureScheduleRow,
  PlumbingFixtureType,
  PlumbingMaterial,
  PlumbingPipeSchedule,
  PlumbingEquipment,
  PlumbingEquipmentType,
  PlumbingNode,
  PlumbingPoint3D,
  PlumbingRun,
  PlumbingRunSystem,
  PlumbingSettings,
  PlumbingSystem,
} from './plumbingTypes';

export const PLUMBING_SYSTEM_SCHEMA_VERSION = 1;

export const DEFAULT_PLUMBING_SETTINGS: PlumbingSettings = {
  codeProfileId: 'conceptual',
  defaultWaterMaterial: 'pex',
  defaultWasteVentMaterial: 'pvc',
  fixtureMarkCounters: {},
};

export function defaultPipeScheduleForMaterial(material: PlumbingMaterial): PlumbingPipeSchedule {
  return material === 'pvc' || material === 'abs' || material === 'cpvc' || material === 'cast_iron'
    ? 'SCH 40'
    : 'N/A';
}

export function createDefaultPlumbingSystem(): PlumbingSystem {
  return {
    schemaVersion: PLUMBING_SYSTEM_SCHEMA_VERSION,
    codeProfileId: DEFAULT_PLUMBING_SETTINGS.codeProfileId,
    fixtures: [],
    nodes: [],
    runs: [],
    equipment: [],
    septicTanks: [],
    settings: structuredClone(DEFAULT_PLUMBING_SETTINGS),
  };
}

function nextFixtureMark(type: PlumbingFixtureType, fixtures: readonly PlumbingFixture[]): string {
  const definition = getPlumbingFixtureDefinition(type);
  const usedNumbers = fixtures
    .filter((fixture) => fixture.fixtureType === type && fixture.mark.startsWith(`${definition.markPrefix}-`))
    .map((fixture) => Number(fixture.mark.slice(definition.markPrefix.length + 1)))
    .filter((value) => Number.isFinite(value));
  const nextNumber = usedNumbers.length > 0 ? Math.max(...usedNumbers) + 1 : 1;
  return `${definition.markPrefix}-${nextNumber}`;
}

function createId(prefix: string, seed?: string): string {
  return `${prefix}-${seed ?? Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function rotatePoint(point: PlumbingPoint3D, radians: number): PlumbingPoint3D {
  if (!Number.isFinite(radians) || Math.abs(radians) < 0.000001) return point;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: point.x * cos - point.z * sin,
    y: point.y,
    z: point.x * sin + point.z * cos,
  };
}

function addPoint(a: PlumbingPoint3D, b: PlumbingPoint3D): PlumbingPoint3D {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function pushConnectionNode(
  connectionNodeIds: Partial<Record<PlumbingRunSystem, string[]>>,
  system: PlumbingRunSystem,
  nodeId: string,
): void {
  connectionNodeIds[system] = [...(connectionNodeIds[system] ?? []), nodeId];
}

export function addFixtureToPlumbingSystem(params: {
  system: PlumbingSystem;
  fixtureType: PlumbingFixtureType;
  position: PlumbingPoint3D;
  rotationRadians?: number;
  idSeed?: string;
}): PlumbingSystem {
  const definition = getPlumbingFixtureDefinition(params.fixtureType);
  const rotationRadians = params.rotationRadians ?? 0;
  const fixtureId = createId('plumbing-fixture', params.idSeed);
  const connectionNodeIds: Partial<Record<PlumbingRunSystem, string[]>> = {};
  const nodes: PlumbingNode[] = definition.connections.map((connection, index) => {
    const nodeId = `${fixtureId}-node-${index + 1}`;
    pushConnectionNode(connectionNodeIds, connection.system, nodeId);
    return {
      id: nodeId,
      kind: params.fixtureType === 'water_heater' ? 'equipment_connection' : 'fixture_connection',
      system: connection.system,
      position: addPoint(params.position, rotatePoint(connection.offset, rotationRadians)),
      fixtureId,
      label: connection.label,
    };
  });
  const fixture: PlumbingFixture = {
    id: fixtureId,
    fixtureType: params.fixtureType,
    mark: nextFixtureMark(params.fixtureType, params.system.fixtures),
    displayName: definition.displayName,
    position: params.position,
    rotationRadians,
    connectionNodeIds,
  };

  return {
    ...params.system,
    fixtures: [...params.system.fixtures, fixture],
    nodes: [...params.system.nodes, ...nodes],
  };
}

export function updateFixtureRotationInPlumbingSystem(params: {
  system: PlumbingSystem;
  fixtureId: string;
  rotationRadians: number;
}): PlumbingSystem {
  const fixture = params.system.fixtures.find((item) => item.id === params.fixtureId);
  if (!fixture) return params.system;
  const definition = getPlumbingFixtureDefinition(fixture.fixtureType);
  const nodeIdByConnectionId = new Map<string, PlumbingNode>();
  definition.connections.forEach((connection) => {
    const nodeId = fixture.connectionNodeIds[connection.system]?.find((candidate) =>
      params.system.nodes.some((node) => node.id === candidate && node.label === connection.label),
    );
    const node = params.system.nodes.find((candidate) => candidate.id === nodeId);
    if (node) nodeIdByConnectionId.set(connection.id, node);
  });
  return {
    ...params.system,
    fixtures: params.system.fixtures.map((item) =>
      item.id === fixture.id ? { ...item, rotationRadians: params.rotationRadians } : item,
    ),
    nodes: params.system.nodes.map((node) => {
      if (node.fixtureId !== fixture.id) return node;
      const connection = definition.connections.find((candidate) => nodeIdByConnectionId.get(candidate.id)?.id === node.id);
      if (!connection) return node;
      return {
        ...node,
        position: addPoint(fixture.position, rotatePoint(connection.offset, params.rotationRadians)),
      };
    }),
  };
}

export function createPlumbingRun(params: {
  system: PlumbingSystem;
  systemType: PlumbingRunSystem;
  startNodeId: string;
  endNodeId: string;
  routePoints?: PlumbingPoint3D[];
  diameterInches?: number | null;
  slopeInPerFt?: number;
  material?: PlumbingMaterial;
  schedule?: PlumbingPipeSchedule;
  elevationMode?: PlumbingRun['elevationMode'];
  labelVisible?: boolean;
  idSeed?: string;
}): PlumbingRun | null {
  const startNode = params.system.nodes.find((node) => node.id === params.startNodeId);
  const endNode = params.system.nodes.find((node) => node.id === params.endNodeId);
  if (!startNode || !endNode) return null;
  const defaultMaterial =
    params.systemType === 'cold_water' || params.systemType === 'hot_water'
      ? params.system.settings.defaultWaterMaterial
      : params.system.settings.defaultWasteVentMaterial;
  return {
    id: createId('plumbing-run', params.idSeed),
    system: params.systemType,
    startNodeId: params.startNodeId,
    endNodeId: params.endNodeId,
    path: [startNode.position, ...(params.routePoints ?? []), endNode.position],
    diameterInches: params.diameterInches ?? null,
    material: params.material ?? defaultMaterial,
    schedule: params.schedule ?? defaultPipeScheduleForMaterial(params.material ?? defaultMaterial),
    slopeInPerFt: params.slopeInPerFt,
    elevationMode: params.elevationMode ?? (params.systemType === 'sanitary' ? 'under_slab' : 'in_wall'),
    labelVisible: params.labelVisible ?? true,
  };
}

export function addRunToPlumbingSystem(params: {
  system: PlumbingSystem;
  systemType: PlumbingRunSystem;
  startNodeId: string;
  endNodeId: string;
  routePoints?: PlumbingPoint3D[];
  diameterInches?: number | null;
  slopeInPerFt?: number;
  material?: PlumbingMaterial;
  schedule?: PlumbingPipeSchedule;
  elevationMode?: PlumbingRun['elevationMode'];
  labelVisible?: boolean;
  idSeed?: string;
}): PlumbingSystem {
  const run = createPlumbingRun(params);
  return run ? { ...params.system, runs: [...params.system.runs, run] } : params.system;
}

export function addEquipmentToPlumbingSystem(params: {
  system: PlumbingSystem;
  equipmentType: PlumbingEquipmentType;
  position: PlumbingPoint3D;
  rotationRadians?: number;
  idSeed?: string;
}): PlumbingSystem {
  const equipmentId = createId('plumbing-equipment', params.idSeed);
  const systemByEquipment: Record<PlumbingEquipmentType, PlumbingRunSystem> = {
    cleanout: 'sanitary',
    shutoff_valve: 'cold_water',
    waste_stack: 'sanitary',
    vent_stack: 'vent',
    combined_stack: 'vent',
    roof_vent_termination: 'vent',
    meter: 'cold_water',
    main_service_point: 'cold_water',
    building_drain_exit: 'sanitary',
  };
  const nodeKindByEquipment: Partial<Record<PlumbingEquipmentType, PlumbingNode['kind']>> = {
    cleanout: 'cleanout',
    shutoff_valve: 'valve',
    waste_stack: 'stack',
    vent_stack: 'stack',
    combined_stack: 'stack',
    main_service_point: 'main_service',
    building_drain_exit: 'building_drain_exit',
  };
  const system = systemByEquipment[params.equipmentType];
  const nodeId = `${equipmentId}-node-1`;
  const labelByEquipment: Record<PlumbingEquipmentType, string> = {
    cleanout: 'CO',
    shutoff_valve: 'Valve',
    waste_stack: 'WS',
    vent_stack: 'VS',
    combined_stack: 'Stack',
    roof_vent_termination: 'Roof vent',
    meter: 'Meter',
    main_service_point: 'Service',
    building_drain_exit: 'BD',
  };
  const equipment: PlumbingEquipment = {
    id: equipmentId,
    equipmentType: params.equipmentType,
    label: labelByEquipment[params.equipmentType],
    position: params.position,
    rotationRadians: params.rotationRadians ?? 0,
    connectionNodeIds: [nodeId],
  };
  const node: PlumbingNode = {
    id: nodeId,
    kind: nodeKindByEquipment[params.equipmentType] ?? 'equipment_connection',
    system,
    position: params.position,
    equipmentId,
    label: equipment.label,
  };
  return {
    ...params.system,
    equipment: [...params.system.equipment, equipment],
    nodes: [...params.system.nodes, node],
  };
}

export function removeFixtureFromPlumbingSystem(system: PlumbingSystem, fixtureId: string): PlumbingSystem {
  const fixtureNodeIds = new Set(system.nodes.filter((node) => node.fixtureId === fixtureId).map((node) => node.id));
  return {
    ...system,
    fixtures: system.fixtures.filter((fixture) => fixture.id !== fixtureId),
    nodes: system.nodes.filter((node) => node.fixtureId !== fixtureId),
    runs: system.runs.filter((run) => !fixtureNodeIds.has(run.startNodeId) && !fixtureNodeIds.has(run.endNodeId)),
  };
}

export function removeRunFromPlumbingSystem(system: PlumbingSystem, runId: string): PlumbingSystem {
  return {
    ...system,
    runs: system.runs.filter((run) => run.id !== runId),
  };
}

export function buildPlumbingFixtureSchedule(system: PlumbingSystem): PlumbingFixtureScheduleRow[] {
  return system.fixtures
    .map((fixture) => ({
      fixtureId: fixture.id,
      mark: fixture.mark,
      fixtureType: fixture.fixtureType,
      displayName: fixture.displayName,
      coldWater: (fixture.connectionNodeIds.cold_water?.length ?? 0) > 0,
      hotWater: (fixture.connectionNodeIds.hot_water?.length ?? 0) > 0,
      sanitary: (fixture.connectionNodeIds.sanitary?.length ?? 0) > 0,
      vent: (fixture.connectionNodeIds.vent?.length ?? 0) > 0,
      xMeters: fixture.position.x,
      zMeters: fixture.position.z,
    }))
    .sort((a, b) => a.mark.localeCompare(b.mark, undefined, { numeric: true }));
}
