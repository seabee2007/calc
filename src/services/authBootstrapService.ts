import { getVerifiedAuthUser } from '../lib/authSession';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types/fieldPlanner';
import { isOwnerRole } from '../types/fieldPlanner';
import {
  ensureOwnerProfile,
  fetchProfile,
} from './profileService';
import {
  DEFAULT_USER_PREFERENCES,
  saveUserPreferences,
} from './userPreferencesService';
import { ensureNotificationPreferences } from './notificationPreferenceService';

async function ensureUserPreferencesRow(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (data) return;

  await saveUserPreferences(DEFAULT_USER_PREFERENCES);
}

async function ensureCompanySettingsRow(userId: string, email?: string): Promise<void> {
  const { data, error } = await supabase
    .from('company_settings')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (data) return;

  const { error: insertError } = await supabase.from('company_settings').insert({
    user_id: userId,
    company_name: '',
    address: '',
    phone: '',
    email: email ?? '',
    license_number: '',
    motto: '',
    logo_url: null,
    logo_path: null,
    tax_system: 'none',
    tax_rate_percent: 0,
    tax_application: 'materials_only',
  });

  if (insertError) throw insertError;
}

/**
 * Idempotently ensure app-level user records exist after Supabase auth succeeds.
 * Paid subscriptions are created only by the Stripe webhook — never here.
 */
export async function bootstrapAuthenticatedUser(
  userId: string,
  email?: string,
): Promise<Profile> {
  const verified = await getVerifiedAuthUser();
  if (!verified || verified.id !== userId) {
    throw new Error('Authenticated session required for bootstrap.');
  }

  let profile = await fetchProfile(userId);
  if (!profile) {
    profile = await ensureOwnerProfile(userId, email);
  }

  await ensureUserPreferencesRow(userId);
  await ensureNotificationPreferences({
    emailUpdatesEnabled: DEFAULT_USER_PREFERENCES.notifications.emailUpdates,
    projectRemindersEnabled: DEFAULT_USER_PREFERENCES.notifications.projectReminders,
    weatherAlertsEnabled: DEFAULT_USER_PREFERENCES.notifications.weatherAlerts,
  });

  if (isOwnerRole(profile.role)) {
    await ensureCompanySettingsRow(userId, email);
  }

  return profile;
}
