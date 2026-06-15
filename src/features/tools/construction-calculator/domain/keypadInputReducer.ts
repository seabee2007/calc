import type {
  ActiveModuleSlot,
  CalculatorOperator,
  CalculatorToken,
  DimensionParts,
  DimensionValue,
  FractionPrecision,
  KeypadKey,
  MemoryValue,
  SlotValues,
} from './constructionCalculatorTypes';
import { CONV_UNITS, DEFAULT_FRACTION_PRECISION } from './constructionCalculatorTypes';
import {
  buildDimensionFromDecimal,
  buildDimensionValue,
  formatDimension,
} from './constructionCalculatorFormatters';
import { evaluateExpression } from './constructionCalculatorEngine';
import { formatFeetInchesFraction } from './constructionDimensionMath';
import { MIXED_DIMENSION_SCALAR_ERROR } from './calculatorFractions';
import {
  formatDecimalInchesAsConvUnit,
  nextConvUnitIndex,
} from './calculatorConvCycle';
import {
  memoryAdd,
  memoryClear,
  memoryRecall,
  memorySubtract,
} from './calculatorMemory';

export type KeypadPhase = 'feet' | 'inches' | 'frac-num' | 'frac-den' | 'scalar';

export type EntryMode = 'dimension' | 'scalar';

export interface KeypadInputState {
  precision: FractionPrecision;
  feet: number | null;
  inches: number | null;
  numerator: number | null;
  denominator: number | null;
  digitBuffer: string;
  phase: KeypadPhase;
  entryMode: EntryMode;
  unitCommitted: boolean;
  entryNegative: boolean;
  directDecimalInches: number | null;
  tokens: CalculatorToken[];
  pendingOperator: CalculatorOperator | null;
  display: string;
  resultDisplay: string;
  expressionDisplay: string;
  error: string | null;
  freshResult: boolean;
  activeSlot: ActiveModuleSlot | null;
  memoryValue: MemoryValue | null;
  convUnitIndex: number;
  slotValues: SlotValues;
  convSourceInches: number | null;
}

export type KeypadAction =
  | KeypadKey
  | { type: 'set-precision'; precision: FractionPrecision }
  | { type: 'pick-fraction'; numerator: number; denominator: number }
  | { type: 'set-active-slot'; slot: ActiveModuleSlot | null }
  | { type: 'receive-result'; value: DimensionValue | number }
  | { type: 'set-slot-value'; moduleId: string; slotId: string; value: number | null };

function preserveMeta(state: KeypadInputState): Pick<
  KeypadInputState,
  'precision' | 'memoryValue' | 'convUnitIndex' | 'slotValues' | 'activeSlot'
> {
  return {
    precision: state.precision,
    memoryValue: state.memoryValue,
    convUnitIndex: state.convUnitIndex,
    slotValues: state.slotValues,
    activeSlot: state.activeSlot,
  };
}

export function createInitialKeypadState(
  precision: FractionPrecision = DEFAULT_FRACTION_PRECISION,
): KeypadInputState {
  return applyDisplayState({
    precision,
    feet: null,
    inches: null,
    numerator: null,
    denominator: null,
    digitBuffer: '',
    phase: 'feet',
    entryMode: 'dimension',
    unitCommitted: false,
    entryNegative: false,
    directDecimalInches: null,
    tokens: [],
    pendingOperator: null,
    display: '0',
    resultDisplay: '',
    expressionDisplay: '',
    error: null,
    freshResult: false,
    activeSlot: null,
    memoryValue: null,
    convUnitIndex: 0,
    slotValues: {},
    convSourceInches: null,
  });
}

function createFreshEntryState(state: KeypadInputState): KeypadInputState {
  return {
    ...createInitialKeypadState(state.precision),
    ...preserveMeta(state),
  };
}

