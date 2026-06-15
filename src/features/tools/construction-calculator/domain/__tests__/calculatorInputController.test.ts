import { describe, expect, it } from 'vitest';
import {
  createInitialKeypadState,
  keypadReducer,
  tapKeypadSequence,
} from '../keypadInputReducer';
import { CONV_UNITS } from '../constructionCalculatorTypes';
import { MEMORY_TYPE_MISMATCH_ERROR } from '../calculatorMemory';

describe('calculator extended keypad features', () => {
  it('decimal feet 10.5 FT → 10\' 6"', () => {
    const state = tapKeypadSequence(['1', '0', '.', '5', 'ft']);
    expect(state.display).toBe(`10' 6"`);
  });

  it('leading decimal .5 FT → 6"', () => {
    const state = tapKeypadSequence(['.', '5', 'ft']);
    expect(state.display).toBe(`6"`);
  });

  it('decimal inches 9.875 IN', () => {
    const state = tapKeypadSequence(['9', '.', '8', '7', '5', 'in']);
    expect(state.directDecimalInches).toBeCloseTo(9.875, 4);
  });

  it('blocks duplicate decimal point', () => {
    let state = createInitialKeypadState(16);
    state = keypadReducer(state, '1');
    state = keypadReducer(state, '.');
    state = keypadReducer(state, '.');
    expect(state.digitBuffer).toBe('1.');
  });

  it('negates fresh result', () => {
    let state = tapKeypadSequence(['5', 'ft', 'equals']);
    state = keypadReducer(state, '±');
    expect(state.resultDisplay).toBe(`-5' 0"`);
  });

  it('blocks negate on non-negative slot', () => {
    let state = createInitialKeypadState(16);
    state = keypadReducer(state, {
      type: 'set-active-slot',
      slot: {
        moduleId: 'stairs',
        slotId: 'riserCount',
        label: 'RISERS',
        valueType: 'scalar',
        allowNegative: false,
      },
    });
    state = keypadReducer(state, '±');
    expect(state.error).toContain('Negative');
  });

  it('pi key produces scalar pi', () => {
    const state = tapKeypadSequence(['pi']);
    expect(state.freshResult).toBe(true);
    expect(state.tokens[0]).toEqual({ type: 'scalar', value: Math.PI });
  });

  it('pi × dimension via sequence', () => {
    const state = tapKeypadSequence(['pi', '×', '6', 'in', 'equals']);
    expect(state.resultDisplay).toContain('"');
  });

  it('memory M+ M- MR MC for scalar', () => {
    let state = tapKeypadSequence(['3', 'equals']);
    state = keypadReducer(state, 'M+');
    expect(state.memoryValue).toEqual({ kind: 'scalar', value: 3 });
    state = keypadReducer(state, 'MC');
    expect(state.memoryValue).toBeNull();
  });

  it('memory type mismatch error', () => {
    let state = tapKeypadSequence(['5', 'ft', 'equals']);
    state = keypadReducer(state, 'M+');
    state = keypadReducer(state, {
      type: 'set-active-slot',
      slot: {
        moduleId: 'stairs',
        slotId: 'riserCount',
        label: 'RISERS',
        valueType: 'scalar',
        allowNegative: false,
      },
    });
    state = keypadReducer(state, 'MR');
    expect(state.error).toBe(MEMORY_TYPE_MISMATCH_ERROR);
  });

  it('conv cycles units without changing stored inches', () => {
    let state = tapKeypadSequence(['1', '2', 'ft', 'equals']);
    const inches = state.convSourceInches;
    for (let i = 0; i < CONV_UNITS.length; i++) {
      state = keypadReducer(state, 'conv');
    }
    expect(state.convUnitIndex).toBe(0);
    expect(state.convSourceInches).toBe(inches);
  });

  it('active slot stores dimension value', () => {
    let state = createInitialKeypadState(16);
    state = keypadReducer(state, {
      type: 'set-active-slot',
      slot: {
        moduleId: 'stairs',
        slotId: 'totalRise',
        label: 'STAIRS · TOTAL RISE',
        valueType: 'dimension',
        allowNegative: false,
      },
    });
    for (const key of ['9', 'ft', '3', 'in'] as const) {
      state = keypadReducer(state, key);
    }
    expect(state.slotValues.stairs?.totalRise).toBeCloseTo(111, 4);
  });

  it('clear deactivates active slot', () => {
    let state = createInitialKeypadState(16);
    state = keypadReducer(state, {
      type: 'set-active-slot',
      slot: {
        moduleId: 'area',
        slotId: 'length',
        label: 'LENGTH',
        valueType: 'dimension',
        allowNegative: false,
      },
    });
    state = keypadReducer(state, 'clear');
    expect(state.activeSlot).toBeNull();
  });

  it('receive-result loads dimension into keypad', () => {
    let state = createInitialKeypadState(16);
    state = keypadReducer(state, {
      type: 'receive-result',
      value: { decimalInches: 120 },
    });
    expect(state.freshResult).toBe(true);
    expect(state.resultDisplay).toBe(`10' 0"`);
  });
});
