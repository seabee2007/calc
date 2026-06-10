import type { EstimateSchedulePlan } from '../domain/estimateScheduleTypes';
import type { EstimateDomainVersion } from '../infrastructure/estimateDbTypes';
import {
  mapEstimateTaskToScheduleCandidate,
  type MapEstimateTaskToScheduleCandidateContext,
} from './mapEstimateTaskToScheduleCandidate';
import { compareActivityCodes } from './estimateActivityCoding';
import { resolveEstimateSchedulePredecessors } from './resolveEstimateSchedulePredecessors';
import { groupScheduleCandidates } from './schedulePlanGrouping';

export interface BuildEstimateSchedulePlanParams {
  version: EstimateDomainVersion;
  estimateId: string;
  projectId: string;
  generatedAtIso?: string;
}

function isTaskRow(lineType: EstimateDomainVersion['lineItems'][number]['lineType']): boolean {
  return lineType === 'task' || lineType == null;
}

/** Build a grouped draft schedule plan from a saved estimate version. */
export function buildEstimateSchedulePlan(
  params: BuildEstimateSchedulePlanParams,
): EstimateSchedulePlan {
  const { version, estimateId, projectId } = params;
  const taskRows = version.lineItems.filter((task) => isTaskRow(task.lineType));
  const includedTasks = taskRows
    .filter((task) => task.scheduleEnabled)
    .sort(
      (left, right) =>
        compareActivityCodes(left.activityCode, right.activityCode) ||
        left.position - right.position,
    );
  const excludedTaskCount = taskRows.filter((task) => !task.scheduleEnabled).length;

  const context: MapEstimateTaskToScheduleCandidateContext = {
    projectId,
    estimateId,
    estimateVersionId: version.id,
    estimateVersionNumber: version.versionNumber,
  };

  const candidates = includedTasks.map((task) =>
    mapEstimateTaskToScheduleCandidate(task, context),
  );

  const preliminaryPlan: EstimateSchedulePlan = {
    meta: {
      projectId,
      estimateId,
      estimateVersionId: version.id,
      estimateVersionNumber: version.versionNumber,
      generatedAtIso: params.generatedAtIso ?? new Date().toISOString(),
      scheduleEnabledTaskCount: candidates.length,
      excludedTaskCount,
    },
    divisions: groupScheduleCandidates(candidates),
  };

  return resolveEstimateSchedulePredecessors(preliminaryPlan).plan;
}

/** Empty plan helper for tests and edge cases. */
export function emptyEstimateSchedulePlan(
  params: Pick<BuildEstimateSchedulePlanParams, 'estimateId' | 'projectId'> & {
    estimateVersionId?: string;
    estimateVersionNumber?: number;
    generatedAtIso?: string;
  },
): EstimateSchedulePlan {
  return {
    meta: {
      projectId: params.projectId,
      estimateId: params.estimateId,
      estimateVersionId: params.estimateVersionId ?? '',
      estimateVersionNumber: params.estimateVersionNumber ?? 0,
      generatedAtIso: params.generatedAtIso ?? new Date().toISOString(),
      scheduleEnabledTaskCount: 0,
      excludedTaskCount: 0,
    },
    divisions: [],
  };
}