export function keypadReducer(state: KeypadInputState, action: KeypadAction): KeypadInputState {
  if (typeof action === 'object' && action.type === 'set-precision') {
    return setKeypadPrecision(state, action.precision);
  }

  if (typeof action === 'object' && action.type === 'pick-fraction') {
    return handlePickFraction(state, action.numerator, action.denominator);
  }

  if (typeof action === 'object' && action.type === 'set-active-slot') {
    return handleSetActiveSlot(state, action.slot);
  }

  if (typeof action === 'object' && action.type === 'receive-result') {
    return handleReceiveResult(state, action.value);
  }

  if (typeof action === 'object' && action.type === 'set-slot-value') {
    return setSlotValue(state, action.moduleId, action.slotId, action.value);
  }

  const key = action;

  if (key === 'clear') {
    if (state.activeSlot) {
      return applyDisplayState({
        ...createFreshEntryState(state),
        activeSlot: null,
        error: null,
      });
    }
    return createInitialKeypadState(state.precision);
  }

  if (key === 'backspace') {
    return handleBackspace(state);
  }

  if (key === 'equals') {
    if (state.activeSlot?.valueType === 'scalar') {
      return handleSlotScalarCommit(state);
    }
    if (state.activeSlot) {
      return tryCommitActiveSlotDimension(state);
    }
    return handleEquals(state);
  }

  if (key === '+' || key === '-' || key === '×' || key === '÷') {
    if (state.activeSlot) {
      return { ...state, error: 'Exit the active field before calculating.' };
    }
    return handleOperator(state, key);
  }

  if (key === 'ft') {
    return handleUnitKey(state, 'feet');
  }

  if (key === 'in') {
    return handleUnitKey(state, 'inches');
  }

  if (key === 'frac') {
    return handleFractionKey(state);
  }

  if (key === '.') {
    return handleDecimal(state);
  }

  if (key === '±') {
    return handleNegate(state);
  }

  if (key === 'pi') {
    return handlePi(state);
  }

  if (key === 'M+' || key === 'M-' || key === 'MR' || key === 'MC') {
    return handleMemory(state, key);
  }

  if (key === 'conv') {
    return handleConv(state);
  }

  if (/^[0-9]$/.test(key)) {
    return handleDigit(state, key);
  }

  return state;
}

export function getModeHint(state: KeypadInputState): string | null {
  if (state.activeSlot) {
    return `${state.activeSlot.label} — enter value`;
  }

  if (state.freshResult) return null;

  if (state.entryMode === 'scalar') {
    if (state.pendingOperator === '×') return 'Enter multiplier (or FT/IN for a dimension)';
    if (state.pendingOperator === '÷') return 'Enter divisor (or FT/IN for a dimension)';
    return 'Enter number';
  }

  if (
    state.tokens.length === 0 ||
    state.pendingOperator === '+' ||
    state.pendingOperator === '-'
  ) {
    return 'Dimension entry';
  }

  return null;
}

export function getLiveExpression(state: KeypadInputState): string {
  return buildLiveExpression(state);
}

export function setKeypadPrecision(
  state: KeypadInputState,
  precision: FractionPrecision,
): KeypadInputState {
  return applyDisplayState({ ...state, precision });
}

function handleSetActiveSlot(state: KeypadInputState, slot: ActiveModuleSlot | null): KeypadInputState {
  const next = createFreshEntryState(state);
  next.activeSlot = slot;
  if (slot) {
    const existing = state.slotValues[slot.moduleId]?.[slot.slotId];
    if (existing !== null && existing !== undefined) {
      if (slot.valueType === 'dimension') {
        next.directDecimalInches = existing;
        next.unitCommitted = true;
        next.entryMode = 'dimension';
      } else {
        next.digitBuffer = String(existing);
        next.entryMode = 'scalar';
        next.phase = 'scalar';
      }
    } else {
      next.entryMode = slot.valueType === 'scalar' ? 'scalar' : 'dimension';
      next.phase = slot.valueType === 'scalar' ? 'scalar' : 'feet';
    }
  }
  return applyDisplayState({ ...next, error: null });
}

function handleReceiveResult(state: KeypadInputState, value: DimensionValue | number): KeypadInputState {
  const meta = preserveMeta(state);
  if (typeof value === 'number') {
    const rounded = Math.round(value * 10000) / 10000;
    return applyDisplayState({
      ...createInitialKeypadState(state.precision),
      ...meta,
      tokens: [{ type: 'scalar', value: rounded }],
      resultDisplay: String(rounded),
      freshResult: true,
    });
  }

  return applyDisplayState({
    ...createInitialKeypadState(state.precision),
    ...meta,
    tokens: [{ type: 'dimension', value }],
    resultDisplay: formatDimension(value, state.precision),
    convSourceInches: value.decimalInches,
    freshResult: true,
  });
}

