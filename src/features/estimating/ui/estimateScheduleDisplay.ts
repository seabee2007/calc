import type {
  EstimateScheduleDatePlanResult,
  EstimateScheduleDependencyMode,
} from '../application/estimateScheduleDatePlanner';
import type {
  EstimateSchedulePlan,
  EstimateScheduleTaskCandidate,
  EstimateScheduleWarning,
  EstimateScheduleWarningCode,
} from '../domain/estimateScheduleTypes';
import {
  ESTIMATE_BLANK,
  formatEstimateBlank,
  formatEstimateHours,
  formatEstimateNumber,
} from './estimateFormatters';

const WARNING_LABELS: Record<EstimateScheduleWarningCode, string> = {
  missing_duration: 'Missing duration',
  missing_crew_size: 'Missing crew size',
  missing_hours_per_day: 'Missing hours per day',
  material_only_line: 'Material only',
  inspection_required: 'Inspection required',
  weather_sensitive: 'Weather sensitive',
};

function toFiniteNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function safeSum(values: number[]): number {
  return values.reduce((sum, value) => sum + toFiniteNumber(value), 0);
}

export function collectSchedulePlanCandidates(
  plan: EstimateSchedulePlan | null,
): EstimateScheduleTaskCandidate[] {
  if (!plan) return [];
  return plan.divisions.flatMap((division) =>
    division.scopes.flatMap((scope) => scope.tasks),
  );
}

export interface EstimateSchedulePreviewSummary {
  schedulableTasks: number;
  excludedTasks: number;
  totalLaborHours: number;
  totalManDays: number;
  totalLaborCrewDays: number;
  totalDurationDays: number;
  schedulableTasksDisplay: string;
  excludedTasksDisplay: string;
  totalLaborHoursDisplay: string;
  totalManDaysDisplay: string;
  totalLaborCrewDaysDisplay: string;
  totalDurationDaysDisplay: string;
}

export function extractSchedulePreviewSummary(
  plan: EstimateSchedulePlan | null,
): EstimateSchedulePreviewSummary {
  if (!plan) {
    return {
      schedulableTasks: 0,
      excludedTasks: 0,
      totalLaborHours: 0,
      totalManDays: 0,
      totalLaborCrewDays: 0,
      totalDurationDays: 0,
      schedulableTasksDisplay: formatEstimateNumber(0, { decimals: 0 }),
      excludedTasksDisplay: formatEstimateNumber(0, { decimals: 0 }),
      totalLaborHoursDisplay: ESTIMATE_BLANK,
      totalManDaysDisplay: ESTIMATE_BLANK,
      totalLaborCrewDaysDisplay: ESTIMATE_BLANK,
      totalDurationDaysDisplay: ESTIMATE_BLANK,
    };
  }

  const candidates = collectSchedulePlanCandidates(plan);
  const totalLaborHours = safeSum(
    candidates.map((candidate) => candidate.labor.adjustedLaborHours || candidate.labor.laborHours),
  );
  const totalManDays = safeSum(candidates.map((candidate) => candidate.labor.manDays));
  const totalLaborCrewDays = safeSum(candidates.map((candidate) => candidate.labor.crewDays));
  const totalDurationDays = safeSum(candidates.map((candidate) => candidate.labor.durationDays));

  return {
    schedulableTasks: plan.meta.scheduleEnabledTaskCount,
    excludedTasks: plan.meta.excludedTaskCount,
    totalLaborHours,
    totalManDays,
    totalLaborCrewDays,
    totalDurationDays,
    schedulableTasksDisplay: formatEstimateNumber(plan.meta.scheduleEnabledTaskCount, {
      decimals: 0,
    }),
    excludedTasksDisplay: formatEstimateNumber(plan.meta.excludedTaskCount, { decimals: 0 }),
    totalLaborHoursDisplay:
      totalLaborHours > 0 ? formatEstimateHours(totalLaborHours) : ESTIMATE_BLANK,
    totalManDaysDisplay:
      totalManDays > 0 ? formatEstimateNumber(totalManDays, { decimals: 2 }) : ESTIMATE_BLANK,
    totalLaborCrewDaysDisplay:
      totalLaborCrewDays > 0
        ? formatEstimateNumber(totalLaborCrewDays, { decimals: 2 })
        : ESTIMATE_BLANK,
    totalDurationDaysDisplay:
      totalDurationDays > 0
        ? `${formatEstimateNumber(totalDurationDays, { decimals: 1 })} days`
        : ESTIMATE_BLANK,
  };
}

export function hasSchedulableSchedulePreview(plan: EstimateSchedulePlan | null): boolean {
  return (plan?.meta.scheduleEnabledTaskCount ?? 0) > 0;
}

export function formatScheduleWarningLabel(code: EstimateScheduleWarningCode): string {
  return WARNING_LABELS[code] ?? formatEstimateBlank(code);
}

export function formatScheduleWarningList(warnings: EstimateScheduleWarning[]): string[] {
  return warnings.map((warning) => {
    const label = formatScheduleWarningLabel(warning.code);
    return warning.message.trim() ? `${label}: ${warning.message.trim()}` : label;
  });
}

