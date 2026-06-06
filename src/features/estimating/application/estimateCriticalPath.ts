/**
 * @deprecated Use `calculateCpm` from `scheduling/cpm/calculateCpm` instead.
 * Legacy calendar-date critical path — no longer used by estimate workspace UI.
 */
import type { EstimateScheduleDependencyPreview } from './estimateScheduleDependencies';
import type { PlannedEstimateSchedulePlan } from './estimateScheduleDatePlanner';
import { addDaysToScheduleDate } from './mapScheduleCandidateToScheduleEventInput';

export type EstimateCriticalPathWarningCode =
  | 'missing_dependencies'
  | 'circular_dependencies'
  | 'missing_planned_dates'
  | 'no_schedulable_tasks';

export interface EstimateCriticalPathWarning {
  code: EstimateCriticalPathWarningCode;
  message: string;
}

export interface EstimateCriticalPathResult {
  criticalTaskIds: string[];
  projectStartDate: string | null;
  projectFinishDate: string | null;
  projectDurationDays: number;
  totalFloatByTaskId: Record<string, number>;
  warnings: EstimateCriticalPathWarning[];
}

interface CriticalPathTaskNode {
  candidateId: string;
  plannedStartDate: string;
  plannedEndDate: string;
  durationDays: number;
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

function safeDayIndex(anchorDate: string, date: string): number | null {
  const anchor = parseYmd(anchorDate);
  const target = parseYmd(date);
  if (!anchor || !target) return null;

  const diffMs = target.getTime() - anchor.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  return Number.isFinite(diffDays) ? diffDays : null;
}

function indexToDate(anchorDate: string, dayIndex: number): string | null {
  if (!Number.isFinite(dayIndex)) return null;
  const safeIndex = Math.max(0, Math.floor(dayIndex));
  return addDaysToScheduleDate(anchorDate, safeIndex);
}

function inclusiveDurationDays(startDate: string, endDate: string): number {
  const endOffset = safeDayIndex(startDate, endDate);
  if (endOffset == null || endOffset < 0) return 1;
  return Math.max(1, endOffset + 1);
}

function collectPlannedTaskNodes(plan: PlannedEstimateSchedulePlan): CriticalPathTaskNode[] {
  const nodes: CriticalPathTaskNode[] = [];

  for (const division of plan.divisions) {
    for (const scope of division.scopes) {
      for (const task of scope.tasks) {
        const start = task.plannedStartDate?.trim();
        const end = task.plannedEndDate?.trim();
        if (!isValidYmd(start) || !isValidYmd(end) || start > end) continue;

        nodes.push({
          candidateId: task.candidateId,
          plannedStartDate: start,
          plannedEndDate: end,
          durationDays: inclusiveDurationDays(start, end),
        });
      }
    }
  }

  return nodes;
}

function buildFinishToStartGraph(
  taskIds: Set<string>,
  dependencies: EstimateScheduleDependencyPreview[],
): {
  predecessors: Map<string, string[]>;
  successors: Map<string, string[]>;
} {
  const predecessors = new Map<string, string[]>();
  const successors = new Map<string, string[]>();

  for (const taskId of taskIds) {
    predecessors.set(taskId, []);
    successors.set(taskId, []);
  }

  for (const dependency of dependencies) {
    if (dependency.dependencyType !== 'finish_to_start') continue;
    if (!taskIds.has(dependency.predecessorCandidateId)) continue;
    if (!taskIds.has(dependency.successorCandidateId)) continue;

    predecessors.get(dependency.successorCandidateId)!.push(dependency.predecessorCandidateId);
    successors.get(dependency.predecessorCandidateId)!.push(dependency.successorCandidateId);
  }

  return { predecessors, successors };
}

function topologicalSort(
  taskIds: string[],
  predecessors: Map<string, string[]>,
  successors: Map<string, string[]>,
): { order: string[]; hasCycle: boolean } {
  const inDegree = new Map<string, number>();

  for (const taskId of taskIds) {
    inDegree.set(taskId, predecessors.get(taskId)?.length ?? 0);
  }

  const queue = taskIds.filter((taskId) => (inDegree.get(taskId) ?? 0) === 0);
  const order: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);

    for (const successorId of successors.get(current) ?? []) {
      const nextDegree = (inDegree.get(successorId) ?? 0) - 1;
      inDegree.set(successorId, nextDegree);
      if (nextDegree === 0) queue.push(successorId);
    }
  }

  return {
    order,
    hasCycle: order.length !== taskIds.length,
  };
}