function setSlotValue(
  state: KeypadInputState,
  moduleId: string,
  slotId: string,
  value: number | null,
): KeypadInputState {
  const moduleSlots = { ...(state.slotValues[moduleId] ?? {}), [slotId]: value };
  return applyDisplayState({
    ...state,
    slotValues: { ...state.slotValues, [moduleId]: moduleSlots },
    error: null,
  });
}

function handleDecimal(state: KeypadInputState): KeypadInputState {
  if (state.digitBuffer.includes('.')) return state;

  let next = state;
  if (state.freshResult) {
    next = createFreshEntryState(state);
  }

  const buffer = next.digitBuffer ? `${next.digitBuffer}.` : '0.';
  return applyDisplayState({
    ...next,
    digitBuffer: buffer,
    error: null,
    freshResult: false,
  });
}

function handleNegate(state: KeypadInputState): KeypadInputState {
  if (state.activeSlot && !state.activeSlot.allowNegative) {
    return { ...state, error: 'Negative values are not allowed for this field.' };
  }

  if (state.freshResult) {
    const token = state.tokens[0];
    if (!token) return state;

    if (token.type === 'scalar') {
      const value = -token.value;
      return applyDisplayState({
        ...state,
        tokens: [{ type: 'scalar', value }],
        resultDisplay: String(Math.round(value * 10000) / 10000),
        error: null,
      });
    }

    if (token.type === 'dimension') {
      const value = buildDimensionFromDecimal(-token.value.decimalInches);
      return applyDisplayState({
        ...state,
        tokens: [{ type: 'dimension', value }],
        resultDisplay: formatDimension(value, state.precision),
        convSourceInches: value.decimalInches,
        error: null,
      });
    }
  }

  return applyDisplayState({
    ...state,
    entryNegative: !state.entryNegative,
    error: null,
    freshResult: false,
  });
}

function handlePi(state: KeypadInputState): KeypadInputState {
  if (state.activeSlot) {
    if (state.activeSlot.valueType !== 'scalar') {
      return { ...state, error: 'Use the keypad dimension keys for this field.' };
    }
    return applyDisplayState({
      ...state,
      digitBuffer: String(Math.PI),
      entryMode: 'scalar',
      phase: 'scalar',
      error: null,
      freshResult: false,
    });
  }

  let working = state;
  if (state.freshResult || state.pendingOperator) {
    working = createFreshEntryState(state);
    if (state.pendingOperator) {
      working.tokens = [...state.tokens];
      working.pendingOperator = state.pendingOperator;
      working.expressionDisplay = state.expressionDisplay;
    }
  }

  const tokens = [...working.tokens];
  if (working.pendingOperator && tokens.length >= 1) {
    tokens.push({ type: 'scalar', value: Math.PI });
    return applyDisplayState({
      ...working,
      tokens,
      entryMode: working.pendingOperator === '×' || working.pendingOperator === '÷' ? 'dimension' : 'scalar',
      phase: working.pendingOperator === '×' || working.pendingOperator === '÷' ? 'feet' : 'scalar',
      digitBuffer: '',
      error: null,
      freshResult: false,
    });
  }

  return applyDisplayState({
    ...createFreshEntryState(state),
    tokens: [{ type: 'scalar', value: Math.PI }],
    resultDisplay: String(Math.round(Math.PI * 10000) / 10000),
    freshResult: true,
    error: null,
  });
}

function getCurrentOperandForMemory(
  state: KeypadInputState,
): { kind: 'dimension'; value: DimensionValue } | { kind: 'scalar'; value: number } | null {
  try {
    if (state.freshResult && state.tokens.length === 1) {
      const t = state.tokens[0];
      if (t.type === 'dimension') return { kind: 'dimension', value: t.value };
      if (t.type === 'scalar') return { kind: 'scalar', value: t.value };
    }

    validateOperandBeforeCommit(state);
    if (state.entryMode === 'scalar' && state.digitBuffer) {
      return { kind: 'scalar', value: parseFloat(state.digitBuffer) * (state.entryNegative ? -1 : 1) };
    }

    const parts = getCurrentParts(state);
    if (parts) {
      const dim = buildDimensionValue(parts);
      if (state.entryNegative) {
        return { kind: 'dimension', value: buildDimensionFromDecimal(-dim.decimalInches) };
      }
      return { kind: 'dimension', value: dim };
    }

    if (state.directDecimalInches !== null) {
      const inches = state.entryNegative ? -state.directDecimalInches : state.directDecimalInches;
      return { kind: 'dimension', value: buildDimensionFromDecimal(inches) };
    }
  } catch {
    return null;
  }
  return null;
}

