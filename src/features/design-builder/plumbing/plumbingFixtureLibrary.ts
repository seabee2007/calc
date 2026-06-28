import type {
  PlumbingFixtureConnection,
  PlumbingFixtureType,
  PlumbingRunSystem,
} from './plumbingTypes';

export type PlumbingFixtureDefinition = {
  type: PlumbingFixtureType;
  displayName: string;
  markPrefix: string;
  planSymbol: 'wc' | 'basin' | 'shower' | 'tub' | 'sink' | 'box' | 'drain' | 'bib' | 'heater';
  widthMeters: number;
  depthMeters: number;
  connections: PlumbingFixtureConnection[];
};

const connection = (
  system: PlumbingRunSystem,
  label: string,
  defaultDiameterInches: number | null,
  offset: { x: number; y?: number; z: number },
): PlumbingFixtureConnection => ({
  id: `${system}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
  system,
  label,
  defaultDiameterInches,
  offset: { x: offset.x, y: offset.y ?? 0, z: offset.z },
});

export const PLUMBING_FIXTURE_LIBRARY: Record<PlumbingFixtureType, PlumbingFixtureDefinition> = {
  toilet: {
    type: 'toilet',
    displayName: 'WC / Toilet',
    markPrefix: 'WC',
    planSymbol: 'wc',
    widthMeters: 0.46,
    depthMeters: 0.72,
    connections: [
      connection('cold_water', 'CW', 0.5, { x: -0.18, z: -0.18 }),
      connection('sanitary', 'SS', 3, { x: 0, z: 0.12 }),
      connection('vent', 'V', 2, { x: 0.18, z: 0.18 }),
    ],
  },
  lavatory: {
    type: 'lavatory',
    displayName: 'Lavatory',
    markPrefix: 'LAV',
    planSymbol: 'basin',
    widthMeters: 0.56,
    depthMeters: 0.46,
    connections: [
      connection('cold_water', 'CW', 0.5, { x: -0.12, z: -0.08 }),
      connection('hot_water', 'HW', 0.5, { x: 0.12, z: -0.08 }),
      connection('sanitary', 'SS', 1.5, { x: 0, z: 0.08 }),
      connection('vent', 'V', 1.5, { x: 0.18, z: 0.12 }),
    ],
  },
  shower: {
    type: 'shower',
    displayName: 'Shower',
    markPrefix: 'SH',
    planSymbol: 'shower',
    widthMeters: 0.9,
    depthMeters: 0.9,
    connections: [
      connection('cold_water', 'CW', 0.5, { x: -0.18, z: -0.28 }),
      connection('hot_water', 'HW', 0.5, { x: 0.18, z: -0.28 }),
      connection('sanitary', 'SS', 2, { x: 0, z: 0 }),
      connection('vent', 'V', 1.5, { x: 0.32, z: 0.32 }),
    ],
  },
  tub: {
    type: 'tub',
    displayName: 'Tub',
    markPrefix: 'TUB',
    planSymbol: 'tub',
    widthMeters: 0.76,
    depthMeters: 1.52,
    connections: [
      connection('cold_water', 'CW', 0.5, { x: -0.2, z: -0.58 }),
      connection('hot_water', 'HW', 0.5, { x: 0.2, z: -0.58 }),
      connection('sanitary', 'SS', 1.5, { x: 0, z: 0.55 }),
      connection('vent', 'V', 1.5, { x: 0.28, z: 0.55 }),
    ],
  },
  kitchen_sink: {
    type: 'kitchen_sink',
    displayName: 'Kitchen Sink',
    markPrefix: 'KS',
    planSymbol: 'sink',
    widthMeters: 0.84,
    depthMeters: 0.56,
    connections: [
      connection('cold_water', 'CW', 0.5, { x: -0.16, z: -0.08 }),
      connection('hot_water', 'HW', 0.5, { x: 0.16, z: -0.08 }),
      connection('sanitary', 'SS', 2, { x: 0, z: 0.1 }),
      connection('vent', 'V', 1.5, { x: 0.24, z: 0.14 }),
    ],
  },
  laundry_box: {
    type: 'laundry_box',
    displayName: 'Laundry Box',
    markPrefix: 'LB',
    planSymbol: 'box',
    widthMeters: 0.46,
    depthMeters: 0.2,
    connections: [
      connection('cold_water', 'CW', 0.5, { x: -0.12, z: 0 }),
      connection('hot_water', 'HW', 0.5, { x: 0.12, z: 0 }),
      connection('sanitary', 'SS', 2, { x: 0, z: 0.08 }),
      connection('vent', 'V', 1.5, { x: 0.18, z: 0.08 }),
    ],
  },
  floor_drain: {
    type: 'floor_drain',
    displayName: 'Floor Drain',
    markPrefix: 'FD',
    planSymbol: 'drain',
    widthMeters: 0.25,
    depthMeters: 0.25,
    connections: [
      connection('sanitary', 'SS', 2, { x: 0, z: 0 }),
      connection('vent', 'V', 1.5, { x: 0.12, z: 0.12 }),
    ],
  },
  hose_bib: {
    type: 'hose_bib',
    displayName: 'Hose Bib',
    markPrefix: 'HB',
    planSymbol: 'bib',
    widthMeters: 0.22,
    depthMeters: 0.16,
    connections: [
      connection('cold_water', 'CW', 0.5, { x: 0, z: 0 }),
    ],
  },
  utility_sink: {
    type: 'utility_sink',
    displayName: 'Utility Sink',
    markPrefix: 'US',
    planSymbol: 'sink',
    widthMeters: 0.66,
    depthMeters: 0.56,
    connections: [
      connection('cold_water', 'CW', 0.5, { x: -0.14, z: -0.08 }),
      connection('hot_water', 'HW', 0.5, { x: 0.14, z: -0.08 }),
      connection('sanitary', 'SS', 1.5, { x: 0, z: 0.1 }),
      connection('vent', 'V', 1.5, { x: 0.22, z: 0.12 }),
    ],
  },
  water_heater: {
    type: 'water_heater',
    displayName: 'Water Heater',
    markPrefix: 'WH',
    planSymbol: 'heater',
    widthMeters: 0.62,
    depthMeters: 0.62,
    connections: [
      connection('cold_water', 'CW Inlet', 0.75, { x: -0.16, z: -0.16, y: 1.2 }),
      connection('hot_water', 'HW Outlet', 0.75, { x: 0.16, z: -0.16, y: 1.2 }),
      connection('sanitary', 'Pan Drain', 0.75, { x: 0, z: 0.28 }),
    ],
  },
};

export const PLUMBING_FIXTURE_LIBRARY_ORDER: PlumbingFixtureType[] = [
  'toilet',
  'lavatory',
  'shower',
  'tub',
  'kitchen_sink',
  'laundry_box',
  'floor_drain',
  'hose_bib',
  'utility_sink',
  'water_heater',
];

export function getPlumbingFixtureDefinition(type: PlumbingFixtureType): PlumbingFixtureDefinition {
  return PLUMBING_FIXTURE_LIBRARY[type];
}
