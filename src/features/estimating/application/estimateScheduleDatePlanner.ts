import type {
  EstimateSchedulePlan,
  EstimateScheduleTaskCandidate,
  EstimateScheduleWarning,
} from '../domain/estimateScheduleTypes';
import { addDaysToScheduleDate, resolveScheduleEventDurationDays } from './mapScheduleCandidateToScheduleEventInput';
import { sortScheduleCandidatesBySortOrder } from './scheduleCandidateOrdering';

export type EstimateScheduleDependencyMode =
  | 'sequential_by_scope'
  | 'sequential_by_project'
  | 'none';

export interface EstimateScheduleDatePlannerOptions {
  projectStartDate: string;
  /** JS UTC day numbers where 0 = Sunday and 1 = Monday. Default Monday–Friday. */
  workWeek?: number[];
  includeWeekends?: boolean;
  dependencyMode?: EstimateScheduleDependencyMode;
}

export type PlannedEstimateScheduleTaskCandidate = Omit<
  EstimateScheduleTaskCandidate,
  'plannedStartDate' | 'plannedEndDate'
> & {
  plannedStartDate: string;
  plannedEndDate: string;
};

export interface PlannedEstimateScheduleScopeGroup {
  key: string;
  label: string;
  divisionKey: string;
  rollup: EstimateSchedulePlan['divisions'][number]['scopes'][number]['rollup'];
  tasks: PlannedEstimateScheduleTaskCandidate[];
}

export interface PlannedEstimateScheduleGroup {
  key: string;
  label: string;
  rollup: EstimateSchedulePlan['divisions'][number]['rollup'];
  scopes: PlannedEstimateScheduleScopeGroup[];
}

export interface PlannedEstimateSchedulePlan {
  meta: EstimateSchedulePlan['meta'];
  divisions: PlannedEstimateScheduleGroup[];
}

export interface EstimateScheduleDatePlanResult {
  plan: PlannedEstimateSchedulePlan;
  warnings: EstimateScheduleWarning[];
  totalPlannedDurationDays: number;
  plannedProjectStart: string;
  plannedProjectFinish: string | null;
}

const DEFAULT_WORK_WEEK = [1, 2, 3, 4, 5];

