import type { PlumbingFittingType, PlumbingFittingUse } from '../plumbingFittingTypes';
import type { PlumbingMaterial, PlumbingRunSystem } from '../plumbingTypes';

export type PlumbingFittingDefinition = {
  type: PlumbingFittingType;
  label: string;
  use: PlumbingFittingUse;
  systems: PlumbingRunSystem[];
  materials?: PlumbingMaterial[];
};

const WATER_SYSTEMS: PlumbingRunSystem[] = ['cold_water', 'hot_water'];
const ALL_SYSTEMS: PlumbingRunSystem[] = ['sanitary', 'vent', 'cold_water', 'hot_water'];
const RIGID_DWV_MATERIALS: PlumbingMaterial[] = ['pvc', 'abs', 'cast_iron', 'other'];
const WATER_MATERIALS: PlumbingMaterial[] = ['pex', 'cpvc', 'copper', 'other'];

export const PLUMBING_FITTING_DEFINITIONS: PlumbingFittingDefinition[] = [
  { type: 'elbow_90', label: '90° Elbow', use: 'direction_change', systems: ['vent', ...WATER_SYSTEMS] },
  { type: 'elbow_90_long_sweep', label: 'Long Sweep 90°', use: 'direction_change', systems: ['sanitary', 'vent'], materials: RIGID_DWV_MATERIALS },
  { type: 'elbow_45', label: '45° Elbow', use: 'direction_change', systems: ALL_SYSTEMS },
  { type: 'elbow_22_5', label: '22.5° Elbow', use: 'direction_change', systems: ['sanitary', 'vent'] },
  { type: 'elbow_11_25', label: '11.25° Elbow', use: 'direction_change', systems: ['sanitary'] },
  { type: 'street_elbow_90', label: 'Street 90°', use: 'direction_change', systems: WATER_SYSTEMS, materials: WATER_MATERIALS },
  { type: 'street_elbow_45', label: 'Street 45°', use: 'direction_change', systems: WATER_SYSTEMS, materials: WATER_MATERIALS },
  { type: 'offset_bend', label: 'Offset Bend', use: 'direction_change', systems: ALL_SYSTEMS },
  { type: 'tee', label: 'Tee', use: 'branch', systems: WATER_SYSTEMS, materials: WATER_MATERIALS },
  { type: 'reducing_tee', label: 'Reducing Tee', use: 'branch', systems: WATER_SYSTEMS, materials: WATER_MATERIALS },
  { type: 'sanitary_tee', label: 'Sanitary Tee', use: 'branch', systems: ['sanitary', 'vent'], materials: RIGID_DWV_MATERIALS },
  { type: 'double_sanitary_tee', label: 'Double Sanitary Tee', use: 'branch', systems: ['sanitary'], materials: RIGID_DWV_MATERIALS },
  { type: 'wye', label: 'Wye', use: 'branch', systems: ['sanitary', 'vent'], materials: RIGID_DWV_MATERIALS },
  { type: 'double_wye', label: 'Double Wye', use: 'branch', systems: ['sanitary'], materials: RIGID_DWV_MATERIALS },
  { type: 'combo_wye_45', label: 'Combo Wye + 45°', use: 'branch', systems: ['sanitary', 'vent'], materials: RIGID_DWV_MATERIALS },
  { type: 'cross', label: 'Cross', use: 'branch', systems: ['sanitary', ...WATER_SYSTEMS] },
  { type: 'coupling', label: 'Coupling', use: 'coupling', systems: ALL_SYSTEMS },
  { type: 'repair_coupling', label: 'Repair Coupling', use: 'coupling', systems: ALL_SYSTEMS },
  { type: 'reducing_coupling', label: 'Reducing Coupling', use: 'coupling', systems: ALL_SYSTEMS },
  { type: 'transition_coupling', label: 'Transition Coupling', use: 'transition', systems: ALL_SYSTEMS },
  { type: 'union', label: 'Union', use: 'coupling', systems: WATER_SYSTEMS, materials: WATER_MATERIALS },
  { type: 'male_adapter', label: 'Male Adapter', use: 'transition', systems: WATER_SYSTEMS, materials: WATER_MATERIALS },
  { type: 'female_adapter', label: 'Female Adapter', use: 'transition', systems: WATER_SYSTEMS, materials: WATER_MATERIALS },
  { type: 'trap_adapter', label: 'Trap Adapter', use: 'transition', systems: ['sanitary'], materials: RIGID_DWV_MATERIALS },
  { type: 'bushing', label: 'Bushing', use: 'transition', systems: ALL_SYSTEMS },
  { type: 'reducer', label: 'Reducer', use: 'transition', systems: ALL_SYSTEMS },
  { type: 'increaser', label: 'Increaser', use: 'transition', systems: ALL_SYSTEMS },
  { type: 'cap', label: 'Cap', use: 'end', systems: ALL_SYSTEMS },
  { type: 'plug', label: 'Plug', use: 'end', systems: ALL_SYSTEMS },
  { type: 'cleanout_adapter', label: 'Cleanout Adapter', use: 'cleanout', systems: ['sanitary'], materials: RIGID_DWV_MATERIALS },
  { type: 'cleanout_plug', label: 'Cleanout Plug', use: 'cleanout', systems: ['sanitary'], materials: RIGID_DWV_MATERIALS },
  { type: 'p_trap', label: 'P-Trap', use: 'trap', systems: ['sanitary'], materials: RIGID_DWV_MATERIALS },
  { type: 'trap_arm', label: 'Trap Arm', use: 'trap', systems: ['sanitary'], materials: RIGID_DWV_MATERIALS },
  { type: 'closet_bend', label: 'Closet Bend', use: 'fixture_connection', systems: ['sanitary'], materials: RIGID_DWV_MATERIALS },
  { type: 'closet_flange', label: 'Closet Flange', use: 'fixture_connection', systems: ['sanitary'], materials: RIGID_DWV_MATERIALS },
  { type: 'test_tee', label: 'Test Tee', use: 'cleanout', systems: ['sanitary'], materials: RIGID_DWV_MATERIALS },
  { type: 'cleanout_tee', label: 'Cleanout Tee', use: 'cleanout', systems: ['sanitary'], materials: RIGID_DWV_MATERIALS },
  { type: 'floor_cleanout', label: 'Floor Cleanout', use: 'cleanout', systems: ['sanitary'], materials: RIGID_DWV_MATERIALS },
  { type: 'yard_cleanout', label: 'Yard Cleanout', use: 'cleanout', systems: ['sanitary'], materials: RIGID_DWV_MATERIALS },
  { type: 'vent_tee', label: 'Vent Tee', use: 'vent_terminal', systems: ['vent'] },
  { type: 'vent_90', label: 'Vent 90°', use: 'vent_terminal', systems: ['vent'] },
  { type: 'roof_vent_boot', label: 'Roof Vent Boot', use: 'vent_terminal', systems: ['vent'] },
  { type: 'vent_cap', label: 'Vent Cap', use: 'vent_terminal', systems: ['vent'] },
  { type: 'drop_ear_elbow', label: 'Drop Ear Elbow', use: 'fixture_connection', systems: WATER_SYSTEMS, materials: WATER_MATERIALS },
  { type: 'stub_out_elbow', label: 'Stub-Out Elbow', use: 'fixture_connection', systems: WATER_SYSTEMS, materials: WATER_MATERIALS },
  { type: 'manifold', label: 'Manifold', use: 'branch', systems: WATER_SYSTEMS, materials: ['pex', 'other'] },
  { type: 'water_hammer_arrestor', label: 'Water Hammer Arrestor', use: 'fixture_connection', systems: WATER_SYSTEMS },
  { type: 'hose_bib_adapter', label: 'Hose Bib Adapter', use: 'fixture_connection', systems: WATER_SYSTEMS },
  { type: 'ball_valve', label: 'Ball Valve', use: 'valve', systems: WATER_SYSTEMS },
  { type: 'gate_valve', label: 'Gate Valve', use: 'valve', systems: WATER_SYSTEMS },
  { type: 'check_valve', label: 'Check Valve', use: 'valve', systems: WATER_SYSTEMS },
  { type: 'stop_valve', label: 'Stop Valve', use: 'valve', systems: WATER_SYSTEMS },
  { type: 'angle_stop', label: 'Angle Stop', use: 'valve', systems: WATER_SYSTEMS },
  { type: 'pressure_reducing_valve', label: 'Pressure Reducing Valve', use: 'valve', systems: WATER_SYSTEMS },
  { type: 'pipe_sleeve', label: 'Pipe Sleeve', use: 'sleeve', systems: ALL_SYSTEMS },
  { type: 'footing_sleeve', label: 'Footing Sleeve', use: 'sleeve', systems: ['sanitary'] },
  { type: 'wall_sleeve', label: 'Wall Sleeve', use: 'sleeve', systems: ALL_SYSTEMS },
];

