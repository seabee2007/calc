import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import BillingSubscriptionPanel from '../BillingSubscriptionPanel';

const createCheckoutSession = vi.fn();
const createCustomerPortalSession = vi.fn();
const redirectToStripeUrl = vi.fn();
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

type MockSubscription = {
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd?: boolean;
} | null;

let mockSubscriptionState = {
  plan: 'starter' as const,
  status: null as string | null,
  isActive: false,
  subscription: null as MockSubscription,
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
      status: null,
      isActive: false,
      subscription: null,
      loading: false,
      refresh: vi.fn(),
    };
    createCheckoutSession.mockResolvedValue('https://checkout.stripe.test/session');
    createCustomerPortalSession.mockResolvedValue('https://billing.stripe.test/portal');
  });

  it('shows Free and no active subscription for a user with no subscription row', () => {
    render(
      <MemoryRouter>
        <BillingSubscriptionPanel />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('billing-current-plan-label')).toHaveTextContent('Free');
    expect(screen.getByTestId('subscription-status')).toHaveTextContent('No active subscription');
    expect(screen.queryByTestId('upgrade-professional')).not.toBeInTheDocument();
    expect(screen.queryByTestId('upgrade-business')).not.toBeInTheDocument();
    expect(screen.getByTestId('pricing-plans-card')).toBeInTheDocument();
  });

  it('pricing cards show Choose … for a Free user with no active plan', () => {
    render(
      <MemoryRouter>
        <BillingSubscriptionPanel />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('select-plan-starter')).toHaveTextContent('Choose Starter');
    expect(screen.getByTestId('select-plan-professional')).toHaveTextContent('Choose Professional');
    expect(screen.getByTestId('select-plan-business')).toHaveTextContent('Choose Business');
    // None of them say "Current plan"
    expect(screen.queryByText('Current plan')).not.toBeInTheDocument();
  });

  it('shows Professional / Active and correct CTAs for an active Professional user', () => {
    mockSubscriptionState = {
      plan: 'professional',
      status: 'active',
      isActive: true,
      subscription: {
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
        currentPeriodEnd: '2026-07-01T00:00:00.000Z',
        cancelAtPeriodEnd: false,
      },
      loading: false,
      refresh: vi.fn(),
    };

    render(
      <MemoryRouter>
        <BillingSubscriptionPanel />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('billing-current-plan-label')).toHaveTextContent('Professional plan');
    expect(screen.getByTestId('subscription-status')).toHaveTextContent('Active');
    expect(screen.getByTestId('select-plan-professional')).toHaveTextContent('Current plan');
    expect(screen.getByTestId('select-plan-business')).toHaveTextContent('Upgrade to Business');
    expect(screen.getByTestId('select-plan-starter')).toHaveTextContent('Downgrade to Starter');
    // No duplicate upgrade buttons
    expect(screen.queryByTestId('upgrade-professional')).not.toBeInTheDocument();
    expect(screen.queryByTestId('upgrade-business')).not.toBeInTheDocument();
  });

  it('shows Business / Active and correct CTAs for an active Business user', () => {
    mockSubscriptionState = {
      plan: 'business',
      status: 'active',
      isActive: true,
      subscription: {
        stripeCustomerId: 'cus_456',
        stripeSubscriptionId: 'sub_456',
        currentPeriodEnd: '2026-07-01T00:00:00.000Z',
        cancelAtPeriodEnd: false,
      },
      loading: false,
      refresh: vi.fn(),
    };

    render(
      <MemoryRouter>
        <BillingSubscriptionPanel />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('billing-current-plan-label')).toHaveTextContent('Business plan');
    expect(screen.getByTestId('select-plan-business')).toHaveTextContent('Current plan');
    expect(screen.getByTestId('select-plan-professional')).toHaveTextContent('Downgrade to Professional');
    expect(screen.getByTestId('select-plan-starter')).toHaveTextContent('Downgrade to Starter');
  });

  it('manage billing button is disabled when there is no Stripe customer', () => {
    render(
      <MemoryRouter>
        <BillingSubscriptionPanel />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('manage-billing-button')).toBeDisabled();
  });

  it('calls checkout for a Free user clicking Choose Professional', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <BillingSubscriptionPanel />
      </MemoryRouter>,
    );

    await user.click(screen.getByTestId('select-plan-professional'));

    await waitFor(() => {
      expect(createCheckoutSession).toHaveBeenCalledWith({
        planId: 'professional',
        billingInterval: 'month',
      });
    });
    expect(redirectToStripeUrl).toHaveBeenCalledWith('https://checkout.stripe.test/session');
  });

  it('calls customer portal for an active subscriber clicking Upgrade to Business', async () => {
    mockSubscriptionState = {
      plan: 'professional',
      status: 'active',
      isActive: true,
      subscription: {
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
        currentPeriodEnd: '2026-07-01T00:00:00.000Z',
        cancelAtPeriodEnd: false,
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

    await user.click(screen.getByTestId('select-plan-business'));

    await waitFor(() => {
      expect(createCustomerPortalSession).toHaveBeenCalled();
    });
    expect(redirectToStripeUrl).toHaveBeenCalledWith('https://billing.stripe.test/portal');
  });

  it('calls customer portal when manage billing is clicked for an active subscriber', async () => {
    mockSubscriptionState = {
      plan: 'professional',
      status: 'active',
      isActive: true,
      subscription: {
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
        currentPeriodEnd: '2026-07-01T00:00:00.000Z',
        cancelAtPeriodEnd: false,
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

  it('highlights the upgrade plan from the upgrade query param', () => {
    render(
      <MemoryRouter initialEntries={['/settings/billing?upgrade=business&returnTo=%2F%3FcustomizeDashboard%3D1']}>
        <BillingSubscriptionPanel />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('pricing-plan-business')).toHaveTextContent('Recommended upgrade');
  });

  it('returns to returnTo after checkout success', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    mockSubscriptionState = {
      plan: 'free',
      status: null,
      isActive: false,
      subscription: null,
      loading: false,
      refresh,
    };

    render(
      <MemoryRouter initialEntries={['/settings/billing?checkout=success&returnTo=%2F%3FcustomizeDashboard%3D1%26openWidgetCatalog%3D1']}>
        <BillingSubscriptionPanel />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/?customizeDashboard=1&openWidgetCatalog=1', { replace: true });
    });
  });
});
