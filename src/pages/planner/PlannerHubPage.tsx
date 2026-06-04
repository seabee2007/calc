import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderKanban } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { fetchAssignedProjects } from '../../services/employeeService';
import { resolveProjectWorkflow } from '../../utils/projectWorkflow';
import { plannerBoardHref } from '../../utils/plannerRoutes';
import { PLANNER_BOARD_BG } from '../../components/planner/plannerTheme';
import PlannerRecordsQuickNav from '../../components/planner/PlannerRecordsQuickNav';

const LAST_PROJECT_KEY = 'plannerHubLastProjectId';

interface HubProject {
  id: string;
  name: string;
  statusLabel: string;
}

export default function PlannerHubPage() {
  const { user, isOwner, isEmployee } = useAuth();
  const [projects, setProjects] = useState<HubProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      setLoading(true);
      try {
        if (isEmployee && !isOwner) {
          const rows = await fetchAssignedProjects(user.id);
          setProjects(
            rows.map((p) => ({
              id: p.id as string,
              name: p.name as string,
              statusLabel: 'Assigned',
            })),
          );
          return;
        }

        const { data } = await supabase
          .from('projects')
          .select('id, name, pour_date, placement_order')
          .eq('user_id', user.id)
          .order('name');

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
              };
            })
            .filter((p) => (p as { stage?: string }).stage !== 'closed')
            .map(({ id, name, statusLabel }) => ({ id, name, statusLabel })),
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [user, isOwner, isEmployee]);

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${PLANNER_BOARD_BG}`}>
      <div className="border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900 sm:px-6">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Planner Hub</h1>
        <div className="mt-1 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
          <p className="text-sm text-gray-600 dark:text-slate-400">
            Open a project plan board to manage field tasks.
          </p>
          <PlannerRecordsQuickNav />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {loading && (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent" />
          </div>
        )}
        {!loading && projects.length === 0 && (
          <p className="text-sm text-gray-600 dark:text-slate-400">
            No active projects. Create a project plan to get started.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link
              key={p.id}
              to={plannerBoardHref(p.id)}
              onClick={() => {
                sessionStorage.setItem(LAST_PROJECT_KEY, p.id);
              }}
              className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-cyan-500/50 dark:border-slate-700 dark:bg-slate-800"
            >
              <FolderKanban className="h-8 w-8 shrink-0 text-cyan-600 dark:text-cyan-400" />
              <div className="min-w-0">
                <p className="truncate font-semibold text-gray-900 dark:text-white">{p.name}</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{p.statusLabel}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
