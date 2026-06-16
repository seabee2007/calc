import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EmployeeManagement from './EmployeeManagement';

const mockCreateEmployeeInvite = vi.fn();
const mockSendEmployeeInviteEmail = vi.fn();
const mockFetchPendingInvites = vi.fn();
const mockFetchTeamProfiles = vi.fn();

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'owner-1' } }),
}));

vi.mock('../../store', () => ({
  useProjectStore: () => ({
    projects: [],
    loadProjects: vi.fn(),
  }),
}));

vi.mock('../../services/employeeService', () => ({
  createEmployeeInvite: (...args: unknown[]) => mockCreateEmployeeInvite(...args),
  sendEmployeeInviteEmail: (...args: unknown[]) => mockSendEmployeeInviteEmail(...args),
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
      token: 'token-abc',
      email: 'crew@example.com',
    });
    mockSendEmployeeInviteEmail.mockResolvedValue({
      inviteLink: 'https://app.ardenprojectos.com/signup?invite=token-abc',
    });
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
    expect(screen.queryByTestId('send-invite-button')).not.toBeInTheDocument();
  });
});
