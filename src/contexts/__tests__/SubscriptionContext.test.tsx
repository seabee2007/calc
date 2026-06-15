import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { SubscriptionProvider, useSubscription } from '../../contexts/SubscriptionContext';

const fetchSubscription = vi.fn();

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'owner-1' },
    profile: { id: 'owner-1', role: 'owner', employerId: null },
  }),
}));

vi.mock('../../services/subscriptionService', () => ({
  fetchSubscription: (...args: unknown[]) => fetchSubscription(...args),
  resolveEffectivePlanFromRow: (row: { planId: string; status: string } | null) => {
    if (!row || row.status === 'canceled') return 'starter';
    return row.planId;
  },
}));

function Probe() {
  const subscription = useSubscription();
  return (
    <div>
      <span data-testid="plan">{subscription.plan}</span>
      <span data-testid="active">{String(subscription.isActive)}</span>
      <span data-testid="logic-network">
        {String(subscription.hasFeature('logic_network'))}
      </span>
      <span data-testid="requires-upgrade">
        {String(subscription.requiresUpgrade('ai_concrete_chat'))}
      </span>
      <span data-testid="min-plan">{subscription.minPlanRequired('logic_network')}</span>
    </div>
  );
}

describe('SubscriptionContext', () => {
  beforeEach(() => {
    fetchSubscription.mockReset();
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_ENFORCE_PLAN', 'true');
  });

  it('loads subscription data for the signed-in owner', async () => {
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

    render(
      <SubscriptionProvider>
        <Probe />
      </SubscriptionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('plan')).toHaveTextContent('professional');
    });

    expect(fetchSubscription).toHaveBeenCalledWith('owner-1');
    expect(screen.getByTestId('active')).toHaveTextContent('true');
    expect(screen.getByTestId('logic-network')).toHaveTextContent('true');
    expect(screen.getByTestId('requires-upgrade')).toHaveTextContent('true');
    expect(screen.getByTestId('min-plan')).toHaveTextContent('professional');
  });

  it('defaults to starter when no subscription row exists', async () => {
    fetchSubscription.mockResolvedValue(null);

    render(
      <SubscriptionProvider>
        <Probe />
      </SubscriptionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('plan')).toHaveTextContent('starter');
    });
  });
});
