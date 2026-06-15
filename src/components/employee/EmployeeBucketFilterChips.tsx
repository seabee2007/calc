import React from 'react';
import type { PlannerTask } from '../../types/fieldPlanner';

export type EmployeeBucketFilter =
  | 'all'
  | 'not_started'
  | 'in_progress'
  | 'blocked'
  | 'ready_for_review'
  | 'complete';

const BUCKET_CHIPS: { id: EmployeeBucketFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'not_started', label: 'Not Started' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'blocked', label: 'Blocked' },
  { id: 'ready_for_review', label: 'Ready for Review' },
  { id: 'complete', label: 'Complete' },
];

export function filterTasksByBucket(tasks: PlannerTask[], bucket: EmployeeBucketFilter): PlannerTask[] {
  switch (bucket) {
    case 'not_started':
      return tasks.filter((t) => t.status === 'Not Started');
    case 'in_progress':
      return tasks.filter((t) => t.status === 'In Progress');
    case 'blocked':
      return tasks.filter((t) => t.status === 'Needs Revision');
    case 'ready_for_review':
      return tasks.filter((t) => t.status === 'Submitted');
    case 'complete':
      return tasks.filter((t) => t.status === 'Completed' || t.status === 'Approved');
    default:
      return tasks;
  }
}

interface EmployeeBucketFilterChipsProps {
  value: EmployeeBucketFilter;
  onChange: (value: EmployeeBucketFilter) => void;
}

export default function EmployeeBucketFilterChips({
  value,
  onChange,
}: EmployeeBucketFilterChipsProps) {
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {BUCKET_CHIPS.map((chip) => (
        <button
          key={chip.id}
          type="button"
          onClick={() => onChange(chip.id)}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium touch-manipulation ${
            value === chip.id
              ? 'bg-cyan-500 text-slate-950'
              : 'border border-slate-700 bg-slate-900 text-slate-300'
          }`}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
