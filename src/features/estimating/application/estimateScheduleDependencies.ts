import type {
  EstimateScheduleDependencyMode,
  PlannedEstimateSchedulePlan,
} from './estimateScheduleDatePlanner';
import type {
  EstimateSchedulePlan,
  EstimateScheduleTaskCandidate,
} from '../domain/estimateScheduleTypes';
import { sortScheduleCandidatesBySortOrder } from './scheduleCandidateOrdering';

export type EstimateScheduleDependencyPreviewMode =
  | 'none'
  | 'finish_to_start_by_scope'
  | 'finish_to_start_by_project';

export interface EstimateScheduleDependencyPreview {
  id: string;
  predecessorCandidateId: string;
  successorCandidateId: string;
  dependencyType: 'finish_to_start';
  lagDays: number;
  source: 'estimate_preview';
}

export type SchedulePlanForDependencyPreview =
  | EstimateSchedulePlan
  | PlannedEstimateSchedulePlan;

export interface EstimateScheduleDependencyPreviewResult {
  plan: SchedulePlanForDependencyPreview;
  dependencies: EstimateScheduleDependencyPreview[];
  mode: EstimateScheduleDependencyPreviewMode;
}

function collectTasksInProjectOrder(
  plan: SchedulePlanForDependencyPreview,
): EstimateScheduleTaskCandidate[] {
  const tasks: EstimateScheduleTaskCandidate[] = [];

  for (const division of plan.divisions) {
    for (const scope of division.scopes) {
      tasks.push(...sortScheduleCandidatesBySortOrder(scope.tasks));
    }
  }

  return tasks;
}

function buildDependencyId(predecessorId: string, successorId: string): string {
  return `estimate_preview:finish_to_start:${predecessorId}:${successorId}`;
}

function buildFinishToStartLink(
  predecessor: EstimateScheduleTaskCandidate,
  successor: EstimateScheduleTaskCandidate,
): EstimateScheduleDependencyPreview {
  return {
    id: buildDependencyId(predecessor.candidateId, successor.candidateId),
    predecessorCandidateId: predecessor.candidateId,
    successorCandidateId: successor.candidateId,
    dependencyType: 'finish_to_start',
    lagDays: 0,
    source: 'estimate_preview',
  };
}

function buildExplicitPredecessorDependencies(
  candidates: EstimateScheduleTaskCandidate[],
): EstimateScheduleDependencyPreview[] {
  const byId = new Map(candidates.map((candidate) => [candidate.candidateId, candidate]));
  const dependencies: EstimateScheduleDependencyPreview[] = [];

  for (const successor of candidates) {
    for (const predecessorId of successor.predecessorCandidateIds) {
      const predecessor = byId.get(predecessorId);
      if (!predecessor) continue;
      dependencies.push({
        id: buildDependencyId(predecessor.candidateId, successor.candidateId),
        predecessorCandidateId: predecessor.candidateId,
        successorCandidateId: successor.candidateId,
        dependencyType: 'finish_to_start',
        lagDays: Math.max(0, successor.lagDays ?? 0),
        source: 'estimate_preview',
      });
    }
  }

  return dependencies;
}

function buildChainDependencies(
  candidates: EstimateScheduleTaskCandidate[],
): EstimateScheduleDependencyPreview[] {
  const sorted = sortScheduleCandidatesBySortOrder(candidates);
  if (sorted.length < 2) return [];

  const explicitSuccessorIds = new Set<string>();
  for (const candidate of sorted) {
    if (candidate.predecessorCandidateIds.length > 0) {
      explicitSuccessorIds.add(candidate.candidateId);
    }
  }

  const dependencies: EstimateScheduleDependencyPreview[] = [];
  dependencies.push(...buildExplicitPredecessorDependencies(sorted));

  for (let index = 1; index < sorted.length; index += 1) {
    const predecessor = sorted[index - 1];
    const successor = sorted[index];
    if (
      explicitSuccessorIds.has(successor.candidateId) ||
      successor.predecessorCandidateIds.length > 0
    ) {
      continue;
    }
    dependencies.push(buildFinishToStartLink(predecessor, successor));
  }

  return dependencies;
}

export function buildFinishToStartDependenciesByProject(
  plan: SchedulePlanForDependencyPreview,
): EstimateScheduleDependencyPreview[] {
  return buildChainDependencies(collectTasksInProjectOrder(plan));
}

