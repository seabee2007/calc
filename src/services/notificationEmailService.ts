import { supabase } from '../lib/supabase';
import { parseEdgeFunctionJson } from '../lib/usageMetering';
import { isTransactionalEmailEnabled } from '../utils/clientPortalInviteEmail';
import { getNotificationPreferences } from './notificationPreferenceService';

export interface SendNotificationEmailResponse {
  ok: boolean;
  skipped?: boolean;
  disabled?: boolean;
  error?: string;
}

async function invokeSendTransactionalEmail(body: {
  templateKey: string;
  to: string;
  data?: Record<string, unknown>;
}): Promise<SendNotificationEmailResponse> {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const base = import.meta.env.VITE_SUPABASE_URL;
  const res = await fetch(`${base}/functions/v1/send-transactional-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  return parseEdgeFunctionJson<SendNotificationEmailResponse>(res);
}

export async function resolveUserNotificationEmail(userId: string): Promise<string | null> {
  const { data: authData } = await supabase.auth.getUser();
  if (authData.user?.id === userId && authData.user.email?.trim()) {
    return authData.user.email.trim();
  }

  const { data: companySettings } = await supabase
    .from('company_settings')
    .select('email')
    .eq('user_id', userId)
    .maybeSingle();

  const companyEmail = (companySettings?.email as string | undefined)?.trim();
  return companyEmail || null;
}

export async function sendNotificationEmail(input: {
  recipientEmail: string;
  title: string;
  message: string;
  projectName: string;
  actionUrl?: string;
}): Promise<SendNotificationEmailResponse> {
  if (!isTransactionalEmailEnabled()) {
    return { ok: true, skipped: true, disabled: true };
  }

  const siteUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/settings#notifications` : undefined;

  return invokeSendTransactionalEmail({
    templateKey: 'scheduleMilestoneReminder',
    to: input.recipientEmail.trim(),
    data: {
      milestoneTitle: input.title,
      projectName: input.projectName,
      scheduleUrl: input.actionUrl,
      messageBody: input.message,
      manageNotificationsUrl: siteUrl,
    },
  });
}

export async function shouldSendImmediateNotificationEmail(
  recipientUserId: string,
): Promise<boolean> {
  const { data: authData } = await supabase.auth.getUser();
  if (authData.user?.id !== recipientUserId) {
    const { data } = await supabase
      .from('notification_preferences')
      .select('email_updates_enabled, email_digest_frequency')
      .eq('user_id', recipientUserId)
      .maybeSingle();

    if (!data) return true;
    return Boolean(data.email_updates_enabled) && data.email_digest_frequency === 'immediate';
  }

  const prefs = await getNotificationPreferences();
  if (!prefs) return true;
  return prefs.emailUpdatesEnabled && prefs.emailDigestFrequency === 'immediate';
}
