import React from 'react';
import {
  PROPOSAL_STATUS_LABELS,
  type ProposalStatus,
} from '../../types/proposalTracking';

const STATUS_STYLES: Record<ProposalStatus, string> = {
  draft:
    'bg-slate-100/90 text-slate-800 ring-slate-200 dark:bg-slate-800/60 dark:text-slate-200 dark:ring-slate-700',
  sent:
    'bg-blue-100/90 text-blue-800 ring-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:ring-blue-800/60',
  viewed:
    'bg-amber-100/90 text-amber-900 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-800/60',
  opened:
    'bg-amber-100/90 text-amber-900 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-800/60',
  accepted:
    'bg-emerald-100/90 text-emerald-900 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-800/60',
  declined:
    'bg-red-100/90 text-red-900 ring-red-200 dark:bg-red-900/30 dark:text-red-200 dark:ring-red-800/60',
  deposit_paid:
    'bg-teal-100/90 text-teal-900 ring-teal-200 dark:bg-teal-900/30 dark:text-teal-200 dark:ring-teal-800/60',
  scheduled:
    'bg-purple-100/90 text-purple-900 ring-purple-200 dark:bg-purple-900/30 dark:text-purple-200 dark:ring-purple-800/60',
};

export default function ProposalStatusBadge({
  status,
  className = '',
}: {
  status: ProposalStatus;
  className?: string;
}) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
        STATUS_STYLES[status],
        className,
      ].join(' ')}
    >
      {PROPOSAL_STATUS_LABELS[status]}
    </span>
  );
}

