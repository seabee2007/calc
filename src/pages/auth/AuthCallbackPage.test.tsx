import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AuthCallbackPage from './AuthCallbackPage';

const { exchangeCodeForSession, getSession, getUser, navigate } = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  getSession: vi.fn(),
  getUser: vi.fn(),
  navigate: vi.fn(),
}));

const { applyFieldEmployeeProfileLinking, loadAuthenticatedUserProfile } = vi.hoisted(() => ({
  applyFieldEmployeeProfileLinking: vi.fn().mockResolvedValue(undefined),
  loadAuthenticatedUserProfile: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      exchangeCodeForSession,
      getSession,
      getUser,
    },
  },
}));

vi.mock('../../lib/loginIntent', () => ({
  consumeLoginIntent: vi.fn(() => 'field'),
}));

vi.mock('./postAuthRouting', () => ({
  applyFieldEmployeeProfileLinking,
  loadAuthenticatedUserProfile,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

describe('AuthCallbackPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    getUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'emp@example.com' } } });
    loadAuthenticatedUserProfile.mockResolvedValue({ id: 'user-1', role: 'employee' });
    Object.defineProperty(window, 'location', {
      value: {
        origin: 'http://localhost:5173',
        search: '?code=abc',
      },
      writable: true,
    });
  });

  it('uses existing session without re-exchanging code (StrictMode-safe)', async () => {
    getSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
      error: null,
    });

    render(
      <MemoryRouter>
        <AuthCallbackPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(exchangeCodeForSession).not.toHaveBeenCalled();
      expect(applyFieldEmployeeProfileLinking).toHaveBeenCalled();
      expect(navigate).toHaveBeenCalledWith('/employee/dashboard', { replace: true });
    });
  });

  it('exchanges code and routes employees to field portal', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });

    render(
      <MemoryRouter>
        <AuthCallbackPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(exchangeCodeForSession).toHaveBeenCalledWith('abc');
      expect(navigate).toHaveBeenCalledWith('/employee/dashboard', { replace: true });
    });
  });

  it('navigates to login when code is missing', async () => {
    Object.defineProperty(window, 'location', {
      value: {
        origin: 'http://localhost:5173',
        search: '',
      },
      writable: true,
    });

    render(
      <MemoryRouter>
        <AuthCallbackPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(exchangeCodeForSession).not.toHaveBeenCalled();
      expect(navigate).toHaveBeenCalledWith('/login?error=missing-code', { replace: true });
    });
  });

  it('navigates to login with oauth error on failure', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error('Invalid code') });

    render(
      <MemoryRouter>
        <AuthCallbackPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(exchangeCodeForSession).toHaveBeenCalledWith('abc');
      expect(navigate).toHaveBeenCalledWith('/login?error=oauth', {
        replace: true,
        state: { message: 'Social login failed. Please try again.' },
      });
    });
  });
});