function handleMemory(state: KeypadInputState, key: 'M+' | 'M-' | 'MR' | 'MC'): KeypadInputState {
  try {
    if (key === 'MC') {
      return applyDisplayState({ ...state, memoryValue: memoryClear(), error: null });
    }

    if (key === 'MR') {
      const expectedKind =
        state.activeSlot?.valueType ??
        (state.entryMode === 'scalar' ? 'scalar' : 'dimension');
      const recalled = memoryRecall(state.memoryValue, expectedKind);

      if (recalled.kind === 'scalar') {
        if (state.activeSlot?.valueType === 'scalar') {
          return applyDisplayState({
            ...state,
            digitBuffer: String(recalled.value),
            entryMode: 'scalar',
            phase: 'scalar',
            error: null,
          });
        }
        return applyDisplayState({
          ...createFreshEntryState(state),
          tokens: [{ type: 'scalar', value: recalled.value }],
          resultDisplay: String(Math.round(recalled.value * 10000) / 10000),
          freshResult: true,
          error: null,
        });
      }

      if (state.activeSlot?.valueType === 'dimension') {
        return applyDisplayState({
          ...state,
          directDecimalInches: recalled.decimalInches,
          unitCommitted: true,
          entryMode: 'dimension',
          error: null,
        });
      }

      const dim = buildDimensionFromDecimal(recalled.decimalInches);
      return applyDisplayState({
        ...createFreshEntryState(state),
        tokens: [{ type: 'dimension', value: dim }],
        resultDisplay: formatDimension(dim, state.precision),
        convSourceInches: dim.decimalInches,
        freshResult: true,
        error: null,
      });
    }

    const operand = getCurrentOperandForMemory(state);
    if (!operand) {
      return { ...state, error: 'Enter a value before using memory.' };
    }

    const nextMemory =
      key === 'M+' ? memoryAdd(state.memoryValue, operand) : memorySubtract(state.memoryValue, operand);

    return applyDisplayState({ ...state, memoryValue: nextMemory, error: null });
  } catch (e) {
    return {
      ...state,
      error: e instanceof Error ? e.message : 'Memory error',
    };
  }
}

function getConvSourceInches(state: KeypadInputState): number | null {
  if (state.convSourceInches !== null) return state.convSourceInches;

  if (state.freshResult && state.tokens.length === 1 && state.tokens[0].type === 'dimension') {
    return state.tokens[0].value.decimalInches;
  }

  if (state.directDecimalInches !== null) return state.directDecimalInches;

  try {
    const parts = getCurrentParts(state);
    if (parts) return buildDimensionValue(parts).decimalInches;
  } catch {
    return null;
  }

  return null;
}

function handleConv(state: KeypadInputState): KeypadInputState {
  const inches = getConvSourceInches(state);
  if (inches === null) {
    return { ...state, error: 'Enter a dimension result before converting units.' };
  }

  const nextIndex = nextConvUnitIndex(state.convUnitIndex);
  const unit = CONV_UNITS[nextIndex];
  const formatted = formatDecimalInchesAsConvUnit(inches, unit, state.precision);

  return applyDisplayState({
    ...state,
    convUnitIndex: nextIndex,
    convSourceInches: inches,
    resultDisplay: formatted,
    freshResult: true,
    error: null,
  });
}

function handleDigit(state: KeypadInputState, digit: string): KeypadInputState {
  let next = state;
  if (state.freshResult && !state.activeSlot) {
    next = createFreshEntryState(state);
  }

  const buffer = next.digitBuffer + digit;
  let updated: KeypadInputState = {
    ...next,
    digitBuffer: buffer,
    directDecimalInches: null,
    error: null,
    freshResult: false,
  };

  if (updated.activeSlot?.valueType === 'scalar' || updated.entryMode === 'scalar') {
    updated.entryMode = 'scalar';
    updated.phase = 'scalar';
    return applyDisplayState(updated);
  }

  if (updated.phase === 'frac-den') {
    updated = { ...updated, denominator: parseInt(buffer, 10) };
  }

  return applyDisplayState(updated);
}

