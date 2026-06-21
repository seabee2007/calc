import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { EmployeeGuard } from '../RoleGuard';

const hasFeature = vi.fn();
const getLimit = vi.fn();
const fetchTeamProfiles = vi.fn();

vi.mock('../../../contexts/SubscriptionContext', () => ({
  useSubscription: () => ({
    hasFeature,
    getLimit,
    loading: false,
  }),
}));

vi.mock('../../../services/profileService', () => ({
  fetchTeamProfiles: (...args: unknown[]) => fetchTeamProfiles(...args),
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
    getLimit.mockReset();
    fetchTeamProfiles.mockReset();
    getLimit.mockReturnValue(1);
    fetchTeamProfiles.mockResolvedValue([
      { id: 'user-1', role: 'employee', employerId: 'owner-1', displayName: 'Field User' },
    ]);
  });

  it('blocks employee portal access only when the company plan lacks the feature', async () => {
    hasFeature.mockReturnValue(false);

    render(
      <MemoryRouter>
        <EmployeeGuard>
          <div>Employee content</div>
        </EmployeeGuard>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('employee-portal-blocked')).toBeInTheDocument();
    expect(screen.getByText('This feature is not included in your company’s plan. Contact your account owner.')).toBeInTheDocument();
    expect(screen.queryByText('Employee content')).not.toBeInTheDocument();
    expect(hasFeature).toHaveBeenCalledWith('employee_portal');
    expect(screen.queryByTestId('upgrade-required-employee_portal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('upgrade-cta-employee_portal')).not.toBeInTheDocument();
  });

  it('allows employee portal access when the employer Starter plan includes one accepted field seat', async () => {
    hasFeature.mockReturnValue(true);

    render(
      <MemoryRouter>
        <EmployeeGuard>
          <div>Employee content</div>
        </EmployeeGuard>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Employee content')).toBeInTheDocument();
    expect(screen.queryByTestId('upgrade-required-employee_portal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('upgrade-cta-employee_portal')).not.toBeInTheDocument();
    expect(fetchTeamProfiles).toHaveBeenCalledWith('owner-1');
    expect(getLimit).toHaveBeenCalledWith('included_field_seats');
  });

  it('does not render an upgrade card for a Starter employee with employee_portal entitlement', async () => {
    hasFeature.mockReturnValue(true);

    render(
      <MemoryRouter>
        <EmployeeGuard>
          <div>Starter employee field portal</div>
        </EmployeeGuard>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Starter employee field portal')).toBeInTheDocument();
    expect(screen.queryByTestId('upgrade-required-employee_portal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('upgrade-cta-employee_portal')).not.toBeInTheDocument();
    expect(hasFeature).toHaveBeenCalledWith('employee_portal');
  });

  it('shows a contact-owner seat-limit message without billing actions when company seats are exhausted', async () => {
    hasFeature.mockReturnValue(true);
    fetchTeamProfiles.mockResolvedValue([
      { id: 'user-1', role: 'employee', employerId: 'owner-1', displayName: 'Field User' },
      { id: 'user-2', role: 'employee', employerId: 'owner-1', displayName: 'Second User' },
    ]);

    render(
      <MemoryRouter>
        <EmployeeGuard>
          <div>Employee content</div>
        </EmployeeGuard>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('employee-portal-blocked')).toBeInTheDocument();
    expect(screen.getByText('Your company has reached its field-seat limit. Contact your account owner.')).toBeInTheDocument();
    expect(screen.queryByText('Employee content')).not.toBeInTheDocument();
    expect(screen.queryByTestId('upgrade-required-employee_portal')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /upgrade/i })).not.toBeInTheDocument();
  });
});
