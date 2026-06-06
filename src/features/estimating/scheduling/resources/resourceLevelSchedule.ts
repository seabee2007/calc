import type { ScheduleActivity } from '../adapters/estimateLineItemsToScheduleActivities';
import type {
  CpmActivityResult,
  CpmLogicLink,
  MovedActivity,
  ResourceLevelingResult,
} from '../cpmTypes';
import { calculateCpm } from '../cpm/calculateCpm';
import { calculateResourceHistogram } from './resourceHistogramCalculator';

export interface ResourceLevelScheduleParams {
  activities: ScheduleActivity[];
  logicLinks: CpmLogicLink[];
  availableCrewSize: number;
  projectStartDate: string;
}

export function resourceLevelSchedule(
  params: ResourceLevelScheduleParams,
): ResourceLevelingResult {
  const { activities, logicLinks, availableCrewSize, projectStartDate } = params;

  const initialCpm = calculateCpm({ activities, logicLinks });
  const warnings: string[] = [...initialCpm.warnings];

  if (initialCpm.activities.length === 0) {
    return {
      leveledActivities: [],
      resourceHistogramBefore: [],
      resourceHistogramAfter: [],
      projectDurationBefore: 0,
      projectDurationAfter: 0,
      movedActivities: [],
      warnings,
    };
  }

  const histogramBefore = calculateResourceHistogram({
    activities,
    cpmActivities: initialCpm.activities,
    projectStartDate,
    availableCrewSize,
  });

  // Work with mutable offsets
  const offsets: Record<string, number> = {};
  const actByCode = new Map(activities.map((a) => [a.activityCode, a]));
  const movedActivities: MovedActivity[] = [];

  let maxIterations = activities.length * activities.length + 10;

  while (maxIterations-- > 0) {
    // Recompute CPM with current offsets applied
    const adjustedActivities: ScheduleActivity[] = activities.map((a) => ({
      ...a,
      durationDays: a.durationDays, // durations don't change
    }));

    const currentCpm = calculateCpm({ activities: adjustedActivities, logicLinks });

    // Apply offsets to cpm results
    const adjustedCpmActivities: CpmActivityResult[] = currentCpm.activities.map((cpm) => {
      const offset = offsets[cpm.activityCode] ?? 0;
      return {
        ...cpm,
        earlyStart: cpm.earlyStart + offset,
        earlyFinish: cpm.earlyFinish + offset,
        lateStart: cpm.lateStart + offset,
        lateFinish: cpm.lateFinish + offset,
        totalFloat: cpm.totalFloat - offset,
      };
    });

    // Check current histogram
    const currentHistogram = calculateResourceHistogram({
      activities,
      cpmActivities: adjustedCpmActivities,
      projectStartDate,
      availableCrewSize,
      leveledOffsets: offsets,
    });

    const overallocatedDays = currentHistogram.filter((d) => d.isOverallocated);
    if (overallocatedDays.length === 0) break;

    const firstOverDay = overallocatedDays[0];

    // Find noncritical activities active on this day, sorted by ascending TF
    const movable = adjustedCpmActivities
      .filter((cpm) => {
        if (cpm.isCritical) return false;
        const activity = actByCode.get(cpm.activityCode);
        if (!activity) return false;
        const es = cpm.earlyStart;
        const ef = es + activity.durationDays;
        return firstOverDay.dayOffset >= es && firstOverDay.dayOffset < ef;
      })
      .sort((left, right) => left.totalFloat - right.totalFloat);

    if (movable.length === 0) {
      warnings.push(
        `Resources exceed availability on day ${firstOverDay.dayOffset}. Some activities cannot be delayed further — project duration may need to extend or crew size must increase.`,
      );
      break;
    }

    // Delay the activity with least float by 1 day (do not exceed total float)
    const target = movable[0];
    const currentOffset = offsets[target.activityCode] ?? 0;
    const maxAdditionalDelay = Math.max(0, target.totalFloat - 1);
    if (maxAdditionalDelay <= 0) {
      warnings.push(
        `Resources exceed availability. Activity "${target.activityCode}" cannot be delayed without extending the project.`,
      );
      break;
    }

    offsets[target.activityCode] = currentOffset + 1;

    const existingMoved = movedActivities.find((m) => m.activityCode === target.activityCode);
    if (existingMoved) {
      existingMoved.newStart = target.earlyStart + offsets[target.activityCode]!;
      existingMoved.daysMoved = offsets[target.activityCode]!;
    } else {
      movedActivities.push({
        activityCode: target.activityCode,
        oldStart: target.earlyStart - currentOffset,
        newStart: target.earlyStart + 1,
        daysMoved: 1,
        reason: `Overallocation on day ${firstOverDay.dayOffset}`,
      });
    }
  }

  // Final state
  const finalCpm = calculateCpm({ activities, logicLinks });
  const finalAdjusted: CpmActivityResult[] = finalCpm.activities.map((cpm) => {
    const offset = offsets[cpm.activityCode] ?? 0;
    return {
      ...cpm,
      earlyStart: cpm.earlyStart + offset,
      earlyFinish: cpm.earlyFinish + offset,
      totalFloat: cpm.totalFloat - offset,
    };
  });

  const histogramAfter = calculateResourceHistogram({
    activities,
    cpmActivities: finalAdjusted,
    projectStartDate,
    availableCrewSize,
    leveledOffsets: offsets,
  });

  const projectDurationAfter = Math.max(
    initialCpm.projectDurationDays,
    ...finalAdjusted.map((a) => {
      const act = actByCode.get(a.activityCode);
      return a.earlyStart + (act?.durationDays ?? 1);
    }),
  );

  return {
    leveledActivities: finalAdjusted,
    resourceHistogramBefore: histogramBefore,
    resourceHistogramAfter: histogramAfter,
    projectDurationBefore: initialCpm.projectDurationDays,
    projectDurationAfter,
    movedActivities,
    warnings,
  };
}
