import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
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
import { useAuth } from '../hooks/useAuth';

interface CompanySettings {
  companyName: string;
  address: string;
  phone: string;
  email: string;
  licenseNumber: string;
  motto: string;
  logo: string | null;
}

interface UserPreferences {
  volumeUnit: 'cubic_yards' | 'cubic_feet' | 'cubic_meters';
  measurementSystem: 'imperial' | 'metric';
  currency: 'USD' | 'CAD' | 'EUR' | 'GBP';
  notifications: {
    emailUpdates: boolean;
    projectReminders: boolean;
    weatherAlerts: boolean;
  };
  defaultPSI: string;
  autoSave: boolean;
}

const Settings: React.FC = () => {
  const { user } = useAuth();
  const { isDark, toggleTheme } = useThemeStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [companySettings, setCompanySettings] = useState<CompanySettings>({
    companyName: '',
    address: '',
    phone: '',
    email: user?.email || '',
    licenseNumber: '',
    motto: '',
    logo: null
  });

  const [preferences, setPreferences] = useState<UserPreferences>({
    volumeUnit: 'cubic_yards',
    measurementSystem: 'imperial',
    currency: 'USD',
    notifications: {
      emailUpdates: true,
      projectReminders: true,
      weatherAlerts: true
    },
    defaultPSI: '3000',
    autoSave: true
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleCompanyChange = (field: keyof CompanySettings, value: string) => {
    setCompanySettings(prev => ({ ...prev, [field]: value }));
  };

  const handlePreferenceChange = (field: keyof UserPreferences, value: any) => {
    setPreferences(prev => ({ ...prev, [field]: value }));
  };

  const handleNotificationChange = (field: keyof UserPreferences['notifications'], value: boolean) => {
    setPreferences(prev => ({
      ...prev,
      notifications: { ...prev.notifications, [field]: value }
    }));
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setSaveMessage({ text: 'Logo file size must be less than 5MB', type: 'error' });
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setCompanySettings(prev => ({ ...prev, logo: result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setCompanySettings(prev => ({ ...prev, logo: null }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    
    try {
      // TODO: Save to Supabase or local storage
      // For now, we'll simulate saving
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setSaveMessage({ text: 'Settings saved successfully! ✓', type: 'success' });
      
      // Auto-hide success message after 3 seconds
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveMessage({ 
        text: 'Failed to save settings. Please try again.', 
        type: 'error' 
      });
      
      // Auto-hide error message after 5 seconds
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
        </p>
      </div>

      {/* Save Message */}
      {saveMessage && (
        <div className={`p-4 rounded-lg border ${
          saveMessage.type === 'success' 
            ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800' 
            : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800'
        }`}>
          {saveMessage.text}
        </div>
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
              {companySettings.logo ? (
                <div className="relative">
                  <img 
                    src={companySettings.logo} 
                    alt="Company Logo" 
                    className="w-20 h-20 object-contain border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                  />
                  <button
                    onClick={handleRemoveLogo}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
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
                >
                  Upload Logo
                </Button>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  PNG, JPG up to 5MB. Recommended: 200x200px
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Company Name"
              value={companySettings.companyName}
              onChange={(e) => handleCompanyChange('companyName', e.target.value)}
              placeholder="Your Company Name"
              icon={<Building2 size={16} />}
            />
            
            <Input
              label="License Number"
              value={companySettings.licenseNumber}
              onChange={(e) => handleCompanyChange('licenseNumber', e.target.value)}
              placeholder="License #12345"
              icon={<Shield size={16} />}
            />
          </div>

          <Input
            label="Business Address"
            value={companySettings.address}
            onChange={(e) => handleCompanyChange('address', e.target.value)}
            placeholder="123 Main St, City, State 12345"
            icon={<MapPin size={16} />}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Phone Number"
              value={companySettings.phone}
              onChange={(e) => handleCompanyChange('phone', e.target.value)}
              placeholder="(555) 123-4567"
              icon={<Phone size={16} />}
            />
            
            <Input
              label="Email Address"
              type="email"
              value={companySettings.email}
              onChange={(e) => handleCompanyChange('email', e.target.value)}
              placeholder="contact@company.com"
              icon={<Mail size={16} />}
            />
          </div>

          <Input
            label="Company Motto/Slogan"
            value={companySettings.motto}
            onChange={(e) => handleCompanyChange('motto', e.target.value)}
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
                  Automatically save calculations and projects
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
                  onChange={(e) => handleNotificationChange(key as keyof UserPreferences['notifications'], e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>
          ))}
        </div>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isSaving}
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