function parseBufferNumber(buffer: string): number {
  if (buffer.includes('.')) return parseFloat(buffer);
  return parseInt(buffer || '0', 10);
}

function handleUnitKey(state: KeypadInputState, unit: 'feet' | 'inches'): KeypadInputState {
  let working = state;
  if (state.entryMode === 'scalar' && !state.activeSlot) {
    working = {
      ...state,
      entryMode: 'dimension',
      phase: unit === 'feet' ? 'feet' : 'inches',
      error: null,
    };
  }

  if (working.digitBuffer.includes('.')) {
    const num = parseFloat(working.digitBuffer);
    const decimalInches = unit === 'feet' ? num * 12 : num;
    const signed = working.entryNegative ? -decimalInches : decimalInches;

    if (working.activeSlot?.valueType === 'dimension') {
      return commitSlotDimension(working, signed);
    }

    const next: KeypadInputState = {
      ...working,
      directDecimalInches: Math.abs(decimalInches),
      entryNegative: signed < 0,
      digitBuffer: '',
      unitCommitted: true,
      phase: unit === 'feet' ? 'inches' : 'frac-num',
      error: null,
      freshResult: false,
    };
    return applyDisplayState(next);
  }

  const value = parseBufferNumber(working.digitBuffer || '0');
  let next: KeypadInputState;

  if (unit === 'feet') {
    next = {
      ...working,
      feet: value,
      digitBuffer: '',
      phase: 'inches',
      unitCommitted: true,
      directDecimalInches: null,
      error: null,
      freshResult: false,
    };
  } else {
    next = {
      ...working,
      inches: value,
      digitBuffer: '',
      phase: 'frac-num',
      unitCommitted: true,
      directDecimalInches: null,
      error: null,
      freshResult: false,
    };

    if (next.activeSlot?.valueType === 'dimension') {
      return tryCommitActiveSlotDimension(next);
    }
  }

  return applyDisplayState(next);
}

function handleFractionKey(state: KeypadInputState): KeypadInputState {
  let working = state;
  if (state.entryMode === 'scalar' && !state.activeSlot) {
    working = { ...state, entryMode: 'dimension', phase: 'frac-num', error: null };
  }

  const numerator = working.digitBuffer ? parseInt(working.digitBuffer, 10) : 0;
  const next: KeypadInputState = {
    ...working,
    numerator,
    digitBuffer: '',
    phase: 'frac-den',
    error: null,
    freshResult: false,
  };
  return applyDisplayState(next);
}

function handlePickFraction(
  state: KeypadInputState,
  numerator: number,
  denominator: number,
): KeypadInputState {
  let working = state;
  if (state.entryMode === 'scalar' && !state.activeSlot) {
    working = { ...state, entryMode: 'dimension', phase: 'frac-num', error: null };
  }

  const next: KeypadInputState = {
    ...working,
    numerator,
    denominator,
    digitBuffer: '',
    phase: 'frac-num',
    unitCommitted: true,
    error: null,
    freshResult: false,
  };

  if (next.activeSlot?.valueType === 'dimension') {
    return tryCommitActiveSlotDimension(next);
  }

  return applyDisplayState(next);
}

function handleBackspace(state: KeypadInputState): KeypadInputState {
  if (state.digitBuffer.length > 0) {
    const next = { ...state, digitBuffer: state.digitBuffer.slice(0, -1), error: null };
    if (next.entryMode === 'scalar' || next.activeSlot?.valueType === 'scalar') {
      return applyDisplayState(next);
    }
    if (next.phase === 'frac-den' && next.denominator !== null) {
      return applyDisplayState({ ...next, denominator: null });
    }
    return applyDisplayState(next);
  }

  if (state.entryMode === 'scalar' || state.activeSlot?.valueType === 'scalar') {
    return applyDisplayState({ ...state, error: null });
  }

  if (state.directDecimalInches !== null) {
    return applyDisplayState({
      ...state,
      directDecimalInches: null,
      unitCommitted: false,
      phase: 'feet',
    });
  }

  if (state.denominator !== null) {
    return applyDisplayState({ ...state, denominator: null, phase: 'frac-den' });
  }
  if (state.numerator !== null) {
    return applyDisplayState({
      ...state,
      numerator: null,
      phase: 'frac-num',
      digitBuffer: String(state.numerator),
    });
  }
  if (state.inches !== null) {
    return applyDisplayState({
      ...state,
      inches: null,
      phase: 'inches',
      digitBuffer: String(state.inches),
      unitCommitted: state.feet !== null,
    });
  }
  if (state.feet !== null) {
    return applyDisplayState({
      ...state,
      feet: null,
      phase: 'feet',
      digitBuffer: String(state.feet),
      unitCommitted: false,
    });
  }

  return state;
}

