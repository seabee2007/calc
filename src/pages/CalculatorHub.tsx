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
} from 'lucide-react';
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
import { projectHasImportablePricing } from '../utils/proposalPricingImport';
import type { Project } from '../types';
import { CC_PAGE_META, CC_PAGE_SUBTITLE, CC_PAGE_TITLE } from '../theme/pageTypography';

const CALCULATORS = [
  {
    id: 'concrete',
    path: '/calculator/concrete',
    title: 'Concrete',
    description: 'Volume, ready-mix pricing, and delivery',
    icon: Box,
    done: (p: Project | null) =>
      (p?.calculations ?? []).some((c) => (c.result?.pricing?.concreteCost ?? 0) > 0),
  },
  {
    id: 'reinforcement',
    path: '/calculator/reinforcement',
    title: 'Reinforcement',
    description: 'Rebar, mesh, or fiber design and material cost',
    icon: Grid3x3,
    done: (p: Project | null) => {
      const sets = p?.reinforcements ?? [];
      if (sets.length === 0) return false;
      return sets.some((r) => {
        if ((r.pricing?.estimatedCost ?? 0) > 0) return true;
        if (r.reinforcement_type === 'fiber') {
          return (r.fiber_total_lb ?? 0) > 0 || (r.fiber_bags ?? 0) > 0;
        }
        if (r.reinforcement_type === 'mesh') {
          return (r.mesh_sheets ?? 0) > 0;
        }
        return (r.total_bars ?? 0) > 0 || (r.total_linear_ft ?? 0) > 0;
      });
    },
  },
  {
    id: 'labor',
    path: '/calculator/labor',
    title: 'Labor',
    description: 'Crew and production — placement labor cost',
    icon: Users,
    done: (p: Project | null) =>
      (p?.laborEstimates?.[0]?.laborCost ?? 0) > 0 ||
      (p?.placementOrder?.production?.laborCost ?? 0) > 0,
  },
] as const;

const CalculatorHub: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const workflowState = location.state as WorkflowLocationState | null;
  const inWorkflow = isWorkflowActive(location.search, workflowState);
  const workflowProjectId = getWorkflowProjectId(location.search, workflowState);
  const { currentProject, projects } = useProjectStore();

  /** Use workflow project from fresh `projects` list (currentProject can lag after save). */
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

  const canContinueProposal =
    inWorkflow &&
    hubProject &&
    projectHasImportablePricing(hubProject);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="max-w-4xl mx-auto">
        <WorkflowStepHeader />
        <div className="mb-8">
          <h1 className={CC_PAGE_TITLE}>Estimating calculators</h1>
          <div className="mt-2 space-y-2">
            <p className={CC_PAGE_SUBTITLE}>
              Run each calculator for your project. Saved costs import into your proposal.
            </p>
            <p className={CC_PAGE_SUBTITLE}>
              Select a project inside each calculator before saving.
            </p>
          </div>
          {hubProject && (
            <p className={CC_PAGE_META}>Project: {hubProject.name}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {CALCULATORS.map(({ path, title, description, icon: Icon, done }) => {
            const complete = hubProject ? done(hubProject) : false;
            return (
              <button
                key={path}
                type="button"
                onClick={() => go(path)}
                className="text-left"
              >
                <Card className="p-5 h-full hover:border-cyan-500/50 transition-colors cursor-pointer">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-cyan-600/15 text-cyan-600 dark:text-cyan-400">
                      <Icon className="h-6 w-6" />
                    </span>
                    {complete ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                    ) : (
                      <Circle className="h-5 w-5 text-gray-300 dark:text-gray-600 shrink-0" />
                    )}
                  </div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">{title}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
                </Card>
              </button>
            );
          })}
        </div>

        {inWorkflow && hubProject && (
          <div className="p-4 rounded-lg bg-cyan-950/40 border border-cyan-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-sm text-cyan-100/90">
              {canContinueProposal
                ? 'Estimates saved — continue to build your proposal.'
                : 'Save at least one estimate (concrete, reinforcement, or labor) to continue.'}
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
      </div>
    </motion.div>
  );
};

export default CalculatorHub;
