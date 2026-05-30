import React from 'react';
import { Plus } from 'lucide-react';
import type { PlannerBucket as Bucket, PlannerTask } from '../../types/fieldPlanner';
import PlannerTaskCard from './PlannerTaskCard';
import Button from '../ui/Button';
import {
  PLANNER_BUCKET,
  PLANNER_BUCKET_FOOTER,
  PLANNER_BUCKET_HEADER,
  PLANNER_BUCKET_META,
  PLANNER_BUCKET_TITLE,
  PLANNER_BTN_GHOST,
} from './plannerTheme';

interface PlannerBucketProps {
  bucket: Bucket;
  tasks: PlannerTask[];
  isOwner: boolean;
  onTaskClick: (task: PlannerTask) => void;
  onAddTask: (bucketId: string) => void;
}

export default function PlannerBucketColumn({
  bucket,
  tasks,
  isOwner,
  onTaskClick,
  onAddTask,
}: PlannerBucketProps) {
  const bucketTasks = tasks
    .filter((t) => t.bucketId === bucket.id)
    .sort((a, b) => a.position - b.position);

  return (
    <div className={PLANNER_BUCKET}>
      <div className={PLANNER_BUCKET_HEADER}>
        <h3 className={PLANNER_BUCKET_TITLE}>{bucket.title}</h3>
        <p className={PLANNER_BUCKET_META}>{bucketTasks.length} tasks</p>
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2 max-h-[calc(100vh-280px)]">
        {bucketTasks.map((task) => (
          <PlannerTaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
        ))}
      </div>

      {isOwner && (
        <div className={PLANNER_BUCKET_FOOTER}>
          <Button
            variant="ghost"
            size="sm"
            className={PLANNER_BTN_GHOST}
            icon={<Plus className="h-4 w-4" />}
            onClick={() => onAddTask(bucket.id)}
          >
            Add task
          </Button>
        </div>
      )}
    </div>
  );
}
