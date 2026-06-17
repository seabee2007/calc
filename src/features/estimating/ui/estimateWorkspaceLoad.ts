import { getCurrentEstimate, type CurrentEstimate } from '../application/currentEstimateService';
import type { EstimateSelectedDivision } from '../domain/estimateTypes';

const inFlightEstimateLoads = new Map<string, Promise<CurrentEstimate | null>>();
const estimateWorkspaceSessionCache = new Map<string, CurrentEstimate | null>();

export function getCachedCurrentEstimateForProject(
  projectId: string,
): CurrentEstimate | null | undefined {
  return estimateWorkspaceSessionCache.get(projectId);
}

export function cacheCurrentEstimateForProject(
  projectId: string,
  estimate: CurrentEstimate | null,
): void {
  estimateWorkspaceSessionCache.set(projectId, estimate);
}

export function clearCachedCurrentEstimateForProject(projectId: string): void {
  estimateWorkspaceSessionCache.delete(projectId);
}

export function resetEstimateWorkspaceSessionCacheForTests(): void {
  estimateWorkspaceSessionCache.clear();
  inFlightEstimateLoads.clear();
}

/** Deduplicate concurrent estimate loads for the same project (e.g. Strict Mode). */
export function loadCurrentEstimateForProject(projectId: string): Promise<CurrentEstimate | null> {
  const existing = inFlightEstimateLoads.get(projectId);
  if (existing) return existing;

  const pending = getCurrentEstimate(projectId)
    .then((estimate) => {
      cacheCurrentEstimateForProject(projectId, estimate);
      return estimate;
    })
    .finally(() => {
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
