import type { ScheduleActivity } from '../adapters/estimateLineItemsToScheduleActivities';
import type {
  CpmActivityResult,
  CpmLogicLink,
  CpmRelationshipType,
  MovedActivity,
  ResourceLevelingResult,
  UnmovedActivity,
} from '../cpmTypes';
import { calculateCpm } from '../cpm/calculateCpm';
import { buildResourceDummyLinks } from './resourceDummyLinks';
import {
  buildCriticalOnlyHistogram,
  calculateResourceHistogram,
  countOverallocatedDays,
  peakRequiredCrew,
} from './resourceHistogramCalculator';

/**
 * Resource leveling — shifts activities within float to reduce daily crew over-allocation.
 * Does not change crew size or activity duration. Crew optimization / crashing is separate
 * (see scheduling/crewOptimizationTypes.ts).
 */

export interface ResourceLevelScheduleParams {
  activities: ScheduleActivity[];
  logicLinks: CpmLogicLink[];
  availableCrewSize: number;
  projectStartDate: string;
  allowProjectExtension?: boolean;
}

function minSuccessorStart(
  link: CpmLogicLink,
  relationshipType: CpmRelationshipType,
  predES: number,
  predEF: number,
  succDuration: number,
): number {
  switch (relationshipType) {
    case 'SS':
      return predES + link.lagDays;
    case 'FF':
      return predEF + link.lagDays - succDuration;
    case 'SF':
      return predES + link.lagDays - succDuration;
    case 'FS':
    default:
      return predEF + link.lagDays;
  }
}

function effectiveStart(cpm: CpmActivityResult, offsets: Record<string, number>): number {
  return cpm.earlyStart + (offsets[cpm.activityCode] ?? 0);
}

function computeRequiredCrewForDay(
  day: number,
  activities: ScheduleActivity[],
  cpmActivities: CpmActivityResult[],
  offsets: Record<string, number>,
): number {
  const actByCode = new Map(activities.map((a) => [a.activityCode, a]));
  let required = 0;
  for (const cpm of cpmActivities) {
    const activity = actByCode.get(cpm.activityCode);
    if (!activity) continue;
    const es = effectiveStart(cpm, offsets);
    const ef = es + activity.durationDays;
    if (day >= es && day < ef) {
      required += activity.crewSize;
    }
  }
  return required;
}

function activityFitsAtStart(
  activityCode: string,
  startDay: number,
  activities: ScheduleActivity[],
  cpmActivities: CpmActivityResult[],
  offsets: Record<string, number>,
  availableCrewSize: number,
): boolean {
  const actByCode = new Map(activities.map((a) => [a.activityCode, a]));
  const activity = actByCode.get(activityCode);
  if (!activity) return false;
  for (let day = startDay; day < startDay + activity.durationDays; day += 1) {
    const required = computeRequiredCrewForDay(day, activities, cpmActivities, offsets);
    if (required > availableCrewSize) return false;
  }
  return true;
}

function buildOutgoingLinks(logicLinks: CpmLogicLink[]): Map<string, CpmLogicLink[]> {
  const outgoing = new Map<string, CpmLogicLink[]>();
  for (const link of logicLinks) {
    const list = outgoing.get(link.predecessorActivityCode) ?? [];
    list.push(link);
    outgoing.set(link.predecessorActivityCode, list);
  }
  return outgoing;
}

function enforceSuccessorConstraints(
  predecessorCode: string,
  activities: ScheduleActivity[],
  baseCpm: CpmActivityResult[],
  offsets: Record<string, number>,
  outgoingLinks: Map<string, CpmLogicLink[]>,
  allowProjectExtension: boolean,
): { ok: boolean; dependentCodes: string[] } {
  const actByCode = new Map(activities.map((a) => [a.activityCode, a]));
  const cpmByCode = new Map(baseCpm.map((c) => [c.activityCode, c]));
  const dependentCodes: string[] = [];

  const visit = (predCode: string): boolean => {
    const predCpm = cpmByCode.get(predCode);
    const predAct = actByCode.get(predCode);
    if (!predCpm || !predAct) return true;

    const predES = effectiveStart(predCpm, offsets);
    const predEF = predES + predAct.durationDays;

    for (const link of outgoingLinks.get(predCode) ?? []) {
      const succCpm = cpmByCode.get(link.successorActivityCode);
      const succAct = actByCode.get(link.successorActivityCode);
      if (!succCpm || !succAct) continue;

      const minStart = minSuccessorStart(
        link,
        link.relationshipType,
        predES,
        predEF,
        succAct.durationDays,
      );
      const currentStart = effectiveStart(succCpm, offsets);
      if (currentStart >= minStart) continue;

      const neededOffset = minStart - succCpm.earlyStart;
      if (!allowProjectExtension && neededOffset > succCpm.totalFloat) {
        return false;
      }

      offsets[link.successorActivityCode] = neededOffset;
      if (!dependentCodes.includes(link.successorActivityCode)) {
        dependentCodes.push(link.successorActivityCode);
      }
      if (!visit(link.successorActivityCode)) {
        return false;
      }
    }

    return true;
  };

  const ok = visit(predecessorCode);
  return { ok, dependentCodes };
}

