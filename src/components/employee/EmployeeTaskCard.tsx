import React from 'react';
import { Camera, ChevronRight, AlertTriangle } from 'lucide-react';
import type { PlannerTask } from '../../types/fieldPlanner';
import { TaskPriorityBadge, TaskStatusBadge } from '../planner/TaskStatusBadge';
import Button from '../ui/Button';

interface EmployeeTaskCardProps {
  task: PlannerTask;
  projectName: string;
  onOpen: () => void;
  onUploadPhoto: () => void;
  onReportIssue: () => void;
}

function formatDueDate(dateStr: string | null): string {
  if (!dateStr) return 'No due date';
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export default function EmployeeTaskCard({
  task,
  projectName,
  onOpen,
  onUploadPhoto,
  onReportIssue,
}: EmployeeTaskCardProps) {
  const checklistDone = task.checklistDone ?? 0;
  const checklistTotal = task.checklistTotal ?? 0;
  const photoCount = task.attachmentCount ?? 0;

  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg">
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left touch-manipulation"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-100">{task.title}</p>
            <p className="mt-1 text-xs text-slate-400">
              {projectName} · Due {formatDueDate(task.dueDate)}
            </p>
          </div>
          <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <TaskStatusBadge status={task.status} />
          <TaskPriorityBadge priority={task.priority} />
        </div>

        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">
          {checklistTotal > 0 ? (
            <span>
              Checklist: {checklistDone}/{checklistTotal}
            </span>
          ) : (
            <span>Checklist: 0/0</span>
          )}
          <span>Photos: {photoCount}</span>
        </div>
      </button>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Button
          type="button"
          variant="accent"
          size="sm"
          fullWidth
          className="min-h-[44px]"
          onClick={onOpen}
        >
          {task.status === 'Not Started' ? 'Start task' : 'View details'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          fullWidth
          className="min-h-[44px]"
          icon={<Camera className="h-4 w-4" />}
          onClick={onUploadPhoto}
        >
          Upload photo
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          fullWidth
          className="min-h-[44px]"
          icon={<AlertTriangle className="h-4 w-4" />}
          onClick={onReportIssue}
        >
          Report issue
        </Button>
      </div>
    </article>
  );
}
