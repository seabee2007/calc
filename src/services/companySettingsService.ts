import { supabase } from '../lib/supabase';
import { UserPreferences } from '../types';

export interface CompanySettings {
  id?: string;
  userId?: string;
  companyName: string;
  address: string;
  phone: string;
  email: string;
  licenseNumber: string;
  motto: string;
  logoUrl: string | null;
  logoPath: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Get company settings for the current user
 * @returns Company settings or default values if none exist
 */
export async function getCompanySettings(): Promise<CompanySettings> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('company_settings')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 is "not found" error, which is expected for new users
    throw error;
  }

  // Return data if exists, otherwise return default settings
  if (data) {
    return {
      id: data.id,
      userId: data.user_id,
      companyName: data.company_name || '',
      address: data.address || '',
      phone: data.phone || '',
      email: data.email || '',
      licenseNumber: data.license_number || '',
      motto: data.motto || '',
      logoUrl: data.logo_url,
      logoPath: data.logo_path,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  // Return default settings for new users
  return {
    companyName: '',
    address: '',
    phone: '',
    email: '',
    licenseNumber: '',
    motto: '',
    logoUrl: null,
    logoPath: null
  };
}

/**
 * Save or update company settings
 * @param settings - The company settings to save
 * @returns The saved settings
 */
export async function saveCompanySettings(settings: Partial<CompanySettings>): Promise<CompanySettings> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  // Prepare the data for database
  const dbData = {
    user_id: user.id,
    company_name: settings.companyName || '',
    address: settings.address || '',
    phone: settings.phone || '',
    email: settings.email || '',
    license_number: settings.licenseNumber || '',
    motto: settings.motto || '',
    logo_url: settings.logoUrl,
    logo_path: settings.logoPath
  };

  // Use upsert to insert or update
  const { data, error } = await supabase
    .from('company_settings')
    .upsert(dbData, {
      onConflict: 'user_id'
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return {
    id: data.id,
    userId: data.user_id,
    companyName: data.company_name || '',
    address: data.address || '',
    phone: data.phone || '',
    email: data.email || '',
    licenseNumber: data.license_number || '',
    motto: data.motto || '',
    logoUrl: data.logo_url,
    logoPath: data.logo_path,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
}

/**
 * Update only specific fields of company settings
 * @param updates - The fields to update
 * @returns The updated settings
 */
export async function updateCompanySettings(updates: Partial<CompanySettings>): Promise<CompanySettings> {
  // Get current settings first
  const currentSettings = await getCompanySettings();
  
  // Merge updates with current settings
  const updatedSettings = {
    ...currentSettings,
    ...updates
  };

  // Save the merged settings
  return await saveCompanySettings(updatedSettings);
}

/**
 * Migrate company settings from localStorage to Supabase
 * This function helps users transition from localStorage to database storage
 */
export async function migrateFromLocalStorage(): Promise<CompanySettings | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return null;
    }

    // Check if user already has settings in database
    const existingSettings = await getCompanySettings();
    if (existingSettings.id) {
      // User already has database settings, no migration needed
      return existingSettings;
    }

    // Try to get settings from localStorage
    const localSettings = localStorage.getItem('companySettings');
    if (!localSettings) {
      // No local settings to migrate
      return null;
    }

    const parsedSettings = JSON.parse(localSettings);
    
    // Save to database
    const migratedSettings = await saveCompanySettings({
      companyName: parsedSettings.companyName || '',
      address: parsedSettings.address || '',
      phone: parsedSettings.phone || '',
      email: parsedSettings.email || '',
      licenseNumber: parsedSettings.licenseNumber || '',
      motto: parsedSettings.motto || '',
      logoUrl: parsedSettings.logo || null, // Note: localStorage uses 'logo', database uses 'logoUrl'
      logoPath: null // No path for base64 images from localStorage
    });

    // Optionally remove from localStorage after successful migration
    // localStorage.removeItem('companySettings');
    
    console.log('Company settings migrated from localStorage to Supabase');
    return migratedSettings;
  } catch (error) {
    console.error('Error migrating company settings:', error);
    return null;
  }
}

/**
 * Delete company settings and associated logo
 */
export async function deleteCompanySettings(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  // Get current settings to find logo path
  const currentSettings = await getCompanySettings();
  
  // Delete from database
  const { error } = await supabase
    .from('company_settings')
    .delete()
    .eq('user_id', user.id);

  if (error) {
    throw error;
  }

  // If there was a logo, delete it from storage
  if (currentSettings.logoPath) {
    try {
      await supabase.storage
        .from('logos')
        .remove([currentSettings.logoPath]);
    } catch (storageError) {
      console.warn('Failed to delete logo from storage:', storageError);
      // Don't throw error for storage cleanup failures
    }
  }
}

// User Preferences functions
export const getUserPreferences = async (): Promise<UserPreferences> => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
    throw error;
  }

  // Return default preferences if none found
  if (!data) {
    return {
      units: 'imperial',
      lengthUnit: 'feet',
      volumeUnit: 'cubic_yards',
      measurementSystem: 'imperial',
      currency: 'USD',
      defaultPSI: '3000',
      autoSave: true,
      notifications: {
        emailUpdates: true,
        projectReminders: true,
        weatherAlerts: true
      }
    };
  }

  return {
    units: data.units,
    lengthUnit: data.length_unit,
    volumeUnit: data.volume_unit,
    measurementSystem: data.measurement_system,
    currency: data.currency,
    defaultPSI: data.default_psi,
    autoSave: data.auto_save,
    notifications: data.notifications
  };
};

export const updateUserPreferences = async (preferences: Partial<UserPreferences>): Promise<UserPreferences> => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('User not authenticated');
  }

  // First, get current preferences to merge with updates
  const currentPreferences = await getUserPreferences();
  const updatedPreferences = { ...currentPreferences, ...preferences };

  const { data, error } = await supabase
    .from('user_preferences')
    .upsert({
      user_id: user.id,
      units: updatedPreferences.units,
      length_unit: updatedPreferences.lengthUnit,
      volume_unit: updatedPreferences.volumeUnit,
      measurement_system: updatedPreferences.measurementSystem,
      currency: updatedPreferences.currency,
      default_psi: updatedPreferences.defaultPSI,
      auto_save: updatedPreferences.autoSave,
      notifications: updatedPreferences.notifications,
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return updatedPreferences;
};

export const migratePreferencesFromLocalStorage = async (): Promise<UserPreferences | null> => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    console.log('No authenticated user for preferences migration');
    return null;
  }

  // Check if preferences already exist in database
  const { data: existingPrefs } = await supabase
    .from('user_preferences')
    .select('user_id')
    .eq('user_id', user.id)
    .single();

  if (existingPrefs) {
    console.log('User preferences already exist in database');
    return null;
  }

  // Get preferences from localStorage
  const savedPrefs = localStorage.getItem('concretePreferences');
  if (!savedPrefs) {
    console.log('No preferences found in localStorage');
    return null;
  }

  try {
    const localPrefs = JSON.parse(savedPrefs);
    console.log('Migrating user preferences from localStorage to Supabase...');
    
    // Migrate to database
    const migratedPrefs = await updateUserPreferences(localPrefs);
    
    // Optionally remove from localStorage after successful migration
    // localStorage.removeItem('concretePreferences');
    
    console.log('User preferences migration completed');
    return migratedPrefs;
  } catch (error) {
    console.error('Error migrating preferences from localStorage:', error);
    return null;
  }
}; 