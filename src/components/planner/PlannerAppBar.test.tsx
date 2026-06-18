import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import PlannerAppBar from './PlannerAppBar';

const mockUseAuth = vi.fn();

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../store/toolsModalStore', () => ({
  useToolsModalStore: (selector: (state: { open: () => void; isOpen: boolean }) => unknown) =>
    selector({ open: vi.fn(), isOpen: false }),
}));

vi.mock('../field/FieldNotificationsBell', () => ({
  default: () => <div data-testid="notifications-bell" />,
}));

vi.mock('../layout/AppProfileMenu', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="profile-menu">
      <button type="button" onClick={onClose}>
        Close menu
      </button>
    </div>
  ),
}));

describe('PlannerAppBar profile avatar', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: { id: 'owner-1', email: 'owner@example.com' },
      profile: { firstName: 'Donald', lastName: 'Duck', displayName: 'Donald Duck', role: 'owner' },
      isOwner: true,
      isEmployee: false,
    });
  });

  it('renders user initials when profile has first and last name', () => {
    render(
      <MemoryRouter initialEntries={['/planner/hub']}>
        <PlannerAppBar onMenuClick={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('user-avatar-initials')).toHaveTextContent('DD');
  });

  it('does not render the generic user icon when initials are available', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/planner/hub']}>
        <PlannerAppBar onMenuClick={vi.fn()} />
      </MemoryRouter>,
    );

    expect(container.querySelector('svg.lucide-user')).toBeNull();
    expect(screen.getByTestId('user-avatar-initials')).toBeInTheDocument();
  });

  it('opens the profile menu when the avatar is clicked', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/planner/hub']}>
        <PlannerAppBar onMenuClick={vi.fn()} />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Profile menu' }));
    expect(screen.getByTestId('profile-menu')).toBeInTheDocument();
  });
});
