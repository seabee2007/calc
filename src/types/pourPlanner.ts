export type PlacementMethod = 'chute' | 'pump' | 'conveyor' | 'buggy' | 'bucket' | '';

export type PourPlannerStepId =
  | 'project'
  | 'mix'
  | 'delivery'
  | 'environment'
  | 'production'
  | 'risk'
  | 'qc';

export interface PourPlannerFormState {
  projectName: string;
  jobsiteAddress: string;
  batchPlantAddress: string;
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
  cloudCover: string;
  nightPour: boolean;
  rainForecast: boolean;

  crewSize: string;
  finishers: string;
  vibrators: string;
  pumpRate: string;
  placementRateYdPerHr: string;
  slabSize: string;
  placementSequence: string;
  dischargeRateYdPerHr: string;

  ticketNumber: string;
  truckNumber: string;
  batchTime: string;
  waterAddedTime: string;
  arrivalTime: string;
  dischargeStartTime: string;
  dischargeFinishTime: string;
  slumpAtArrival: string;
  slumpAfterAdjustment: string;
  concreteTempAtArrival: string;
  airContent: string;
  waterAddedOnSite: string;
  admixtureAddedOnSite: string;
  inspectorInitials: string;
}

export const DEFAULT_POUR_PLANNER_STATE: PourPlannerFormState = {
  projectName: '',
  jobsiteAddress: '',
  batchPlantAddress: '',
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
  cloudCover: 'partly_cloudy',
  nightPour: false,
  rainForecast: false,

  crewSize: '6',
  finishers: '4',
  vibrators: '2',
  pumpRate: '40',
  placementRateYdPerHr: '20',
  slabSize: '',
  placementSequence: '',
  dischargeRateYdPerHr: '30',

  ticketNumber: '',
  truckNumber: '',
  batchTime: '',
  waterAddedTime: '',
  arrivalTime: '',
  dischargeStartTime: '',
  dischargeFinishTime: '',
  slumpAtArrival: '',
  slumpAfterAdjustment: '',
  concreteTempAtArrival: '',
  airContent: '',
  waterAddedOnSite: '',
  admixtureAddedOnSite: '',
  inspectorInitials: '',
};
