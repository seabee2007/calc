import type {
  AccessDifficulty,
  ConcreteLaborEstimateInput,
  FinishType,
  LaborPlacementMethod,
  ProfessionalConcreteLaborResult,
  ProfessionalConcreteLaborTaskHours,
  ReinforcementType,
  WeatherCondition,
} from '../types/concreteLaborEstimate';

export const PLACEMENT_METHOD_FACTOR: Record<LaborPlacementMethod, number> = {
  chute: 1.0,
  pump: 1.25,
  buggy: 0.75,
  wheelbarrow: 0.45,
};

export const FINISH_TYPE_FACTOR: Record<FinishType, number> = {
  broom: 1.0,
  hard_trowel: 0.8,
  burnished: 0.7,
  stamp: 0.55,
  exposed_aggregate: 0.65,
};

export const ACCESS_FACTOR: Record<AccessDifficulty, number> = {
  easy: 1.0,
  moderate: 0.85,
  difficult: 0.65,
  severe: 0.45,
};

export const WEATHER_FACTOR: Record<WeatherCondition, number> = {
  normal: 1.0,
  hot: 0.9,
  extreme_hot: 0.75,
  rainy: 0.7,
  windy: 0.85,
};

const TASK_RATES = {
  mobilizationHours: 1.5,
  subgradePrepHours: 0.75,
  formworkEdgePrepSqFtPerCrewHour: 4000,
  vaporBarrierSqFtPerCrewHour: 1200,

  placementCYPerCrewHour: {
    chute: 4.5,
    pump: 7.0,
    buggy: 3.0,
    wheelbarrow: 1.75,
  } satisfies Record<LaborPlacementMethod, number>,

  screedSqFtPerCrewHour: 750,
  bullFloatSqFtPerCrewHour: 1200,
  broomFinishSqFtPerCrewHour: 1000,
  hardTrowelSqFtPerCrewHour: 600,
  stampSqFtPerCrewHour: 300,
  exposedAggregateSqFtPerCrewHour: 450,
  edgingSqFtPerCrewHour: 1800,

  rebarSqFtPerCrewHour: {
    none: 999_999,
    wire_mesh: 900,
    rebar_single_mat: 350,
    rebar_double_mat: 200,
  } satisfies Record<ReinforcementType, number>,

  sawCutLfPerCrewHour: 250,
  curingSqFtPerCrewHour: 2500,
  curingMinimumHours: 0.25,
  cleanupHours: 1.0,
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function finishHoursForType(
  areaSqFt: number,
  finishType: FinishType,
  finishFactor: number,
): number {
  if (areaSqFt <= 0) return 0;

  const rate =
    finishType === 'broom'
      ? TASK_RATES.broomFinishSqFtPerCrewHour
      : finishType === 'hard_trowel' || finishType === 'burnished'
        ? TASK_RATES.hardTrowelSqFtPerCrewHour
        : finishType === 'stamp'
          ? TASK_RATES.stampSqFtPerCrewHour
          : finishType === 'exposed_aggregate'
            ? TASK_RATES.exposedAggregateSqFtPerCrewHour
            : TASK_RATES.broomFinishSqFtPerCrewHour;

  return areaSqFt / (rate * finishFactor);
}

/** Estimate perimeter LF for jointing when only area is known (square footprint). */
function estimateJointLinearFeet(areaSqFt: number): number {
  if (areaSqFt <= 0) return 0;
  const side = Math.sqrt(areaSqFt);
  return 4 * side;
}

/**
 * Task-based, crew-hour concrete labor estimate (planning / proposal level).
 * Total cost = Σ(task crew-hours × crew × burdened rates) + OT + supervision + tools + contingency.
 */
export function estimateProfessionalConcreteLabor(
  input: ConcreteLaborEstimateInput,
): ProfessionalConcreteLaborResult {
  const crewSize =
    input.crew.laborers + input.crew.finishers + input.crew.foremen;

  const burdenedLaborerRate =
    input.rates.laborerRate * input.rates.burdenMultiplier;
  const burdenedFinisherRate =
    input.rates.finisherRate * input.rates.burdenMultiplier;
  const burdenedForemanRate =
    input.rates.foremanRate * input.rates.burdenMultiplier;

  const averageCrewRate =
    (input.crew.laborers * burdenedLaborerRate +
      input.crew.finishers * burdenedFinisherRate +
      input.crew.foremen * burdenedForemanRate) /
    Math.max(crewSize, 1);

  const placementFactor =
    PLACEMENT_METHOD_FACTOR[input.placementMethod] *
    ACCESS_FACTOR[input.accessDifficulty] *
    WEATHER_FACTOR[input.weatherCondition];

  const finishFactor =
    FINISH_TYPE_FACTOR[input.finishType] *
    ACCESS_FACTOR[input.accessDifficulty] *
    WEATHER_FACTOR[input.weatherCondition];

  const areaSqFt = Math.max(0, input.areaSqFt);
  const concreteYards = Math.max(0, input.concreteYards);

  const mobilization = TASK_RATES.mobilizationHours;

  const subgradePrep =
    areaSqFt > 0
      ? TASK_RATES.subgradePrepHours * (areaSqFt > 3000 ? 1.15 : 1)
      : TASK_RATES.subgradePrepHours * 0.5;

  const formworkEdgePrep =
    areaSqFt > 0
      ? areaSqFt / (TASK_RATES.formworkEdgePrepSqFtPerCrewHour * placementFactor)
      : 0.5;

  const vaporBarrier = input.options.vaporBarrier
    ? areaSqFt / TASK_RATES.vaporBarrierSqFtPerCrewHour
    : 0;

  const reinforcement =
    input.reinforcementType === 'none'
      ? 0
      : areaSqFt / TASK_RATES.rebarSqFtPerCrewHour[input.reinforcementType];

  const placement =
    concreteYards > 0
      ? concreteYards /
        (TASK_RATES.placementCYPerCrewHour[input.placementMethod] * placementFactor)
      : 0;

  const screeding =
    areaSqFt > 0
      ? areaSqFt / (TASK_RATES.screedSqFtPerCrewHour * placementFactor)
      : 0;

  const bullFloating =
    areaSqFt > 0
      ? areaSqFt / (TASK_RATES.bullFloatSqFtPerCrewHour * finishFactor)
      : 0;

  const finishing = finishHoursForType(areaSqFt, input.finishType, finishFactor);

  const edgingJointing = input.options.sawCutJoints
    ? estimateJointLinearFeet(areaSqFt) / TASK_RATES.sawCutLfPerCrewHour
    : areaSqFt > 0
      ? areaSqFt / (TASK_RATES.edgingSqFtPerCrewHour * finishFactor)
      : 0;

  const curing = input.options.curingCompound
    ? areaSqFt > 0
      ? areaSqFt / TASK_RATES.curingSqFtPerCrewHour
      : TASK_RATES.curingMinimumHours
    : TASK_RATES.curingMinimumHours;

  const cleanup = input.options.includeCleanup ? TASK_RATES.cleanupHours : 0;

  const taskHours: ProfessionalConcreteLaborTaskHours = {
    mobilization: round2(mobilization),
    subgradePrep: round2(subgradePrep),
    formworkEdgePrep: round2(formworkEdgePrep),
    vaporBarrier: round2(vaporBarrier),
    reinforcement: round2(reinforcement),
    placement: round2(placement),
    screeding: round2(screeding),
    bullFloating: round2(bullFloating),
    edgingJointing: round2(edgingJointing),
    finishing: round2(finishing),
    curing: round2(curing),
    cleanup: round2(cleanup),
  };

  const directCrewHours = round2(
    Object.values(taskHours).reduce((sum, h) => sum + h, 0),
  );

  const minimumHours = input.options.smallJobMinimum ? 4 : 2;
  const billableCrewHours = round2(Math.max(directCrewHours, minimumHours));

  const regularHours = Math.min(billableCrewHours, 8);
  const overtimeHours = round2(Math.max(billableCrewHours - 8, 0));

  const regularCost = regularHours * crewSize * averageCrewRate;
  const overtimeCost =
    overtimeHours * crewSize * averageCrewRate * input.rates.overtimeMultiplier;

  const supervisionCost =
    input.crew.foremen > 0
      ? billableCrewHours * input.crew.foremen * burdenedForemanRate
      : 0;

  const smallToolsAndPpe = (regularCost + overtimeCost) * 0.05;

  const contingency = input.options.includeContingency
    ? (regularCost + overtimeCost + supervisionCost) * 0.1
    : 0;

  const totalLaborCost =
    regularCost + overtimeCost + supervisionCost + smallToolsAndPpe + contingency;

  return {
    crewSize,
    averageCrewRate: round2(averageCrewRate),
    burdenedRates: {
      laborer: round2(burdenedLaborerRate),
      finisher: round2(burdenedFinisherRate),
      foreman: round2(burdenedForemanRate),
    },
    taskHours,
    directCrewHours,
    billableCrewHours,
    regularHours: round2(regularHours),
    overtimeHours,
    costs: {
      regularCost: round2(regularCost),
      overtimeCost: round2(overtimeCost),
      supervisionCost: round2(supervisionCost),
      smallToolsAndPpe: round2(smallToolsAndPpe),
      contingency: round2(contingency),
      totalLaborCost: round2(totalLaborCost),
    },
    unitCosts: {
      laborCostPerCY:
        concreteYards > 0 ? round2(totalLaborCost / concreteYards) : 0,
      laborCostPerSqFt: areaSqFt > 0 ? round2(totalLaborCost / areaSqFt) : 0,
    },
    placementFactor: round2(placementFactor),
    finishFactor: round2(finishFactor),
  };
}
