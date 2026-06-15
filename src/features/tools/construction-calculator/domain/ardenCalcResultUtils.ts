import type { KeypadInputState } from './keypadInputReducer';

export function getCalculatorResultText(state: KeypadInputState): string {
  if (state.freshResult && state.resultDisplay) {
    return state.resultDisplay;
  }
  return state.display;
}

export function getUsableScalarResult(
  state: KeypadInputState,
): { value: number } | { error: string } {
  if (state.freshResult && state.tokens.length === 1) {
    const token = state.tokens[0];
    if (token.type === 'scalar') {
      return { value: token.value };
    }
    if (token.type === 'dimension') {
      return {
        error: 'This result is a dimension, not a plain number. Use Copy Result instead.',
      };
    }
  }

  const trimmed = state.display.trim();
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return { value: parseFloat(trimmed) };
  }

  return { error: 'Press = to finish a calculation, or enter a plain number.' };
}
