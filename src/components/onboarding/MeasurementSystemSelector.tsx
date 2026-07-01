import React from 'react';
import { motion } from 'framer-motion';
import { Ruler } from 'lucide-react';
import type { MeasurementSystem } from '../../utils/measurementPreferences';
import OnboardingStepHeader from './OnboardingStepHeader';
import OnboardingFooterNav from './OnboardingFooterNav';
import { ONBOARDING_CARD } from './onboardingTheme';

interface MeasurementSystemSelectorProps {
  value: MeasurementSystem;
  onChange: (system: MeasurementSystem) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

const OPTIONS: Array<{
  value: MeasurementSystem;
  title: string;
  detail: string;
}> = [
  {
    value: 'imperial',
    title: 'Imperial',
    detail: 'Feet, inches, square feet, cubic yards',
  },
  {
    value: 'metric',
    title: 'Metric',
    detail: 'Meters, square meters, cubic meters',
  },
];

const MeasurementSystemSelector: React.FC<MeasurementSystemSelectorProps> = ({
  value,
  onChange,
  onNext,
  onBack,
  onSkip,
}) => {
  return (
    <div className="flex flex-1 flex-col py-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={`${ONBOARDING_CARD} flex-1 space-y-10`}
      >
        <OnboardingStepHeader
          title="Measurement System"
          description="Choose the units Arden should use for inputs, previews, estimates, and exports"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          {OPTIONS.map((option) => {
            const selected = value === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange(option.value)}
                aria-pressed={selected}
                className={`rounded-2xl border-2 p-5 text-left transition-all sm:p-6 ${
                  selected
                    ? 'border-cyan-400/60 bg-cyan-500/10 shadow-lg shadow-cyan-500/10'
                    : 'border-white/10 bg-white/[0.03] hover:border-cyan-400/30 hover:bg-cyan-400/5'
                }`}
              >
                <div className="flex items-start gap-4">
                  <Ruler className="mt-1 h-7 w-7 text-cyan-300" />
                  <div>
                    <div className="text-lg font-semibold text-white">{option.title}</div>
                    <div className="mt-2 text-sm leading-6 text-slate-400">{option.detail}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </motion.div>

      <OnboardingFooterNav onBack={onBack} onNext={onNext} onSkip={onSkip} />
    </div>
  );
};

export default MeasurementSystemSelector;
