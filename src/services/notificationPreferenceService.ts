import { supabase } from '../lib/supabase';
import { clearStaleAuthSession, isStaleRefreshTokenError } from '../lib/authSession';
import type { EmailDigestFrequency, NotificationPreferences } from '../lib/notificationTypes';

async function requireAuthenticatedUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    if (isStaleRefreshTokenError(error)) {
      await clearStaleAuthSession();
    }
    throw new Error('User not authenticated');
  }

  if (!user) {
    throw new Error('User not authenticated');
  }

  return user.id;
}

function mapPreferencesRow(row: Record<string, unknown>): NotificationPreferences {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    emailUpdatesEnabled: row.email_updates_enabled as boolean,
    weatherAlertsEnabled: row.weather_alerts_enabled as boolean,
    projectRemindersEnabled: row.project_reminders_enabled as boolean,
    inAppNotificationsEnabled: row.in_app_notifications_enabled as boolean,
    emailDigestFrequency: row.email_digest_frequency as EmailDigestFrequency,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export const DEFAULT_NOTIFICATION_PREFERENCES: Omit<
  NotificationPreferences,
  'id' | 'userId' | 'createdAt' | 'updatedAt'
> = {
  emailUpdatesEnabled: true,
  weatherAlertsEnabled: true,
  projectRemindersEnabled: true,
  inAppNotificationsEnabled: true,
  emailDigestFrequency: 'immediate',
};

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  return error?.code === 'PGRST205' || Boolean(error?.message?.includes('notification_preferences'));
}

export async function getNotificationPreferences(): Promise<NotificationPreferences | null> {
  const userId = await requireAuthenticatedUserId();
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }

  return data ? mapPreferencesRow(data as Record<string, unknown>) : null;
}

export async function ensureNotificationPreferences(
  seed?: Partial<Omit<NotificationPreferences, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
): Promise<NotificationPreferences | null> {
  const existing = await getNotificationPreferences();
  if (existing) return existing;

  const userId = await requireAuthenticatedUserId();
  const payload = {
    user_id: userId,
    email_updates_enabled: seed?.emailUpdatesEnabled ?? DEFAULT_NOTIFICATION_PREFERENCES.emailUpdatesEnabled,
    weather_alerts_enabled: seed?.weatherAlertsEnabled ?? DEFAULT_NOTIFICATION_PREFERENCES.weatherAlertsEnabled,
    project_reminders_enabled:
      seed?.projectRemindersEnabled ?? DEFAULT_NOTIFICATION_PREFERENCES.projectRemindersEnabled,
    in_app_notifications_enabled:
      seed?.inAppNotificationsEnabled ?? DEFAULT_NOTIFICATION_PREFERENCES.inAppNotificationsEnabled,
    email_digest_frequency:
      seed?.emailDigestFrequency ?? DEFAULT_NOTIFICATION_PREFERENCES.emailDigestFrequency,
  };

  const { data, error } = await supabase
    .from('notification_preferences')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    if (isMissingTableError(error)) return null;
    if (error.code === '23505') {
      const retry = await getNotificationPreferences();
      return retry;
    }
    throw error;
  }

  return mapPreferencesRow(data as Record<string, unknown>);
}

export async function updateNotificationPreferences(
  patch: Partial<Omit<NotificationPreferences, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
): Promise<NotificationPreferences | null> {
  await ensureNotificationPreferences(patch);
  const userId = await requireAuthenticatedUserId();

  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.emailUpdatesEnabled !== undefined) row.email_updates_enabled = patch.emailUpdatesEnabled;
  if (patch.weatherAlertsEnabled !== undefined) row.weather_alerts_enabled = patch.weatherAlertsEnabled;
  if (patch.projectRemindersEnabled !== undefined) {
    row.project_reminders_enabled = patch.projectRemindersEnabled;
  }
  if (patch.inAppNotificationsEnabled !== undefined) {
    row.in_app_notifications_enabled = patch.inAppNotificationsEnabled;
  }
  if (patch.emailDigestFrequency !== undefined) row.email_digest_frequency = patch.emailDigestFrequency;

  const { data, error } = await supabase
    .from('notification_preferences')
    .update(row)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }

  return mapPreferencesRow(data as Record<string, unknown>);
}

export async function getRecipientNotificationPreferences(
  userId: string,
): Promise<Pick<
  NotificationPreferences,
  'emailUpdatesEnabled' | 'projectRemindersEnabled' | 'inAppNotificationsEnabled' | 'emailDigestFrequency'
> | null> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select(
      'email_updates_enabled, project_reminders_enabled, in_app_notifications_enabled, email_digest_frequency',
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }

  if (!data) return null;

  return {
    emailUpdatesEnabled: data.email_updates_enabled as boolean,
    projectRemindersEnabled: data.project_reminders_enabled as boolean,
    inAppNotificationsEnabled: data.in_app_notifications_enabled as boolean,
    emailDigestFrequency: data.email_digest_frequency as EmailDigestFrequency,
  };
}

export function countEnabledNotificationToggles(
  prefs: Pick<
    NotificationPreferences,
    'emailUpdatesEnabled' | 'projectRemindersEnabled' | 'weatherAlertsEnabled'
  >,
): number {
  return [prefs.emailUpdatesEnabled, prefs.projectRemindersEnabled, prefs.weatherAlertsEnabled].filter(
    Boolean,
  ).length;
}
