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

/** Whole-crew placement productivity (CY per clock hour on site). */
const PLACEMENT_CY_PER_JOB_HOUR: Record<LaborPlacementMethod, number> = {
  chute: 10,
  pump: 12,
  buggy: 6,
  wheelbarrow: 3.5,
};

const TASK_RATES = {
  mobilizationHours: 1.5,
  subgradePrepHours: 0.75,
  formworkEdgePrepSqFtPerJobHour: 4000,
  vaporBarrierSqFtPerJobHour: 1200,

  screedSqFtPerJobHour: 750,
  bullFloatSqFtPerJobHour: 1200,
  broomFinishSqFtPerJobHour: 1000,
  hardTrowelSqFtPerJobHour: 600,
  stampSqFtPerJobHour: 300,
  exposedAggregateSqFtPerJobHour: 450,
  edgingSqFtPerJobHour: 1800,

  rebarSqFtPerJobHour: {
    none: 999_999,
    wire_mesh: 900,
    rebar_single_mat: 350,
    rebar_double_mat: 200,
  } satisfies Record<ReinforcementType, number>,

  sawCutLfPerJobHour: 250,
  curingSqFtPerJobHour: 2500,
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
      ? TASK_RATES.broomFinishSqFtPerJobHour
      : finishType === 'hard_trowel' || finishType === 'burnished'
        ? TASK_RATES.hardTrowelSqFtPerJobHour
        : finishType === 'stamp'
          ? TASK_RATES.stampSqFtPerJobHour
          : finishType === 'exposed_aggregate'
            ? TASK_RATES.exposedAggregateSqFtPerJobHour
            : TASK_RATES.broomFinishSqFtPerJobHour;

  return areaSqFt / (rate * finishFactor);
}

function estimateJointLinearFeet(areaSqFt: number): number {
  if (areaSqFt <= 0) return 0;
  return 4 * Math.sqrt(areaSqFt);
}

/**
 * Pour-day clock duration: prep/mobilize, then max(placement, finishing stack), then cure/cleanup.
 * Finishing tasks overlap placement — not additive with placement clock.
 */
function estimatePourDayJobHours(taskHours: ProfessionalConcreteLaborTaskHours): number {
  const finishingCore = Math.max(
    taskHours.screeding,
    taskHours.bullFloating,
    taskHours.finishing,
  );
  const finishingStack = finishingCore + taskHours.edgingJointing * 0.5;

  const placementAndFinish = Math.max(taskHours.placement, finishingStack);

  return (
    taskHours.mobilization +
    placementAndFinish +
    taskHours.curing +
    taskHours.cleanup
  );
}

/**
 * Task-based labor estimate. Task lines are clock hours; job duration uses parallel logic.
 * Cost = man-hours (job clock × crew) × burdened blended rate; OT only when job clock > 8.
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
  const impliedThicknessInches =
    areaSqFt > 0 && concreteYards > 0
      ? round2(((concreteYards * 27) / areaSqFt) * 12)
      : undefined;

  const areaReconciledFromVolume =
    impliedThicknessInches != null &&
    Math.abs(impliedThicknessInches - input.thicknessInches) > 2;

  const mobilization = TASK_RATES.mobilizationHours;

  const subgradePrep =
    areaSqFt > 0
      ? TASK_RATES.subgradePrepHours * (areaSqFt > 3000 ? 1.15 : 1)
      : TASK_RATES.subgradePrepHours * 0.5;

  const formworkEdgePrep =
    areaSqFt > 0
      ? areaSqFt / (TASK_RATES.formworkEdgePrepSqFtPerJobHour * placementFactor)
      : 0.5;

  const vaporBarrier = input.options.vaporBarrier
    ? areaSqFt / TASK_RATES.vaporBarrierSqFtPerJobHour
    : 0;

  const reinforcement =
    input.reinforcementType === 'none'
      ? 0
      : areaSqFt / TASK_RATES.rebarSqFtPerJobHour[input.reinforcementType];

  const placementBase =
    PLACEMENT_CY_PER_JOB_HOUR[input.placementMethod] * placementFactor;
  const placement =
    concreteYards > 0 && placementBase > 0
      ? concreteYards / placementBase
      : 0;

  const screeding =
    areaSqFt > 0
      ? areaSqFt / (TASK_RATES.screedSqFtPerJobHour * placementFactor)
      : 0;

  const bullFloating =
    areaSqFt > 0
      ? areaSqFt / (TASK_RATES.bullFloatSqFtPerJobHour * finishFactor)
      : 0;

  const finishing = finishHoursForType(areaSqFt, input.finishType, finishFactor);

  const edgingJointing = input.options.sawCutJoints
    ? estimateJointLinearFeet(areaSqFt) / TASK_RATES.sawCutLfPerJobHour
    : areaSqFt > 0
      ? areaSqFt / (TASK_RATES.edgingSqFtPerJobHour * finishFactor)
      : 0;

  const curing = input.options.curingCompound
    ? areaSqFt > 0
      ? areaSqFt / TASK_RATES.curingSqFtPerJobHour
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

  const estimatedJobDurationHours = round2(estimatePourDayJobHours(taskHours));

  const minimumJobHours = input.options.smallJobMinimum ? 4 : 2;
  const billableJobDurationHours = round2(
    Math.max(estimatedJobDurationHours, minimumJobHours),
  );

  const regularJobHours = Math.min(billableJobDurationHours, 8);
  const overtimeJobHours = round2(Math.max(billableJobDurationHours - 8, 0));

  const totalManHours = round2(billableJobDurationHours * crewSize);
  const regularManHours = round2(regularJobHours * crewSize);
  const overtimeManHours = round2(overtimeJobHours * crewSize);

  const regularCost = regularManHours * averageCrewRate;
  const overtimeCost =
    overtimeManHours * averageCrewRate * input.rates.overtimeMultiplier;

  const smallToolsAndPpe = (regularCost + overtimeCost) * 0.05;

  const contingency = input.options.includeContingency
    ? (regularCost + overtimeCost) * 0.1
    : 0;

  const totalLaborCost =
    regularCost + overtimeCost + smallToolsAndPpe + contingency;

  return {
    crewSize,
    averageCrewRate: round2(averageCrewRate),
    burdenedRates: {
      laborer: round2(burdenedLaborerRate),
      finisher: round2(burdenedFinisherRate),
      foreman: round2(burdenedForemanRate),
    },
    taskHours,
    estimatedJobDurationHours,
    billableJobDurationHours,
    totalManHours,
    regularJobHours: round2(regularJobHours),
    overtimeJobHours,
    regularManHours,
    overtimeManHours,
    costs: {
      regularCost: round2(regularCost),
      overtimeCost: round2(overtimeCost),
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
    areaReconciledFromVolume,
    impliedThicknessInches,
  };
}
