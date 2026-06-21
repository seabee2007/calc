import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LegalAcceptanceGate from './LegalAcceptanceGate';

const mocks = vi.hoisted(() => ({
  signOut: vi.fn().mockResolvedValue(undefined),
  logoutAndRedirect: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    signOut: mocks.signOut,
  }),
}));

vi.mock('../../services/appLogout', () => ({
  logoutAndRedirect: mocks.logoutAndRedirect,
}));

describe('LegalAcceptanceGate', () => {
  it('shows blocking modal when not loading', () => {
    render(
      <MemoryRouter>
        <LegalAcceptanceGate isLoading={false} onAccept={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('legal-acceptance-modal')).toBeInTheDocument();
  });

  it('shows loading spinner while legal acceptance is loading', () => {
    render(
      <MemoryRouter>
        <LegalAcceptanceGate isLoading={true} onAccept={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('legal-acceptance-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('legal-acceptance-modal')).not.toBeInTheDocument();
  });

  it('shows session error card with Retry and Sign Out', async () => {
    const onRetry = vi.fn();
    render(
      <MemoryRouter>
        <LegalAcceptanceGate
          isLoading={false}
          onAccept={vi.fn()}
          isSessionError
          error="JWT issued at future"
          onRetry={onRetry}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('legal-acceptance-session-error')).toBeInTheDocument();
    expect(screen.queryByTestId('legal-acceptance-modal')).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByTestId('legal-acceptance-session-retry'));
    await user.click(screen.getByTestId('legal-acceptance-session-signout'));

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(mocks.logoutAndRedirect).toHaveBeenCalledTimes(1);
  });

  it('never renders blank after SELECT failure', () => {
    const { container } = render(
      <MemoryRouter>
        <LegalAcceptanceGate
          isLoading={false}
          onAccept={vi.fn()}
          isSessionError
          error="JWT issued at future"
        />
      </MemoryRouter>,
    );

    expect(container.innerHTML).not.toBe('');
    expect(screen.getByTestId('legal-acceptance-session-error')).toBeInTheDocument();
  });
});
