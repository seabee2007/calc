import { supabase } from '../lib/supabase';
import type { TaxApplication, TaxSystem } from '../types/pricingParams';
import {
  mergeCompanySettingsUpdates,
  type CompanySettingsUpdateOptions,
} from './companySettingsMerge';

export type { CompanySettingsUpdateOptions } from './companySettingsMerge';

export {
  getUserPreferences,
  updateUserPreferences,
  migratePreferencesFromLocalStorage,
} from './userPreferencesService';

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
  taxSystem: TaxSystem;
  taxRatePercent: number;
  taxApplication: TaxApplication;
  createdAt?: string;
  updatedAt?: string;
}

function mapCompanyRow(data: Record<string, unknown>): CompanySettings {
  return {
    id: data.id as string,
    userId: data.user_id as string,
    companyName: (data.company_name as string) || '',
    address: (data.address as string) || '',
    phone: (data.phone as string) || '',
    email: (data.email as string) || '',
    licenseNumber: (data.license_number as string) || '',
    motto: (data.motto as string) || '',
    logoUrl: (data.logo_url as string | null) ?? null,
    logoPath: (data.logo_path as string | null) ?? null,
    taxSystem: (data.tax_system as TaxSystem) || 'none',
    taxRatePercent: Number(data.tax_rate_percent ?? 0),
    taxApplication:
      (data.tax_application as TaxApplication) || 'materials_only',
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };
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
    return mapCompanyRow(data as Record<string, unknown>);
  }

  return {
    companyName: '',
    address: '',
    phone: '',
    email: '',
    licenseNumber: '',
    motto: '',
    logoUrl: null,
    logoPath: null,
    taxSystem: 'none',
    taxRatePercent: 0,
    taxApplication: 'materials_only',
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
  const dbData: Record<string, unknown> = {
    user_id: user.id,
    company_name: settings.companyName || '',
    address: settings.address || '',
    phone: settings.phone || '',
    email: settings.email || '',
    license_number: settings.licenseNumber || '',
    motto: settings.motto || '',
    logo_url: settings.logoUrl ?? null,
    logo_path: settings.logoPath ?? null,
  };
  if (settings.taxSystem !== undefined) dbData.tax_system = settings.taxSystem;
  if (settings.taxRatePercent !== undefined) {
    dbData.tax_rate_percent = settings.taxRatePercent;
  }
  if (settings.taxApplication !== undefined) {
    dbData.tax_application = settings.taxApplication;
  }

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

  return mapCompanyRow(data as Record<string, unknown>);
}

/**
 * Update only specific fields of company settings
 * @param updates - The fields to update
 * @returns The updated settings
 */
export async function updateCompanySettings(
  updates: Partial<CompanySettings>,
  options?: CompanySettingsUpdateOptions,
): Promise<CompanySettings> {
  const currentSettings = await getCompanySettings();
  const updatedSettings = mergeCompanySettingsUpdates(currentSettings, updates, options);
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
