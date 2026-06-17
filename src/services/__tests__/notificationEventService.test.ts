import { describe, expect, it, vi, beforeEach } from 'vitest';
import { notifyEmployeeMessage, notifyProjectOwner } from '../notificationEventService';

const createNotification = vi.fn();
const hasExistingNotification = vi.fn();
const getRecipientNotificationPreferences = vi.fn();
const sendNotificationEmail = vi.fn();
const shouldSendImmediateNotificationEmail = vi.fn();
const resolveUserNotificationEmail = vi.fn();

vi.mock('../notificationService', () => ({
  createNotification: (...args: unknown[]) => createNotification(...args),
  hasExistingNotification: (...args: unknown[]) => hasExistingNotification(...args),
}));

vi.mock('../notificationPreferenceService', () => ({
  getRecipientNotificationPreferences: (...args: unknown[]) =>
    getRecipientNotificationPreferences(...args),
}));

vi.mock('../notificationEmailService', () => ({
  sendNotificationEmail: (...args: unknown[]) => sendNotificationEmail(...args),
  shouldSendImmediateNotificationEmail: (...args: unknown[]) =>
    shouldSendImmediateNotificationEmail(...args),
  resolveUserNotificationEmail: (...args: unknown[]) => resolveUserNotificationEmail(...args),
}));

vi.mock('../profileService', () => ({
  fetchProfile: vi.fn().mockResolvedValue({ displayName: 'Alex Field' }),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { user_id: 'owner-1', name: 'GU26-200' },
            error: null,
          }),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    })),
    auth: { getUser: vi.fn() },
  },
}));

describe('notificationEventService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasExistingNotification.mockResolvedValue(false);
    getRecipientNotificationPreferences.mockResolvedValue({
      emailUpdatesEnabled: true,
      projectRemindersEnabled: true,
      inAppNotificationsEnabled: true,
      emailDigestFrequency: 'immediate',
    });
    createNotification.mockResolvedValue({ id: 'notif-1' });
    shouldSendImmediateNotificationEmail.mockResolvedValue(true);
    resolveUserNotificationEmail.mockResolvedValue('owner@example.com');
    sendNotificationEmail.mockResolvedValue({ ok: true });
  });

  it('creates employee_message notification for project owner', async () => {
    await notifyEmployeeMessage({
      projectId: 'project-1',
      senderId: 'employee-1',
      messageId: 'msg-1',
      messagePreview: 'Need approval',
    });

    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'owner-1',
        type: 'employee_message',
        title: 'New employee message',
      }),
    );
    expect(sendNotificationEmail).toHaveBeenCalled();
  });

  it('skips project reminders when recipient disabled them', async () => {
    getRecipientNotificationPreferences.mockResolvedValue({
      emailUpdatesEnabled: true,
      projectRemindersEnabled: false,
      inAppNotificationsEnabled: true,
      emailDigestFrequency: 'immediate',
    });

    await notifyProjectOwner({
      projectId: 'project-1',
      type: 'deadline_due',
      severity: 'warning',
      title: 'Deadline coming up',
      message: 'Permit deadline is due soon on GU26-200.',
      sourceType: 'schedule_event',
      sourceId: 'evt-1',
      reminderDate: '2026-06-18',
      emailEligible: true,
    });

    expect(createNotification).not.toHaveBeenCalled();
  });
});
