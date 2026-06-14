import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Navbar from './Navbar';

const mockUseAuth = vi.fn();

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../store/toolsModalStore', () => ({
  useToolsModalStore: () => ({ open: vi.fn() }),
}));

vi.mock('../field/FieldNotificationsBell', () => ({
  default: () => <div data-testid="notifications-bell" />,
}));

vi.mock('../share/ShareInviteModal', () => ({
  default: () => null,
}));

vi.mock('../survey/PilotSurveyModal', () => ({
  default: () => null,
}));

describe('Navbar logged-out mobile', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: null,
      profile: null,
      signOut: vi.fn(),
      isOwner: false,
      isEmployee: false,
    });
  });

  it('renders sign in and sign up controls', () => {
    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign up' })).toBeInTheDocument();
  });
});

describe('Navbar logged-in owner', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', email: 'owner@example.com' },
      profile: { displayName: 'Owner' },
      signOut: vi.fn(),
      isOwner: true,
      isEmployee: false,
    });
  });

  it('renders Projects in the top navbar', () => {
    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    );

    const projectsLink = screen.getByRole('link', { name: 'Projects' });
    expect(projectsLink).toHaveAttribute('href', '/projects');
  });

  it('highlights Projects when on /projects route', () => {
    render(
      <MemoryRouter initialEntries={['/projects']}>
        <Navbar />
      </MemoryRouter>,
    );

    const projectsLink = screen.getByRole('link', { name: 'Projects' });
    expect(projectsLink.className).toContain('bg-white/15');
  });

  it('does not show Projects in the profile dropdown', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Profile menu' }));

    expect(screen.getAllByRole('link', { name: 'Projects' })).toHaveLength(1);
    expect(screen.getByText('Company settings')).toBeInTheDocument();
  });
});
