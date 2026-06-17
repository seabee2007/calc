import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { NavigateFunction } from 'react-router-dom';
import { startDashboardWidgetUpgrade } from './startDashboardWidgetUpgrade';
import { DASHBOARD_CUSTOMIZE_RETURN_PATH } from './dashboardWidgetUpgrade';

const createCheckoutSession = vi.fn();
const createCustomerPortalSession = vi.fn();
const redirectToStripeUrl = vi.fn();
const isStripeConfigured = vi.fn();

vi.mock('../../../services/billingService', () => ({
  createCheckoutSession: (...args: unknown[]) => createCheckoutSession(...args),
  createCustomerPortalSession: (...args: unknown[]) => createCustomerPortalSession(...args),
  redirectToStripeUrl: (...args: unknown[]) => redirectToStripeUrl(...args),
  isStripeConfigured: () => isStripeConfigured(),
  getAppBaseUrl: () => 'https://app.test',
}));

describe('startDashboardWidgetUpgrade', () => {
  const navigate = vi.fn() as unknown as NavigateFunction;
  const onError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    isStripeConfigured.mockReturnValue(true);
    createCheckoutSession.mockResolvedValue('https://checkout.stripe.test/session');
    createCustomerPortalSession.mockResolvedValue('https://billing.stripe.test/portal');
  });

  it('starts checkout for free users with dashboard return URLs', async () => {
    await startDashboardWidgetUpgrade({
      requiredPlan: 'starter',
      hasActiveStripeSubscription: false,
      isPastDue: false,
      navigate,
      onError,
    });

    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        planId: 'starter',
        billingInterval: 'month',
        successUrl: expect.stringContaining(DASHBOARD_CUSTOMIZE_RETURN_PATH),
        cancelUrl: expect.stringContaining('checkout=canceled'),
      }),
    );
    expect(redirectToStripeUrl).toHaveBeenCalledWith('https://checkout.stripe.test/session');
  });

  it('opens customer portal for active subscribers', async () => {
    await startDashboardWidgetUpgrade({
      requiredPlan: 'business',
      hasActiveStripeSubscription: true,
      isPastDue: false,
      navigate,
      onError,
    });

    expect(createCustomerPortalSession).toHaveBeenCalledWith(
      expect.stringContaining(DASHBOARD_CUSTOMIZE_RETURN_PATH),
    );
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it('falls back to billing page when checkout fails', async () => {
    createCheckoutSession.mockRejectedValue(new Error('fail'));

    await startDashboardWidgetUpgrade({
      requiredPlan: 'starter',
      hasActiveStripeSubscription: false,
      isPastDue: false,
      navigate,
      onError,
    });

    expect(onError).toHaveBeenCalledWith(
      'Unable to start upgrade. Open Billing & Subscription to manage your plan.',
    );
    expect(navigate).toHaveBeenCalledWith(
      expect.stringContaining('upgrade=starter'),
    );
    expect(navigate).toHaveBeenCalledWith(
      expect.stringContaining(`returnTo=${encodeURIComponent(DASHBOARD_CUSTOMIZE_RETURN_PATH)}`),
    );
  });
});
