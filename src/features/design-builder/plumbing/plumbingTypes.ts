import type { SepticTankModel } from './septic/septicTypes';

export type PlumbingCodeProfileId =
  | 'conceptual'
  | 'guam_ipc_2009'
  | 'ipc_2024'
  | 'upc_placeholder'
  | 'custom';

export type PlumbingRunSystem =
  | 'cold_water'
  | 'hot_water'
  | 'sanitary'
  | 'vent';

export type PlumbingToolMode =
  | 'select'
  | 'fixture'
  | 'drain'
  | 'vent'
  | 'cold_water'
  | 'hot_water'
  | 'cleanout'
  | 'valve'
  | 'stack'
  | 'label'
  | 'validate';

export type PlumbingFixtureType =
  | 'toilet'
  | 'lavatory'
  | 'shower'
  | 'tub'
  | 'kitchen_sink'
  | 'laundry_box'
  | 'floor_drain'
  | 'hose_bib'
  | 'utility_sink'
  | 'water_heater';

export type PlumbingNodeKind =
  | 'fixture_connection'
  | 'equipment_connection'
  | 'stack'
  | 'building_drain_exit'
  | 'main_service'
  | 'cleanout'
  | 'valve'
  | 'septic_inlet'
  | 'septic_outlet'
  | 'septic_access';

export type PlumbingMaterial =
  | 'pvc'
  | 'abs'
  | 'pex'
  | 'cpvc'
  | 'copper'
  | 'cast_iron'
  | 'other';

export type PlumbingElevationMode =
  | 'under_slab'
  | 'in_wall'
  | 'overhead'
  | 'vertical'
  | 'user_defined';

export type PlumbingPoint3D = {
  x: number;
  y: number;
  z: number;
};

export type PlumbingFixtureConnection = {
  id: string;
  system: PlumbingRunSystem;
  label: string;
  defaultDiameterInches: number | null;
  offset: PlumbingPoint3D;
};

export type PlumbingFixture = {
  id: string;
  fixtureType: PlumbingFixtureType;
  mark: string;
  displayName: string;
  position: PlumbingPoint3D;
  rotationRadians: number;
  connectionNodeIds: Partial<Record<PlumbingRunSystem, string[]>>;
  notes?: string;
};

export type PlumbingNode = {
  id: string;
  kind: PlumbingNodeKind;
  system: PlumbingRunSystem;
  position: PlumbingPoint3D;
  fixtureId?: string;
  equipmentId?: string;
  septicTankId?: string;
  label: string;
};

export type PlumbingRun = {
  id: string;
  system: PlumbingRunSystem;
  startNodeId: string;
  endNodeId: string;
  path: PlumbingPoint3D[];
  diameterInches: number | null;
  material: PlumbingMaterial;
  slopeInPerFt?: number;
  elevationMode: PlumbingElevationMode;
  labelVisible: boolean;
};

export type PlumbingEquipmentType =
  | 'cleanout'
  | 'shutoff_valve'
  | 'waste_stack'
  | 'vent_stack'
  | 'combined_stack'
  | 'roof_vent_termination'
  | 'meter'
  | 'main_service_point'
  | 'building_drain_exit';

export type PlumbingEquipment = {
  id: string;
  equipmentType: PlumbingEquipmentType;
  label: string;
  position: PlumbingPoint3D;
  rotationRadians: number;
  connectionNodeIds: string[];
};

export type PlumbingSettings = {
  codeProfileId: PlumbingCodeProfileId;
  defaultWaterMaterial: PlumbingMaterial;
  defaultWasteVentMaterial: PlumbingMaterial;
  fixtureMarkCounters: Partial<Record<PlumbingFixtureType, number>>;
};

export type PlumbingSystem = {
  schemaVersion: number;
  codeProfileId: PlumbingCodeProfileId;
  fixtures: PlumbingFixture[];
  nodes: PlumbingNode[];
  runs: PlumbingRun[];
  equipment: PlumbingEquipment[];
  septicTanks: SepticTankModel[];
  settings: PlumbingSettings;
};

export type PlumbingSelection =
  | { kind: 'fixture'; id: string }
  | { kind: 'run'; id: string }
  | { kind: 'run-route-point'; runId: string; pointIndex: number }
  | { kind: 'node'; id: string }
  | { kind: 'equipment'; id: string }
  | { kind: 'septic-tank'; id: string }
  | { kind: 'none' };

export type PlumbingRunDraft = {
  system: PlumbingRunSystem;
  startNodeId: string;
  routePoints: PlumbingPoint3D[];
  previewPoint?: PlumbingPoint3D;
};

export type PlumbingValidationSeverity = 'error' | 'warning';

export type PlumbingValidationIssue = {
  id: string;
  severity: PlumbingValidationSeverity;
  code:
    | 'fixture_missing_required_node'
    | 'fixture_missing_required_run'
    | 'run_missing_diameter'
    | 'sanitary_run_missing_slope'
    | 'run_missing_start_node'
    | 'run_missing_end_node'
    | 'sanitary_disconnected'
    | 'vent_disconnected'
    | 'duplicate_fixture_mark'
    | 'orphan_node'
    | 'pipe_crosses_foundation'
    | 'pipe_crosses_rc_column';
  message: string;
  objectKind: 'fixture' | 'run' | 'node' | 'foundation' | 'system';
  objectId?: string;
};

export type PlumbingLegendItem = {
  key: string;
  label: string;
  system?: PlumbingRunSystem;
  component?: 'cleanout' | 'valve' | 'stack';
};

export type PlumbingFixtureScheduleRow = {
  fixtureId: string;
  mark: string;
  fixtureType: PlumbingFixtureType;
  displayName: string;
  coldWater: boolean;
  hotWater: boolean;
  sanitary: boolean;
  vent: boolean;
  xMeters: number;
  zMeters: number;
};
