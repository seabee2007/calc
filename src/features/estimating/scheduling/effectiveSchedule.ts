import { addDaysToScheduleDate } from '../application/mapScheduleCandidateToScheduleEventInput';
import type { ScheduleActivity } from './adapters/estimateLineItemsToScheduleActivities';
import type { CpmLogicLink, CpmResult } from './cpmTypes';

/**
 * Canonical "effective schedule" resolver.
 *
 * The app has three date-producing surfaces (CPM logic network, Level III
 * Gantt + resource leveling, and the draft Schedule Preview). They used to each
 * invent their own duration math, so applying resource leveling produced
 * disagreeing numbers (e.g. 22 / 25 / 27). This module derives ONE effective
 * schedule from the committed CPM result plus any applied leveled offsets so
 * every consumer can report the same dates and duration.
 *
 * Day-index convention matches the Level III Gantt (activity-days):
 *   - earlyStart is the inclusive day-0 based start index
 *   - finish index is exclusive (start + durationDays)
 *   - planned dates map index -> calendar date via addDaysToScheduleDate
 */

export type EffectiveScheduleMode = 'baselineCpm' | 'resourceLeveled';

export interface EffectiveActivityDates {
  activityCode: string;
  cpmEarlyStart: number;
  cpmEarlyFinish: number;
  leveledOffsetDays: number;
  leveledStartDayIndex: number;
  leveledFinishDayIndex: number;
  plannedStart: string;
  plannedFinish: string;
}

export interface EffectiveScheduleSummary {
  /** True when at least one non-zero leveled offset is applied. */
  levelingApplied: boolean;
  mode: EffectiveScheduleMode;
  cpmBaselineDurationDays: number;
  leveledDurationDays: number;
  /** Leveled duration when leveling is applied, otherwise the CPM baseline. */
  effectiveDurationDays: number;
  plannedProjectStart: string | null;
  plannedProjectFinish: string | null;
  byActivityCode: Map<string, EffectiveActivityDates>;
}

export interface ResolveEffectiveScheduleParams {
  activities: ScheduleActivity[];
  cpmResult: CpmResult | null;
  projectStartDate: string;
  leveledOffsets: Record<string, number>;
}

export function resolveEffectiveSchedule(
  params: ResolveEffectiveScheduleParams,
): EffectiveScheduleSummary | null {
  const { activities, cpmResult, projectStartDate, leveledOffsets } = params;

  if (!cpmResult || !cpmResult.hasRunCpm || cpmResult.activities.length === 0) {
    return null;
  }

  const durationByCode = new Map(
    activities.map((activity) => [activity.activityCode, activity.durationDays]),
  );

  const byActivityCode = new Map<string, EffectiveActivityDates>();
  let plannedProjectStart: string | null = null;
  let plannedProjectFinish: string | null = null;
  let leveledDurationDays = 0;
  let levelingApplied = false;

  for (const cpm of cpmResult.activities) {
    const durationDays = durationByCode.get(cpm.activityCode) ?? 1;
    const offset = leveledOffsets[cpm.activityCode] ?? 0;
    if (offset !== 0) levelingApplied = true;

    const startIndex = cpm.earlyStart + offset;
    const finishIndex = startIndex + durationDays;
    const plannedStart = addDaysToScheduleDate(projectStartDate, startIndex);
    const plannedFinish = addDaysToScheduleDate(projectStartDate, finishIndex - 1);

    byActivityCode.set(cpm.activityCode, {
      activityCode: cpm.activityCode,
      cpmEarlyStart: cpm.earlyStart,
      cpmEarlyFinish: cpm.earlyFinish,
      leveledOffsetDays: offset,
      leveledStartDayIndex: startIndex,
      leveledFinishDayIndex: finishIndex,
      plannedStart,
      plannedFinish,
    });

    if (finishIndex > leveledDurationDays) leveledDurationDays = finishIndex;
    if (plannedProjectStart === null || plannedStart < plannedProjectStart) {
      plannedProjectStart = plannedStart;
    }
    if (plannedProjectFinish === null || plannedFinish > plannedProjectFinish) {
      plannedProjectFinish = plannedFinish;
    }
  }

  const cpmBaselineDurationDays = cpmResult.projectDurationDays;
  const effectiveDurationDays = levelingApplied
    ? Math.max(leveledDurationDays, cpmBaselineDurationDays)
    : cpmBaselineDurationDays;

  return {
    levelingApplied,
    mode: levelingApplied ? 'resourceLeveled' : 'baselineCpm',
    cpmBaselineDurationDays,
    leveledDurationDays: Math.max(leveledDurationDays, cpmBaselineDurationDays),
    effectiveDurationDays,
    plannedProjectStart,
    plannedProjectFinish,
    byActivityCode,
  };
}

export interface EffectiveActivityAnalysis extends EffectiveActivityDates {
  /** Total float relative to the leveled project finish (effective slack). */
  effectiveTotalFloat: number;
  /** True when the activity is on the controlling chain driving the leveled finish. */
  controllingAfterLeveling: boolean;
  /** Baseline CPM total float (unchanged logic). */
  baselineTotalFloat: number;
  baselineFreeFloat: number;
}

