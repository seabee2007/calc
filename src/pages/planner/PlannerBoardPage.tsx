import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePlannerProject } from '../../contexts/PlannerProjectContext';
import PlannerBoard from '../../components/planner/PlannerBoard';
import TaskDetailDrawer from '../../components/planner/TaskDetailDrawer';
import CreateRfiModal from '../../components/field/CreateRfiModal';
import CreateFieldAdjustmentModal from '../../components/field/CreateFieldAdjustmentModal';
import type { PlannerTask } from '../../types/fieldPlanner';
import { PLANNER_BOARD_BG } from '../../components/planner/plannerTheme';

interface FieldRecordContext {
  taskId: string;
  projectId: string;
}

type PendingFieldModal =
  | { type: 'rfi'; taskId: string; projectId: string }
  | { type: 'far'; taskId: string; projectId: string };

export default function PlannerBoardPage() {
  const { user, isEmployee } = useAuth();
  const { projectId, project, bundle, team, loading, reload, isOwner } = usePlannerProject();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(searchParams.get('task'));
  const [rfiContext, setRfiContext] = useState<FieldRecordContext | null>(null);
  const [farContext, setFarContext] = useState<FieldRecordContext | null>(null);
  const [pendingFieldModal, setPendingFieldModal] = useState<PendingFieldModal | null>(null);
  const pendingFieldModalRef = useRef(pendingFieldModal);
  pendingFieldModalRef.current = pendingFieldModal;

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
        onRequestCreateRfi={(taskId, projectId) => {
          setPendingFieldModal({ type: 'rfi', taskId, projectId });
          closeTask();
        }}
        onRequestCreateFar={(taskId, projectId) => {
          setPendingFieldModal({ type: 'far', taskId, projectId });
          closeTask();
        }}
        onExitComplete={() => {
          const pending = pendingFieldModalRef.current;
          if (!pending) return;
          const ctx = { taskId: pending.taskId, projectId: pending.projectId };
          if (pending.type === 'rfi') {
            setRfiContext(ctx);
          } else {
            setFarContext(ctx);
          }
          setPendingFieldModal(null);
        }}
      />

      <CreateRfiModal
        isOpen={rfiContext !== null}
        onClose={() => setRfiContext(null)}
        projectId={rfiContext?.projectId ?? projectId}
        taskId={rfiContext?.taskId}
        userId={user.id}
        onCreated={() => {
          setRfiContext(null);
          void reload();
        }}
      />

      <CreateFieldAdjustmentModal
        isOpen={farContext !== null}
        onClose={() => setFarContext(null)}
        projectId={farContext?.projectId ?? projectId}
        taskId={farContext?.taskId}
        userId={user.id}
        onCreated={() => {
          setFarContext(null);
          void reload();
        }}
      />
    </div>
  );
}
