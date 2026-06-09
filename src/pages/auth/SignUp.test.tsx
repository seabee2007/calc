import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SignUp from './SignUp';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    signUp: vi.fn(),
  }),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock('../../services/employeeService', () => ({
  acceptInviteForCurrentUser: vi.fn(),
  fetchEmployeeInvitePreview: vi.fn(),
}));

vi.mock('../../components/auth/SocialLoginButtons', () => ({
  default: () => (
    <div>
      <button type="button">Continue with Google</button>
      <button type="button">Continue with GitHub</button>
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

  it('renders signup fields, social buttons, and shared auth copy', () => {
    render(
      <MemoryRouter>
        <SignUp />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Create your account' })).toBeInTheDocument();
    expect(
      screen.getByText('Start building estimates, proposals, and schedules in one workspace.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Email address')).toBeInTheDocument();
    expect(screen.getByText('Password')).toBeInTheDocument();
    expect(screen.getByText('Confirm Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Account' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue with GitHub' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });
});
