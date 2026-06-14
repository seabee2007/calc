import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Users,
  Grid3x3,
  FileText,
  CheckCircle2,
  Circle,
  PenLine,
  HardHat,
} from 'lucide-react';
import {
  projectHasConcreteEstimate,
  projectHasConcreteLaborEstimate,
  projectHasCustomEstimate,
  projectHasGeneralTradeLaborEstimate,
  projectHasManualCustomEstimate,
  projectHasReinforcementEstimate,
} from '../utils/customEstimateUtils';
import WorkflowStepHeader from '../components/workflow/WorkflowStepHeader';
import {
  getWorkflowProjectId,
  isWorkflowActive,
  workflowQuery,
  workflowNavigateState,
  type WorkflowLocationState,
} from '../utils/workflow';
import { useProjectStore } from '../store';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import AppPage from '../components/ui/AppPage';
import PageHeader from '../components/ui/PageHeader';
import CalculatorToolNotice from '../components/calculators/CalculatorToolNotice';
import { projectHasImportablePricing } from '../utils/proposalPricingImport';
import type { Project } from '../types';
import { PREMIUM_PANEL, TEXT_MUTED } from '../theme/appTheme';

const PAGE_HEADER_CLASS =
  '[&_h1]:text-slate-900 dark:[&_h1]:text-slate-50 [&_p]:text-slate-600 dark:[&_p]:text-slate-300';

const HELPER_CALCULATORS = [
  {
    id: 'concrete',
    path: '/calculator/concrete',
    title: 'Concrete Calculator',
    description: 'Volume, ready-mix pricing, and delivery',
    icon: Box,
    done: projectHasConcreteEstimate,
  },
  {
    id: 'reinforcement',
    path: '/calculator/reinforcement',
    title: 'Reinforcement Calculator',
    description: 'Rebar, mesh, or fiber design and material cost',
    icon: Grid3x3,
    done: projectHasReinforcementEstimate,
  },
  {
    id: 'labor',
    path: '/calculator/labor',
    title: 'Concrete Labor Calculator',
    description: 'Crew and production — concrete placement labor',
    icon: Users,
    done: projectHasConcreteLaborEstimate,
  },
] as const;

const LEGACY_CALCULATORS = [
  {
    id: 'general-trade-labor',
    path: '/calculator/general-trade-labor',
    title: 'General Trade Labor Calculator',
    description: 'Non-concrete trades — hours, crew days, labor price',
    icon: HardHat,
    done: projectHasGeneralTradeLaborEstimate,
  },
  {
    id: 'custom',
    path: '/calculator/custom',
    title: 'Custom Estimate',
    description: 'Manual labor, material, and equipment lines',
    icon: PenLine,
    done: (p: Project | null) =>
      projectHasManualCustomEstimate(p) ||
      (projectHasCustomEstimate(p) && !projectHasGeneralTradeLaborEstimate(p)),
  },
] as const;

function CalculatorCardGrid({
  calculators,
  hubProject,
  onOpen,
}: {
  calculators: readonly {
    path: string;
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    done: (p: Project | null) => boolean;
  }[];
  hubProject: Project | null;
  onOpen: (path: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {calculators.map(({ path, title, description, icon: Icon, done }) => {
        const complete = hubProject ? done(hubProject) : false;
        return (
          <button key={path} type="button" onClick={() => onOpen(path)} className="text-left">
            <Card
              className={`h-full cursor-pointer p-5 transition-colors hover:border-cyan-500/50 ${PREMIUM_PANEL}`}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-cyan-600/15 text-cyan-600 dark:text-cyan-400">
                  <Icon className="h-6 w-6" />
                </span>
                {complete ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
                ) : (
                  <Circle className="h-5 w-5 shrink-0 text-gray-300 dark:text-gray-600" />
                )}
              </div>
              <h2 className="font-semibold text-gray-900 dark:text-white">{title}</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
            </Card>
          </button>
        );
      })}
    </div>
  );
}

const CalculatorHub: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const workflowState = location.state as WorkflowLocationState | null;
  const inWorkflow = isWorkflowActive(location.search, workflowState);
  const workflowProjectId = getWorkflowProjectId(location.search, workflowState);
  const { currentProject, projects } = useProjectStore();

  const hubProject = useMemo(() => {
    const id = workflowProjectId ?? currentProject?.id;
    if (!id) return currentProject;
    return projects.find((p) => p.id === id) ?? currentProject;
  }, [workflowProjectId, currentProject, projects]);

  const go = (path: string) => {
    navigate(
      {
        pathname: path,
        search: inWorkflow ? workflowQuery(workflowProjectId) : '',
      },
      {
        state: inWorkflow ? workflowNavigateState(workflowProjectId) : undefined,
      },
    );
  };

  const canContinueProposal = inWorkflow && hubProject && projectHasImportablePricing(hubProject);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <AppPage
        className="w-full !max-w-none pt-6"
        data-testid="calculator-hub-page"
        header={
          <PageHeader
            title="Quick Calculators"
            subtitle="Helper tools for volume, reinforcement, and specialty labor checks. For proposal-ready project estimates, use Estimate Workspace."
            className={PAGE_HEADER_CLASS}
          />
        }
      >
        <WorkflowStepHeader />

        {hubProject ? (
          <p className={`mb-4 text-sm ${TEXT_MUTED}`}>Project: {hubProject.name}</p>
        ) : null}

        <CalculatorToolNotice kind="helper" projectId={hubProject?.id} />

        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Helper tools
          </h2>
          <CalculatorCardGrid
            calculators={HELPER_CALCULATORS}
            hubProject={hubProject}
            onOpen={go}
          />
        </section>

        <section className="mb-8">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Legacy tools
          </h2>
          <p className={`mb-3 text-sm ${TEXT_MUTED}`}>
            These standalone estimate paths are being replaced by Estimate Workspace activity line
            items. Routes remain available for backward compatibility.
          </p>
          <CalculatorCardGrid
            calculators={LEGACY_CALCULATORS}
            hubProject={hubProject}
            onOpen={go}
          />
        </section>

        {inWorkflow && hubProject && (
          <div className="flex flex-col justify-between gap-3 rounded-lg border border-cyan-700/50 bg-cyan-950/40 p-4 sm:flex-row sm:items-center">
            <p className="text-sm text-cyan-100/90">
              {canContinueProposal
                ? 'Estimates saved — continue to build your proposal.'
                : 'Save at least one estimate or use Estimate Workspace before continuing to proposal.'}
            </p>
            <Button
              onClick={() =>
                navigate(
                  {
                    pathname: '/proposal-generator',
                    search: workflowQuery(hubProject.id),
                  },
                  { state: workflowNavigateState(hubProject.id) },
                )
              }
              disabled={!canContinueProposal}
              icon={<FileText size={18} />}
              className="shrink-0"
            >
              Continue to proposal
            </Button>
          </div>
        )}
      </AppPage>
    </motion.div>
  );
};

export default CalculatorHub;
