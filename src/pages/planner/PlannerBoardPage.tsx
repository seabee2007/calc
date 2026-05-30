import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePlannerProject } from '../../contexts/PlannerProjectContext';
import PlannerBoard from '../../components/planner/PlannerBoard';
import TaskDetailDrawer from '../../components/planner/TaskDetailDrawer';
import type { PlannerTask } from '../../types/fieldPlanner';
import { PLANNER_BOARD_BG } from '../../components/planner/plannerTheme';

export default function PlannerBoardPage() {
  const { user, isEmployee } = useAuth();
  const { projectId, project, bundle, team, loading, reload, isOwner } = usePlannerProject();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(searchParams.get('task'));

  useEffect(() => {
    setSelectedTaskId(searchParams.get('task'));
  }, [searchParams]);

  const openTask = (task: PlannerTask) => {
    setSelectedTaskId(task.id);
    setSearchParams({ task: task.id });
  };

  const closeTask = () => {
    setSelectedTaskId(null);
    setSearchParams({});
  };

  if (loading || !bundle || !user) {
    return (
      <div className={`flex flex-1 items-center justify-center py-16 ${PLANNER_BOARD_BG}`}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${PLANNER_BOARD_BG}`}>
      <PlannerBoard
        bundle={bundle}
        projectId={projectId}
        userId={user.id}
        isOwner={isOwner}
        team={team}
        onRefresh={() => void reload()}
        onTaskClick={openTask}
      />

      <TaskDetailDrawer
        taskId={selectedTaskId}
        projectName={project?.name ?? 'Project'}
        userId={user.id}
        isOwner={isOwner}
        isEmployee={isEmployee}
        team={team}
        buckets={bundle.buckets.map((b) => ({ id: b.id, title: b.title }))}
        onClose={closeTask}
        onUpdated={() => void reload()}
        fullPage={typeof window !== 'undefined' && window.innerWidth < 768}
      />
    </div>
  );
}
