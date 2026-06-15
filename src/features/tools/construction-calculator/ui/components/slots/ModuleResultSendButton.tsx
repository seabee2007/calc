import React from 'react';
import type { DimensionValue } from '../../../domain/constructionCalculatorTypes';
import type { CalculatorInputController } from '../../hooks/useCalculatorInputController';
import { ArrowRight } from 'lucide-react';

interface ModuleResultSendButtonProps {
  label: string;
  value: DimensionValue | number;
  controller: CalculatorInputController;
}

export default function ModuleResultSendButton({
  label,
  value,
  controller,
}: ModuleResultSendButtonProps) {
  return (
    <button
      type="button"
      onClick={() => controller.sendResultToKeypad(value)}
      className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium text-cyan-700 hover:bg-cyan-50 dark:text-cyan-400 dark:hover:bg-cyan-950/40"
      aria-label={`Send ${label} to keypad`}
      data-testid={`send-to-keypad-${label.replace(/\s+/g, '-').toLowerCase()}`}
    >
      <ArrowRight className="h-3 w-3" aria-hidden />
      Keypad
    </button>
  );
}