function buildEmptyResult(warnings: EstimateCriticalPathWarning[]): EstimateCriticalPathResult {
  return {
    criticalTaskIds: [],
    projectStartDate: null,
    projectFinishDate: null,
    projectDurationDays: 0,
    totalFloatByTaskId: {},
    warnings,
  };
}

function resolveLongestSpanCriticalTasks(nodes: CriticalPathTaskNode[]): string[] {
  if (nodes.length === 0) return [];

  const maxDuration = Math.max(...nodes.map((node) => node.durationDays));
  return nodes
    .filter((node) => node.durationDays === maxDuration)
    .map((node) => node.candidateId);
}

function calculateWithoutDependencies(
  nodes: CriticalPathTaskNode[],
  anchorDate: string,
): EstimateCriticalPathResult {
  const warnings: EstimateCriticalPathWarning[] = [
    {
      code: 'missing_dependencies',
      message: 'Critical path calculation requires finish-to-start dependencies.',
    },
  ];

  const earliestStartByTask = new Map<string, number>();
  const earliestFinishByTask = new Map<string, number>();
  const totalFloatByTaskId: Record<string, number> = {};

  for (const node of nodes) {
    const startIndex = safeDayIndex(anchorDate, node.plannedStartDate);
    const endIndex = safeDayIndex(anchorDate, node.plannedEndDate);
    if (startIndex == null || endIndex == null) continue;

    earliestStartByTask.set(node.candidateId, startIndex);
    earliestFinishByTask.set(node.candidateId, endIndex);
  }

  const finishValues = [...earliestFinishByTask.values()].filter(Number.isFinite);
  if (finishValues.length === 0) {
    return buildEmptyResult([
      ...warnings,
      {
        code: 'missing_planned_dates',
        message: 'No tasks with valid planned dates were available for critical path analysis.',
      },
    ]);
  }

  const projectEndIndex = Math.max(...finishValues);
  const projectStartDate = anchorDate;
  const projectFinishDate = indexToDate(anchorDate, projectEndIndex);

  for (const node of nodes) {
    const earliestStart = earliestStartByTask.get(node.candidateId);
    const earliestFinish = earliestFinishByTask.get(node.candidateId);
    if (earliestStart == null || earliestFinish == null) continue;

    const latestFinish = projectEndIndex;
    const latestStart = latestFinish - node.durationDays + 1;
    const totalFloat = latestStart - earliestStart;

    totalFloatByTaskId[node.candidateId] = Number.isFinite(totalFloat) ? Math.max(0, totalFloat) : 0;
  }

  const criticalTaskIds = Object.entries(totalFloatByTaskId)
    .filter(([, totalFloat]) => totalFloat === 0)
    .map(([taskId]) => taskId);

  const safeCriticalTaskIds =
    criticalTaskIds.length > 0 ? criticalTaskIds : resolveLongestSpanCriticalTasks(nodes);

  return {
    criticalTaskIds: safeCriticalTaskIds,
    projectStartDate,
    projectFinishDate,
    projectDurationDays: Math.max(1, projectEndIndex + 1),
    totalFloatByTaskId,
    warnings,
  };
}

