import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { EmployeeGuard } from '../RoleGuard';

const hasFeature = vi.fn();

vi.mock('../../../contexts/SubscriptionContext', () => ({
  useSubscription: () => ({
    hasFeature,
    loading: false,
  }),
}));

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    profile: { id: 'user-1', role: 'employee', employerId: 'owner-1' },
    loading: false,
    profileLoading: false,
  }),
}));

describe('EmployeeGuard entitlements', () => {
  beforeEach(() => {
    hasFeature.mockReset();
  });

  it('blocks employee portal access only when the effective plan lacks the feature', () => {
    hasFeature.mockReturnValue(false);

    render(
      <MemoryRouter>
        <EmployeeGuard>
          <div>Employee content</div>
        </EmployeeGuard>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('upgrade-required-employee_portal')).toBeInTheDocument();
    expect(screen.queryByText('Employee content')).not.toBeInTheDocument();
    expect(hasFeature).toHaveBeenCalledWith('employee_portal');
  });

  it('allows employee portal access when the plan includes the feature', () => {
    hasFeature.mockReturnValue(true);

    render(
      <MemoryRouter>
        <EmployeeGuard>
          <div>Employee content</div>
        </EmployeeGuard>
      </MemoryRouter>,
    );

    expect(screen.getByText('Employee content')).toBeInTheDocument();
    expect(screen.queryByTestId('upgrade-required-employee_portal')).not.toBeInTheDocument();
  });

  it('does not render an upgrade card for a Starter employee with employee_portal entitlement', () => {
    hasFeature.mockReturnValue(true);

    render(
      <MemoryRouter>
        <EmployeeGuard>
          <div>Starter employee field portal</div>
        </EmployeeGuard>
      </MemoryRouter>,
    );

    expect(screen.getByText('Starter employee field portal')).toBeInTheDocument();
    expect(screen.queryByTestId('upgrade-required-employee_portal')).not.toBeInTheDocument();
    expect(hasFeature).toHaveBeenCalledWith('employee_portal');
  });
});