export interface EffectiveScheduleAnalysis {
  levelingApplied: boolean;
  cpmBaselineDurationDays: number;
  leveledDurationDays: number;
  effectiveDurationDays: number;
  leveledProjectFinishIndex: number;
  plannedProjectStart: string | null;
  plannedProjectFinish: string | null;
  controllingActivityCodes: string[];
  byActivityCode: Map<string, EffectiveActivityAnalysis>;
}

export interface GetEffectiveScheduleAnalysisParams {
  baselineCpmResult: CpmResult | null;
  activities: ScheduleActivity[];
  logicLinks: CpmLogicLink[];
  leveledActivityOffsets: Record<string, number>;
  projectStartDate: string;
}

/**
 * Builds the resource-leveled effective schedule analysis the Logic Network can
 * display. Dependency relationships are NOT modified — this only re-derives an
 * effective controlling path and effective float from the leveled start/finish
 * positions so a float activity pushed into the controlling chain is visible.
 *
 * Effective float is a backward pass relative to the leveled project finish,
 * using the leveled (early) finish positions as the forward result; an activity
 * with zero effective float is controlling after leveling.
 */
export function getEffectiveScheduleAnalysis(
  params: GetEffectiveScheduleAnalysisParams,
): EffectiveScheduleAnalysis | null {
  const { baselineCpmResult, activities, logicLinks, leveledActivityOffsets, projectStartDate } =
    params;

  const base = resolveEffectiveSchedule({
    activities,
    cpmResult: baselineCpmResult,
    projectStartDate,
    leveledOffsets: leveledActivityOffsets,
  });
  if (!base || !baselineCpmResult) return null;

  const durationByCode = new Map(
    activities.map((activity) => [activity.activityCode, activity.durationDays]),
  );
  const baselineByCode = new Map(
    baselineCpmResult.activities.map((cpm) => [cpm.activityCode, cpm]),
  );

  const leveledProjectFinishIndex = base.leveledDurationDays;

  // Backward pass: late finish defaults to the leveled project finish, then is
  // tightened by each successor relationship. Iterate to a fixpoint.
  const lateFinish = new Map<string, number>();
  for (const [code, dates] of base.byActivityCode) {
    lateFinish.set(code, leveledProjectFinishIndex);
    void dates;
  }

  const lateStartOf = (code: string): number => {
    const duration = durationByCode.get(code) ?? 1;
    return (lateFinish.get(code) ?? leveledProjectFinishIndex) - duration;
  };

  const relevantLinks = logicLinks.filter(
    (link) =>
      base.byActivityCode.has(link.predecessorActivityCode) &&
      base.byActivityCode.has(link.successorActivityCode),
  );

  for (let guard = 0; guard <= relevantLinks.length; guard += 1) {
    let changed = false;
    for (const link of relevantLinks) {
      const pred = link.predecessorActivityCode;
      const succ = link.successorActivityCode;
      const lag = link.lagDays ?? 0;
      const succLateStart = lateStartOf(succ);
      const succLateFinish = lateFinish.get(succ) ?? leveledProjectFinishIndex;
      const predDuration = durationByCode.get(pred) ?? 1;

      let predLateFinishConstraint: number;
      switch (link.relationshipType) {
        case 'SS':
          predLateFinishConstraint = succLateStart - lag + predDuration;
          break;
        case 'FF':
          predLateFinishConstraint = succLateFinish - lag;
          break;
        case 'SF':
          predLateFinishConstraint = succLateFinish - lag + predDuration;
          break;
        case 'FS':
        default:
          predLateFinishConstraint = succLateStart - lag;
          break;
      }

      const current = lateFinish.get(pred) ?? leveledProjectFinishIndex;
      if (predLateFinishConstraint < current) {
        lateFinish.set(pred, predLateFinishConstraint);
        changed = true;
      }
    }
    if (!changed) break;
  }

  const byActivityCode = new Map<string, EffectiveActivityAnalysis>();
  const controllingActivityCodes: string[] = [];

  for (const [code, dates] of base.byActivityCode) {
    const baselineCpm = baselineByCode.get(code);
    const effectiveLateFinish = lateFinish.get(code) ?? leveledProjectFinishIndex;
    const effectiveTotalFloat = Math.max(0, effectiveLateFinish - dates.leveledFinishDayIndex);
    const controllingAfterLeveling = effectiveTotalFloat === 0;
    if (controllingAfterLeveling) controllingActivityCodes.push(code);

    byActivityCode.set(code, {
      ...dates,
      effectiveTotalFloat,
      controllingAfterLeveling,
      baselineTotalFloat: baselineCpm?.totalFloat ?? 0,
      baselineFreeFloat: baselineCpm?.freeFloat ?? 0,
    });
  }

  return {
    levelingApplied: base.levelingApplied,
    cpmBaselineDurationDays: base.cpmBaselineDurationDays,
    leveledDurationDays: base.leveledDurationDays,
    effectiveDurationDays: base.effectiveDurationDays,
    leveledProjectFinishIndex,
    plannedProjectStart: base.plannedProjectStart,
    plannedProjectFinish: base.plannedProjectFinish,
    controllingActivityCodes,
    byActivityCode,
  };
}
