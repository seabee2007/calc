import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { EmployeeGuard, OwnerGuard } from '../../components/auth/RoleGuard';
import RootRoute from '../../components/routing/RootRoute';
import Home from '../../pages/Home';
import {
  clearPersistedAppAccessState,
  writePersistedReturnTo,
} from '../appAccessPersistence';
import { resolvePostLoginRoute } from '../appAccessRouting';
import type { ResolvedAppAccess } from '../../services/appAccessService';
import { logoutAndRedirect } from '../../services/appLogout';
import { resolveEmployeePortalAccess } from '../employeePortalAccess';
import { usesPremiumCanvas } from '../../utils/premiumCanvasRoutes';

const mocks = vi.hoisted(() => ({
  authState: {
    user: null as { id: string } | null,
    profile: null as {
      id: string;
      role: string;
      employerId: string | null;
      onboardingCompletedAt?: string | null;
    } | null,
    loading: false,
    profileLoading: false,
  },
  accessState: {
    authSessionResolved: true,
    accessResolutionState: 'resolved' as 'idle' | 'loading' | 'resolved' | 'error',
    access: null as ResolvedAppAccess | null,
    refreshAccess: vi.fn(),
    clearAccess: vi.fn(),
  },
}));

vi.mock('../../contexts/AppAccessContext', () => ({
  useAppAccess: () => mocks.accessState,
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mocks.authState,
}));

vi.mock('../../pages/OperationsDashboard', () => ({
  default: () => <div data-testid="operations-dashboard">Current owner dashboard</div>,
}));

