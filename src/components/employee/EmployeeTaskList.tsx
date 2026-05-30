import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { PlannerTask } from '../../types/fieldPlanner';
import { plannerBoardHref } from '../../utils/plannerRoutes';
import { TaskPriorityBadge, TaskStatusBadge } from '../planner/TaskStatusBadge';

interface EmployeeTaskListProps {
  tasks: PlannerTask[];
  filter?: 'today' | 'overdue' | 'all';
}

function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isOverdue(dateStr: string | null, status: string): boolean {
  if (!dateStr || status === 'Completed' || status === 'Approved') return false;
  return new Date(dateStr) < new Date(new Date().toDateString());
}

export default function EmployeeTaskList({ tasks, filter = 'all' }: EmployeeTaskListProps) {
  const navigate = useNavigate();

  const filtered = tasks.filter((t) => {
    if (filter === 'today') return isToday(t.dueDate) || t.status === 'In Progress';
    if (filter === 'overdue') return isOverdue(t.dueDate, t.status);
    return true;
  });

  if (filtered.length === 0) {
    return <p className="text-sm text-slate-500 py-4">No tasks in this view.</p>;
  }

  return (
    <ul className="space-y-2">
      {filtered.map((task) => (
        <li key={task.id}>
          <button
            type="button"
            onClick={() => navigate(plannerBoardHref(task.projectId, task.id))}
            className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-cyan-500/50 dark:border-slate-700 dark:bg-slate-900"
          >
            <p className="font-medium text-gray-900 dark:text-white">{task.title}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              <TaskStatusBadge status={task.status} />
              <TaskPriorityBadge priority={task.priority} />
            </div>
            {task.dueDate && (
              <p className="mt-2 text-xs text-slate-400">
                Due {new Date(task.dueDate).toLocaleDateString()}
              </p>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
