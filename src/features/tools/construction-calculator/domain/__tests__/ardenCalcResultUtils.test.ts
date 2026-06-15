import { describe, expect, it } from 'vitest';
import { createInitialKeypadState } from '../keypadInputReducer';
import { getCalculatorResultText, getUsableScalarResult } from '../ardenCalcResultUtils';

describe('ardenCalcResultUtils', () => {
  it('returns result display text when fresh result exists', () => {
    const state = {
      ...createInitialKeypadState(16),
      freshResult: true,
      resultDisplay: `10' 0"`,
      display: `10' 0"`,
    };
    expect(getCalculatorResultText(state)).toBe(`10' 0"`);
  });

  it('parses usable scalar results', () => {
    const state = {
      ...createInitialKeypadState(16),
      freshResult: true,
      tokens: [{ type: 'scalar' as const, value: 42 }],
      resultDisplay: '42',
      display: '42',
    };
    expect(getUsableScalarResult(state)).toEqual({ value: 42 });
  });

  it('rejects dimension results for quantity use', () => {
    const state = {
      ...createInitialKeypadState(16),
      freshResult: true,
      tokens: [{ type: 'dimension' as const, value: { decimalInches: 120 } }],
      resultDisplay: `10' 0"`,
      display: `10' 0"`,
    };
    const result = getUsableScalarResult(state);
    expect(result).toHaveProperty('error');
  });
});
