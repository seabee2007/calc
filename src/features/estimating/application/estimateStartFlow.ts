import { normalizeSelectedDivisionCodes } from './estimateWorkBreakdown';
import type { EstimateType } from '../domain/estimateTypes';

export type EstimateActiveStartMode = 'quick' | 'budget' | 'detailed' | 'bid';

export interface EstimateSetupSessionState {
  estimateSetupStarted: boolean;
  selectedEstimateType: EstimateType;
  activeStartMode: EstimateActiveStartMode | null;
  selectedDivisionCodes: readonly string[];
}

export function resolveActiveStartMode(type: EstimateType): EstimateActiveStartMode {
  if (type === 'quick_feasibility') return 'quick';
  if (type === 'budget') return 'budget';
  if (type === 'detailed') return 'detailed';
  return 'bid';
}

export function createInitialEstimateSetupSession(
  savedEstimateType: EstimateType,
): EstimateSetupSessionState {
  return {
    estimateSetupStarted: false,
    selectedEstimateType: savedEstimateType,
    activeStartMode: null,
    selectedDivisionCodes: [],
  };
}

export function createEstimateSetupStartState(
  selectedEstimateType: EstimateType,
): EstimateSetupSessionState {
  return {
    estimateSetupStarted: true,
    selectedEstimateType,
    activeStartMode: resolveActiveStartMode(selectedEstimateType),
    selectedDivisionCodes: [],
  };
}

export function createEstimateSetupResetState(
  savedEstimateType: EstimateType,
): EstimateSetupSessionState {
  return createInitialEstimateSetupSession(savedEstimateType);
}

export function appendEstimateSetupDivisionCodes(
  state: EstimateSetupSessionState,
  codes: readonly string[],
): EstimateSetupSessionState {
  return {
    ...state,
    selectedDivisionCodes: normalizeSelectedDivisionCodes([
      ...state.selectedDivisionCodes,
      ...codes,
    ]),
  };
}

export function shouldShowEstimateTypeSelector(state: EstimateSetupSessionState): boolean {
  return !state.estimateSetupStarted;
}

/** @deprecated Use shouldShowEstimateTypeSelector */
export function shouldShowEstimateStartPanel(state: EstimateSetupSessionState): boolean {
  return shouldShowEstimateTypeSelector(state);
}

export function shouldShowQuickFeasibilityPanel(state: EstimateSetupSessionState): boolean {
  return state.estimateSetupStarted && state.activeStartMode === 'quick';
}

export function supportsActivityWorkflow(type: EstimateType): boolean {
  return type === 'budget' || type === 'detailed' || type === 'bid';
}

export function shouldShowActivityWorkflow(state: EstimateSetupSessionState): boolean {
  if (!state.estimateSetupStarted) return false;
  if (state.activeStartMode === 'quick') return false;
  return supportsActivityWorkflow(state.selectedEstimateType);
}

export function shouldShowSavedActivities(state: EstimateSetupSessionState): boolean {
  return shouldShowActivityWorkflow(state);
}

export function shouldShowDivisionBucketPanel(state: EstimateSetupSessionState): boolean {
  if (!shouldShowActivityWorkflow(state)) return false;
  return state.selectedDivisionCodes.length > 0;
}

export function canResetEstimateSetup(state: EstimateSetupSessionState): boolean {
  return state.estimateSetupStarted;
}

export function isQuickFeasibilityEstimateType(type: EstimateType): boolean {
  return type === 'quick_feasibility';
}

/** Budget, detailed, and bid estimates use the division scope modal. */
export function shouldOpenBuildScopeModal(type: EstimateType): boolean {
  return type === 'budget' || type === 'detailed' || type === 'bid';
}

export function getBuildScopeModalTitle(type: EstimateType): string {
  if (type === 'budget') return 'Build Budget Scope';
  return 'Build Project Scope';
}

export function getBuildScopeModalDescription(type: EstimateType): string {
  if (type === 'budget') {
    return 'Choose the major divisions of work for rough budget planning.';
  }
  return 'Choose the major divisions of work. These become the top-level buckets for activities, estimating, scheduling, and Gantt planning.';
}

export function shouldReinitializeSetupSessionFromVersion(
  previousVersionKey: string | null,
  nextVersionKey: string,
): boolean {
  return previousVersionKey !== nextVersionKey;
}

export function buildEstimateSetupVersionKey(projectId: string, versionId: string): string {
  return `${projectId}:${versionId}`;
}

export const QUICK_FEASIBILITY_TAB_HELPER =
  'Quick Feasibility is a high-level rough estimate. It does not use detailed work activities.';

export const ACTIVITY_WORKFLOW_TAB_HELPER =
  'Build your estimate by division of work, work package, and activity.';

export const ESTIMATE_SETUP_RESET_SAVED_VERSIONS_NOTE =
  'Saved versions remain in history. Reset only clears the current setup view and draft selections.';

export const ESTIMATE_SETUP_RESET_REPLACE_NOTE =
  'To fully replace a saved estimate, create a new version after changing the estimate type. Existing versions remain read-only.';

export function getWorkBreakdownHelperText(type: EstimateType): string {
  if (type === 'budget') {
    return 'Build a rough budget by division. Add division allowances and scope-level costs as needed.';
  }
  if (type === 'bid') {
    return 'Build proposal-ready scope by division. Add work activities, cost details, and markup support.';
  }
  if (type === 'detailed') {
    return 'Build your project work breakdown by division. Add work activities and cost details under each division of work.';
  }
  return 'Build your project work breakdown by division. Add work activities and cost details under each division of work.';
}

export function getEstimateTabHelperText(state: EstimateSetupSessionState): string {
  if (shouldShowEstimateTypeSelector(state)) {
    return 'Choose an estimate type, then start the workflow that matches how detailed this estimate should be.';
  }
  if (shouldShowQuickFeasibilityPanel(state)) {
    return QUICK_FEASIBILITY_TAB_HELPER;
  }
  if (shouldShowActivityWorkflow(state)) {
    return ACTIVITY_WORKFLOW_TAB_HELPER;
  }
  return getWorkBreakdownHelperText(state.selectedEstimateType);
}
