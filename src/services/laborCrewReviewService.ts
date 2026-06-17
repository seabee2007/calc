import type { ConcreteLaborEstimateInput } from '../types/concreteLaborEstimate';
import type { CrewScenario } from '../utils/laborCrewOptimizer';
import { getMeteredAuthHeaders } from './meteredFunctionClient';
import { parseEdgeFunctionJson } from '../lib/usageMetering';

const FN_BASE = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;

export interface LaborCrewReviewResult {
  recommendedScenarioIndex: number;
  crewSize: string;
  finishers: string;
  foremen: string;
  summary: string;
  tradeoffs: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface LaborCrewReviewInput {
  jobContext: {
    concreteYards: number;
    areaSqFt: number;
    projectType: string;
    placementMethod: string;
    finishType: string;
    accessDifficulty: string;
    weatherCondition: string;
    reinforcementType: string;
    burdenMultiplier: number;
    options: ConcreteLaborEstimateInput['options'];
  };
  current: CrewScenario;
  scenarios: CrewScenario[];
}

export async function reviewLaborCrewWithAi(
  input: LaborCrewReviewInput,
): Promise<LaborCrewReviewResult> {
  if (!FN_BASE) {
    throw new Error('Missing VITE_SUPABASE_FUNCTIONS_URL');
  }

  const res = await fetch(`${FN_BASE}/labor-crew-review`, {
    method: 'POST',
    headers: await getMeteredAuthHeaders(),
    body: JSON.stringify({
      jobContext: input.jobContext,
      currentCrew: input.current,
      scenarios: input.scenarios,
    }),
  });

  return parseEdgeFunctionJson<LaborCrewReviewResult & { error?: string }>(res);
}
