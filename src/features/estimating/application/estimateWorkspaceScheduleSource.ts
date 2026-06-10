import type { ProjectConstructionActivity } from '../domain/constructionActivityTypes';
import type { EstimateSettings } from '../domain/estimateTypes';
import type { EstimateDomainTask } from '../infrastructure/estimateDbTypes';
import { constructionActivitiesToScheduleActivities } from '../scheduling/adapters/constructionActivitiesToScheduleActivities';
import {
  estimateLineItemsToScheduleActivities,
  type ScheduleActivityAdapterResult,
} from '../scheduling/adapters/estimateLineItemsToScheduleActivities';

/** Default product rule: legacy estimate line items must not feed schedule tabs. */
export const ENABLE_LEGACY_ESTIMATE_SCHEDULE_FALLBACK = false;

export interface ResolveEstimateWorkspaceScheduleActivitiesParams {
  constructionActivities: ProjectConstructionActivity[];
  lineItems: EstimateDomainTask[];
  estimateSettings: Pick<EstimateSettings, 'defaultCrewSize' | 'hoursPerDay'>;
  scheduleSettingsHoursPerDay?: number;
  enableLegacyEstimateScheduleFallback?: boolean;
  schedulingEnabled?: boolean;
}

/**
 * Resolve schedule activities for Schedule Preview, Logic Network, CPM, and Gantt.
 *
 * Source order:
 * 1. Saved construction activities (scheduleEnabled filtered in adapter)
 * 2. Legacy estimate line items only when explicitly enabled
 * 3. Otherwise empty
 */
export function resolveEstimateWorkspaceScheduleActivities(
  params: ResolveEstimateWorkspaceScheduleActivitiesParams,
): ScheduleActivityAdapterResult {
  if (params.schedulingEnabled === false) {
    return { activities: [], warnings: [] };
  }

  if (params.constructionActivities.length > 0) {
    return constructionActivitiesToScheduleActivities(params.constructionActivities);
  }

  const legacyEnabled =
    params.enableLegacyEstimateScheduleFallback ?? ENABLE_LEGACY_ESTIMATE_SCHEDULE_FALLBACK;

  if (legacyEnabled && params.lineItems.length > 0) {
    return estimateLineItemsToScheduleActivities(params.lineItems, {
      defaultCrewSize: params.estimateSettings.defaultCrewSize,
      hoursPerDay: params.scheduleSettingsHoursPerDay ?? params.estimateSettings.hoursPerDay,
    });
  }

  return { activities: [], warnings: [] };
}

export function countScheduleEnabledConstructionActivities(
  activities: ProjectConstructionActivity[],
): number {
  return activities.filter((activity) => activity.scheduleEnabled).length;
}
