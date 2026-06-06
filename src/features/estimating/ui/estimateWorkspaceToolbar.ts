import { canResetEstimateSetup } from '../application/estimateStartFlow';
import type { EstimateType } from '../domain/estimateTypes';
import type { UseEstimateSetupSessionResult } from './hooks/useEstimateSetupSession';
import type { EstimateWorkspaceTabId } from './components/EstimateWorkspaceTabBar';

export const ESTIMATE_WORKSPACE_TOOLBAR_MARKER = 'estimate-workspace-toolbar-actions';

export const REMOVED_ESTIMATE_BUILDER_INLINE_TOOLBAR_LABELS = [
  'Reset estimate setup',
] as const;

export interface EstimateBuilderToolbarHandlers {
  showCollapseAll: boolean;
  showSaveQuick: boolean;
  canSaveQuick: boolean;
  collapseAll: () => void;
  saveQuick: () => void;
}

export function shouldShowCollapseAllAction(
  activeTab: EstimateWorkspaceTabId,
  showBucketPanel: boolean,
): boolean {
  return activeTab === 'line-items' && showBucketPanel;
}

export function shouldShowResetFormAction(
  hasEstimate: boolean,
  activeEstimateType: EstimateType | null,
  setup: UseEstimateSetupSessionResult,
  canEdit: boolean,
): boolean {
  return (
    (hasEstimate || activeEstimateType != null) &&
    canEdit &&
    canResetEstimateSetup(setup.session)
  );
}

export function shouldShowSaveEstimateAction(
  hasEstimate: boolean,
  activeEstimateType: EstimateType | null,
): boolean {
  return hasEstimate || activeEstimateType != null;
}

export function shouldShowBucketSaveAction(
  activeTab: EstimateWorkspaceTabId,
  hasEstimate: boolean,
  activeEstimateType: EstimateType | null,
  isQuickFeasibility: boolean,
  showBucketPanel: boolean,
): boolean {
  if (!shouldShowSaveEstimateAction(hasEstimate, activeEstimateType)) return false;
  if (isQuickFeasibility) return false;
  if (activeTab === 'line-items') return showBucketPanel;
  return hasEstimate;
}

export function shouldShowQuickSaveAction(
  activeTab: EstimateWorkspaceTabId,
  showSaveQuick: boolean,
): boolean {
  return activeTab === 'line-items' && showSaveQuick;
}
