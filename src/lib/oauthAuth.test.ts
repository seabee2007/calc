import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getOAuthCallbackUrl, signInWithProvider } from './oauthAuth';

const { signInWithOAuth } = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(),
}));

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      signInWithOAuth,
    },
  },
}));

describe('oauthAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'location', {
      value: { origin: 'http://localhost:5173' },
      writable: true,
    });
  });

  it('getOAuthCallbackUrl returns /auth/callback on current origin', () => {
    expect(getOAuthCallbackUrl()).toBe('http://localhost:5173/auth/callback');
  });

  it('signInWithProvider calls signInWithOAuth with provider, redirectTo, and Google queryParams', async () => {
    signInWithOAuth.mockResolvedValue({ error: null });

    await signInWithProvider('google');

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: 'http://localhost:5173/auth/callback',
        queryParams: { prompt: 'select_account' },
      },
    });
  });

  it('signInWithProvider does not add Google queryParams for GitHub', async () => {
    signInWithOAuth.mockResolvedValue({ error: null });

    await signInWithProvider('github');

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'github',
      options: {
        redirectTo: 'http://localhost:5173/auth/callback',
      },
    });
  });

  it('signInWithProvider throws when Supabase returns an error', async () => {
    const authError = new Error('Provider not enabled');
    signInWithOAuth.mockResolvedValue({ error: authError });

    await expect(signInWithProvider('github')).rejects.toThrow('Provider not enabled');
  });
});
