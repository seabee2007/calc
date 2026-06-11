import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { fetchAssignedProjects } from '../../services/employeeService';
import { resolveProjectWorkflow } from '../../utils/projectWorkflow';
import { PLANNER_PAGE_BG } from '../../components/planner/plannerTheme';
import PlannerRecordsQuickNav from '../../components/planner/PlannerRecordsQuickNav';
import PlannerHubProjectCard, {
  PlannerHubProjectCardSkeleton,
  type PlannerHubProjectCardData,
} from '../../components/planner/PlannerHubProjectCard';
import AppPage from '../../components/ui/AppPage';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import InlineNotice from '../../components/ui/InlineNotice';
import Button from '../../components/ui/Button';
import KpiStrip from '../../components/ui/KpiStrip';

export const PLANNER_HUB_LAST_PROJECT_KEY = 'plannerHubLastProjectId';

export default function PlannerHubPage() {
  const navigate = useNavigate();
  const { user, isOwner, isEmployee } = useAuth();
  const [projects, setProjects] = useState<PlannerHubProjectCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      if (isEmployee && !isOwner) {
        const rows = await fetchAssignedProjects(user.id);
        setProjects(
          rows.map((project) => ({
            id: project.id as string,
            name: project.name as string,
            statusLabel: 'Assigned',
          })),
        );
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('projects')
        .select('id, name, pour_date, placement_order')
        .eq('user_id', user.id)
        .order('name');

      if (fetchError) {
        throw fetchError;
      }

      setProjects(
        (data ?? [])
          .map((row) => {
            const workflow = resolveProjectWorkflow(
              row as Parameters<typeof resolveProjectWorkflow>[0],
            );
            return {
              id: row.id as string,
              name: row.name as string,
              statusLabel: workflow.stageLabel,
              stage: workflow.stage,
              nextActionLabel: workflow.nextAction.label,
            };
          })
          .filter((project) => (project as { stage?: string }).stage !== 'closed')
          .map(({ id, name, statusLabel, nextActionLabel }) => ({
            id,
            name,
            statusLabel,
            nextActionLabel,
          })),
      );
    } catch (err) {
      console.error('Failed to load planner hub projects', err);
      setProjects([]);
      setError('Could not load project plans.');
    } finally {
      setLoading(false);
    }
  }, [user, isOwner, isEmployee]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const rememberProject = (projectId: string) => {
    sessionStorage.setItem(PLANNER_HUB_LAST_PROJECT_KEY, projectId);
  };

  const openNewProjectPlan = () => {
    navigate('/projects', { state: { openCreate: true } });
  };

  const headerActions = (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2 lg:justify-end">
      <PlannerRecordsQuickNav />
      <Button
        variant="outline"
        size="sm"
        
        onClick={openNewProjectPlan}
        data-testid="planner-hub-new-project-plan"
      >
        New Project
      </Button>
    </div>
  );

  return (
    <div className={`overflow-y-auto ${PLANNER_PAGE_BG}`}>
      <AppPage
        className="pt-6"
        header={
          <PageHeader
            title="Planner Hub"
            subtitle="Open a project plan board to manage field tasks, assignments, and field updates."
            actions={headerActions}
          />
        }
      >
        {error ? (
          <div className="mb-6 space-y-3">
            <InlineNotice variant="danger" title={error} />
            <Button variant="outline" size="sm" onClick={() => void loadProjects()}>
              Retry
            </Button>
          </div>
        ) : null}

        {loading ? (
          <div
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
            aria-busy="true"
            aria-label="Loading project plans"
          >
            {Array.from({ length: 6 }, (_, index) => (
              <PlannerHubProjectCardSkeleton key={index} />
            ))}
          </div>
        ) : null}

        {!loading && !error && projects.length === 0 ? (
          <EmptyState
            title="No project plans yet"
            description="Create a project plan to start managing field tasks."
          />
        ) : null}

        {!loading && !error && projects.length > 0 ? (
          <>
            <KpiStrip
              className="mb-6"
              metrics={[
                {
                  label: 'Active plans',
                  value: projects.length,
                  change: 'Open a board to manage field tasks',
                },
              ]}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {projects.map((project) => (
                <PlannerHubProjectCard
                  key={project.id}
                  project={project}
                  onOpen={rememberProject}
                />
              ))}
            </div>
          </>
        ) : null}
      </AppPage>
    </div>
  );
}
