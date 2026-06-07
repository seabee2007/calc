import type { ScheduleActivity } from '../adapters/estimateLineItemsToScheduleActivities';
import type { CpmLogicLink, ScheduleWorkflowStatus } from '../cpmTypes';
import { wouldCreateCircularDependency } from './logicCycleUtils';

export type CpmReadinessResult = {
  canRunCpm: boolean;
  hardErrors: string[];
  softWarnings: string[];
  workflowStatus: ScheduleWorkflowStatus;
  disabledReasons: string[];
};

const DISABLED_MESSAGES = {
  noLinks: 'No logic links exist.',
  circular: 'Circular dependency detected.',
  disconnected: 'Disconnected activity chains found.',
  noPath: 'No continuous start-to-finish path found.',
  missingRefs: 'Missing activity references found.',
} as const;

function buildGraph(activityCodes: string[], logicLinks: CpmLogicLink[]) {
  const predecessors = new Map<string, Set<string>>();
  const successors = new Map<string, Set<string>>();
  for (const code of activityCodes) {
    predecessors.set(code, new Set());
    successors.set(code, new Set());
  }
  for (const link of logicLinks) {
    if (!predecessors.has(link.successorActivityCode)) continue;
    if (!successors.has(link.predecessorActivityCode)) continue;
    predecessors.get(link.successorActivityCode)!.add(link.predecessorActivityCode);
    successors.get(link.predecessorActivityCode)!.add(link.successorActivityCode);
  }
  return { predecessors, successors };
}

function hasUndirectedDisconnectedChains(activityCodes: string[], logicLinks: CpmLogicLink[]): boolean {
  if (activityCodes.length <= 1 || logicLinks.length === 0) return false;
  const adjacency = new Map<string, Set<string>>();
  for (const code of activityCodes) adjacency.set(code, new Set());
  for (const link of logicLinks) {
    adjacency.get(link.predecessorActivityCode)?.add(link.successorActivityCode);
    adjacency.get(link.successorActivityCode)?.add(link.predecessorActivityCode);
  }
  const visited = new Set<string>();
  const stack = [activityCodes[0]!];
  while (stack.length > 0) {
    const code = stack.pop()!;
    if (visited.has(code)) continue;
    visited.add(code);
    for (const neighbor of adjacency.get(code) ?? []) {
      if (!visited.has(neighbor)) stack.push(neighbor);
    }
  }
  return visited.size !== activityCodes.length;
}

function hasContinuousStartToFinishPath(
  activityCodes: string[],
  predecessors: Map<string, Set<string>>,
  successors: Map<string, Set<string>>,
): boolean {
  if (activityCodes.length <= 1) return true;
  const openStarts = activityCodes.filter((code) => (predecessors.get(code)?.size ?? 0) === 0);
  const openFinishes = activityCodes.filter((code) => (successors.get(code)?.size ?? 0) === 0);
  if (openStarts.length === 0 || openFinishes.length === 0) return false;

  for (const start of openStarts) {
    const queue = [start];
    const visited = new Set<string>();
    while (queue.length > 0) {
      const code = queue.shift()!;
      if (visited.has(code)) continue;
      visited.add(code);
      if (openFinishes.includes(code)) return true;
      for (const succ of successors.get(code) ?? []) {
        if (!visited.has(succ)) queue.push(succ);
      }
    }
  }
  return false;
}

export function validateCpmReadiness(params: {
  activities: ScheduleActivity[];
  logicLinks: CpmLogicLink[];
}): CpmReadinessResult {
  const { activities, logicLinks } = params;
  const activityCodes = activities.map((activity) => activity.activityCode);
  const activityCodeSet = new Set(activityCodes);
  const hardErrors: string[] = [];
  const softWarnings: string[] = [];
  const disabledReasons: string[] = [];

  const missingRefLinks = logicLinks.filter(
    (link) =>
      !activityCodeSet.has(link.predecessorActivityCode) ||
      !activityCodeSet.has(link.successorActivityCode),
  );
  if (missingRefLinks.length > 0) {
    hardErrors.push(DISABLED_MESSAGES.missingRefs);
    disabledReasons.push(DISABLED_MESSAGES.missingRefs);
  }

  if (activities.length > 1 && logicLinks.length === 0) {
    hardErrors.push(DISABLED_MESSAGES.noLinks);
    disabledReasons.push(DISABLED_MESSAGES.noLinks);
  }

  if (
    logicLinks.length > 0 &&
    wouldCreateCircularDependency(logicLinks, [])
  ) {
    hardErrors.push(DISABLED_MESSAGES.circular);
    disabledReasons.push(DISABLED_MESSAGES.circular);
  }

  const { predecessors, successors } = buildGraph(activityCodes, logicLinks);

  if (logicLinks.length > 0 && hasUndirectedDisconnectedChains(activityCodes, logicLinks)) {
    hardErrors.push(DISABLED_MESSAGES.disconnected);
    disabledReasons.push(DISABLED_MESSAGES.disconnected);
  }

  if (
    logicLinks.length > 0 &&
    !hasContinuousStartToFinishPath(activityCodes, predecessors, successors)
  ) {
    hardErrors.push(DISABLED_MESSAGES.noPath);
    disabledReasons.push(DISABLED_MESSAGES.noPath);
  }

  const openStarts = activityCodes.filter((code) => (predecessors.get(code)?.size ?? 0) === 0);
  const openFinishes = activityCodes.filter((code) => (successors.get(code)?.size ?? 0) === 0);
  if (openStarts.length > 0 || openFinishes.length > 0) {
    softWarnings.push(
      'CPM can run, but open starts/finishes may make the critical path unreliable.',
    );
  }

  let workflowStatus: ScheduleWorkflowStatus = 'logic-ready';
  if (hardErrors.some((e) => e.includes('No logic links'))) workflowStatus = 'missing-logic';
  else if (hardErrors.some((e) => e.includes('Circular'))) workflowStatus = 'invalid-circular';
  else if (hardErrors.some((e) => e.includes('Disconnected'))) workflowStatus = 'invalid-disconnected';
  else if (hardErrors.some((e) => e.includes('Missing activity'))) {
    workflowStatus = 'invalid-missing-references';
  } else if (hardErrors.some((e) => e.includes('start-to-finish'))) {
    workflowStatus = 'invalid-open-ended';
  } else if (logicLinks.length === 0) workflowStatus = 'logic-network-draft';

  return {
    canRunCpm: hardErrors.length === 0,
    hardErrors,
    softWarnings,
    workflowStatus,
    disabledReasons,
  };
}
