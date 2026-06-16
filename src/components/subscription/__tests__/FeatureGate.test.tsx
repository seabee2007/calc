import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import FeatureGate from '../FeatureGate';
import { SubscriptionProvider } from '../../../contexts/SubscriptionContext';

const fetchSubscription = vi.fn();

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'owner-1' },
    profile: { id: 'owner-1', role: 'owner', employerId: null },
  }),
}));

vi.mock('../../../services/subscriptionService', () => ({
  fetchSubscription: (...args: unknown[]) => fetchSubscription(...args),
  resolveEffectivePlanFromRow: (row: { planId: string; status: string } | null) => {
    if (!row || row.status === 'canceled') return 'free';
    return row.planId;
  },
}));

describe('FeatureGate', () => {
  beforeEach(() => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_ENFORCE_PLAN', 'true');
    fetchSubscription.mockReset();
  });

  it('renders children when the plan includes the feature', async () => {
    fetchSubscription.mockResolvedValue({
      id: 'sub-1',
      userId: 'owner-1',
      planId: 'business',
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
      <MemoryRouter>
        <SubscriptionProvider>
          <FeatureGate feature="ai_concrete_chat">
            <div>Allowed content</div>
          </FeatureGate>
        </SubscriptionProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Allowed content')).toBeInTheDocument();
  });

  it('renders upgrade card when the plan lacks the feature', async () => {
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
      includedFieldSeats: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    render(
      <MemoryRouter>
        <SubscriptionProvider>
          <FeatureGate feature="employee_portal">
            <div>Hidden content</div>
          </FeatureGate>
        </SubscriptionProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('upgrade-required-employee_portal')).toBeInTheDocument();
    expect(screen.queryByText('Hidden content')).not.toBeInTheDocument();
  });
});
