import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EmployeeManagement from './EmployeeManagement';

const mockCreateEmployeeInvite = vi.fn();
const mockSendEmployeeInviteEmail = vi.fn();
const mockFetchPendingInvites = vi.fn();
const mockFetchTeamProfiles = vi.fn();
const mockRevokeEmployeeInvite = vi.fn();
const mockUser = { id: 'owner-1' };

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock('../../store', () => ({
  useProjectStore: () => ({
    projects: [],
    loadProjects: vi.fn(),
  }),
  usePreferencesStore: {
    getState: () => ({
      preferences: {
        soundEnabled: false,
        hapticsEnabled: false,
      },
    }),
  },
}));

vi.mock('../../services/employeeService', () => ({
  createEmployeeInvite: (...args: unknown[]) => mockCreateEmployeeInvite(...args),
  sendEmployeeInviteEmail: (...args: unknown[]) => mockSendEmployeeInviteEmail(...args),
  revokeEmployeeInvite: (...args: unknown[]) => mockRevokeEmployeeInvite(...args),
  fetchPendingInvites: (...args: unknown[]) => mockFetchPendingInvites(...args),
  fetchAssignmentsForProject: vi.fn().mockResolvedValue([]),
  assignEmployeeToProject: vi.fn(),
  removeEmployeeFromProject: vi.fn(),
  employeeInviteSignupHref: (token: string) => `https://app.ardenprojectos.com/signup?invite=${token}`,
  employeeInviteLoginHref: (token: string) => `https://app.ardenprojectos.com/login?invite=${token}`,
}));

vi.mock('../../services/profileService', () => ({
  fetchTeamProfiles: (...args: unknown[]) => mockFetchTeamProfiles(...args),
  DEFAULT_PROFILE_DISPLAY_NAME: 'Team member',
}));

const mockHasFeature = vi.fn();
const mockCanInviteTeamMember = vi.fn();

vi.mock('../../contexts/SubscriptionContext', () => ({
  useSubscription: () => ({
    hasFeature: mockHasFeature,
    canInviteTeamMember: mockCanInviteTeamMember,
  }),
}));

function renderTeamManagement() {
  return render(
    <MemoryRouter>
      <EmployeeManagement />
    </MemoryRouter>,
  );
}

