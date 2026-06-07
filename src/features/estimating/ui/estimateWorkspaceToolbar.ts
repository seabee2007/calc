import { canResetEstimateSetup, supportsActivityWorkflow } from '../application/estimateStartFlow';
import type { EstimateType } from '../domain/estimateTypes';
import type { UseEstimateSetupSessionResult } from './hooks/useEstimateSetupSession';
import type { EstimateWorkspaceTabId } from './components/EstimateWorkspaceTabBar';

export const ESTIMATE_WORKSPACE_TOOLBAR_MARKER = 'estimate-workspace-toolbar-actions';

export const REMOVED_ESTIMATE_BUILDER_INLINE_TOOLBAR_LABELS = [
  'Reset estimate setup',
] as const;

export const ESTIMATE_WORKSPACE_ACTIONS_DROPDOWN_LABEL = 'Actions';

export const ESTIMATE_WORKSPACE_ACTIONS_MENU_LABELS = {
  importEstimate: 'Import estimate',
  exportEstimate: 'Export estimate',
  downloadTemplate: 'Download template',
  helpDefinitions: 'Help / Definitions',
  collapseAll: 'Collapse all',
  resetForm: 'Reset form',
} as const;

export const REMOVED_ESTIMATE_WORKSPACE_INLINE_TOOLBAR_BUTTONS = [
  ESTIMATE_WORKSPACE_ACTIONS_MENU_LABELS.importEstimate,
  ESTIMATE_WORKSPACE_ACTIONS_MENU_LABELS.exportEstimate,
  'Download import template',
  ESTIMATE_WORKSPACE_ACTIONS_MENU_LABELS.resetForm,
] as const;

export type EstimateWorkspaceActionsMenuItemKey =
  | 'import-estimate'
  | 'export-estimate'
  | 'download-template'
  | 'help-definitions'
  | 'collapse-all'
  | 'reset-form';

export interface EstimateWorkspaceActionsMenuItem {
  key: EstimateWorkspaceActionsMenuItemKey;
  label: string;
  mobileOnly?: boolean;
  destructive?: boolean;
  showDividerBefore?: boolean;
}

export interface ResolveEstimateWorkspaceToolbarLayoutInput {
  showCollapseAll: boolean;
  showReset: boolean;
  showSaveBucket: boolean;
  showImportExport: boolean;
  includeMobileOverflow?: boolean;
}

export interface EstimateWorkspaceToolbarLayout {
  showCollapseAllButton: boolean;
  showResetButton: boolean;
  showResetInActionsMenu: boolean;
  showSaveEstimateButton: boolean;
  showActionsDropdown: boolean;
  desktopActionsMenuItems: EstimateWorkspaceActionsMenuItem[];
  mobileActionsMenuItems: EstimateWorkspaceActionsMenuItem[];
}

export interface EstimateWorkspaceMenuActionHandlers {
  onImportEstimate: () => void;
  onExportEstimate: () => void;
  onDownloadTemplate: () => void;
  onOpenHelp?: () => void;
  onCollapseAll?: () => void;
  onResetForm?: () => void;
}

export function runEstimateWorkspaceMenuAction(
  key: EstimateWorkspaceActionsMenuItemKey,
  handlers: EstimateWorkspaceMenuActionHandlers,
): void {
  switch (key) {
    case 'import-estimate':
      handlers.onImportEstimate();
      return;
    case 'export-estimate':
      handlers.onExportEstimate();
      return;
    case 'download-template':
      handlers.onDownloadTemplate();
      return;
    case 'help-definitions':
      handlers.onOpenHelp?.();
      return;
    case 'collapse-all':
      handlers.onCollapseAll?.();
      return;
    case 'reset-form':
      handlers.onResetForm?.();
      return;
    default:
      return;
  }
}

