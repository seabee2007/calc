import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';

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
  isAddressStep = false
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!required || value.trim()) {
      onNext();
    }
  };

  const formatPhoneNumber = (input: string): string => {
    // Strip all non-numeric characters
    const numbers = input.replace(/\D/g, '');
    
    // Format the number as (000) 000-0000
    if (numbers.length <= 3) {
      return numbers;
    } else if (numbers.length <= 6) {
      return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`;
    } else {
      return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value;
    
    if (type === 'tel') {
      // Format phone number
      newValue = formatPhoneNumber(newValue);
    }
    
    onChange(newValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (type === 'tel') {
      // Allow: backspace, delete, tab, escape, enter, and numbers
      if ([8, 9, 13, 27, 46].includes(e.keyCode) || // Backspace, Tab, Enter, Escape, Delete
          (e.keyCode >= 35 && e.keyCode <= 40) || // Home, End, Arrow keys
          (e.keyCode >= 48 && e.keyCode <= 57) || // Numbers
          (e.keyCode >= 96 && e.keyCode <= 105)) { // Numpad numbers
        return;
      }
      // Prevent any other input
      e.preventDefault();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-blue-50 flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="w-full max-w-lg space-y-10"
      >
        {/* Header */}
        <div className="text-center space-y-4">
          <motion.h2
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-3xl md:text-4xl font-bold text-gray-900 mb-3"
          >
            {title}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-xl text-gray-600 leading-relaxed"
          >
            {description}
          </motion.p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-8">
          {isAddressStep ? (
            <div className="space-y-4">
              <Input
                label="Address Line 1"
                value={value.split('|')[0] || ''}
                onChange={(e) => {
                  const parts = value.split('|');
                  parts[0] = e.target.value;
                  onChange(parts.join('|'));
                }}
                placeholder="Street Address"
                required={required}
                autoFocus
                className="!bg-gray-100 !text-gray-900 w-full p-4 text-xl border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              />
              <Input
                label="Address Line 2"
                value={value.split('|')[1] || ''}
                onChange={(e) => {
                  const parts = value.split('|');
                  parts[1] = e.target.value;
                  onChange(parts.join('|'));
                }}
                placeholder="Apt, Suite, Unit (optional)"
                className="!bg-gray-100 !text-gray-900 w-full p-4 text-xl border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="City"
                  value={value.split('|')[2] || ''}
                  onChange={(e) => {
                    const parts = value.split('|');
                    parts[2] = e.target.value;
                    onChange(parts.join('|'));
                  }}
                  placeholder="City"
                  required={required}
                  className="!bg-gray-100 !text-gray-900 w-full p-4 text-xl border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
                <Input
                  label="State"
                  value={value.split('|')[3] || ''}
                  onChange={(e) => {
                    const parts = value.split('|');
                    parts[3] = e.target.value;
                    onChange(parts.join('|'));
                  }}
                  placeholder="State"
                  required={required}
                  className="!bg-gray-100 !text-gray-900 w-full p-4 text-xl border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <Input
                label="ZIP Code"
                value={value.split('|')[4] || ''}
                onChange={(e) => {
                  const parts = value.split('|');
                  parts[4] = e.target.value.replace(/[^\d]/g, '');
                  onChange(parts.join('|'));
                }}
                placeholder="ZIP Code"
                required={required}
                type="text"
                maxLength={5}
                pattern="\d*"
                className="!bg-gray-100 !text-gray-900 w-full p-4 text-xl border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
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
              className="!bg-gray-100 !text-gray-900 w-full p-4 text-xl border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            />
          )}

          {/* Navigation */}
          <div className="flex justify-between items-center pt-6">
            <div className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors cursor-pointer" onClick={onBack}>
              <ArrowLeft size={24} />
              <span className="text-lg">Back</span>
            </div>

            <Button
              type="submit"
              disabled={required && !value.trim()}
              icon={<ArrowRight size={20} />}
              className="h-14 text-lg font-medium text-white bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 hover:bg-gradient-to-br focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800 rounded-lg px-8 shadow-lg"
            >
              {isLastStep ? 'Complete' : 'Next'}
            </Button>

            {onSkip && (
              <div className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors cursor-pointer" onClick={onSkip}>
                <span className="text-lg">Skip</span>
                <ArrowRight size={24} />
              </div>
            )}
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default OnboardingStep; 