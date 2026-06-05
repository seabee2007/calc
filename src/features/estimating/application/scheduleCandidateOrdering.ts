import type { EstimateScheduleTaskCandidate } from '../domain/estimateScheduleTypes';

/** Sort candidates by saved line position (sortOrder). */
export function sortScheduleCandidatesBySortOrder(
  candidates: EstimateScheduleTaskCandidate[],
): EstimateScheduleTaskCandidate[] {
  return [...candidates].sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Optional helper: assign finish-to-start predecessors by position within a scope.
 * Not used by default in buildEstimateSchedulePlan — callers must opt in explicitly.
 */
export function buildFinishToStartChainByPosition(
  candidates: EstimateScheduleTaskCandidate[],
): EstimateScheduleTaskCandidate[] {
  const sorted = sortScheduleCandidatesBySortOrder(candidates);

  return sorted.map((candidate, index) => ({
    ...candidate,
    predecessorCandidateIds:
      index > 0 ? [sorted[index - 1].candidateId] : [],
    suggestedDependencyType: 'finish_to_start' as const,
  }));
}
