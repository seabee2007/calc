import React from 'react';

const STATUS_STYLES: Record<string, string> = {
  Open: 'bg-blue-100/90 text-blue-800 ring-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:ring-blue-800/60',
  'Pending Response':
    'bg-amber-100/90 text-amber-900 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-800/60',
  Pending:
    'bg-amber-100/90 text-amber-900 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-800/60',
  Answered:
    'bg-emerald-100/90 text-emerald-900 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-800/60',
  Approved:
    'bg-emerald-100/90 text-emerald-900 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-800/60',
  Rejected:
    'bg-red-100/90 text-red-900 ring-red-200 dark:bg-red-900/30 dark:text-red-200 dark:ring-red-800/60',
  'Need More Information':
    'bg-amber-100/90 text-amber-900 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-800/60',
  'Needs More Information':
    'bg-amber-100/90 text-amber-900 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-800/60',
  'Requires Change Order':
    'bg-purple-100/90 text-purple-900 ring-purple-200 dark:bg-purple-900/30 dark:text-purple-200 dark:ring-purple-800/60',
  'Convert to Change Order':
    'bg-purple-100/90 text-purple-900 ring-purple-200 dark:bg-purple-900/30 dark:text-purple-200 dark:ring-purple-800/60',
  Closed:
    'bg-slate-100/90 text-slate-700 ring-slate-200 dark:bg-slate-800/60 dark:text-slate-200 dark:ring-slate-600',
  Draft:
    'bg-slate-100/90 text-slate-700 ring-slate-200 dark:bg-slate-800/60 dark:text-slate-200 dark:ring-slate-600',
  Sent:
    'bg-blue-100/90 text-blue-800 ring-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:ring-blue-800/60',
  Viewed:
    'bg-cyan-100/90 text-cyan-900 ring-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-200 dark:ring-cyan-800/60',
  Accepted:
    'bg-emerald-100/90 text-emerald-900 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-800/60',
  Declined:
    'bg-red-100/90 text-red-900 ring-red-200 dark:bg-red-900/30 dark:text-red-200 dark:ring-red-800/60',
};

const DEFAULT_STYLE =
  'bg-slate-100/90 text-slate-700 ring-slate-200 dark:bg-slate-800/60 dark:text-slate-200 dark:ring-slate-600';

export default function FieldRecordStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${
        STATUS_STYLES[status] ?? DEFAULT_STYLE
      }`}
    >
      {status}
    </span>
  );
}
