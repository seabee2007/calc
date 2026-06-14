import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getVisibleWorkspaceTabs } from '../application/estimateWorkspaceTabPolicy';
import {
  ESTIMATE_WORKSPACE_SAVE_STATUS_MARKER,
  friendlyEstimateWorkspaceSaveError,
  resolveEstimateWorkspaceSaveControl,
} from '../ui/estimateWorkspaceSaveStatus';
import { shouldShowBucketSaveAction } from '../ui/estimateWorkspaceToolbar';
import EstimateWorkspaceSaveStatusControl from '../ui/components/EstimateWorkspaceSaveStatusControl';

const toolbarActionsSource = readFileSync(
  resolve(process.cwd(), 'src/features/estimating/ui/components/EstimateWorkspaceToolbarActions.tsx'),
  'utf8',
);

describe('estimateWorkspaceSaveStatus', () => {
  it('shows Saved state when workspace is idle and persisted', () => {
    const control = resolveEstimateWorkspaceSaveControl({
      status: 'saved',
      activeOperations: 0,
      hasPendingEstimateChanges: false,
    });

    expect(control.label).toBe('Saved ✓');
    expect(control.title).toBe('All changes saved');
    expect(control.action).toBe('none');
    expect(control.disabled).toBe(false);
  });

  it('shows Saving state while async operations are active', () => {
    const control = resolveEstimateWorkspaceSaveControl({
      status: 'saving',
      activeOperations: 1,
      hasPendingEstimateChanges: false,
    });

    expect(control.label).toBe('Saving...');
    expect(control.showSpinner).toBe(true);
    expect(control.disabled).toBe(true);
  });

  it('shows active Save when pending estimate changes exist', () => {
    const control = resolveEstimateWorkspaceSaveControl({
      status: 'dirty',
      activeOperations: 0,
      hasPendingEstimateChanges: true,
    });

    expect(control.label).toBe('Save');
    expect(control.action).toBe('save');
    expect(control.variant).toBe('accent');
  });

  it('shows Retry Save on error without raw database text', () => {
    const rawError =
      'duplicate key value violates unique constraint "idx_project_construction_activities_code_unique"';
    const control = resolveEstimateWorkspaceSaveControl({
      status: 'error',
      activeOperations: 0,
      hasPendingEstimateChanges: false,
      errorMessage: friendlyEstimateWorkspaceSaveError(rawError),
    });

    expect(control.label).toBe('Retry Save');
    expect(control.action).toBe('retry');
    expect(control.title).not.toContain('idx_project_construction_activities_code_unique');
  });

  it('renders save status control with Saved label by default', () => {
    render(
      <EstimateWorkspaceSaveStatusControl
        show
        status="saved"
        activeOperations={0}
        hasPendingEstimateChanges={false}
        onSave={() => {}}
        onRetry={() => {}}
      />,
    );

    expect(screen.getByTestId(ESTIMATE_WORKSPACE_SAVE_STATUS_MARKER)).toHaveTextContent('Saved ✓');
    expect(screen.getByRole('button', { name: 'All changes saved' })).toBeEnabled();
  });

  it('calls retry handler without navigating', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(
      <EstimateWorkspaceSaveStatusControl
        show
        status="error"
        activeOperations={0}
        hasPendingEstimateChanges={false}
        errorMessage="Save failed. Please try again."
        onSave={() => {}}
        onRetry={onRetry}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Retry save' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows disabled Save when saving is blocked', () => {
    const control = resolveEstimateWorkspaceSaveControl({
      status: 'saved',
      activeOperations: 0,
      hasPendingEstimateChanges: false,
      saveBlockedReason: 'Select an estimate type before saving',
    });

    expect(control.label).toBe('Save');
    expect(control.disabled).toBe(true);
    expect(control.title).toBe('Select an estimate type before saving');
    expect(control.action).toBe('none');
  });

  it('renders disabled save when blocked reason is provided', () => {
    render(
      <EstimateWorkspaceSaveStatusControl
        show
        status="saved"
        activeOperations={0}
        hasPendingEstimateChanges={false}
        saveBlockedReason="Select an estimate type before saving"
        onSave={() => {}}
        onRetry={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: 'Save unavailable' })).toBeDisabled();
  });

  it('shows save status on all detailed estimate workspace tabs', () => {
    const tabs = getVisibleWorkspaceTabs('detailed', true).map((tab) => tab.id);

    for (const tabId of tabs) {
      expect(
        shouldShowBucketSaveAction(tabId, true, 'detailed', false, tabId === 'line-items'),
      ).toBe(true);
    }
  });

  it('does not rely on a disabled icon-only save button in toolbar actions', () => {
    expect(toolbarActionsSource).toContain('EstimateWorkspaceSaveStatusControl');
    expect(toolbarActionsSource).not.toContain('aria-label="Save estimate"');
    expect(toolbarActionsSource).not.toContain('disabled={!canSave || saving}');
  });
});
