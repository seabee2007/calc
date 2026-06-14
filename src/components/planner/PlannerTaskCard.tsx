import React from 'react';
import {
  Calendar,
  CheckSquare,
  ClipboardList,
  FileText,
  MessageSquare,
  Paperclip,
  Wrench,
} from 'lucide-react';
import type { PlannerTask, TaskPriority } from '../../types/fieldPlanner';
import UserAvatar from './UserAvatar';
import TaskCardMenu from './TaskCardMenu';
import { PLANNER_TASK_CARD, PLANNER_TASK_CARD_COMPLETED, PLANNER_TASK_TITLE } from './plannerTheme';

const PRIORITY_STRIP: Record<TaskPriority, string> = {
  Low: 'bg-slate-400',
  Normal: 'bg-blue-500',
  High: 'bg-orange-500',
  Urgent: 'bg-red-500',
};

function isCompletedStatus(status: string): boolean {
  return status === 'Completed' || status === 'Approved';
}

interface PlannerTaskCardProps {
  task: PlannerTask;
  isOwner: boolean;
  buckets: { id: string; title: string }[];
  onClick: () => void;
  onRefresh: () => void;
  onCreateRfi: () => void;
  onCreateAdjustment: () => void;
}

export default function PlannerTaskCard({
  task,
  isOwner,
  buckets,
  onClick,
  onRefresh,
  onCreateRfi,
  onCreateAdjustment,
}: PlannerTaskCardProps) {
  const completed = isCompletedStatus(task.status);
  const checklistTotal = task.checklistTotal ?? 0;
  const checklistDone = task.checklistDone ?? 0;

  return (
    <div
      className={`group relative ${PLANNER_TASK_CARD} ${completed ? PLANNER_TASK_CARD_COMPLETED : ''}`}
    >
      <div
        className={`absolute bottom-0 right-0 top-0 w-[3px] ${PRIORITY_STRIP[task.priority]}`}
        aria-hidden
      />

      <TaskCardMenu
        task={task}
        isOwner={isOwner}
        buckets={buckets}
        onOpen={onClick}
        onRefresh={onRefresh}
        onCreateRfi={onCreateRfi}
        onCreateAdjustment={onCreateAdjustment}
      />

      <button type="button" onClick={onClick} className="block w-full pr-4 text-left">
        <p className={`${PLANNER_TASK_TITLE} text-sm`}>{task.title}</p>

        {task.previewImageUrl && (
          <img
            src={task.previewImageUrl}
            alt=""
            className="mt-2 h-12 w-full rounded object-cover"
          />
        )}

        {(task.checklistPreview?.length ?? 0) > 0 && (
          <ul className="mt-2 space-y-0.5">
            {task.checklistPreview!.map((item, i) => (
              <li key={i} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-slate-400">
                <CheckSquare className="h-3 w-3 shrink-0" />
                <span className="truncate">{item.title}</span>
              </li>
            ))}
          </ul>
        )}

        {(task.linkedCalculationId ||
          task.linkedQcRecordId ||
          (task.rfiCount ?? 0) > 0 ||
          (task.adjustmentCount ?? 0) > 0) && (
          <div className="mt-2 flex flex-wrap gap-1">
            {task.linkedCalculationId && (
              <span className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-700 dark:bg-slate-700 dark:text-slate-200">
                <ClipboardList className="h-3 w-3" />
                Calc
              </span>
            )}
            {task.linkedQcRecordId && (
              <span className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-700 dark:bg-slate-700 dark:text-slate-200">
                <FileText className="h-3 w-3" />
                QC
              </span>
            )}
            {(task.rfiCount ?? 0) > 0 && (
              <span className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                RFI {task.rfiCount}
              </span>
            )}
            {(task.adjustmentCount ?? 0) > 0 && (
              <span className="inline-flex items-center gap-0.5 rounded bg-orange-50 px-1.5 py-0.5 text-[10px] font-medium text-orange-900 dark:bg-orange-950/50 dark:text-orange-200">
                <Wrench className="h-3 w-3" />
                Adj
              </span>
            )}
          </div>
        )}

        <div className="mt-2 flex items-end justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
            {task.dueDate && (
              <span className="flex items-center gap-0.5">
                <Calendar className="h-3 w-3" />
                {new Date(task.dueDate).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            )}
            {(task.commentCount ?? 0) > 0 && (
              <span className="flex items-center gap-0.5">
                <MessageSquare className="h-3 w-3" />
                {task.commentCount}
              </span>
            )}
            {(task.attachmentCount ?? 0) > 0 && (
              <span className="flex items-center gap-0.5">
                <Paperclip className="h-3 w-3" />
                {task.attachmentCount}
              </span>
            )}
            {checklistTotal > 0 && (
              <span className="flex items-center gap-0.5">
                <CheckSquare className="h-3 w-3" />
                {checklistDone}/{checklistTotal}
              </span>
            )}
          </div>
          {(task.assigneeNames?.length ?? 0) > 0 && (
            <div
              className="flex -space-x-1.5 shrink-0"
              title={task.assigneeName ?? undefined}
            >
              {(task.assignedToIds ?? []).slice(0, 3).map((id, index) => (
                <UserAvatar
                  key={id}
                  name={task.assigneeNames?.[index] ?? 'Assignee'}
                  className="ring-2 ring-white dark:ring-slate-900"
                />
              ))}
              {(task.assignedToIds?.length ?? 0) > 3 && (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-700 ring-2 ring-white dark:bg-slate-700 dark:text-slate-200 dark:ring-slate-900">
                  +{(task.assignedToIds?.length ?? 0) - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </button>
    </div>
  );
}
