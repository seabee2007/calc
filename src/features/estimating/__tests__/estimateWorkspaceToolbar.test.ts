import { describe, expect, it } from 'vitest';
import { createEstimateSetupStartState } from '../application/estimateStartFlow';
import {
  ESTIMATE_WORKSPACE_TOOLBAR_MARKER,
  REMOVED_ESTIMATE_BUILDER_INLINE_TOOLBAR_LABELS,
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
});
