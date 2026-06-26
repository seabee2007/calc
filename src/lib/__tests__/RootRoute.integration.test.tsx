import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import RootRoute from '../../components/routing/RootRoute';
import OnboardingRoute from '../../pages/OnboardingRoute';
import { EmployeeGuard } from '../../components/auth/RoleGuard';

const authState = vi.hoisted(() => ({
  loading: false,
  profileLoading: false,
  user: null as { id: string } | null,
  profile: null as {
    role: 'owner' | 'admin' | 'employee';
    employerId: string | null;
    firstName?: string | null;
    lastName?: string | null;
    onboardingCompletedAt?: string | null;
  } | null,
}));

const accessState = vi.hoisted(() => ({
  authSessionResolved: true,
  accessResolutionState: 'resolved' as 'idle' | 'loading' | 'resolved' | 'error',
  access: null as {
    userId: string;
    isOwner: boolean;
    isWorkspaceAdmin: boolean;
    acceptedEmployeeMemberships: Array<{ workspaceId: string; role: string }>;
    defaultRoute: '/dashboard' | '/employee/dashboard' | '/onboarding';
  } | null,
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => authState,
}));

vi.mock('../../contexts/AppAccessContext', () => ({
  useAppAccess: () => accessState,
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

describe('RootRoute', () => {
  beforeEach(() => {
    authState.loading = false;
    authState.profileLoading = false;
    authState.profile = null;
    authState.user = null;
    accessState.authSessionResolved = true;
    accessState.accessResolutionState = 'resolved';
    accessState.access = null;
  });

  it('redirects signed-out users from / to /login', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<RootRoute />} />
          <Route path="/login" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('location')).toHaveTextContent('/login');
  });

  it('redirects signed-in owners to /dashboard', async () => {
    authState.user = { id: 'owner-1' };
    authState.profile = { role: 'owner', employerId: null, onboardingCompletedAt: '2026-01-01' };
    accessState.access = {
      userId: 'owner-1',
      isOwner: true,
      isWorkspaceAdmin: false,
      isFieldEmployeeAccount: false,
      employeeMembershipRemoved: false,
      acceptedEmployeeMemberships: [],
      employeePortalAccess: null,
      defaultRoute: '/dashboard',
    };

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<RootRoute />} />
          <Route path="/dashboard" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('location')).toHaveTextContent('/dashboard');
  });

  it('redirects accepted employees to /employee/dashboard', async () => {
    authState.user = { id: 'employee-1' };
    authState.profile = {
      role: 'employee',
      employerId: 'owner-1',
      firstName: 'Pat',
      lastName: 'Lee',
      onboardingCompletedAt: '2026-01-01T00:00:00.000Z',
    };
    accessState.access = {
      userId: 'employee-1',
      isOwner: false,
      isWorkspaceAdmin: false,
      isFieldEmployeeAccount: true,
      employeeMembershipRemoved: false,
      employeePortalAccess: {
        allowed: true,
        reason: 'allowed',
        workspaceId: 'owner-1',
        employerPlanId: 'starter',
        employeeMembershipId: 'employee-1',
        seatAssigned: true,
        repaired: false,
      },
      acceptedEmployeeMemberships: [{ workspaceId: 'owner-1', role: 'employee' }],
      defaultRoute: '/employee/dashboard',
    };

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<RootRoute />} />
          <Route path="/employee/dashboard" element={<LocationProbe />} />
          <Route path="/employee/onboarding" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('location')).toHaveTextContent('/employee/dashboard');
  });

  it('does not redirect before access resolution completes', () => {
    authState.user = { id: 'owner-1' };
    authState.profile = { role: 'owner', employerId: null };
    accessState.accessResolutionState = 'loading';
    accessState.access = null;

    render(
      <MemoryRouter>
        <RootRoute />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('access-loading-surface')).toBeInTheDocument();
  });
});

describe('OnboardingRoute', () => {
  beforeEach(() => {
    authState.loading = false;
    authState.profileLoading = false;
    authState.user = null;
    authState.profile = null;
    accessState.authSessionResolved = true;
    accessState.accessResolutionState = 'resolved';
    accessState.access = null;
  });

  it('redirects signed-out users to /login', async () => {
    render(
      <MemoryRouter initialEntries={['/onboarding']}>
        <Routes>
          <Route path="/onboarding" element={<OnboardingRoute />} />
          <Route path="/login" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('location')).toHaveTextContent('/login');
  });

  it('never renders employee portal subscription errors', async () => {
    authState.user = { id: 'employee-1' };
    authState.profile = {
      role: 'employee',
      employerId: 'owner-1',
      firstName: 'Pat',
      lastName: 'Lee',
    };
    accessState.access = {
      userId: 'employee-1',
      isOwner: false,
      isWorkspaceAdmin: false,
      acceptedEmployeeMemberships: [{ workspaceId: 'owner-1', role: 'employee' }],
      defaultRoute: '/employee/dashboard',
    };

    render(
      <MemoryRouter initialEntries={['/onboarding']}>
        <Routes>
          <Route path="/onboarding" element={<OnboardingRoute />} />
          <Route path="/employee/dashboard" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('location')).toHaveTextContent('/employee/dashboard');
    expect(screen.queryByText('Workspace access unavailable')).not.toBeInTheDocument();
  });
});

describe('Signed-out employee portal guard', () => {
  beforeEach(() => {
    authState.loading = false;
    authState.profileLoading = false;
    authState.user = null;
    authState.profile = null;
    accessState.authSessionResolved = true;
    accessState.accessResolutionState = 'resolved';
    accessState.access = null;
  });

  it('redirects signed-out users from /employee/dashboard to /login', async () => {
    render(
      <MemoryRouter initialEntries={['/employee/dashboard']}>
        <Routes>
          <Route
            path="/employee/dashboard"
            element={
              <EmployeeGuard>
                <LocationProbe />
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
