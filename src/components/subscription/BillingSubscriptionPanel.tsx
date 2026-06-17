import { useCallback, useEffect, useMemo, useState } from 'react';
import { CreditCard, ExternalLink, AlertTriangle } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import InlineNotice from '../ui/InlineNotice';
import Button from '../ui/Button';
import PricingPlansCard from './PricingPlansCard';
import UsageLimitsPanel from './UsageLimitsPanel';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useAuth } from '../../hooks/useAuth';
import { useUsageSummary } from '../../hooks/useUsageSummary';
import type { PlanId } from '../../lib/entitlements';
import {
  getBillingStatusLabel,
  getCustomerFacingCurrentPlanId,
  getProfilePlanLabel,
  BILLING_PLAN_LABEL_TONE_STYLES,
} from './profilePlanLabel';
import {
  createCheckoutSession,
  createCustomerPortalSession,
  isStripeConfigured,
  redirectToStripeUrl,
} from '../../services/billingService';
import { validateClientStripePublishableKey } from '../../lib/stripeEnv';

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

const PAID_UPGRADE_PLANS = new Set<PlanId>(['starter', 'professional', 'business']);

function parseUpgradePlan(value: string | null): PlanId | null {
  if (!value || !PAID_UPGRADE_PLANS.has(value as PlanId)) return null;
  return value as PlanId;
}

function isSafeReturnPath(path: string | null): path is string {
  return Boolean(path && path.startsWith('/') && !path.startsWith('//'));
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
  const { isOwner } = useAuth();
  const usageSummary = useUsageSummary(isOwner);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month');
  const [busyAction, setBusyAction] = useState<'portal' | PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const subscriptionLabels = { plan, status, subscription };
  const { label: currentPlanLabel, tone: currentPlanTone } = getProfilePlanLabel(subscriptionLabels);
  const billingStatusLabel = getBillingStatusLabel(subscriptionLabels);
  const customerCurrentPlanId = getCustomerFacingCurrentPlanId(subscriptionLabels);

  const hasStripeCustomer = Boolean(subscription?.stripeCustomerId);
  const hasStripeSubscription = Boolean(subscription?.stripeSubscriptionId) && isActive;
  const isPastDue = status?.toLowerCase() === 'past_due';
  const periodEndLabel = formatDate(subscription?.currentPeriodEnd);
  const cancelAtPeriodEnd = subscription?.cancelAtPeriodEnd ?? false;

  const checkoutResult = searchParams.get('checkout');
  const upgradePlan = useMemo(
    () => parseUpgradePlan(searchParams.get('upgrade')),
    [searchParams],
  );
  const returnToPath = useMemo(() => {
    const value = searchParams.get('returnTo');
    return isSafeReturnPath(value) ? value : null;
  }, [searchParams]);

  useEffect(() => {
    if (checkoutResult === 'success') {
      setNotice('Checkout completed. Your subscription will update shortly after Stripe confirms payment.');
      void refresh().finally(() => {
        if (returnToPath) {
          navigate(returnToPath, { replace: true });
          return;
        }
        setSearchParams({}, { replace: true });
      });
    } else if (checkoutResult === 'canceled') {
      setNotice('Checkout was canceled. No changes were made.');
      if (returnToPath) {
        navigate(returnToPath, { replace: true });
        return;
      }
      setSearchParams({}, { replace: true });
    }
  }, [checkoutResult, refresh, returnToPath, navigate, setSearchParams]);

  const startCheckout = useCallback(async (targetPlan: PlanId) => {
    setError(null);
    setBusyAction(targetPlan);
    try {
      const url = await createCheckoutSession({ planId: targetPlan, billingInterval });
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

  /**
   * Card CTA handler. Downgrades and upgrades for existing subscribers go through
   * the Stripe Customer Portal; new checkouts go directly to Stripe Checkout.
   */
  const handleSelectPlan = useCallback(async (targetPlan: PlanId) => {
    if (hasStripeSubscription) {
      // Any plan change for an existing subscriber routes through the portal.
      await openPortal();
      return;
    }
    await startCheckout(targetPlan);
  }, [hasStripeSubscription, openPortal, startCheckout]);

  const stripeConfigWarning = validateClientStripePublishableKey(
    import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY,
  );

  return (
    <div className="space-y-6" data-testid="billing-subscription-panel">
      {!isStripeConfigured() ? (
        <InlineNotice
          variant="warning"
          title="Stripe is not configured for this environment. Set VITE_STRIPE_PUBLISHABLE_KEY to enable live checkout."
        />
      ) : null}

      {stripeConfigWarning ? (
        <InlineNotice variant="warning" title={stripeConfigWarning} />
      ) : null}

      {notice ? <InlineNotice variant="success" title={notice} /> : null}
      {error ? <InlineNotice variant="warning" title={error} /> : null}

      {isPastDue ? (
        <InlineNotice
          variant="warning"
          title="Your payment is past due. Update your payment method to keep your subscription active."
        />
      ) : null}

      {cancelAtPeriodEnd && periodEndLabel ? (
        <InlineNotice
          variant="warning"
          title={`Your subscription is canceled and will end on ${periodEndLabel}. Reactivate before then to keep access.`}
        />
      ) : null}

      {/* Current plan summary */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-cyan-600 dark:text-cyan-400" aria-hidden />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Subscription
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-slate-500 dark:text-slate-400">Current plan:</span>
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${BILLING_PLAN_LABEL_TONE_STYLES[currentPlanTone]}`}
                data-testid="billing-current-plan-label"
              >
                {currentPlanLabel}
              </span>
              <span
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                data-testid="subscription-status"
              >
                {isPastDue ? (
                  <AlertTriangle className="h-3 w-3 text-amber-500" aria-hidden />
                ) : null}
                {billingStatusLabel}
              </span>
            </div>

            {periodEndLabel && !cancelAtPeriodEnd ? (
              <p className="text-xs text-slate-400 dark:text-slate-500" data-testid="subscription-period-end">
                Current period ends {periodEndLabel}
              </p>
            ) : null}
          </div>

          {/* Manage Billing — shown only when a Stripe customer exists */}
          {hasStripeCustomer ? (
            <Button
              variant="outline"
              size="sm"
              icon={<ExternalLink className="h-4 w-4" />}
              disabled={Boolean(busyAction) || loading}
              isLoading={busyAction === 'portal'}
              onClick={() => void openPortal()}
              data-testid="manage-billing-button"
            >
              Manage Billing
            </Button>
          ) : (
            /* Render a disabled placeholder so tests can still query it */
            <Button
              variant="outline"
              size="sm"
              icon={<ExternalLink className="h-4 w-4" />}
              disabled
              data-testid="manage-billing-button"
            >
              Manage Billing
            </Button>
          )}
        </div>
      </section>

      <UsageLimitsPanel
        summary={usageSummary.summary}
        loading={usageSummary.loading}
        error={usageSummary.error}
        ownerOnlyBlocked={!isOwner || usageSummary.ownerOnlyBlocked}
      />

      {/* Pricing cards */}
      <PricingPlansCard
        currentPlanId={customerCurrentPlanId}
        billingInterval={billingInterval}
        onBillingIntervalChange={setBillingInterval}
        onSelectPlan={(targetPlan) => void handleSelectPlan(targetPlan)}
        loadingPlan={typeof busyAction === 'string' && busyAction !== 'portal' ? (busyAction as PlanId) : null}
        disabled={Boolean(busyAction) || loading}
        highlightedPlan={upgradePlan}
      />
    </div>
  );
}