function getDimensionDecimalInchesFromState(state: KeypadInputState): number | null {
  if (state.directDecimalInches !== null) {
    return state.entryNegative ? -state.directDecimalInches : state.directDecimalInches;
  }
  const parts = getCurrentParts(state);
  if (!parts) return null;
  const dim = buildDimensionValue(parts);
  return state.entryNegative ? -dim.decimalInches : dim.decimalInches;
}

function commitSlotDimension(state: KeypadInputState, decimalInches: number): KeypadInputState {
  if (!state.activeSlot) return state;
  const { moduleId, slotId } = state.activeSlot;
  const next = setSlotValue(state, moduleId, slotId, decimalInches);
  return applyDisplayState({
    ...next,
    directDecimalInches: Math.abs(decimalInches),
    entryNegative: decimalInches < 0,
    unitCommitted: true,
    digitBuffer: '',
    feet: null,
    inches: null,
    numerator: null,
    denominator: null,
    error: null,
  });
}

function tryCommitActiveSlotDimension(state: KeypadInputState): KeypadInputState {
  const inches = getDimensionDecimalInchesFromState(state);
  if (inches === null || !state.activeSlot) {
    return { ...state, error: 'Enter a complete dimension.' };
  }
  return commitSlotDimension(state, inches);
}

function handleSlotScalarCommit(state: KeypadInputState): KeypadInputState {
  if (!state.activeSlot || !state.digitBuffer) {
    return { ...state, error: 'Enter a number.' };
  }
  const value = parseFloat(state.digitBuffer) * (state.entryNegative ? -1 : 1);
  const { moduleId, slotId } = state.activeSlot;
  return applyDisplayState({
    ...setSlotValue(state, moduleId, slotId, value),
    error: null,
  });
}

function handleOperator(state: KeypadInputState, operator: CalculatorOperator): KeypadInputState {
  try {
    validateOperandBeforeCommit(state);
    const operand = commitCurrentOperand(state);
    let tokens = [...operand.tokens];

    if (operand.pendingOperator && tokens.length >= 1) {
      const evaluated = evaluateExpression(tokens);
      tokens = [
        evaluated.kind === 'dimension'
          ? { type: 'dimension', value: evaluated.value }
          : { type: 'scalar', value: evaluated.value },
        { type: 'operator', operator: operand.pendingOperator },
      ];
    }

    tokens.push({ type: 'operator', operator });

    const operandBeforeOp = tokens[tokens.length - 2];
    const exprParts = formatTokenList(tokens, state.precision);
    let entryMode: EntryMode = 'dimension';
    if (operator === '×' || operator === '÷') {
      entryMode = operandBeforeOp?.type === 'dimension' ? 'scalar' : 'dimension';
    }

    return applyDisplayState({
      ...createFreshEntryState(state),
      tokens,
      pendingOperator: operator,
      entryMode,
      phase: entryMode === 'scalar' ? 'scalar' : 'feet',
      expressionDisplay: exprParts,
      freshResult: false,
    });
  } catch (e) {
    return {
      ...state,
      error: e instanceof Error ? e.message : 'Invalid input',
    };
  }
}

function handleEquals(state: KeypadInputState): KeypadInputState {
  try {
    validateOperandBeforeCommit(state);
    const committed = commitCurrentOperand(state);
    const tokens = [...committed.tokens];
    const evaluated = evaluateExpression(tokens);
    const resultStr =
      evaluated.kind === 'dimension'
        ? formatDimension(evaluated.value, state.precision)
        : String(Math.round(evaluated.value * 10000) / 10000);

    const expression = committed.expressionDisplay;
    const convInches =
      evaluated.kind === 'dimension' ? evaluated.value.decimalInches : null;

    return applyDisplayState({
      ...createFreshEntryState(state),
      resultDisplay: resultStr,
      expressionDisplay: expression,
      freshResult: true,
      convSourceInches: convInches,
      tokens: [
        evaluated.kind === 'dimension'
          ? { type: 'dimension', value: evaluated.value }
          : { type: 'scalar', value: evaluated.value },
      ],
    });
  } catch (e) {
    return {
      ...state,
      error: e instanceof Error ? e.message : 'Invalid expression',
    };
  }
}

