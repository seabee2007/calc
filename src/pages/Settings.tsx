import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { replaceLogo, deleteLogo } from '../services/storageService';
import { useAuth } from '../hooks/useAuth';
import { soundService } from '../services/soundService';
import { hapticService } from '../services/hapticService';
import { 
  User, 
  Building2, 
  Phone, 
  Mail, 
  MapPin, 
  Quote, 
  Upload, 
  Save, 
  Moon, 
  Sun, 
  Calculator,
  Bell,
  Shield,
  Trash2,
  Camera,
  Volume,
  BookOpen,
  Users,
  CreditCard,
} from 'lucide-react';
import AppPage from '../components/ui/AppPage';
import PageHeader from '../components/ui/PageHeader';
import { PREMIUM_INNER_PANEL } from '../theme/appTheme';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import TaxRatePercentInput from '../components/pricing/TaxRatePercentInput';
import {
  SettingsCollapsibleSection,
  SettingsLinkSection,
  readExpandedSettingsSections,
  persistExpandedSettingsSections,
  type SettingsSectionId,
} from '../components/settings/SettingsCollapsibleSection';
import { useCompanyLaborRates } from '../features/estimating/ui/hooks/useCompanyLaborRates';
import { useThemeStore } from '../store/themeStore';
import { useSettingsStore, usePreferencesStore } from '../store';
import USAddressFields from '../components/address/USAddressFields';
import LaborRateLibrarySection from '../features/estimating/ui/components/LaborRateLibrarySection';
import {
  EMPTY_US_ADDRESS,
  formatUSAddress,
  parseLegacyUSAddress,
  type USAddress,
} from '../types/address';
import { formatUsPhoneNumber } from '../utils/phoneFormatting';

const TAX_SYSTEM_LABELS: Record<string, string> = {
  none: 'None',
  sales_tax: 'Sales tax',
  gross_receipts_tax: 'Gross receipts tax',
  vat: 'VAT',
};

