import { getPlumbingFixtureDefinition } from '../plumbingFixtureLibrary';
import type { PlumbingFittingType } from '../plumbingFittingTypes';
import type {
  PlumbingFixture,
  PlumbingFixtureType,
  PlumbingMaterial,
  PlumbingPipeSchedule,
  PlumbingRiserKind,
  PlumbingRoughInSystem,
} from '../plumbingTypes';

export type PlumbingFixtureRoughInDefault = {
  system: PlumbingRoughInSystem;
  diameterInches: number | null;
  material: PlumbingMaterial;
  schedule?: PlumbingPipeSchedule;
  riserKind: PlumbingRiserKind;
  topElevationM: number;
  bottomElevationM: number;
  branchElevationM: number;
  fittingTypes: PlumbingFittingType[];
  label: string;
};

const UNDER_SLAB_INVERT_M = -0.4;
const FLOOR_ELEVATION_M = 0;
const WALL_DRAIN_HEIGHT_M = 0.45;
const WALL_WATER_HEIGHT_M = 0.55;
const VENT_TOP_M = 3.5;

function fittingTypesForFixture(type: PlumbingFixtureType, system: PlumbingRoughInSystem): PlumbingFittingType[] {
  if (system === 'cold_water' || system === 'hot_water') {
    if (type === 'hose_bib') return ['hose_bib_adapter'];
    if (type === 'water_heater') return ['stub_out_elbow'];
    return ['stub_out_elbow', 'angle_stop'];
  }
  if (system === 'vent') return ['vent_tee'];
  if (type === 'toilet') return ['closet_bend', 'closet_flange'];
  if (type === 'floor_drain') return ['p_trap', 'floor_drain_body'];
  if (type === 'tub') return ['tub_drain', 'p_trap'];
  if (type === 'shower') return ['p_trap'];
  if (type === 'laundry_box') return ['p_trap', 'trap_adapter'];
  if (type === 'lavatory' || type === 'kitchen_sink' || type === 'utility_sink') return ['p_trap', 'trap_adapter'];
  return ['p_trap'];
}

function riserKindForFixture(type: PlumbingFixtureType, system: PlumbingRoughInSystem): PlumbingRiserKind {
  if (system === 'vent') return 'in_wall_riser';
  if (system === 'cold_water' || system === 'hot_water') return 'in_wall_riser';
  if (type === 'lavatory' || type === 'kitchen_sink' || type === 'utility_sink' || type === 'laundry_box') return 'fixture_tailpiece';
  if (type === 'toilet') return 'closet_bend_connection';
  return 'vertical_stub_up';
}

function topElevationForFixture(type: PlumbingFixtureType, system: PlumbingRoughInSystem): number {
  if (system === 'vent') return VENT_TOP_M;
  if (system === 'cold_water' || system === 'hot_water') {
    if (type === 'water_heater') return 1.2;
    return WALL_WATER_HEIGHT_M;
  }
  if (type === 'lavatory' || type === 'kitchen_sink' || type === 'utility_sink') return WALL_DRAIN_HEIGHT_M;
  if (type === 'laundry_box') return 0.9;
  return FLOOR_ELEVATION_M;
}

function branchElevationForSystem(system: PlumbingRoughInSystem, topElevationM: number): number {
  if (system === 'sanitary') return UNDER_SLAB_INVERT_M;
  if (system === 'vent') return Math.min(WALL_DRAIN_HEIGHT_M, topElevationM);
  return WALL_WATER_HEIGHT_M;
}

function defaultMaterial(system: PlumbingRoughInSystem): PlumbingMaterial {
  return system === 'cold_water' || system === 'hot_water' ? 'pex' : 'pvc';
}

function defaultSchedule(material: PlumbingMaterial): PlumbingPipeSchedule {
  return material === 'pvc' || material === 'abs' || material === 'cast_iron' || material === 'cpvc' ? 'SCH 40' : 'N/A';
}

export function getPlumbingFixtureRoughInDefault(params: {
  fixture: PlumbingFixture;
  system: PlumbingRoughInSystem;
}): PlumbingFixtureRoughInDefault | null {
  const definition = getPlumbingFixtureDefinition(params.fixture.fixtureType);
  const connection = definition.connections.find((candidate) => candidate.system === params.system);
  if (!connection) return null;
  const material = defaultMaterial(params.system);
  const topElevationM = topElevationForFixture(params.fixture.fixtureType, params.system);
  const branchElevationM = branchElevationForSystem(params.system, topElevationM);
  return {
    system: params.system,
    diameterInches: connection.defaultDiameterInches,
    material,
    schedule: defaultSchedule(material),
    riserKind: riserKindForFixture(params.fixture.fixtureType, params.system),
    topElevationM,
    bottomElevationM: branchElevationM,
    branchElevationM,
    fittingTypes: fittingTypesForFixture(params.fixture.fixtureType, params.system),
    label: `${connection.defaultDiameterInches ?? ''}" ${connection.label}`.trim(),
  };
}

export function requiredRoughInSystemsForFixture(fixture: PlumbingFixture): PlumbingRoughInSystem[] {
  return getPlumbingFixtureDefinition(fixture.fixtureType)
    .connections
    .map((connection) => connection.system as PlumbingRoughInSystem);
}