function validateOperandBeforeCommit(state: KeypadInputState): void {
  if (state.entryMode === 'scalar') {
    if (!state.digitBuffer) {
      throw new Error('Enter a number.');
    }
    return;
  }

  if (state.directDecimalInches !== null) return;

  if (requiresExplicitUnits(state) && state.digitBuffer && !state.unitCommitted) {
    throw new Error(MIXED_DIMENSION_SCALAR_ERROR);
  }

  const parts = getCurrentParts(state);
  if (!parts && !state.digitBuffer) {
    throw new Error('Enter a value.');
  }
}

function commitCurrentOperand(state: KeypadInputState): KeypadInputState {
  const tokens = [...state.tokens];

  if (state.entryMode === 'scalar') {
    if (state.digitBuffer) {
      const value = parseFloat(state.digitBuffer) * (state.entryNegative ? -1 : 1);
      tokens.push({ type: 'scalar', value });
    }
  } else if (state.directDecimalInches !== null) {
    const inches = state.entryNegative ? -state.directDecimalInches : state.directDecimalInches;
    tokens.push({ type: 'dimension', value: buildDimensionFromDecimal(inches) });
  } else if (
    state.unitCommitted ||
    state.feet !== null ||
    state.inches !== null ||
    state.numerator !== null ||
    state.denominator !== null
  ) {
    const parts = getCurrentParts(state);
    if (parts) {
      let dim = buildDimensionValue(parts);
      if (state.entryNegative) {
        dim = buildDimensionFromDecimal(-dim.decimalInches);
      }
      tokens.push({ type: 'dimension', value: dim });
    }
  } else if (state.digitBuffer) {
    if (requiresExplicitUnits(state)) {
      throw new Error(MIXED_DIMENSION_SCALAR_ERROR);
    }
    const value = parseFloat(state.digitBuffer) * (state.entryNegative ? -1 : 1);
    tokens.push({ type: 'scalar', value });
  }

  const expr = formatTokenList(tokens, state.precision);

  return { ...state, tokens, expressionDisplay: expr };
}

function requiresExplicitUnits(state: KeypadInputState): boolean {
  return (
    state.entryMode === 'dimension' &&
    state.tokens.length > 0 &&
    (state.pendingOperator === '+' || state.pendingOperator === '-')
  );
}

function getCurrentParts(state: KeypadInputState): DimensionParts | null {
  if (state.entryMode === 'scalar') {
    return null;
  }

  if (state.directDecimalInches !== null) {
    return null;
  }

  const hasContent =
    state.feet !== null ||
    state.inches !== null ||
    state.numerator !== null ||
    state.denominator !== null ||
    state.digitBuffer.length > 0;

  if (!hasContent) return null;

  const allowBufferPreview = !requiresExplicitUnits(state);
  const parts: DimensionParts = {};

  if (state.feet !== null) {
    parts.feet = state.feet;
  } else if (allowBufferPreview && state.phase === 'feet' && state.digitBuffer) {
    parts.feet = parseBufferNumber(state.digitBuffer);
  }

  if (state.inches !== null) {
    parts.inches = state.inches;
  } else if (allowBufferPreview && state.phase === 'inches' && state.digitBuffer) {
    parts.inches = parseBufferNumber(state.digitBuffer);
  } else if (
    allowBufferPreview &&
    state.phase === 'frac-num' &&
    state.digitBuffer &&
    state.inches === null &&
    state.feet !== null
  ) {
    parts.inches = parseInt(state.digitBuffer, 10);
  } else if (allowBufferPreview && state.phase === 'frac-num' && state.digitBuffer && state.feet === null) {
    parts.inches = parseInt(state.digitBuffer, 10);
  }

  if (state.numerator !== null) {
    parts.numerator = state.numerator;
  } else if (state.phase === 'frac-num' && state.digitBuffer && state.inches !== null) {
    parts.numerator = parseInt(state.digitBuffer, 10);
  }

  if (state.denominator !== null) {
    parts.denominator = state.denominator;
  } else if (state.phase === 'frac-den' && state.digitBuffer) {
    parts.denominator = parseInt(state.digitBuffer, 10);
  }

  if (parts.denominator === 0) return null;

  if (parts.feet === undefined && parts.inches === undefined && parts.numerator === undefined) {
    return null;
  }

  return parts;
}

