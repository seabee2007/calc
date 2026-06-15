import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    signIn: vi.fn(),
    refreshProfile: vi.fn(),
    user: null,
    profile: null,
    loading: false,
  }),
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
});
