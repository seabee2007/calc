import type { ProjectConstructionActivity } from '../domain/constructionActivityTypes';
import type { ScheduleActivity } from '../scheduling/adapters/estimateLineItemsToScheduleActivities';
import type { CpmActivityResult } from '../scheduling/cpmTypes';

const DEFAULT_HOURS_PER_DAY = 8;

function normalizeNonNegative(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  return 0;
}

function normalizePositive(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  return fallback;
}

export interface CalculateLaborPlanningMetricsInput {
  /** Total labor/man hours from the current estimate rollup. */
  laborHours: number;
  /** Construction activities for fallback crew/duration when schedule data is partial. */
  activities?: readonly ProjectConstructionActivity[];
  /** Schedule activities used by Logic Network / CPM / Level III Gantt. */
  scheduleActivities?: readonly ScheduleActivity[];
  /** CPM project duration — same value shown in Level III Gantt summary. */
  projectDurationDays?: number | null;
  /** CPM activity dates for duration fallback when projectDurationDays is unavailable. */
  cpmActivities?: readonly CpmActivityResult[];
  /** Hours per work day from estimate/company settings. */
  hoursPerDay?: number;
}

export interface LaborPlanningMetricsResult {
  laborHours: number;
  manDays: number;
  /** Effort-based: sum(manDays ÷ crewSize) per activity. */
  laborCrewDays: number;
  /** Schedule-based: sum(durationDays × crewSize) — headcount resource-days. */
  scheduledCrewDays: number;
  /** CPM/Gantt project span in work days. */
  projectDurationDays: number;
}

function resolveActivityDurationDays(activity: ProjectConstructionActivity): number {
  const effectiveDuration =
    activity.effectiveDurationDays ??
    activity.calculatedDurationDays ??
    activity.durationDaysOverride ??
    0;
  return Math.max(0, Math.ceil(effectiveDuration));
}

function resolveEstimatedDurationDays(input: CalculateLaborPlanningMetricsInput): number {
  const fromCpm = normalizeNonNegative(input.projectDurationDays);
  if (fromCpm > 0) return fromCpm;

  const cpmActivities = input.cpmActivities ?? [];
  if (cpmActivities.length > 0) {
    const minEs = Math.min(...cpmActivities.map((activity) => activity.earlyStart));
    const maxEf = Math.max(...cpmActivities.map((activity) => activity.earlyFinish));
    const span = maxEf - minEs;
    if (span > 0) return span;
  }

  const scheduleActivities = input.scheduleActivities ?? [];
  if (scheduleActivities.length > 0) {
    return scheduleActivities.reduce((sum, activity) => sum + activity.durationDays, 0);
  }

  const constructionActivities = input.activities ?? [];
  let maxDuration = 0;
  for (const activity of constructionActivities) {
    if (!activity.scheduleEnabled) continue;
    maxDuration = Math.max(maxDuration, resolveActivityDurationDays(activity));
  }
  return maxDuration;
}

function resolveActivityManDays(
  activity: ScheduleActivity,
  hoursPerDay: number,
): number {
  const fromField = normalizeNonNegative(activity.manDays);
  if (fromField > 0) return fromField;
  const laborHours = normalizeNonNegative(activity.laborHours);
  return laborHours > 0 ? laborHours / hoursPerDay : 0;
}

function resolveLaborCrewDays(
  input: CalculateLaborPlanningMetricsInput,
  manDays: number,
  hoursPerDay: number,
): number {
  const scheduleActivities = input.scheduleActivities ?? [];
  if (scheduleActivities.length > 0) {
    const laborCrewDays = scheduleActivities.reduce((sum, activity) => {
      const crewSize = normalizePositive(activity.crewSize, 0);
      const activityManDays = resolveActivityManDays(activity, hoursPerDay);
      return crewSize > 0 && activityManDays > 0 ? sum + activityManDays / crewSize : sum;
    }, 0);
    if (laborCrewDays > 0) return laborCrewDays;
  }

  const constructionActivities = input.activities ?? [];
  let fromConstruction = 0;
  for (const activity of constructionActivities) {
    if (!activity.scheduleEnabled) continue;
    const crewSize = normalizePositive(activity.crewSize, 0);
    const laborHours = normalizeNonNegative(activity.calculatedManHours);
    const activityManDays =
      normalizeNonNegative(activity.calculatedManDays) > 0
        ? activity.calculatedManDays!
        : laborHours / hoursPerDay;
    if (crewSize > 0 && activityManDays > 0) {
      fromConstruction += activityManDays / crewSize;
    }
  }
  if (fromConstruction > 0) return fromConstruction;

  return manDays;
}

function resolveScheduledCrewDays(
  input: CalculateLaborPlanningMetricsInput,
  manDays: number,
): number {
  const scheduleActivities = input.scheduleActivities ?? [];
  if (scheduleActivities.length > 0) {
    const scheduledCrewDays = scheduleActivities.reduce(
      (sum, activity) => sum + activity.durationDays * normalizePositive(activity.crewSize, 0),
      0,
    );
    if (scheduledCrewDays > 0) return scheduledCrewDays;
  }

  const constructionActivities = input.activities ?? [];
  let fromConstruction = 0;
  for (const activity of constructionActivities) {
    if (!activity.scheduleEnabled) continue;
    const durationDays = resolveActivityDurationDays(activity);
    const crewSize = normalizePositive(activity.crewSize, 0);
    if (durationDays > 0 && crewSize > 0) {
      fromConstruction += durationDays * crewSize;
    }
  }
  if (fromConstruction > 0) return fromConstruction;

  return manDays;
}

/**
 * Pure helper for Costs & Markup labor planning metrics.
 *
 * Terminology (construction planning):
 * - Man-days = total labor hours ÷ hours per day
 * - laborCrewDays = sum(manDays ÷ crewSize) — effort-based calendar crew-days
 * - scheduledCrewDays = sum(durationDays × crewSize) — headcount resource-days
 * - projectDurationDays = CPM project span (same as Level III Gantt summary)
 */
export function calculateLaborPlanningMetrics(
  input: CalculateLaborPlanningMetricsInput,
): LaborPlanningMetricsResult {
  const laborHours = normalizeNonNegative(input.laborHours);
  const hoursPerDay = normalizePositive(input.hoursPerDay, DEFAULT_HOURS_PER_DAY);
  const manDays = laborHours > 0 ? laborHours / hoursPerDay : 0;
  const laborCrewDays = resolveLaborCrewDays(input, manDays, hoursPerDay);
  const scheduledCrewDays = resolveScheduledCrewDays(input, manDays);
  const projectDurationDays = resolveEstimatedDurationDays(input);

  return {
    laborHours,
    manDays,
    laborCrewDays,
    scheduledCrewDays,
    projectDurationDays,
  };
}
