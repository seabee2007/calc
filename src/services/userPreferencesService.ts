import { clearStaleAuthSession, isStaleRefreshTokenError } from '../lib/authSession';
import { supabase } from '../lib/supabase';
import { validateAndMigrateLayout, type DashboardLayout } from '../lib/dashboardLayout';
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
  themeMode: null,
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
  dashboardLayout: null,
};

function parseThemeMode(value: unknown): UserPreferences['themeMode'] {
  if (value === 'light' || value === 'dark') {
    return value;
  }
  return null;
}

/**
 * Pass the stored layout through as-is (null when absent). Validation/migration
 * is the consumer's responsibility (useDashboardLayout) so it can detect when a
 * saved layout had to be cleaned up and persist the cleaned version once.
 */
function parseDashboardLayout(value: unknown): DashboardLayout | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  return value as DashboardLayout;
}

function mapRowToPreferences(data: Record<string, unknown>): UserPreferences {
  return {
    themeMode: parseThemeMode(data.theme_mode),
    units: (data.units as UserPreferences['units']) || 'imperial',
    lengthUnit: (data.length_unit as UserPreferences['lengthUnit']) || 'feet',
    volumeUnit: (data.volume_unit as UserPreferences['volumeUnit']) || 'cubic_yards',
    measurementSystem:
      (data.measurement_system as UserPreferences['measurementSystem']) || 'imperial',
    currency: (data.currency as UserPreferences['currency']) || 'USD',
    defaultPSI: (data.default_psi as UserPreferences['defaultPSI']) || '3000',
    autoSave: typeof data.auto_save === 'boolean' ? data.auto_save : true,
    soundEnabled: typeof data.sound_enabled === 'boolean' ? data.sound_enabled : true,
    hapticsEnabled: typeof data.haptics_enabled === 'boolean' ? data.haptics_enabled : true,
    notifications:
      (data.notifications as UserPreferences['notifications']) || DEFAULT_NOTIFICATIONS,
    dashboardLayout: parseDashboardLayout(data.dashboard_layout),
  };
}

function preferencesToRow(
  userId: string,
  preferences: UserPreferences,
): Record<string, unknown> {
  return {
    user_id: userId,
    theme_mode: preferences.themeMode,
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
    dashboard_layout: preferences.dashboardLayout,
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

/**
 * Persist the Operations Dashboard grid layout for the authenticated user.
 * The layout is validated/migrated before saving so the column never stores a
 * malformed layout, regardless of what the caller passes in.
 */
export const updateDashboardLayout = async (
  layout: DashboardLayout,
): Promise<UserPreferences> => {
  const validated = validateAndMigrateLayout(layout);
  return updateUserPreferences({ dashboardLayout: validated });
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

      const themeStorage = localStorage.getItem('theme-storage');
      if (themeStorage && localPrefs.themeMode == null) {
        try {
          const parsedTheme = JSON.parse(themeStorage) as { state?: { isDark?: boolean } };
          if (typeof parsedTheme.state?.isDark === 'boolean') {
            localPrefs.themeMode = parsedTheme.state.isDark ? 'dark' : 'light';
          }
        } catch {
          // Ignore invalid theme-storage payload during migration.
        }
      }

      return updateUserPreferences(localPrefs);
    } catch (error) {
      console.error('Error migrating preferences from localStorage:', error);
      return null;
    }
  };
