import React from 'react';
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

  it('renders footer actions with Cancel, Copy Link, and Send Invite Email', () => {
    renderModal();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy Link' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Portal' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send Invite Email' })).toBeInTheDocument();
  });

  it('defaults the client email from props', () => {
    renderModal();
    expect(screen.getByPlaceholderText('client@example.com')).toHaveValue('jane@client.com');
  });

  it('defaults the invite subject', () => {
    renderModal();
    expect(screen.getByDisplayValue('Your project portal is ready')).toBeInTheDocument();
  });

  it('shows the portal link preview and security helper text', () => {
    renderModal();
    expect(
      screen.getByText('https://app.example.com/client/project/portal-token-123'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Anyone with this link may access the shared client portal/i),
    ).toBeInTheDocument();
  });

  it('includes the portal link in the message preview', () => {
    renderModal();
    expect(screen.getByLabelText('Email message preview')).toHaveTextContent(
      'https://app.example.com/client/project/portal-token-123',
    );
  });

  it('requires a client email before sending', async () => {
    const user = userEvent.setup();
    renderModal();

    const emailInput = screen.getByPlaceholderText('client@example.com');
    await user.clear(emailInput);
    await user.click(screen.getByRole('button', { name: 'Send Invite Email' }));

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
    await user.click(screen.getByRole('button', { name: 'Send Invite Email' }));

    expect(sendClientPortalInviteEmail).not.toHaveBeenCalled();
    expect(
      screen.getByText('Enter a valid client email address to send the invite.'),
    ).toBeInTheDocument();
  });

  it('sends the invite email with subject and message template', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('button', { name: 'Send Invite Email' }));

    expect(sendClientPortalInviteEmail).toHaveBeenCalledWith({
      portalToken: 'portal-token-123',
      projectId: 'project-1',
      recipientEmail: 'jane@client.com',
      emailSubject: 'Your project portal is ready',
      messageBody: expect.stringContaining('{portalLink}'),
    });
    expect(await screen.findByText('Client portal invite sent.')).toBeInTheDocument();
  });

  it('keeps the portal link visible after a failed send', async () => {
    const user = userEvent.setup();
    sendClientPortalInviteEmail.mockRejectedValueOnce(new Error('Provider unavailable'));
    renderModal();

    await user.click(screen.getByRole('button', { name: 'Send Invite Email' }));

    expect(
      screen.getByText('https://app.example.com/client/project/portal-token-123'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Provider unavailable').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Copy Link' })).toBeEnabled();
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

    await user.click(screen.getByRole('button', { name: 'Send Invite Email' }));

    expect(
      screen.getByText(/Email sending is not configured yet. Copy the link to share manually./i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send Invite Email' })).toBeDisabled();
  });
});
