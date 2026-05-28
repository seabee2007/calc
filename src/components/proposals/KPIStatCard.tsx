import React from 'react';

export default function KPIStatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200/70 bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/60">
      <div className="text-xs font-semibold tracking-wide text-slate-600 dark:text-gray-400">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
        {value}
      </div>
      {hint ? (
        <div className="mt-1 text-xs text-slate-500 dark:text-gray-400">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

