import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import LegalAcceptanceGate from './LegalAcceptanceGate';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    signOut: vi.fn(),
  }),
}));

describe('LegalAcceptanceGate', () => {
  it('shows blocking modal when not loading', () => {
    render(
      <LegalAcceptanceGate isLoading={false} onAccept={vi.fn()} />,
    );

    expect(screen.getByTestId('legal-acceptance-modal')).toBeInTheDocument();
  });

  it('shows loading spinner while legal acceptance is loading', () => {
    render(<LegalAcceptanceGate isLoading={true} onAccept={vi.fn()} />);

    expect(screen.getByTestId('legal-acceptance-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('legal-acceptance-modal')).not.toBeInTheDocument();
  });

  it('always renders modal (not blank) while gate is mounted', () => {
    render(<LegalAcceptanceGate isLoading={false} onAccept={vi.fn()} />);

    expect(screen.getByTestId('legal-acceptance-modal')).toBeInTheDocument();
  });
});
