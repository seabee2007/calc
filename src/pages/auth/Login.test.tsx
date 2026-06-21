import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';

const authState = vi.hoisted(() => ({
  signIn: vi.fn(),
  refreshProfile: vi.fn(),
  user: null as { id: string; email?: string } | null,
  profile: null as { role: string; employerId: string | null } | null,
  loading: false,
  profileLoading: false,
}));

const accessState = vi.hoisted(() => ({
  authSessionResolved: true,
  accessResolutionState: 'resolved' as 'idle' | 'loading' | 'resolved' | 'error',
  access: null as {
    userId: string;
    isOwner: boolean;
    isWorkspaceAdmin: boolean;
    acceptedEmployeeMemberships: Array<{ workspaceId: string }>;
    defaultRoute: '/dashboard' | '/employee/dashboard' | '/onboarding';
  } | null,
  refreshAccess: vi.fn(),
  clearAccess: vi.fn(),
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => authState,
}));

vi.mock('../../contexts/AppAccessContext', () => ({
  useAppAccess: () => accessState,
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      resetPasswordForEmail: vi.fn(),
    },
  },
}));

vi.mock('../../components/auth/SocialLoginButtons', () => ({
  default: () => (
    <div>
      <button type="button">Continue with Google</button>
      <button type="button">Continue with GitHub</button>
    </div>
  ),
}));

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = null;
    authState.profile = null;
    authState.loading = false;
    authState.profileLoading = false;
    accessState.authSessionResolved = true;
    accessState.accessResolutionState = 'resolved';
    accessState.access = null;
  });

  it('renders the admin sign-in form by default', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.getByText('Email address')).toBeInTheDocument();
    expect(screen.getByText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
  });

  it('shows the field portal badge when intent=field is present', () => {
    render(
      <MemoryRouter initialEntries={['/login?intent=field']}>
        <Login />
      </MemoryRouter>,
    );

    expect(screen.getByText('Field Portal')).toBeInTheDocument();
    expect(screen.getByText('Email address')).toBeInTheDocument();
  });

  it('shows oauth error message from query param on the sign-in form', () => {
    render(
      <MemoryRouter initialEntries={['/login?error=oauth']}>
        <Login />
      </MemoryRouter>,
    );

    expect(screen.getByText('Social login failed. Please try again.')).toBeInTheDocument();
  });

  it('does not auto-redirect authenticated users away from /login', () => {
    authState.user = { id: 'employee-1', email: 'employee@example.com' };
    authState.profile = { role: 'employee', employerId: 'owner-1' };
    accessState.access = {
      userId: 'employee-1',
      isOwner: false,
      isWorkspaceAdmin: false,
      acceptedEmployeeMemberships: [{ workspaceId: 'owner-1' }],
      defaultRoute: '/employee/dashboard',
    };

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Login />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('authenticated-session-prompt')).toBeInTheDocument();
    expect(screen.getByText(/employee@example.com/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign In' })).not.toBeInTheDocument();
  });
});
