import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { EmployeeGuard, OwnerGuard } from '../RoleGuard';
import { clearPersistedAppAccessState, writePersistedReturnTo } from '../../../lib/appAccessPersistence';

const mocks = vi.hoisted(() => ({
  authState: {
    user: { id: 'user-1' } as { id: string } | null,
    profile: {
      id: 'user-1',
      role: 'employee',
      employerId: 'owner-1',
      onboardingCompletedAt: '2026-01-01T00:00:00.000Z',
    } as {
      id: string;
      role: 'owner' | 'admin' | 'employee';
      employerId: string | null;
      onboardingCompletedAt?: string | null;
    } | null,
    loading: false,
    profileLoading: false,
  },
  accessState: {
    authSessionResolved: true,
    accessResolutionState: 'resolved' as 'idle' | 'loading' | 'resolved' | 'error',
    access: {
      userId: 'user-1',
      isOwner: false,
      isWorkspaceAdmin: false,
      isFieldEmployeeAccount: true,
      employeeMembershipRemoved: false,
      employeePortalAccess: {
        allowed: true,
        reason: 'allowed' as const,
        workspaceId: 'owner-1',
        employerPlanId: 'starter' as const,
        employeeMembershipId: 'user-1',
        seatAssigned: true,
        repaired: false,
      },
      acceptedEmployeeMemberships: [
        {
          workspaceId: 'owner-1',
          membershipId: 'user-1',
          status: 'accepted' as const,
          role: 'employee',
          hasAssignedFieldSeat: true,
          employerPlanId: 'starter' as const,
          employerFieldPortalEnabled: true,
        },
      ],
      defaultRoute: '/employee/dashboard' as const,
    },
  },
}));

vi.mock('../../../contexts/AppAccessContext', () => ({
  useAppAccess: () => mocks.accessState,
}));

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => mocks.authState,
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

