import type { ConcreteLaborEstimateInput } from '../types/concreteLaborEstimate';
import { estimateProfessionalConcreteLabor } from './professionalConcreteLabor';

export interface CrewComposition {
  laborers: number;
  finishers: number;
  foremen: number;
}

export interface CrewScenario extends CrewComposition {
  crewSize: number;
  billableJobDurationHours: number;
  overtimeJobHours: number;
  totalLaborCost: number;
  totalManHours: number;
  laborCostPerCY: number;
  score: number;
}

export interface LaborCrewOptimizationResult {
  recommended: CrewScenario;
  scenarios: CrewScenario[];
  current: CrewScenario | null;
}

const POUR_DAY_TARGET_HOURS = 7;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function estimateScenarioCost(
  input: ConcreteLaborEstimateInput,
  crew: CrewComposition,
): CrewScenario {
  const result = estimateProfessionalConcreteLabor({ ...input, crew });
  const scenario: CrewScenario = {
    ...crew,
    crewSize: result.crewSize,
    billableJobDurationHours: result.billableJobDurationHours,
    overtimeJobHours: result.overtimeJobHours,
    totalLaborCost: result.costs.totalLaborCost,
    totalManHours: result.totalManHours,
    laborCostPerCY: result.unitCosts.laborCostPerCY,
    score: 0,
  };
  scenario.score = round2(scoreScenario(scenario));
  return scenario;
}

function scoreScenario(scenario: CrewScenario): number {
  const duration = scenario.billableJobDurationHours;
  const cost = scenario.totalLaborCost;

  const overtimePenalty =
    scenario.overtimeJobHours * 250 * scenario.crewSize;
  const longDayPenalty = duration > 10 ? (duration - 10) * 400 : 0;
  const rushPenalty = duration < 4 ? (4 - duration) * 150 : 0;
  const durationSweetSpot = Math.abs(duration - POUR_DAY_TARGET_HOURS) * 35;
  const finisherRatioPenalty =
    scenario.finishers / scenario.crewSize < 0.25 ? 1500 : 0;

  return cost + overtimePenalty + longDayPenalty + rushPenalty + durationSweetSpot + finisherRatioPenalty;
}

function minFinishers(input: ConcreteLaborEstimateInput): number {
  const area = input.areaSqFt;
  let min = 1;

  if (input.finishType === 'stamp' || input.finishType === 'exposed_aggregate') {
    min = Math.max(min, 2);
    if (area > 1500) min = Math.max(min, Math.ceil(area / 1200));
  } else if (input.finishType === 'hard_trowel' || input.finishType === 'burnished') {
    if (area > 2500) min = Math.max(min, 2);
  }

  if (input.weatherCondition === 'hot' || input.weatherCondition === 'extreme_hot') {
    min = Math.max(min, 2);
    if (area > 2000) min = Math.max(min, Math.ceil(area / 1800));
  }

  return min;
}

function minLaborers(input: ConcreteLaborEstimateInput): number {
  const volume = input.concreteYards;
  let min = 2;

  if (volume <= 8) min = 2;
  else if (volume <= 20) min = 3;
  else if (volume <= 40) min = 4;
  else min = Math.min(8, Math.ceil(volume / 10));

  if (input.placementMethod === 'wheelbarrow') min += 1;
  if (input.placementMethod === 'buggy') min = Math.max(min, 3);
  if (input.accessDifficulty === 'difficult' || input.accessDifficulty === 'severe') {
    min += 1;
  }

  return min;
}

function maxLaborers(input: ConcreteLaborEstimateInput): number {
  return Math.min(10, minLaborers(input) + 4);
}

function maxFinishers(input: ConcreteLaborEstimateInput): number {
  return Math.min(6, minFinishers(input) + 3);
}

function buildScenario(
  input: ConcreteLaborEstimateInput,
  crew: CrewComposition,
): CrewScenario {
  return estimateScenarioCost(input, crew);
}

export function optimizeLaborCrew(
  input: ConcreteLaborEstimateInput,
): LaborCrewOptimizationResult {
  const laborMin = minLaborers(input);
  const laborMax = maxLaborers(input);
  const finisherMin = minFinishers(input);
  const finisherMax = maxFinishers(input);
  const foremanOptions =
    input.concreteYards >= 25 || input.areaSqFt >= 4000
      ? [1]
      : [0, 1];

  const scenarios: CrewScenario[] = [];

  for (const foremen of foremanOptions) {
    for (let laborers = laborMin; laborers <= laborMax; laborers++) {
      for (let finishers = finisherMin; finishers <= finisherMax; finishers++) {
        const crewSize = laborers + finishers + foremen;
        if (crewSize < 3 || crewSize > 12) continue;
        if (finishers >= crewSize) continue;

        const scenario = buildScenario(input, { laborers, finishers, foremen });

        if (scenario.billableJobDurationHours > 12) continue;

        scenarios.push(scenario);
      }
    }
  }

  const ranked = [...scenarios].sort((a, b) => a.score - b.score);
  const recommended = ranked[0] ?? buildScenario(input, input.crew);
  const current = buildScenario(input, input.crew);

  return {
    recommended,
    scenarios: ranked.slice(0, 8),
    current,
  };
}
