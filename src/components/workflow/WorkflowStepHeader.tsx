import React, { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Beaker, Check, CloudSun } from 'lucide-react';
import {
  WORKFLOW_STEPS,
  WORKFLOW_CONCRETE_TOOLS,
  getWorkflowStepFromPath,
  stepIndex,
  workflowQuery,
  workflowNavigateState,
  workflowConcreteToolQuery,
  getWorkflowProjectId,
  isWorkflowActive,
  isConcreteToolPath,
  projectHasConcreteWork,
  type WorkflowLocationState,
  type WorkflowStepId,
} from '../../utils/workflow';
import { useWorkflowProgressStore } from '../../store/workflowProgressStore';
import { useProjectStore } from '../../store';
import WorkflowProjectNav from './WorkflowProjectNav';
import { getProjectIdFromSearch } from '../../utils/workflow';
import Button from '../ui/Button';

interface WorkflowStepHeaderProps {
  /** Override auto-detected current step */
  currentStep?: WorkflowStepId;
  className?: string;
}

const WorkflowStepHeader: React.FC<WorkflowStepHeaderProps> = ({
  currentStep: currentStepProp,
  className = '',
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as WorkflowLocationState | null;
  const inWorkflow = isWorkflowActive(location.search, state);
  const recordVisit = useWorkflowProgressStore((s) => s.recordVisit);
  const getMaxStepIndex = useWorkflowProgressStore((s) => s.getMaxStepIndex);
  const projects = useProjectStore((s) => s.projects);

  const currentStep = currentStepProp ?? getWorkflowStepFromPath(location.pathname);
  const currentIdx = stepIndex(currentStep);
  const projectId = getWorkflowProjectId(location.search, state);
  const maxIdx = getMaxStepIndex(projectId);
  const hasProjectContext = Boolean(projectId || getProjectIdFromSearch(location.search));

  const workflowProject = useMemo(
    () => (projectId ? projects.find((p) => p.id === projectId) : undefined),
    [projectId, projects],
  );

  const showConcreteTools =
    inWorkflow && Boolean(projectId) && projectHasConcreteWork(workflowProject);

  useEffect(() => {
    if (!inWorkflow) return;
    if (isConcreteToolPath(location.pathname)) return;
    recordVisit(projectId, currentStep);
  }, [inWorkflow, location.pathname, projectId, currentStep, recordVisit]);

  if (!inWorkflow && !hasProjectContext) return null;

  const goToStep = (stepId: WorkflowStepId, path: string) => {
    const idx = stepIndex(stepId);
    if (idx > maxIdx) return;
    navigate(
      { pathname: path, search: workflowQuery(projectId) },
      { state: workflowNavigateState(projectId) },
    );
  };

  const goToConcreteTool = (path: string) => {
    if (!projectId) return;
    navigate(
      { pathname: path, search: workflowConcreteToolQuery(projectId, state?.calculationId) },
      {
        state: workflowNavigateState(projectId, {
          calculationId: state?.calculationId,
        }),
      },
    );
  };

  return (
    <nav
      aria-label="Workflow progress"
      className={`rounded-xl border border-slate-700/80 bg-white dark:bg-slate-900/95 p-3 sm:p-4 mb-6 ${className}`}
    >
      <WorkflowProjectNav />
      {inWorkflow && (
        <>
          <p className="text-[10px] sm:text-xs uppercase tracking-wider text-black dark:text-cyan-400/90 mb-3 font-semibold">
            Contractor workflow
          </p>
          <ol className="flex flex-wrap items-center gap-1 sm:gap-0">
            {WORKFLOW_STEPS.map((step, index) => {
              const done = index < currentIdx;
              const active = step.id === currentStep && !isConcreteToolPath(location.pathname);
              const reachable = index <= maxIdx;

              return (
                <li key={step.id} className="flex items-center min-w-0">
                  {index > 0 && (
                    <span
                      className={`hidden sm:inline-block w-4 lg:w-8 h-px mx-1 shrink-0 ${
                        index <= maxIdx ? 'bg-cyan-500/60' : 'bg-slate-600'
                      }`}
                      aria-hidden
                    />
                  )}
                  <button
                    type="button"
                    disabled={!reachable}
                    onClick={() => reachable && goToStep(step.id, step.path)}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-left font-semibold transition-colors min-w-0 ${
                      active
                        ? 'bg-cyan-600/25 text-black ring-1 ring-cyan-500/50 dark:bg-cyan-600/25 text-cyan-300 ring-1 ring-cyan-500/50'
                        : done
                          ? 'text-black hover:bg-slate-600/80 hover:text-white dark:text-slate-300 hover:bg-slate-800'
                          : reachable
                            ? 'text-black hover:bg-slate-700/80 hover:text-white dark:text-slate-300 hover:bg-slate-800'
                            : 'text-black dark:text-slate-600 cursor-not-allowed'
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        active
                          ? 'text-black dark:bg-cyan-500 text-slate-950'
                          : done || (reachable && !active)
                            ? 'text-black dark:bg-cyan-600/40 text-cyan-200'
                            : 'text-black dark:bg-slate-700 text-slate-400'
                      }`}
                    >
                      {done && !active ? (
                        <Check className="h-3.5 w-3.5" aria-hidden />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span className="text-[11px] sm:text-xs font-medium truncate max-w-[4.5rem] sm:max-w-none">
                      {step.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          {showConcreteTools && (
            <div className="mt-4 pt-3 border-t border-slate-600/50">
              <p className="text-[10px] sm:text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 font-semibold">
                Concrete tools (optional)
              </p>
              <div className="flex flex-wrap gap-2">
                {WORKFLOW_CONCRETE_TOOLS.map((tool) => (
                  <Button
                    key={tool.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => goToConcreteTool(tool.path)}
                    icon={
                      tool.id === 'mix' ? (
                        <Beaker size={16} />
                      ) : (
                        <CloudSun size={16} />
                      )
                    }
                    className="text-xs"
                  >
                    {tool.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </nav>
  );
};

export default WorkflowStepHeader;
