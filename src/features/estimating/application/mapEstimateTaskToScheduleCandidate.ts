import type {
  EstimateScheduleTaskCandidate,
  EstimateScheduleWarning,
} from '../domain/estimateScheduleTypes';
import type { EstimateDomainTask } from '../infrastructure/estimateDbTypes';
import {
  divisionLabelFromKey,
  normalizeDivisionKey,
  normalizeScopeKey,
  scopeLabelFromKey,
} from './estimateLineItemGrouping';
import { buildEstimateScheduleCandidateId } from './estimateScheduleCandidateId';
import { extractScheduleLaborPlan } from './extractScheduleLaborPlan';

export interface MapEstimateTaskToScheduleCandidateContext {
  projectId: string;
  estimateId: string;
  estimateVersionId: string;
  estimateVersionNumber: number;
}

function buildWarnings(
  task: EstimateDomainTask,
  extraction: ReturnType<typeof extractScheduleLaborPlan>,
): EstimateScheduleWarning[] {
  const warnings: EstimateScheduleWarning[] = [];

  if (!extraction.hasLabor) {
    warnings.push({
      code: 'material_only_line',
      message: 'Line has no labor hours; duration may be zero until labor is added.',
    });
  }

  if (!extraction.crewSizeProvided) {
    warnings.push({
      code: 'missing_crew_size',
      message: 'Crew size was not set; defaulted to 1 for schedule calculations.',
    });
  }

  if (!extraction.hoursPerDayProvided) {
    warnings.push({
      code: 'missing_hours_per_day',
      message: 'Hours per day was not set; defaulted to 8 for schedule calculations.',
    });
  }

  if (extraction.hasLabor && extraction.labor.durationDays <= 0) {
    warnings.push({
      code: 'missing_duration',
      message: 'Duration days could not be derived from labor metrics.',
    });
  }

  if (task.inspectionRequired) {
    warnings.push({
      code: 'inspection_required',
      message: 'Inspection is required for this activity.',
    });
  }

  if (task.weatherSensitive) {
    warnings.push({
      code: 'weather_sensitive',
      message: 'This activity is marked weather sensitive.',
    });
  }

  return warnings;
}

/** Map one saved estimate task into a draft schedule candidate. */
export function mapEstimateTaskToScheduleCandidate(
  task: EstimateDomainTask,
  context: MapEstimateTaskToScheduleCandidateContext,
): EstimateScheduleTaskCandidate {
  const divisionKey = normalizeDivisionKey(task.lineItem.csiDivision);
  const scopeKey = normalizeScopeKey(task.scopeName);
  const extraction = extractScheduleLaborPlan(task);
  const linePosition = task.position ?? 0;

  return {
    candidateId: buildEstimateScheduleCandidateId(context.estimateVersionId, task.id),
    source: {
      projectId: context.projectId,
      estimateId: context.estimateId,
      estimateVersionId: context.estimateVersionId,
      estimateVersionNumber: context.estimateVersionNumber,
      estimateLineItemId: task.id,
      linePosition,
    },
    divisionKey,
    divisionLabel: divisionLabelFromKey(divisionKey),
    scopeKey,
    scopeLabel: scopeLabelFromKey(scopeKey),
    title: task.title?.trim() || task.description?.trim() || task.lineItem.description,
    description: task.description?.trim() || task.lineItem.description,
    trade: task.trade?.trim() || undefined,
    activity: task.activity?.trim() || undefined,
    csiDivision: task.lineItem.csiDivision?.trim() || undefined,
    csiSection: task.lineItem.csiSection?.trim() || undefined,
    labor: extraction.labor,
    scheduleEnabled: task.scheduleEnabled,
    weatherSensitive: task.weatherSensitive,
    inspectionRequired: task.inspectionRequired,
    plannedStartDate: null,
    plannedEndDate: null,
    sortOrder: linePosition,
    activityCode: task.activityCode?.trim() || undefined,
    predecessorActivityCode: task.predecessorActivityCode?.trim() || undefined,
    relationshipType: task.relationshipType,
    lagDays: task.lagDays ?? 0,
    predecessorCandidateIds: [],
    suggestedDependencyType:
      task.relationshipType === 'SS' ? 'start_to_start' : 'finish_to_start',
    warnings: buildWarnings(task, extraction),
  };
}
