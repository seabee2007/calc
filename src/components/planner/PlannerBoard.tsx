import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import type { PlannerBoardBundle, PlannerTask } from '../../types/fieldPlanner';
import type { Profile } from '../../types/fieldPlanner';
import PlannerBucketColumn from './PlannerBucket';
import AddBucketModal from './AddBucketModal';
import AddTaskModal from './AddTaskModal';
import { createBucket, createTask } from '../../services/plannerService';
import Button from '../ui/Button';
import { PLANNER_BOARD_SURFACE, PLANNER_BTN_OUTLINE_DASHED } from './plannerTheme';

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
      <div className={`flex gap-4 overflow-x-auto pb-4 ${PLANNER_BOARD_SURFACE}`}>
        {bundle.buckets.map((bucket) => (
          <PlannerBucketColumn
            key={bucket.id}
            bucket={bucket}
            tasks={bundle.tasks}
            isOwner={isOwner}
            onTaskClick={onTaskClick}
            onAddTask={(id) => setAddTaskBucketId(id)}
          />
        ))}

        {isOwner && (
          <div className="flex w-[200px] shrink-0 items-start pt-2">
            <Button
              variant="outline"
              className={PLANNER_BTN_OUTLINE_DASHED}
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setAddBucketOpen(true)}
            >
              Add bucket
            </Button>
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
    </>
  );
}
