import React from 'react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClientPortalCreatedModal from './ClientPortalCreatedModal';

const sendClientPortalInviteEmail = vi.fn();

vi.mock('../../services/emailService', () => ({
  sendClientPortalInviteEmail: (...args: unknown[]) => sendClientPortalInviteEmail(...args),
}));

vi.mock('../../store', () => ({
  useSettingsStore: (selector: (state: { companySettings: { companyName: string } }) => unknown) =>
    selector({ companySettings: { companyName: 'Concrete Co' } }),
}));

vi.mock('../../services/clientPortalService', () => ({
  buildClientPortalUrl: (token: string) => `https://app.example.com/client/project/${token}`,
}));

describe('ClientPortalCreatedModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendClientPortalInviteEmail.mockResolvedValue({ ok: true });
  });

  function renderModal(overrides: Partial<React.ComponentProps<typeof ClientPortalCreatedModal>> = {}) {
    return render(
      <ClientPortalCreatedModal
        clientName="Jane Client"
        clientEmail="jane@client.com"
        token="portal-token-123"
        projectId="project-1"
        onClose={vi.fn()}
        {...overrides}
      />,
    );
  }

  it('shows the Send Client Portal Invite title', () => {
    renderModal();
    expect(screen.getByText('Send Client Portal Invite')).toBeInTheDocument();
  });

  it('renders footer actions with short labels', () => {
    renderModal();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy portal link' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open client portal' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send invite email' })).toBeInTheDocument();
  });

  it('defaults the client email from props', () => {
    renderModal();
    expect(screen.getByPlaceholderText('client@example.com')).toHaveValue('jane@client.com');
  });

  it('defaults the invite subject', () => {
    renderModal();
    expect(screen.getByDisplayValue('Your project portal is ready')).toBeInTheDocument();
  });

  it('shows secure portal link helper instead of raw URL by default', () => {
    renderModal();
    expect(screen.getByText('Secure portal link ready')).toBeInTheDocument();
    expect(
      screen.queryByText('https://app.example.com/client/project/portal-token-123'),
    ).not.toBeInTheDocument();
  });

  it('shows message preview without exposing the raw portal URL', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole('button', { name: 'Email preview' }));
    const preview = screen.getByLabelText('Email message preview');
    expect(preview).toHaveTextContent('Hi Jane Client,');
    expect(preview).toHaveTextContent('Please keep this link private.');
    expect(preview).not.toHaveTextContent('https://app.example.com/client/project/portal-token-123');
  });

  it('requires a client email before sending', async () => {
    const user = userEvent.setup();
    renderModal();

    const emailInput = screen.getByPlaceholderText('client@example.com');
    await user.clear(emailInput);
    await user.click(screen.getByRole('button', { name: 'Send invite email' }));

    expect(sendClientPortalInviteEmail).not.toHaveBeenCalled();
    expect(
      screen.getByText('Add a client email before sending the invite.'),
    ).toBeInTheDocument();
  });

  it('requires a valid client email before sending', async () => {
    const user = userEvent.setup();
    renderModal();

    const emailInput = screen.getByPlaceholderText('client@example.com');
    await user.clear(emailInput);
    await user.type(emailInput, 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Send invite email' }));

    expect(sendClientPortalInviteEmail).not.toHaveBeenCalled();
    expect(
      screen.getByText('Enter a valid client email address to send the invite.'),
    ).toBeInTheDocument();
  });

  it('sends the invite email with subject and message template', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSent = vi.fn();
    render(
      <ClientPortalCreatedModal
        clientName="Jane Client"
        clientEmail="jane@client.com"
        token="portal-token-123"
        projectId="project-1"
        onClose={onClose}
        onSent={onSent}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Send invite email' }));

    expect(sendClientPortalInviteEmail).toHaveBeenCalledWith({
      portalToken: 'portal-token-123',
      projectId: 'project-1',
      recipientEmail: 'jane@client.com',
      emailSubject: 'Your project portal is ready',
      messageBody: expect.not.stringContaining('{portalLink}'),
    });
    expect(onClose).toHaveBeenCalled();
    expect(onSent).toHaveBeenCalled();
    expect(screen.queryByText('Client portal invite sent.')).not.toBeInTheDocument();
  });

  it('keeps the portal link visible after a failed send', async () => {
    const user = userEvent.setup();
    sendClientPortalInviteEmail.mockRejectedValueOnce(new Error('Provider unavailable'));
    renderModal();

    await user.click(screen.getByRole('button', { name: 'Send invite email' }));

    expect(
      screen.getByText('Secure portal link ready'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Provider unavailable').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Copy portal link' })).toBeEnabled();
  });

  it('shows a draft state when email sending is disabled', async () => {
    sendClientPortalInviteEmail.mockResolvedValueOnce({
      ok: true,
      disabled: true,
      skipped: true,
      message: 'Email sending is disabled.',
    });

    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('button', { name: 'Send invite email' }));

    expect(
      screen.getByText(/Email sending is not configured yet. Copy the link to share manually./i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send invite email' })).toBeDisabled();
  });
});

describe('ClientPortalCreatedModal layout', () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  const source = readFileSync(
    path.join(repoRoot, 'src/components/projects/ClientPortalCreatedModal.tsx'),
    'utf8',
  );

  it('uses short footer labels with nowrap layout', () => {
    expect(source).toContain('whitespace-nowrap');
    expect(source).toContain('aria-label="Copy portal link"');
    expect(source).toContain('aria-label="Send invite email"');
    expect(source).not.toContain('Copy Link');
    expect(source).not.toContain('Open Portal');
    expect(source).not.toContain('Send Invite Email');
  });
});
