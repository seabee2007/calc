import { useNavigate } from 'react-router-dom';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import {
  ESTIMATING_CALCULATOR_OPTIONS,
  ESTIMATING_CALCULATORS_MODAL_COPY,
  ESTIMATING_CALCULATORS_MODAL_TITLE,
} from '../constants/estimatingCalculators';
import { workflowNavigateState, workflowQuery } from '../../../utils/workflow';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
}

export default function EstimatingCalculatorsModal({ isOpen, onClose, projectId }: Props) {
  const navigate = useNavigate();

  const openCalculator = (path: string) => {
    navigate(
      {
        pathname: path,
        search: workflowQuery(projectId).replace(/^\?/, ''),
      },
      { state: workflowNavigateState(projectId) },
    );
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={ESTIMATING_CALCULATORS_MODAL_TITLE} size="lg">
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
        {ESTIMATING_CALCULATORS_MODAL_COPY}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {ESTIMATING_CALCULATOR_OPTIONS.map((calculator) => (
          <div
            key={calculator.id}
            className="flex h-full flex-col rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60"
          >
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {calculator.title}
            </h3>
            <p className="mt-1 flex-1 text-xs text-slate-600 dark:text-slate-400">
              {calculator.description}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3 w-full"
              onClick={() => openCalculator(calculator.path)}
            >
              Open
            </Button>
          </div>
        ))}
      </div>
    </Modal>
  );
}
