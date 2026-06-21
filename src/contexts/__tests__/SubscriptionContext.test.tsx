import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { SubscriptionProvider, useSubscription } from '../../contexts/SubscriptionContext';
import { AppAccessProvider } from '../../contexts/AppAccessContext';

const fetchSubscription = vi.fn();
let authState = {
  user: { id: 'owner-1' } as { id: string } | null,
  profile: { id: 'owner-1', role: 'owner', employerId: null as string | null },
  loading: false,
  profileLoading: false,
};

const resolveAppAccess = vi.fn();

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => authState,
}));

vi.mock('../../services/appAccessService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/appAccessService')>();
  return {
    ...actual,
    resolveAppAccess: (...args: unknown[]) => resolveAppAccess(...args),
  };
});

vi.mock('../../services/subscriptionService', () => ({
  fetchSubscription: (...args: unknown[]) => fetchSubscription(...args),
  resolveEffectivePlanFromRow: (row: { planId: string; status: string } | null) => {
    if (!row || row.status === 'canceled') return 'free';
    return row.planId;
  },
}));

function Probe() {
  const subscription = useSubscription();
  return (
    <div>
      <span data-testid="plan">{subscription.plan}</span>
      <span data-testid="loading">{String(subscription.loading)}</span>
    </div>
  );
}

function Harness() {
  return (
    <AppAccessProvider>
      <SubscriptionProvider>
        <Probe />
      </SubscriptionProvider>
    </AppAccessProvider>
  );
}

describe('SubscriptionContext', () => {
  beforeEach(() => {
    fetchSubscription.mockReset();
    resolveAppAccess.mockReset();
    authState = {
      user: { id: 'owner-1' },
      profile: { id: 'owner-1', role: 'owner', employerId: null },
      loading: false,
      profileLoading: false,
    };
    resolveAppAccess.mockResolvedValue({
      userId: 'owner-1',
      isOwner: true,
      isWorkspaceAdmin: false,
      acceptedEmployeeMemberships: [],
      defaultRoute: '/dashboard',
    });
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_ENFORCE_PLAN', 'true');
  });

  it('loads subscription data for the signed-in owner after access resolves', async () => {
    fetchSubscription.mockResolvedValue({
      id: 'sub-1',
      userId: 'owner-1',
      planId: 'professional',
      status: 'active',
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      trialEnd: null,
      cancelAtPeriodEnd: false,
      activeProjectLimit: null,
      includedFieldSeats: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    render(<Harness />);

    await waitFor(() => {
      expect(screen.getByTestId('plan')).toHaveTextContent('professional');
    });

    expect(fetchSubscription).toHaveBeenCalledWith('owner-1');
  });

  it('loads the employer subscription for employee portal entitlements', async () => {
    authState = {
      user: { id: 'employee-1' },
      profile: { id: 'employee-1', role: 'employee', employerId: 'owner-1' },
      loading: false,
      profileLoading: false,
    };
    resolveAppAccess.mockResolvedValue({
      userId: 'employee-1',
      isOwner: false,
      isWorkspaceAdmin: false,
      acceptedEmployeeMemberships: [
        {
          workspaceId: 'owner-1',
          membershipId: 'employee-1',
          status: 'accepted',
          role: 'employee',
          hasAssignedFieldSeat: true,
          employerPlanId: 'starter',
          employerFieldPortalEnabled: true,
        },
      ],
      defaultRoute: '/employee/dashboard',
    });
    fetchSubscription.mockResolvedValue({
      id: 'sub-1',
      userId: 'owner-1',
      planId: 'starter',
      status: 'active',
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      trialEnd: null,
      cancelAtPeriodEnd: false,
      activeProjectLimit: null,
      includedFieldSeats: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    render(<Harness />);

    await waitFor(() => {
      expect(screen.getByTestId('plan')).toHaveTextContent('starter');
    });

    expect(fetchSubscription).toHaveBeenCalledWith('owner-1');
    expect(fetchSubscription).not.toHaveBeenCalledWith('employee-1');
  });
});
