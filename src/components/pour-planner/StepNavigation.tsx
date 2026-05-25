import React from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import Button from '../ui/Button';

interface StepNavigationProps {
  activeStep: number;
  totalSteps: number;
  onBack: () => void;
  onNext: () => void;
  onFinish?: () => void;
  finishLabel?: string;
  finishDisabled?: boolean;
  finishLoading?: boolean;
}

const StepNavigation: React.FC<StepNavigationProps> = ({
  activeStep,
  totalSteps,
  onBack,
  onNext,
  onFinish,
  finishLabel = 'Save placement date',
  finishDisabled = false,
  finishLoading = false,
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
      {isLast ? (
        <Button
          type="button"
          onClick={onFinish}
          disabled={finishDisabled || finishLoading}
          icon={<Save className="h-4 w-4" />}
        >
          {finishLoading ? 'Saving…' : finishLabel}
        </Button>
      ) : (
        <Button type="button" onClick={onNext}>
          Continue
        </Button>
      )}
    </div>
  );
};

export default StepNavigation;
