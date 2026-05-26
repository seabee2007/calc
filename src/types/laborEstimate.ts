import type { PlacementProductionSnapshot } from './placementOrder';

/** Form inputs saved with a labor estimate (crew & production calculator). */
export interface LaborEstimateInputs {
  crewSize: string;
  finishers: string;
  vibrators: string;
  laborerRateCYHr: string;
  finisherRateSFHr: string;
  placingProductivityCYPerLaborHour: string;
  finishingProductivitySFPerLaborHour: string;
  setupHours: string;
  cleanupHours: string;
  crewEfficiency: string;
  complexityFactor: string;
  placementMethod: string;
  manualVolume: string;
  slabSize: string;
  slabThicknessIn: string;
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
  createdAt: string;
  updatedAt: string;
}

export type { ReinforcementPricing } from './reinforcementPricing';
