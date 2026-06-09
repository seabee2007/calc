import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SocialLoginButtons from '../../components/auth/SocialLoginButtons';
import * as oauthAuth from '../../lib/oauthAuth';

vi.mock('../../lib/oauthAuth', () => ({
  signInWithProvider: vi.fn(),
}));

describe('SocialLoginButtons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Google and GitHub buttons', () => {
    render(<SocialLoginButtons />);

    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue with GitHub' })).toBeInTheDocument();
  });

  it('calls signInWithProvider with google when Google button is clicked', async () => {
    vi.mocked(oauthAuth.signInWithProvider).mockResolvedValue(undefined);

    render(<SocialLoginButtons />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));

    await waitFor(() => {
      expect(oauthAuth.signInWithProvider).toHaveBeenCalledWith('google');
    });
  });

  it('calls signInWithProvider with github when GitHub button is clicked', async () => {
    vi.mocked(oauthAuth.signInWithProvider).mockResolvedValue(undefined);

    render(<SocialLoginButtons />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue with GitHub' }));

    await waitFor(() => {
      expect(oauthAuth.signInWithProvider).toHaveBeenCalledWith('github');
    });
  });

  it('shows error message when OAuth fails', async () => {
    vi.mocked(oauthAuth.signInWithProvider).mockRejectedValue(new Error('OAuth failed'));
    const onError = vi.fn();

    render(<SocialLoginButtons onError={onError} />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Social login failed. Please try again.');
    });
  });
});
