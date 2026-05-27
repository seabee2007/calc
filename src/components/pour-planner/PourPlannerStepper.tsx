import React from 'react';
import { Check } from 'lucide-react';
import { POUR_PLANNER_STEPS } from '../../hooks/usePourPlannerState';

interface PourPlannerStepperProps {
  activeStep: number;
  onStepClick: (index: number) => void;
}

const PourPlannerStepper: React.FC<PourPlannerStepperProps> = ({
  activeStep,
  onStepClick,
}) => {
  return (
    <nav aria-label="Placement planning steps" className="mb-6">
      <ol className="flex flex-wrap gap-2 sm:gap-0 sm:justify-between">
        {POUR_PLANNER_STEPS.map((step, index) => {
          const isComplete = index < activeStep;
          const isActive = index === activeStep;
          return (
            <li key={step.id} className="flex items-center sm:flex-1 min-w-[calc(50%-0.25rem)] sm:min-w-0">
              <button
                type="button"
                onClick={() => onStepClick(index)}
                className={`flex items-center gap-2 w-full rounded-lg px-2 py-2 text-left transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md'
                    : isComplete
                      ? 'bg-white/90 dark:bg-gray-800/90 text-blue-700 dark:text-blue-300 hover:bg-white'
                      : 'bg-white/60 dark:bg-gray-800/60 text-gray-600 dark:text-gray-400 hover:bg-white/80'
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    isActive
                      ? 'bg-white text-blue-600'
                      : isComplete
                        ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {isComplete ? <Check className="h-4 w-4" /> : index + 1}
                </span>
                <span className="hidden sm:inline text-sm font-medium truncate">
                  {step.label}
                </span>
                <span className="sm:hidden text-xs font-medium truncate">
                  {step.shortLabel}
                </span>
              </button>
              {index < POUR_PLANNER_STEPS.length - 1 && (
                <div
                  className="hidden sm:block flex-1 h-px mx-1 bg-white/40 dark:bg-gray-600"
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default PourPlannerStepper;
