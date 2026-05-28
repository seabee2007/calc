import type { Calculation } from '../types';
import type { MixDesignAdvisorFormState } from '../types/mixDesignAdvisor';
import type { MixDesignApproval } from '../types/mixDesignApproval';
import type { ProfessionalMixDesignResult } from '../types/mixDesignAdvisor';
import {
  getMixDesignApprovalCounts,
  getPendingMixDesignCalculations,
  getPlacementCalculations,
  isMixDesignApproved,
} from './placementCalculations';

export interface MixDesignWorkflowContext {
  totalPlacements: number;
  approvedCount: number;
  pendingCount: number;
  allApproved: boolean;
  /** First placement still needing mix design (chronological). */
  nextPendingCalculation?: Calculation;
  nextPendingCalculationId?: string;
}

export function getMixDesignWorkflowContext(project: {
  calculations?: Calculation[];
}): MixDesignWorkflowContext {
  const counts = getMixDesignApprovalCounts(project);
  const pending = getPendingMixDesignCalculations(project);
  const next = pending[0];
  return {
    totalPlacements: counts.total,
    approvedCount: counts.approved,
    pendingCount: counts.pending,
    allApproved: counts.total > 0 && counts.pending === 0,
    nextPendingCalculation: next,
    nextPendingCalculationId: next?.id,
  };
}

export function projectRequiresMixDesignApproval(project: {
  calculations?: Calculation[];
}): boolean {
  return getPlacementCalculations(project).length > 0;
}

export function buildMixDesignApprovalSnapshot(
  form: MixDesignAdvisorFormState,
  recommendation: ProfessionalMixDesignResult,
): MixDesignApproval {
  return {
    approvedAt: new Date().toISOString(),
    selectedPsi: form.selectedPsi,
    projectUse: form.projectUse,
    complianceStatus: recommendation.compliance.status,
    waterCementRatio: recommendation.waterCementRatio,
    targetAirLow: recommendation.targetAir[0],
    targetAirHigh: recommendation.targetAir[1],
  };
}

export { isMixDesignApproved, getPlacementCalculations, getPendingMixDesignCalculations };
