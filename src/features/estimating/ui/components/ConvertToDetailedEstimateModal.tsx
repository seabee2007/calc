import Modal from '../../../../components/ui/Modal';
import Button from '../../../../components/ui/Button';
import { TEXT_BODY } from '../estimateWorkspaceTheme';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ConvertToDetailedEstimateModal({ open, onClose }: Props) {
  return (
    <Modal isOpen={open} onClose={onClose} title="Convert to detailed estimate" size="md">
      <div className="space-y-4">
        <p className={`text-sm ${TEXT_BODY}`}>
          Converting to a detailed estimate will let you build construction activities, production
          rates, and schedule logic from your conceptual budget.
        </p>
        <p className={`text-sm ${TEXT_BODY}`}>
          Your conceptual budget, assumptions, risks, and scenarios stay saved in this estimate.
          Nothing is deleted when you switch estimate types.
        </p>
        <p className={`text-sm ${TEXT_BODY}`}>
          Full conversion tooling is coming in a future release. For now, change the estimate type
          in the header to Detailed Estimate when you are ready to begin detailed takeoff.
        </p>
        <div className="flex justify-end">
          <Button onClick={onClose}>Got it</Button>
        </div>
      </div>
    </Modal>
  );
}
