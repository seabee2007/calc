import React from 'react';

interface ChecklistProgressBarProps {
  done: number;
  total: number;
}

export default function ChecklistProgressBar({ done, total }: ChecklistProgressBarProps) {
  if (total <= 0) return null;
  const pct = Math.min(100, Math.round((done / total) * 100));

  return (
    <div className="mt-2">
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className="h-full rounded-full bg-cyan-600 transition-all dark:bg-cyan-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
        {done} / {total} Complete
      </p>
    </div>
  );
}
