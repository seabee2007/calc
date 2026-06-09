import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    signIn: vi.fn(),
    refreshProfile: vi.fn(),
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

  it('renders email/password fields and social login buttons', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    expect(screen.getByText('Email address')).toBeInTheDocument();
    expect(screen.getByText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue with GitHub' })).toBeInTheDocument();
  });

  it('shows oauth error message from query param', () => {
    render(
      <MemoryRouter initialEntries={['/login?error=oauth']}>
        <Login />
      </MemoryRouter>,
    );

    expect(screen.getByText('Social login failed. Please try again.')).toBeInTheDocument();
  });
});
