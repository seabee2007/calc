/**
 * Integration test for the legal acceptance blank-page bug.
 *
 * Root cause: App.tsx and LegalAcceptanceGate each called useLegalAcceptance().
 * Accept updated the gate's hook instance but not App's, so App kept returning
 * <LegalAcceptanceGate /> while the gate rendered null (no children).
 */
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LegalAcceptanceGate from '../components/legal/LegalAcceptanceGate';

const authUser = vi.hoisted(() => ({
  id: 'user-123',
  email: 'user@example.com',
}));

const serviceMock = vi.hoisted(() => ({
  getCurrentLegalAcceptance: vi.fn(),
  getLatestLegalAcceptance: vi.fn(),
  acceptCurrentLegalDocuments: vi.fn(),
  readLegalAcceptanceSessionCache: vi.fn(),
  clearLegalAcceptanceSessionCache: vi.fn(),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: authUser, signOut: vi.fn() }),
}));

vi.mock('../services/legalAcceptanceService', () => ({
  getCurrentLegalAcceptance: (...args: unknown[]) => serviceMock.getCurrentLegalAcceptance(...args),
  getLatestLegalAcceptance: (...args: unknown[]) => serviceMock.getLatestLegalAcceptance(...args),
  acceptCurrentLegalDocuments: (...args: unknown[]) => serviceMock.acceptCurrentLegalDocuments(...args),
  readLegalAcceptanceSessionCache: (...args: unknown[]) => serviceMock.readLegalAcceptanceSessionCache(...args),
  clearLegalAcceptanceSessionCache: (...args: unknown[]) => serviceMock.clearLegalAcceptanceSessionCache(...args),
}));

import { useLegalAcceptance } from '../hooks/useLegalAcceptance';

/** Simulates App.tsx Pattern A: single hook instance controls gate + routes. */
function AppLegalFlowSimulator() {
  const { isLoading, hasAcceptedCurrentLegal, acceptLegalDocuments } = useLegalAcceptance();

  if (isLoading) {
    return <div data-testid="app-loading">Loading…</div>;
  }

  if (!hasAcceptedCurrentLegal) {
    return (
      <LegalAcceptanceGate
        isLoading={false}
        onAccept={acceptLegalDocuments}
      />
    );
  }

  return <div data-testid="dashboard-content">Dashboard</div>;
}

const acceptedRow = {
  id: 'acc-1',
  userId: authUser.id,
  termsVersion: '2026-06-12',
  privacyVersion: '2026-06-12',
  termsAcceptedAt: '2026-06-12T10:00:00.000Z',
  privacyAcceptedAt: '2026-06-12T10:00:00.000Z',
  acceptedIp: null,
  acceptedUserAgent: 'vitest',
  createdAt: '2026-06-12T10:00:00.000Z',
};

describe('legal acceptance flow (App Pattern A)', () => {
  beforeEach(() => {
    serviceMock.getCurrentLegalAcceptance.mockReset();
    serviceMock.getLatestLegalAcceptance.mockReset();
    serviceMock.acceptCurrentLegalDocuments.mockReset();
    serviceMock.readLegalAcceptanceSessionCache.mockReturnValue(false);
    serviceMock.getCurrentLegalAcceptance.mockResolvedValue(null);
    serviceMock.getLatestLegalAcceptance.mockResolvedValue(null);
    serviceMock.acceptCurrentLegalDocuments.mockResolvedValue(acceptedRow);
  });

  it('authenticated user without acceptance sees modal', async () => {
    render(<AppLegalFlowSimulator />);

    await waitFor(() => {
      expect(screen.getByTestId('legal-acceptance-modal')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('dashboard-content')).not.toBeInTheDocument();
  });

  it('after accept resolves, dashboard renders immediately without refresh', async () => {
    const user = userEvent.setup();
    render(<AppLegalFlowSimulator />);

    await waitFor(() => {
      expect(screen.getByTestId('legal-acceptance-modal')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('legal-acceptance-checkbox'));
    await user.click(screen.getByTestId('legal-acceptance-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-content')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('legal-acceptance-modal')).not.toBeInTheDocument();
    expect(serviceMock.acceptCurrentLegalDocuments).toHaveBeenCalledWith(authUser.id);
  });

  it('duplicate accept returns existing row and still unblocks app', async () => {
    serviceMock.acceptCurrentLegalDocuments.mockResolvedValue(acceptedRow);

    const user = userEvent.setup();
    render(<AppLegalFlowSimulator />);

    await waitFor(() => {
      expect(screen.getByTestId('legal-acceptance-modal')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('legal-acceptance-checkbox'));
    await user.click(screen.getByTestId('legal-acceptance-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-content')).toBeInTheDocument();
    });
  });
});

describe('dual hook instance bug (regression)', () => {
  it('old pattern with separate hook instances leaves blank screen after accept', async () => {
    function GateWithOwnHook() {
      const gateLegal = useLegalAcceptance();

      if (gateLegal.isLoading) {
        return <div data-testid="gate-loading">Loading…</div>;
      }

      if (gateLegal.hasAcceptedCurrentLegal) {
        return null;
      }

      return (
        <button
          type="button"
          data-testid="gate-accept-button"
          onClick={() => void gateLegal.acceptLegalDocuments()}
        >
          Accept
        </button>
      );
    }

    function BrokenAppShell() {
      const appLegal = useLegalAcceptance();

      if (appLegal.isLoading) {
        return <div data-testid="app-loading">Loading…</div>;
      }

      if (!appLegal.hasAcceptedCurrentLegal) {
        return <GateWithOwnHook />;
      }

      return <div data-testid="dashboard-content">Dashboard</div>;
    }

    serviceMock.getCurrentLegalAcceptance.mockResolvedValue(null);
    serviceMock.getLatestLegalAcceptance.mockResolvedValue(null);
    serviceMock.acceptCurrentLegalDocuments.mockResolvedValue(acceptedRow);

    const user = userEvent.setup();
    const { container } = render(<BrokenAppShell />);

    await waitFor(() => {
      expect(screen.getByTestId('gate-accept-button')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('gate-accept-button'));

    await waitFor(() => {
      expect(serviceMock.acceptCurrentLegalDocuments).toHaveBeenCalled();
    });

    expect(screen.queryByTestId('dashboard-content')).not.toBeInTheDocument();
    expect(screen.queryByTestId('gate-accept-button')).not.toBeInTheDocument();
    expect(container.innerHTML).toBe('');
  });
});
