import React from 'react';
import Input from '../ui/Input';
import USAddressFields from '../address/USAddressFields';
import { EMPTY_US_ADDRESS, type USAddress } from '../../types/address';
import OnboardingStepHeader from './OnboardingStepHeader';
import OnboardingFooterNav from './OnboardingFooterNav';
import { ONBOARDING_CARD, ONBOARDING_FIELD_GROUP, ONBOARDING_INPUT } from './onboardingTheme';

interface OnboardingStepProps {
  title: string;
  description: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip?: () => void;
  required?: boolean;
  type?: string;
  isLastStep?: boolean;
  isAddressStep?: boolean;
}

function addressFromPipe(value: string): USAddress {
  const parts = value.split('|');
  return {
    ...EMPTY_US_ADDRESS,
    street: parts[0]?.trim() ?? '',
    street2: parts[1]?.trim() ?? '',
    city: parts[2]?.trim() ?? '',
    state: (parts[3]?.trim() ?? '').toUpperCase(),
    zip: (parts[4]?.trim() ?? '').replace(/\D/g, '').slice(0, 5),
  };
}

function addressToPipe(addr: USAddress): string {
  return [addr.street, addr.street2, addr.city, addr.state, addr.zip].join('|');
}

const OnboardingStep: React.FC<OnboardingStepProps> = ({
  title,
  description,
  placeholder,
  value,
  onChange,
  onNext,
  onBack,
  onSkip,
  required = false,
  type = 'text',
  isLastStep = false,
  isAddressStep = false,
}) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (type !== 'tel') return;

    const allowedKeys = [
      'Backspace',
      'Delete',
      'Tab',
      'Escape',
      'Enter',
      'ArrowLeft',
      'ArrowRight',
      'Home',
      'End',
    ];

    if (allowedKeys.includes(e.key)) return;

    if (!/[\d\s\(\)\-]/.test(e.key)) {
      e.preventDefault();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };

  return (
    <div className="flex flex-1 flex-col py-6">
      <form onSubmit={handleSubmit} className="flex flex-1 flex-col">
        <div className={`${ONBOARDING_CARD} flex-1`}>
          <OnboardingStepHeader title={title} description={description} />

          <div className="space-y-6">
            {isAddressStep ? (
              <div className={ONBOARDING_FIELD_GROUP}>
                <USAddressFields
                  value={addressFromPipe(value)}
                  onChange={(addr) => onChange(addressToPipe(addr))}
                  showStreet2
                  idPrefix="onboarding"
                />
              </div>
            ) : (
              <Input
                type={type}
                value={value}
                onChange={handleInputChange}
                onKeyDown={type === 'tel' ? handleKeyDown : undefined}
                placeholder={placeholder}
                required={required}
                autoFocus
                maxLength={type === 'tel' ? 14 : undefined}
                className={`${ONBOARDING_INPUT} !rounded-xl !border-white/10 !bg-slate-950/70 !px-4 !py-3 !text-lg !text-white placeholder:!text-slate-500 focus:!border-cyan-400/60 focus:!ring-2 focus:!ring-cyan-400/20 !shadow-none`}
              />
            )}
          </div>
        </div>

        <OnboardingFooterNav
          onBack={onBack}
          onNext={onNext}
          onSkip={onSkip}
          nextLabel={isLastStep ? 'Finish' : 'Continue'}
          nextType="submit"
        />
      </form>
    </div>
  );
};

export default OnboardingStep;