describe('EmployeeGuard entitlements', () => {
  beforeEach(() => {
    mocks.authState.user = { id: 'user-1' };
    mocks.authState.profile = {
      id: 'user-1',
      role: 'employee',
      employerId: 'owner-1',
      onboardingCompletedAt: '2026-01-01T00:00:00.000Z',
    };
    mocks.authState.loading = false;
    mocks.authState.profileLoading = false;
    mocks.accessState.authSessionResolved = true;
    mocks.accessState.accessResolutionState = 'resolved';
    mocks.accessState.access = {
      userId: 'user-1',
      isOwner: false,
      isWorkspaceAdmin: false,
      isFieldEmployeeAccount: true,
      employeeMembershipRemoved: false,
      employeePortalAccess: {
        allowed: true,
        reason: 'allowed',
        workspaceId: 'owner-1',
        employerPlanId: 'starter',
        employeeMembershipId: 'user-1',
        seatAssigned: true,
        repaired: false,
      },
      acceptedEmployeeMemberships: [
        {
          workspaceId: 'owner-1',
          membershipId: 'user-1',
          status: 'accepted',
          role: 'employee',
          hasAssignedFieldSeat: true,
          employerPlanId: 'starter',
          employerFieldPortalEnabled: true,
        },
      ],
      defaultRoute: '/employee/dashboard',
    };
  });

  it('blocks employee portal access when employer plan lacks the feature', async () => {
    mocks.accessState.access = {
      ...mocks.accessState.access,
      employeePortalAccess: {
        allowed: false,
        reason: 'field_portal_not_in_employer_plan',
        workspaceId: 'owner-1',
        employerPlanId: 'free',
        employeeMembershipId: 'user-1',
        seatAssigned: false,
        repaired: false,
      },
      acceptedEmployeeMemberships: [
        {
          workspaceId: 'owner-1',
          membershipId: 'user-1',
          status: 'accepted',
          role: 'employee',
          hasAssignedFieldSeat: true,
          employerPlanId: 'free',
          employerFieldPortalEnabled: false,
        },
      ],
      defaultRoute: '/employee/dashboard',
    };

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
    expect(screen.queryByTestId('upgrade-required-employee_portal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('upgrade-cta-employee_portal')).not.toBeInTheDocument();
  });

  it('allows employee portal access when employer Starter plan includes one accepted field seat', async () => {
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
  });

  it('shows a contact-owner seat-limit message without billing actions when company seats are exhausted', async () => {
    mocks.accessState.access = {
      ...mocks.accessState.access,
      employeePortalAccess: {
        allowed: false,
        reason: 'seat_limit_reached',
        workspaceId: 'owner-1',
        employerPlanId: 'starter',
        employeeMembershipId: 'user-1',
        seatAssigned: false,
        repaired: false,
      },
      acceptedEmployeeMemberships: [
        {
          workspaceId: 'owner-1',
          membershipId: 'user-1',
          status: 'accepted',
          role: 'employee',
          hasAssignedFieldSeat: false,
          employerPlanId: 'starter',
          employerFieldPortalEnabled: true,
        },
      ],
      defaultRoute: '/employee/dashboard',
    };

    render(
      <MemoryRouter>
        <EmployeeGuard>
          <div>Employee content</div>
        </EmployeeGuard>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('employee-portal-blocked')).toBeInTheDocument();
    expect(screen.getByText('Your company has reached its field-seat limit. Contact your account owner.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /upgrade/i })).not.toBeInTheDocument();
  });

  it('routes removed employees to the access removed message without billing errors', async () => {
    mocks.accessState.access = {
      ...mocks.accessState.access,
      employeeMembershipRemoved: true,
      isFieldEmployeeAccount: false,
      acceptedEmployeeMemberships: [],
      employeePortalAccess: {
        allowed: false,
        reason: 'membership_removed',
        workspaceId: null,
        employerPlanId: null,
        employeeMembershipId: 'user-1',
        seatAssigned: false,
        repaired: false,
      },
      defaultRoute: '/employee/dashboard',
    };

    render(
      <MemoryRouter>
        <EmployeeGuard>
          <div>Employee content</div>
        </EmployeeGuard>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('employee-portal-blocked')).toBeInTheDocument();
    expect(screen.getByText('Access removed')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Your access to this company workspace has been removed. Contact the account owner if you believe this is an error.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/subscription|billing|upgrade/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Employee content')).not.toBeInTheDocument();
  });

  it('redirects an owner away from the employee portal to dashboard', async () => {
    mocks.authState.user = { id: 'owner-1' };
    mocks.authState.profile = { id: 'owner-1', role: 'owner', employerId: null };
    mocks.accessState.access = {
      userId: 'owner-1',
      isOwner: true,
      isWorkspaceAdmin: false,
      isFieldEmployeeAccount: false,
      employeeMembershipRemoved: false,
      employeePortalAccess: null,
      acceptedEmployeeMemberships: [],
      defaultRoute: '/dashboard',
    };

    render(
      <MemoryRouter initialEntries={['/employee/dashboard']}>
        <Routes>
          <Route
            path="/employee/dashboard"
            element={
              <EmployeeGuard>
                <div>Employee content</div>
              </EmployeeGuard>
            }
          />
          <Route path="/dashboard" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('location')).toHaveTextContent('/dashboard');
  });

  it('redirects an employee away from the owner dashboard to the employee portal', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <OwnerGuard>
                <div>Owner dashboard</div>
              </OwnerGuard>
            }
          />
          <Route path="/employee/dashboard" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('location')).toHaveTextContent('/employee/dashboard');
  });

  it('redirects signed-out users to login instead of showing employee portal', async () => {
    mocks.authState.user = null;
    mocks.authState.profile = null;
    mocks.accessState.access = null;
    mocks.accessState.accessResolutionState = 'resolved';

    render(
      <MemoryRouter initialEntries={['/employee/dashboard']}>
        <Routes>
          <Route
            path="/employee/dashboard"
            element={
              <EmployeeGuard>
                <div>Employee content</div>
              </EmployeeGuard>
            }
          />
          <Route path="/login" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('location')).toHaveTextContent('/login');
  });
});

describe('app access persistence', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('clears persisted returnTo and role cache on logout cleanup', () => {
    writePersistedReturnTo('/employee/dashboard');
    localStorage.setItem('arden:app:workspaceRoleCache', '{"role":"employee"}');
    clearPersistedAppAccessState();
    expect(sessionStorage.getItem('arden:app:returnTo')).toBeNull();
    expect(localStorage.getItem('arden:app:workspaceRoleCache')).toBeNull();
  });
});
