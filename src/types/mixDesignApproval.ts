import type { MixApprovalStatus, MixProjectUse } from './mixDesignAdvisor';

/** Persisted when a placement calculation completes Mix Design Advisor. */
export interface MixDesignApproval {
  approvedAt: string;
  selectedPsi: string;
  projectUse: MixProjectUse;
  complianceStatus: MixApprovalStatus;
  waterCementRatio?: number;
  targetAirLow?: number;
  targetAirHigh?: number;
}
