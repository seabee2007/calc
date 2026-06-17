export const NOTIFICATION_TYPES = [
  'field_activity',
  'employee_message',
  'document_uploaded',
  'document_needs_review',
  'deadline_due',
  'schedule_attention',
  'email_delivery',
  'system_notice',
  'task_submitted',
  'proposal_accepted',
  'proposal_viewed',
  'proposal_declined',
  'proposal_deposit_paid',
  'proposal_sent',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_SEVERITIES = ['info', 'success', 'warning', 'danger'] as const;
export type NotificationSeverity = (typeof NOTIFICATION_SEVERITIES)[number];

export const NOTIFICATION_CHANNELS = ['in_app', 'email', 'system'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export type EmailDigestFrequency = 'immediate' | 'daily' | 'off';

export interface NotificationPreferences {
  id: string;
  userId: string;
  emailUpdatesEnabled: boolean;
  weatherAlertsEnabled: boolean;
  projectRemindersEnabled: boolean;
  inAppNotificationsEnabled: boolean;
  emailDigestFrequency: EmailDigestFrequency;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationSourceMetadata {
  sourceType?: string;
  sourceId?: string;
  recipientUserId?: string;
  reminderDate?: string;
  taskId?: string;
  legacyFieldNotificationId?: string;
  [key: string]: string | undefined;
}

export interface AppNotification {
  id: string;
  userId: string | null;
  employerId: string | null;
  projectId: string | null;
  createdBy: string | null;
  type: NotificationType | string;
  severity: NotificationSeverity;
  channel: NotificationChannel;
  title: string;
  message: string;
  actionLabel: string | null;
  actionUrl: string | null;
  metadata: NotificationSourceMetadata;
  readAt: string | null;
  dismissedAt: string | null;
  emailedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const OWNER_ATTENTION_NOTIFICATION_TYPES = new Set<NotificationType | string>([
  'employee_message',
  'document_needs_review',
  'deadline_due',
  'schedule_attention',
]);

export const EMAIL_ELIGIBLE_NOTIFICATION_TYPES = new Set<NotificationType>([
  'employee_message',
  'document_needs_review',
  'deadline_due',
]);

export function isUnreadNotification(notification: AppNotification): boolean {
  return !notification.readAt && !notification.dismissedAt;
}

export function notificationSeverityClass(severity: NotificationSeverity): string {
  switch (severity) {
    case 'success':
      return 'text-emerald-400';
    case 'warning':
      return 'text-amber-400';
    case 'danger':
      return 'text-red-400';
    default:
      return 'text-cyan-400';
  }
}

export function buildNotificationSourceMetadata(input: {
  sourceType: string;
  sourceId: string;
  recipientUserId?: string;
  reminderDate?: string;
  extra?: Record<string, string | undefined>;
}): NotificationSourceMetadata {
  return {
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    recipientUserId: input.recipientUserId,
    reminderDate: input.reminderDate,
    ...input.extra,
  };
}
