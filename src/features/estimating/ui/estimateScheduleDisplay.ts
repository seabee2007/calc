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
  totalCrewDays: number;
  totalDurationDays: number;
  schedulableTasksDisplay: string;
  excludedTasksDisplay: string;
  totalLaborHoursDisplay: string;
  totalManDaysDisplay: string;
  totalCrewDaysDisplay: string;
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
      totalCrewDays: 0,
      totalDurationDays: 0,
      schedulableTasksDisplay: formatEstimateNumber(0, { decimals: 0 }),
      excludedTasksDisplay: formatEstimateNumber(0, { decimals: 0 }),
      totalLaborHoursDisplay: ESTIMATE_BLANK,
      totalManDaysDisplay: ESTIMATE_BLANK,
      totalCrewDaysDisplay: ESTIMATE_BLANK,
      totalDurationDaysDisplay: ESTIMATE_BLANK,
    };
  }

  const candidates = collectSchedulePlanCandidates(plan);
  const totalLaborHours = safeSum(
    candidates.map((candidate) => candidate.labor.adjustedLaborHours || candidate.labor.laborHours),
  );
  const totalManDays = safeSum(candidates.map((candidate) => candidate.labor.manDays));
  const totalCrewDays = safeSum(candidates.map((candidate) => candidate.labor.crewDays));
  const totalDurationDays = safeSum(candidates.map((candidate) => candidate.labor.durationDays));

  return {
    schedulableTasks: plan.meta.scheduleEnabledTaskCount,
    excludedTasks: plan.meta.excludedTaskCount,
    totalLaborHours,
    totalManDays,
    totalCrewDays,
    totalDurationDays,
    schedulableTasksDisplay: formatEstimateNumber(plan.meta.scheduleEnabledTaskCount, {
      decimals: 0,
    }),
    excludedTasksDisplay: formatEstimateNumber(plan.meta.excludedTaskCount, { decimals: 0 }),
    totalLaborHoursDisplay:
      totalLaborHours > 0 ? formatEstimateHours(totalLaborHours) : ESTIMATE_BLANK,
    totalManDaysDisplay:
      totalManDays > 0 ? formatEstimateNumber(totalManDays, { decimals: 2 }) : ESTIMATE_BLANK,
    totalCrewDaysDisplay:
      totalCrewDays > 0 ? formatEstimateNumber(totalCrewDays, { decimals: 2 }) : ESTIMATE_BLANK,
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
