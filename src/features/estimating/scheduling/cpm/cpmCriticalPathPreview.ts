import type { PlannedEstimateSchedulePlan } from '../../application/estimateScheduleDatePlanner';
import { addDaysToScheduleDate } from '../../application/mapScheduleCandidateToScheduleEventInput';
import type { CpmResult } from '../cpmTypes';

export interface CpmCriticalPathPreview {
  criticalActivityCodes: string[];
  criticalTaskIds: string[];
  projectDurationDays: number;
  projectFinishDate: string | null;
  warnings: string[];
  totalFloatByActivityCode: Record<string, number>;
}

export function buildActivityCodeToCandidateIdMap(
  plan: PlannedEstimateSchedulePlan | null,
): Map<string, string> {
  const map = new Map<string, string>();
  if (!plan) return map;

  for (const division of plan.divisions) {
    for (const scope of division.scopes) {
      for (const task of scope.tasks) {
        const code = task.activityCode?.trim();
        if (!code || map.has(code)) continue;
        map.set(code, task.candidateId);
      }
    }
  }

  return map;
}

export function mapCriticalActivityCodesToCandidateIds(
  criticalActivityCodes: string[],
  codeToCandidateId: Map<string, string>,
): string[] {
  return criticalActivityCodes
    .map((code) => codeToCandidateId.get(code))
    .filter((candidateId): candidateId is string => Boolean(candidateId));
}

/**
 * Authoritative critical-path preview derived from calculateCpm.
 * Used by legacy calendar Gantt preview so it matches Logic Network and Level III Gantt.
 */
export function buildCpmCriticalPathPreview(params: {
  cpmResult: CpmResult | null;
  plan: PlannedEstimateSchedulePlan | null;
  projectStartDate: string | null;
}): CpmCriticalPathPreview {
  const { cpmResult, plan, projectStartDate } = params;

  if (!cpmResult || cpmResult.activities.length === 0) {
    return {
      criticalActivityCodes: [],
      criticalTaskIds: [],
      projectDurationDays: 0,
      projectFinishDate: null,
      warnings: ['No CPM schedule results were available for critical path analysis.'],
      totalFloatByActivityCode: {},
    };
  }

  const criticalActivityCodes = cpmResult.hasValidCriticalPath
    ? [...cpmResult.displayCriticalActivityCodes]
    : [];

  const codeToCandidateId = buildActivityCodeToCandidateIdMap(plan);
  const criticalTaskIds = mapCriticalActivityCodesToCandidateIds(
    criticalActivityCodes,
    codeToCandidateId,
  );

  const totalFloatByActivityCode = Object.fromEntries(
    cpmResult.activities.map((activity) => [activity.activityCode, activity.totalFloat]),
  );

  const projectDurationDays = cpmResult.projectDurationDays;
  const projectFinishDate =
    projectStartDate && projectDurationDays > 0
      ? addDaysToScheduleDate(projectStartDate, Math.max(0, projectDurationDays - 1))
      : null;

  const warnings = [...cpmResult.warnings];
  if (!cpmResult.hasValidCriticalPath && cpmResult.criticalPathContinuityWarnings.length > 0) {
    for (const warning of cpmResult.criticalPathContinuityWarnings) {
      if (!warnings.includes(warning)) {
        warnings.push(warning);
      }
    }
  }
  if (criticalActivityCodes.length > 0 && criticalTaskIds.length < criticalActivityCodes.length) {
    warnings.push(
      'Some critical CPM activities could not be matched to Gantt preview tasks. Open Logic Network or Level III Gantt for the full CPM view.',
    );
  }

  return {
    criticalActivityCodes,
    criticalTaskIds,
    projectDurationDays,
    projectFinishDate,
    warnings,
    totalFloatByActivityCode,
  };
}
