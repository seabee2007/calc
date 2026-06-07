import { describe, expect, it } from 'vitest';
import { createEstimateSetupStartState } from '../application/estimateStartFlow';
import {
  ESTIMATE_WORKSPACE_ACTIONS_DROPDOWN_LABEL,
  ESTIMATE_WORKSPACE_ACTIONS_MENU_LABELS,
  ESTIMATE_WORKSPACE_TOOLBAR_MARKER,
  REMOVED_ESTIMATE_BUILDER_INLINE_TOOLBAR_LABELS,
  REMOVED_ESTIMATE_WORKSPACE_INLINE_TOOLBAR_BUTTONS,
  buildEstimateWorkspaceActionsMenuItems,
  resolveEstimateWorkspaceToolbarLayout,
  runEstimateWorkspaceMenuAction,
  ADD_DIVISION_TOOLBAR_LABEL,
  shouldShowActionsDropdown,
  shouldShowAddDivisionAction,
  shouldShowBidImportExportActions,
  shouldShowBucketSaveAction,
  shouldShowCollapseAllAction,
  shouldShowQuickSaveAction,
  shouldShowResetFormAction,
  shouldShowSaveEstimateAction,
} from '../ui/estimateWorkspaceToolbar';

function mockSetup(sessionOverrides: Record<string, unknown> = {}) {
  return {
    session: {
      ...createEstimateSetupStartState('bid'),
      estimateSetupStarted: true,
      selectedDivisionCodes: ['01'],
      ...sessionOverrides,
    },
    resetSetup: () => {},
    restoreSavedSetup: () => {},
    setSelectedDivisions: () => {},
    mergeDivisionCodes: () => {},
    quickPanelResetKey: 0,
  };
}

