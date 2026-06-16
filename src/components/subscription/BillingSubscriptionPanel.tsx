import { useCallback, useEffect, useMemo, useState } from 'react';
import { CreditCard, ExternalLink } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import InlineNotice from '../ui/InlineNotice';
import Button from '../ui/Button';
import PlanBadge from './PlanBadge';
import PricingPlansCard from './PricingPlansCard';
import { useSubscription } from '../../contexts/SubscriptionContext';
import type { PlanId } from '../../lib/entitlements';
import { PLAN_DISPLAY_NAMES } from '../../lib/entitlements';
import { getPlanRank } from '../../lib/planMarketing';
import {
  createCheckoutSession,
  createCustomerPortalSession,
  isStripeConfigured,
  redirectToStripeUrl,
} from '../../services/billingService';

function formatStatusLabel(status: string | null): string {
  if (!status) return 'No subscription';
  return status.replace(/_/g, ' ');
}

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function BillingSubscriptionPanel() {
  const {
    plan,
    status,
    isActive,
    subscription,
    loading,
    refresh,
  } = useSubscription();
  const [searchParams, setSearchParams] = useSearchParams();
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month');
  const [busyAction, setBusyAction] = useState<'portal' | PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const checkoutResult = searchParams.get('checkout');
  const hasStripeSubscription = Boolean(subscription?.stripeSubscriptionId) && isActive;
  const periodEndLabel = formatDate(subscription?.currentPeriodEnd);

  useEffect(() => {
    if (checkoutResult === 'success') {
      setNotice('Checkout completed. Your subscription will update shortly after Stripe confirms payment.');
      void refresh();
      setSearchParams({}, { replace: true });
    } else if (checkoutResult === 'canceled') {
      setNotice('Checkout was canceled. No changes were made.');
      setSearchParams({}, { replace: true });
    }
  }, [checkoutResult, refresh, setSearchParams]);

  const startCheckout = useCallback(async (targetPlan: PlanId) => {
    setError(null);
    setBusyAction(targetPlan);
    try {
      const url = await createCheckoutSession({
        planId: targetPlan,
        billingInterval,
      });
      redirectToStripeUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start checkout.');
      setBusyAction(null);
    }
  }, [billingInterval]);

  const openPortal = useCallback(async () => {
    setError(null);
    setBusyAction('portal');
    try {
      const url = await createCustomerPortalSession();
      redirectToStripeUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open billing portal.');
      setBusyAction(null);
    }
  }, []);

  const handleUpgrade = useCallback(async (targetPlan: PlanId) => {
    if (hasStripeSubscription && getPlanRank(targetPlan) <= getPlanRank(plan)) {
      await openPortal();
      return;
    }
    await startCheckout(targetPlan);
  }, [hasStripeSubscription, openPortal, plan, startCheckout]);

  const upgradeButtons = useMemo(
    () =>
      (['professional', 'business'] as const).map((targetPlan) => {
        const label =
          getPlanRank(targetPlan) <= getPlanRank(plan)
            ? `Manage ${PLAN_DISPLAY_NAMES[targetPlan].short}`
            : `Upgrade to ${PLAN_DISPLAY_NAMES[targetPlan].short}`;
        return (
          <Button
            key={targetPlan}
            variant={targetPlan === 'professional' ? 'accent' : 'primary'}
            size="sm"
            disabled={Boolean(busyAction) || loading}
            isLoading={busyAction === targetPlan}
            onClick={() => void handleUpgrade(targetPlan)}
            data-testid={`upgrade-${targetPlan}`}
          >
            {label}
          </Button>
        );
      }),
    [busyAction, handleUpgrade, loading, plan],
  );

  return (
    <div className="space-y-6" data-testid="billing-subscription-panel">
      {!isStripeConfigured() ? (
        <InlineNotice
          variant="warning"
          title="Stripe is not configured for this environment. Set VITE_STRIPE_PUBLISHABLE_KEY to enable live checkout redirects."
        />
      ) : null}

      {notice ? (
        <InlineNotice variant="success" title={notice} />
      ) : null}

      {error ? (
        <InlineNotice variant="warning" title={error} />
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-cyan-600 dark:text-cyan-400" aria-hidden />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Subscription
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-slate-600 dark:text-slate-300">Current plan:</span>
              <PlanBadge plan={plan} />
              <span
                className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                data-testid="subscription-status"
              >
                {formatStatusLabel(status)}
              </span>
            </div>
            {periodEndLabel ? (
              <p className="text-sm text-slate-500 dark:text-slate-400" data-testid="subscription-period-end">
                Current period ends {periodEndLabel}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {upgradeButtons}
            <Button
              variant="outline"
              size="sm"
              icon={<ExternalLink className="h-4 w-4" />}
              disabled={Boolean(busyAction) || loading || !subscription?.stripeCustomerId}
              isLoading={busyAction === 'portal'}
              onClick={() => void openPortal()}
              data-testid="manage-billing-button"
            >
              Manage Billing
            </Button>
          </div>
        </div>
      </section>

      <PricingPlansCard
        currentPlan={plan}
        billingInterval={billingInterval}
        onBillingIntervalChange={setBillingInterval}
        onSelectPlan={(targetPlan) => void handleUpgrade(targetPlan)}
        loadingPlan={typeof busyAction === 'string' && busyAction !== 'portal' ? busyAction : null}
        disabled={Boolean(busyAction) || loading}
      />
    </div>
  );
}
