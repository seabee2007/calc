import Modal from '../../../../components/ui/Modal';
import Button from '../../../../components/ui/Button';

interface Props {
  isOpen: boolean;
  suggestionCount: number;
  accepting?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}

export default function LogicReviewAcceptAllConfirmModal({
  isOpen,
  suggestionCount,
  accepting = false,
  onClose,
  onConfirm,
}: Props) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Accept all logic suggestions?"
      size="md"
      stackAboveDrawer
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-700 dark:text-slate-200">
          This will add all visible suggested logic links that do not create duplicates or circular
          logic. You can still edit or remove links later.
        </p>
        {suggestionCount > 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {suggestionCount} suggestion{suggestionCount === 1 ? '' : 's'} will be reviewed.
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={accepting}>
            Cancel
          </Button>
          <Button type="button" variant="accent" onClick={onConfirm} disabled={accepting}>
            {accepting ? 'Accepting…' : 'Accept all'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