export function buildFinishToStartDependenciesByScope(
  plan: SchedulePlanForDependencyPreview,
): EstimateScheduleDependencyPreview[] {
  const dependencies: EstimateScheduleDependencyPreview[] = [];

  for (const division of plan.divisions) {
    for (const scope of division.scopes) {
      dependencies.push(...buildChainDependencies(scope.tasks));
    }
  }

  return dependencies;
}

function clonePlanForDependencyPreview(
  plan: SchedulePlanForDependencyPreview,
): SchedulePlanForDependencyPreview {
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
        })),
      })),
    })),
  };
}

function resolveDependenciesForMode(
  plan: SchedulePlanForDependencyPreview,
  mode: EstimateScheduleDependencyPreviewMode,
): EstimateScheduleDependencyPreview[] {
  if (mode === 'finish_to_start_by_project') {
    return buildFinishToStartDependenciesByProject(plan);
  }

  if (mode === 'finish_to_start_by_scope') {
    return buildFinishToStartDependenciesByScope(plan);
  }

  return [];
}

export function mapScheduleControlToDependencyPreviewMode(
  mode: EstimateScheduleDependencyMode | EstimateScheduleDependencyPreviewMode,
): EstimateScheduleDependencyPreviewMode {
  if (mode === 'sequential_by_project') return 'finish_to_start_by_project';
  if (mode === 'sequential_by_scope') return 'finish_to_start_by_scope';
  if (
    mode === 'finish_to_start_by_project' ||
    mode === 'finish_to_start_by_scope' ||
    mode === 'none'
  ) {
    return mode;
  }

  return 'none';
}

export function inferDependencyPreviewModeFromPlannedPlan(
  plan: PlannedEstimateSchedulePlan,
): EstimateScheduleDependencyPreviewMode {
  const allTasks = collectTasksInProjectOrder(plan);
  if (allTasks.length < 2) return 'none';

  const starts = allTasks.map((task) => task.plannedStartDate);
  if (starts.every((start) => start === starts[0])) return 'none';

  const projectStart = [...starts].sort()[0];
  let matchesScopeMode = true;

  for (const division of plan.divisions) {
    for (const scope of division.scopes) {
      const sorted = sortScheduleCandidatesBySortOrder(scope.tasks);
      if (sorted.length === 0) continue;
      if (sorted[0].plannedStartDate !== projectStart) {
        matchesScopeMode = false;
        break;
      }
    }
    if (!matchesScopeMode) break;
  }

  return matchesScopeMode
    ? 'finish_to_start_by_scope'
    : 'finish_to_start_by_project';
}

export function applyDependencyPreviewToPlan(
  plan: SchedulePlanForDependencyPreview,
  mode: EstimateScheduleDependencyPreviewMode | EstimateScheduleDependencyMode,
): EstimateScheduleDependencyPreviewResult {
  const resolvedMode = mapScheduleControlToDependencyPreviewMode(mode);
  const clonedPlan = clonePlanForDependencyPreview(plan);
  const dependencies = resolveDependenciesForMode(clonedPlan, resolvedMode);

  return {
    plan: clonedPlan,
    dependencies,
    mode: resolvedMode,
  };
}

export function buildCandidateTitleMap(
  plan: SchedulePlanForDependencyPreview | null,
): Map<string, string> {
  const titles = new Map<string, string>();
  if (!plan) return titles;

  for (const task of collectTasksInProjectOrder(plan)) {
    const title = task.title.trim();
    titles.set(task.candidateId, title.length > 0 ? title : task.candidateId);
  }

  return titles;
}

export function formatDependencyPreviewLink(
  predecessorTitle: string,
  successorTitle: string,
): string {
  return `${predecessorTitle} → ${successorTitle}`;
}

export function formatDependencyPreviewLinks(
  dependencies: EstimateScheduleDependencyPreview[],
  titleMap: Map<string, string>,
  maxLinks = 3,
): string[] {
  return dependencies.slice(0, maxLinks).map((dependency) =>
    formatDependencyPreviewLink(
      titleMap.get(dependency.predecessorCandidateId) ?? dependency.predecessorCandidateId,
      titleMap.get(dependency.successorCandidateId) ?? dependency.successorCandidateId,
    ),
  );
}