vi.mock('../../pages/MarketingHome', () => ({
  default: () => <div data-testid="marketing-home">Marketing</div>,
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function setOwnerAccess(overrides: Partial<ResolvedAppAccess> = {}) {
  mocks.authState.user = { id: 'owner-1' };
  mocks.authState.profile = {
    id: 'owner-1',
    role: 'owner',
    employerId: null,
    onboardingCompletedAt: '2026-01-01T00:00:00.000Z',
  };
  mocks.accessState.accessResolutionState = 'resolved';
  mocks.accessState.access = {
    userId: 'owner-1',
    isOwner: true,
    isWorkspaceAdmin: false,
    isFieldEmployeeAccount: false,
    acceptedEmployeeMemberships: [],
    employeePortalAccess: null,
    defaultRoute: '/dashboard',
    ...overrides,
  };
}

function setEmployeeAccess(overrides: Partial<ResolvedAppAccess> = {}) {
  mocks.authState.user = { id: 'employee-1' };
  mocks.authState.profile = {
    id: 'employee-1',
    role: 'employee',
    employerId: 'owner-1',
    onboardingCompletedAt: '2026-01-01T00:00:00.000Z',
  };
  mocks.accessState.accessResolutionState = 'resolved';
  mocks.accessState.access = {
    userId: 'employee-1',
    isOwner: false,
    isWorkspaceAdmin: false,
    isFieldEmployeeAccount: true,
    employeePortalAccess: {
      allowed: true,
      reason: 'allowed',
      workspaceId: 'owner-1',
      employerPlanId: 'starter',
      employeeMembershipId: 'employee-1',
      seatAssigned: true,
      repaired: false,
    },
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
    ...overrides,
  };
}

describe('App routing integration', () => {
  beforeEach(() => {
    mocks.authState.user = null;
    mocks.authState.profile = null;
    mocks.authState.loading = false;
    mocks.authState.profileLoading = false;
    mocks.accessState.authSessionResolved = true;
    mocks.accessState.accessResolutionState = 'resolved';
    mocks.accessState.access = null;
    sessionStorage.clear();
    localStorage.clear();
  });

  it('signed-out user at / is sent to /login', async () => {
    mocks.authState.user = null;
    mocks.accessState.access = null;

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

  it('signed-out user at /employee/dashboard is sent to /login', async () => {
    mocks.authState.user = null;
    mocks.accessState.access = null;

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

  it('logout clears returnTo, selected employee workspace, and role cache', async () => {
    writePersistedReturnTo('/employee/dashboard');
    localStorage.setItem('arden:app:employeePortalState', '{"workspaceId":"owner-1"}');
    localStorage.setItem('arden:app:workspaceRoleCache', '{"role":"employee"}');

    const signOut = vi.fn().mockResolvedValue(undefined);
    const navigate = vi.fn();

    await logoutAndRedirect(signOut, navigate);

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/login', { replace: true });
    expect(sessionStorage.getItem('arden:app:returnTo')).toBeNull();
    expect(localStorage.getItem('arden:app:employeePortalState')).toBeNull();
    expect(localStorage.getItem('arden:app:workspaceRoleCache')).toBeNull();
  });

  it('owner with stale employee route state lands on /dashboard', async () => {
    setOwnerAccess({
      acceptedEmployeeMemberships: [
        {
          workspaceId: 'owner-1',
          membershipId: 'owner-1',
          status: 'accepted',
          role: 'employee',
          hasAssignedFieldSeat: true,
          employerPlanId: 'starter',
          employerFieldPortalEnabled: true,
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<RootRoute />} />
          <Route path="/dashboard" element={<Home />} />
          <Route path="/employee/dashboard" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('operations-dashboard')).toBeInTheDocument();
    expect(resolvePostLoginRoute(mocks.accessState.access!, '/employee/dashboard')).toBe('/dashboard');
  });

  it('owner visiting employee portal redirects to /dashboard', async () => {
    setOwnerAccess();

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
          <Route path="/dashboard" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('location')).toHaveTextContent('/dashboard');
  });

  it('employee with stale owner route state lands on /employee/dashboard', async () => {
    setEmployeeAccess();

    render(
      <MemoryRouter initialEntries={['/projects']}>
        <Routes>
          <Route
            path="/projects"
            element={
              <OwnerGuard>
                <LocationProbe />
              </OwnerGuard>
            }
          />
          <Route path="/employee/dashboard" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('location')).toHaveTextContent('/employee/dashboard');
    expect(resolvePostLoginRoute(mocks.accessState.access!, '/dashboard')).toBe('/employee/dashboard');
  });

  it('does not redirect until auth and access resolution complete', () => {
    setOwnerAccess();
    mocks.accessState.accessResolutionState = 'loading';
    mocks.accessState.access = null;

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
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('access-loading-surface')).toBeInTheDocument();
    expect(screen.queryByTestId('location')).not.toBeInTheDocument();
  });

  it('shows loading surface while access resolution is idle', () => {
    mocks.authState.user = { id: 'owner-1' };
    mocks.authState.profile = { id: 'owner-1', role: 'owner', employerId: null };
    mocks.accessState.accessResolutionState = 'idle';
    mocks.accessState.access = null;

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<RootRoute />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('access-loading-surface')).toBeInTheDocument();
  });

  it('employee plan access comes from employer workspace subscription', () => {
    setEmployeeAccess({
      acceptedEmployeeMemberships: [
        {
          workspaceId: 'owner-1',
          membershipId: 'employee-1',
          status: 'accepted',
          role: 'employee',
          hasAssignedFieldSeat: true,
          employerPlanId: 'business',
          employerFieldPortalEnabled: true,
        },
      ],
    });

    expect(resolveEmployeePortalAccess(mocks.accessState.access, false)).toEqual({
      allowed: true,
      reason: 'allowed',
    });
  });

  it('missing employer subscription shows employer_subscription_not_found', () => {
    setEmployeeAccess({
      employeePortalAccess: {
        allowed: false,
        reason: 'employer_subscription_not_found',
        workspaceId: 'owner-1',
        employerPlanId: null,
        employeeMembershipId: 'employee-1',
        seatAssigned: false,
        repaired: false,
      },
      acceptedEmployeeMemberships: [
        {
          workspaceId: 'owner-1',
          membershipId: 'employee-1',
          status: 'accepted',
          role: 'employee',
          hasAssignedFieldSeat: true,
          employerPlanId: null,
          employerFieldPortalEnabled: false,
        },
      ],
    });

    expect(resolveEmployeePortalAccess(mocks.accessState.access, false)).toEqual({
      allowed: false,
      reason: 'employer_subscription_not_found',
    });
  });

  it('/dashboard uses premium canvas, not legacy concrete background route', () => {
    expect(usesPremiumCanvas('/dashboard')).toBe(true);
  });

  it('clears persisted access state helper removes all route caches', () => {
    writePersistedReturnTo('/employee/dashboard');
    localStorage.setItem('arden:app:workspaceRoleCache', '{}');
    localStorage.setItem('arden:app:employeePortalState', '{}');

    clearPersistedAppAccessState();

    expect(sessionStorage.getItem('arden:app:returnTo')).toBeNull();
    expect(localStorage.getItem('arden:app:workspaceRoleCache')).toBeNull();
    expect(localStorage.getItem('arden:app:employeePortalState')).toBeNull();
  });
});