/**
 * Records, for each delayed activity, the activities that were occupying the
 * constrained crew before it could start (resource providers). This is the
 * "resource flow" relationship from the planning manual and is the ONLY source
 * for resource-dummy arrows in the Resource-Leveled Logic Network. It is purely
 * descriptive metadata — it never feeds CPM, float, or duration math.
 *
 * A provider A is recorded for a delayed activity B only when:
 *   - B was actually delayed by leveling (offset > 0),
 *   - A hands off directly to B (A's leveled finish == B's leveled start),
 *   - A and B overlapped in the baseline (un-leveled) schedule, i.e. they
 *     genuinely competed for the same crew window.
 */
function attachResourceProviders(
  movedActivities: MovedActivity[],
  activities: ScheduleActivity[],
  baseCpm: CpmActivityResult[],
  offsets: Record<string, number>,
): void {
  const actByCode = new Map(activities.map((a) => [a.activityCode, a]));
  const cpmByCode = new Map(baseCpm.map((c) => [c.activityCode, c]));

  for (const moved of movedActivities) {
    const movedCpm = cpmByCode.get(moved.activityCode);
    if (!movedCpm) continue;
    const movedOffset = offsets[moved.activityCode] ?? 0;
    if (movedOffset <= 0) {
      moved.resourceProviderActivityCodes = [];
      continue;
    }
    const movedStart = movedCpm.earlyStart + movedOffset;

    const providers: string[] = [];
    for (const candidate of baseCpm) {
      if (candidate.activityCode === moved.activityCode) continue;
      const candidateAct = actByCode.get(candidate.activityCode);
      if (!candidateAct) continue;
      const candidateOffset = offsets[candidate.activityCode] ?? 0;
      const candidateLeveledFinish =
        candidate.earlyStart + candidateOffset + candidateAct.durationDays;
      // Direct resource handoff: the provider frees the constrained crew on the
      // exact day the delayed activity starts (measured on the LEVELED timeline).
      // This is the precise provider signal. We must NOT require baseline-window
      // overlap here: resource leveling is precisely what serialized these
      // activities, so they typically did NOT overlap in the pre-leveling
      // schedule. Requiring baseline overlap dropped genuine providers and broke
      // the resource-leveled critical chain.
      if (candidateLeveledFinish !== movedStart) continue;
      providers.push(candidate.activityCode);
    }
    moved.resourceProviderActivityCodes = providers;
  }
}

