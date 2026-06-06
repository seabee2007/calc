import type { CpmActivityResult, CpmLogicLink } from '../cpmTypes';

export interface CriticalPathContinuityParams {
  activities: CpmActivityResult[];
  logicLinks: CpmLogicLink[];
  projectStartDay: number;
  projectFinish: number;
}

/**
 * NTRP-style check: zero-float activities should form a connected critical path
 * from project start to project finish through logic links.
 */
export function buildCriticalPathContinuityWarning(
  params: CriticalPathContinuityParams,
): string | null {
  const { activities, logicLinks, projectStartDay, projectFinish } = params;

  const criticalByCode = new Map(
    activities.filter((activity) => activity.totalFloat === 0).map((a) => [a.activityCode, a]),
  );
  const criticalCodes = [...criticalByCode.keys()];

  if (criticalCodes.length <= 1) {
    return null;
  }

  const criticalSet = new Set(criticalCodes);
  const neighbors = new Map<string, Set<string>>();
  for (const code of criticalCodes) {
    neighbors.set(code, new Set());
  }

  for (const link of logicLinks) {
    const { predecessorActivityCode, successorActivityCode } = link;
    if (criticalSet.has(predecessorActivityCode) && criticalSet.has(successorActivityCode)) {
      neighbors.get(predecessorActivityCode)!.add(successorActivityCode);
      neighbors.get(successorActivityCode)!.add(predecessorActivityCode);
    }
  }

  const visited = new Set<string>();
  let components = 0;
  for (const code of criticalCodes) {
    if (visited.has(code)) continue;
    components += 1;
    const queue = [code];
    visited.add(code);
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const neighbor of neighbors.get(current) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
  }

  if (components > 1) {
    return 'Critical path activities are not connected through logic links from project start to project finish. Review predecessor and successor logic.';
  }

  const criticalStarts = criticalCodes.filter(
    (code) => criticalByCode.get(code)!.earlyStart === projectStartDay,
  );
  const criticalFinishes = new Set(
    criticalCodes.filter((code) => criticalByCode.get(code)!.earlyFinish === projectFinish),
  );

  if (criticalStarts.length === 0 || criticalFinishes.size === 0) {
    return 'Critical path does not span from project start to project finish. Check activity durations and logic links.';
  }

  const forward = new Map<string, Set<string>>();
  for (const code of criticalCodes) {
    forward.set(code, new Set());
  }
  for (const link of logicLinks) {
    const { predecessorActivityCode, successorActivityCode } = link;
    if (criticalSet.has(predecessorActivityCode) && criticalSet.has(successorActivityCode)) {
      forward.get(predecessorActivityCode)!.add(successorActivityCode);
    }
  }

  const canReachFinish = (startCode: string): boolean => {
    const seen = new Set<string>([startCode]);
    const queue = [startCode];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (criticalFinishes.has(current)) {
        return true;
      }
      for (const next of forward.get(current) ?? []) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    return false;
  };

  if (!criticalStarts.some(canReachFinish)) {
    return 'Critical path does not connect from project start to project finish. Check FS, SS, FF, SF links and lag values.';
  }

  return null;
}
