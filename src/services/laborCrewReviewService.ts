import type { ConcreteLaborEstimateInput } from '../types/concreteLaborEstimate';
import type { CrewScenario } from '../utils/laborCrewOptimizer';

const FN_BASE = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

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
  if (!FN_BASE || !ANON_KEY) {
    throw new Error('Missing VITE_SUPABASE_FUNCTIONS_URL or VITE_SUPABASE_ANON_KEY');
  }

  const res = await fetch(`${FN_BASE}/labor-crew-review`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({
      jobContext: input.jobContext,
      currentCrew: input.current,
      scenarios: input.scenarios,
    }),
  });

  const data = (await res.json()) as LaborCrewReviewResult | { error?: string };

  if (!res.ok) {
    const message =
      'error' in data && data.error
        ? data.error
        : `Crew review failed (${res.status})`;
    throw new Error(message);
  }

  if ('error' in data && data.error) {
    throw new Error(data.error);
  }

  return data as LaborCrewReviewResult;
}
