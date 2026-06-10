/**
 * Construction Activities → Schedule Activities adapter.
 *
 * Converts ProjectConstructionActivity[] (schedule-enabled only) into the
 * ScheduleActivity[] shape consumed by the Logic Network, CPM engine, and
 * Level III Gantt.
 *
 * GUARDRAILS:
 *  - Only activities with scheduleEnabled === true are included.
 *  - ProjectActivityLineItem objects are NEVER passed to this adapter and
 *    NEVER appear as Logic Network nodes. Line items stay in the estimate layer.
 *  - calculateCpm.ts and autoLayoutLogicNetwork.ts are NOT modified.
 *  - predecessor relationships come from the Logic Network logicLinks store,
 *    not from the activities themselves; predecessorActivityCode is left
 *    undefined here and populated by the Logic Network UI.
 */
import type { ProjectConstructionActivity } from '../../domain/constructionActivityTypes';
import { resolveScheduleActivityCrewSize } from '../resources/scheduleActivityCrewSize';
import type {
  ScheduleActivity,
  ScheduleActivityAdapterResult,
  ScheduleActivityAdapterWarning,
} from './estimateLineItemsToScheduleActivities';

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Map a list of ProjectConstructionActivity objects to ScheduleActivity
 * objects suitable for Logic Network / CPM / Gantt.
 *
 * Non-schedule-enabled activities are silently filtered out.
 */
export function constructionActivitiesToScheduleActivities(
  activities: ProjectConstructionActivity[],
): ScheduleActivityAdapterResult {
  const warnings: ScheduleActivityAdapterWarning[] = [];
  const scheduleActivities: ScheduleActivity[] = [];

  for (const activity of activities) {
    // ── Filter: only schedule-enabled activities become schedule nodes ────────
    if (!activity.scheduleEnabled) continue;

    const activityCode = (activity.activityCode ?? activity.code ?? '').trim();
    if (!activityCode) {
      warnings.push({
        activityCode: activity.id,
        message: `Activity "${activity.title ?? activity.name}" is missing an activity code.`,
      });
      continue;
    }

    // ── Duration: prefer effectiveDurationDays (honours user override) ────────
    const effectiveDuration =
      activity.effectiveDurationDays ??
      activity.calculatedDurationDays ??
      activity.durationDaysOverride ??
      0;

    const durationDays = Math.max(1, Math.ceil(effectiveDuration));

    if (effectiveDuration < 1) {
      warnings.push({
        activityCode,
        message: `Activity "${activity.title ?? activity.name}" has zero or missing duration — defaulting to 1 day.`,
      });
    }

    // ── Crew size ─────────────────────────────────────────────────────────────
    const hoursPerDay = activity.hoursPerDay ?? 8;
    const resolvedCrew = resolveScheduleActivityCrewSize({
      crewSize: activity.crewSize,
      laborHours: activity.calculatedManHours,
      manDays: activity.calculatedManDays,
      durationDays,
      hoursPerDay,
    });
    const crewSize = resolvedCrew.crewSize;

    if ((activity.crewSize ?? 0) < 1) {
      warnings.push({
        activityCode,
        message: `Activity "${activity.title ?? activity.name}" is missing crew size — defaulting to 1.`,
      });
    }

    // ── Man-hours and man-days ─────────────────────────────────────────────────
    const laborHours = Math.max(0, activity.calculatedManHours ?? 0);
    const manDays = Math.max(0, activity.calculatedManDays ?? laborHours / 8);
    const crewDays = crewSize > 0 ? manDays / crewSize : manDays;

    scheduleActivities.push({
      activityCode,
      runtimeActivityId: activity.id,
      displayCode: activityCode,
      activityDescription:
        (activity.title ?? activity.name ?? activityCode).trim(),
      divisionCode: activity.divisionCode?.trim() ?? '00',
      divisionName: activity.divisionName?.trim() ?? '',
      durationDays,
      laborHours,
      manDays,
      crewDays,
      crewSize,
      hoursPerDay,
      totalCost: activity.totalCost ?? 0,
      // Predecessor / relationship fields are managed by the Logic Network.
      // Do NOT pre-populate them here — that would bypass the user's logic links.
      predecessorActivityCode: undefined,
      relationshipType: 'FS',
      lagDays: 0,
    });
  }

  return { activities: scheduleActivities, warnings };
}
