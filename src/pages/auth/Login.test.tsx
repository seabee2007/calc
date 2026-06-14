import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('renders login path selector before showing the sign-in form', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.getByTestId('login-path-selector')).toBeInTheDocument();
    expect(screen.queryByText('Email address')).not.toBeInTheDocument();
  });

  it('renders email/password fields after choosing a login path', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    await user.click(screen.getByTestId('login-path-admin'));

    expect(screen.getByText('Email address')).toBeInTheDocument();
    expect(screen.getByText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
    expect(screen.queryByText('← Back')).not.toBeInTheDocument();
  });

  it('returns to path selection from the top Back button', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    await user.click(screen.getByTestId('login-path-field'));
    expect(screen.getByText('Email address')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(screen.getByTestId('login-path-selector')).toBeInTheDocument();
    expect(screen.queryByText('Email address')).not.toBeInTheDocument();
  });

  it('shows oauth error message from query param', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/login?error=oauth']}>
        <Login />
      </MemoryRouter>,
    );

    await user.click(screen.getByTestId('login-path-admin'));

    expect(screen.getByText('Social login failed. Please try again.')).toBeInTheDocument();
  });
});
