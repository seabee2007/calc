import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import WelcomeScreen from './WelcomeScreen';
import { usePreferencesStore, useSettingsStore } from '../../store';
import { useThemeStore } from '../../store/themeStore';
import { isValidUsPhoneNumber } from '../../utils/phoneFormatting';
import OnboardingStep, { trimPipeAddress } from './OnboardingStep';
import OnboardingShell from './OnboardingShell';
import ThemeSelector from './ThemeSelector';
import MeasurementSystemSelector from './MeasurementSystemSelector';
import { useAuth } from '../../hooks/useAuth';
import type { Profile } from '../../types/fieldPlanner';
import {
  getMeasurementSystemFromPreferences,
  measurementSystemToLegacyUnits,
  type MeasurementSystem,
} from '../../utils/measurementPreferences';
import {
  getOnboardingDraft,
  saveOnboardingDraft,
  clearOnboardingDraft,
  mergeOnboardingDraftValues,
  isValidOnboardingStep,
  type OnboardingStepType,
} from '../../lib/onboardingDraft';

// Re-export so App.tsx and tests can reference the type from one place.
export type { OnboardingStepType };

interface OnboardingFlowProps {
  onComplete: () => void;
}

interface StepConfig {
  title: string;
  description: string;
  placeholder: string;
  required: boolean;
  type: string;
}

const ONBOARDING_STEPS: OnboardingStepType[] = [
  'welcome',
  'company-name',
  'email',
  'phone',
  'address',
  'license',
  'motto',
  'measurement-system',
  'theme',
];

/** Build a pipe-delimited address string from the signup-captured profile address fields. */
function profileAddressToPipe(profile: Profile | null | undefined): string {
  if (!profile) return '';
  const street = profile.businessAddressStreet?.trim() ?? '';
  const street2 = profile.businessAddressStreet2?.trim() ?? '';
  const city = profile.businessAddressCity?.trim() ?? '';
  const state = profile.businessAddressState?.trim() ?? '';
  const zip = profile.businessAddressPostalCode?.trim() ?? '';
  if (!street && !city && !state && !zip) return '';
  return [street, street2, city, state, zip].join('|');
}