function calculateWithDependencies(
  nodes: CriticalPathTaskNode[],
  dependencies: EstimateScheduleDependencyPreview[],
  anchorDate: string,
): EstimateCriticalPathResult {
  const taskIdList = nodes.map((node) => node.candidateId);
  const taskIds = new Set(taskIdList);
  const nodeById = new Map(nodes.map((node) => [node.candidateId, node]));
  const { predecessors, successors } = buildFinishToStartGraph(taskIds, dependencies);
  const { order, hasCycle } = topologicalSort(taskIdList, predecessors, successors);

  if (hasCycle) {
    return buildEmptyResult([
      {
        code: 'circular_dependencies',
        message: 'Circular finish-to-start dependencies were detected. Critical path was not calculated.',
      },
    ]);
  }

  const earliestStartByTask = new Map<string, number>();
  const earliestFinishByTask = new Map<string, number>();

  for (const taskId of order) {
    const node = nodeById.get(taskId);
    if (!node) continue;

    const predecessorIds = predecessors.get(taskId) ?? [];
    let earliestStart = safeDayIndex(anchorDate, node.plannedStartDate) ?? 0;

    if (predecessorIds.length > 0) {
      let dependencyStart = 0;
      for (const predecessorId of predecessorIds) {
        const predecessorFinish = earliestFinishByTask.get(predecessorId);
        if (predecessorFinish == null || !Number.isFinite(predecessorFinish)) continue;
        dependencyStart = Math.max(dependencyStart, predecessorFinish + 1);
      }
      earliestStart = Math.max(earliestStart, dependencyStart);
    }

    if (!Number.isFinite(earliestStart)) earliestStart = 0;

    const earliestFinish = earliestStart + node.durationDays - 1;
    earliestStartByTask.set(taskId, earliestStart);
    earliestFinishByTask.set(taskId, earliestFinish);
  }

  const finishValues = [...earliestFinishByTask.values()].filter(Number.isFinite);
  if (finishValues.length === 0) {
    return buildEmptyResult([
      {
        code: 'missing_planned_dates',
        message: 'No tasks with valid planned dates were available for critical path analysis.',
      },
    ]);
  }

  const projectEndIndex = Math.max(...finishValues);
  const latestStartByTask = new Map<string, number>();
  const latestFinishByTask = new Map<string, number>();

  for (const taskId of [...order].reverse()) {
    const node = nodeById.get(taskId);
    if (!node) continue;

    const successorIds = successors.get(taskId) ?? [];
    let latestFinish = projectEndIndex;

    if (successorIds.length > 0) {
      let successorConstraint = projectEndIndex;
      for (const successorId of successorIds) {
        const successorLatestStart = latestStartByTask.get(successorId);
        if (successorLatestStart == null || !Number.isFinite(successorLatestStart)) continue;
        successorConstraint = Math.min(successorConstraint, successorLatestStart - 1);
      }
      latestFinish = Math.min(latestFinish, successorConstraint);
    }

    if (!Number.isFinite(latestFinish)) latestFinish = projectEndIndex;

    const latestStart = latestFinish - node.durationDays + 1;
    latestStartByTask.set(taskId, latestStart);
    latestFinishByTask.set(taskId, latestFinish);
  }

  const totalFloatByTaskId: Record<string, number> = {};
  const criticalTaskIds: string[] = [];

  for (const node of nodes) {
    const earliestStart = earliestStartByTask.get(node.candidateId);
    const latestStart = latestStartByTask.get(node.candidateId);
    if (earliestStart == null || latestStart == null) continue;

    const totalFloat = latestStart - earliestStart;
    const safeFloat = Number.isFinite(totalFloat) ? Math.max(0, totalFloat) : 0;
    totalFloatByTaskId[node.candidateId] = safeFloat;

    if (safeFloat === 0) {
      criticalTaskIds.push(node.candidateId);
    }
  }

  return {
    criticalTaskIds,
    projectStartDate: anchorDate,
    projectFinishDate: indexToDate(anchorDate, projectEndIndex),
    projectDurationDays: Math.max(1, projectEndIndex + 1),
    totalFloatByTaskId,
    warnings: [],
  };
}

/** @deprecated Use `calculateCpm` — authoritative CPM engine for all schedule views. */
export function calculateEstimateCriticalPath(
  plan: PlannedEstimateSchedulePlan | null,
  dependencies: EstimateScheduleDependencyPreview[],
): EstimateCriticalPathResult {
  if (!plan) {
    return buildEmptyResult([
      {
        code: 'no_schedulable_tasks',
        message: 'No planned schedule tasks were available for critical path analysis.',
      },
    ]);
  }

  const nodes = collectPlannedTaskNodes(plan);
  if (nodes.length === 0) {
    return buildEmptyResult([
      {
        code: 'no_schedulable_tasks',
        message: 'No tasks with valid planned dates were available for critical path analysis.',
      },
    ]);
  }

  const anchorDate = nodes
    .map((node) => node.plannedStartDate)
    .sort()[0];

  if (!isValidYmd(anchorDate)) {
    return buildEmptyResult([
      {
        code: 'missing_planned_dates',
        message: 'No tasks with valid planned dates were available for critical path analysis.',
      },
    ]);
  }

  const finishToStartDependencies = dependencies.filter(
    (dependency) => dependency.dependencyType === 'finish_to_start',
  );

  if (finishToStartDependencies.length === 0) {
    return calculateWithoutDependencies(nodes, anchorDate);
  }

  return calculateWithDependencies(nodes, finishToStartDependencies, anchorDate);
}
