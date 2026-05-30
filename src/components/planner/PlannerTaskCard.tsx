import React from 'react';
import { Calendar, MessageSquare, Paperclip, User } from 'lucide-react';
import type { PlannerTask } from '../../types/fieldPlanner';
import { TaskPriorityBadge, TaskStatusBadge } from './TaskStatusBadge';
import {
  PLANNER_TASK_ACCENT,
  PLANNER_TASK_CARD,
  PLANNER_TASK_META,
  PLANNER_TASK_META_MUTED,
  PLANNER_TASK_TITLE,
} from './plannerTheme';

interface PlannerTaskCardProps {
  task: PlannerTask;
  onClick: () => void;
}

export default function PlannerTaskCard({ task, onClick }: PlannerTaskCardProps) {
  const checklistPct =
    task.checklistTotal && task.checklistTotal > 0
      ? Math.round(((task.checklistDone ?? 0) / task.checklistTotal) * 100)
      : null;

  return (
    <button type="button" onClick={onClick} className={PLANNER_TASK_CARD}>
      <p className={PLANNER_TASK_TITLE}>{task.title}</p>

      <div className="mt-2 flex flex-wrap gap-1">
        <TaskStatusBadge status={task.status} />
        <TaskPriorityBadge priority={task.priority} />
      </div>

      {task.assigneeName && (
        <p className={`mt-2 flex items-center gap-1 ${PLANNER_TASK_META}`}>
          <User className="h-3.5 w-3.5" />
          {task.assigneeName}
        </p>
      )}

      {task.dueDate && (
        <p className={`mt-1 flex items-center gap-1 ${PLANNER_TASK_META}`}>
          <Calendar className="h-3.5 w-3.5" />
          Due {new Date(task.dueDate).toLocaleDateString()}
        </p>
      )}

      <div className={`mt-2 flex items-center gap-3 ${PLANNER_TASK_META_MUTED}`}>
        {(task.commentCount ?? 0) > 0 && (
          <span className="flex items-center gap-0.5">
            <MessageSquare className="h-3.5 w-3.5" />
            {task.commentCount}
          </span>
        )}
        {(task.attachmentCount ?? 0) > 0 && (
          <span className="flex items-center gap-0.5">
            <Paperclip className="h-3.5 w-3.5" />
            {task.attachmentCount}
          </span>
        )}
        {checklistPct !== null && (
          <span className={PLANNER_TASK_ACCENT}>Checklist {checklistPct}%</span>
        )}
      </div>
    </button>
  );
}