const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const navigate = useNavigate();
  const { updateCompanySettings, companySettings, companySettingsHydrated } = useSettingsStore();
  const { preferences, updatePreferences } = usePreferencesStore();
  const { isDark, toggleTheme } = useThemeStore();
  const { user, profile, profileLoading } = useAuth();

  const [currentStep, setCurrentStep] = useState<OnboardingStepType>('welcome');
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [formData, setFormData] = useState({
    companyName: '',
    email: '',
    phone: '',
    address: '',
    licenseNumber: '',
    motto: '',
    measurementSystem: getMeasurementSystemFromPreferences(preferences),
    theme: isDark ? 'dark' : 'light',
  });

  // True once the step + formData have been initialized from draft/server.
  // Prevents re-initialization on subsequent renders and also gates draft-saving
  // (we don't want to overwrite a restored draft with empty initial state).
  const initializedRef = useRef(false);
  // Separate flag so the save effect doesn't fire before initialization completes.
  const draftReadyRef = useRef(false);

  // ── Initialization: restore draft, then fill gaps from companySettings/profile ─

  useEffect(() => {
    if (initializedRef.current) return;
    if (!companySettingsHydrated || profileLoading) return;
    if (!user?.id) return;

    // Server-sourced defaults (lowest priority).
    const savedAddress = companySettings.address?.trim() ?? '';
    const serverValues = {
      companyName: companySettings.companyName?.trim() || '',
      email: companySettings.email?.trim() || user?.email?.trim() || '',
      phone: companySettings.phone?.trim() || profile?.phone?.trim() || '',
      address: savedAddress || profileAddressToPipe(profile),
      licenseNumber: companySettings.licenseNumber?.trim() || '',
      motto: companySettings.motto?.trim() || '',
      measurementSystem: getMeasurementSystemFromPreferences(preferences),
      theme: isDark ? 'dark' : 'light',
    };

    // Draft overrides server defaults for any field the user has typed.
    const draft = getOnboardingDraft(user.id);
    const merged = draft
      ? mergeOnboardingDraftValues(serverValues, draft.values)
      : serverValues;

    setFormData(merged);

    // Restore step from draft if present and valid; otherwise start at welcome.
    if (draft && isValidOnboardingStep(draft.currentStep)) {
      setCurrentStep(draft.currentStep);
    }

    initializedRef.current = true;
    draftReadyRef.current = true;
  }, [companySettingsHydrated, profileLoading, companySettings, profile, user, isDark, preferences]);

  // ── Draft persistence: save whenever step or form data changes ──────────────

  const saveDraft = useCallback(() => {
    if (!draftReadyRef.current || !user?.id) return;
    saveOnboardingDraft(user.id, {
      schemaVersion: 1,
      userId: user.id,
      currentStep,
      completedSteps: [],
      values: {
        companyName: formData.companyName,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        licenseNumber: formData.licenseNumber,
        motto: formData.motto,
        measurementSystem: formData.measurementSystem,
        theme: formData.theme,
      },
    });
  }, [user?.id, currentStep, formData]);

  useEffect(() => {
    saveDraft();
  }, [saveDraft]);

  // ── Input handler ───────────────────────────────────────────────────────────

  const handleInputChange = (value: string) => {
    if (currentStep === 'phone') {
      setPhoneError(undefined);
    }

    setFormData(prev => ({
      ...prev,
      [currentStep === 'company-name' ? 'companyName' :
       currentStep === 'license' ? 'licenseNumber' : currentStep]: value,
    }));
  };

  // ── Navigation ──────────────────────────────────────────────────────────────

  const handleNext = async () => {
    const currentIndex = ONBOARDING_STEPS.indexOf(currentStep);

    if (currentStep === 'phone') {
      const phone = formData.phone.trim();
      if (phone && !isValidUsPhoneNumber(phone)) {
        setPhoneError('Enter a valid 10-digit phone number or skip this step.');
        return;
      }
      setPhoneError(undefined);
    }

    if (currentIndex === ONBOARDING_STEPS.length - 1) {
      // Apply theme change immediately.
      if ((formData.theme === 'dark' && !isDark) || (formData.theme === 'light' && isDark)) {
        toggleTheme();
      }

      // Trim address parts at submit time, not during typing.
      const settingsData = {
        companyName: formData.companyName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        address: trimPipeAddress(formData.address),
        licenseNumber: formData.licenseNumber.trim(),
        motto: formData.motto.trim(),
      };

      try {
        await Promise.all([
          updateCompanySettings(settingsData, { allowEmptyTextOverwrite: true }),
          updatePreferences(
            measurementSystemToLegacyUnits(formData.measurementSystem as MeasurementSystem),
          ),
        ]);
        // Settings saved — clear the draft before calling onComplete so a
        // hard reload between this and onComplete doesn't re-show onboarding.
        if (user?.id) {
          clearOnboardingDraft(user.id);
        }
        onComplete();
        navigate('/');
      } catch (error) {
        console.error('Error saving settings:', error);
        // Settings save failed — keep the draft so the user can retry.
        // Still complete onboarding so the user is not stuck.
        onComplete();
        navigate('/');
      }
    } else {
      setCurrentStep(ONBOARDING_STEPS[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    const currentIndex = ONBOARDING_STEPS.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(ONBOARDING_STEPS[currentIndex - 1]);
    }
  };

  const handleSkip = () => {
    const currentIndex = ONBOARDING_STEPS.indexOf(currentStep);
    if (currentIndex < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(ONBOARDING_STEPS[currentIndex + 1]);
    } else {
      void updatePreferences(
        measurementSystemToLegacyUnits(formData.measurementSystem as MeasurementSystem),
      );
      if (user?.id) {
        clearOnboardingDraft(user.id);
      }
      onComplete();
    }
  };

  // ── Step config ─────────────────────────────────────────────────────────────

  const stepConfig: Record<Exclude<OnboardingStepType, 'welcome' | 'measurement-system' | 'theme'>, StepConfig> = {
    'company-name': {
      title: 'Company Name',
      description: 'Enter the company name to appear on your account, proposals and emails',
      placeholder: 'Your Construction Company',
      required: true,
      type: 'text',
    },
    email: {
      title: 'Email Address',
      description: 'Enter the email address clients can reach you at',
      placeholder: 'contact@yourcompany.com',
      required: true,
      type: 'email',
    },
    phone: {
      title: 'Phone Number',
      description: 'Enter your company phone number',
      placeholder: '(555) 123-4567',
      required: false,
      type: 'tel',
    },
    address: {
      title: 'Business Address',
      description: "Enter your company's business address",
      placeholder: 'Street Address',
      required: false,
      type: 'text',
    },
    license: {
      title: 'License Number',
      description: 'Enter your contractor license number (if applicable)',
      placeholder: 'License #123456',
      required: false,
      type: 'text',
    },
    motto: {
      title: 'Company Motto',
      description: 'Enter a motto or slogan for your company (optional)',
      placeholder: 'Quality concrete solutions since 1995',
      required: false,
      type: 'text',
    },
  };

  const getCurrentValue = (step: OnboardingStepType): string => {
    switch (step) {
      case 'company-name':
        return formData.companyName;
      case 'license':
        return formData.licenseNumber;
      case 'address': {
        const [line1 = '', line2 = '', city = '', state = '', zip = ''] =
          formData.address.split('|');
        return [line1, line2, city, state, zip].join('|');
      }
      case 'theme':
        return formData.theme;
      case 'measurement-system':
        return formData.measurementSystem;
      default:
        return formData[step as keyof typeof formData] || '';
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <OnboardingShell>
      <AnimatePresence mode="wait">
        {currentStep === 'welcome' ? (
          <WelcomeScreen key="welcome" onNext={handleNext} onSkip={handleSkip} />
        ) : currentStep === 'theme' ? (
          <ThemeSelector
            key="theme"
            value={formData.theme}
            onChange={(theme: 'light' | 'dark') =>
              setFormData(prev => ({ ...prev, theme }))
            }
            onNext={handleNext}
            onBack={handleBack}
          />
        ) : currentStep === 'measurement-system' ? (
          <MeasurementSystemSelector
            key="measurement-system"
            value={formData.measurementSystem as MeasurementSystem}
            onChange={(measurementSystem) =>
              setFormData(prev => ({ ...prev, measurementSystem }))
            }
            onNext={handleNext}
            onBack={handleBack}
            onSkip={handleSkip}
          />
        ) : (
          <OnboardingStep
            key={currentStep}
            title={stepConfig[currentStep].title}
            description={stepConfig[currentStep].description}
            placeholder={stepConfig[currentStep].placeholder}
            value={getCurrentValue(currentStep)}
            onChange={handleInputChange}
            onNext={handleNext}
            onBack={handleBack}
            onSkip={currentStep === 'motto' ? undefined : handleSkip}
            required={stepConfig[currentStep].required}
            type={stepConfig[currentStep].type}
            isLastStep={false}
            isAddressStep={currentStep === 'address'}
            error={currentStep === 'phone' ? phoneError : undefined}
          />
        )}
      </AnimatePresence>
    </OnboardingShell>
  );
};

export default OnboardingFlow;
