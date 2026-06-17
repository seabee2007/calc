import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';
import OpsCard from '../OpsCard';
import Button from '../../ui/Button';
import { UsageLimitRow } from '../../subscription/UsageLimitsPanel';
import { useUsageSummary } from '../../../hooks/useUsageSummary';
import { formatUsageResetDate, nextUpgradePlan } from '../../../lib/usageLabels';
import { buildBillingUpgradeUrl } from '../../../lib/usageMetering';
import { OPS_BODY, OPS_MUTED, OPS_TITLE } from '../opsTheme';

export interface UsageMeterWidgetProps {
  cardWidth?: number;
  isMobile?: boolean;
}

function widgetMode(cardWidth?: number, isMobile?: boolean): 'third' | 'half' | 'full' {
  if (isMobile || !cardWidth) return 'full';
  if (cardWidth <= 4) return 'third';
  if (cardWidth <= 8) return 'half';
  return 'full';
}

function WidgetHeader() {
  return (
    <header className="mb-3 flex items-center gap-2">
      <BarChart3 className="h-4 w-4 text-cyan-600 dark:text-cyan-400" aria-hidden />
      <h3 className={`font-semibold ${OPS_TITLE}`}>Usage Meter</h3>
    </header>
  );
}

export default function UsageMeterWidget({ cardWidth, isMobile }: UsageMeterWidgetProps) {
  const navigate = useNavigate();
  const { summary, loading, error, ownerOnlyBlocked, refetch } = useUsageSummary(true);
  const mode = widgetMode(cardWidth, isMobile);

  const topItems = useMemo(() => {
    if (!summary) return [];
    const sorted = [...summary.items].sort((a, b) => b.percentUsed - a.percentUsed);
    if (mode === 'third') return sorted.slice(0, 2);
    if (mode === 'half') return sorted.slice(0, 4);
    return sorted;
  }, [summary, mode]);

  const atLimit = summary?.items.some((item) => item.limit >= 0 && item.used >= item.limit) ?? false;
  const upgradePlan = summary ? nextUpgradePlan(summary.planId) : 'starter';

  if (ownerOnlyBlocked) {
    return (
      <OpsCard data-testid="usage-meter-widget">
        <WidgetHeader />
        <p className={`text-sm ${OPS_MUTED}`}>
          Company usage is visible to account owners. Open Billing to manage your plan.
        </p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/settings/billing')}>
          Open Billing
        </Button>
      </OpsCard>
    );
  }

  return (
    <OpsCard data-testid="usage-meter-widget">
      <WidgetHeader />

      {summary?.periodEnd && mode === 'full' ? (
        <p className={`mb-3 text-xs ${OPS_MUTED}`} data-testid="usage-meter-reset">
          Resets {formatUsageResetDate(summary.periodEnd)}
        </p>
      ) : null}

      {loading ? <p className={`text-sm ${OPS_MUTED}`}>Loading usage…</p> : null}
      {error ? <p className="text-sm text-amber-700 dark:text-amber-300">{error}</p> : null}

      {!loading && !error && summary ? (
        <div className="space-y-4">
          {topItems.map((item) => (
            <UsageLimitRow
              key={item.usageUnit}
              label={item.label}
              used={item.used}
              limit={item.limit}
              remaining={item.remaining}
              percentUsed={item.percentUsed}
              resetsAt={item.resetsAt}
              showResetDate={mode === 'full'}
              creditRemaining={item.creditRemaining}
              creditsExpireAt={item.creditsExpireAt}
            />
          ))}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/settings/billing')}>
              {mode === 'full' ? 'View usage' : 'Open Billing'}
            </Button>
            {atLimit && upgradePlan ? (
              <Link
                to={buildBillingUpgradeUrl(upgradePlan, '/')}
                className="inline-flex items-center rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cyan-700"
                data-testid="usage-meter-upgrade-cta"
              >
                Upgrade plan
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      {!loading && !error && !summary ? (
        <p className={`text-sm ${OPS_BODY}`}>No usage recorded yet this month.</p>
      ) : null}
    </OpsCard>
  );
}
