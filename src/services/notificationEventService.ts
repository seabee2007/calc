import { supabase } from '../lib/supabase';
import {
  buildNotificationSourceMetadata,
  type NotificationSeverity,
  type NotificationType,
} from '../lib/notificationTypes';
import { createNotification, hasExistingNotification } from './notificationService';
import {
  getRecipientNotificationPreferences,
} from './notificationPreferenceService';
import { sendNotificationEmail } from './notificationEmailService';
import { fetchProfile } from './profileService';
import { plannerBoardHref, plannerDocumentsHref, plannerScheduleHref } from '../utils/plannerRoutes';
import {
  resolveUserNotificationEmail,
  sendNotificationEmail,
  shouldSendImmediateNotificationEmail,
} from './notificationEmailService';

export async function resolveProjectOwnerId(projectId: string): Promise<{
  ownerId: string | null;
  projectName: string;
}> {
  const { data, error } = await supabase
    .from('projects')
    .select('user_id, name')
    .eq('id', projectId)
    .maybeSingle();

  if (error) throw error;
  return {
    ownerId: (data?.user_id as string) ?? null,
    projectName: (data?.name as string) ?? 'Project',
  };
}

async function maybeSendImmediateEmail(input: {
  recipientUserId: string;
  type: NotificationType;
  title: string;
  message: string;
  projectName: string;
  actionUrl?: string;
  notificationId?: string;
}): Promise<void> {
  const shouldSend = await shouldSendImmediateNotificationEmail(input.recipientUserId);
  if (!shouldSend) return;

  const recipientEmail = await resolveUserNotificationEmail(input.recipientUserId);
  if (!recipientEmail) return;

  try {
    const result = await sendNotificationEmail({
      recipientEmail,
      title: input.title,
      message: input.message,
      projectName: input.projectName,
      actionUrl: input.actionUrl,
    });

    if (result.ok && !result.skipped && !result.disabled && input.notificationId) {
      await supabase
        .from('notifications')
        .update({ emailed_at: new Date().toISOString() })
        .eq('id', input.notificationId);
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('[Notifications] Email send failed', error);
    }
  }
}

export async function notifyProjectOwner(input: {
  projectId: string;
  type: NotificationType;
  severity?: NotificationSeverity;
  title: string;
  message: string;
  actionLabel?: string;
  actionUrl?: string;
  sourceType: string;
  sourceId: string;
  reminderDate?: string;
  taskId?: string;
  emailEligible?: boolean;
}): Promise<void> {
  const { ownerId, projectName } = await resolveProjectOwnerId(input.projectId);
  if (!ownerId) return;

  const recipientPrefs = await getRecipientNotificationPreferences(ownerId);
  if (recipientPrefs && !recipientPrefs.inAppNotificationsEnabled) return;
  if (
    recipientPrefs &&
    !recipientPrefs.projectRemindersEnabled &&
    (input.type === 'deadline_due' || input.type === 'schedule_attention')
  ) {
    return;
  }

  const exists = await hasExistingNotification({
    userId: ownerId,
    type: input.type,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    reminderDate: input.reminderDate,
  });
  if (exists) return;

  try {
    const notification = await createNotification({
      userId: ownerId,
      projectId: input.projectId,
      type: input.type,
      severity: input.severity ?? 'info',
      title: input.title,
      message: input.message,
      actionLabel: input.actionLabel,
      actionUrl: input.actionUrl,
      taskId: input.taskId,
      metadata: buildNotificationSourceMetadata({
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        recipientUserId: ownerId,
        reminderDate: input.reminderDate,
      }),
    });

    if (notification && input.emailEligible) {
      await maybeSendImmediateEmail({
        recipientUserId: ownerId,
        type: input.type,
        title: input.title,
        message: input.message,
        projectName,
        actionUrl: input.actionUrl,
        notificationId: notification.id,
      });
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('[Notifications] Failed to create project owner notification', error);
    }
  }
}

export async function notifyUser(input: {
  userId: string;
  projectId?: string;
  type: NotificationType;
  severity?: NotificationSeverity;
  title: string;
  message: string;
  actionLabel?: string;
  actionUrl?: string;
  sourceType: string;
  sourceId: string;
  reminderDate?: string;
}): Promise<void> {
  const recipientPrefs = await getRecipientNotificationPreferences(input.userId);
  if (recipientPrefs && !recipientPrefs.inAppNotificationsEnabled) return;

  const exists = await hasExistingNotification({
    userId: input.userId,
    type: input.type,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    reminderDate: input.reminderDate,
  });
  if (exists) return;

  try {
    await createNotification({
      userId: input.userId,
      projectId: input.projectId,
      type: input.type,
      severity: input.severity ?? 'info',
      title: input.title,
      message: input.message,
      actionLabel: input.actionLabel,
      actionUrl: input.actionUrl,
      metadata: buildNotificationSourceMetadata({
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        recipientUserId: input.userId,
        reminderDate: input.reminderDate,
      }),
    });
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('[Notifications] Failed to create user notification', error);
    }
  }
}

export async function notifyFieldActivity(input: {
  projectId: string;
  employeeUserId: string;
  summary: string;
  sourceType: string;
  sourceId: string;
  taskId?: string;
  actionUrl?: string;
}): Promise<void> {
  const profile = await fetchProfile(input.employeeUserId);
  const employeeName = profile?.displayName ?? 'Team member';
  const { projectName } = await resolveProjectOwnerId(input.projectId);

  await notifyProjectOwner({
    projectId: input.projectId,
    type: 'field_activity',
    title: 'New field activity',
    message: `${employeeName} added activity on ${projectName}.`,
    actionLabel: 'Open project',
    actionUrl: input.actionUrl ?? plannerBoardHref(input.projectId, input.taskId),
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    taskId: input.taskId,
    emailEligible: false,
  });
}

