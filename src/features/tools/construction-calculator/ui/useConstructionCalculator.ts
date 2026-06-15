import { useCalculatorInputController } from './hooks/useCalculatorInputController';

/** @deprecated Use useCalculatorInputController directly */
export function useConstructionCalculator(options?: { enableKeyboard?: boolean }) {
  return useCalculatorInputController(options);
}

export { useCalculatorInputController };
