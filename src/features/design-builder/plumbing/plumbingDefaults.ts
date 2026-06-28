import { getPlumbingFixtureDefinition } from './plumbingFixtureLibrary';
import type {
  PlumbingFixture,
  PlumbingFixtureScheduleRow,
  PlumbingFixtureType,
  PlumbingNode,
  PlumbingPoint3D,
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

export function createDefaultPlumbingSystem(): PlumbingSystem {
  return {
    schemaVersion: PLUMBING_SYSTEM_SCHEMA_VERSION,
    codeProfileId: DEFAULT_PLUMBING_SETTINGS.codeProfileId,
    fixtures: [],
    nodes: [],
    runs: [],
    equipment: [],
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
  const nowSeed = params.idSeed ?? Date.now().toString(36);
  const fixtureId = `plumbing-fixture-${nowSeed}-${Math.random().toString(36).slice(2, 8)}`;
  const connectionNodeIds: Partial<Record<PlumbingRunSystem, string[]>> = {};
  const nodes: PlumbingNode[] = definition.connections.map((connection, index) => {
    const nodeId = `${fixtureId}-node-${index + 1}`;
    pushConnectionNode(connectionNodeIds, connection.system, nodeId);
    return {
      id: nodeId,
      kind: params.fixtureType === 'water_heater' ? 'equipment_connection' : 'fixture_connection',
      system: connection.system,
      position: addPoint(params.position, connection.offset),
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
    rotationRadians: params.rotationRadians ?? 0,
    connectionNodeIds,
  };

  return {
    ...params.system,
    fixtures: [...params.system.fixtures, fixture],
    nodes: [...params.system.nodes, ...nodes],
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
