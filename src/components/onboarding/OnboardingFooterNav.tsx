import { ArrowLeft, ArrowRight } from 'lucide-react';
import {
  ONBOARDING_FOOTER,
  ONBOARDING_PRIMARY_BUTTON,
  ONBOARDING_SECONDARY_BUTTON,
  ONBOARDING_SKIP_BUTTON,
} from './onboardingTheme';

interface OnboardingFooterNavProps {
  onBack: () => void;
  onNext: () => void;
  onSkip?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  nextType?: 'button' | 'submit';
}

export default function OnboardingFooterNav({
  onBack,
  onNext,
  onSkip,
  nextLabel = 'Continue',
  nextDisabled = false,
  nextType = 'button',
}: OnboardingFooterNavProps) {
  return (
    <div className={ONBOARDING_FOOTER}>
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onBack} className={ONBOARDING_SECONDARY_BUTTON}>
          <ArrowLeft className="h-5 w-5" />
          Back
        </button>

        <div className="flex items-center gap-2 sm:gap-3">
          {onSkip && (
            <button type="button" onClick={onSkip} className={ONBOARDING_SKIP_BUTTON}>
              Skip
            </button>
          )}
          <button
            type={nextType}
            onClick={nextType === 'button' ? onNext : undefined}
            disabled={nextDisabled}
            className={ONBOARDING_PRIMARY_BUTTON}
          >
            {nextLabel}
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
