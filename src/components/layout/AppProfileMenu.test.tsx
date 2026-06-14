import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AppProfileMenu from './AppProfileMenu';

const mockUseAuth = vi.fn();
const mockOpenHelp = vi.fn();
const mockToggleTheme = vi.fn();

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../features/help/definitionsHelpStore', () => ({
  useDefinitionsHelpStore: (selector: (state: { open: () => void }) => unknown) =>
    selector({ open: mockOpenHelp }),
}));

vi.mock('../../store/themeStore', () => ({
  useThemeStore: () => ({
    isDark: false,
    toggleTheme: mockToggleTheme,
  }),
}));

describe('AppProfileMenu', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', email: 'field@example.com' },
      profile: { displayName: 'Field User', role: 'employee' },
      signOut: vi.fn().mockResolvedValue(undefined),
      isOwner: false,
      isEmployee: true,
    });
  });

  it('shows a limited menu for field-only users', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <MemoryRouter>
        <AppProfileMenu
          onClose={onClose}
          showShareInvite
          onShareInvite={vi.fn()}
          showSurvey
          onSurvey={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Help')).toBeInTheDocument();
    expect(screen.getByText('Dark mode')).toBeInTheDocument();
    expect(screen.getByText('Field portal')).toBeInTheDocument();
    expect(screen.getByText('Sign out')).toBeInTheDocument();

    expect(screen.queryByText('Company settings')).not.toBeInTheDocument();
    expect(screen.queryByText('User preferences')).not.toBeInTheDocument();
    expect(screen.queryByText('Share / Invite Client')).not.toBeInTheDocument();
    expect(screen.queryByText('Survey')).not.toBeInTheDocument();

    await user.click(screen.getByText('Help'));
    expect(mockOpenHelp).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('shows the full owner/admin menu for non-field users', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'owner-1', email: 'owner@example.com' },
      profile: { displayName: 'Owner', role: 'owner' },
      signOut: vi.fn().mockResolvedValue(undefined),
      isOwner: true,
      isEmployee: false,
    });

    render(
      <MemoryRouter>
        <AppProfileMenu
          onClose={vi.fn()}
          showShareInvite
          onShareInvite={vi.fn()}
          showSurvey
          onSurvey={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Company settings')).toBeInTheDocument();
    expect(screen.getByText('User preferences')).toBeInTheDocument();
    expect(screen.getByText('Share / Invite Client')).toBeInTheDocument();
    expect(screen.getByText('Survey')).toBeInTheDocument();
    expect(screen.queryByText('Field portal')).not.toBeInTheDocument();
  });

  it('shows admin menu for project managers', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'pm-1', email: 'pm@example.com' },
      profile: { displayName: 'PM', role: 'project_manager' },
      signOut: vi.fn().mockResolvedValue(undefined),
      isOwner: false,
      isEmployee: true,
    });

    render(
      <MemoryRouter>
        <AppProfileMenu onClose={vi.fn()} showShareInvite onShareInvite={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Company settings')).toBeInTheDocument();
    expect(screen.queryByText('Field portal')).not.toBeInTheDocument();
  });
});
