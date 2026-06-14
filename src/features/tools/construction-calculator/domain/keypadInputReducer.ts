import type {
  CalculatorOperator,
  CalculatorToken,
  DimensionParts,
  FractionPrecision,
  KeypadKey,
} from './constructionCalculatorTypes';
import { DEFAULT_FRACTION_PRECISION } from './constructionCalculatorTypes';
import { buildDimensionValue, formatDimension } from './constructionCalculatorFormatters';
import { evaluateExpression } from './constructionCalculatorEngine';
import { formatFeetInchesFraction, toDecimalInches } from './constructionDimensionMath';
import { MIXED_DIMENSION_SCALAR_ERROR } from './calculatorFractions';

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
  tokens: CalculatorToken[];
  pendingOperator: CalculatorOperator | null;
  display: string;
  resultDisplay: string;
  expressionDisplay: string;
  error: string | null;
  freshResult: boolean;
}

export type KeypadAction =
  | KeypadKey
  | { type: 'set-precision'; precision: FractionPrecision }
  | { type: 'pick-fraction'; numerator: number; denominator: number };

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
    tokens: [],
    pendingOperator: null,
    display: '0',
    resultDisplay: '',
    expressionDisplay: '',
    error: null,
    freshResult: false,
  });
}

export function keypadReducer(state: KeypadInputState, action: KeypadAction): KeypadInputState {
  if (typeof action === 'object' && action.type === 'set-precision') {
    return setKeypadPrecision(state, action.precision);
  }

  if (typeof action === 'object' && action.type === 'pick-fraction') {
    return handlePickFraction(state, action.numerator, action.denominator);
  }

  const key = action;

  if (key === 'clear') {
    return createInitialKeypadState(state.precision);
  }

  if (key === 'backspace') {
    return handleBackspace(state);
  }

  if (key === 'equals') {
    return handleEquals(state);
  }

  if (key === '+' || key === '-' || key === '×' || key === '÷') {
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

  if (/^[0-9]$/.test(key)) {
    return handleDigit(state, key);
  }

  return state;
}

export function getModeHint(state: KeypadInputState): string | null {
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

function handleDigit(state: KeypadInputState, digit: string): KeypadInputState {
  let next = state;
  if (state.freshResult) {
    next = createInitialKeypadState(state.precision);
  }

  const buffer = next.digitBuffer + digit;
  let updated: KeypadInputState = {
    ...next,
    digitBuffer: buffer,
    error: null,
    freshResult: false,
  };

  if (updated.entryMode === 'scalar') {
    return applyDisplayState(updated);
  }

  if (updated.phase === 'frac-den') {
    updated = { ...updated, denominator: parseInt(buffer, 10) };
  }

  return applyDisplayState(updated);
}

function handleUnitKey(state: KeypadInputState, unit: 'feet' | 'inches'): KeypadInputState {
  let working = state;
  if (state.entryMode === 'scalar') {
    working = {
      ...state,
      entryMode: 'dimension',
      phase: unit === 'feet' ? 'feet' : 'inches',
      error: null,
    };
  }

  const value = parseInt(working.digitBuffer || '0', 10);
  let next: KeypadInputState;

  if (unit === 'feet') {
    next = {
      ...working,
      feet: value,
      digitBuffer: '',
      phase: 'inches',
      unitCommitted: true,
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
      error: null,
      freshResult: false,
    };
  }

  return applyDisplayState(next);
}

function handleFractionKey(state: KeypadInputState): KeypadInputState {
  let working = state;
  if (state.entryMode === 'scalar') {
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
  if (state.entryMode === 'scalar') {
    working = { ...state, entryMode: 'dimension', phase: 'frac-num', error: null };
  }

  const next: KeypadInputState = {
    ...working,
    numerator,
    denominator,
    digitBuffer: '',
    phase: 'frac-num',
    error: null,
    freshResult: false,
  };
  return applyDisplayState(next);
}

function handleBackspace(state: KeypadInputState): KeypadInputState {
  if (state.digitBuffer.length > 0) {
    const next = { ...state, digitBuffer: state.digitBuffer.slice(0, -1), error: null };
    if (next.entryMode === 'scalar') {
      return applyDisplayState(next);
    }
    if (next.phase === 'frac-den' && next.denominator !== null) {
      return applyDisplayState({ ...next, denominator: null });
    }
    return applyDisplayState(next);
  }

  if (state.entryMode === 'scalar') {
    return applyDisplayState({ ...state, error: null });
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
      ...createInitialKeypadState(state.precision),
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

    return applyDisplayState({
      ...createInitialKeypadState(state.precision),
      resultDisplay: resultStr,
      expressionDisplay: expression,
      freshResult: true,
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
      tokens.push({ type: 'scalar', value: parseFloat(state.digitBuffer) });
    }
  } else if (
    state.unitCommitted ||
    state.feet !== null ||
    state.inches !== null ||
    state.numerator !== null ||
    state.denominator !== null
  ) {
    const parts = getCurrentParts(state);
    if (parts) {
      tokens.push({ type: 'dimension', value: buildDimensionValue(parts) });
    }
  } else if (state.digitBuffer) {
    if (requiresExplicitUnits(state)) {
      throw new Error(MIXED_DIMENSION_SCALAR_ERROR);
    }
    tokens.push({ type: 'scalar', value: parseFloat(state.digitBuffer) });
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
    parts.feet = parseInt(state.digitBuffer, 10);
  }

  if (state.inches !== null) {
    parts.inches = state.inches;
  } else if (allowBufferPreview && state.phase === 'inches' && state.digitBuffer) {
    parts.inches = parseInt(state.digitBuffer, 10);
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
  if (state.entryMode === 'scalar') {
    return state.digitBuffer || '';
  }

  const parts = getCurrentParts(state);
  if (parts) {
    return formatDimension(buildDimensionValue(parts), precision);
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
  if (state.freshResult && state.resultDisplay) {
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
    state.freshResult && state.resultDisplay ? state.resultDisplay : buildLiveExpression(state);
  return { ...state, display };
}

export function getCommittedExpression(state: KeypadInputState): {
  expression: string;
  result: string;
} | null {
  if (!state.resultDisplay || !state.expressionDisplay) return null;
  return { expression: state.expressionDisplay, result: state.resultDisplay };
}

export function mapKeyboardToKeypad(key: string): KeypadKey | null {
  if (/^[0-9]$/.test(key)) return key as KeypadKey;
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
