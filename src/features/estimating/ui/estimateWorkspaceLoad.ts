import { getCurrentEstimate, type CurrentEstimate } from '../application/currentEstimateService';
import type { EstimateSelectedDivision } from '../domain/estimateTypes';

const inFlightEstimateLoads = new Map<string, Promise<CurrentEstimate | null>>();

/** Deduplicate concurrent estimate loads for the same project (e.g. Strict Mode). */
export function loadCurrentEstimateForProject(projectId: string): Promise<CurrentEstimate | null> {
  const existing = inFlightEstimateLoads.get(projectId);
  if (existing) return existing;

  const pending = getCurrentEstimate(projectId).finally(() => {
    inFlightEstimateLoads.delete(projectId);
  });
  inFlightEstimateLoads.set(projectId, pending);
  return pending;
}

export function buildOptimisticEstimateWithDivisions(
  current: CurrentEstimate,
  divisions: readonly EstimateSelectedDivision[],
): CurrentEstimate {
  return {
    ...current,
    selectedDivisions: [...divisions],
  };
}
