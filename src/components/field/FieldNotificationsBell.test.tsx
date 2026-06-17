import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import FieldNotificationsBell from './FieldNotificationsBell';

const listNotifications = vi.fn();
const getUnreadNotificationCount = vi.fn();
const markNotificationRead = vi.fn();
const markAllNotificationsRead = vi.fn();
const dismissNotification = vi.fn();
const navigate = vi.fn();

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'owner-1' } }),
}));

vi.mock('../../services/notificationService', () => ({
  listNotifications: (...args: unknown[]) => listNotifications(...args),
  getUnreadNotificationCount: (...args: unknown[]) => getUnreadNotificationCount(...args),
  markNotificationRead: (...args: unknown[]) => markNotificationRead(...args),
  markAllNotificationsRead: (...args: unknown[]) => markAllNotificationsRead(...args),
  dismissNotification: (...args: unknown[]) => dismissNotification(...args),
  toFieldNotification: (notification: {
    id: string;
    userId: string | null;
    projectId: string | null;
    type: string;
    title: string;
    message: string;
    actionUrl: string | null;
    readAt: string | null;
    dismissedAt: string | null;
    createdAt: string;
    metadata: Record<string, unknown>;
    severity: string;
    channel: string;
    employerId: string | null;
    createdBy: string | null;
    actionLabel: string | null;
    emailedAt: string | null;
    expiresAt: string | null;
    updatedAt: string;
  }) => ({
    id: notification.id,
    userId: notification.userId ?? '',
    projectId: notification.projectId,
    taskId: null,
    type: notification.type,
    title: notification.title,
    body: notification.message,
    href: notification.actionUrl,
    isRead: Boolean(notification.readAt || notification.dismissedAt),
    createdAt: notification.createdAt,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

describe('FieldNotificationsBell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUnreadNotificationCount.mockResolvedValue(2);
    markAllNotificationsRead.mockResolvedValue(undefined);
    markNotificationRead.mockResolvedValue(undefined);
    dismissNotification.mockResolvedValue(undefined);
  });

  it('renders unread badge, notifications, empty state copy, and navigates on click', async () => {
    listNotifications.mockResolvedValue([
      {
        id: 'notif-1',
        userId: 'owner-1',
        employerId: null,
        projectId: 'project-1',
        createdBy: null,
        type: 'proposal_accepted',
        severity: 'info',
        channel: 'in_app',
        title: 'Proposal accepted',
        message: 'Jane Smith accepted Backyard Patio.',
        actionLabel: null,
        actionUrl: '/proposals?proposalId=proposal-1',
        metadata: {},
        readAt: null,
        dismissedAt: null,
        emailedAt: null,
        expiresAt: null,
        createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    render(
      <MemoryRouter>
        <FieldNotificationsBell />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('notifications-unread-badge')).toHaveTextContent('2');
    });

    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }));

    expect(screen.getByText('Proposal accepted')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith accepted Backyard Patio.')).toBeInTheDocument();
    expect(screen.getByText('5m ago')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Proposal accepted'));

    expect(markNotificationRead).toHaveBeenCalledWith('notif-1');
    expect(navigate).toHaveBeenCalledWith('/proposals?proposalId=proposal-1');
  });

  it('shows empty state and mark all read control', async () => {
    listNotifications.mockResolvedValue([]);
    getUnreadNotificationCount.mockResolvedValue(0);

    render(
      <MemoryRouter>
        <FieldNotificationsBell />
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }));

    expect(screen.getByTestId('notifications-empty')).toHaveTextContent('No notifications yet.');
    expect(screen.getByText('Important project updates will appear here.')).toBeInTheDocument();
    expect(screen.queryByTestId('notifications-mark-all-read')).not.toBeInTheDocument();
  });

  it('marks all notifications as read', async () => {
    listNotifications.mockResolvedValue([
      {
        id: 'notif-1',
        userId: 'owner-1',
        employerId: null,
        projectId: 'project-1',
        createdBy: null,
        type: 'employee_message',
        severity: 'info',
        channel: 'in_app',
        title: 'New employee message',
        message: 'Alex sent a message on GU26-200.',
        actionLabel: 'Open message',
        actionUrl: '/employee/messages',
        metadata: {},
        readAt: null,
        dismissedAt: null,
        emailedAt: null,
        expiresAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    render(
      <MemoryRouter>
        <FieldNotificationsBell />
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    await userEvent.click(screen.getByTestId('notifications-mark-all-read'));

    expect(markAllNotificationsRead).toHaveBeenCalledWith('owner-1');
  });
});
