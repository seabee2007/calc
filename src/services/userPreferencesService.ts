import { clearStaleAuthSession, isStaleRefreshTokenError } from '../lib/authSession';
import { supabase } from '../lib/supabase';
import type { UserPreferences } from '../types';

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

const DEFAULT_NOTIFICATIONS: UserPreferences['notifications'] = {
  projectUpdates: true,
  teamChanges: true,
  systemAlerts: true,
  emailUpdates: true,
  projectReminders: true,
  weatherAlerts: true,
};

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  units: 'imperial',
  lengthUnit: 'feet',
  volumeUnit: 'cubic_yards',
  measurementSystem: 'imperial',
  currency: 'USD',
  defaultPSI: '3000',
  autoSave: true,
  soundEnabled: true,
  hapticsEnabled: true,
  notifications: DEFAULT_NOTIFICATIONS,
};

function mapRowToPreferences(data: Record<string, unknown>): UserPreferences {
  return {
    units: (data.units as UserPreferences['units']) || 'imperial',
    lengthUnit: (data.length_unit as UserPreferences['lengthUnit']) || 'feet',
    volumeUnit: (data.volume_unit as UserPreferences['volumeUnit']) || 'cubic_yards',
    measurementSystem:
      (data.measurement_system as UserPreferences['measurementSystem']) || 'imperial',
    currency: (data.currency as UserPreferences['currency']) || 'USD',
    defaultPSI: (data.default_psi as UserPreferences['defaultPSI']) || '3000',
    autoSave: data.auto_save ?? true,
    soundEnabled: data.sound_enabled ?? true,
    hapticsEnabled: data.haptics_enabled ?? true,
    notifications:
      (data.notifications as UserPreferences['notifications']) || DEFAULT_NOTIFICATIONS,
  };
}

function preferencesToRow(
  userId: string,
  preferences: UserPreferences,
): Record<string, unknown> {
  return {
    user_id: userId,
    units: preferences.units,
    length_unit: preferences.lengthUnit,
    volume_unit: preferences.volumeUnit,
    measurement_system: preferences.measurementSystem,
    currency: preferences.currency,
    default_psi: preferences.defaultPSI,
    auto_save: preferences.autoSave,
    sound_enabled: preferences.soundEnabled,
    haptics_enabled: preferences.hapticsEnabled,
    notifications: preferences.notifications,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Load preferences for the authenticated user.
 */
export const getUserPreferences = async (): Promise<UserPreferences> => {
  const userId = await requireAuthenticatedUserId();

  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return { ...DEFAULT_USER_PREFERENCES };
  }

  return mapRowToPreferences(data as Record<string, unknown>);
};

/**
 * Create or update the single preferences row for the authenticated user.
 */
export const saveUserPreferences = async (
  preferences: UserPreferences,
): Promise<UserPreferences> => {
  const userId = await requireAuthenticatedUserId();

  const { data, error } = await supabase
    .from('user_preferences')
    .upsert(preferencesToRow(userId, preferences), { onConflict: 'user_id' })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return mapRowToPreferences(data as Record<string, unknown>);
};

/**
 * Merge partial updates into current preferences, then upsert by user_id.
 */
export const updateUserPreferences = async (
  preferences: Partial<UserPreferences>,
): Promise<UserPreferences> => {
  const currentPreferences = await getUserPreferences();
  const merged = { ...currentPreferences, ...preferences };
  return saveUserPreferences(merged);
};

export const migratePreferencesFromLocalStorage =
  async (): Promise<UserPreferences | null> => {
    let userId: string;
    try {
      userId = await requireAuthenticatedUserId();
    } catch {
      return null;
    }

    const { data: existingPrefs } = await supabase
      .from('user_preferences')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existingPrefs) {
      return null;
    }

    const savedPrefs = localStorage.getItem('concretePreferences');
    if (!savedPrefs) {
      return null;
    }

    try {
      const localPrefs = JSON.parse(savedPrefs) as Partial<UserPreferences>;
      return updateUserPreferences(localPrefs);
    } catch (error) {
      console.error('Error migrating preferences from localStorage:', error);
      return null;
    }
  };