describe('EmployeeManagement invite gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchPendingInvites.mockResolvedValue([]);
    mockFetchTeamProfiles.mockResolvedValue([]);
    mockHasFeature.mockImplementation((feature: string) => feature === 'employee_portal');
    mockCanInviteTeamMember.mockReturnValue(true);
    mockCreateEmployeeInvite.mockResolvedValue({
      id: 'invite-1',
      email: 'crew@example.com',
      emailSent: true,
      emailStatus: 'sent',
    });
    mockSendEmployeeInviteEmail.mockResolvedValue({
      inviteId: 'invite-1',
      email: 'crew@example.com',
      emailSent: true,
      emailStatus: 'sent',
    });
    mockRevokeEmployeeInvite.mockResolvedValue(undefined);
  });

  it('shows upgrade required for users without employee_portal', async () => {
    mockHasFeature.mockReturnValue(false);
    renderTeamManagement();

    expect(await screen.findByTestId('upgrade-required-employee_portal')).toBeInTheDocument();
    expect(screen.queryByTestId('send-invite-button')).not.toBeInTheDocument();
  });

  it('shows seat-limit upgrade card when team seats are exhausted', async () => {
    mockCanInviteTeamMember.mockReturnValue(false);
    renderTeamManagement();

    expect(await screen.findByText('Field seat limit reached')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Starter includes 1 field seat. Remove a pending invite, deactivate a field user, or upgrade for additional field seats.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Available on the Professional plan and above/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('send-invite-button')).not.toBeInTheDocument();
  });

  it('hides raw invite URLs by default and keeps copy link in the actions menu', async () => {
    mockFetchPendingInvites.mockResolvedValue([
      {
        id: 'invite-1',
        employerId: 'owner-1',
        email: 'crew@example.com',
        role: 'employee',
        status: 'pending',
        token: 'token-abc',
        expiresAt: '2099-01-01T00:00:00.000Z',
        acceptedAt: null,
        revokedAt: null,
        revokedBy: null,
        emailStatus: 'sent',
        emailSentAt: '2026-06-20T00:00:00.000Z',
        emailLastError: null,
        emailSendCount: 1,
        emailLastAttemptAt: '2026-06-20T00:00:00.000Z',
        createdAt: '2026-06-20T00:00:00.000Z',
      },
    ]);

    renderTeamManagement();

    const pendingCard = await screen.findByTestId('pending-invites-card');
    expect(within(pendingCard).getByText('crew@example.com')).toBeInTheDocument();
    expect(within(pendingCard).getByText('Sent')).toBeInTheDocument();
    expect(screen.queryByText(/signup\?invite=token-abc/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('copy-invite-link-invite-1')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('invite-actions-invite-1'));

    expect(await screen.findByTestId('resend-invite-invite-1')).toBeInTheDocument();
    expect(screen.getByTestId('copy-invite-link-invite-1')).toBeInTheDocument();
    expect(screen.getByTestId('revoke-invite-invite-1')).toBeInTheDocument();
  });

  it('confirms before revoking an invite', async () => {
    const pendingInvite = {
      id: 'invite-1',
      employerId: 'owner-1',
      email: 'crew@example.com',
      role: 'employee',
      status: 'pending',
      token: 'token-abc',
      expiresAt: '2099-01-01T00:00:00.000Z',
      acceptedAt: null,
      revokedAt: null,
      revokedBy: null,
      emailStatus: 'sent',
      emailSentAt: '2026-06-20T00:00:00.000Z',
      emailLastError: null,
      emailSendCount: 1,
      emailLastAttemptAt: '2026-06-20T00:00:00.000Z',
      createdAt: '2026-06-20T00:00:00.000Z',
    };
    mockFetchPendingInvites.mockResolvedValueOnce([pendingInvite]).mockResolvedValue([]);

    renderTeamManagement();

    await screen.findByText('crew@example.com');
    fireEvent.click(screen.getByTestId('invite-actions-invite-1'));
    fireEvent.click(await screen.findByTestId('revoke-invite-invite-1'));

    expect(await screen.findByText('Revoke invitation?')).toBeInTheDocument();
    expect(
      screen.getByText(
        'This immediately disables the invitation link and releases the reserved field seat. The recipient will no longer be able to join using this invitation.',
      ),
    ).toBeInTheDocument();
    expect(mockRevokeEmployeeInvite).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Revoke invitation' }));

    await waitFor(() => {
      expect(screen.queryByText('Revoke invitation?')).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(mockRevokeEmployeeInvite).toHaveBeenCalledWith('invite-1');
    });
    expect(await screen.findByText('Invite revoked for crew@example.com.')).toBeInTheDocument();
    expect(screen.queryByText('crew@example.com')).not.toBeInTheDocument();
  });

  it('shows sent and failed delivery messages from the invite function result', async () => {
    renderTeamManagement();

    fireEvent.change(await screen.findByTestId('invite-email-input'), {
      target: { value: 'crew@example.com' },
    });
    fireEvent.click(screen.getByTestId('send-invite-button'));

    expect(await screen.findByText('Invitation sent to crew@example.com.')).toBeInTheDocument();

    mockCreateEmployeeInvite.mockResolvedValueOnce({
      id: 'invite-2',
      email: 'failed@example.com',
      emailSent: false,
      emailStatus: 'failed',
    });

    fireEvent.change(screen.getByTestId('invite-email-input'), {
      target: { value: 'failed@example.com' },
    });
    fireEvent.click(screen.getByTestId('send-invite-button'));

    await waitFor(() => {
      expect(
        screen.getByText('Invite created, but email delivery failed. Resend from Pending Invites.'),
      ).toBeInTheDocument();
    });
  });
});
