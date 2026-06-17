import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../ui/Button';
import type { UsageSummary, UsageSummaryItem } from '../../services/usageSummaryService';
import type { PlanId } from '../../lib/entitlements';
import type { UsageUnit } from '../../lib/usageLimits';
import {
  USAGE_BILLING_GROUPS,
  computePercentUsed,
  formatUsageQuota,
  formatUsageResetDate,
  getUsageStateBand,
  nextUpgradePlan,
  usageStateProgressClass,
  usageStateTextClass,
  usageUpgradeCtaLabel,
} from '../../lib/usageLabels';
import { buildBillingUpgradeUrl } from '../../lib/usageMetering';

export interface UsageLimitsPanelProps {
  summary: UsageSummary | null;
  loading?: boolean;
  error?: string | null;
  ownerOnlyBlocked?: boolean;
  compact?: boolean;
  maxRows?: number;
  showResetDate?: boolean;
  className?: string;
}

function itemByUnit(items: UsageSummaryItem[], unit: UsageUnit): UsageSummaryItem | undefined {
  return items.find((item) => item.usageUnit === unit);
}

function aggregateGroup(items: UsageSummaryItem[], units: UsageUnit[]) {
  const groupItems = units
    .map((unit) => itemByUnit(items, unit))
    .filter((item): item is UsageSummaryItem => Boolean(item));

  if (groupItems.length === 0) {
    return null;
  }

  const used = groupItems.reduce((sum, item) => sum + item.used, 0);
  const limit = groupItems.reduce((sum, item) => sum + Math.max(0, item.limit), 0);
  const remaining = Math.max(0, limit - used);
  const percentUsed = computePercentUsed(used, limit);
  const resetsAt = groupItems[0]?.resetsAt ?? '';

  return { used, limit, remaining, percentUsed, resetsAt };
}

export function UsageLimitRow({
  label,
  used,
  limit,
  remaining,
  percentUsed,
  resetsAt,
  showResetDate = true,
}: {
  label: string;
  used: number;
  limit: number;
  remaining: number;
  percentUsed: number;
  resetsAt?: string;
  showResetDate?: boolean;
}) {
  const band = getUsageStateBand(percentUsed, limit);

  return (
    <div className="space-y-2" data-testid="usage-limit-row">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{label}</p>
        <p className={`text-sm ${usageStateTextClass(band)}`} data-testid="usage-limit-quota">
          {formatUsageQuota(used, limit)}
        </p>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
        role="progressbar"
        aria-valuenow={percentUsed}
        aria-valuemin={0}
        aria-valuemax={100}
        data-testid="usage-limit-progress"
        data-usage-band={band}
      >
        <div
          className={`h-full rounded-full transition-all ${usageStateProgressClass(band)}`}
          style={{ width: `${Math.max(0, Math.min(100, percentUsed))}%` }}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span data-testid="usage-limit-remaining">
          {limit === 0
            ? 'Not included on your plan'
            : limit < 0
              ? 'Unlimited'
              : `${remaining.toLocaleString()} remaining`}
        </span>
        {showResetDate && resetsAt ? (
          <span data-testid="usage-limit-reset">Resets {formatUsageResetDate(resetsAt)}</span>
        ) : null}
      </div>
    </div>
  );
}

export default function UsageLimitsPanel({
  summary,
  loading = false,
  error = null,
  ownerOnlyBlocked = false,
  compact = false,
  maxRows,
  showResetDate = true,
  className = '',
}: UsageLimitsPanelProps) {
  const navigate = useNavigate();
  const planId = summary?.planId ?? 'free';
  const upgradePlan = nextUpgradePlan(planId);

  const rows = useMemo(() => {
    if (!summary) return [];

    if (compact) {
      return [...summary.items]
        .sort((a, b) => b.percentUsed - a.percentUsed)
        .slice(0, maxRows ?? summary.items.length)
        .map((item) => ({
          key: item.usageUnit,
          label: item.label,
          ...item,
        }));
    }

    return USAGE_BILLING_GROUPS.map((group) => {
      const aggregate = aggregateGroup(summary.items, group.units);
      if (!aggregate) return null;
      return {
        key: group.id,
        label: group.label,
        ...aggregate,
      };
    }).filter((row): row is NonNullable<typeof row> => row !== null);
  }, [summary, compact, maxRows]);

  if (ownerOnlyBlocked) {
    return (
      <section
        className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}
        data-testid="usage-limits-panel"
      >
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Usage & Limits</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Company usage summaries are available to account owners. Ask your company owner to review
          usage in Billing settings.
        </p>
      </section>
    );
  }

  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}
      data-testid="usage-limits-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Usage & Limits</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Monthly metered API usage for your company account.
          </p>
        </div>
        {summary?.periodEnd ? (
          <p className="text-xs text-slate-500 dark:text-slate-400" data-testid="usage-period-end">
            Resets {formatUsageResetDate(summary.periodEnd)}
          </p>
        ) : null}
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Loading usage…</p>
      ) : null}

      {error ? (
        <p className="mt-4 text-sm text-amber-700 dark:text-amber-300" data-testid="usage-limits-error">
          {error}
        </p>
      ) : null}

      {!loading && !error && summary ? (
        <div className="mt-5 space-y-5">
          {rows.map((row) => (
            <UsageLimitRow
              key={row.key}
              label={row.label}
              used={row.used}
              limit={row.limit}
              remaining={row.remaining}
              percentUsed={row.percentUsed}
              resetsAt={row.resetsAt}
              showResetDate={showResetDate && !compact}
            />
          ))}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            {upgradePlan ? (
              <Button
                variant="accent"
                size="sm"
                data-testid="usage-upgrade-cta"
                onClick={() => navigate(buildBillingUpgradeUrl(upgradePlan, '/settings/billing'))}
              >
                {usageUpgradeCtaLabel(planId)}
              </Button>
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-300" data-testid="usage-contact-support">
                {usageUpgradeCtaLabel(planId)}
              </p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
