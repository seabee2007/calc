import type { ProjectConstructionActivity } from '../domain/constructionActivityTypes';
import type { EstimateSchedulePlan } from '../domain/estimateScheduleTypes';
import {
  compareConstructionActivitiesForSchedule,
  mapConstructionActivityToScheduleCandidate,
  type MapConstructionActivityToScheduleCandidateContext,
} from './mapConstructionActivityToScheduleCandidate';
import { groupScheduleCandidates } from './schedulePlanGrouping';
import { resolveEstimateSchedulePredecessors } from './resolveEstimateSchedulePredecessors';

export interface BuildConstructionActivitySchedulePlanParams {
  activities: ProjectConstructionActivity[];
  estimateId: string;
  projectId: string;
  estimateVersionId: string;
  estimateVersionNumber: number;
  generatedAtIso?: string;
}

/** Build a grouped draft schedule plan from saved construction activities. */
export function buildConstructionActivitySchedulePlan(
  params: BuildConstructionActivitySchedulePlanParams,
): EstimateSchedulePlan {
  const {
    activities,
    estimateId,
    projectId,
    estimateVersionId,
    estimateVersionNumber,
  } = params;

  const excludedTaskCount = activities.filter((activity) => !activity.scheduleEnabled).length;
  const includedActivities = activities
    .filter((activity) => activity.scheduleEnabled)
    .sort(compareConstructionActivitiesForSchedule);

  const context: MapConstructionActivityToScheduleCandidateContext = {
    projectId,
    estimateId,
    estimateVersionId,
    estimateVersionNumber,
  };

  const candidates = includedActivities.map((activity) =>
    mapConstructionActivityToScheduleCandidate(activity, context),
  );

  const preliminaryPlan: EstimateSchedulePlan = {
    meta: {
      projectId,
      estimateId,
      estimateVersionId,
      estimateVersionNumber,
      generatedAtIso: params.generatedAtIso ?? new Date().toISOString(),
      scheduleEnabledTaskCount: candidates.length,
      excludedTaskCount,
    },
    divisions: groupScheduleCandidates(candidates),
  };

  return resolveEstimateSchedulePredecessors(preliminaryPlan).plan;
}
