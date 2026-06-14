import { CheckCircle2, Save } from 'lucide-react';
import Button from '../../../../components/ui/Button';
import {
  ESTIMATE_WORKSPACE_SAVE_STATUS_MARKER,
  resolveEstimateWorkspaceSaveControl,
  type EstimateWorkspaceSaveStatusValue,
} from '../estimateWorkspaceSaveStatus';

interface Props {
  show: boolean;
  status: EstimateWorkspaceSaveStatusValue;
  activeOperations: number;
  hasPendingEstimateChanges: boolean;
  errorMessage?: string | null;
  saveBlockedReason?: string | null;
  onSave: () => void;
  onRetry: () => void;
}

export default function EstimateWorkspaceSaveStatusControl({
  show,
  status,
  activeOperations,
  hasPendingEstimateChanges,
  errorMessage,
  saveBlockedReason,
  onSave,
  onRetry,
}: Props) {
  if (!show) return null;

  const control = resolveEstimateWorkspaceSaveControl({
    status,
    activeOperations,
    hasPendingEstimateChanges,
    errorMessage,
    saveBlockedReason,
  });

  const handleClick = () => {
    if (control.action === 'save') {
      onSave();
      return;
    }
    if (control.action === 'retry') {
      onRetry();
    }
  };

  const icon =
    control.action === 'none' && control.label.startsWith('Saved') ? (
      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
    ) : control.action !== 'none' ? (
      <Save className="h-4 w-4" aria-hidden />
    ) : null;

  return (
    <Button
      type="button"
      variant={control.variant}
      size="sm"
      icon={icon ?? undefined}
      disabled={control.disabled}
      isLoading={control.showSpinner}
      aria-label={control.ariaLabel}
      title={control.title}
      data-testid={ESTIMATE_WORKSPACE_SAVE_STATUS_MARKER}
      onClick={handleClick}
    >
      {control.label}
    </Button>
  );
}
