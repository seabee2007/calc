import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SignUp from './SignUp';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    signUp: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}));

vi.mock('../../services/employeeService', () => ({
  acceptInviteForCurrentUser: vi.fn(),
  fetchEmployeeInvitePreview: vi.fn(),
}));

vi.mock('../../components/auth/SocialLoginButtons', () => ({
  default: ({ onBeforeSignIn }: { onBeforeSignIn?: () => boolean | void }) => (
    <div>
      <button type="button" onClick={() => onBeforeSignIn?.()}>
        Continue with Google
      </button>
      <button type="button" onClick={() => onBeforeSignIn?.()}>
        Continue with GitHub
      </button>
    </div>
  ),
}));

vi.mock('../../components/ui/Modal', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('SignUp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all required fields and actions', () => {
    render(
      <MemoryRouter>
        <SignUp />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Create your account' })).toBeInTheDocument();
    expect(screen.getByText('First name *')).toBeInTheDocument();
    expect(screen.getByText('Last name *')).toBeInTheDocument();
    expect(screen.getByText('Email address *')).toBeInTheDocument();
    expect(screen.getByText('Password *')).toBeInTheDocument();
    expect(screen.getByText('Confirm password *')).toBeInTheDocument();
    expect(screen.getByText('Phone (optional)')).toBeInTheDocument();
    expect(screen.getByText('Business address (optional)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Account' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue with GitHub' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    // Agreement checkbox — find by role since label text contains nested elements
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('shows required-field errors when submitting empty form', async () => {
    render(
      <MemoryRouter>
        <SignUp />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() => {
      expect(screen.getByText('First name is required.')).toBeInTheDocument();
      expect(screen.getByText('Last name is required.')).toBeInTheDocument();
      expect(screen.getByText('Email address is required.')).toBeInTheDocument();
      expect(screen.getByText('Password is required.')).toBeInTheDocument();
    });
  });

  it('shows agreement error when OAuth button clicked without accepting', async () => {
    render(
      <MemoryRouter>
        <SignUp />
      </MemoryRouter>,
    );

    // Do NOT check the agreement box, then click Google
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));

    await waitFor(() => {
      expect(
        screen.getByText(
          'You must accept the User Agreement and Privacy Policy before creating an account.',
        ),
      ).toBeInTheDocument();
    });
  });

  it('shows password mismatch error on submit', async () => {
    render(
      <MemoryRouter>
        <SignUp />
      </MemoryRouter>,
    );

    // Fill required fields; provide mismatched passwords
    await userEvent.type(screen.getByPlaceholderText('Bob'), 'Bob');
    await userEvent.type(screen.getByPlaceholderText('Smith'), 'Smith');
    await userEvent.type(screen.getByPlaceholderText('you@company.com'), 'test@example.com');
    await userEvent.type(screen.getByLabelText('Password *'), 'Password1');
    await userEvent.type(screen.getByLabelText('Confirm password *'), 'Different1');
    await userEvent.click(screen.getByRole('checkbox'));

    // Submit — full Zod object validation runs the cross-field refine
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() => {
      expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
    });
  });
});
