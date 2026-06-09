import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AuthCallbackPage from './AuthCallbackPage';

const { exchangeCodeForSession, navigate } = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      exchangeCodeForSession,
    },
  },
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
    Object.defineProperty(window, 'location', {
      value: {
        origin: 'http://localhost:5173',
        search: '?code=abc',
      },
      writable: true,
    });
  });

  it('exchanges code and navigates to home on success', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });

    render(
      <MemoryRouter>
        <AuthCallbackPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(exchangeCodeForSession).toHaveBeenCalledWith('abc');
      expect(navigate).toHaveBeenCalledWith('/', { replace: true });
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
