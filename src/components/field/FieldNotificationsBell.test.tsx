import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import FieldNotificationsBell from './FieldNotificationsBell';

const fetchNotifications = vi.fn();
const markNotificationRead = vi.fn();
const navigate = vi.fn();

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'owner-1' } }),
}));

vi.mock('../../services/notificationService', () => ({
  fetchNotifications: (...args: unknown[]) => fetchNotifications(...args),
  markNotificationRead: (...args: unknown[]) => markNotificationRead(...args),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

describe('FieldNotificationsBell', () => {
  it('renders proposal notification title, body, and navigates on click', async () => {
    fetchNotifications.mockResolvedValue([
      {
        id: 'notif-1',
        userId: 'owner-1',
        projectId: 'project-1',
        taskId: null,
        type: 'proposal_accepted',
        title: 'Proposal accepted',
        body: 'Jane Smith accepted Backyard Patio.',
        href: '/proposals?proposalId=proposal-1',
        isRead: false,
        createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
      },
      {
        id: 'notif-2',
        userId: 'owner-1',
        projectId: 'project-1',
        taskId: 'task-1',
        type: 'task_submitted',
        title: 'Task submitted for review',
        body: 'Install rebar',
        href: '/planner/projects/project-1/board?task=task-1',
        isRead: false,
        createdAt: new Date(Date.now() - 10 * 60_000).toISOString(),
      },
    ]);

    render(
      <MemoryRouter>
        <FieldNotificationsBell />
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }));

    expect(screen.getByText('Proposal accepted')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith accepted Backyard Patio.')).toBeInTheDocument();
    expect(screen.getByText('Task submitted for review')).toBeInTheDocument();
    expect(screen.getByText('5m ago')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Proposal accepted'));

    expect(markNotificationRead).toHaveBeenCalledWith('notif-1');
    expect(navigate).toHaveBeenCalledWith('/proposals?proposalId=proposal-1');
  });
});