const Settings: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useThemeStore();
  const {
    companySettings,
    companySettingsHydrated,
    updateCompanySettings,
    loading: settingsLoading,
  } = useSettingsStore();
  const { preferences, updatePreferences, loading: preferencesLoading } = usePreferencesStore();
  const { rates: laborRates } = useCompanyLaborRates();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expandedSections, setExpandedSections] = useState<Set<SettingsSectionId>>(
    () => readExpandedSettingsSections(),
  );
  
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isRemovingLogo, setIsRemovingLogo] = useState(false);
  
  // Local state for text inputs to prevent constant API calls
  const [localCompanySettings, setLocalCompanySettings] = useState({
    companyName: '',
    address: '',
    phone: '',
    email: '',
    licenseNumber: '',
    motto: ''
  });

  // Track if local state has been initialized to prevent overwrites during typing
  const [businessAddress, setBusinessAddress] = useState<USAddress>({ ...EMPTY_US_ADDRESS });
  const [isLocalStateInitialized, setIsLocalStateInitialized] = useState(false);
  const initializationRef = useRef(false);
  const localCompanySettingsRef = useRef(localCompanySettings);
  const businessAddressRef = useRef(businessAddress);

  // Update ref whenever local state changes
  useEffect(() => {
    localCompanySettingsRef.current = localCompanySettings;
  }, [localCompanySettings]);

  useEffect(() => {
    businessAddressRef.current = businessAddress;
  }, [businessAddress]);

  // Load settings and preferences on mount
  useEffect(() => {
    const initializeSettings = async () => {
      if (user && !initializationRef.current) {
        initializationRef.current = true;
      }
    };

    initializeSettings();
  }, [user]);

  // Populate local form only after Supabase (or fallback) hydration — never from pre-load defaults.
  useEffect(() => {
    if (!companySettingsHydrated || isLocalStateInitialized) return;
    setLocalCompanySettings({
      companyName: companySettings.companyName || '',
      address: companySettings.address || '',
      phone: formatUsPhoneNumber(companySettings.phone || ''),
      email: companySettings.email || '',
      licenseNumber: companySettings.licenseNumber || '',
      motto: companySettings.motto || '',
    });
    setBusinessAddress(parseLegacyUSAddress(companySettings.address || ''));
    setIsLocalStateInitialized(true);
  }, [companySettings, companySettingsHydrated, isLocalStateInitialized]);

  // Debounced auto-save function for text inputs
  const debouncedSave = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout;
      let isCurrentlySaving = false;
      
      return () => {
        clearTimeout(timeoutId);
        
        // Prevent multiple saves from happening simultaneously
        if (isCurrentlySaving) {
          return;
        }
        
        timeoutId = setTimeout(async () => {
          if (!companySettingsHydrated) {
            if (import.meta.env.DEV) {
              console.info('[companySettings] Auto-save skipped: settings not hydrated yet');
            }
            return;
          }
          if (!preferencesLoading && preferences.autoSave) {
            isCurrentlySaving = true;
            const currentSettings = {
              ...localCompanySettingsRef.current,
              address: formatUSAddress(businessAddressRef.current),
            };

            try {
              await updateCompanySettings(currentSettings, {
                allowEmptyTextOverwrite: false,
              });
              setSaveMessage({ 
                text: 'Auto-saved ✓', 
                type: 'success' 
              });
              setTimeout(() => setSaveMessage(null), 2000);
            } catch (error) {
              console.error('Auto-save failed:', error);
              setSaveMessage({ 
                text: 'Auto-save failed. Please try again.', 
                type: 'error' 
              });
              setTimeout(() => setSaveMessage(null), 3000);
            } finally {
              isCurrentlySaving = false;
            }
          }
        }, 1500); // 1.5 second delay for text inputs
      };
    })(),
    [companySettingsHydrated, preferences.autoSave, preferencesLoading, updateCompanySettings],
  );

  // Handle text input changes (with debouncing)
  const handleCompanyTextChange = (field: string, value: string) => {
    setLocalCompanySettings((prev) => ({ ...prev, [field]: value }));

    if (companySettingsHydrated && !preferencesLoading && preferences.autoSave) {
      debouncedSave();
    }
  };

  const handleBusinessAddressChange = (addr: USAddress) => {
    setBusinessAddress(addr);
    if (companySettingsHydrated && !preferencesLoading && preferences.autoSave) {
      debouncedSave();
    }
  };

  // Handle immediate changes (dropdowns, toggles, etc.)
  const handleCompanyImmediateChange = async (field: string, value: string) => {
    try {
      await updateCompanySettings({ [field]: value });
      
      // Show auto-save notification only if auto-save is enabled
      if (!preferencesLoading && preferences.autoSave) {
        setSaveMessage({ 
          text: 'Auto-saved ✓', 
          type: 'success' 
        });
        setTimeout(() => setSaveMessage(null), 2000);
      }
    } catch (error) {
      console.error('Error updating company settings:', error);
      setSaveMessage({ 
        text: 'Failed to update settings. Please try again.', 
        type: 'error' 
      });
      setTimeout(() => setSaveMessage(null), 5000);
    }
  };

  const handlePreferenceChange = async (field: string, value: any) => {
    try {
      await updatePreferences({ [field]: value } as any);
      
      // Play success sound for toggles (except sound toggle itself)
      if (field !== 'soundEnabled' && typeof value === 'boolean') {
        soundService.play('toggle');
      }
      
      // Show auto-save notification if not toggling auto-save itself
      if (field !== 'autoSave' && !preferencesLoading && preferences.autoSave) {
        setSaveMessage({ 
          text: 'Auto-saved ✓', 
          type: 'success' 
        });
        setTimeout(() => setSaveMessage(null), 2000);
      }
    } catch (error) {
      console.error('Error updating preferences:', error);
      setSaveMessage({ 
        text: 'Failed to update preferences. Please try again.', 
        type: 'error' 
      });
      setTimeout(() => setSaveMessage(null), 5000);
    }
  };

  const handleNotificationChange = async (field: string, value: boolean) => {
    try {
      const updatedNotifications = { ...preferences.notifications, [field]: value };
      await updatePreferences({ notifications: updatedNotifications });
      
      // Play success sound for toggles
      soundService.play('toggle');
      
      if (!preferencesLoading && preferences.autoSave) {
        setSaveMessage({ 
          text: 'Auto-saved ✓', 
          type: 'success' 
        });
        setTimeout(() => setSaveMessage(null), 2000);
      }
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      setSaveMessage({ 
        text: 'Failed to update notification settings. Please try again.', 
        type: 'error' 
      });
      setTimeout(() => setSaveMessage(null), 5000);
    }
  };

  const handlePhoneChange = (value: string) => {
    handleCompanyTextChange('phone', formatUsPhoneNumber(value));
  };

  const toggleSection = useCallback((id: SettingsSectionId) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      persistExpandedSettingsSections(next);
      return next;
    });
  }, []);

  const companyHasUnsavedChanges = useMemo(() => {
    if (!isLocalStateInitialized || preferences.autoSave) return false;
    const formattedAddress = formatUSAddress(businessAddress);
    return (
      localCompanySettings.companyName !== (companySettings.companyName || '') ||
      localCompanySettings.licenseNumber !== (companySettings.licenseNumber || '') ||
      localCompanySettings.phone !== formatUsPhoneNumber(companySettings.phone || '') ||
      localCompanySettings.email !== (companySettings.email || '') ||
      localCompanySettings.motto !== (companySettings.motto || '') ||
      formattedAddress !== (companySettings.address || '')
    );
  }, [
    businessAddress,
    companySettings,
    isLocalStateInitialized,
    localCompanySettings,
    preferences.autoSave,
  ]);

  const companySummary = useMemo(() => {
    const name = localCompanySettings.companyName.trim() || companySettings.companyName?.trim();
    return name || 'Not set';
  }, [companySettings.companyName, localCompanySettings.companyName]);

  const taxSummary = useMemo(() => {
    if (companySettings.taxSystem === 'none') return 'No tax configured';
    const label = TAX_SYSTEM_LABELS[companySettings.taxSystem] ?? companySettings.taxSystem;
    return `${label} · ${companySettings.taxRatePercent}%`;
  }, [companySettings.taxRatePercent, companySettings.taxSystem]);

  const laborSummary = useMemo(() => {
    const activeCount = laborRates.filter((rate) => rate.isActive).length;
    return activeCount === 1 ? '1 active role' : `${activeCount} active roles`;
  }, [laborRates]);

  const preferencesSummary = useMemo(
    () =>
      `${isDark ? 'Dark' : 'Light'} · ${
        preferences.measurementSystem === 'metric' ? 'Metric' : 'Imperial'
      }`,
    [isDark, preferences.measurementSystem],
  );

  const notificationsSummary = useMemo(() => {
    const enabledCount = Object.entries(preferences.notifications).filter(
      ([key, value]) =>
        ['emailUpdates', 'projectReminders', 'weatherAlerts'].includes(key) && value,
    ).length;
    return `${enabledCount} enabled`;
  }, [preferences.notifications]);

  // Force save function for manual save or when auto-save is disabled
  const forceSaveChanges = async () => {
    if (!companySettingsHydrated) {
      if (import.meta.env.DEV) {
        console.info('[companySettings] Manual save skipped: settings not hydrated yet');
      }
      return;
    }
    try {
      const currentSettings = {
        ...localCompanySettingsRef.current,
        address: formatUSAddress(businessAddressRef.current),
      };
      await updateCompanySettings(currentSettings, { allowEmptyTextOverwrite: true });
      setSaveMessage({ 
        text: 'Settings saved successfully! ✓', 
        type: 'success' 
      });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveMessage({ 
        text: 'Failed to save settings. Please try again.', 
        type: 'error' 
      });
      setTimeout(() => setSaveMessage(null), 5000);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && user) {
      setIsUploadingLogo(true);
      setSaveMessage({ text: 'Optimizing and uploading logo...', type: 'success' });
      
      try {
        // Upload to Supabase Storage with optimization
        const result = await replaceLogo(file, user.id, companySettings.logoPath || undefined);
        
        // Update company settings with the Supabase URL and path
        await updateCompanySettings({ 
          logoUrl: result.publicUrl,
          logoPath: result.path,
          logo: result.publicUrl // For backward compatibility
        });
        
        setSaveMessage({ 
          text: `Logo uploaded successfully! Reduced file size by ${result.optimization.compressionRatio.toFixed(1)}%`, 
          type: 'success' 
        });
        setTimeout(() => setSaveMessage(null), 3000);
      } catch (error) {
        console.error('Error uploading logo:', error);
        setSaveMessage({ 
          text: error instanceof Error ? error.message : 'Failed to upload logo. Please try a different file.', 
          type: 'error' 
        });
        setTimeout(() => setSaveMessage(null), 5000);
      } finally {
        setIsUploadingLogo(false);
      }
    }
  };

  const handleRemoveLogo = async () => {
    const pathToDelete = companySettings.logoPath ?? undefined;
    setIsRemovingLogo(true);
    setSaveMessage(null);

    try {
      soundService.play('trash');

      if (pathToDelete) {
        try {
          await deleteLogo(pathToDelete);
        } catch (storageError) {
          console.warn('Logo storage delete failed; clearing database reference:', storageError);
        }
      }

      await updateCompanySettings({
        logo: null,
        logoUrl: null,
        logoPath: null,
      });

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      setSaveMessage({
        text: 'Company logo removed',
        type: 'success',
      });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error removing logo:', error);
      setSaveMessage({
        text: 'Could not remove company logo',
        type: 'error',
      });
      setTimeout(() => setSaveMessage(null), 5000);
    } finally {
      setIsRemovingLogo(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    
    try {
      // Save any pending text changes
      await forceSaveChanges();
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveMessage({ 
        text: 'Failed to save settings. Please try again.', 
        type: 'error' 
      });
      setTimeout(() => setSaveMessage(null), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      {/* Save Message - Fixed Overlay Toast */}
      {saveMessage && (
        <motion.div 
          initial={{ opacity: 0, y: -50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.9 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={`fixed top-24 right-6 z-[9999] p-4 rounded-lg border shadow-xl max-w-sm ${
            saveMessage.type === 'success' 
              ? 'bg-green-50 dark:bg-green-900/90 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700 backdrop-blur-sm' 
              : 'bg-red-50 dark:bg-red-900/90 text-red-800 dark:text-red-200 border-red-200 dark:border-red-700 backdrop-blur-sm'
          }`}
        >
          <div className="flex items-center gap-2">
            {saveMessage.type === 'success' ? (
              <div className="flex-shrink-0 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            ) : (
              <div className="flex-shrink-0 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
            )}
            <span className="font-medium">{saveMessage.text}</span>
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        <AppPage
          className="w-full !max-w-none pt-6"
          data-testid="settings-page"
          header={
            <>
              <PageHeader
                title="Settings"
                subtitle="Customize your account and application preferences."
                className="[&_h1]:text-slate-900 dark:[&_h1]:text-slate-50 [&_p]:text-slate-600 dark:[&_p]:text-slate-300"
              />
              {preferences.autoSave ? (
                <p className="mt-2">
                  <span className="inline-flex items-center rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                    Auto-save enabled
                  </span>
                </p>
              ) : null}
            </>
          }
        >
          <div className="space-y-4">
            <SettingsCollapsibleSection
              id="company"
              testId="settings-section-company"
              icon={<Building2 className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />}
              title="Company Information"
              description="Logo, business identity, address, contact information, and license details."
              summaryChip={companySummary}
              unsaved={companyHasUnsavedChanges}
              expanded={expandedSections.has('company')}
              onToggle={toggleSection}
            >
              <div className="space-y-6">
          {/* Logo Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Company Logo
            </label>
            <div className="flex items-center space-x-4">
              {(companySettings.logoUrl || companySettings.logo) ? (
                <div className="relative">
                  <img 
                    src={companySettings.logoUrl || companySettings.logo || ''} 
                    alt="Company Logo" 
                    className="w-20 h-20 object-contain border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                  />
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={handleRemoveLogo}
                    disabled={settingsLoading || isRemovingLogo}
                    className="absolute -top-2 -right-2 !h-7 !w-7 !min-h-0 !p-0 rounded-full"
                    aria-label="Remove logo"
                  >
                    <Trash2 size={12} />
                  </Button>
                </div>
              ) : (
                <div className="w-20 h-20 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center bg-gray-50 dark:bg-gray-800">
                  <Camera className="h-8 w-8 text-gray-400" />
                </div>
              )}
              
              <div className="flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  icon={<Upload size={16} />}
                  variant="outline"
                  disabled={isUploadingLogo}
                >
                  {isUploadingLogo ? 'Processing...' : 'Upload Logo'}
                </Button>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  PNG, JPG, GIF, WebP up to 10MB. Will be optimized to 400px PNG for best logo quality.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Company Name"
              value={localCompanySettings.companyName}
              onChange={(e) => handleCompanyTextChange('companyName', e.target.value)}
              placeholder="Your Company Name"
              icon={<Building2 size={16} />}
            />
            
            <Input
              label="License Number"
              value={localCompanySettings.licenseNumber}
              onChange={(e) => handleCompanyTextChange('licenseNumber', e.target.value)}
              placeholder="License #12345"
              icon={<Shield size={16} />}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <MapPin size={16} />
              Business address
            </label>
            <USAddressFields
              value={businessAddress}
              onChange={handleBusinessAddressChange}
              showStreet2
              idPrefix="company"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Phone Number"
              type="tel"
              value={localCompanySettings.phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="(555) 123-4567"
              icon={<Phone size={16} />}
              inputMode="tel"
              autoComplete="tel"
              maxLength={14}
            />
            
            <Input
              label="Email Address"
              type="email"
              value={localCompanySettings.email}
              onChange={(e) => handleCompanyTextChange('email', e.target.value)}
              placeholder="contact@company.com"
              icon={<Mail size={16} />}
            />
          </div>

          <Input
            label="Company Motto/Slogan"
            value={localCompanySettings.motto}
            onChange={(e) => handleCompanyTextChange('motto', e.target.value)}
            placeholder="Building Excellence, One Project at a Time"
            icon={<Quote size={16} />}
          />
              </div>
            </SettingsCollapsibleSection>

            <SettingsCollapsibleSection
              id="tax"
              testId="settings-section-tax"
              icon={<Calculator className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />}
              title="Company Tax Settings"
              description="Default tax system, rate, and tax application rules for new proposals."
              summaryChip={taxSummary}
              expanded={expandedSections.has('tax')}
              onToggle={toggleSection}
            >
              <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                Default tax applied to new proposals and change orders. You can override per
                document.
              </p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Select
            label="Tax system"
            value={companySettings.taxSystem}
            onChange={(value) => void handleCompanyImmediateChange('taxSystem', value)}
            options={[
              { value: 'none', label: 'None' },
              { value: 'sales_tax', label: 'Sales tax' },
              { value: 'gross_receipts_tax', label: 'Gross receipts tax' },
              { value: 'vat', label: 'VAT' },
            ]}
          />
          <TaxRatePercentInput
            value={companySettings.taxRatePercent}
            onChange={(rate) => void updateCompanySettings({ taxRatePercent: rate })}
          />
          <Select
            label="Apply tax to"
            value={companySettings.taxApplication}
            onChange={(value) =>
              void handleCompanyImmediateChange('taxApplication', value)
            }
            options={[
              { value: 'materials_only', label: 'Materials only' },
              { value: 'materials_and_equipment', label: 'Materials + equipment' },
              { value: 'entire_project', label: 'Entire pre-tax amount' },
            ]}
          />
              </div>
            </SettingsCollapsibleSection>

            <SettingsCollapsibleSection
              id="labor"
              testId="settings-section-labor"
              icon={<Users className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />}
              title="Labor Rate Library"
              description="Company labor roles, burden, billing rates, and starter defaults."
              summaryChip={laborSummary}
              expanded={expandedSections.has('labor')}
              onToggle={toggleSection}
            >
              <LaborRateLibrarySection hideTitle />
            </SettingsCollapsibleSection>

            <SettingsCollapsibleSection
              id="preferences"
              testId="settings-section-preferences"
              icon={<User className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />}
              title="User Preferences"
              description="Theme, units, currency, sound, haptics, and auto-save behavior."
              summaryChip={preferencesSummary}
              expanded={expandedSections.has('preferences')}
              onToggle={toggleSection}
            >
              <div className="space-y-6">
          {/* Theme Toggle */}
          <div className={`flex items-center justify-between p-4 ${PREMIUM_INNER_PANEL}`}>
            <div className="flex items-center gap-3">
              {isDark ? <Moon className="h-5 w-5 text-blue-600 dark:text-blue-400" /> : <Sun className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">Theme</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Choose between light and dark mode
                </p>
              </div>
            </div>
            <Button
              onClick={toggleTheme}
              variant="outline"
              size="sm"
            >
              {isDark ? 'Light Mode' : 'Dark Mode'}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Volume Unit"
              value={preferences.volumeUnit}
              onChange={(value) => handlePreferenceChange('volumeUnit', value)}
              options={[
                { value: 'cubic_yards', label: 'Cubic Yards (yd³)' },
                { value: 'cubic_feet', label: 'Cubic Feet (ft³)' },
                { value: 'cubic_meters', label: 'Cubic Meters (m³)' }
              ]}
            />

            <Select
              label="Measurement System"
              value={preferences.measurementSystem}
              onChange={(value) => handlePreferenceChange('measurementSystem', value)}
              options={[
                { value: 'imperial', label: 'Imperial (ft, in)' },
                { value: 'metric', label: 'Metric (m, cm)' }
              ]}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Currency"
              value={preferences.currency}
              onChange={(value) => handlePreferenceChange('currency', value)}
              options={[
                { value: 'USD', label: 'US Dollar ($)' },
                { value: 'CAD', label: 'Canadian Dollar (C$)' },
                { value: 'EUR', label: 'Euro (€)' },
                { value: 'GBP', label: 'British Pound (£)' }
              ]}
            />

            <Select
              label="Default PSI"
              value={preferences.defaultPSI}
              onChange={(value) => handlePreferenceChange('defaultPSI', value)}
              options={[
                { value: '2500', label: '2500 PSI' },
                { value: '3000', label: '3000 PSI' },
                { value: '4000', label: '4000 PSI' },
                { value: '5000', label: '5000 PSI' }
              ]}
            />
          </div>

          <div className={`flex items-center justify-between p-4 ${PREMIUM_INNER_PANEL}`}>
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">Sound Effects</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Enable or disable sound effects for notifications and interactions
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => {
                  soundService.testSounds();
                }}
                variant="outline"
                size="sm"
              >
                Test Sounds
              </Button>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.soundEnabled}
                  onChange={(e) => {
                    handlePreferenceChange('soundEnabled', e.target.checked);
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border border-purple-200/70 bg-purple-50/80 dark:border-purple-900/50 dark:bg-purple-950/25">
            <div className="flex items-center gap-3">
              <Volume className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">Haptic Feedback</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Feel tactile feedback for button presses and interactions
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => {
                  hapticService.testHaptics();
                }}
                variant="outline"
                size="sm"
              >
                Test Haptics
              </Button>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.hapticsEnabled ?? true}
                  onChange={(e) => {
                    handlePreferenceChange('hapticsEnabled', e.target.checked);
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>

          {/* Auto-save Toggle */}
          <div className={`flex items-center justify-between p-4 ${PREMIUM_INNER_PANEL}`}>
            <div className="flex items-center gap-3">
              <Save className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">Auto-save</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Automatically save changes after you stop typing (1.5s delay)
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.autoSave}
                onChange={(e) => {
                  handlePreferenceChange('autoSave', e.target.checked);
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
              </div>
            </SettingsCollapsibleSection>

            <SettingsCollapsibleSection
              id="notifications"
              testId="settings-section-notifications"
              icon={<Bell className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />}
              title="Notifications"
              description="Email updates, project reminders, and weather alerts."
              summaryChip={notificationsSummary}
              expanded={expandedSections.has('notifications')}
              onToggle={toggleSection}
            >
              <div className="space-y-4">
        {Object.entries(preferences.notifications)
  .filter(([key]) =>
    ['emailUpdates', 'projectReminders', 'weatherAlerts'].includes(key)
  )
  .map(([key, value]) => (
            <div key={key} className={`flex items-center justify-between p-4 ${PREMIUM_INNER_PANEL}`}>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">
                  {key === 'emailUpdates' && 'Email Updates'}
                  {key === 'projectReminders' && 'Project Reminders'}
                  {key === 'weatherAlerts' && 'Weather Alerts'}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {key === 'emailUpdates' && 'Receive updates about new features and improvements'}
                  {key === 'projectReminders' && 'Get reminded about ongoing projects and deadlines'}
                  {key === 'weatherAlerts' && 'Receive alerts about weather conditions affecting concrete work'}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) => {
                    handleNotificationChange(key, e.target.checked);
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>
          ))}
              </div>
            </SettingsCollapsibleSection>

            <SettingsLinkSection
              testId="settings-billing-link"
              icon={<CreditCard className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />}
              title="Billing & Subscription"
              description="View your plan, upgrade, and manage Stripe billing."
              summaryChip="Manage plan"
              onNavigate={() => navigate('/settings/billing')}
            />

            <SettingsLinkSection
              testId="settings-accounting-tax-link"
              icon={<BookOpen className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />}
              title="Accounting & Tax"
              description="Generate year-end export packages for CPAs, QuickBooks, and tax preparation."
              summaryChip="Open package"
              onNavigate={() => navigate('/accounting-tax')}
            />

            <div className="flex flex-col gap-4 pt-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {preferences.autoSave ? (
            <span className="flex items-center gap-2">
              <Save size={16} className="text-green-500" />
              Text changes auto-save after 1.5s delay
            </span>
          ) : (
            'Auto-save is disabled. Use the save button to save changes.'
          )}
        </div>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={isSaving || settingsLoading || preferencesLoading}
          isLoading={isSaving}
          icon={<Save size={18} />}
        >
          {isSaving ? 'Saving...' : 'Save All Settings'}
        </Button>
            </div>
          </div>
        </AppPage>
      </motion.div>
    </>
  );
};

export default Settings; 