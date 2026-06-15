import { useCallback, useEffect, useReducer, useState } from 'react';
import type {
  ActiveModuleSlot,
  DimensionValue,
  FractionPrecision,
  KeypadKey,
} from '../../domain/constructionCalculatorTypes';
import { CONV_UNITS, DEFAULT_FRACTION_PRECISION } from '../../domain/constructionCalculatorTypes';
import {
  createInitialKeypadState,
  getCommittedExpression,
  getModeHint,
  getSlotValue as getSlotValueFromState,
  keypadReducer,
  mapKeyboardToKeypad,
  type KeypadAction,
} from '../../domain/keypadInputReducer';
import { useConstructionCalculatorTapeStore } from '../../../../../store/constructionCalculatorTapeStore';

export function useCalculatorInputController(options?: { enableKeyboard?: boolean }) {
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

  const dispatchAction = useCallback((action: KeypadAction) => {
    dispatch(action);
  }, []);

  const pickFraction = useCallback((numerator: number, denominator: number) => {
    dispatch({ type: 'pick-fraction', numerator, denominator });
  }, []);

  const setPrecision = useCallback((precision: FractionPrecision) => {
    dispatch({ type: 'set-precision', precision });
  }, []);

  const setActiveSlot = useCallback((slot: ActiveModuleSlot | null) => {
    dispatch({ type: 'set-active-slot', slot });
  }, []);

  const getSlotValue = useCallback(
    (moduleId: string, slotId: string) => getSlotValueFromState(state, moduleId, slotId),
    [state],
  );

  const setSlotValue = useCallback((moduleId: string, slotId: string, value: number | null) => {
    dispatch({ type: 'set-slot-value', moduleId, slotId, value });
  }, []);

  const sendResultToKeypad = useCallback((value: DimensionValue | number) => {
    dispatch({ type: 'receive-result', value });
  }, []);

  useEffect(() => {
    if (!state.freshResult || state.activeSlot) return;
    const committed = getCommittedExpression(state);
    if (!committed) return;
    const key = `${committed.expression}=${committed.result}`;
    if (key === lastTapeKey) return;
    setLastTapeKey(key);
    addTapeEntry(committed.expression, committed.result);
  }, [
    state.freshResult,
    state.expressionDisplay,
    state.resultDisplay,
    state.activeSlot,
    addTapeEntry,
    lastTapeKey,
  ]);

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
    dispatchAction,
    pickFraction,
    setPrecision,
    modeHint: getModeHint(state),
    activeSlot: state.activeSlot,
    setActiveSlot,
    getSlotValue,
    setSlotValue,
    sendResultToKeypad,
    memoryHasValue: state.memoryValue !== null,
    convUnit: CONV_UNITS[state.convUnitIndex],
  };
}

export type CalculatorInputController = ReturnType<typeof useCalculatorInputController>;
