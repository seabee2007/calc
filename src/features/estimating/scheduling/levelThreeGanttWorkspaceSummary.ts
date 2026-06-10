import type { ScheduleActivity } from './adapters/estimateLineItemsToScheduleActivities';
import { isDisplayCritical } from './cpm/cpmDisplayCritical';
import type { CpmResult, ResourceHistogramDay } from './cpmTypes';

export interface LevelThreeGanttWorkspaceSummary {
  projectDurationDays: number;
  activityCount: number;
  criticalActivityCount: number;
  peakCrew: number;
  availableCrew: number;
  overallocatedDays: number;
}

export function computeLevelThreeGanttWorkspaceSummary(
  activities: ScheduleActivity[],
  cpmResult: CpmResult | null,
  resourceHistogram: ResourceHistogramDay[],
): LevelThreeGanttWorkspaceSummary {
  const projectDurationDays = cpmResult?.projectDurationDays ?? 0;
  const criticalActivityCount =
    cpmResult?.hasRunCpm === true
      ? activities.filter((activity) => isDisplayCritical(cpmResult, activity.activityCode)).length
      : 0;
  const peakCrew =
    resourceHistogram.length > 0
      ? Math.max(...resourceHistogram.map((day) => day.requiredCrew))
      : 0;
  const availableCrew = resourceHistogram[0]?.availableCrew ?? 0;
  const overallocatedDays = resourceHistogram.filter((day) => day.isOverallocated).length;

  return {
    projectDurationDays,
    activityCount: activities.length,
    criticalActivityCount,
    peakCrew,
    availableCrew,
    overallocatedDays,
  };
}

export function formatLevelThreeGanttWorkspaceSummary(
  summary: LevelThreeGanttWorkspaceSummary,
): string {
  return [
    `${summary.projectDurationDays}d`,
    `${summary.activityCount} activities`,
    `Critical: ${summary.criticalActivityCount}`,
    `Peak: ${summary.peakCrew}`,
    `Available: ${summary.availableCrew}`,
    `Over: ${summary.overallocatedDays}d`,
  ].join(' · ');
}
