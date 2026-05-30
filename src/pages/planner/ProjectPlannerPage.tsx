import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ClipboardList, Download } from 'lucide-react';
import Button from '../../components/ui/Button';
import { exportPlannerBoardJson, exportPlannerTasksCsv } from '../../utils/plannerExport';
import { useAuth } from '../../hooks/useAuth';
import {
  ensurePlannerBoard,
  fetchPlannerBoardBundle,
} from '../../services/plannerService';
import { fetchTeamProfiles } from '../../services/profileService';
import type { PlannerBoardBundle, PlannerTask } from '../../types/fieldPlanner';
import type { Profile } from '../../types/fieldPlanner';
import PlannerBoard from '../../components/planner/PlannerBoard';
import TaskDetailDrawer from '../../components/planner/TaskDetailDrawer';
import {
  PLANNER_EYEBROW,
  PLANNER_HEADING,
  PLANNER_ICON_ACCENT,
  PLANNER_LINK,
  PLANNER_MUTED,
  PLANNER_SUBTITLE,
} from '../../components/planner/plannerTheme';
import { supabase } from '../../lib/supabase';

export default function ProjectPlannerPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isOwner, isEmployee } = useAuth();
  const [projectName, setProjectName] = useState('Project');
  const [bundle, setBundle] = useState<PlannerBoardBundle | null>(null);
  const [team, setTeam] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    searchParams.get('task'),
  );

  const load = useCallback(async () => {
    if (!projectId || !user) return;
    setLoading(true);
    try {
      const { data: project } = await supabase
        .from('projects')
        .select('name, user_id')
        .eq('id', projectId)
        .maybeSingle();

      if (project?.name) setProjectName(project.name as string);

      const ownerId = (project?.user_id as string) ?? user.id;
      await ensurePlannerBoard(projectId, ownerId);
      const b = await fetchPlannerBoardBundle(projectId);
      setBundle(b);

      if (isOwner) {
        const members = await fetchTeamProfiles(user.id);
        setTeam(members);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, user, isOwner]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const tid = searchParams.get('task');
    setSelectedTaskId(tid);
  }, [searchParams]);

  const openTask = (task: PlannerTask) => {
    setSelectedTaskId(task.id);
    setSearchParams({ task: task.id });
  };

  const closeTask = () => {
    setSelectedTaskId(null);
    setSearchParams({});
  };

  if (!projectId) {
    return <p className={`p-8 text-center ${PLANNER_MUTED}`}>Invalid project.</p>;
  }

  return (
    <div className="mx-auto max-w-[100vw] px-4 py-6 pb-28 md:pb-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link to={`/projects?project=${projectId}`} className={`mb-3 ${PLANNER_LINK}`}>
            <ArrowLeft className="h-4 w-4" />
            Back to project
          </Link>
          <p className={PLANNER_EYEBROW}>Field operations</p>
          <h1 className={`mt-1 flex items-center gap-2 ${PLANNER_HEADING}`}>
            <ClipboardList className={`h-7 w-7 ${PLANNER_ICON_ACCENT}`} />
            Field Planner
          </h1>
          <p className={`mt-1 ${PLANNER_SUBTITLE}`}>{projectName}</p>
        </div>
        {isOwner && bundle && (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              icon={<Download className="h-4 w-4" />}
              onClick={() => exportPlannerTasksCsv(bundle, projectName)}
            >
              Export CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              icon={<Download className="h-4 w-4" />}
              onClick={() => exportPlannerBoardJson(bundle, projectName)}
            >
              Export JSON
            </Button>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent dark:border-cyan-500" />
        </div>
      )}

      {!loading && bundle && user && (
        <PlannerBoard
          bundle={bundle}
          projectId={projectId}
          userId={user.id}
          isOwner={isOwner}
          team={team}
          onRefresh={() => void load()}
          onTaskClick={openTask}
        />
      )}

      {bundle && user && (
        <TaskDetailDrawer
          taskId={selectedTaskId}
          projectName={projectName}
          userId={user.id}
          isOwner={isOwner}
          isEmployee={isEmployee}
          team={team}
          buckets={bundle.buckets.map((b) => ({ id: b.id, title: b.title }))}
          onClose={closeTask}
          onUpdated={() => void load()}
        />
      )}
    </div>
  );
}
