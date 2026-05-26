import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import ProjectCalculatorShell from '../../components/calculators/ProjectCalculatorShell';
import ReinforcementOptimizer from '../../components/optimizer/ReinforcementOptimizer';
import RebarPricingCatalog from '../../components/rebar/RebarPricingCatalog';
import Input from '../../components/ui/Input';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useProjectStore } from '../../store';
import { regionalMultiplierKeyFromAddress } from '../../data/regionalMultipliers';
import {
  getWorkflowProjectId,
  isWorkflowActive,
  workflowQuery,
  workflowNavigateState,
  type WorkflowLocationState,
} from '../../utils/workflow';

const ReinforcementCalculatorPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const workflowState = location.state as WorkflowLocationState | null;
  const inWorkflow = isWorkflowActive(location.search, workflowState);
  const workflowProjectId = getWorkflowProjectId(location.search, workflowState);
  const { currentProject, loadProjects } = useProjectStore();

  const regionalKey = regionalMultiplierKeyFromAddress(currentProject?.jobsiteAddress);

  const latestConcrete = currentProject?.calculations
    ?.filter((c) => c.result?.volume > 0)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  const [lengthFt, setLengthFt] = useState('');
  const [widthFt, setWidthFt] = useState('');
  const [thicknessIn, setThicknessIn] = useState('6');
  const [heightFt, setHeightFt] = useState('');
  const [isColumn, setIsColumn] = useState(false);
  const [showOptimizer, setShowOptimizer] = useState(false);

  const calculatorData = useMemo(() => {
    const length = parseFloat(lengthFt) || 0;
    const width = parseFloat(widthFt) || 0;
    const thickness = parseFloat(thicknessIn) || 6;
    const height = parseFloat(heightFt) || 0;
    const cubicYards =
      latestConcrete?.result?.volume ??
      (length * width * (thickness / 12)) / 27;
    return {
      length_ft: length,
      width_ft: width,
      thickness_in: thickness,
      cubicYards,
      height_ft: isColumn ? height : undefined,
    };
  }, [lengthFt, widthFt, thicknessIn, heightFt, isColumn, latestConcrete]);

  const canRun =
    calculatorData.length_ft > 0 &&
    calculatorData.width_ft > 0 &&
    calculatorData.thickness_in > 0 &&
    (!isColumn || (calculatorData.height_ft ?? 0) > 0);

  React.useEffect(() => {
    const d = latestConcrete?.dimensions;
    if (!d) return;
    if (d.length) setLengthFt(String(d.length));
    if (d.width) setWidthFt(String(d.width));
    if (d.thickness) setThicknessIn(String(Math.round(d.thickness * 12)));
    if (d.height) {
      setHeightFt(String(d.height));
      setIsColumn(true);
    }
    if (latestConcrete?.type === 'column') setIsColumn(true);
  }, [latestConcrete?.id]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <ProjectCalculatorShell
        title="Reinforcement Calculator"
        description="Design rebar from 2026 stick pricing — cost saves to your project for proposals."
      >
        <Card className="p-6 mb-6">
          <RebarPricingCatalog activeRegionalKey={regionalKey} />
        </Card>

        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Footprint
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Length (ft)"
              type="number"
              min="0"
              value={lengthFt}
              onChange={(e) => setLengthFt(e.target.value)}
            />
            <Input
              label="Width (ft)"
              type="number"
              min="0"
              value={widthFt}
              onChange={(e) => setWidthFt(e.target.value)}
            />
            <Input
              label="Thickness (in)"
              type="number"
              min="0"
              value={thicknessIn}
              onChange={(e) => setThicknessIn(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 sm:col-span-2">
              <input
                type="checkbox"
                checked={isColumn}
                onChange={(e) => setIsColumn(e.target.checked)}
                className="rounded border-gray-300"
              />
              Column / vertical member
            </label>
            {isColumn && (
              <Input
                label="Height (ft)"
                type="number"
                min="0"
                value={heightFt}
                onChange={(e) => setHeightFt(e.target.value)}
              />
            )}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
            Material cost is calculated from your cut list (20 ft sticks) and saved to{' '}
            <code className="text-xs">reinforcement_sets.pricing</code> when you save the design.
          </p>
          <Button
            type="button"
            className="mt-4"
            disabled={!canRun}
            onClick={() => setShowOptimizer(true)}
          >
            Open reinforcement designer
          </Button>
        </Card>

        {showOptimizer && canRun && (
          <ReinforcementOptimizer
            embedded
            calculatorData={calculatorData}
            projectName={currentProject?.name}
            isColumn={isColumn}
            onClose={() => setShowOptimizer(false)}
            onSaved={() => {
              setShowOptimizer(false);
              void loadProjects();
            }}
          />
        )}

        {inWorkflow && (
          <Button
            variant="outline"
            className="mt-4 dark:text-white"
            onClick={() =>
              navigate({
                pathname: '/calculator',
                search: workflowQuery(workflowProjectId),
                state: workflowNavigateState(workflowProjectId),
              })
            }
          >
            Back to all calculators
          </Button>
        )}
      </ProjectCalculatorShell>
    </motion.div>
  );
};

export default ReinforcementCalculatorPage;
