import Button from '../../../../components/ui/Button';
import Modal from '../../../../components/ui/Modal';
import type { EstimateTypeChangeWarning } from '../../application/estimateWorkspaceTabPolicy';

interface Props {
  open: boolean;
  warning: EstimateTypeChangeWarning;
  onCancel: () => void;
  onConfirm: () => void;
  confirming?: boolean;
}

export default function ChangeEstimateTypeConfirmModal({
  open,
  warning,
  onCancel,
  onConfirm,
  confirming = false,
}: Props) {
  if (!warning.showWarning) return null;

  return (
    <Modal isOpen={open} onClose={onCancel} title={warning.title} size="md">
      <p className="text-sm text-slate-600 dark:text-slate-300">{warning.body}</p>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={confirming}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="accent"
          size="sm"
          onClick={onConfirm}
          isLoading={confirming}
          disabled={confirming}
        >
          Change estimate type
        </Button>
      </div>
    </Modal>
  );
}
