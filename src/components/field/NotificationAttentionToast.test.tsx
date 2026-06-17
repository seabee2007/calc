import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import NotificationAttentionToast from './NotificationAttentionToast';

const listOwnerAttentionNotifications = vi.fn();
const dismissNotification = vi.fn();
const markNotificationRead = vi.fn();
const navigate = vi.fn();

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'owner-1' }, isOwner: true }),
}));

vi.mock('../../services/notificationService', () => ({
  listOwnerAttentionNotifications: (...args: unknown[]) => listOwnerAttentionNotifications(...args),
  dismissNotification: (...args: unknown[]) => dismissNotification(...args),
  markNotificationRead: (...args: unknown[]) => markNotificationRead(...args),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

describe('NotificationAttentionToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    listOwnerAttentionNotifications.mockResolvedValue([
      {
        id: 'toast-1',
        userId: 'owner-1',
        employerId: null,
        projectId: 'project-1',
        createdBy: null,
        type: 'document_needs_review',
        severity: 'warning',
        channel: 'in_app',
        title: 'Document needs review',
        message: 'A new document is ready for review on GU26-200.',
        actionLabel: 'Open',
        actionUrl: '/projects/project-1/planner/documents',
        metadata: {},
        readAt: null,
        dismissedAt: null,
        emailedAt: null,
        expiresAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
    dismissNotification.mockResolvedValue(undefined);
    markNotificationRead.mockResolvedValue(undefined);
  });

  it('shows one owner attention toast and opens action on click', async () => {
    render(
      <MemoryRouter>
        <NotificationAttentionToast />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('notification-attention-toast')).toBeInTheDocument();
    });
    expect(screen.getByText('Document needs review')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('notification-attention-open'));

    expect(markNotificationRead).toHaveBeenCalledWith('toast-1');
    expect(navigate).toHaveBeenCalledWith('/projects/project-1/planner/documents');
  });

  it('dismisses toast and records dismissal', async () => {
    render(
      <MemoryRouter>
        <NotificationAttentionToast />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('notification-attention-dismiss')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId('notification-attention-dismiss'));

    expect(dismissNotification).toHaveBeenCalledWith('toast-1');
  });
});
