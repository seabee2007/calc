import React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import Button from '../ui/Button';

interface StepNavigationProps {
  activeStep: number;
  totalSteps: number;
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
}

const StepNavigation: React.FC<StepNavigationProps> = ({
  activeStep,
  totalSteps,
  onBack,
  onNext,
  nextLabel,
}) => {
  const isFirst = activeStep === 0;
  const isLast = activeStep === totalSteps - 1;

  return (
    <div className="flex justify-between gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
      <Button
        type="button"
        variant="outline"
        onClick={onBack}
        disabled={isFirst}
        icon={<ArrowLeft className="h-4 w-4" />}
      >
        Back
      </Button>
      <Button type="button" onClick={onNext}>
        {nextLabel ?? (isLast ? 'Finish' : 'Continue')}
        <ArrowRight className="h-4 w-4 ml-2 inline" />
      </Button>
    </div>
  );
};

export default StepNavigation;
