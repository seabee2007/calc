export type PlacementMethod = 'chute' | 'pump' | 'conveyor' | 'buggy' | 'bucket' | '';

export type CrewEfficiency = 'excellent' | 'average' | 'new';
export type ComplexityLevel = 'open_slab' | 'heavy_rebar' | 'curbs_edges' | 'tight_access';
export type AccessFactorKey = 'chute' | 'pump' | 'buggy' | 'wheelbarrow' | 'conveyor' | 'bucket';
export type WeatherFactorKey = 'normal' | 'hot' | 'cold' | 'rain';

import type { PlacementOrderStatus } from './placementOrder';

export type PourPlannerStepId =
  | 'project'
  | 'mix'
  | 'delivery'
  | 'environment'
  | 'production'
  | 'risk';

export interface PourPlannerFormState {
  projectName: string;
  jobsiteStreet: string;
  jobsiteStreet2: string;
  jobsiteCity: string;
  jobsiteState: string;
  jobsiteZip: string;
  /** Mapbox-verified single line used for routing / batch plant lookup */
  jobsiteAddress: string;
  jobsiteLatitude: string;
  jobsiteLongitude: string;
  batchPlantName: string;
  batchPlantAddress: string;
  batchPlantLatitude: string;
  batchPlantLongitude: string;
  pourStartTime: string;
  placementMethod: PlacementMethod;

  projectId: string;
  calculationId: string;
  manualVolume: string;
  psi: string;

  aggregateSize: string;
  airEntrainment: string;
  waterReducer: boolean;
  retarder: boolean;
  fiber: boolean;
  hotWeatherMix: boolean;
  scc: boolean;
  specifiedSlump: string;
  slumpTolerance: string;
  requiredSlumpAtPlacement: string;
  pumpLineLength: string;
  pumpVerticalHeight: string;
  hoseDiameter: string;
  requiredSlumpAtPump: string;

  travelDistance: string;
  travelTimeMinutes: string;
  trafficBufferMinutes: string;
  truckSpeed: string;
  truckCapacityYd: string;
  numberOfTrucks: string;
  truckSpacingMinutes: string;
  drumRpm: string;
  washoutDelayMinutes: string;
  siteWaitMinutes: string;

  ambientTemp: string;
  concreteTempAtPlant: string;
  expectedConcreteTempAtArrival: string;
  relativeHumidity: string;
  windSpeed: string;
  nightPour: boolean;
  rainForecast: boolean;

  crewSize: string;
  finishers: string;
  vibrators: string;
  pumpRate: string;
  placementRateYdPerHr: string;
  placementRateManualOverride: boolean;
  slabSize: string;
  slabThicknessIn: string;
  dischargeRateYdPerHr: string;

  laborerRateCYHr: string;
  finisherRateSFHr: string;
  placingProductivityCYPerLaborHour: string;
  finishingProductivitySFPerLaborHour: string;
  crewEfficiency: CrewEfficiency;
  complexityFactor: ComplexityLevel | 'auto';
  accessFactorMode: 'auto' | AccessFactorKey;
  weatherFactorMode: 'auto' | WeatherFactorKey;
  burdenedHourlyRate: string;
  setupHours: string;
  cleanupHours: string;

  /** Step 6 — batch plant contact & order tracking */
  batchPlantPhone: string;
  batchPlantEmail: string;
  batchPlantDispatchContact: string;
  batchPlantWebsite: string;
  batchPlantContactSource: 'manual' | 'ai' | '';
  orderStatus: PlacementOrderStatus | '';
  orderNotes: string;
}

export const DEFAULT_POUR_PLANNER_STATE: PourPlannerFormState = {
  projectName: '',
  jobsiteStreet: '',
  jobsiteStreet2: '',
  jobsiteCity: '',
  jobsiteState: '',
  jobsiteZip: '',
  jobsiteAddress: '',
  jobsiteLatitude: '',
  jobsiteLongitude: '',
  batchPlantName: '',
  batchPlantAddress: '',
  batchPlantLatitude: '',
  batchPlantLongitude: '',
  pourStartTime: '07:00',
  placementMethod: '',

  projectId: '',
  calculationId: '',
  manualVolume: '',
  psi: '3000',

  aggregateSize: '3/4',
  airEntrainment: '6',
  waterReducer: false,
  retarder: false,
  fiber: false,
  hotWeatherMix: false,
  scc: false,
  specifiedSlump: '4',
  slumpTolerance: '1',
  requiredSlumpAtPlacement: '4',
  pumpLineLength: '',
  pumpVerticalHeight: '',
  hoseDiameter: '4',
  requiredSlumpAtPump: '5',

  travelDistance: '10',
  travelTimeMinutes: '34',
  trafficBufferMinutes: '10',
  truckSpeed: '35',
  truckCapacityYd: '10',
  numberOfTrucks: '',
  truckSpacingMinutes: '',
  drumRpm: '6',
  washoutDelayMinutes: '5',
  siteWaitMinutes: '8',

  ambientTemp: '',
  concreteTempAtPlant: '',
  expectedConcreteTempAtArrival: '',
  relativeHumidity: '',
  windSpeed: '',
  nightPour: false,
  rainForecast: false,

  crewSize: '6',
  finishers: '4',
  vibrators: '2',
  pumpRate: '40',
  placementRateYdPerHr: '20',
  placementRateManualOverride: false,
  slabSize: '',
  slabThicknessIn: '6',
  dischargeRateYdPerHr: '30',

  laborerRateCYHr: '3',
  finisherRateSFHr: '200',
  placingProductivityCYPerLaborHour: '2.5',
  finishingProductivitySFPerLaborHour: '250',
  crewEfficiency: 'average',
  complexityFactor: 'auto',
  accessFactorMode: 'auto',
  weatherFactorMode: 'auto',
  burdenedHourlyRate: '60',
  setupHours: '2',
  cleanupHours: '2',

  batchPlantPhone: '',
  batchPlantEmail: '',
  batchPlantDispatchContact: '',
  batchPlantWebsite: '',
  batchPlantContactSource: '',
  orderStatus: '',
  orderNotes: '',
};
