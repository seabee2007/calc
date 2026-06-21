import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import FeatureGate from '../FeatureGate';

const useSubscription = vi.fn();

vi.mock('../../../contexts/SubscriptionContext', () => ({
  useSubscription: () => useSubscription(),
}));

describe('FeatureGate', () => {
  beforeEach(() => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_ENFORCE_PLAN', 'true');
    useSubscription.mockReset();
  });

  it('renders children when the plan includes the feature', () => {
    useSubscription.mockReturnValue({
      hasFeature: () => true,
      loading: false,
    });

    render(
      <MemoryRouter>
        <FeatureGate feature="ai_concrete_chat">
          <div>Allowed content</div>
        </FeatureGate>
      </MemoryRouter>,
    );

    expect(screen.getByText('Allowed content')).toBeInTheDocument();
  });

  it('renders upgrade card when the plan lacks the feature', () => {
    useSubscription.mockReturnValue({
      hasFeature: () => false,
      loading: false,
    });

    render(
      <MemoryRouter>
        <FeatureGate feature="ai_concrete_chat">
          <div>Hidden content</div>
        </FeatureGate>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('upgrade-required-ai_concrete_chat')).toBeInTheDocument();
    expect(screen.queryByText('Hidden content')).not.toBeInTheDocument();
  });

  it('allows employee_portal for Starter plans', () => {
    useSubscription.mockReturnValue({
      hasFeature: (feature: string) => feature === 'employee_portal',
      loading: false,
    });

    render(
      <MemoryRouter>
        <FeatureGate feature="employee_portal">
          <div>Starter field portal content</div>
        </FeatureGate>
      </MemoryRouter>,
    );

    expect(screen.getByText('Starter field portal content')).toBeInTheDocument();
    expect(screen.queryByTestId('upgrade-required-employee_portal')).not.toBeInTheDocument();
  });
});