export function fittingDefinition(type: PlumbingFittingType): PlumbingFittingDefinition | null {
  return PLUMBING_FITTING_DEFINITIONS.find((definition) => definition.type === type) ?? null;
}

export function fittingsForPipe(params: {
  system: PlumbingRunSystem;
  material: PlumbingMaterial;
}): PlumbingFittingDefinition[] {
  return PLUMBING_FITTING_DEFINITIONS.filter((definition) =>
    definition.systems.includes(params.system) &&
    (!definition.materials || definition.materials.includes(params.material)),
  );
}

export function isFittingAllowedForSystem(type: PlumbingFittingType, system: PlumbingRunSystem): boolean {
  return fittingDefinition(type)?.systems.includes(system) ?? false;
}

export function isFittingAllowedForMaterial(type: PlumbingFittingType, material: PlumbingMaterial): boolean {
  const definition = fittingDefinition(type);
  return Boolean(definition && (!definition.materials || definition.materials.includes(material)));
}

export function commonFittingsForPipe(params: {
  system: PlumbingRunSystem;
  material: PlumbingMaterial;
}): PlumbingFittingDefinition[] {
  const commonTypes: PlumbingFittingType[] =
    params.system === 'sanitary'
      ? ['elbow_90_long_sweep', 'elbow_45', 'wye', 'sanitary_tee', 'coupling', 'cleanout_adapter']
      : params.system === 'vent'
        ? ['elbow_90', 'elbow_45', 'wye', 'vent_tee', 'coupling', 'roof_vent_boot']
        : ['elbow_90', 'elbow_45', 'tee', 'coupling', 'drop_ear_elbow', 'ball_valve'];
  const allowed = fittingsForPipe(params);
  return commonTypes
    .map((type) => allowed.find((definition) => definition.type === type))
    .filter((definition): definition is PlumbingFittingDefinition => Boolean(definition));
}

