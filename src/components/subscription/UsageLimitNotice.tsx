import { Link } from 'react-router-dom';
import type { UsageLimitError } from './usageMetering';
import { buildUsageLimitPresentation } from '../../lib/usageLimitUx';

export interface UsageLimitNoticeProps {
  error: UsageLimitError;
  className?: string;
}

export function UsageLimitNotice({ error, className = '' }: UsageLimitNoticeProps) {
  const presentation = buildUsageLimitPresentation(error);

  return (
    <div
      className={`rounded-xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900/50 dark:bg-amber-950/30 ${className}`}
      data-testid="usage-limit-notice"
    >
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{presentation.title}</p>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{presentation.message}</p>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        {presentation.quotaLabel} · {presentation.resetLabel}
      </p>
      {presentation.upgradeUrl ? (
        <Link
          to={presentation.upgradeUrl}
          className="mt-3 inline-flex text-sm font-medium text-cyan-700 underline hover:text-cyan-800 dark:text-cyan-300"
          data-testid="usage-limit-upgrade-link"
        >
          {presentation.upgradeLabel}
        </Link>
      ) : null}
    </div>
  );
}
