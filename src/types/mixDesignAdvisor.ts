import type { MixClimate, MixExposure } from '../utils/mixDesign';

export type MixProjectUse =
  | 'slab_on_grade'
  | 'driveway'
  | 'sidewalk'
  | 'footing'
  | 'wall'
  | 'curb_gutter'
  | 'structural_slab'
  | 'exterior_flatwork'
  | 'marine_coastal';

export type MixCementType = 'type_i' | 'type_ii' | 'type_iii' | 'type_v';

export type MixScmOption = 'none' | 'fly_ash' | 'slag' | 'silica_fume' | 'fly_ash_slag';

export type MixPlacementMethod = 'chute' | 'pump' | 'buggy' | 'wheelbarrow' | 'conveyor';

export type MixFinishType =
  | 'broom'
  | 'hard_trowel'
  | 'burnished'
  | 'stamp'
  | 'exposed_aggregate';

export type MixApprovalStatus = 'OK' | 'Caution' | 'Reject';

export interface MixDesignAdvisorFormState {
  projectUse: MixProjectUse;
  selectedPsi: string;
  exposure: MixExposure;
  slumpTargetIn: string;
  maxAggregateIn: string;
  placementMethod: MixPlacementMethod;
  finishType: MixFinishType;
  pumpRequired: boolean;
  cementType: MixCementType;
  scmOption: MixScmOption;
  chlorideExposure: boolean;
  sulfateExposure: boolean;
  freezeThawExposure: boolean;
  haulTimeMinutes: string;
  airEntrainmentRequired: boolean;
  unitSystem: 'imperial' | 'metric';
  climate: MixClimate;
  jobsiteAddress: import('./address').USAddress;
}

export interface MixComplianceResult {
  status: MixApprovalStatus;
  warnings: string[];
  failures: string[];
}

export interface ProfessionalMixDesignResult {
  waterCementRatio: number;
  maxAllowedWaterCementRatio: number;
  targetAir: [number, number];
  aeFactor: number;
  evaporationRate: { imperial: number; metric: number };
  recommendations: string[];
  designPsi: number;
  requiredAverageStrengthPsi: number;
  slumpRange: [number, number];
  recommendedAggregateSize: string;
  cementitiousContentLbPerYd: [number, number];
  waterReducerRecommendation: string;
  retarderAcceleratorRecommendation: string;
  scmRecommendation: string;
  curingMethod: string;
  hotWeatherPrecautions: string[];
  coldWeatherPrecautions: string[];
  pumpabilityWarning?: string;
  finishabilityWarning?: string;
  compliance: MixComplianceResult;
  durabilityCheck: string[];
  workabilityCheck: string[];
  weatherRisk: string[];
  admixtureRecommendations: string[];
  placementNotes: string[];
  waterReducerRecommended: boolean;
  exteriorFlatwork: boolean;
}
