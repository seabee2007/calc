import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import ProjectCalculatorShell from '../../components/calculators/ProjectCalculatorShell';
import LaborCalculatorPanel from '../../components/calculators/LaborCalculatorPanel';
import { laborSaveErrorMessage, useProjectStore } from '../../store';
import {
  getWorkflowProjectId,
  isWorkflowActive,
  workflowQuery,
  workflowNavigateState,
  type WorkflowLocationState,
} from '../../utils/workflow';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';

const LaborCalculatorPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const workflowState = location.state as WorkflowLocationState | null;
  const inWorkflow = isWorkflowActive(location.search, workflowState);
  const workflowProjectId = getWorkflowProjectId(location.search, workflowState);
  const { currentProject, saveLaborEstimate } = useProjectStore();
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const latestConcrete = currentProject?.calculations
    ?.filter((c) => c.result?.volume > 0)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  const savedLabor = currentProject?.laborEstimates?.[0];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <ProjectCalculatorShell
        title="Labor Calculator"
        description="Crew and production planning — labor cost imports into your proposal."
      >
        <LaborCalculatorPanel
          calculation={latestConcrete}
          savedEstimate={savedLabor}
          saveDisabled={!currentProject || saving}
          onSave={async (payload) => {
            if (!currentProject) return;
            setSaving(true);
            try {
              await saveLaborEstimate(currentProject.id, {
                label: 'Placement labor',
                volumeYd: payload.volumeYd,
                inputs: payload.inputs,
                laborCost: payload.laborCost,
                adjustedLaborHours: payload.adjustedLaborHours,
                production: payload.production,
              });
              setToast({ msg: 'Labor estimate saved to project', type: 'success' });
            } catch (err) {
              setToast({
                msg: laborSaveErrorMessage(err),
                type: 'error',
              });
            } finally {
              setSaving(false);
              setTimeout(() => setToast(null), 2500);
            }
          }}
        />
        {inWorkflow && (
          <div className="mt-6">
            <Button
              variant="outline"
              onClick={() =>
                navigate({
                  pathname: '/calculator',
                  search: workflowQuery(workflowProjectId),
                  state: workflowNavigateState(workflowProjectId),
                })
              }
              className="dark:text-white"
            >
              Back to all calculators
            </Button>
          </div>
        )}
      </ProjectCalculatorShell>
      {toast && (
        <Toast
          id="labor-toast"
          title={toast.type === 'success' ? 'Saved' : 'Error'}
          message={toast.msg}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </motion.div>
  );
};

export default LaborCalculatorPage;
