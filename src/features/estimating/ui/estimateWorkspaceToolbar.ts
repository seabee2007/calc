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
  settings: 'Settings',
  helpDefinitions: 'Help / Definitions',
  collapseAll: 'Collapse all',
  resetForm: 'Reset form',
  convertToDetailed: 'Convert to Detailed Estimate',
  saveQuickEstimate: 'Save',
} as const;

export const SAVE_QUICK_ESTIMATE_TOOLBAR_LABEL =
  ESTIMATE_WORKSPACE_ACTIONS_MENU_LABELS.saveQuickEstimate;

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
  | 'settings'
  | 'help-definitions'
  | 'collapse-all'
  | 'reset-form'
  | 'convert-to-detailed'
  | 'save-quick-estimate';

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
  showConvertToDetailed?: boolean;
  showSaveQuick?: boolean;
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
  onOpenSettings?: () => void;
  onOpenHelp?: () => void;
  onCollapseAll?: () => void;
  onResetForm?: () => void;
  onConvertToDetailed?: () => void;
  onSaveQuick?: () => void;
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
    case 'settings':
      handlers.onOpenSettings?.();
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
    case 'convert-to-detailed':
      handlers.onConvertToDetailed?.();
      return;
    case 'save-quick-estimate':
      handlers.onSaveQuick?.();
      return;
    default:
      return;
  }
}

export function buildEstimateWorkspaceActionsMenuItems(
  input: ResolveEstimateWorkspaceToolbarLayoutInput,
): EstimateWorkspaceActionsMenuItem[] {
  const items: EstimateWorkspaceActionsMenuItem[] = [];

  if (input.showSaveQuick) {
    items.push({
      key: 'save-quick-estimate',
      label: ESTIMATE_WORKSPACE_ACTIONS_MENU_LABELS.saveQuickEstimate,
    });
  }

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

  if (input.showConvertToDetailed) {
    items.push({
      key: 'convert-to-detailed',
      label: ESTIMATE_WORKSPACE_ACTIONS_MENU_LABELS.convertToDetailed,
    });
  }

  items.push({
    key: 'settings',
    label: ESTIMATE_WORKSPACE_ACTIONS_MENU_LABELS.settings,
  });

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
  hasPersistedWorkspaceWork = false,
): boolean {
  if (!canEdit) return false;

  const hasResettableState =
    hasEstimate ||
    activeEstimateType != null ||
    hasPersistedWorkspaceWork ||
    canResetEstimateSetup(setup.session);

  if (activeTab === 'settings') {
    return hasEstimate || hasPersistedWorkspaceWork;
  }

  return hasResettableState;
}

export function shouldShowSaveEstimateAction(
  hasEstimate: boolean,
  activeEstimateType: EstimateType | null,
  hasProjectContext = false,
): boolean {
  return hasProjectContext || hasEstimate || activeEstimateType != null;
}

export function shouldShowBucketSaveAction(
  activeTab: EstimateWorkspaceTabId,
  hasEstimate: boolean,
  activeEstimateType: EstimateType | null,
  isQuickFeasibility: boolean,
  showBucketPanel: boolean,
  hasProjectContext = false,
): boolean {
  if (isQuickFeasibility && activeTab === 'quick-estimate') return false;
  if (!shouldShowSaveEstimateAction(hasEstimate, activeEstimateType, hasProjectContext)) {
    return false;
  }
  if (activeTab === 'line-items') {
    return showBucketPanel || hasProjectContext;
  }
  return hasProjectContext || hasEstimate || activeEstimateType != null;
}

export function shouldShowQuickSaveAction(
  activeTab: EstimateWorkspaceTabId,
  showSaveQuick: boolean,
): boolean {
  if (!showSaveQuick) return false;
  return activeTab === 'line-items' || activeTab === 'quick-estimate';
}

export function shouldShowBidImportExportActions(
  activeTab: EstimateWorkspaceTabId,
  hasEstimate: boolean,
  activeEstimateType: EstimateType | null,
): boolean {
  return (
    activeTab === 'activities' &&
    hasEstimate &&
    (activeEstimateType === 'detailed' || activeEstimateType === 'bid')
  );
}

export function shouldShowConvertToDetailedAction(
  activeTab: EstimateWorkspaceTabId,
  hasEstimate: boolean,
  isConceptualEstimate: boolean,
): boolean {
  return isConceptualEstimate && hasEstimate && activeTab === 'conceptual-budget';
}
