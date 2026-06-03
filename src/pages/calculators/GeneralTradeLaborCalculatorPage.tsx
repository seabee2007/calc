import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import ProjectCalculatorShell from '../../components/calculators/ProjectCalculatorShell';
import GeneralTradeLaborCalculatorPanel from '../../components/calculators/GeneralTradeLaborCalculatorPanel';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import {
  getWorkflowProjectId,
  isWorkflowActive,
  workflowQuery,
  workflowNavigateState,
  type WorkflowLocationState,
} from '../../utils/workflow';

const GeneralTradeLaborCalculatorPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const workflowState = location.state as WorkflowLocationState | null;
  const inWorkflow = isWorkflowActive(location.search, workflowState);
  const workflowProjectId = getWorkflowProjectId(location.search, workflowState);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <ProjectCalculatorShell
        title="General Trade Labor Calculator"
        description="Estimate labor hours, crew days, and labor cost for non-concrete trades."
      >
        <GeneralTradeLaborCalculatorPanel
          onToast={(msg, type) => {
            setToast({ msg, type });
            setTimeout(() => setToast(null), 2500);
          }}
        />
        {inWorkflow && (
          <div className="mt-6">
            <Button
              variant="secondary"
              onClick={() =>
                navigate(
                  {
                    pathname: '/calculator',
                    search: workflowQuery(workflowProjectId),
                  },
                  { state: workflowNavigateState(workflowProjectId) },
                )
              }
              className="shadow-sm"
            >
              Back to all calculators
            </Button>
          </div>
        )}
      </ProjectCalculatorShell>
      {toast && (
        <Toast
          id="gtl-toast"
          title={toast.type === 'success' ? 'Saved' : 'Error'}
          message={toast.msg}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </motion.div>
  );
};

export default GeneralTradeLaborCalculatorPage;
