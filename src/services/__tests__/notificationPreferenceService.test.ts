import { describe, expect, it } from 'vitest';
import {
  countEnabledNotificationToggles,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from '../notificationPreferenceService';
import {
  buildNotificationSourceMetadata,
  isUnreadNotification,
  OWNER_ATTENTION_NOTIFICATION_TYPES,
} from '../../lib/notificationTypes';

describe('notificationTypes', () => {
  it('tracks unread state and owner attention types', () => {
    expect(
      isUnreadNotification({
        id: '1',
        userId: 'u1',
        employerId: null,
        projectId: null,
        createdBy: null,
        type: 'employee_message',
        severity: 'info',
        channel: 'in_app',
        title: 'Message',
        message: 'Body',
        actionLabel: null,
        actionUrl: null,
        metadata: {},
        readAt: null,
        dismissedAt: null,
        emailedAt: null,
        expiresAt: null,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      }),
    ).toBe(true);

    expect(OWNER_ATTENTION_NOTIFICATION_TYPES.has('document_needs_review')).toBe(true);
    expect(OWNER_ATTENTION_NOTIFICATION_TYPES.has('weather_risk')).toBe(false);
  });

  it('builds dedupe metadata', () => {
    expect(
      buildNotificationSourceMetadata({
        sourceType: 'schedule_event',
        sourceId: 'evt-1',
        reminderDate: '2026-06-18',
      }),
    ).toEqual({
      sourceType: 'schedule_event',
      sourceId: 'evt-1',
      reminderDate: '2026-06-18',
    });
  });
});

describe('notificationPreferenceService helpers', () => {
  it('counts enabled toggles from preferences', () => {
    expect(
      countEnabledNotificationToggles({
        emailUpdatesEnabled: true,
        projectRemindersEnabled: false,
        weatherAlertsEnabled: true,
      }),
    ).toBe(2);

    expect(
      countEnabledNotificationToggles({
        emailUpdatesEnabled: DEFAULT_NOTIFICATION_PREFERENCES.emailUpdatesEnabled,
        projectRemindersEnabled: DEFAULT_NOTIFICATION_PREFERENCES.projectRemindersEnabled,
        weatherAlertsEnabled: DEFAULT_NOTIFICATION_PREFERENCES.weatherAlertsEnabled,
      }),
    ).toBe(3);
  });
});
