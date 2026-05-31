export const GENERAL_TRADES = [
  'Sitework',
  'Demolition',
  'Carpentry',
  'Framing',
  'Drywall',
  'Painting',
  'Flooring',
  'Masonry',
  'Roofing',
  'Plumbing',
  'Electrical',
  'HVAC',
  'Insulation',
  'Doors / Windows',
  'Finish Carpentry',
  'Landscaping',
  'General Labor',
] as const;

export type GeneralTrade = (typeof GENERAL_TRADES)[number];

export type ProductionRateType =
  | 'unitsPerLaborHour'
  | 'unitsPerLaborDay'
  | 'laborHoursPerUnit';

export interface GeneralTradeLaborInput {
  trade: GeneralTrade | '';
  activity: string;
  quantity: number;
  unit: string;
  productionRate: number;
  productionRateType: ProductionRateType;
  crewSize: number;
  hoursPerDay: number;
  laborRate: number;
  burdenPercent: number;
  overheadPercent: number;
  profitPercent: number;
  difficultyFactor: number;
  locationFactor: number;
  notes: string;
}

export interface GeneralTradeLaborResult {
  baseLaborHours: number;
  adjustedLaborHours: number;
  baseLaborCost: number;
  burdenCost: number;
  subtotalLaborCost: number;
  overhead: number;
  profit: number;
  totalLaborPrice: number;
  crewDays: number;
  costPerUnit: number;
  laborHoursPerUnit: number;
}

export interface GeneralTradeStarterTemplate {
  trade: GeneralTrade;
  activity: string;
  unit: string;
  productionRate: number;
  productionRateType: ProductionRateType;
  defaultCrewSize: number;
  defaultLaborRate: number;
  description: string;
}

export interface GeneralTradeLaborSavedTemplate {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  snapshot: GeneralTradeLaborInput;
}

export const DIFFICULTY_FACTOR_PRESETS: { label: string; value: number }[] = [
  { label: 'Easy', value: 0.9 },
  { label: 'Normal', value: 1.0 },
  { label: 'Difficult', value: 1.15 },
  { label: 'Very Difficult', value: 1.3 },
  { label: 'Occupied Building', value: 1.25 },
  { label: 'Night Work', value: 1.35 },
  { label: 'Remote Site', value: 1.2 },
  { label: 'Tight Access', value: 1.2 },
  { label: 'High Production Job', value: 0.95 },
  { label: 'Small Job Inefficiency', value: 1.25 },
];

export const LOCATION_FACTOR_PRESETS: { label: string; value: number }[] = [
  { label: 'Normal', value: 1.0 },
  { label: 'Low Cost Area', value: 0.9 },
  { label: 'High Cost Area', value: 1.15 },
  { label: 'Island / Remote', value: 1.25 },
  { label: 'OCONUS / Logistics Heavy', value: 1.3 },
];

export const DEFAULT_GENERAL_TRADE_LABOR_INPUT: GeneralTradeLaborInput = {
  trade: '',
  activity: '',
  quantity: 0,
  unit: '',
  productionRate: 0,
  productionRateType: 'unitsPerLaborDay',
  crewSize: 2,
  hoursPerDay: 8,
  laborRate: 65,
  burdenPercent: 25,
  overheadPercent: 10,
  profitPercent: 15,
  difficultyFactor: 1.0,
  locationFactor: 1.0,
  notes: '',
};
