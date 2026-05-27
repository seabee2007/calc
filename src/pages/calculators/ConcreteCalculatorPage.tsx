import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  isWorkflowActive,
  getWorkflowProjectId,
  workflowQuery,
  workflowNavigateState,
  type WorkflowLocationState,
} from '../../utils/workflow';
import CalculationForm from '../../components/calculations/CalculationForm';
import { useProjectStore } from '../../store';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import ProjectCalculatorShell from '../../components/calculators/ProjectCalculatorShell';
import slabDiagram from '../../assets/images/slab.webp';
import thickSlabDiagram from '../../assets/images/THICK SLAB.webp';

const ConcreteCalculatorPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentProject, addCalculation } = useProjectStore();
  const [calculationType, setCalculationType] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'warning' | 'error'>('success');
  const [lastSavedCalculationId, setLastSavedCalculationId] = useState<string | null>(null);
  const workflowState = location.state as WorkflowLocationState | null;
  const inWorkflow = isWorkflowActive(location.search, workflowState);
  const workflowProjectId = getWorkflowProjectId(location.search, workflowState);

  useEffect(() => {
    if (!inWorkflow || !currentProject?.calculations?.length) return;
    const withVolume = [...currentProject.calculations]
      .filter((c) => c.result?.volume > 0)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (withVolume[0]?.id) setLastSavedCalculationId(withVolume[0].id);
  }, [inWorkflow, currentProject?.calculations, currentProject?.id]);

  const goToProposal = () => {
    if (!currentProject) return;
    navigate(
      { pathname: '/proposal-generator', search: workflowQuery(currentProject.id) },
      {
        state: workflowNavigateState(currentProject.id, {
          calculationId: lastSavedCalculationId ?? undefined,
        }),
      },
    );
  };

  const handleSaveCalculation = async (calculation: Parameters<typeof addCalculation>[1]) => {
    if (!currentProject) {
      setToastMessage('Please select a project to save calculations');
      setToastType('warning');
      setShowToast(true);
      return;
    }
    try {
      const saved = await addCalculation(currentProject.id, calculation);
      setToastMessage(`Concrete calculation saved to ${currentProject.name}`);
      setToastType('success');
      if (saved?.id) setLastSavedCalculationId(saved.id);
      return saved;
    } catch {
      setToastMessage('Error saving calculation');
      setToastType('error');
    } finally {
      setShowToast(true);
      setTimeout(() => setShowToast(false), 1500);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <ProjectCalculatorShell
        title="Concrete Calculator"
        description="Volume, ready-mix pricing, and delivery — saved to your project for proposals."
        footer={
          inWorkflow && currentProject ? (
            <div className="mt-6 p-4 rounded-lg bg-cyan-950/40 border border-cyan-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-sm text-cyan-100/90">
                {lastSavedCalculationId
                  ? 'Concrete saved. Run reinforcement and labor calculators, then continue to proposal.'
                  : 'Save your concrete calculation, then complete reinforcement and labor on step 2.'}
              </p>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="secondary"
                  onClick={() =>
                    navigate({
                      pathname: '/calculator',
                      search: workflowQuery(workflowProjectId),
                      state: workflowNavigateState(workflowProjectId),
                    })
                  }
                  className="shadow-sm"
                >
                  All calculators
                </Button>
                <Button
                  onClick={goToProposal}
                  disabled={!lastSavedCalculationId}
                  icon={<FileText size={18} />}
                >
                  Continue to proposal
                </Button>
              </div>
            </div>
          ) : undefined
        }
      >
        {(calculationType === 'slab' || calculationType === 'thickened_edge_slab') && (
          <div className="mb-6 bg-white/90 dark:bg-gray-800/90 p-4 rounded-lg shadow-lg">
            <img
              src={calculationType === 'thickened_edge_slab' ? thickSlabDiagram : slabDiagram}
              alt="Slab diagram"
              className="w-full max-w-2xl mx-auto h-auto"
            />
          </div>
        )}
        <CalculationForm onSave={handleSaveCalculation} onTypeChange={setCalculationType} />
      </ProjectCalculatorShell>
      {showToast && (
        <Toast
          id="concrete-calc-toast"
          title={toastType === 'success' ? 'Success' : toastType === 'warning' ? 'Warning' : 'Error'}
          message={toastMessage}
          type={toastType}
          onClose={() => setShowToast(false)}
        />
      )}
    </motion.div>
  );
};

export default ConcreteCalculatorPage;
