import { describe, expect, it } from 'vitest';
import {
  createInitialKeypadState,
  keypadReducer,
} from '../keypadInputReducer';
import { buildDimensionValue } from '../constructionCalculatorFormatters';

describe('keypadInputReducer', () => {
  it('parses sequential taps 1 2 ft 6 in 3 / 4', () => {
    let state = createInitialKeypadState(16);
    const keys = ['1', '2', 'ft', '6', 'in', '3', 'frac', '4'] as const;
    for (const key of keys) {
      state = keypadReducer(state, key);
    }
    expect(state.display).toBe(`12' 6 3/4"`);
  });

  it('clears input on clear', () => {
    let state = createInitialKeypadState(16);
    state = keypadReducer(state, '5');
    state = keypadReducer(state, 'ft');
    state = keypadReducer(state, 'clear');
    expect(state.display).toBe('0');
    expect(state.feet).toBeNull();
  });

  it('backspaces digit buffer', () => {
    let state = createInitialKeypadState(16);
    state = keypadReducer(state, '1');
    state = keypadReducer(state, '2');
    state = keypadReducer(state, 'backspace');
    expect(state.digitBuffer).toBe('1');
  });

  it('evaluates addition via equals', () => {
    let state = createInitialKeypadState(16);
    state = keypadReducer(state, '5');
    state = keypadReducer(state, 'ft');
    state = keypadReducer(state, '4');
    state = keypadReducer(state, 'in');
    state = keypadReducer(state, '1');
    state = keypadReducer(state, 'frac');
    state = keypadReducer(state, '2');
    state = keypadReducer(state, '+');
    state = keypadReducer(state, '8');
    state = keypadReducer(state, 'in');
    state = keypadReducer(state, 'equals');
    expect(state.resultDisplay).toBe(`6' 0 1/2"`);
  });
});
