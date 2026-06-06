import type {
  EstimateSchedulePlan,
  EstimateScheduleTaskCandidate,
} from '../domain/estimateScheduleTypes';
import { resolvePredecessorCandidateIds } from './estimateActivityCoding';

function collectTasks(plan: EstimateSchedulePlan): EstimateScheduleTaskCandidate[] {
  const tasks: EstimateScheduleTaskCandidate[] = [];
  for (const division of plan.divisions) {
    for (const scope of division.scopes) {
      tasks.push(...scope.tasks);
    }
  }
  return tasks;
}

function replaceTasksInPlan(
  plan: EstimateSchedulePlan,
  resolvedById: Map<string, EstimateScheduleTaskCandidate>,
): EstimateSchedulePlan {
  return {
    meta: { ...plan.meta },
    divisions: plan.divisions.map((division) => ({
      ...division,
      scopes: division.scopes.map((scope) => ({
        ...scope,
        tasks: scope.tasks.map(
          (task) => resolvedById.get(task.candidateId) ?? task,
        ),
      })),
    })),
  };
}

export function resolveEstimateSchedulePredecessors(plan: EstimateSchedulePlan): {
  plan: EstimateSchedulePlan;
  warnings: string[];
} {
  const tasks = collectTasks(plan);
  const { candidates, warnings } = resolvePredecessorCandidateIds(tasks);
  const resolvedById = new Map(candidates.map((task) => [task.candidateId, task]));
  return {
    plan: replaceTasksInPlan(plan, resolvedById),
    warnings,
  };
}
