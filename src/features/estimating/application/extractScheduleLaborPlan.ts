import {
  calculateCrewDays,
  calculateDurationDays,
  calculateManDays,
  sanitizeFiniteNumber,
} from '../domain/estimateMath';
import type { EstimateScheduleLaborPlan } from '../domain/estimateScheduleTypes';
import type { EstimateDomainTask } from '../infrastructure/estimateDbTypes';
import { computeTaskRollupSlice } from './estimateGroupRollups';

const DEFAULT_CREW_SIZE = 1;
const DEFAULT_HOURS_PER_DAY = 8;
const DEFAULT_PARALLEL_CREWS = 1;

function safeNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function finiteNonNegative(value: number): number {
  return sanitizeFiniteNumber(value, 0);
}

function parseMetrics(task: EstimateDomainTask): Record<string, unknown> {
  const raw = task.calculatedValues.metrics;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

function readLaborInputs(task: EstimateDomainTask): {
  crewSize: number;
  hoursPerDay: number;
  parallelCrews: number;
  crewSizeProvided: boolean;
  hoursPerDayProvided: boolean;
} {
  const labor = task.lineItem.labor;
  const crewSizeProvided = labor?.crewSize != null && Number.isFinite(labor.crewSize);
  const hoursPerDayProvided = labor?.hoursPerDay != null && Number.isFinite(labor.hoursPerDay);

  return {
    crewSize: crewSizeProvided ? finiteNonNegative(labor!.crewSize!) : DEFAULT_CREW_SIZE,
    hoursPerDay: hoursPerDayProvided
      ? finiteNonNegative(labor!.hoursPerDay!)
      : DEFAULT_HOURS_PER_DAY,
    parallelCrews: finiteNonNegative(labor?.parallelCrews ?? DEFAULT_PARALLEL_CREWS) || DEFAULT_PARALLEL_CREWS,
    crewSizeProvided,
    hoursPerDayProvided,
  };
}

export interface ExtractScheduleLaborPlanResult {
  labor: EstimateScheduleLaborPlan;
  hasLabor: boolean;
  crewSizeProvided: boolean;
  hoursPerDayProvided: boolean;
}

/** Extract normalized labor metrics from a saved estimate domain task. */
export function extractScheduleLaborPlan(task: EstimateDomainTask): ExtractScheduleLaborPlanResult {
  const metrics = parseMetrics(task);
  const slice = computeTaskRollupSlice(task);
  const inputs = readLaborInputs(task);

  let laborHours = safeNumber(metrics.laborHours);
  let adjustedLaborHours = safeNumber(metrics.adjustedLaborHours);

  if (adjustedLaborHours <= 0 && laborHours > 0) {
    adjustedLaborHours = laborHours;
  }
  if (laborHours <= 0 && adjustedLaborHours > 0) {
    laborHours = adjustedLaborHours;
  }
  if (laborHours <= 0 && adjustedLaborHours <= 0) {
    laborHours = slice.laborHours;
    adjustedLaborHours = slice.laborHours;
  }

  const hoursForDuration = adjustedLaborHours > 0 ? adjustedLaborHours : laborHours;
  const hasLabor = hoursForDuration > 0;

  let manDays = safeNumber(metrics.manDays);
  let crewDays = safeNumber(metrics.crewDays);
  let durationDays = safeNumber(metrics.durationDays);

  if (hoursForDuration > 0) {
    manDays = calculateManDays(hoursForDuration, inputs.hoursPerDay);
  } else if (manDays <= 0) {
    manDays = slice.manDays;
  }

  if (hoursForDuration > 0) {
    crewDays = calculateCrewDays(hoursForDuration, inputs.crewSize, inputs.hoursPerDay);
  } else if (crewDays <= 0) {
    crewDays = slice.crewDays;
  }

  if (crewDays > 0) {
    durationDays = calculateDurationDays(crewDays, inputs.parallelCrews);
  } else if (durationDays <= 0) {
    durationDays = slice.durationDays;
  }

  if (hasLabor && durationDays < 1) {
    durationDays = 1;
  }

  const labor: EstimateScheduleLaborPlan = {
    laborHours: finiteNonNegative(laborHours),
    adjustedLaborHours: finiteNonNegative(adjustedLaborHours),
    manDays: finiteNonNegative(manDays),
    crewDays: finiteNonNegative(crewDays),
    durationDays: finiteNonNegative(durationDays),
    crewSize: inputs.crewSize,
    hoursPerDay: inputs.hoursPerDay,
    parallelCrews: inputs.parallelCrews,
  };

  return {
    labor,
    hasLabor,
    crewSizeProvided: inputs.crewSizeProvided,
    hoursPerDayProvided: inputs.hoursPerDayProvided,
  };
}
