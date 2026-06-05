import type { PlannedEstimateSchedulePlan } from './estimateScheduleDatePlanner';

export interface EstimateScheduleTaskBaseline {
  candidateId: string;
  estimateLineItemId: string;
  title: string;
  baselineStartDate: string;
  baselineEndDate: string;
  durationDays: number;
  divisionKey: string;
  scopeKey: string;
}

export interface EstimateScheduleBaseline {
  baselineId: string;
  estimateVersionId: string;
  generatedAtIso: string;
  projectStartDate: string | null;
  projectFinishDate: string | null;
  totalDurationDays: number;
  taskBaselines: EstimateScheduleTaskBaseline[];
}

function parseYmd(date: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function isValidYmd(date: string | null | undefined): date is string {
  if (!date?.trim()) return false;
  return parseYmd(date) != null;
}

function toFiniteNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function inclusiveDurationDays(startDate: string, endDate: string): number {
  const start = parseYmd(startDate);
  const end = parseYmd(endDate);
  if (!start || !end) return 1;

  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (!Number.isFinite(diffDays) || diffDays < 0) return 1;
  return Math.max(1, diffDays + 1);
}

function buildEmptyBaseline(): EstimateScheduleBaseline {
  return {
    baselineId: '',
    estimateVersionId: '',
    generatedAtIso: '',
    projectStartDate: null,
    projectFinishDate: null,
    totalDurationDays: 0,
    taskBaselines: [],
  };
}

function buildBaselineId(estimateVersionId: string): string {
  const trimmed = estimateVersionId.trim();
  if (!trimmed) return 'estimate_schedule_baseline:preview';
  return `estimate_schedule_baseline:${trimmed}`;
}

function calculateProjectDurationDays(
  projectStartDate: string | null,
  projectFinishDate: string | null,
): number {
  if (!isValidYmd(projectStartDate) || !isValidYmd(projectFinishDate)) return 0;
  const duration = inclusiveDurationDays(projectStartDate, projectFinishDate);
  return Number.isFinite(duration) ? duration : 0;
}

export function buildEstimateScheduleBaseline(
  plan: PlannedEstimateSchedulePlan | null,
): EstimateScheduleBaseline {
  if (!plan) return buildEmptyBaseline();

  const taskBaselines: EstimateScheduleTaskBaseline[] = [];

  for (const division of plan.divisions) {
    for (const scope of division.scopes) {
      for (const task of scope.tasks) {
        const start = task.plannedStartDate?.trim();
        const end = task.plannedEndDate?.trim();
        if (!isValidYmd(start) || !isValidYmd(end) || start > end) continue;

        const durationDays = inclusiveDurationDays(start, end);
        if (!Number.isFinite(durationDays)) continue;

        taskBaselines.push({
          candidateId: task.candidateId,
          estimateLineItemId: task.source.estimateLineItemId,
          title: task.title.trim() || task.candidateId,
          baselineStartDate: start,
          baselineEndDate: end,
          durationDays,
          divisionKey: task.divisionKey,
          scopeKey: task.scopeKey,
        });
      }
    }
  }

  if (taskBaselines.length === 0) {
    return {
      baselineId: buildBaselineId(plan.meta.estimateVersionId),
      estimateVersionId: plan.meta.estimateVersionId,
      generatedAtIso: plan.meta.generatedAtIso,
      projectStartDate: null,
      projectFinishDate: null,
      totalDurationDays: 0,
      taskBaselines: [],
    };
  }

  const projectStartDate = taskBaselines
    .map((task) => task.baselineStartDate)
    .sort()[0];
  const projectFinishDate = taskBaselines
    .map((task) => task.baselineEndDate)
    .sort()
    .at(-1) ?? null;

  const totalDurationDays = calculateProjectDurationDays(projectStartDate, projectFinishDate);

  return {
    baselineId: buildBaselineId(plan.meta.estimateVersionId),
    estimateVersionId: plan.meta.estimateVersionId,
    generatedAtIso: plan.meta.generatedAtIso,
    projectStartDate: isValidYmd(projectStartDate) ? projectStartDate : null,
    projectFinishDate: isValidYmd(projectFinishDate) ? projectFinishDate : null,
    totalDurationDays: toFiniteNumber(totalDurationDays),
    taskBaselines,
  };
}

export function buildEstimateScheduleBaselineTaskMap(
  baseline: EstimateScheduleBaseline,
): Map<string, EstimateScheduleTaskBaseline> {
  return new Map(baseline.taskBaselines.map((task) => [task.candidateId, task]));
}
