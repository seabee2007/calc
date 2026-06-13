import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Home from './Home';

const authState = vi.hoisted(() => ({
  loading: false,
  profileLoading: false,
  user: null as { id: string } | null,
  isEmployee: false,
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => authState,
}));

vi.mock('./OperationsDashboard', () => ({
  default: () => <div>Operations Dashboard</div>,
}));

describe('Home routing', () => {
  beforeEach(() => {
    authState.loading = false;
    authState.profileLoading = false;
  });

  it('shows marketing landing for signed-out users', () => {
    authState.user = null;
    authState.isEmployee = false;

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'Arden Project OS Project Management Suite' }),
    ).toBeInTheDocument();
  });

  it('routes signed-in owners to the workspace dashboard', async () => {
    authState.user = { id: 'owner-1' };
    authState.isEmployee = false;

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Operations Dashboard')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Get started' })).not.toBeInTheDocument();
  });
});
