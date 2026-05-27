import type { PlacementProductionSnapshot } from './placementOrder';
import type { ProfessionalConcreteLaborResult } from './concreteLaborEstimate';

/** Form inputs saved with a labor estimate (crew & production calculator). */
export interface LaborEstimateInputs {
  crewSize: string;
  finishers: string;
  foremen: string;
  vibrators: string;
  /** @deprecated Legacy CY/hr fields — kept for saved estimate hydration */
  laborerRateCYHr?: string;
  finisherRateSFHr?: string;
  placingProductivityCYPerLaborHour?: string;
  finishingProductivitySFPerLaborHour?: string;
  setupHours?: string;
  cleanupHours?: string;
  crewEfficiency?: string;
  complexityFactor: string;
  accessFactorMode: string;
  weatherFactorMode: string;
  placementMethod: string;
  manualVolume: string;
  slabSize: string;
  slabThicknessIn: string;

  /** Task-based labor model */
  projectType: string;
  finishType: string;
  accessDifficulty: string;
  weatherCondition: string;
  reinforcementType: string;
  burdenMultiplier: string;
  overtimeMultiplier: string;
  vaporBarrier: string;
  curingCompound: string;
  sawCutJoints: string;
  smallJobMinimum: string;
  includeCleanup: string;
  includeContingency: string;
}

export interface LaborEstimate {
  id: string;
  projectId: string;
  label: string;
  volumeYd?: number;
  inputs: LaborEstimateInputs;
  laborCost: number;
  adjustedLaborHours?: number;
  /** Full production snapshot when saved from calculator */
  production?: PlacementProductionSnapshot;
  /** Task-based labor breakdown snapshot */
  professionalLabor?: ProfessionalConcreteLaborResult;
  createdAt: string;
  updatedAt: string;
}

export type { ReinforcementPricing } from './reinforcementPricing';
