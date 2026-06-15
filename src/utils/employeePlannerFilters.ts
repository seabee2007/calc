import type { PlannerTask } from '../types/fieldPlanner';

export type EmployeePlannerChipFilter =
  | 'today'
  | 'assigned'
  | 'overdue'
  | 'blocked'
  | 'completed';

export function isTaskDueToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function isTaskOverdue(dateStr: string | null, status: string): boolean {
  if (!dateStr || status === 'Completed' || status === 'Approved') return false;
  return new Date(dateStr) < new Date(new Date().toDateString());
}

export function countDueToday(tasks: PlannerTask[]): number {
  return tasks.filter(
    (t) =>
      isTaskDueToday(t.dueDate) &&
      t.status !== 'Completed' &&
      t.status !== 'Approved',
  ).length;
}

export function countInProgress(tasks: PlannerTask[]): number {
  return tasks.filter((t) => t.status === 'In Progress').length;
}

export function countBlocked(tasks: PlannerTask[]): number {
  return tasks.filter((t) => t.status === 'Needs Revision').length;
}

export function countReadyForReview(tasks: PlannerTask[]): number {
  return tasks.filter((t) => t.status === 'Submitted').length;
}

export function filterEmployeePlannerTasks(
  tasks: PlannerTask[],
  chip: EmployeePlannerChipFilter,
): PlannerTask[] {
  switch (chip) {
    case 'today':
      return tasks.filter(
        (t) =>
          isTaskDueToday(t.dueDate) ||
          t.status === 'In Progress' ||
          (isTaskOverdue(t.dueDate, t.status) &&
            t.status !== 'Completed' &&
            t.status !== 'Approved'),
      );
    case 'assigned':
      return tasks.filter(
        (t) => t.status !== 'Completed' && t.status !== 'Approved',
      );
    case 'overdue':
      return tasks.filter((t) => isTaskOverdue(t.dueDate, t.status));
    case 'blocked':
      return tasks.filter((t) => t.status === 'Needs Revision');
    case 'completed':
      return tasks.filter(
        (t) => t.status === 'Completed' || t.status === 'Approved',
      );
    default:
      return tasks;
  }
}

export function statFilterToChip(
  stat: 'dueToday' | 'inProgress' | 'blocked' | 'readyForReview',
): EmployeePlannerChipFilter {
  switch (stat) {
    case 'dueToday':
      return 'today';
    case 'inProgress':
      return 'assigned';
    case 'blocked':
      return 'blocked';
    case 'readyForReview':
      return 'assigned';
    default:
      return 'assigned';
  }
}