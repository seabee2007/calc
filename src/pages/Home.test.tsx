import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import Home from './Home';

const authState = vi.hoisted(() => ({
  loading: false,
  profileLoading: false,
  user: null as { id: string } | null,
  profile: null as { role: 'owner' | 'admin' | 'employee'; employerId: string | null } | null,
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

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => authState,
}));

vi.mock('../contexts/AppAccessContext', () => ({
  useAppAccess: () => accessState,
}));

vi.mock('./OperationsDashboard', () => ({
  default: () => <div>Operations Dashboard</div>,
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

describe('Home routing', () => {
  beforeEach(() => {
    authState.loading = false;
    authState.profileLoading = false;
    authState.profile = null;
    authState.user = null;
    accessState.authSessionResolved = true;
    accessState.accessResolutionState = 'resolved';
    accessState.access = null;
  });

  it('routes signed-in owners to the workspace dashboard', async () => {
    authState.user = { id: 'owner-1' };
    authState.profile = { role: 'owner', employerId: null };
    accessState.access = {
      userId: 'owner-1',
      isOwner: true,
      isWorkspaceAdmin: false,
      acceptedEmployeeMemberships: [],
      defaultRoute: '/dashboard',
    };

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<Home />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Operations Dashboard')).toBeInTheDocument();
    });
  });

  it('redirects signed-in employees away from owner dashboard', async () => {
    authState.user = { id: 'employee-1' };
    authState.profile = { role: 'employee', employerId: 'owner-1' };
    accessState.access = {
      userId: 'employee-1',
      isOwner: false,
      isWorkspaceAdmin: false,
      acceptedEmployeeMemberships: [{ workspaceId: 'owner-1', role: 'employee' }],
      defaultRoute: '/employee/dashboard',
    };

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<Home />} />
          <Route path="/employee/dashboard" element={<LocationProbe />} />
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
        <Home />
      </MemoryRouter>,
    );

    expect(screen.getByText('Loading your workspace…')).toBeInTheDocument();
  });
});
