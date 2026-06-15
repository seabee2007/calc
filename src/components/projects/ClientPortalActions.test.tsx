import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClientPortalActions from './ClientPortalActions';

const fetchClientPortalByProjectId = vi.fn();
const createClientPortal = vi.fn();
const copyClientPortalLink = vi.fn();

vi.mock('../../services/clientPortalService', () => ({
  fetchClientPortalByProjectId: (...args: unknown[]) => fetchClientPortalByProjectId(...args),
  createClientPortal: (...args: unknown[]) => createClientPortal(...args),
  copyClientPortalLink: (...args: unknown[]) => copyClientPortalLink(...args),
  buildClientPortalUrl: (token: string) => `https://app.example.com/client/project/${token}`,
}));

vi.mock('../subscription/FeatureGate', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./ClientPortalCreatedModal', () => ({
  default: ({
    clientName,
    onClose,
  }: {
    clientName: string;
    onClose: () => void;
  }) => (
    <div data-testid="client-portal-invite-modal">
      <span>Send Client Portal Invite</span>
      <span>{clientName}</span>
      <button type="button" onClick={onClose}>
        Close invite modal
      </button>
    </div>
  ),
}));

const existingPortal = {
  id: 'portal-1',
  projectId: 'project-1',
  contractorUserId: 'user-1',
  clientName: 'Jane Client',
  clientEmail: 'jane@client.com',
  token: 'portal-token-123',
  isActive: true,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

describe('ClientPortalActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchClientPortalByProjectId.mockResolvedValue(existingPortal);
    copyClientPortalLink.mockResolvedValue(undefined);
  });

  it('shows Send Invite Email, Copy Link, and Open Portal when a portal exists', async () => {
    render(
      <ClientPortalActions
        projectId="project-1"
        clientName="Jane Client"
        clientEmail="jane@client.com"
      />,
    );

    expect(await screen.findByRole('button', { name: 'Send Invite Email' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy Link' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Portal' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy Client Portal Link' })).not.toBeInTheDocument();
  });

  it('shows portal status and security helper text without the raw URL', async () => {
    render(<ClientPortalActions projectId="project-1" />);

    expect(await screen.findByText('Secure portal link ready')).toBeInTheDocument();
    expect(
      screen.getByText(/Anyone with this link may access the shared client portal/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('https://app.example.com/client/project/portal-token-123'),
    ).not.toBeInTheDocument();
  });

  it('opens the shared invite modal when Send Invite Email is clicked', async () => {
    const user = userEvent.setup();
    render(<ClientPortalActions projectId="project-1" />);

    await user.click(await screen.findByRole('button', { name: 'Send Invite Email' }));

    expect(screen.getByTestId('client-portal-invite-modal')).toBeInTheDocument();
    expect(screen.getByText('Jane Client')).toBeInTheDocument();
  });

  it('copies the portal link from the card', async () => {
    const user = userEvent.setup();
    render(<ClientPortalActions projectId="project-1" />);

    await user.click(await screen.findByRole('button', { name: 'Copy Link' }));

    expect(copyClientPortalLink).toHaveBeenCalledWith('portal-token-123');
  });

  it('opens the invite modal after creating a new portal', async () => {
    fetchClientPortalByProjectId.mockResolvedValueOnce(null);
    createClientPortal.mockResolvedValueOnce(existingPortal);

    const user = userEvent.setup();
    render(
      <ClientPortalActions
        projectId="project-1"
        clientName="Jane Client"
        clientEmail="jane@client.com"
      />,
    );

    await user.click(await screen.findByRole('button', { name: 'Create Client Portal' }));

    await waitFor(() => {
      expect(createClientPortal).toHaveBeenCalledWith({
        projectId: 'project-1',
        clientName: 'Jane Client',
        clientEmail: 'jane@client.com',
      });
    });
    expect(screen.getByTestId('client-portal-invite-modal')).toBeInTheDocument();
  });
});
