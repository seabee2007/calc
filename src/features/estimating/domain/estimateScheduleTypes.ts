import type { EstimateRelationshipType } from './estimateTypes';
import type { EstimateGroupRollup } from './estimateLineItemTree';

export type EstimateScheduleWarningCode =
  | 'missing_duration'
  | 'missing_crew_size'
  | 'missing_hours_per_day'
  | 'material_only_line'
  | 'inspection_required'
  | 'weather_sensitive';

export type EstimateScheduleDependencyType = 'finish_to_start' | 'start_to_start' | null;

export interface EstimateScheduleWarning {
  code: EstimateScheduleWarningCode;
  message: string;
}

export interface EstimateScheduleSourceRef {
  projectId: string;
  estimateId: string;
  estimateVersionId: string;
  estimateVersionNumber: number;
  estimateLineItemId: string;
  linePosition: number;
}

export interface EstimateScheduleLaborPlan {
  laborHours: number;
  adjustedLaborHours: number;
  manDays: number;
  crewDays: number;
  durationDays: number;
  crewSize: number;
  hoursPerDay: number;
  parallelCrews: number;
}

export interface EstimateScheduleTaskCandidate {
  candidateId: string;
  source: EstimateScheduleSourceRef;
  divisionKey: string;
  divisionLabel: string;
  scopeKey: string;
  scopeLabel: string;
  title: string;
  description?: string;
  trade?: string;
  activity?: string;
  csiDivision?: string;
  csiSection?: string;
  labor: EstimateScheduleLaborPlan;
  scheduleEnabled: boolean;
  weatherSensitive: boolean;
  inspectionRequired: boolean;
  plannedStartDate: null;
  plannedEndDate: null;
  sortOrder: number;
  activityCode?: string;
  predecessorActivityCode?: string;
  relationshipType?: EstimateRelationshipType;
  lagDays?: number;
  predecessorCandidateIds: string[];
  suggestedDependencyType: EstimateScheduleDependencyType;
  warnings: EstimateScheduleWarning[];
}

export interface EstimateScheduleScopeGroup {
  key: string;
  label: string;
  divisionKey: string;
  rollup: EstimateGroupRollup;
  tasks: EstimateScheduleTaskCandidate[];
}

export interface EstimateScheduleGroup {
  key: string;
  label: string;
  rollup: EstimateGroupRollup;
  scopes: EstimateScheduleScopeGroup[];
}

export interface EstimateSchedulePlanMeta {
  projectId: string;
  estimateId: string;
  estimateVersionId: string;
  estimateVersionNumber: number;
  generatedAtIso: string;
  scheduleEnabledTaskCount: number;
  excludedTaskCount: number;
}

export interface EstimateSchedulePlan {
  meta: EstimateSchedulePlanMeta;
  divisions: EstimateScheduleGroup[];
}
