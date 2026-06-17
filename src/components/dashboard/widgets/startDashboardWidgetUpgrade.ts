import type { NavigateFunction } from 'react-router-dom';
import type { PlanId } from '../../../lib/entitlements';
import {
  createCheckoutSession,
  createCustomerPortalSession,
  getAppBaseUrl,
  isStripeConfigured,
  redirectToStripeUrl,
} from '../../../services/billingService';
import {
  buildBillingUpgradeUrl,
  DASHBOARD_CUSTOMIZE_RETURN_PATH,
} from './dashboardWidgetUpgrade';

export interface StartDashboardWidgetUpgradeOptions {
  requiredPlan: PlanId;
  hasActiveStripeSubscription: boolean;
  isPastDue: boolean;
  navigate: NavigateFunction;
  onError: (message: string) => void;
}

function billingReturnUrl(): string {
  const base = getAppBaseUrl();
  return `${base}${DASHBOARD_CUSTOMIZE_RETURN_PATH}`;
}

function billingCancelUrl(requiredPlan: PlanId): string {
  const base = getAppBaseUrl();
  const params = new URLSearchParams({
    checkout: 'canceled',
    upgrade: requiredPlan,
    returnTo: DASHBOARD_CUSTOMIZE_RETURN_PATH,
  });
  return `${base}/settings/billing?${params.toString()}`;
}

/**
 * Start upgrade from a locked catalog tile: direct Stripe checkout when possible,
 * otherwise fall back to the billing page with upgrade + returnTo params.
 */
export async function startDashboardWidgetUpgrade({
  requiredPlan,
  hasActiveStripeSubscription,
  isPastDue,
  navigate,
  onError,
}: StartDashboardWidgetUpgradeOptions): Promise<void> {
  if (!isStripeConfigured()) {
    navigate(buildBillingUpgradeUrl(requiredPlan));
    return;
  }

  try {
    if (hasActiveStripeSubscription || isPastDue) {
      const url = await createCustomerPortalSession(billingReturnUrl());
      redirectToStripeUrl(url);
      return;
    }

    const url = await createCheckoutSession({
      planId: requiredPlan,
      billingInterval: 'month',
      successUrl: billingReturnUrl(),
      cancelUrl: billingCancelUrl(requiredPlan),
    });
    redirectToStripeUrl(url);
  } catch {
    onError(
      'Unable to start upgrade. Open Billing & Subscription to manage your plan.',
    );
    navigate(buildBillingUpgradeUrl(requiredPlan));
  }
}
