export type LaborPlacementMethod = 'chute' | 'wheelbarrow' | 'buggy' | 'pump';

export type FinishType =
  | 'broom'
  | 'hard_trowel'
  | 'burnished'
  | 'stamp'
  | 'exposed_aggregate';

export type AccessDifficulty = 'easy' | 'moderate' | 'difficult' | 'severe';

export type WeatherCondition =
  | 'normal'
  | 'hot'
  | 'extreme_hot'
  | 'rainy'
  | 'windy';

export type LaborProjectType =
  | 'slab_on_grade'
  | 'sidewalk'
  | 'driveway'
  | 'footing'
  | 'wall'
  | 'curb_gutter';

export type ReinforcementType =
  | 'none'
  | 'wire_mesh'
  | 'rebar_single_mat'
  | 'rebar_double_mat';

export interface ConcreteLaborEstimateInput {
  projectType: LaborProjectType;
  concreteYards: number;
  areaSqFt: number;
  thicknessInches: number;

  crew: {
    laborers: number;
    finishers: number;
    foremen: number;
  };

  rates: {
    laborerRate: number;
    finisherRate: number;
    foremanRate: number;
    burdenMultiplier: number;
    overtimeMultiplier: number;
  };

  placementMethod: LaborPlacementMethod;
  finishType: FinishType;
  accessDifficulty: AccessDifficulty;
  weatherCondition: WeatherCondition;
  reinforcementType: ReinforcementType;

  options: {
    pumpRequired: boolean;
    vaporBarrier: boolean;
    curingCompound: boolean;
    sawCutJoints: boolean;
    smallJobMinimum: boolean;
    includeCleanup: boolean;
    includeContingency: boolean;
  };
}

export interface ProfessionalConcreteLaborTaskHours {
  mobilization: number;
  subgradePrep: number;
  formworkEdgePrep: number;
  vaporBarrier: number;
  reinforcement: number;
  placement: number;
  screeding: number;
  bullFloating: number;
  edgingJointing: number;
  finishing: number;
  curing: number;
  cleanup: number;
}

export interface ProfessionalConcreteLaborResult {
  crewSize: number;
  averageCrewRate: number;
  burdenedRates: {
    laborer: number;
    finisher: number;
    foreman: number;
  };
  taskHours: ProfessionalConcreteLaborTaskHours;
  directCrewHours: number;
  billableCrewHours: number;
  regularHours: number;
  overtimeHours: number;
  costs: {
    regularCost: number;
    overtimeCost: number;
    supervisionCost: number;
    smallToolsAndPpe: number;
    contingency: number;
    totalLaborCost: number;
  };
  unitCosts: {
    laborCostPerCY: number;
    laborCostPerSqFt: number;
  };
  placementFactor: number;
  finishFactor: number;
}
