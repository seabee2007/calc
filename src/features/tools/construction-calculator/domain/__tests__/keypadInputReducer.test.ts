import { describe, expect, it } from 'vitest';
import {
  createInitialKeypadState,
  getCommittedExpression,
  keypadReducer,
  tapKeypadSequence,
} from '../keypadInputReducer';
import { MIXED_DIMENSION_SCALAR_ERROR } from '../calculatorFractions';
import { applyOperator, evaluateExpression } from '../constructionCalculatorEngine';
import { buildDimensionValue, formatDimension } from '../constructionCalculatorFormatters';
import { appendTapeEntry } from '../constructionCalculatorTape';
import { serializeTapeEntry } from '../constructionCalculatorTape';

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

  it('computes 23 FT 2 IN × 3 = 69\' 6"', () => {
    const state = tapKeypadSequence([
      '2',
      '3',
      'ft',
      '2',
      'in',
      '×',
      '3',
      'equals',
    ]);
    expect(state.resultDisplay).toBe(`69' 6"`);
    expect(state.expressionDisplay).toBe(`23' 2" × 3`);
  });

  it('computes 23 FT 2 IN ÷ 2 = 11\' 7"', () => {
    const state = tapKeypadSequence(['2', '3', 'ft', '2', 'in', '÷', '2', 'equals']);
    expect(state.resultDisplay).toBe(`11' 7"`);
  });

  it('computes 3 × 23 FT 2 IN = 69\' 6"', () => {
    const state = tapKeypadSequence([
      '3',
      '×',
      '2',
      '3',
      'ft',
      '2',
      'in',
      'equals',
    ]);
    expect(state.resultDisplay).toBe(`69' 6"`);
  });

  it('computes 23 FT 2 IN ÷ 23 FT 2 IN = 1', () => {
    const state = tapKeypadSequence([
      '2',
      '3',
      'ft',
      '2',
      'in',
      '÷',
      '2',
      '3',
      'ft',
      '2',
      'in',
      'equals',
    ]);
    expect(state.resultDisplay).toBe('1');
  });

  it('shows validation error for 23 FT 2 IN + 3', () => {
    const state = tapKeypadSequence(['2', '3', 'ft', '2', 'in', '+', '3', 'equals']);
    expect(state.error).toBe(MIXED_DIMENSION_SCALAR_ERROR);
    expect(state.resultDisplay).toBe('');
  });

  it('shows validation error for 23 FT 2 IN - 3', () => {
    const state = tapKeypadSequence(['2', '3', 'ft', '2', 'in', '-', '3', 'equals']);
    expect(state.error).toBe(MIXED_DIMENSION_SCALAR_ERROR);
  });

  it('shows live expression while entering 23\' 2" × 3', () => {
    const state = tapKeypadSequence(['2', '3', 'ft', '2', 'in', '×', '3']);
    expect(state.display).toBe(`23' 2" × 3`);
    expect(state.entryMode).toBe('scalar');
  });

  it('fraction picker 1/2 appends half inch correctly', () => {
    const state = tapKeypadSequence([
      '8',
      'in',
      { type: 'pick-fraction', numerator: 1, denominator: 2 },
    ]);
    expect(state.display).toBe(`8 1/2"`);
  });

  it('23 FT 2 IN FRACTION 1/2 displays 23\' 2 1/2"', () => {
    const state = tapKeypadSequence([
      '2',
      '3',
      'ft',
      '2',
      'in',
      { type: 'pick-fraction', numerator: 1, denominator: 2 },
    ]);
    expect(state.display).toBe(`23' 2 1/2"`);
  });

  it('8 IN FRACTION 3/4 displays 8 3/4"', () => {
    const state = tapKeypadSequence([
      '8',
      'in',
      { type: 'pick-fraction', numerator: 3, denominator: 4 },
    ]);
    expect(state.display).toBe(`8 3/4"`);
  });

  it('tape records full expression and result', () => {
    const state = tapKeypadSequence(['2', '3', 'ft', '2', 'in', '×', '3', 'equals']);
    const committed = getCommittedExpression(state);
    expect(committed).toEqual({
      expression: `23' 2" × 3`,
      result: `69' 6"`,
    });
    const entries = appendTapeEntry([], committed!.expression, committed!.result);
    expect(serializeTapeEntry(entries[0])).toBe(`23' 2" × 3 = 69' 6"`);
  });

  it('decimal feet 10.5 FT displays as 10\' 6"', () => {
    const state = tapKeypadSequence(['1', '0', '.', '5', 'ft']);
    expect(state.display).toBe(`10' 6"`);
  });

  it('pi times dimension evaluates', () => {
    const state = tapKeypadSequence(['pi', '×', '6', 'in', 'equals']);
    expect(state.resultDisplay).toContain('"');
  });
});

describe('constructionCalculatorEngine mixed operands', () => {
  it('rejects dimension + scalar with validation message', () => {
    const left = buildDimensionValue({ feet: 23, inches: 2 });
    expect(() =>
      applyOperator({ kind: 'dimension', value: left }, '+', { kind: 'scalar', value: 3 }),
    ).toThrow(MIXED_DIMENSION_SCALAR_ERROR);
  });

  it('evaluates dimension × scalar', () => {
    const tokens = [
      { type: 'dimension' as const, value: buildDimensionValue({ feet: 23, inches: 2 }) },
      { type: 'operator' as const, operator: '×' as const },
      { type: 'scalar' as const, value: 3 },
    ];
    const result = evaluateExpression(tokens);
    expect(result.kind).toBe('dimension');
    if (result.kind === 'dimension') {
      expect(formatDimension(result.value, 16)).toBe(`69' 6"`);
    }
  });
});
