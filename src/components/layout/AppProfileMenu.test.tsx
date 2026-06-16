import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AppProfileMenu from './AppProfileMenu';

const mockUseAuth = vi.fn();
const mockUseSubscription = vi.fn();
const mockOpenHelp = vi.fn();
const mockToggleTheme = vi.fn();

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../contexts/SubscriptionContext', () => ({
  useSubscription: () => mockUseSubscription(),
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

function mockSubscription(overrides: Record<string, unknown> = {}) {
  mockUseSubscription.mockReturnValue({
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
    ...overrides,
  });
}

describe('AppProfileMenu', () => {
  beforeEach(() => {
    mockSubscription();
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
    expect(screen.getByTestId('profile-plan-badge')).toHaveTextContent('Free');

    expect(screen.queryByText('Company settings')).not.toBeInTheDocument();
    expect(screen.queryByText('User preferences')).not.toBeInTheDocument();
    expect(screen.queryByText('Share / Invite Client')).not.toBeInTheDocument();
    expect(screen.queryByText('Survey')).not.toBeInTheDocument();
    expect(screen.queryByText('Billing & Subscription')).not.toBeInTheDocument();

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
    mockSubscription({
      plan: 'professional',
      status: 'active',
      isActive: true,
      subscription: {
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
      },
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
    expect(screen.getByText('Billing & Subscription')).toBeInTheDocument();
    expect(screen.getByText('Share / Invite Client')).toBeInTheDocument();
    expect(screen.getByText('Survey')).toBeInTheDocument();
    expect(screen.getByTestId('profile-plan-badge')).toHaveTextContent('Professional plan');
    expect(screen.queryByText('Field portal')).not.toBeInTheDocument();
  });

  it('shows admin menu for project managers without billing link', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'pm-1', email: 'pm@example.com' },
      profile: { displayName: 'PM', role: 'project_manager' },
      signOut: vi.fn().mockResolvedValue(undefined),
      isOwner: false,
      isEmployee: true,
    });
    mockSubscription({
      plan: 'business',
      status: 'active',
      isActive: true,
      subscription: {
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
      },
    });

    render(
      <MemoryRouter>
        <AppProfileMenu onClose={vi.fn()} showShareInvite onShareInvite={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Company settings')).toBeInTheDocument();
    expect(screen.queryByText('Billing & Subscription')).not.toBeInTheDocument();
    expect(screen.getByTestId('profile-plan-badge')).toHaveTextContent('Business plan');
    expect(screen.queryByText('Field portal')).not.toBeInTheDocument();
  });

  it('shows Past due in the profile badge when subscription status is past_due', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'owner-1', email: 'owner@example.com' },
      profile: { displayName: 'Owner', role: 'owner' },
      signOut: vi.fn().mockResolvedValue(undefined),
      isOwner: true,
      isEmployee: false,
    });
    mockSubscription({
      plan: 'professional',
      status: 'past_due',
      isActive: false,
      subscription: {
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
      },
    });

    render(
      <MemoryRouter>
        <AppProfileMenu onClose={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('profile-plan-badge')).toHaveTextContent('Past due');
  });
});