interface PlannedDateRange {
  startDate: string;
  endDate: string;
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

function getUtcDayOfWeek(date: string): number {
  return parseYmd(date)?.getUTCDay() ?? 0;
}

function isWorkingDay(date: string, workWeek: number[]): boolean {
  return workWeek.includes(getUtcDayOfWeek(date));
}

function snapToWorkingDay(
  date: string,
  workWeek: number[],
  includeWeekends: boolean,
): string {
  if (includeWeekends) return date;

  let current = date;
  for (let guard = 0; guard < 14; guard += 1) {
    if (isWorkingDay(current, workWeek)) return current;
    current = addDaysToScheduleDate(current, 1);
  }

  return date;
}

function addInclusiveDuration(
  startDate: string,
  durationDays: number,
  workWeek: number[],
  includeWeekends: boolean,
): PlannedDateRange {
  const duration = Math.max(1, Math.ceil(durationDays));
  const start = snapToWorkingDay(startDate, workWeek, includeWeekends);

  if (includeWeekends) {
    return {
      startDate: start,
      endDate: addDaysToScheduleDate(start, duration - 1),
    };
  }

  let current = start;
  let remaining = duration - 1;

  while (remaining > 0) {
    current = addDaysToScheduleDate(current, 1);
    if (isWorkingDay(current, workWeek)) {
      remaining -= 1;
    }
  }

  return { startDate: start, endDate: current };
}

function nextStartAfterEnd(
  endDate: string,
  workWeek: number[],
  includeWeekends: boolean,
): string {
  return snapToWorkingDay(addDaysToScheduleDate(endDate, 1), workWeek, includeWeekends);
}

function cloneCandidate(
  candidate: EstimateScheduleTaskCandidate,
  range: PlannedDateRange,
): PlannedEstimateScheduleTaskCandidate {
  return {
    ...candidate,
    labor: { ...candidate.labor },
    source: { ...candidate.source },
    warnings: [...candidate.warnings],
    predecessorCandidateIds: [...candidate.predecessorCandidateIds],
    plannedStartDate: range.startDate,
    plannedEndDate: range.endDate,
  };
}

function clonePlanStructure(plan: EstimateSchedulePlan): PlannedEstimateSchedulePlan {
  return {
    meta: { ...plan.meta },
    divisions: plan.divisions.map((division) => ({
      key: division.key,
      label: division.label,
      rollup: { ...division.rollup },
      scopes: division.scopes.map((scope) => ({
        key: scope.key,
        label: scope.label,
        divisionKey: scope.divisionKey,
        rollup: { ...scope.rollup },
        tasks: scope.tasks.map((task) => ({
          ...task,
          labor: { ...task.labor },
          source: { ...task.source },
          warnings: [...task.warnings],
          predecessorCandidateIds: [...task.predecessorCandidateIds],
          plannedStartDate: task.plannedStartDate ?? '',
          plannedEndDate: task.plannedEndDate ?? '',
        })),
      })),
    })),
  };
}

function collectTasksInProjectOrder(plan: EstimateSchedulePlan): EstimateScheduleTaskCandidate[] {
  const tasks: EstimateScheduleTaskCandidate[] = [];

  for (const division of plan.divisions) {
    for (const scope of division.scopes) {
      tasks.push(...sortScheduleCandidatesBySortOrder(scope.tasks));
    }
  }

  return tasks;
}

function buildDurationWarnings(
  candidate: EstimateScheduleTaskCandidate,
): EstimateScheduleWarning[] {
  const rawDuration = candidate.labor.durationDays;
  if (typeof rawDuration === 'number' && Number.isFinite(rawDuration) && rawDuration >= 1) {
    return [];
  }

  return [
    {
      code: 'missing_duration',
      message: `Duration was missing or less than 1 day for "${candidate.title}"; planned as 1 day.`,
    },
  ];
}

function countInclusiveSpanDays(
  startDate: string,
  endDate: string,
  workWeek: number[],
  includeWeekends: boolean,
): number {
  if (!startDate || !endDate || startDate > endDate) return 0;

  let count = 0;
  let current = startDate;

  while (true) {
    if (includeWeekends || isWorkingDay(current, workWeek)) {
      count += 1;
    }
    if (current === endDate) break;
    current = addDaysToScheduleDate(current, 1);
  }

  return count;
}

function hasExplicitPredecessors(plan: EstimateSchedulePlan): boolean {
  return collectTasksInProjectOrder(plan).some(
    (candidate) => candidate.predecessorCandidateIds.length > 0,
  );
}

function scheduleExplicitPredecessorRanges(
  plan: EstimateSchedulePlan,
  options: Required<
    Pick<
      EstimateScheduleDatePlannerOptions,
      'projectStartDate' | 'workWeek' | 'includeWeekends'
    >
  >,
): {
  ranges: Map<string, PlannedDateRange>;
  warnings: EstimateScheduleWarning[];
} {
  const ranges = new Map<string, PlannedDateRange>();
  const warnings: EstimateScheduleWarning[] = [];
  const tasks = collectTasksInProjectOrder(plan);
  const byId = new Map(tasks.map((task) => [task.candidateId, task]));
  const scheduled = new Set<string>();

  const scheduleTask = (candidate: EstimateScheduleTaskCandidate, startDate: string): void => {
    const durationDays = resolveScheduleEventDurationDays(candidate);
    warnings.push(...buildDurationWarnings(candidate));
    const range = addInclusiveDuration(
      startDate,
      durationDays,
      options.workWeek,
      options.includeWeekends,
    );
    ranges.set(candidate.candidateId, range);
    scheduled.add(candidate.candidateId);
  };

  const resolveStartDate = (candidate: EstimateScheduleTaskCandidate): string => {
    let startDate = options.projectStartDate;
    for (const predecessorId of candidate.predecessorCandidateIds) {
      const predecessorRange = ranges.get(predecessorId);
      if (!predecessorRange) continue;
      const lagDays = Math.max(0, candidate.lagDays ?? 0);
      const candidateStart = addDaysToScheduleDate(predecessorRange.endDate, lagDays + 1);
      if (candidateStart > startDate) startDate = candidateStart;
    }
    return snapToWorkingDay(startDate, options.workWeek, options.includeWeekends);
  };

  let guard = 0;
  while (scheduled.size < tasks.length && guard < tasks.length * tasks.length) {
    guard += 1;
    let progressed = false;
    for (const candidate of tasks) {
      if (scheduled.has(candidate.candidateId)) continue;
      const predecessorsReady = candidate.predecessorCandidateIds.every((id) =>
        ranges.has(id),
      );
      if (!predecessorsReady && candidate.predecessorCandidateIds.length > 0) continue;
      scheduleTask(candidate, resolveStartDate(candidate));
      progressed = true;
    }
    if (!progressed) {
      for (const candidate of tasks) {
        if (!scheduled.has(candidate.candidateId)) {
          scheduleTask(candidate, options.projectStartDate);
        }
      }
      break;
    }
  }

  return { ranges, warnings };
}

function scheduleTaskRanges(
  plan: EstimateSchedulePlan,
  options: Required<
    Pick<
      EstimateScheduleDatePlannerOptions,
      'projectStartDate' | 'workWeek' | 'includeWeekends' | 'dependencyMode'
    >
  >,
): {
  ranges: Map<string, PlannedDateRange>;
  warnings: EstimateScheduleWarning[];
} {
  const ranges = new Map<string, PlannedDateRange>();
  const warnings: EstimateScheduleWarning[] = [];

  const scheduleTask = (candidate: EstimateScheduleTaskCandidate, startDate: string): string => {
    const durationDays = resolveScheduleEventDurationDays(candidate);
    warnings.push(...buildDurationWarnings(candidate));
    const range = addInclusiveDuration(
      startDate,
      durationDays,
      options.workWeek,
      options.includeWeekends,
    );
    ranges.set(candidate.candidateId, range);
    return range.endDate;
  };

  if (hasExplicitPredecessors(plan)) {
    return scheduleExplicitPredecessorRanges(plan, options);
  }

  if (options.dependencyMode === 'none') {
    for (const candidate of collectTasksInProjectOrder(plan)) {
      scheduleTask(candidate, options.projectStartDate);
    }
    return { ranges, warnings };
  }

  if (options.dependencyMode === 'sequential_by_scope') {
    for (const division of plan.divisions) {
      for (const scope of division.scopes) {
        let nextStart = options.projectStartDate;
        for (const candidate of sortScheduleCandidatesBySortOrder(scope.tasks)) {
          const endDate = scheduleTask(candidate, nextStart);
          nextStart = nextStartAfterEnd(endDate, options.workWeek, options.includeWeekends);
        }
      }
    }
    return { ranges, warnings };
  }

  let nextStart = options.projectStartDate;
  for (const candidate of collectTasksInProjectOrder(plan)) {
    const endDate = scheduleTask(candidate, nextStart);
    nextStart = nextStartAfterEnd(endDate, options.workWeek, options.includeWeekends);
  }

  return { ranges, warnings };
}

function applyRangesToPlan(
  plan: PlannedEstimateSchedulePlan,
  ranges: Map<string, PlannedDateRange>,
): void {
  for (const division of plan.divisions) {
    for (const scope of division.scopes) {
      scope.tasks = scope.tasks.map((task) => {
        const range = ranges.get(task.candidateId);
        if (!range) return task;
        return cloneCandidate(task, range);
      });
    }
  }
}

function summarizePlannedDates(
  ranges: Map<string, PlannedDateRange>,
  fallbackStart: string,
  workWeek: number[],
  includeWeekends: boolean,
): {
  plannedProjectStart: string;
  plannedProjectFinish: string | null;
  totalPlannedDurationDays: number;
} {
  if (ranges.size === 0) {
    return {
      plannedProjectStart: fallbackStart,
      plannedProjectFinish: null,
      totalPlannedDurationDays: 0,
    };
  }

  let plannedProjectStart = fallbackStart;
  let plannedProjectFinish = fallbackStart;

  for (const range of ranges.values()) {
    if (range.startDate < plannedProjectStart) plannedProjectStart = range.startDate;
    if (range.endDate > plannedProjectFinish) plannedProjectFinish = range.endDate;
  }

  return {
    plannedProjectStart,
    plannedProjectFinish,
    totalPlannedDurationDays: countInclusiveSpanDays(
      plannedProjectStart,
      plannedProjectFinish,
      workWeek,
      includeWeekends,
    ),
  };
}

/** Assign draft start/end dates to schedule candidates without mutating the input plan. */
export function planEstimateScheduleDates(
  plan: EstimateSchedulePlan,
  options: EstimateScheduleDatePlannerOptions,
): EstimateScheduleDatePlanResult {
  const resolvedOptions = {
    projectStartDate: options.projectStartDate,
    workWeek: options.workWeek ?? DEFAULT_WORK_WEEK,
    includeWeekends: options.includeWeekends ?? false,
    dependencyMode: options.dependencyMode ?? 'sequential_by_scope',
  };

  const plannedPlan = clonePlanStructure(plan);
  const { ranges, warnings } = scheduleTaskRanges(plan, resolvedOptions);
  applyRangesToPlan(plannedPlan, ranges);

  const summary = summarizePlannedDates(
    ranges,
    resolvedOptions.projectStartDate,
    resolvedOptions.workWeek,
    resolvedOptions.includeWeekends,
  );

  return {
    plan: plannedPlan,
    warnings,
    totalPlannedDurationDays: summary.totalPlannedDurationDays,
    plannedProjectStart: summary.plannedProjectStart,
    plannedProjectFinish: summary.plannedProjectFinish,
  };
}