export function formatScheduleLaborHours(value: number): string {
  const safe = toFiniteNumber(value);
  return safe > 0 ? formatEstimateHours(safe) : ESTIMATE_BLANK;
}

export function formatScheduleDays(value: number, decimals = 2): string {
  const safe = toFiniteNumber(value);
  return safe > 0 ? formatEstimateNumber(safe, { decimals }) : ESTIMATE_BLANK;
}

export function formatScheduleDurationDays(value: number): string {
  const safe = toFiniteNumber(value);
  return safe > 0 ? `${formatEstimateNumber(safe, { decimals: 1 })} days` : ESTIMATE_BLANK;
}

export function formatScheduleGroupLabel(key: string, label: string | null | undefined): string {
  const trimmedLabel = label?.trim();
  if (trimmedLabel) return trimmedLabel;
  const trimmedKey = key?.trim();
  if (trimmedKey) return trimmedKey;
  return ESTIMATE_BLANK;
}

export function formatScheduleTradeActivity(
  trade: string | undefined,
  activity: string | undefined,
): string {
  const parts = [trade?.trim(), activity?.trim()].filter((part) => part && part.length > 0);
  if (parts.length === 0) return ESTIMATE_BLANK;
  return parts.join(' · ');
}

export interface ScheduleDependencyModeOption {
  value: EstimateScheduleDependencyMode;
  label: string;
  description: string;
}

export function listScheduleDependencyModeOptions(): ScheduleDependencyModeOption[] {
  return [
    {
      value: 'sequential_by_project',
      label: 'Sequential across project',
      description: 'Chain every schedulable task finish-to-start across divisions and scopes.',
    },
    {
      value: 'sequential_by_scope',
      label: 'Sequential by scope',
      description: 'Chain tasks within each scope; each scope starts on the project start date.',
    },
    {
      value: 'none',
      label: 'All tasks start together',
      description: 'Every schedulable task begins on the project start date.',
    },
  ];
}

export function formatSchedulePlannedDate(value: string | null | undefined): string {
  if (value == null) return ESTIMATE_BLANK;
  const trimmed = value.trim();
  if (!trimmed) return ESTIMATE_BLANK;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return ESTIMATE_BLANK;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month ||
    parsed.getUTCDate() !== day
  ) {
    return ESTIMATE_BLANK;
  }

  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export interface EstimateScheduleDatePlanSummary {
  plannedProjectStart: string | null;
  plannedProjectFinish: string | null;
  totalPlannedDurationDays: number;
  scheduledTaskCount: number;
  excludedTaskCount: number;
  plannedProjectStartDisplay: string;
  plannedProjectFinishDisplay: string;
  totalPlannedDurationDaysDisplay: string;
  scheduledTaskCountDisplay: string;
  excludedTaskCountDisplay: string;
}

export function extractScheduleDatePlanSummary(
  datePlanResult: EstimateScheduleDatePlanResult | null,
  basePlan: EstimateSchedulePlan | null,
): EstimateScheduleDatePlanSummary {
  const scheduledTaskCount = basePlan?.meta.scheduleEnabledTaskCount ?? 0;
  const excludedTaskCount = basePlan?.meta.excludedTaskCount ?? 0;

  if (!datePlanResult) {
    return {
      plannedProjectStart: null,
      plannedProjectFinish: null,
      totalPlannedDurationDays: 0,
      scheduledTaskCount,
      excludedTaskCount,
      plannedProjectStartDisplay: ESTIMATE_BLANK,
      plannedProjectFinishDisplay: ESTIMATE_BLANK,
      totalPlannedDurationDaysDisplay: ESTIMATE_BLANK,
      scheduledTaskCountDisplay: formatEstimateNumber(scheduledTaskCount, { decimals: 0 }),
      excludedTaskCountDisplay: formatEstimateNumber(excludedTaskCount, { decimals: 0 }),
    };
  }

  const totalPlannedDurationDays = toFiniteNumber(datePlanResult.totalPlannedDurationDays);

  return {
    plannedProjectStart: datePlanResult.plannedProjectStart,
    plannedProjectFinish: datePlanResult.plannedProjectFinish,
    totalPlannedDurationDays,
    scheduledTaskCount,
    excludedTaskCount,
    plannedProjectStartDisplay: formatSchedulePlannedDate(datePlanResult.plannedProjectStart),
    plannedProjectFinishDisplay: formatSchedulePlannedDate(datePlanResult.plannedProjectFinish),
    totalPlannedDurationDaysDisplay:
      totalPlannedDurationDays > 0
        ? `${formatEstimateNumber(totalPlannedDurationDays, { decimals: 0 })} days`
        : ESTIMATE_BLANK,
    scheduledTaskCountDisplay: formatEstimateNumber(scheduledTaskCount, { decimals: 0 }),
    excludedTaskCountDisplay: formatEstimateNumber(excludedTaskCount, { decimals: 0 }),
  };
}
