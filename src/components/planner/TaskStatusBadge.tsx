import React from 'react';
import type { TaskPriority, TaskStatus } from '../../types/fieldPlanner';

const STATUS_STYLES: Record<TaskStatus, string> = {
  'Not Started':
    'bg-slate-100/90 text-slate-700 ring-slate-200 dark:bg-slate-800/60 dark:text-slate-200 dark:ring-slate-600',
  'In Progress':
    'bg-blue-100/90 text-blue-800 ring-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:ring-blue-800/60',
  Submitted:
    'bg-amber-100/90 text-amber-900 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-800/60',
  'Needs Revision':
    'bg-orange-100/90 text-orange-900 ring-orange-200 dark:bg-orange-900/30 dark:text-orange-200 dark:ring-orange-800/60',
  Approved:
    'bg-emerald-100/90 text-emerald-900 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-800/60',
  Completed:
    'bg-green-100/90 text-green-900 ring-green-200 dark:bg-green-900/30 dark:text-green-200 dark:ring-green-800/60',
};

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  Low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  Normal: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  High: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200',
  Urgent: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

export function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[priority]}`}
    >
      {priority}
    </span>
  );
}