function formatCurrentOperand(state: KeypadInputState, precision: FractionPrecision): string {
  if (state.activeSlot?.valueType === 'scalar' || state.entryMode === 'scalar') {
    const prefix = state.entryNegative ? '-' : '';
    return prefix + (state.digitBuffer || '');
  }

  if (state.directDecimalInches !== null) {
    const inches = state.entryNegative ? -state.directDecimalInches : state.directDecimalInches;
    return formatDimension(buildDimensionFromDecimal(inches), precision);
  }

  const parts = getCurrentParts(state);
  if (parts) {
    let dim = buildDimensionValue(parts);
    if (state.entryNegative) {
      dim = buildDimensionFromDecimal(-dim.decimalInches);
    }
    return formatDimension(dim, precision);
  }

  if (state.digitBuffer && requiresExplicitUnits(state)) {
    return state.digitBuffer;
  }

  return state.digitBuffer || state.display;
}

function formatTokenList(tokens: CalculatorToken[], precision: FractionPrecision): string {
  return tokens
    .map((t) => {
      if (t.type === 'operator') return t.operator;
      if (t.type === 'dimension') return formatDimension(t.value, precision);
      return String(t.value);
    })
    .join(' ');
}

function buildLiveExpression(state: KeypadInputState): string {
  if (state.activeSlot) {
    const current = formatCurrentOperand(state, state.precision);
    const existing = state.slotValues[state.activeSlot.moduleId]?.[state.activeSlot.slotId];
    if (current && current !== '0') return current;
    if (existing !== null && existing !== undefined) {
      if (state.activeSlot.valueType === 'dimension') {
        return formatDimension(buildDimensionFromDecimal(existing), state.precision);
      }
      return String(existing);
    }
    return current || '—';
  }

  if (state.freshResult && state.resultDisplay) {
    if (state.convUnitIndex > 0 && state.convSourceInches !== null) {
      return formatDecimalInchesAsConvUnit(
        state.convSourceInches,
        CONV_UNITS[state.convUnitIndex],
        state.precision,
      );
    }
    return state.resultDisplay;
  }

  const tokenStr = formatTokenList(state.tokens, state.precision);
  const current = formatCurrentOperand(state, state.precision);

  if (tokenStr && current) {
    return `${tokenStr} ${current}`;
  }
  if (tokenStr) {
    return tokenStr;
  }
  if (current) {
    return current;
  }
  return '0';
}

function applyDisplayState(state: KeypadInputState): KeypadInputState {
  const display =
    state.freshResult && state.resultDisplay && !state.activeSlot
      ? state.resultDisplay
      : buildLiveExpression(state);
  return { ...state, display };
}

export function getCommittedExpression(state: KeypadInputState): {
  expression: string;
  result: string;
} | null {
  if (!state.resultDisplay || !state.expressionDisplay) return null;
  return { expression: state.expressionDisplay, result: state.resultDisplay };
}

export function getSlotValue(
  state: KeypadInputState,
  moduleId: string,
  slotId: string,
): number | null {
  return state.slotValues[moduleId]?.[slotId] ?? null;
}

export function mapKeyboardToKeypad(key: string): KeypadKey | null {
  if (/^[0-9]$/.test(key)) return key as KeypadKey;
  if (key === '.') return '.';
  if (key === '+') return '+';
  if (key === '-') return '-';
  if (key === '*') return '×';
  if (key === '/') return '÷';
  if (key === 'Enter' || key === '=') return 'equals';
  if (key === 'Backspace') return 'backspace';
  if (key === 'Escape') return 'clear';
  if (key === "'") return 'ft';
  if (key === '"') return 'in';
  return null;
}

/** Tap a sequence of keys/actions through the reducer (for tests). */
export function tapKeypadSequence(
  keys: KeypadAction[],
  precision: FractionPrecision = DEFAULT_FRACTION_PRECISION,
): KeypadInputState {
  let state = createInitialKeypadState(precision);
  for (const key of keys) {
    state = keypadReducer(state, key);
  }
  return state;
}
