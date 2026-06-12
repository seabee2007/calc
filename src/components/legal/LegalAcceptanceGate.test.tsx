import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import LegalAcceptanceGate from './LegalAcceptanceGate';

const hookState = vi.hoisted(() => ({
  isLoading: false,
  hasAcceptedCurrentLegal: false,
  acceptLegalDocuments: vi.fn(),
}));

vi.mock('../../hooks/useLegalAcceptance', () => ({
  useLegalAcceptance: () => hookState,
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    signOut: vi.fn(),
  }),
}));

describe('LegalAcceptanceGate', () => {
  it('shows blocking modal when user has not accepted current legal documents', () => {
    hookState.isLoading = false;
    hookState.hasAcceptedCurrentLegal = false;

    render(
      <LegalAcceptanceGate>
        <div data-testid="protected-app">App content</div>
      </LegalAcceptanceGate>,
    );

    expect(screen.getByTestId('legal-acceptance-modal')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-app')).not.toBeInTheDocument();
  });

  it('renders children when user has accepted current legal documents', () => {
    hookState.isLoading = false;
    hookState.hasAcceptedCurrentLegal = true;

    render(
      <LegalAcceptanceGate>
        <div data-testid="protected-app">App content</div>
      </LegalAcceptanceGate>,
    );

    expect(screen.queryByTestId('legal-acceptance-modal')).not.toBeInTheDocument();
    expect(screen.getByTestId('protected-app')).toBeInTheDocument();
  });

  it('shows loading spinner while legal acceptance is loading', () => {
    hookState.isLoading = true;
    hookState.hasAcceptedCurrentLegal = false;

    render(<LegalAcceptanceGate />);

    expect(screen.getByTestId('legal-acceptance-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('legal-acceptance-modal')).not.toBeInTheDocument();
  });
});
