import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { optimizeLogo, validateImageFile, formatFileSize } from '../utils/imageOptimization';
import { uploadLogo, replaceLogo, deleteLogo } from '../services/storageService';
import { useAuth } from '../hooks/useAuth';
import { UserPreferences } from '../types';
import { 
  User, 
  Building2, 
  Phone, 
  Mail, 
  MapPin, 
  FileText, 
  Quote, 
  Upload, 
  Save, 
  Moon, 
  Sun, 
  Calculator,
  Bell,
  Globe,
  Shield,
  Trash2,
  Camera
} from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import { useThemeStore } from '../store/themeStore';
import { useSettingsStore, usePreferencesStore } from '../store';

const Settings: React.FC = () => {
  const { user } = useAuth();
  const { isDark, toggleTheme } = useThemeStore();
  const { companySettings, updateCompanySettings, loadCompanySettings, migrateSettings, loading: settingsLoading } = useSettingsStore();
  const { preferences, updatePreferences, loadPreferences, migratePreferences, loading: preferencesLoading } = usePreferencesStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  
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
  const [isLocalStateInitialized, setIsLocalStateInitialized] = useState(false);
  const initializationRef = useRef(false);
  const localCompanySettingsRef = useRef(localCompanySettings);

  // Update ref whenever local state changes
  useEffect(() => {
    localCompanySettingsRef.current = localCompanySettings;
  }, [localCompanySettings]);

  // Load settings and preferences on mount
  useEffect(() => {
    const initializeSettings = async () => {
      if (user && !initializationRef.current) {
        initializationRef.current = true;
        console.log('🔄 Settings page: User already authenticated, data should be loaded globally');
        // Data loading is now handled in App.tsx, so we don't need to load again here
        // Just log that initialization was attempted
      }
    };

    initializeSettings();
  }, [user]); // Simplified dependencies

  // Initialize local state only once when company settings are first loaded
  useEffect(() => {
    console.log('🔍 Checking local state initialization:', {
      isLocalStateInitialized,
      companySettingsKeys: Object.keys(companySettings),
      companyName: companySettings.companyName
    });
    
    // Only initialize if not already done AND we have actual data from database
    if (!isLocalStateInitialized && (companySettings.companyName !== undefined || companySettings.address !== undefined)) {
      console.log('🔧 Initializing local state with:', companySettings);
      setLocalCompanySettings({
        companyName: companySettings.companyName || '',
        address: companySettings.address || '',
        phone: companySettings.phone || '',
        email: companySettings.email || '',
        licenseNumber: companySettings.licenseNumber || '',
        motto: companySettings.motto || ''
      });
      setIsLocalStateInitialized(true);
    }
  }, [companySettings, isLocalStateInitialized]);

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
          // Only auto-save if preferences are loaded and auto-save is enabled
          if (!preferencesLoading && preferences.autoSave) {
            isCurrentlySaving = true;
            const currentSettings = localCompanySettingsRef.current;
            console.log('Auto-saving all local settings:', currentSettings);
            
            try {
              // Save ALL current local state, not just one field
              await updateCompanySettings(currentSettings);
              console.log('Auto-save successful for all fields');
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
    [preferences.autoSave, preferencesLoading, updateCompanySettings] // Removed localCompanySettings dependency
  );

  // Handle text input changes (with debouncing)
  const handleCompanyTextChange = (field: string, value: string) => {
    console.log(`📝 Text input changed - Field: ${field}, Value: "${value}"`);
    
    // Update local state immediately for responsive UI
    setLocalCompanySettings(prev => {
      const updated = { ...prev, [field]: value };
      console.log('🔄 Updated local state:', updated);
      return updated;
    });
    
    // Debounce the API call only if preferences are loaded
    if (!preferencesLoading && preferences.autoSave) {
      console.log(`⏰ Triggering debounced save for all fields (triggered by ${field})`);
      debouncedSave(); // No longer pass field/value - save everything
    } else {
      console.log(`❌ Auto-save skipped - preferencesLoading: ${preferencesLoading}, autoSave: ${preferences.autoSave}`);
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
    // Remove all non-numeric characters
    const numericValue = value.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX
    let formattedValue = numericValue;
    if (numericValue.length >= 6) {
      formattedValue = `(${numericValue.slice(0, 3)}) ${numericValue.slice(3, 6)}-${numericValue.slice(6, 10)}`;
    } else if (numericValue.length >= 3) {
      formattedValue = `(${numericValue.slice(0, 3)}) ${numericValue.slice(3)}`;
    }
    
    handleCompanyTextChange('phone', formattedValue);
  };

  // Force save function for manual save or when auto-save is disabled
  const forceSaveChanges = async () => {
    try {
      const currentSettings = localCompanySettingsRef.current;
      console.log('🔄 Force saving all local settings:', currentSettings);
      await updateCompanySettings(currentSettings);
      console.log('✅ Force save successful');
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
        
        // Show compression stats
        console.log(`Logo optimized from ${formatFileSize(result.optimization.originalSize)} to ${formatFileSize(result.optimization.compressedSize)} (${result.optimization.compressionRatio.toFixed(1)}% reduction)`);
        
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
    try {
      // Delete from Supabase Storage if there's a path
      if (companySettings.logoPath) {
        await deleteLogo(companySettings.logoPath);
      }
      
      // Update company settings to remove logo
      await updateCompanySettings({ 
        logo: null, 
        logoUrl: null, 
        logoPath: null 
      });
      
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      setSaveMessage({ 
        text: 'Logo removed successfully', 
        type: 'success' 
      });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error removing logo:', error);
      setSaveMessage({ 
        text: 'Failed to remove logo. Please try again.', 
        type: 'error' 
      });
      setTimeout(() => setSaveMessage(null), 5000);
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-4xl mx-auto space-y-6"
    >
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
          Settings
        </h1>
        <p className="text-white text-lg drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] mt-2">
          Customize your account and application preferences
          {preferences.autoSave && (
            <span className="ml-2 text-sm bg-green-500/20 text-green-200 px-2 py-1 rounded">
              Auto-save enabled
            </span>
          )}
        </p>
      </div>

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

      {/* Company Information */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Company Information
          </h2>
        </div>

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
                  <button
                    onClick={handleRemoveLogo}
                    disabled={settingsLoading}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={12} />
                  </button>
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

          <Input
            label="Business Address"
            value={localCompanySettings.address}
            onChange={(e) => handleCompanyTextChange('address', e.target.value)}
            placeholder="123 Main St, City, State 12345"
            icon={<MapPin size={16} />}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Phone Number"
              value={localCompanySettings.phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="(555) 123-4567"
              icon={<Phone size={16} />}
              inputMode="numeric"
              pattern="[0-9\s\(\)\-]*"
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
      </Card>

      {/* User Preferences */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <User className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            User Preferences
          </h2>
        </div>

        <div className="space-y-6">
          {/* Theme Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
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

          {/* Auto-save Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
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
                onChange={(e) => handlePreferenceChange('autoSave', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </Card>

      {/* Notifications */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Bell className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Notifications
          </h2>
        </div>

        <div className="space-y-4">
          {Object.entries(preferences.notifications).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
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
                  onChange={(e) => handleNotificationChange(key, e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>
          ))}
        </div>
      </Card>

      {/* Save Button - now shows unsaved changes indicator */}
      <div className="flex justify-between items-center">
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
          onClick={handleSave}
          disabled={isSaving || settingsLoading || preferencesLoading}
          icon={<Save size={18} />}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          {isSaving ? 'Saving...' : 'Save All Settings'}
        </Button>
      </div>
    </motion.div>
  );
};

export default Settings; 