describe('estimateWorkspaceToolbar', () => {
  it('exposes a toolbar marker and removes the old inline reset label', () => {
    expect(ESTIMATE_WORKSPACE_TOOLBAR_MARKER).toBe('estimate-workspace-toolbar-actions');
    expect(REMOVED_ESTIMATE_BUILDER_INLINE_TOOLBAR_LABELS).toContain('Reset estimate setup');
  });

  it('exposes the add division toolbar label', () => {
    expect(ADD_DIVISION_TOOLBAR_LABEL).toBe('+ Add division');
  });

  it('shows add division only on the estimate tab when buckets are visible', () => {
    expect(shouldShowAddDivisionAction('line-items', true, true, 'detailed', true)).toBe(true);
    expect(shouldShowAddDivisionAction('line-items', false, true, 'detailed', true)).toBe(false);
    expect(shouldShowAddDivisionAction('line-items', true, false, 'detailed', true)).toBe(false);
    expect(shouldShowAddDivisionAction('overview', true, true, 'detailed', true)).toBe(false);
    expect(
      shouldShowAddDivisionAction('line-items', true, true, 'quick_feasibility', true),
    ).toBe(false);
  });

  it('shows collapse all only on the estimate tab when division buckets are visible', () => {
    expect(shouldShowCollapseAllAction('line-items', true)).toBe(true);
    expect(shouldShowCollapseAllAction('line-items', false)).toBe(false);
    expect(shouldShowCollapseAllAction('overview', true)).toBe(false);
  });

  it('shows reset form when an estimate or active estimate type exists', () => {
    const setup = mockSetup();
    expect(shouldShowResetFormAction('line-items', true, null, setup, true)).toBe(true);
    expect(shouldShowResetFormAction('line-items', false, 'bid', setup, true)).toBe(true);
    expect(shouldShowResetFormAction('line-items', false, null, setup, true)).toBe(false);
  });

  it('shows reset form on settings tab when an estimate exists', () => {
    const setup = mockSetup();
    expect(shouldShowResetFormAction('settings', true, 'bid', setup, true)).toBe(true);
    expect(shouldShowResetFormAction('settings', false, null, setup, true)).toBe(false);
  });

  it('shows save estimate when an estimate or active estimate type exists', () => {
    expect(shouldShowSaveEstimateAction(true, null)).toBe(true);
    expect(shouldShowSaveEstimateAction(false, 'budget')).toBe(true);
    expect(shouldShowSaveEstimateAction(false, null)).toBe(false);
  });

  it('shows bucket save on other tabs when a non-quick estimate exists', () => {
    expect(
      shouldShowBucketSaveAction('overview', true, null, false, false),
    ).toBe(true);
    expect(
      shouldShowBucketSaveAction('line-items', true, null, false, true),
    ).toBe(true);
    expect(
      shouldShowBucketSaveAction('line-items', true, null, false, false),
    ).toBe(false);
    expect(
      shouldShowBucketSaveAction('overview', true, null, true, false),
    ).toBe(false);
  });

  it('shows quick save only on the estimate tab when quick feasibility is active', () => {
    expect(shouldShowQuickSaveAction('line-items', true)).toBe(true);
    expect(shouldShowQuickSaveAction('line-items', false)).toBe(false);
    expect(shouldShowQuickSaveAction('overview', true)).toBe(false);
  });

  it('shows bid import/export actions only on the estimate tab for bid estimates', () => {
    expect(shouldShowBidImportExportActions('line-items', true, 'bid')).toBe(true);
    expect(shouldShowBidImportExportActions('line-items', true, 'budget')).toBe(false);
    expect(shouldShowBidImportExportActions('overview', true, 'bid')).toBe(false);
    expect(shouldShowBidImportExportActions('line-items', false, 'bid')).toBe(false);
  });

  it('moves import/export/template/reset actions into the Actions dropdown menu', () => {
    expect(REMOVED_ESTIMATE_WORKSPACE_INLINE_TOOLBAR_BUTTONS).toEqual([
      'Import estimate',
      'Export estimate',
      'Download import template',
      'Reset form',
    ]);

    const menuItems = buildEstimateWorkspaceActionsMenuItems({
      showCollapseAll: false,
      showReset: true,
      showSaveBucket: true,
      showImportExport: true,
    });

    expect(menuItems.map((item) => item.label)).toEqual([
      ESTIMATE_WORKSPACE_ACTIONS_MENU_LABELS.importEstimate,
      ESTIMATE_WORKSPACE_ACTIONS_MENU_LABELS.exportEstimate,
      ESTIMATE_WORKSPACE_ACTIONS_MENU_LABELS.downloadTemplate,
      ESTIMATE_WORKSPACE_ACTIONS_MENU_LABELS.resetForm,
    ]);
    expect(menuItems.at(-1)?.showDividerBefore).toBe(true);
    expect(menuItems.at(-1)?.destructive).toBe(true);
    expect(ESTIMATE_WORKSPACE_ACTIONS_DROPDOWN_LABEL).toBe('Actions');
  });

  it('keeps save visible, reset in dropdown, and collapse all estimate-tab only', () => {
    const estimateTabLayout = resolveEstimateWorkspaceToolbarLayout({
      showCollapseAll: true,
      showReset: true,
      showSaveBucket: true,
      showImportExport: true,
    });

    expect(estimateTabLayout.showCollapseAllButton).toBe(true);
    expect(estimateTabLayout.showResetButton).toBe(false);
    expect(estimateTabLayout.showResetInActionsMenu).toBe(true);
    expect(estimateTabLayout.showSaveEstimateButton).toBe(true);
    expect(estimateTabLayout.showActionsDropdown).toBe(true);
    expect(estimateTabLayout.desktopActionsMenuItems.map((item) => item.label)).toEqual([
      'Import estimate',
      'Export estimate',
      'Download template',
      'Reset form',
    ]);

    const overviewLayout = resolveEstimateWorkspaceToolbarLayout({
      showCollapseAll: false,
      showReset: true,
      showSaveBucket: true,
      showImportExport: false,
    });

    expect(overviewLayout.showCollapseAllButton).toBe(false);
    expect(overviewLayout.showResetButton).toBe(false);
    expect(overviewLayout.showResetInActionsMenu).toBe(true);
    expect(overviewLayout.showSaveEstimateButton).toBe(true);
    expect(overviewLayout.desktopActionsMenuItems.map((item) => item.label)).toEqual(['Reset form']);
  });

  it('shows mobile collapse overflow before import/export with reset last', () => {
    const mobileItems = buildEstimateWorkspaceActionsMenuItems({
      showCollapseAll: true,
      showReset: true,
      showSaveBucket: true,
      showImportExport: true,
      includeMobileOverflow: true,
    });

    expect(mobileItems.map((item) => item.label)).toEqual([
      'Collapse all',
      'Import estimate',
      'Export estimate',
      'Download template',
      'Reset form',
    ]);
    expect(mobileItems.filter((item) => item.mobileOnly).map((item) => item.label)).toEqual([
      'Collapse all',
    ]);
    expect(mobileItems.at(-1)?.showDividerBefore).toBe(true);
  });

  it('routes reset and import/export actions through the shared menu handler', () => {
    const calls: string[] = [];
    const handlers = {
      onImportEstimate: () => calls.push('import'),
      onExportEstimate: () => calls.push('export'),
      onDownloadTemplate: () => calls.push('template'),
      onCollapseAll: () => calls.push('collapse'),
      onResetForm: () => calls.push('reset'),
    };

    runEstimateWorkspaceMenuAction('import-estimate', handlers);
    runEstimateWorkspaceMenuAction('export-estimate', handlers);
    runEstimateWorkspaceMenuAction('download-template', handlers);
    runEstimateWorkspaceMenuAction('collapse-all', handlers);
    runEstimateWorkspaceMenuAction('reset-form', handlers);

    expect(calls).toEqual(['import', 'export', 'template', 'collapse', 'reset']);
  });

  it('shows Actions dropdown when import/export menu items are available', () => {
    expect(
      shouldShowActionsDropdown({
        showCollapseAll: false,
        showReset: true,
        showSaveBucket: true,
        showImportExport: true,
      }),
    ).toBe(true);
    expect(
      shouldShowActionsDropdown({
        showCollapseAll: false,
        showReset: true,
        showSaveBucket: true,
        showImportExport: false,
      }),
    ).toBe(true);
  });
});
