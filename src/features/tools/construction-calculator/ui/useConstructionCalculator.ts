import { useCallback, useEffect, useReducer, useState } from 'react';
import type { FractionPrecision, KeypadKey } from '../domain/constructionCalculatorTypes';
import { DEFAULT_FRACTION_PRECISION } from '../domain/constructionCalculatorTypes';
import {
  createInitialKeypadState,
  getCommittedExpression,
  keypadReducer,
  mapKeyboardToKeypad,
} from '../domain/keypadInputReducer';
import { useConstructionCalculatorTapeStore } from '../../../../store/constructionCalculatorTapeStore';

export function useConstructionCalculator(options?: { enableKeyboard?: boolean }) {
  const enableKeyboard = options?.enableKeyboard ?? false;
  const [state, dispatch] = useReducer(
    keypadReducer,
    createInitialKeypadState(DEFAULT_FRACTION_PRECISION),
  );
  const addTapeEntry = useConstructionCalculatorTapeStore((s) => s.addEntry);
  const [lastTapeKey, setLastTapeKey] = useState('');

  const pressKey = useCallback((key: KeypadKey) => {
    dispatch(key);
  }, []);

  const setPrecision = useCallback((precision: FractionPrecision) => {
    dispatch({ type: 'set-precision', precision });
  }, []);

  useEffect(() => {
    if (!state.freshResult) return;
    const committed = getCommittedExpression(state);
    if (!committed) return;
    const key = `${committed.expression}=${committed.result}`;
    if (key === lastTapeKey) return;
    setLastTapeKey(key);
    addTapeEntry(committed.expression, committed.result);
  }, [state.freshResult, state.expressionDisplay, state.resultDisplay, addTapeEntry, lastTapeKey]);

  useEffect(() => {
    if (!enableKeyboard) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      const mapped = mapKeyboardToKeypad(e.key);
      if (!mapped) return;

      e.preventDefault();
      dispatch(mapped);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enableKeyboard]);

  return {
    state,
    pressKey,
    setPrecision,
  };
}
