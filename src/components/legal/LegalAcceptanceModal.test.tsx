import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LegalAcceptanceModal from './LegalAcceptanceModal';
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
} from '../../constants/legalVersions';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    signOut: vi.fn(),
  }),
}));

describe('LegalAcceptanceModal', () => {
  const renderModal = (props: React.ComponentProps<typeof LegalAcceptanceModal>) =>
    render(
      <MemoryRouter>
        <LegalAcceptanceModal {...props} />
      </MemoryRouter>,
    );

  it('shows current terms and privacy versions', () => {
    renderModal({ onAccept: vi.fn() });

    expect(screen.getByTestId('legal-acceptance-versions')).toHaveTextContent(
      `Terms of Service version: ${CURRENT_TERMS_VERSION}`,
    );
    expect(screen.getByTestId('legal-acceptance-versions')).toHaveTextContent(
      `Privacy Policy version: ${CURRENT_PRIVACY_VERSION}`,
    );
  });

  it('disables Accept until checkbox is checked', async () => {
    const user = userEvent.setup();
    renderModal({ onAccept: vi.fn() });

    const acceptButton = screen.getByTestId('legal-acceptance-submit');
    expect(acceptButton).toBeDisabled();

    await user.click(screen.getByTestId('legal-acceptance-checkbox'));
    expect(acceptButton).toBeEnabled();
  });

  it('does not render a dismiss close control', () => {
    renderModal({ onAccept: vi.fn() });

    expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/close/i)).not.toBeInTheDocument();
  });

  it('calls onAccept when checkbox is checked and Accept is clicked', async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn().mockResolvedValue(undefined);

    renderModal({ onAccept });

    await user.click(screen.getByTestId('legal-acceptance-checkbox'));
    await user.click(screen.getByTestId('legal-acceptance-submit'));

    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it('does not dismiss when Escape is pressed', async () => {
    const onAccept = vi.fn();

    renderModal({ onAccept });

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.getByTestId('legal-acceptance-modal')).toBeInTheDocument();
    expect(onAccept).not.toHaveBeenCalled();
  });
});
