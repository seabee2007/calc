import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import WelcomeScreen from './WelcomeScreen';
import { useSettingsStore } from '../../store';
import { useThemeStore } from '../../store/themeStore';
import OnboardingStep from './OnboardingStep';
import ThemeSelector from './ThemeSelector';

type OnboardingStepType = 'welcome' | 'company-name' | 'email' | 'phone' | 'address' | 'license' | 'motto' | 'theme';

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

const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const navigate = useNavigate();
  const { updateCompanySettings } = useSettingsStore();
  const { isDark, toggleTheme } = useThemeStore();
  const [currentStep, setCurrentStep] = useState<OnboardingStepType>('welcome');
  const [formData, setFormData] = useState({
    companyName: '',
    email: '',
    phone: '',
    address: '',
    licenseNumber: '',
    motto: '',
    theme: isDark ? 'dark' : 'light'
  });

  const handleInputChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      [currentStep === 'company-name' ? 'companyName' : 
       currentStep === 'license' ? 'licenseNumber' : currentStep]: value
    }));
  };

  const handleNext = async () => {
    const steps: OnboardingStepType[] = ['welcome', 'company-name', 'email', 'phone', 'address', 'license', 'motto', 'theme'];
    const currentIndex = steps.indexOf(currentStep);
    
    if (currentIndex === steps.length - 1) {
      // Save all data
      try {
        // Update theme if changed
        if ((formData.theme === 'dark' && !isDark) || (formData.theme === 'light' && isDark)) {
          toggleTheme();
        }

        // Map form data to Supabase schema
        const settingsData = {
          companyName: formData.companyName,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          licenseNumber: formData.licenseNumber,
          motto: formData.motto
        };

        await updateCompanySettings(settingsData);
        onComplete();
        // Navigate to home page
        navigate('/');
      } catch (error) {
        console.error('Error saving settings:', error);
        // Even if save fails, complete onboarding and navigate
        onComplete();
        navigate('/');
      }
    } else {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    const steps: OnboardingStepType[] = ['welcome', 'company-name', 'email', 'phone', 'address', 'license', 'motto', 'theme'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  const handleSkip = () => {
    const steps: OnboardingStepType[] = ['welcome', 'company-name', 'email', 'phone', 'address', 'license', 'motto', 'theme'];
    const currentIndex = steps.indexOf(currentStep);
    // Move to the next step instead of completing
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    } else {
      onComplete();
    }
  };

  const stepConfig: Record<Exclude<OnboardingStepType, 'welcome' | 'theme'>, StepConfig> = {
    'company-name': {
      title: 'Company Name',
      description: 'Enter the company name to appear on your account, proposals and emails',
      placeholder: 'Your Construction Company',
      required: true,
      type: 'text'
    },
    'email': {
      title: 'Email Address',
      description: 'Enter the email address clients can reach you at',
      placeholder: 'contact@yourcompany.com',
      required: true,
      type: 'email'
    },
    'phone': {
      title: 'Phone Number',
      description: 'Enter your company phone number',
      placeholder: '(555) 123-4567',
      required: true,
      type: 'tel'
    },
    'address': {
      title: 'Business Address',
      description: 'Enter your company\'s business address',
      placeholder: 'Street Address',
      required: false,
      type: 'text'
    },
    'license': {
      title: 'License Number',
      description: 'Enter your contractor license number (if applicable)',
      placeholder: 'License #123456',
      required: false,
      type: 'text'
    },
    'motto': {
      title: 'Company Motto',
      description: 'Enter a motto or slogan for your company (optional)',
      placeholder: 'Quality concrete solutions since 1995',
      required: false,
      type: 'text'
    }
  };

  const getCurrentValue = (step: OnboardingStepType): string => {
    switch (step) {
      case 'company-name':
        return formData.companyName;
      case 'license':
        return formData.licenseNumber;
      case 'address':
        // Split the address into parts or return empty parts
        const [line1 = '', line2 = '', city = '', state = '', zip = ''] = formData.address.split('|');
        return [line1, line2, city, state, zip].join('|');
      case 'theme':
        return formData.theme;
      default:
        return formData[step as keyof typeof formData] || '';
    }
  };

  return (
    <AnimatePresence mode="wait">
      {currentStep === 'welcome' && (
        <WelcomeScreen key="welcome" onNext={handleNext} onSkip={handleSkip} />
      )}
      {currentStep === 'theme' && (
        <ThemeSelector
          key="theme"
          value={formData.theme}
          onChange={(theme: 'light' | 'dark') => setFormData(prev => ({ ...prev, theme }))}
          onNext={handleNext}
          onBack={handleBack}
        />
      )}
      {currentStep !== 'welcome' && currentStep !== 'theme' && (
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
        />
      )}
    </AnimatePresence>
  );
};

export default OnboardingFlow; 