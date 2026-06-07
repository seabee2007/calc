import type { ScheduleActivity } from '../adapters/estimateLineItemsToScheduleActivities';
import type { CpmLogicLink } from '../cpmTypes';
import { wouldCreateCircularDependency } from './logicCycleUtils';

export type LogicTopologyLabel = 'open-start' | 'open-finish' | 'missing-duration' | 'circular';

export interface LogicNetworkTopology {
  predecessorCountByCode: Record<string, number>;
  successorCountByCode: Record<string, number>;
  openStartActivityCodes: string[];
  openFinishActivityCodes: string[];
  hasCycle: boolean;
}

export function buildLogicNetworkTopology(
  activities: ScheduleActivity[],
  logicLinks: CpmLogicLink[],
): LogicNetworkTopology {
  const activityCodes = activities.map((activity) => activity.activityCode);
  const predecessorCountByCode: Record<string, number> = {};
  const successorCountByCode: Record<string, number> = {};

  for (const code of activityCodes) {
    predecessorCountByCode[code] = 0;
    successorCountByCode[code] = 0;
  }

  for (const link of logicLinks) {
    if (successorCountByCode[link.predecessorActivityCode] !== undefined) {
      successorCountByCode[link.predecessorActivityCode]! += 1;
    }
    if (predecessorCountByCode[link.successorActivityCode] !== undefined) {
      predecessorCountByCode[link.successorActivityCode]! += 1;
    }
  }

  const openStartActivityCodes = activityCodes.filter(
    (code) => (predecessorCountByCode[code] ?? 0) === 0,
  );
  const openFinishActivityCodes = activityCodes.filter(
    (code) => (successorCountByCode[code] ?? 0) === 0,
  );

  return {
    predecessorCountByCode,
    successorCountByCode,
    openStartActivityCodes,
    openFinishActivityCodes,
    hasCycle: logicLinks.length > 0 && wouldCreateCircularDependency(logicLinks, []),
  };
}

export function resolveLogicTopologyLabel(
  topology: LogicNetworkTopology,
  activity: ScheduleActivity,
): LogicTopologyLabel | null {
  if (topology.hasCycle) return 'circular';
  if (activity.durationDays < 1) return 'missing-duration';
  if (topology.openStartActivityCodes.includes(activity.activityCode)) return 'open-start';
  if (topology.openFinishActivityCodes.includes(activity.activityCode)) return 'open-finish';
  return null;
}
