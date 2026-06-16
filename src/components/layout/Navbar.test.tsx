import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Navbar from './Navbar';

const mockUseAuth = vi.fn();

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../contexts/SubscriptionContext', () => ({
  useSubscription: () => ({
    plan: 'starter',
    status: null,
    isActive: false,
    subscription: null,
    loading: false,
    refresh: vi.fn(),
    limits: {},
    hasFeature: vi.fn(),
    getLimit: vi.fn(),
    canCreateProject: vi.fn(),
    canInviteFieldSeat: vi.fn(),
    requiresUpgrade: vi.fn(),
    minPlanRequired: vi.fn(),
  }),
}));

const mockOpenTools = vi.fn();

vi.mock('../../store/toolsModalStore', () => ({
  useToolsModalStore: (selector: (state: { open: () => void; isOpen: boolean }) => unknown) =>
    selector({ open: mockOpenTools, isOpen: false }),
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
      profile: { displayName: 'Owner', role: 'owner' },
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

  it('renders Tools in the top navbar and opens the tools modal', async () => {
    const user = userEvent.setup();
    mockOpenTools.mockClear();

    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    );

    const toolsButton = screen.getByRole('button', { name: 'Tools' });
    expect(toolsButton).toBeInTheDocument();

    await user.click(toolsButton);
    expect(mockOpenTools).toHaveBeenCalledTimes(1);
  });

  it('highlights Tools when on a calculator route', () => {
    render(
      <MemoryRouter initialEntries={['/calculator/concrete']}>
        <Navbar />
      </MemoryRouter>,
    );

    const toolsButton = screen.getByRole('button', { name: 'Tools' });
    expect(toolsButton.className).toContain('bg-white/15');
  });

  it('does not show Tools in the profile dropdown', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Profile menu' }));

    expect(screen.queryByText('Tools')).not.toBeInTheDocument();
    expect(screen.getByText('Help')).toBeInTheDocument();
  });
});

describe('Navbar logged-in field employee', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: { id: 'emp-1', email: 'field@example.com' },
      profile: { displayName: 'Field User', role: 'employee' },
      signOut: vi.fn(),
      isOwner: false,
      isEmployee: true,
    });
  });

  it('does not show owner items in the profile dropdown', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Profile menu' }));

    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Field portal')).toBeInTheDocument();
    expect(screen.queryByText('Company settings')).not.toBeInTheDocument();
    expect(screen.queryByText('Share / Invite Client')).not.toBeInTheDocument();
    expect(screen.queryByText('Survey')).not.toBeInTheDocument();
  });
});
