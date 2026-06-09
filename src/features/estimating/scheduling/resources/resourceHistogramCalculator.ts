import { addDaysToScheduleDate } from '../../application/mapScheduleCandidateToScheduleEventInput';
import type { ScheduleActivity } from '../adapters/estimateLineItemsToScheduleActivities';
import type { CpmActivityResult, ResourceHistogramDay } from '../cpmTypes';

export interface ResourceHistogramParams {
  activities: ScheduleActivity[];
  cpmActivities: CpmActivityResult[];
  projectStartDate: string;
  availableCrewSize: number;
  leveledOffsets?: Record<string, number>;
}

export function calculateResourceHistogram(
  params: ResourceHistogramParams,
): ResourceHistogramDay[] {
  const { activities, cpmActivities, projectStartDate, availableCrewSize, leveledOffsets = {} } =
    params;

  if (cpmActivities.length === 0) return [];

  const actByCode = new Map(activities.map((a) => [a.activityCode, a]));
  const projectDuration = Math.max(
    1,
    ...cpmActivities.map((a) => {
      const offset = leveledOffsets[a.activityCode] ?? 0;
      return a.earlyStart + offset + (actByCode.get(a.activityCode)?.durationDays ?? 1);
    }),
  );

  const days: ResourceHistogramDay[] = [];

  for (let day = 0; day < projectDuration; day += 1) {
    let requiredCrew = 0;
    let criticalRequiredCrew = 0;
    let noncriticalRequiredCrew = 0;
    const activeActivities: ResourceHistogramDay['activeActivities'] = [];

    for (const cpm of cpmActivities) {
      const activity = actByCode.get(cpm.activityCode);
      if (!activity) continue;
      const offset = leveledOffsets[cpm.activityCode] ?? 0;
      const es = cpm.earlyStart + offset;
      const ef = es + activity.durationDays;
      if (day >= es && day < ef) {
        requiredCrew += activity.crewSize;
        if (cpm.isCritical) {
          criticalRequiredCrew += activity.crewSize;
        } else {
          noncriticalRequiredCrew += activity.crewSize;
        }
        activeActivities.push({
          activityCode: activity.activityCode,
          activityTitle: activity.activityDescription,
          crewSize: activity.crewSize,
          isCritical: cpm.isCritical,
          scheduledStartDay: es,
          scheduledFinishDay: ef - 1,
        });
      }
    }

    activeActivities.sort((left, right) => left.activityCode.localeCompare(right.activityCode));

    const overallocatedAmount = Math.max(0, requiredCrew - availableCrewSize);

    days.push({
      dayOffset: day,
      date: addDaysToScheduleDate(projectStartDate, day),
      requiredCrew,
      criticalRequiredCrew,
      noncriticalRequiredCrew,
      availableCrew: availableCrewSize,
      overallocatedAmount,
      isOverallocated: overallocatedAmount > 0,
      activeActivities,
    });
  }

  return days;
}

export function countOverallocatedDays(histogram: ResourceHistogramDay[]): number {
  return histogram.filter((day) => day.isOverallocated).length;
}

export function peakRequiredCrew(histogram: ResourceHistogramDay[]): number {
  if (histogram.length === 0) return 0;
  return Math.max(...histogram.map((day) => day.requiredCrew));
}

export function buildCriticalOnlyHistogram(
  histogram: ResourceHistogramDay[],
): ResourceHistogramDay[] {
  return histogram.map((day) => ({
    ...day,
    requiredCrew: day.criticalRequiredCrew,
    noncriticalRequiredCrew: 0,
    overallocatedAmount: Math.max(0, day.criticalRequiredCrew - day.availableCrew),
    isOverallocated: day.criticalRequiredCrew > day.availableCrew,
  }));
}
