import React from 'react';
import { MapPin, Factory } from 'lucide-react';
import OpsCard from './OpsCard';
import { OPS_LIST_ROW, OPS_MUTED, OPS_OUTLINE_BTN, OPS_SUBTLE, OPS_TITLE } from './opsTheme';
import type { DashboardProjectCard } from '../../utils/operationsDashboard';
import { useNavigate } from 'react-router-dom';
import Button from '../ui/Button';
import { navigateToProjectDetail } from '../../utils/workflow';
import { useProjectStore } from '../../store';
import { defaultPlacementOrder } from '../../types/placementOrder';
import {
  PROJECT_LIFECYCLE_LABELS,
  PROJECT_LIFECYCLE_STAGE_ORDER,
  normalizeWorkflowStageForDisplay,
} from '../../utils/projectWorkflow';

interface ActiveProjectsPanelProps {
  projects: DashboardProjectCard[];
  compact?: boolean;
}

const WORKFLOW_STAGES = PROJECT_LIFECYCLE_STAGE_ORDER;

const ActiveProjectsPanel: React.FC<ActiveProjectsPanelProps> = ({
  projects,
  compact = false,
}) => {
  const navigate = useNavigate();
  const { projects: storeProjects, updateProject, setCurrentProject } = useProjectStore();
  const list = compact ? projects.slice(0, 4) : projects.slice(0, 8);

  const handleProjectNextAction = async (card: DashboardProjectCard) => {
    const action = card.nextAction;
    if (action.kind === 'close_project') {
      const target = storeProjects.find((p) => p.id === card.id);
      if (!target) {
        navigateToProjectDetail(navigate, card.id);
        return;
      }
      try {
        await updateProject(card.id, {
          placementOrder: {
            ...(target.placementOrder ?? defaultPlacementOrder()),
            lifecycleStage: 'closed',
            updatedAt: new Date().toISOString(),
          },
        });
        setCurrentProject(card.id);
        navigateToProjectDetail(navigate, card.id);
      } catch (e) {
        console.error('Failed to close out project', e);
      }
      return;
    }
    if (action.kind === 'back_to_list') {
      navigate({ pathname: '/projects', search: '' }, { state: { view: 'list' } });
      return;
    }
    if (action.kind === 'scroll_to_qc') {
      navigateToProjectDetail(navigate, card.id);
      return;
    }
    if (action.path === '/projects') {
      navigateToProjectDetail(navigate, card.id);
      return;
    }
    const search = action.search?.replace(/^\?/, '') ?? '';
    navigate({ pathname: action.path, search });
  };

  return (
    <OpsCard>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className={`font-semibold ${OPS_TITLE}`}>Active projects</h3>
        </div>
        {projects.length > 0 && (
          <button
            type="button"
            onClick={() => navigate('/projects')}
            className="text-sm text-cyan-700 dark:text-cyan-400 hover:underline"
          >
            All projects →
          </button>
        )}
      </header>
      {projects.length === 0 ? (
        <div className="text-center py-4">
          <p className={`text-sm mb-3 ${OPS_MUTED}`}>No active projects</p>
          <Button
            variant="accent"
            size="sm"
            onClick={() => navigate('/projects', { state: { openCreate: true } })}
          >
            Start Project
          </Button>
        </div>
      ) : (
        <ul className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
          {list.map((p) => (
            <li key={p.id}>
              <div className={`rounded-lg p-3 ${OPS_LIST_ROW}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={`font-semibold truncate ${OPS_TITLE}`}>{p.name}</p>
                    <p className={`text-xs mt-0.5 ${OPS_MUTED}`}>{p.remainingCyLabel}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-cyan-400">{p.healthScore}%</p>
                    <p className={`text-[10px] uppercase ${OPS_SUBTLE}`}>health</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 mt-2">
                  {WORKFLOW_STAGES.map((stage) => {
                    const cardStage = normalizeWorkflowStageForDisplay(p.workflowStage);
                    const active = cardStage === stage;
                    const past =
                      WORKFLOW_STAGES.indexOf(stage) <
                      WORKFLOW_STAGES.indexOf(cardStage);
                    return (
                      <span
                        key={stage}
                        title={PROJECT_LIFECYCLE_LABELS[normalizeWorkflowStageForDisplay(stage)]}
                        className={`h-1.5 w-3 rounded-full ${
                          active
                            ? 'bg-cyan-400'
                            : past
                              ? 'bg-emerald-600/80'
                              : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      />
                    );
                  })}
                </div>
                <p className={`text-[10px] mt-1 ${OPS_SUBTLE}`}>{p.workflowLabel}</p>

                <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700/80">
                  <p className={`text-[10px] uppercase ${OPS_SUBTLE}`}>Next action</p>
                  <p className="text-sm font-medium text-cyan-700 dark:text-cyan-300">
                    {p.nextAction.label}
                  </p>
                </div>

                <div className={`flex flex-wrap gap-3 mt-2 text-xs ${OPS_SUBTLE}`}>
                  {p.batchPlantName && (
                    <span className="flex items-center gap-1">
                      <Factory className="h-3 w-3" />
                      {p.batchPlantName}
                    </span>
                  )}
                  {p.hasJobsite && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      Jobsite set
                    </span>
                  )}
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className={`${OPS_OUTLINE_BTN} mt-3 w-full sm:w-auto`}
                  onClick={() => void handleProjectNextAction(p)}
                >
                  {p.nextAction.label}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </OpsCard>
  );
};

export default ActiveProjectsPanel;
