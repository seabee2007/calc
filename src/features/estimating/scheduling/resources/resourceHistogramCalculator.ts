import { addDaysToScheduleDate } from '../../application/mapScheduleCandidateToScheduleEventInput';
import type { ScheduleActivity } from '../adapters/estimateLineItemsToScheduleActivities';
import { isDisplayCritical } from '../cpm/cpmDisplayCritical';
import type { CpmActivityResult, CpmResult, ResourceHistogramDay } from '../cpmTypes';
import { resolveScheduleActivityCrewSize } from './scheduleActivityCrewSize';

export interface ResourceHistogramParams {
  activities: ScheduleActivity[];
  cpmActivities: CpmActivityResult[];
  projectStartDate: string;
  availableCrewSize: number;
  leveledOffsets?: Record<string, number>;
  cpmResult?: CpmResult | null;
}

function buildScheduleActivityIndex(activities: ScheduleActivity[]): Map<string, ScheduleActivity> {
  const index = new Map<string, ScheduleActivity>();
  for (const activity of activities) {
    index.set(activity.activityCode, activity);
    const runtimeId = activity.runtimeActivityId?.trim();
    if (runtimeId) {
      index.set(runtimeId, activity);
    }
  }
  return index;
}

function resolveActivityCrewSize(activity: ScheduleActivity): number {
  return resolveScheduleActivityCrewSize({
    crewSize: activity.crewSize,
    laborHours: activity.laborHours,
    manDays: activity.manDays,
    durationDays: activity.durationDays,
    hoursPerDay: activity.hoursPerDay,
  }).crewSize;
}

function resolveOffset(
  cpm: CpmActivityResult,
  leveledOffsets: Record<string, number>,
  activity: ScheduleActivity,
): number {
  return (
    leveledOffsets[cpm.activityCode] ??
    (activity.runtimeActivityId ? leveledOffsets[activity.runtimeActivityId] : undefined) ??
    0
  );
}

function isActivityCriticalForHistogram(
  cpmResult: CpmResult | null | undefined,
  cpm: CpmActivityResult,
  activity: ScheduleActivity,
  offset: number,
): boolean {
  const adjustedFloat = Math.max(0, cpm.totalFloat - offset);
  if (offset > 0 && adjustedFloat === 0) {
    return true;
  }
  if (cpmResult?.hasRunCpm) {
    return isDisplayCritical(cpmResult, activity.activityCode);
  }
  return cpm.isCritical;
}

export function calculateResourceHistogram(
  params: ResourceHistogramParams,
): ResourceHistogramDay[] {
  const {
    activities,
    cpmActivities,
    projectStartDate,
    availableCrewSize,
    leveledOffsets = {},
    cpmResult = null,
  } = params;

  if (cpmActivities.length === 0) return [];

  const actIndex = buildScheduleActivityIndex(activities);
  const projectDuration = Math.max(
    1,
    ...cpmActivities.map((cpm) => {
      const activity = actIndex.get(cpm.activityCode);
      const offset = activity ? resolveOffset(cpm, leveledOffsets, activity) : 0;
      return cpm.earlyFinish + offset;
    }),
  );

  const days: ResourceHistogramDay[] = [];

  for (let day = 0; day < projectDuration; day += 1) {
    let requiredCrew = 0;
    let criticalRequiredCrew = 0;
    let noncriticalRequiredCrew = 0;
    const activeActivities: ResourceHistogramDay['activeActivities'] = [];

    for (const cpm of cpmActivities) {
      const activity = actIndex.get(cpm.activityCode);
      if (!activity) continue;

      const offset = resolveOffset(cpm, leveledOffsets, activity);
      const es = cpm.earlyStart + offset;
      const ef = cpm.earlyFinish + offset;
      if (day < es || day >= ef) continue;

      const crewSize = resolveActivityCrewSize(activity);
      const isCritical = isActivityCriticalForHistogram(cpmResult, cpm, activity, offset);

      requiredCrew += crewSize;
      if (isCritical) {
        criticalRequiredCrew += crewSize;
      } else {
        noncriticalRequiredCrew += crewSize;
      }

      activeActivities.push({
        activityCode: activity.activityCode,
        activityTitle: activity.activityDescription,
        crewSize,
        isCritical,
        scheduledStartDay: es,
        scheduledFinishDay: ef - 1,
      });
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
