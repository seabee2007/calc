import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Building2, Mail, Phone, MapPin, FileText, Save, ArrowLeft } from 'lucide-react';
import Input from '../ui/Input';
import { useSettingsStore } from '../../store';
import { formatUsPhoneNumber, isValidUsPhoneNumber } from '../../utils/phoneFormatting';
import OnboardingShell from './OnboardingShell';
import OnboardingStepHeader from './OnboardingStepHeader';
import {
  ONBOARDING_CARD,
  ONBOARDING_FIELD_GROUP,
  ONBOARDING_HELP_TEXT,
  ONBOARDING_INPUT,
  ONBOARDING_PRIMARY_BUTTON,
  ONBOARDING_SECONDARY_BUTTON,
  ONBOARDING_SKIP_BUTTON,
} from './onboardingTheme';

interface ProfileSetupProps {
  onBack: () => void;
  onComplete: () => void;
}

const inputClassName = `${ONBOARDING_INPUT} !rounded-xl !border-white/10 !bg-slate-950/70 !px-4 !py-3 !text-white placeholder:!text-slate-500 focus:!border-cyan-400/60 focus:!ring-2 focus:!ring-cyan-400/20 !shadow-none [&+p]:text-slate-400`;

const ProfileSetup: React.FC<ProfileSetupProps> = ({ onBack, onComplete }) => {
  const navigate = useNavigate();
  const { companySettings, updateCompanySettings } = useSettingsStore();

  const [formData, setFormData] = useState({
    companyName: companySettings.companyName || '',
    email: companySettings.email || '',
    phone: formatUsPhoneNumber(companySettings.phone || ''),
    address: companySettings.address || '',
    licenseNumber: companySettings.licenseNumber || '',
    motto: companySettings.motto || '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [phoneError, setPhoneError] = useState<string | undefined>();

  const handleInputChange = (field: string, value: string) => {
    const nextValue = field === 'phone' ? formatUsPhoneNumber(value) : value;
    if (field === 'phone') {
      setPhoneError(undefined);
    }
    setFormData((prev) => ({
      ...prev,
      [field]: nextValue,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const phone = formData.phone.trim();
    if (phone && !isValidUsPhoneNumber(phone)) {
      setPhoneError('Enter a valid 10-digit phone number or skip this step.');
      return;
    }

    setIsLoading(true);

    try {
      await updateCompanySettings(
        {
          ...companySettings,
          ...formData,
        },
        { allowEmptyTextOverwrite: true },
      );

      try {
        localStorage.setItem('onboarding_completed', 'true');
      } catch (storageError) {
        console.error('LocalStorage error:', storageError);
      }

      setTimeout(() => {
        setIsLoading(false);
        onComplete();
        try {
          navigate('/');
        } catch (navError) {
          console.error('Navigation error:', navError);
          window.location.href = '/';
        }
      }, 1500);
    } catch (error) {
      console.error('Error saving profile:', error);
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    try {
      localStorage.setItem('onboarding_completed', 'true');
    } catch (error) {
      console.error('LocalStorage error:', error);
    }

    try {
      navigate('/');
    } catch (error) {
      console.error('Navigation error:', error);
      window.location.href = '/';
    }
  };

  return (
    <OnboardingShell>
      <div className="flex flex-1 flex-col py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-1 flex-col"
        >
          <div className={`${ONBOARDING_CARD} mb-6`}>
            <OnboardingStepHeader
              title="Setup Your Profile"
              description="Tell us about your business to personalize your experience"
            />

            <form onSubmit={handleSubmit} className={`${ONBOARDING_FIELD_GROUP} space-y-6`}>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <Input
                  label="Company Name"
                  placeholder="Your Construction Company"
                  value={formData.companyName}
                  onChange={(e) => handleInputChange('companyName', e.target.value)}
                  icon={<Building2 size={18} className="text-slate-400" />}
                  required
                  fullWidth
                  className={inputClassName}
                />

                <Input
                  label="Email Address"
                  type="email"
                  placeholder="contact@yourcompany.com"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  icon={<Mail size={18} className="text-slate-400" />}
                  required
                  fullWidth
                  className={inputClassName}
                />

                <Input
                  label="Phone Number"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="(555) 123-4567"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  icon={<Phone size={18} className="text-slate-400" />}
                  maxLength={14}
                  error={phoneError}
                  fullWidth
                  className={inputClassName}
                />

                <Input
                  label="License Number"
                  placeholder="License #123456"
                  value={formData.licenseNumber}
                  onChange={(e) => handleInputChange('licenseNumber', e.target.value)}
                  icon={<FileText size={18} className="text-slate-400" />}
                  fullWidth
                  className={inputClassName}
                />
              </div>

              <Input
                label="Business Address"
                placeholder="123 Main St, Your City, State ZIP"
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                icon={<MapPin size={18} className="text-slate-400" />}
                fullWidth
                className={inputClassName}
              />

              <Input
                label="Company Motto (Optional)"
                placeholder="Quality concrete solutions since 1995"
                value={formData.motto}
                onChange={(e) => handleInputChange('motto', e.target.value)}
                fullWidth
                className={inputClassName}
              />

              <div className="flex flex-col gap-4 pt-2 sm:flex-row sm:items-center">
                <button type="button" onClick={onBack} className={ONBOARDING_SECONDARY_BUTTON}>
                  <ArrowLeft size={18} />
                  Back
                </button>

                <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-center">
                  <button type="button" onClick={handleSkip} className={ONBOARDING_SKIP_BUTTON}>
                    Skip for now
                  </button>

                  <button
                    type="submit"
                    disabled={isLoading || !formData.companyName || !formData.email}
                    className={`${ONBOARDING_PRIMARY_BUTTON} flex-1`}
                  >
                    {isLoading ? (
                      'Saving...'
                    ) : (
                      <>
                        <Save size={18} />
                        Save &amp; Continue
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className={`${ONBOARDING_HELP_TEXT} text-center`}
          >
            You can always update this information later in Settings
          </motion.p>
        </motion.div>
      </div>
    </OnboardingShell>
  );
};

export default ProfileSetup;