function buildLeveledActivities(
  baseCpm: CpmActivityResult[],
  offsets: Record<string, number>,
): CpmActivityResult[] {
  return baseCpm.map((cpm) => {
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
}

function projectDurationFromOffsets(
  activities: ScheduleActivity[],
  baseCpm: CpmActivityResult[],
  offsets: Record<string, number>,
): number {
  const actByCode = new Map(activities.map((a) => [a.activityCode, a]));
  return Math.max(
    0,
    ...baseCpm.map((cpm) => {
      const activity = actByCode.get(cpm.activityCode);
      return effectiveStart(cpm, offsets) + (activity?.durationDays ?? 1);
    }),
  );
}

export function resourceLevelSchedule(
  params: ResourceLevelScheduleParams,
): ResourceLevelingResult {
  const {
    activities,
    logicLinks,
    availableCrewSize,
    projectStartDate,
    allowProjectExtension = false,
  } = params;

  const initialCpm = calculateCpm({ activities, logicLinks });
  const warnings: string[] = [...initialCpm.warnings];
  const unmovedActivities: UnmovedActivity[] = [];

  if (initialCpm.activities.length === 0) {
    return {
      leveledActivities: [],
      appliedOffsets: {},
      resourceHistogramBefore: [],
      resourceHistogramAfter: [],
      projectDurationBefore: 0,
      projectDurationAfter: 0,
      availableCrewSize,
      peakCrewBefore: 0,
      peakCrewAfter: 0,
      overallocatedDaysBefore: 0,
      overallocatedDaysAfter: 0,
      movedActivities: [],
      unmovedActivities,
      warnings,
      resourceDummyLinks: [],
    };
  }

  const baseCpm = initialCpm.activities;
  const outgoingLinks = buildOutgoingLinks(logicLinks);
  const offsets: Record<string, number> = {};
  const movedActivities: MovedActivity[] = [];

  const histogramBefore = calculateResourceHistogram({
    activities,
    cpmActivities: baseCpm,
    projectStartDate,
    availableCrewSize,
  });

  const criticalOnlyBefore = buildCriticalOnlyHistogram(histogramBefore);
  if (criticalOnlyBefore.some((day) => day.isOverallocated)) {
    warnings.push(
      'Critical-path labor exceeds available crew size. Increase crew size or revise logic/durations.',
    );
  }

  let maxIterations = activities.length * activities.length * 4 + 10;

  while (maxIterations-- > 0) {
    const histogram = calculateResourceHistogram({
      activities,
      cpmActivities: baseCpm,
      projectStartDate,
      availableCrewSize,
      leveledOffsets: offsets,
    });

    const overallocatedDays = histogram.filter((day) => day.isOverallocated);
    if (overallocatedDays.length === 0) break;

    const firstOverDay = overallocatedDays[0]!.dayOffset;
    const currentOverCount = overallocatedDays.length;

    const candidates = baseCpm
      .filter((cpm) => {
        if (cpm.isCritical) return false;
        const act = activities.find((a) => a.activityCode === cpm.activityCode);
        if (!act) return false;
        const es = effectiveStart(cpm, offsets);
        const ef = es + act.durationDays;
        return firstOverDay >= es && firstOverDay < ef;
      })
      .sort((left, right) => {
        const tfDiff = left.totalFloat - right.totalFloat;
        if (tfDiff !== 0) return tfDiff;
        const esDiff = effectiveStart(left, offsets) - effectiveStart(right, offsets);
        if (esDiff !== 0) return esDiff;
        return left.activityCode.localeCompare(right.activityCode);
      });

    if (candidates.length === 0) {
      warnings.push(
        `Resources exceed availability on day ${firstOverDay}. Some activities cannot be delayed further — project duration may need to extend or crew size must increase.`,
      );
      break;
    }

    let resolved = false;

    for (const candidate of candidates) {
      const activity = activities.find((a) => a.activityCode === candidate.activityCode);
      if (!activity) continue;

      const currentOffset = offsets[candidate.activityCode] ?? 0;
      const currentStart = candidate.earlyStart + currentOffset;
      const maxStart = allowProjectExtension
        ? projectDurationFromOffsets(activities, baseCpm, offsets) + activities.length
        : candidate.earlyStart + candidate.totalFloat;

      if (
        activityFitsAtStart(
          candidate.activityCode,
          currentStart,
          activities,
          baseCpm,
          offsets,
          availableCrewSize,
        )
      ) {
        continue;
      }

      for (let tryStart = currentStart + 1; tryStart <= maxStart; tryStart += 1) {
        const trialOffsets = {
          ...offsets,
          [candidate.activityCode]: tryStart - candidate.earlyStart,
        };

        const cascade = enforceSuccessorConstraints(
          candidate.activityCode,
          activities,
          baseCpm,
          trialOffsets,
          outgoingLinks,
          allowProjectExtension,
        );
        if (!cascade.ok) continue;

        if (
          !activityFitsAtStart(
            candidate.activityCode,
            tryStart,
            activities,
            baseCpm,
            trialOffsets,
            availableCrewSize,
          )
        ) {
          continue;
        }

        const trialHistogram = calculateResourceHistogram({
          activities,
          cpmActivities: baseCpm,
          projectStartDate,
          availableCrewSize,
          leveledOffsets: trialOffsets,
        });
        const trialOverCount = countOverallocatedDays(trialHistogram);
        if (trialOverCount >= currentOverCount) continue;

        Object.assign(offsets, trialOffsets);

        const existingMoved = movedActivities.find((m) => m.activityCode === candidate.activityCode);
        const newOffset = offsets[candidate.activityCode] ?? 0;
        if (existingMoved) {
          existingMoved.newStart = candidate.earlyStart + newOffset;
          existingMoved.daysMoved = newOffset;
          existingMoved.dependentActivityCodes = cascade.dependentCodes;
        } else {
          movedActivities.push({
            activityCode: candidate.activityCode,
            oldStart: candidate.earlyStart,
            newStart: candidate.earlyStart + newOffset,
            daysMoved: newOffset,
            reason: `Overallocation on day ${firstOverDay}`,
            dependentActivityCodes: cascade.dependentCodes,
          });
        }

        resolved = true;
        break;
      }

      if (resolved) break;
    }

    if (!resolved) {
      for (const candidate of candidates) {
        unmovedActivities.push({
          activityCode: candidate.activityCode,
          reason:
            allowProjectExtension
              ? 'No valid delayed start resolves overallocation without violating dependency constraints.'
              : 'No valid start date within total float resolves overallocation without violating logic.',
        });
      }
      warnings.push(
        allowProjectExtension
          ? `Resources exceed availability on day ${firstOverDay}. No eligible activity can be delayed further due to dependency constraints.`
          : `Resources exceed availability on day ${firstOverDay}. No noncritical activity could be delayed within float.`,
      );
      if (!allowProjectExtension) {
        warnings.push(
          'Project extension is not enabled. Enable "Allow project extension" to move activities beyond float.',
        );
      }
      break;
    }
  }

  attachResourceProviders(movedActivities, activities, baseCpm, offsets);

  const resourceDummyLinks = buildResourceDummyLinksFromMoves(
    movedActivities,
    activities,
    baseCpm,
    offsets,
    logicLinks,
  );

  const finalAdjusted = buildLeveledActivities(baseCpm, offsets);
  const histogramAfter = calculateResourceHistogram({
    activities,
    cpmActivities: baseCpm,
    projectStartDate,
    availableCrewSize,
    leveledOffsets: offsets,
  });

  const projectDurationBefore = initialCpm.projectDurationDays;
  const projectDurationAfter = Math.max(
    projectDurationBefore,
    projectDurationFromOffsets(activities, baseCpm, offsets),
  );

  if (projectDurationAfter > projectDurationBefore && !allowProjectExtension) {
    warnings.push(
      'Resource leveling would extend project duration. No further float-based moves were applied.',
    );
  }

  return {
    leveledActivities: finalAdjusted,
    appliedOffsets: { ...offsets },
    resourceHistogramBefore: histogramBefore,
    resourceHistogramAfter: histogramAfter,
    projectDurationBefore,
    projectDurationAfter: allowProjectExtension
      ? projectDurationAfter
      : Math.min(projectDurationAfter, projectDurationBefore),
    availableCrewSize,
    peakCrewBefore: peakRequiredCrew(histogramBefore),
    peakCrewAfter: peakRequiredCrew(histogramAfter),
    overallocatedDaysBefore: countOverallocatedDays(histogramBefore),
    overallocatedDaysAfter: countOverallocatedDays(histogramAfter),
    movedActivities,
    unmovedActivities,
    warnings,
    resourceDummyLinks,
  };
}

/**
 * Builds the provider-derived FS resource-dummy links for the leveling result,
 * using the shared builder so they match exactly what the effective-schedule
 * analysis regenerates from the same provider records.
 */
function buildResourceDummyLinksFromMoves(
  movedActivities: MovedActivity[],
  activities: ScheduleActivity[],
  baseCpm: CpmActivityResult[],
  offsets: Record<string, number>,
  logicLinks: CpmLogicLink[],
): CpmLogicLink[] {
  const actByCode = new Map(activities.map((a) => [a.activityCode, a]));
  const leveledStartByCode = new Map<string, number>();
  const leveledFinishByCode = new Map<string, number>();
  for (const cpm of baseCpm) {
    const duration = actByCode.get(cpm.activityCode)?.durationDays ?? 1;
    const start = cpm.earlyStart + (offsets[cpm.activityCode] ?? 0);
    leveledStartByCode.set(cpm.activityCode, start);
    leveledFinishByCode.set(cpm.activityCode, start + duration);
  }
  const validCodes = new Set(actByCode.keys());
  const baselineEdges = new Set(
    logicLinks
      .filter((link) => !link.generated)
      .map((link) => `${link.predecessorActivityCode}->${link.successorActivityCode}`),
  );

  return buildResourceDummyLinks({
    delayRecords: movedActivities
      .filter((moved) => (moved.resourceProviderActivityCodes?.length ?? 0) > 0)
      .map((moved) => ({
        activityCode: moved.activityCode,
        resourceProviderActivityCodes: moved.resourceProviderActivityCodes ?? [],
      })),
    leveledStartByCode,
    leveledFinishByCode,
    hasBaselineEdge: (pred, succ) => baselineEdges.has(`${pred}->${succ}`),
    isValidCode: (code) => validCodes.has(code),
  });
}
