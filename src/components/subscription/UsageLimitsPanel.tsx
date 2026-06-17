import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../ui/Button';
import type { UsageSummary, UsageSummaryItem } from '../../services/usageSummaryService';
import { PLAN_DISPLAY_NAMES, type PlanId } from '../../lib/entitlements';
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
import {
  canPurchaseCreditPacks,
  creditPackIdForBillingGroup,
  creditPackIdForUsageUnit,
  type UsageCreditPackId,
} from '../../lib/usageCreditPacks';
import { creditPackLabel } from '../../lib/usageCreditPackCheckout';
import { createUsageCreditCheckout, redirectToStripeUrl } from '../../services/billingService';

export interface UsageLimitsPanelProps {
  summary: UsageSummary | null;
  loading?: boolean;
  error?: string | null;
  ownerOnlyBlocked?: boolean;
  compact?: boolean;
  maxRows?: number;
  showResetDate?: boolean;
  className?: string;
  onUpgradePlan?: (planId: PlanId) => void;
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
  const creditRemaining = groupItems.reduce((sum, item) => sum + item.creditRemaining, 0);
  const creditsExpireAt =
    groupItems
      .map((item) => item.creditsExpireAt)
      .filter((value): value is string => Boolean(value))
      .sort()[0] ?? null;
  const percentUsed = computePercentUsed(used, limit);
  const resetsAt = groupItems[0]?.resetsAt ?? '';

  return { used, limit, remaining, creditRemaining, creditsExpireAt, percentUsed, resetsAt };
}

export function UsageLimitRow({
  label,
  used,
  limit,
  remaining,
  percentUsed,
  resetsAt,
  showResetDate = true,
  creditRemaining = 0,
  creditsExpireAt = null,
  onBuyMore,
  buyMoreLabel,
}: {
  label: string;
  used: number;
  limit: number;
  remaining: number;
  percentUsed: number;
  resetsAt?: string;
  showResetDate?: boolean;
  creditRemaining?: number;
  creditsExpireAt?: string | null;
  onBuyMore?: () => void;
  buyMoreLabel?: string;
}) {
  const band = getUsageStateBand(percentUsed, limit);

  return (
    <div className="space-y-2" data-testid="usage-limit-row">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{label}</p>
        <p className={`text-sm ${usageStateTextClass(band)}`} data-testid="usage-limit-quota">
          {formatUsageQuota(used, limit, creditRemaining)}
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
              : `${remaining.toLocaleString()} monthly remaining`}
          {creditRemaining > 0 ? ` · ${creditRemaining.toLocaleString()} credits` : ''}
        </span>
        <span className="flex flex-wrap items-center gap-2">
          {creditRemaining > 0 && creditsExpireAt ? (
            <span data-testid="usage-credits-expire">
              Credits expire {formatUsageResetDate(creditsExpireAt)}
            </span>
          ) : null}
          {showResetDate && resetsAt ? (
            <span data-testid="usage-limit-reset">Resets {formatUsageResetDate(resetsAt)}</span>
          ) : null}
        </span>
      </div>
      {onBuyMore && buyMoreLabel ? (
        <Button
          variant="outline"
          size="sm"
          data-testid="usage-buy-more-button"
          onClick={onBuyMore}
        >
          {buyMoreLabel}
        </Button>
      ) : null}
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
  onUpgradePlan,
}: UsageLimitsPanelProps) {
  const navigate = useNavigate();
  const [buyingPackId, setBuyingPackId] = useState<UsageCreditPackId | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);
  const planId = summary?.planId ?? 'free';
  const upgradePlan = nextUpgradePlan(planId);
  const canBuyCredits = canPurchaseCreditPacks(planId);
  const upgradePlanName = upgradePlan ? PLAN_DISPLAY_NAMES[upgradePlan].short : null;

  const startCreditCheckout = async (packId: UsageCreditPackId) => {
    setBuyError(null);
    setBuyingPackId(packId);
    try {
      const url = await createUsageCreditCheckout(packId, '/settings/billing');
      redirectToStripeUrl(url);
    } catch (checkoutError) {
      setBuyError(
        checkoutError instanceof Error
          ? checkoutError.message
          : 'Could not start credit pack checkout.',
      );
    } finally {
      setBuyingPackId(null);
    }
  };

  const rows = useMemo(() => {
    if (!summary) return [];

    if (compact) {
      return [...summary.items]
        .sort((a, b) => b.percentUsed - a.percentUsed)
        .slice(0, maxRows ?? summary.items.length)
        .map((item) => ({
          key: item.usageUnit,
          label: item.label,
          packId: creditPackIdForUsageUnit(item.usageUnit),
          ...item,
        }));
    }

    return USAGE_BILLING_GROUPS.map((group) => {
      const aggregate = aggregateGroup(summary.items, group.units);
      if (!aggregate) return null;
      return {
        key: group.id,
        label: group.label,
        packId: creditPackIdForBillingGroup(group.id),
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
      id="usage"
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

      {buyError ? (
        <p className="mt-4 text-sm text-amber-700 dark:text-amber-300" data-testid="usage-buy-error">
          {buyError}
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
              creditRemaining={row.creditRemaining}
              creditsExpireAt={row.creditsExpireAt}
              onBuyMore={
                canBuyCredits && row.packId
                  ? () => void startCreditCheckout(row.packId as UsageCreditPackId)
                  : undefined
              }
              buyMoreLabel={
                row.packId && buyingPackId === row.packId
                  ? 'Opening checkout…'
                  : row.packId
                    ? `Buy more (${creditPackLabel(row.packId as UsageCreditPackId)})`
                    : undefined
              }
            />
          ))}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            {upgradePlan ? (
              <div className="space-y-1">
                <Button
                  variant="accent"
                  size="sm"
                  data-testid="usage-upgrade-cta"
                  onClick={() => {
                    if (onUpgradePlan) {
                      onUpgradePlan(upgradePlan);
                      return;
                    }
                    navigate(buildBillingUpgradeUrl(upgradePlan, '/settings/billing'));
                  }}
                >
                  {upgradePlanName ? `Upgrade to ${upgradePlanName}` : usageUpgradeCtaLabel(planId)}
                </Button>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Higher monthly usage limits
                </p>
              </div>
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
