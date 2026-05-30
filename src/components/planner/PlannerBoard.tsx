import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import type { PlannerBoardBundle, PlannerTask } from '../../types/fieldPlanner';
import type { Profile } from '../../types/fieldPlanner';
import PlannerBucketColumn from './PlannerBucket';
import AddBucketModal from './AddBucketModal';
import AddTaskModal from './AddTaskModal';
import CreateRfiModal from '../field/CreateRfiModal';
import CreateFieldAdjustmentModal from '../field/CreateFieldAdjustmentModal';
import { createBucket, createTask } from '../../services/plannerService';
import { PLANNER_BOARD_BG } from './plannerTheme';

interface PlannerBoardProps {
  bundle: PlannerBoardBundle;
  projectId: string;
  userId: string;
  isOwner: boolean;
  team: Profile[];
  onRefresh: () => void;
  onTaskClick: (task: PlannerTask) => void;
}

export default function PlannerBoard({
  bundle,
  projectId,
  userId,
  isOwner,
  team,
  onRefresh,
  onTaskClick,
}: PlannerBoardProps) {
  const [addBucketOpen, setAddBucketOpen] = useState(false);
  const [addTaskBucketId, setAddTaskBucketId] = useState<string | null>(null);
  const [rfiTask, setRfiTask] = useState<PlannerTask | null>(null);
  const [adjTask, setAdjTask] = useState<PlannerTask | null>(null);

  const bucketMeta = bundle.buckets.map((b) => ({ id: b.id, title: b.title }));

  const handleAddBucket = async (title: string) => {
    await createBucket(bundle.board.id, title, bundle.buckets.length);
    onRefresh();
  };

  const handleAddTask = async (data: {
    title: string;
    description?: string;
    assignedTo?: string | null;
    priority: import('../../types/fieldPlanner').TaskPriority;
    dueDate?: string | null;
  }) => {
    if (!addTaskBucketId) return;
    await createTask({
      boardId: bundle.board.id,
      bucketId: addTaskBucketId,
      projectId,
      title: data.title,
      description: data.description,
      assignedTo: data.assignedTo,
      createdBy: userId,
      priority: data.priority,
      dueDate: data.dueDate,
    });
    onRefresh();
  };

  return (
    <>
      <div className={`flex min-h-0 flex-1 overflow-x-auto px-4 py-4 ${PLANNER_BOARD_BG}`}>
        {bundle.buckets.map((bucket) => (
          <PlannerBucketColumn
            key={bucket.id}
            bucket={bucket}
            tasks={bundle.tasks}
            buckets={bucketMeta}
            isOwner={isOwner}
            onTaskClick={onTaskClick}
            onAddTask={(id) => setAddTaskBucketId(id)}
            onRefresh={onRefresh}
            onCreateRfi={setRfiTask}
            onCreateAdjustment={setAdjTask}
          />
        ))}

        {isOwner && (
          <div className="flex w-[300px] shrink-0 items-start pt-8">
            <button
              type="button"
              onClick={() => setAddBucketOpen(true)}
              className="flex h-9 w-full items-center justify-center gap-1 rounded border border-dashed border-slate-300 text-sm text-gray-600 hover:bg-white/80 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-900/50"
            >
              <Plus className="h-4 w-4" />
              Add bucket
            </button>
          </div>
        )}
      </div>

      <AddBucketModal
        isOpen={addBucketOpen}
        onClose={() => setAddBucketOpen(false)}
        onSubmit={handleAddBucket}
      />

      <AddTaskModal
        isOpen={Boolean(addTaskBucketId)}
        onClose={() => setAddTaskBucketId(null)}
        team={team}
        onSubmit={handleAddTask}
      />

      {rfiTask && (
        <CreateRfiModal
          isOpen
          onClose={() => setRfiTask(null)}
          projectId={projectId}
          taskId={rfiTask.id}
          userId={userId}
          onCreated={() => {
            setRfiTask(null);
            onRefresh();
          }}
        />
      )}

      {adjTask && (
        <CreateFieldAdjustmentModal
          isOpen
          onClose={() => setAdjTask(null)}
          projectId={projectId}
          taskId={adjTask.id}
          userId={userId}
          onCreated={() => {
            setAdjTask(null);
            onRefresh();
          }}
        />
      )}
    </>
  );
}