export async function notifyEmployeeMessage(input: {
  projectId: string;
  senderId: string;
  messageId: string;
  recipientId?: string | null;
  taskId?: string | null;
  messagePreview: string;
}): Promise<void> {
  const profile = await fetchProfile(input.senderId);
  const employeeName = profile?.displayName ?? 'Team member';
  const { ownerId, projectName } = await resolveProjectOwnerId(input.projectId);
  const recipientId = input.recipientId ?? ownerId;
  if (!recipientId) return;

  const recipientPrefs = await getRecipientNotificationPreferences(recipientId);
  if (recipientPrefs && !recipientPrefs.inAppNotificationsEnabled) return;

  const exists = await hasExistingNotification({
    userId: recipientId,
    type: 'employee_message',
    sourceType: 'field_message',
    sourceId: input.messageId,
  });
  if (exists) return;

  const actionUrl = input.taskId
    ? plannerBoardHref(input.projectId, input.taskId)
    : `/employee/messages`;

  try {
    const notification = await createNotification({
      userId: recipientId,
      projectId: input.projectId,
      type: 'employee_message',
      severity: 'info',
      title: 'New employee message',
      message: `${employeeName} sent a message on ${projectName}.`,
      actionLabel: 'Open message',
      actionUrl,
      metadata: buildNotificationSourceMetadata({
        sourceType: 'field_message',
        sourceId: input.messageId,
        recipientUserId: recipientId,
      }),
    });

    if (notification) {
      await maybeSendImmediateEmail({
        recipientUserId: recipientId,
        type: 'employee_message',
        title: 'New employee message',
        message: `${employeeName} sent a message on ${projectName}.`,
        projectName,
        actionUrl,
        notificationId: notification.id,
      });
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('[Notifications] Failed to create employee message notification', error);
    }
  }
}

export async function notifyDocumentNeedsReview(input: {
  projectId: string;
  documentId: string;
  documentName: string;
  actionUrl?: string;
}): Promise<void> {
  const { projectName } = await resolveProjectOwnerId(input.projectId);
  const actionUrl = input.actionUrl ?? plannerDocumentsHref(input.projectId);

  await notifyProjectOwner({
    projectId: input.projectId,
    type: 'document_needs_review',
    severity: 'warning',
    title: 'Document needs review',
    message: `${input.documentName} is ready for review on ${projectName}.`,
    actionLabel: 'Open documents',
    actionUrl,
    sourceType: 'project_document',
    sourceId: input.documentId,
    emailEligible: true,
  });
}

export async function notifyDocumentUploaded(input: {
  projectId: string;
  documentId: string;
  documentName: string;
  uploadedByUserId: string;
}): Promise<void> {
  const profile = await fetchProfile(input.uploadedByUserId);
  const employeeName = profile?.displayName ?? 'Team member';
  const { projectName } = await resolveProjectOwnerId(input.projectId);

  await notifyProjectOwner({
    projectId: input.projectId,
    type: 'document_uploaded',
    title: 'Document uploaded',
    message: `${employeeName} uploaded ${input.documentName} on ${projectName}.`,
    actionLabel: 'Open documents',
    actionUrl: plannerDocumentsHref(input.projectId),
    sourceType: 'project_document',
    sourceId: input.documentId,
    emailEligible: false,
  });
}

export async function notifyDeadlineDue(input: {
  projectId: string;
  scheduleEventId: string;
  title: string;
  dueDate: string;
  reminderDate: string;
}): Promise<void> {
  const { ownerId } = await resolveProjectOwnerId(input.projectId);
  if (!ownerId) return;
  const recipientPrefs = await getRecipientNotificationPreferences(ownerId);
  if (recipientPrefs && !recipientPrefs.projectRemindersEnabled) return;

  const { projectName } = await resolveProjectOwnerId(input.projectId);

  await notifyProjectOwner({
    projectId: input.projectId,
    type: 'deadline_due',
    severity: 'warning',
    title: 'Deadline coming up',
    message: `${input.title} is due ${input.dueDate} on ${projectName}.`,
    actionLabel: 'Open schedule',
    actionUrl: plannerScheduleHref(input.projectId),
    sourceType: 'schedule_event',
    sourceId: input.scheduleEventId,
    reminderDate: input.reminderDate,
    emailEligible: true,
  });
}

export async function notifyScheduleAttention(input: {
  projectId: string;
  sourceId: string;
  message: string;
  reminderDate?: string;
}): Promise<void> {
  const { ownerId, projectName } = await resolveProjectOwnerId(input.projectId);
  if (!ownerId) return;
  const recipientPrefs = await getRecipientNotificationPreferences(ownerId);
  if (recipientPrefs && !recipientPrefs.projectRemindersEnabled) return;

  await notifyProjectOwner({
    projectId: input.projectId,
    type: 'schedule_attention',
    severity: 'warning',
    title: 'Schedule needs attention',
    message: input.message || `${projectName} has schedule items that need review.`,
    actionLabel: 'Open schedule',
    actionUrl: plannerScheduleHref(input.projectId),
    sourceType: 'schedule_attention',
    sourceId: input.sourceId,
    reminderDate: input.reminderDate,
    emailEligible: false,
  });
}
