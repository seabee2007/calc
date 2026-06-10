import React from 'react';
import { motion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';
import OnboardingStepHeader from './OnboardingStepHeader';
import OnboardingFooterNav from './OnboardingFooterNav';
import { ONBOARDING_CARD } from './onboardingTheme';

interface ThemeSelectorProps {
  value: string;
  onChange: (theme: 'light' | 'dark') => void;
  onNext: () => void;
  onBack: () => void;
}

const ThemeSelector: React.FC<ThemeSelectorProps> = ({ value, onChange, onNext, onBack }) => {
  const { toggleTheme } = useThemeStore();

  const handleThemeChange = (theme: 'light' | 'dark') => {
    onChange(theme);
    if ((theme === 'dark' && value === 'light') || (theme === 'light' && value === 'dark')) {
      toggleTheme();
    }
  };

  return (
    <div className="flex flex-1 flex-col py-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={`${ONBOARDING_CARD} flex-1 space-y-10`}
      >
        <OnboardingStepHeader
          title="Choose Your Theme"
          description="Select your preferred appearance for the app"
        />

        <div className="grid grid-cols-2 gap-4 sm:gap-6">
          <button
            type="button"
            onClick={() => handleThemeChange('light')}
            className={`rounded-2xl border-2 p-5 transition-all sm:p-6 ${
              value === 'light'
                ? 'border-cyan-400/60 bg-cyan-500/10 shadow-lg shadow-cyan-500/10'
                : 'border-white/10 bg-white/[0.03] hover:border-cyan-400/30 hover:bg-cyan-400/5'
            }`}
          >
            <div className="flex flex-col items-center gap-4">
              <Sun size={48} className="text-amber-300" />
              <span className="text-lg font-medium text-white">Light Mode</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleThemeChange('dark')}
            className={`rounded-2xl border-2 p-5 transition-all sm:p-6 ${
              value === 'dark'
                ? 'border-cyan-400/60 bg-cyan-500/10 shadow-lg shadow-cyan-500/10'
                : 'border-white/10 bg-white/[0.03] hover:border-cyan-400/30 hover:bg-cyan-400/5'
            }`}
          >
            <div className="flex flex-col items-center gap-4">
              <Moon size={48} className="text-cyan-300" />
              <span className="text-lg font-medium text-white">Dark Mode</span>
            </div>
          </button>
        </div>
      </motion.div>

      <OnboardingFooterNav onBack={onBack} onNext={onNext} nextLabel="Complete Setup" />
    </div>
  );
};

export default ThemeSelector;
