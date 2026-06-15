import React from 'react';

export type EmployeePlannerStatFilter =
  | 'dueToday'
  | 'inProgress'
  | 'blocked'
  | 'readyForReview';

interface StatCardProps {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}

function StatCard({ label, count, active, onClick }: StatCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[72px] rounded-2xl border p-4 text-left touch-manipulation transition-colors ${
        active
          ? 'border-cyan-400/50 bg-cyan-500/10'
          : 'border-slate-800 bg-slate-900/70 hover:border-slate-700'
      }`}
    >
      <p className="text-2xl font-bold text-white">{count}</p>
      <p className="mt-1 text-xs font-medium text-slate-400">{label}</p>
    </button>
  );
}

interface EmployeePlannerStatsProps {
  dueToday: number;
  inProgress: number;
  blocked: number;
  readyForReview: number;
  activeFilter: EmployeePlannerStatFilter | null;
  onFilterSelect: (filter: EmployeePlannerStatFilter) => void;
}

export default function EmployeePlannerStats({
  dueToday,
  inProgress,
  blocked,
  readyForReview,
  activeFilter,
  onFilterSelect,
}: EmployeePlannerStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <StatCard
        label="Due today"
        count={dueToday}
        active={activeFilter === 'dueToday'}
        onClick={() => onFilterSelect('dueToday')}
      />
      <StatCard
        label="In progress"
        count={inProgress}
        active={activeFilter === 'inProgress'}
        onClick={() => onFilterSelect('inProgress')}
      />
      <StatCard
        label="Blocked"
        count={blocked}
        active={activeFilter === 'blocked'}
        onClick={() => onFilterSelect('blocked')}
      />
      <StatCard
        label="Ready for review"
        count={readyForReview}
        active={activeFilter === 'readyForReview'}
        onClick={() => onFilterSelect('readyForReview')}
      />
    </div>
  );
}
