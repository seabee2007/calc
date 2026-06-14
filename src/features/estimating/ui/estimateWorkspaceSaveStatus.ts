export type EstimateWorkspaceSaveStatusValue = 'saved' | 'dirty' | 'saving' | 'error';

export const ESTIMATE_WORKSPACE_SAVE_STATUS_MARKER = 'estimate-workspace-save-status';

export interface EstimateWorkspaceSaveControlInput {
  status: EstimateWorkspaceSaveStatusValue;
  activeOperations: number;
  hasPendingEstimateChanges: boolean;
  errorMessage?: string | null;
  saveBlockedReason?: string | null;
}

export interface EstimateWorkspaceSaveControlView {
  label: string;
  ariaLabel: string;
  title: string;
  disabled: boolean;
  showSpinner: boolean;
  variant: 'accent' | 'outline' | 'ghost';
  action: 'save' | 'retry' | 'none';
}

export function friendlyEstimateWorkspaceSaveError(error: string | null | undefined): string {
  if (!error?.trim()) return 'Save failed. Please try again.';
  if (error.includes('idx_project_construction_activities_code_unique')) {
    return 'Could not save because the activity code is already in use. Refresh and try again.';
  }
  if (/duplicate key value/i.test(error)) {
    return 'Save failed because of a conflict. Refresh and try again.';
  }
  return error;
}

export function resolveEstimateWorkspaceSaveControl(
  input: EstimateWorkspaceSaveControlInput,
): EstimateWorkspaceSaveControlView {
  if (input.status === 'error' || input.errorMessage) {
    return {
      label: 'Retry Save',
      ariaLabel: 'Retry save',
      title: input.errorMessage ?? 'Save failed',
      disabled: false,
      showSpinner: false,
      variant: 'accent',
      action: 'retry',
    };
  }

  if (input.status === 'saving' || input.activeOperations > 0) {
    return {
      label: 'Saving...',
      ariaLabel: 'Saving changes',
      title: 'Saving changes',
      disabled: true,
      showSpinner: true,
      variant: 'outline',
      action: 'none',
    };
  }

  if (input.saveBlockedReason) {
    return {
      label: 'Save',
      ariaLabel: 'Save unavailable',
      title: input.saveBlockedReason,
      disabled: true,
      showSpinner: false,
      variant: 'outline',
      action: 'none',
    };
  }

  if (input.hasPendingEstimateChanges || input.status === 'dirty') {
    return {
      label: 'Save',
      ariaLabel: 'Save unsaved changes',
      title: 'Unsaved changes',
      disabled: false,
      showSpinner: false,
      variant: 'accent',
      action: 'save',
    };
  }

  return {
    label: 'Saved ✓',
    ariaLabel: 'All changes saved',
    title: 'All changes saved',
    disabled: false,
    showSpinner: false,
    variant: 'outline',
    action: 'none',
  };
}
