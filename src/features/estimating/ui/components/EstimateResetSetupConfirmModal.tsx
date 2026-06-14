import Modal from '../../../../components/ui/Modal';
import Button from '../../../../components/ui/Button';
import {
  ESTIMATE_SETUP_RESET_REPLACE_NOTE,
} from '../../application/estimateStartFlow';
import { PLANNER_MUTED, TEXT_BODY } from '../estimateWorkspaceTheme';

interface Props {
  isOpen: boolean;
  hasSavedWork: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}

export default function EstimateResetSetupConfirmModal({
  isOpen,
  hasSavedWork,
  onClose,
  onConfirm,
}: Props) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reset this estimate?" size="md">
      <div className="space-y-4">
        <p className={`text-sm ${TEXT_BODY}`}>
          This will remove selected divisions, construction activities, and estimate line items
          for this project so you can start again with a different estimate type.
        </p>

        {hasSavedWork ? (
          <p className={`text-xs ${PLANNER_MUTED}`}>{ESTIMATE_SETUP_RESET_REPLACE_NOTE}</p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm}>
            Reset estimate
          </Button>
        </div>
      </div>
    </Modal>
  );
}