export function buildEstimateWorkspaceActionsMenuItems(
  input: ResolveEstimateWorkspaceToolbarLayoutInput,
): EstimateWorkspaceActionsMenuItem[] {
  const items: EstimateWorkspaceActionsMenuItem[] = [];

  if (input.includeMobileOverflow && input.showCollapseAll) {
    items.push({
      key: 'collapse-all',
      label: ESTIMATE_WORKSPACE_ACTIONS_MENU_LABELS.collapseAll,
      mobileOnly: true,
    });
  }

  if (input.showImportExport) {
    items.push(
      {
        key: 'import-estimate',
        label: ESTIMATE_WORKSPACE_ACTIONS_MENU_LABELS.importEstimate,
      },
      {
        key: 'export-estimate',
        label: ESTIMATE_WORKSPACE_ACTIONS_MENU_LABELS.exportEstimate,
      },
      {
        key: 'download-template',
        label: ESTIMATE_WORKSPACE_ACTIONS_MENU_LABELS.downloadTemplate,
      },
    );
  }

  items.push({
    key: 'help-definitions',
    label: ESTIMATE_WORKSPACE_ACTIONS_MENU_LABELS.helpDefinitions,
  });

  if (input.showReset) {
    items.push({
      key: 'reset-form',
      label: ESTIMATE_WORKSPACE_ACTIONS_MENU_LABELS.resetForm,
      destructive: true,
      showDividerBefore: items.length > 0,
    });
  }

  return items;
}

export function resolveEstimateWorkspaceToolbarLayout(
  input: ResolveEstimateWorkspaceToolbarLayoutInput,
): EstimateWorkspaceToolbarLayout {
  const desktopItems = buildEstimateWorkspaceActionsMenuItems({
    ...input,
    includeMobileOverflow: false,
  });
  const mobileItems = buildEstimateWorkspaceActionsMenuItems({
    ...input,
    includeMobileOverflow: true,
  });

  return {
    showCollapseAllButton: input.showCollapseAll,
    showResetButton: false,
    showResetInActionsMenu: input.showReset,
    showSaveEstimateButton: input.showSaveBucket,
    showActionsDropdown: desktopItems.length > 0 || mobileItems.length > 0,
    desktopActionsMenuItems: desktopItems,
    mobileActionsMenuItems: mobileItems,
  };
}

export function shouldShowActionsDropdown(
  input: ResolveEstimateWorkspaceToolbarLayoutInput,
): boolean {
  const desktopItems = buildEstimateWorkspaceActionsMenuItems({
    ...input,
    includeMobileOverflow: false,
  });
  const mobileItems = buildEstimateWorkspaceActionsMenuItems({
    ...input,
    includeMobileOverflow: true,
  });
  return desktopItems.length > 0 || mobileItems.length > 0;
}

export const ADD_DIVISION_TOOLBAR_LABEL = '+ Add division';

export interface EstimateBuilderToolbarHandlers {
  showCollapseAll: boolean;
  showSaveQuick: boolean;
  canSaveQuick: boolean;
  showAddDivision: boolean; 
  collapseAll: () => void;
  saveQuick: () => void;
  openAddDivision: () => void;
}

export function shouldShowAddDivisionAction(
  activeTab: EstimateWorkspaceTabId,
  hasEstimate: boolean,
  showBucketPanel: boolean,
  estimateType: EstimateType | null,
  canEdit: boolean,
): boolean {
  return (
    activeTab === 'line-items' &&
    hasEstimate &&
    canEdit &&
    showBucketPanel &&
    estimateType != null &&
    supportsActivityWorkflow(estimateType)
  );
}

export function shouldShowCollapseAllAction(
  activeTab: EstimateWorkspaceTabId,
  showBucketPanel: boolean,
): boolean {
  return activeTab === 'line-items' && showBucketPanel;
}

export function shouldShowResetFormAction(
  activeTab: EstimateWorkspaceTabId,
  hasEstimate: boolean,
  activeEstimateType: EstimateType | null,
  setup: UseEstimateSetupSessionResult,
  canEdit: boolean,
): boolean {
  if (activeTab === 'settings') {
    return hasEstimate && canEdit;
  }
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

export function shouldShowBidImportExportActions(
  activeTab: EstimateWorkspaceTabId,
  hasEstimate: boolean,
  activeEstimateType: EstimateType | null,
): boolean {
  return (
    activeTab === 'line-items' &&
    hasEstimate &&
    activeEstimateType === 'bid'
  );
}
