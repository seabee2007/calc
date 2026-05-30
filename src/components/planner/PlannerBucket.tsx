import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import type { PlannerBucket as Bucket, PlannerTask } from '../../types/fieldPlanner';
import PlannerTaskCard from './PlannerTaskCard';
import {
  PLANNER_ADD_TASK_BAR,
  PLANNER_BUCKET_COLUMN,
  PLANNER_BUCKET_TITLE,
} from './plannerTheme';

function isCompletedTask(task: PlannerTask): boolean {
  return task.status === 'Completed' || task.status === 'Approved';
}

interface PlannerBucketProps {
  bucket: Bucket;
  tasks: PlannerTask[];
  buckets: { id: string; title: string }[];
  isOwner: boolean;
  onTaskClick: (task: PlannerTask) => void;
  onAddTask: (bucketId: string) => void;
  onRefresh: () => void;
  onCreateRfi: (task: PlannerTask) => void;
  onCreateAdjustment: (task: PlannerTask) => void;
}

export default function PlannerBucketColumn({
  bucket,
  tasks,
  buckets,
  isOwner,
  onTaskClick,
  onAddTask,
  onRefresh,
  onCreateRfi,
  onCreateAdjustment,
}: PlannerBucketProps) {
  const [showCompleted, setShowCompleted] = useState(false);

  const bucketTasks = tasks
    .filter((t) => t.bucketId === bucket.id)
    .sort((a, b) => a.position - b.position);

  const activeTasks = bucketTasks.filter((t) => !isCompletedTask(t));
  const completedTasks = bucketTasks.filter((t) => isCompletedTask(t));

  return (
    <div className={PLANNER_BUCKET_COLUMN}>
      <h3 className={`mb-2 ${PLANNER_BUCKET_TITLE}`}>{bucket.title}</h3>

      {isOwner && (
        <button
          type="button"
          onClick={() => onAddTask(bucket.id)}
          className={PLANNER_ADD_TASK_BAR}
          aria-label="Add task"
        >
          <Plus className="h-4 w-4" />
        </button>
      )}

      <div className="flex flex-col gap-2 overflow-y-auto max-h-[calc(100dvh-240px)] pb-4">
        {activeTasks.map((task) => (
          <PlannerTaskCard
            key={task.id}
            task={task}
            isOwner={isOwner}
            buckets={buckets}
            onClick={() => onTaskClick(task)}
            onRefresh={onRefresh}
            onCreateRfi={() => onCreateRfi(task)}
            onCreateAdjustment={() => onCreateAdjustment(task)}
          />
        ))}

        {completedTasks.length > 0 && (
          <div className="mt-1">
            <button
              type="button"
              onClick={() => setShowCompleted((s) => !s)}
              className="text-xs font-medium text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200"
            >
              {showCompleted
                ? 'Hide completed'
                : `Show completed (${completedTasks.length})`}
            </button>
            {showCompleted &&
              completedTasks.map((task) => (
                <div key={task.id} className="mt-2">
                  <PlannerTaskCard
                    task={task}
                    isOwner={isOwner}
                    buckets={buckets}
                    onClick={() => onTaskClick(task)}
                    onRefresh={onRefresh}
                    onCreateRfi={() => onCreateRfi(task)}
                    onCreateAdjustment={() => onCreateAdjustment(task)}
                  />
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
