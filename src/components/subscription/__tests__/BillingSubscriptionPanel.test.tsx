import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import BillingSubscriptionPanel from '../BillingSubscriptionPanel';

const createCheckoutSession = vi.fn();
const createCustomerPortalSession = vi.fn();
const redirectToStripeUrl = vi.fn();

let mockSubscriptionState = {
  plan: 'starter' as const,
  status: 'trialing',
  isActive: true,
  subscription: {
    stripeCustomerId: null as string | null,
    stripeSubscriptionId: null as string | null,
    currentPeriodEnd: null as string | null,
  },
  loading: false,
  refresh: vi.fn(),
};

vi.mock('../../../services/billingService', () => ({
  createCheckoutSession: (...args: unknown[]) => createCheckoutSession(...args),
  createCustomerPortalSession: (...args: unknown[]) => createCustomerPortalSession(...args),
  redirectToStripeUrl: (...args: unknown[]) => redirectToStripeUrl(...args),
  isStripeConfigured: () => true,
}));

vi.mock('../../../contexts/SubscriptionContext', () => ({
  useSubscription: () => mockSubscriptionState,
}));

describe('BillingSubscriptionPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscriptionState = {
      plan: 'starter',
      status: 'trialing',
      isActive: true,
      subscription: {
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        currentPeriodEnd: null,
      },
      loading: false,
      refresh: vi.fn(),
    };
    createCheckoutSession.mockResolvedValue('https://checkout.stripe.test/session');
    createCustomerPortalSession.mockResolvedValue('https://billing.stripe.test/portal');
  });

  it('renders current plan and subscription status', () => {
    render(
      <MemoryRouter>
        <BillingSubscriptionPanel />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('billing-subscription-panel')).toBeInTheDocument();
    expect(screen.getAllByTestId('plan-badge-starter').length).toBeGreaterThan(0);
    expect(screen.getByTestId('subscription-status')).toHaveTextContent('trialing');
    expect(screen.getByTestId('pricing-plans-card')).toBeInTheDocument();
  });

  it('calls checkout for upgrade buttons', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <BillingSubscriptionPanel />
      </MemoryRouter>,
    );

    await user.click(screen.getByTestId('upgrade-professional'));

    await waitFor(() => {
      expect(createCheckoutSession).toHaveBeenCalledWith({
        planId: 'professional',
        billingInterval: 'month',
      });
    });
    expect(redirectToStripeUrl).toHaveBeenCalledWith('https://checkout.stripe.test/session');
  });

  it('blocks manage billing when no Stripe customer exists', () => {
    render(
      <MemoryRouter>
        <BillingSubscriptionPanel />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('manage-billing-button')).toBeDisabled();
  });

  it('calls customer portal session when manage billing is clicked', async () => {
    mockSubscriptionState = {
      plan: 'professional',
      status: 'active',
      isActive: true,
      subscription: {
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
        currentPeriodEnd: '2026-07-01T00:00:00.000Z',
      },
      loading: false,
      refresh: vi.fn(),
    };

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <BillingSubscriptionPanel />
      </MemoryRouter>,
    );

    await user.click(screen.getByTestId('manage-billing-button'));

    await waitFor(() => {
      expect(createCustomerPortalSession).toHaveBeenCalled();
    });
    expect(redirectToStripeUrl).toHaveBeenCalledWith('https://billing.stripe.test/portal');
  });
});
