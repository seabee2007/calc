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
  | 'valve';

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
  settings: PlumbingSettings;
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
