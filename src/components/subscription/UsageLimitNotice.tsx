import { Link } from 'react-router-dom';
import type { UsageLimitError } from '../../lib/usageMetering';
import { buildBillingBuyCreditsUrl, buildUsageLimitPresentation } from '../../lib/usageLimitUx';

export interface UsageLimitNoticeProps {
  error: UsageLimitError;
  className?: string;
  returnTo?: string;
}

export function UsageLimitNotice({ error, className = '', returnTo }: UsageLimitNoticeProps) {
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
      <div className="mt-3 flex flex-wrap gap-3">
        {presentation.primaryAction === 'buy' && presentation.buyMorePackId ? (
          <Link
            to={buildBillingBuyCreditsUrl(presentation.buyMorePackId, returnTo)}
            className="inline-flex text-sm font-medium text-cyan-700 underline hover:text-cyan-800 dark:text-cyan-300"
            data-testid="usage-limit-buy-credits-link"
          >
            {presentation.buyMoreLabel}
          </Link>
        ) : null}
        {presentation.upgradeUrl ? (
          <Link
            to={presentation.upgradeUrl}
            className={`inline-flex text-sm font-medium underline ${
              presentation.primaryAction === 'upgrade'
                ? 'text-cyan-700 hover:text-cyan-800 dark:text-cyan-300'
                : 'text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
            data-testid="usage-limit-upgrade-link"
          >
            {presentation.upgradeLabel}
          </Link>
        ) : null}
        {presentation.primaryAction === 'upgrade' && presentation.buyMorePackId ? (
          <Link
            to={buildBillingBuyCreditsUrl(presentation.buyMorePackId, returnTo)}
            className="inline-flex text-sm font-medium text-slate-600 underline hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            data-testid="usage-limit-buy-credits-secondary-link"
          >
            {presentation.buyMoreLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
