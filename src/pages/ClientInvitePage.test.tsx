import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ClientInvitePage from './ClientInvitePage';

const { fetchProjectInvitationPreview } = vi.hoisted(() => ({
  fetchProjectInvitationPreview: vi.fn(),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
  }),
}));

vi.mock('../services/projectInviteService', async () => {
  const actual = await vi.importActual<typeof import('../services/projectInviteService')>(
    '../services/projectInviteService',
  );
  return {
    ...actual,
    fetchProjectInvitationPreview,
    acceptProjectInvitation: vi.fn(),
  };
});

describe('ClientInvitePage', () => {
  beforeEach(() => {
    fetchProjectInvitationPreview.mockReset();
  });

  it('shows inactive message for invalid invite', async () => {
    fetchProjectInvitationPreview.mockResolvedValue(null);

    render(
      <MemoryRouter initialEntries={['/invite/bad-token']}>
        <Routes>
          <Route path="/invite/:token" element={<ClientInvitePage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Invitation unavailable' }),
    ).toBeInTheDocument();
  });

  it('shows inactive message for expired invite', async () => {
    fetchProjectInvitationPreview.mockResolvedValue({ status: 'expired' });

    render(
      <MemoryRouter initialEntries={['/invite/expired-token']}>
        <Routes>
          <Route path="/invite/:token" element={<ClientInvitePage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('This invitation is no longer active.')).toBeInTheDocument();
    });
  });

  it('renders branded invite page for pending invite', async () => {
    fetchProjectInvitationPreview.mockResolvedValue({
      status: 'pending',
      projectId: 'project-1',
      projectName: 'Riverfront Slab',
      role: 'client_viewer',
      inviteeEmail: 'client@example.com',
      inviteeName: 'Alex Client',
    });

    render(
      <MemoryRouter initialEntries={['/invite/good-token']}>
        <Routes>
          <Route path="/invite/:token" element={<ClientInvitePage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { name: "You've been invited to Concrete Calc" }),
    ).toBeInTheDocument();
    expect(screen.getByText('Riverfront Slab')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument();
  });
});
