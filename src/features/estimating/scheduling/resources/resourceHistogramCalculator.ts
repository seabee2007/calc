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

    for (const cpm of cpmActivities) {
      const activity = actByCode.get(cpm.activityCode);
      if (!activity) continue;
      const offset = leveledOffsets[cpm.activityCode] ?? 0;
      const es = cpm.earlyStart + offset;
      const ef = es + activity.durationDays;
      if (day >= es && day < ef) {
        requiredCrew += activity.crewSize;
      }
    }

    days.push({
      dayOffset: day,
      date: addDaysToScheduleDate(projectStartDate, day),
      requiredCrew,
      availableCrew: availableCrewSize,
      isOverallocated: requiredCrew > availableCrewSize,
    });
  }

  return days;
}
