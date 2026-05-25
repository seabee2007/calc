import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import USAddressFields from '../address/USAddressFields';
import { EMPTY_US_ADDRESS, type USAddress } from '../../types/address';

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
    <div className="min-h-screen flex flex-col justify-center px-4 py-8">
      <div className="max-w-2xl mx-auto w-full">
        <div className="mb-8">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-bold text-gray-900 mb-4"
          >
            {title}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-xl text-gray-600 leading-relaxed"
          >
            {description}
          </motion.p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {isAddressStep ? (
            <USAddressFields
              value={addressFromPipe(value)}
              onChange={(addr) => onChange(addressToPipe(addr))}
              showStreet2
              idPrefix="onboarding"
            />
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
              className="!bg-gray-100 !text-gray-900 w-full p-4 text-xl border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            />
          )}

          <div className="flex justify-between items-center pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              icon={<ArrowLeft className="h-5 w-5" />}
              className="px-6 py-3"
            >
              Back
            </Button>

            <div className="flex gap-3">
              {onSkip && (
                <Button type="button" variant="ghost" onClick={onSkip} className="px-6 py-3">
                  Skip
                </Button>
              )}
              <Button
                type="submit"
                icon={<ArrowRight className="h-5 w-5" />}
                className="px-8 py-3"
              >
                {isLastStep ? 'Finish' : 'Continue'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OnboardingStep;
