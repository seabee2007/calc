import type { CpmActivityResult, CpmLogicLink, CriticalPathStatus } from '../cpmTypes';

export type ValidateCriticalPathContinuityInput = {
  activities: CpmActivityResult[];
  logicLinks: CpmLogicLink[];
  projectStartDay: number;
  projectFinish: number;
  hasCycle: boolean;
};

export type ValidateCriticalPathContinuityResult = {
  hasValidCriticalPath: boolean;
  criticalPathStatus: CriticalPathStatus;
  displayCriticalActivityCodes: string[];
  openStartActivityCodes: string[];
  openFinishActivityCodes: string[];
  warnings: string[];
};

const WARNINGS = {
  missingLogic:
    'No logic links exist. Build the logic network before identifying the critical path.',
  circular: 'Circular logic detected. Fix loops before CPM can identify a critical path.',
  overConstrained: 'Negative float detected. Review logic links and lag values.',
  disconnected:
    'Critical path does not span from project start to project finish. Check open-ended activities.',
  multipleOpenStarts: 'Multiple open-start activities detected. Confirm the project start activity.',
  multipleOpenFinishes:
    'Multiple open-finish activities detected. Confirm the project finish activity.',
} as const;

function buildGraphMaps(activityCodes: string[], logicLinks: CpmLogicLink[]) {
  const predecessors = new Map<string, Set<string>>();
  const successors = new Map<string, Set<string>>();

  for (const code of activityCodes) {
    predecessors.set(code, new Set());
    successors.set(code, new Set());
  }

  for (const link of logicLinks) {
    if (
      !predecessors.has(link.predecessorActivityCode) ||
      !successors.has(link.successorActivityCode)
    ) {
      continue;
    }
    predecessors.get(link.successorActivityCode)!.add(link.predecessorActivityCode);
    successors.get(link.predecessorActivityCode)!.add(link.successorActivityCode);
  }

  return { predecessors, successors };
}

function findOpenEnds(
  activityCodes: string[],
  predecessors: Map<string, Set<string>>,
  successors: Map<string, Set<string>>,
) {
  const openStarts = activityCodes.filter((code) => (predecessors.get(code)?.size ?? 0) === 0);
  const openFinishes = activityCodes.filter((code) => (successors.get(code)?.size ?? 0) === 0);
  return { openStarts, openFinishes };
}

function findValidDisplayCriticalCodes(params: {
  activities: CpmActivityResult[];
  logicLinks: CpmLogicLink[];
  projectStartDay: number;
  projectFinish: number;
  openStarts: string[];
  openFinishes: string[];
}): string[] {
  const { activities, logicLinks, projectStartDay, projectFinish, openStarts, openFinishes } =
    params;

  const activityByCode = new Map(activities.map((activity) => [activity.activityCode, activity]));
  const zeroFloatCodes = new Set(
    activities.filter((activity) => activity.totalFloat === 0).map((activity) => activity.activityCode),
  );

  if (zeroFloatCodes.size === 0) {
    return [];
  }

  const forward = new Map<string, Set<string>>();
  for (const code of zeroFloatCodes) {
    forward.set(code, new Set());
  }

  for (const link of logicLinks) {
    const { predecessorActivityCode, successorActivityCode } = link;
    if (zeroFloatCodes.has(predecessorActivityCode) && zeroFloatCodes.has(successorActivityCode)) {
      forward.get(predecessorActivityCode)!.add(successorActivityCode);
    }
  }

  const finishCandidates = new Set(
    openFinishes.filter((code) => {
      const activity = activityByCode.get(code);
      return activity != null && activity.earlyFinish === projectFinish;
    }),
  );

  const startCandidates = openStarts.filter((code) => {
    const activity = activityByCode.get(code);
    return activity != null && activity.earlyStart === projectStartDay;
  });

  const canReachFinish = (startCode: string): boolean => {
    const seen = new Set<string>([startCode]);
    const queue = [startCode];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (finishCandidates.has(current)) {
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

  const validStarts = startCandidates.filter(canReachFinish);
  if (validStarts.length === 0) {
    return [];
  }

  const onValidPaths = new Set<string>();

  const collectPathCodes = (startCode: string) => {
    const seen = new Set<string>();
    const walk = (code: string): boolean => {
      if (!zeroFloatCodes.has(code)) return false;
      seen.add(code);

      if (finishCandidates.has(code)) {
        for (const pathCode of seen) {
          onValidPaths.add(pathCode);
        }
        return true;
      }

      for (const next of forward.get(code) ?? []) {
        if (seen.has(next)) continue;
        if (walk(next)) {
          return true;
        }
      }

      seen.delete(code);
      return false;
    };

    walk(startCode);
  };

  for (const startCode of validStarts) {
    collectPathCodes(startCode);
  }

  return [...onValidPaths];
}

function invalidResult(
  criticalPathStatus: CriticalPathStatus,
  warning: string,
  openStartActivityCodes: string[] = [],
  openFinishActivityCodes: string[] = [],
): ValidateCriticalPathContinuityResult {
  return {
    hasValidCriticalPath: false,
    criticalPathStatus,
    displayCriticalActivityCodes: [],
    openStartActivityCodes,
    openFinishActivityCodes,
    warnings: [warning],
  };
}

export function validateCriticalPathContinuity(
  input: ValidateCriticalPathContinuityInput,
): ValidateCriticalPathContinuityResult {
  const { activities, logicLinks, projectStartDay, projectFinish, hasCycle } = input;
  const activityCodes = activities.map((activity) => activity.activityCode);

  if (activities.length === 1) {
    return {
      hasValidCriticalPath: true,
      criticalPathStatus: 'valid',
      displayCriticalActivityCodes: [activities[0]!.activityCode],
      openStartActivityCodes: [],
      openFinishActivityCodes: [],
      warnings: [],
    };
  }

  if (logicLinks.length === 0) {
    return invalidResult('missing-logic', WARNINGS.missingLogic);
  }

  if (hasCycle) {
    return invalidResult('circular', WARNINGS.circular);
  }

  if (activities.some((activity) => activity.totalFloat < 0)) {
    return invalidResult('over-constrained', WARNINGS.overConstrained);
  }

  const { predecessors, successors } = buildGraphMaps(activityCodes, logicLinks);
  const { openStarts, openFinishes } = findOpenEnds(activityCodes, predecessors, successors);

  const displayCriticalActivityCodes = findValidDisplayCriticalCodes({
    activities,
    logicLinks,
    projectStartDay,
    projectFinish,
    openStarts,
    openFinishes,
  });

  const warnings: string[] = [];
  if (openStarts.length > 1) {
    warnings.push(WARNINGS.multipleOpenStarts);
  }
  if (openFinishes.length > 1) {
    warnings.push(WARNINGS.multipleOpenFinishes);
  }

  if (displayCriticalActivityCodes.length === 0) {
    return {
      hasValidCriticalPath: false,
      criticalPathStatus: 'disconnected',
      displayCriticalActivityCodes: [],
      openStartActivityCodes: openStarts,
      openFinishActivityCodes: openFinishes,
      warnings: [WARNINGS.disconnected, ...warnings],
    };
  }

  return {
    hasValidCriticalPath: true,
    criticalPathStatus: 'valid',
    displayCriticalActivityCodes,
    openStartActivityCodes: openStarts,
    openFinishActivityCodes: openFinishes,
    warnings,
  };
}
