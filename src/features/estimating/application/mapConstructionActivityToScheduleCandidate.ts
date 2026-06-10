import type { ProjectConstructionActivity } from '../domain/constructionActivityTypes';
import type {
  EstimateScheduleTaskCandidate,
  EstimateScheduleWarning,
} from '../domain/estimateScheduleTypes';
import { resolveScheduleActivityCrewSize } from '../scheduling/resources/scheduleActivityCrewSize';
import { compareActivityCodes } from './estimateActivityCoding';
import {
  divisionLabelFromKey,
  normalizeDivisionKey,
  normalizeScopeKey,
  scopeLabelFromKey,
} from './estimateLineItemGrouping';
import { buildConstructionActivityScheduleCandidateId } from './estimateScheduleCandidateId';

export interface MapConstructionActivityToScheduleCandidateContext {
  projectId: string;
  estimateId: string;
  estimateVersionId: string;
  estimateVersionNumber: number;
}

function buildWarnings(activity: ProjectConstructionActivity): EstimateScheduleWarning[] {
  const warnings: EstimateScheduleWarning[] = [];
  const title = activity.title?.trim() || activity.name?.trim() || 'Activity';
  const laborHours = Math.max(0, activity.calculatedManHours ?? 0);

  if (laborHours <= 0) {
    warnings.push({
      code: 'material_only_line',
      message: 'Activity has no labor hours; duration may be zero until labor is added.',
    });
  }

  if ((activity.crewSize ?? 0) < 1) {
    warnings.push({
      code: 'missing_crew_size',
      message: 'Crew size was not set; defaulted to 1 for schedule calculations.',
    });
  }

  if ((activity.hoursPerDay ?? 0) < 1) {
    warnings.push({
      code: 'missing_hours_per_day',
      message: 'Hours per day was not set; defaulted to 8 for schedule calculations.',
    });
  }

  const effectiveDuration =
    activity.effectiveDurationDays ??
    activity.calculatedDurationDays ??
    activity.durationDaysOverride ??
    0;

  if (laborHours > 0 && effectiveDuration <= 0) {
    warnings.push({
      code: 'missing_duration',
      message: 'Duration days could not be derived from labor metrics.',
    });
  }

  return warnings;
}

function resolveLaborPlan(activity: ProjectConstructionActivity) {
  const effectiveDuration =
    activity.effectiveDurationDays ??
    activity.calculatedDurationDays ??
    activity.durationDaysOverride ??
    0;
  const durationDays = Math.max(1, Math.ceil(effectiveDuration));
  const hoursPerDay = activity.hoursPerDay ?? 8;
  const laborHours = Math.max(0, activity.calculatedManHours ?? 0);
  const manDays = Math.max(0, activity.calculatedManDays ?? laborHours / hoursPerDay);
  const resolvedCrew = resolveScheduleActivityCrewSize({
    crewSize: activity.crewSize,
    laborHours,
    manDays,
    durationDays,
    hoursPerDay,
  });
  const crewSize = resolvedCrew.crewSize;
  const crewDays = crewSize > 0 ? manDays / crewSize : manDays;

  return {
    laborHours,
    adjustedLaborHours: laborHours,
    manDays,
    crewDays,
    durationDays,
    crewSize,
    hoursPerDay,
    parallelCrews: 1,
  };
}

/** Map one saved construction activity into a draft schedule preview task. */
export function mapConstructionActivityToScheduleCandidate(
  activity: ProjectConstructionActivity,
  context: MapConstructionActivityToScheduleCandidateContext,
): EstimateScheduleTaskCandidate {
  const divisionKey = normalizeDivisionKey(activity.divisionCode);
  const scopeKey = normalizeScopeKey(activity.phase);
  const activityCode = (activity.activityCode ?? activity.code ?? '').trim();
  const sortOrder = activity.sortOrder ?? activity.activitySequence ?? 0;

  return {
    candidateId: buildConstructionActivityScheduleCandidateId(context.estimateVersionId, activity.id),
    source: {
      projectId: context.projectId,
      estimateId: context.estimateId,
      estimateVersionId: context.estimateVersionId,
      estimateVersionNumber: context.estimateVersionNumber,
      estimateLineItemId: activity.id,
      linePosition: sortOrder,
    },
    divisionKey,
    divisionLabel: activity.divisionName?.trim() || divisionLabelFromKey(divisionKey),
    scopeKey,
    scopeLabel: scopeLabelFromKey(scopeKey),
    title: activity.title?.trim() || activity.name?.trim() || activityCode || 'Untitled activity',
    description: activity.description?.trim() || undefined,
    trade: undefined,
    activity: activity.phase?.trim() || undefined,
    csiDivision: activity.divisionCode?.trim() || undefined,
    csiSection: undefined,
    labor: resolveLaborPlan(activity),
    scheduleEnabled: activity.scheduleEnabled,
    weatherSensitive: false,
    inspectionRequired: false,
    plannedStartDate: null,
    plannedEndDate: null,
    sortOrder,
    activityCode: activityCode || undefined,
    predecessorActivityCode: undefined,
    relationshipType: 'FS',
    lagDays: 0,
    predecessorCandidateIds: [],
    suggestedDependencyType: 'finish_to_start',
    warnings: buildWarnings(activity),
  };
}

export function compareConstructionActivitiesForSchedule(
  left: ProjectConstructionActivity,
  right: ProjectConstructionActivity,
): number {
  return (
    compareActivityCodes(left.activityCode ?? left.code, right.activityCode ?? right.code) ||
    (left.sortOrder ?? left.activitySequence ?? 0) - (right.sortOrder ?? right.activitySequence ?? 0)
  );
}
