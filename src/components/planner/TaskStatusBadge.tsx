import React from 'react';
import type { TaskPriority, TaskStatus } from '../../types/fieldPlanner';
import {
  BADGE_BASE,
  BADGE_GREEN,
  BADGE_INFO,
  BADGE_NEUTRAL,
  BADGE_ORANGE,
  BADGE_SUCCESS,
  BADGE_WARNING,
} from '../../theme/statusColors';

const STATUS_STYLES: Record<TaskStatus, string> = {
  'Not Started': BADGE_NEUTRAL,
  'In Progress': BADGE_INFO,
  Submitted: BADGE_WARNING,
  'Needs Revision': BADGE_ORANGE,
  Approved: BADGE_SUCCESS,
  Completed: BADGE_GREEN,
};

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  Low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  Normal: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  High: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200',
  Urgent: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span className={`${BADGE_BASE} ${STATUS_STYLES[status]}`}>
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
