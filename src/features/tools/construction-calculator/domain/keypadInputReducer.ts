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

export type KeypadPhase = 'feet' | 'inches' | 'frac-num' | 'frac-den' | 'scalar';

export interface KeypadInputState {
  precision: FractionPrecision;
  feet: number | null;
  inches: number | null;
  numerator: number | null;
  denominator: number | null;
  digitBuffer: string;
  phase: KeypadPhase;
  tokens: CalculatorToken[];
  pendingOperator: CalculatorOperator | null;
  display: string;
  resultDisplay: string;
  expressionDisplay: string;
  error: string | null;
  freshResult: boolean;
}

export function createInitialKeypadState(
  precision: FractionPrecision = DEFAULT_FRACTION_PRECISION,
): KeypadInputState {
  return {
    precision,
    feet: null,
    inches: null,
    numerator: null,
    denominator: null,
    digitBuffer: '',
    phase: 'feet',
    tokens: [],
    pendingOperator: null,
    display: '0',
    resultDisplay: '',
    expressionDisplay: '',
    error: null,
    freshResult: false,
  };
}

export type KeypadAction = KeypadKey | { type: 'set-precision'; precision: FractionPrecision };

export function keypadReducer(state: KeypadInputState, action: KeypadAction): KeypadInputState {
  if (typeof action === 'object' && action.type === 'set-precision') {
    return setKeypadPrecision(state, action.precision);
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

export function setKeypadPrecision(
  state: KeypadInputState,
  precision: FractionPrecision,
): KeypadInputState {
  const parts = getCurrentParts(state);
  const display = parts ? formatDimension(buildDimensionValue(parts), precision) : state.display;
  return { ...state, precision, display };
}

function handleDigit(state: KeypadInputState, digit: string): KeypadInputState {
  let next = state;
  if (state.freshResult) {
    next = createInitialKeypadState(state.precision);
  }

  const buffer = next.digitBuffer + digit;
  const updated = { ...next, digitBuffer: buffer, error: null, freshResult: false };

  if (updated.phase === 'frac-den') {
    const denominator = parseInt(buffer, 10);
    const withDen = { ...updated, denominator };
    return refreshDisplay(withDen);
  }

  if (updated.phase === 'frac-num') {
    return refreshDisplay(updated);
  }

  return refreshDisplay(updated);
}

function handleUnitKey(state: KeypadInputState, unit: 'feet' | 'inches'): KeypadInputState {
  const value = parseInt(state.digitBuffer || '0', 10);
  let next: KeypadInputState;

  if (unit === 'feet') {
    next = {
      ...state,
      feet: value,
      digitBuffer: '',
      phase: 'inches',
      error: null,
      freshResult: false,
    };
  } else {
    next = {
      ...state,
      inches: value,
      digitBuffer: '',
      phase: 'frac-num',
      error: null,
      freshResult: false,
    };
  }

  return refreshDisplay(next);
}

function handleFractionKey(state: KeypadInputState): KeypadInputState {
  const numerator = state.digitBuffer ? parseInt(state.digitBuffer, 10) : 0;
  const next: KeypadInputState = {
    ...state,
    numerator,
    digitBuffer: '',
    phase: 'frac-den',
    error: null,
    freshResult: false,
  };
  return refreshDisplay(next);
}

function handleBackspace(state: KeypadInputState): KeypadInputState {
  if (state.digitBuffer.length > 0) {
    const next = { ...state, digitBuffer: state.digitBuffer.slice(0, -1) };
    return refreshDisplay(next);
  }

  if (state.denominator !== null) {
    return refreshDisplay({ ...state, denominator: null, phase: 'frac-den' });
  }
  if (state.numerator !== null) {
    return refreshDisplay({
      ...state,
      numerator: null,
      phase: 'frac-num',
      digitBuffer: String(state.numerator),
    });
  }
  if (state.inches !== null) {
    return refreshDisplay({
      ...state,
      inches: null,
      phase: 'inches',
      digitBuffer: String(state.inches),
    });
  }
  if (state.feet !== null) {
    return refreshDisplay({
      ...state,
      feet: null,
      phase: 'feet',
      digitBuffer: String(state.feet),
    });
  }

  return state;
}

function handleOperator(state: KeypadInputState, operator: CalculatorOperator): KeypadInputState {
  try {
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

    const exprParts = tokens
      .map((t) => {
        if (t.type === 'operator') return t.operator;
        if (t.type === 'dimension') return formatDimension(t.value, state.precision);
        return String(t.value);
      })
      .join(' ');

    return {
      ...createInitialKeypadState(state.precision),
      tokens,
      pendingOperator: operator,
      expressionDisplay: exprParts,
      display: '0',
      freshResult: false,
    };
  } catch (e) {
    return { ...state, error: e instanceof Error ? e.message : 'Invalid input' };
  }
}

function handleEquals(state: KeypadInputState): KeypadInputState {
  try {
    const committed = commitCurrentOperand(state);
    const tokens = [...committed.tokens];
    const evaluated = evaluateExpression(tokens);
    const resultStr =
      evaluated.kind === 'dimension'
        ? formatDimension(evaluated.value, state.precision)
        : String(Math.round(evaluated.value * 10000) / 10000);

    const expression = committed.expressionDisplay
      ? `${committed.expressionDisplay} ${formatCurrentInput(committed, state.precision)}`
      : formatCurrentInput(committed, state.precision);

    return {
      ...createInitialKeypadState(state.precision),
      resultDisplay: resultStr,
      display: resultStr,
      expressionDisplay: expression,
      freshResult: true,
      tokens: [
        evaluated.kind === 'dimension'
          ? { type: 'dimension', value: evaluated.value }
          : { type: 'scalar', value: evaluated.value },
      ],
    };
  } catch (e) {
    return { ...state, error: e instanceof Error ? e.message : 'Invalid expression' };
  }
}

function commitCurrentOperand(state: KeypadInputState): KeypadInputState {
  const parts = getCurrentParts(state);
  const tokens = [...state.tokens];

  if (parts) {
    const dim = buildDimensionValue(parts);
    if (tokens.length > 0 && tokens[tokens.length - 1]?.type !== 'operator') {
      tokens.push({ type: 'dimension', value: dim });
    } else {
      tokens.push({ type: 'dimension', value: dim });
    }
  } else if (state.digitBuffer) {
    const scalar = parseFloat(state.digitBuffer);
    tokens.push({ type: 'scalar', value: scalar });
  }

  const expr = tokens
    .map((t) => {
      if (t.type === 'operator') return t.operator;
      if (t.type === 'dimension') return formatDimension(t.value, state.precision);
      return String(t.value);
    })
    .join(' ');

  return { ...state, tokens, expressionDisplay: expr };
}

function getCurrentParts(state: KeypadInputState): DimensionParts | null {
  const hasContent =
    state.feet !== null ||
    state.inches !== null ||
    state.numerator !== null ||
    state.denominator !== null ||
    state.digitBuffer.length > 0;

  if (!hasContent) return null;

  const parts: DimensionParts = {};

  if (state.feet !== null) {
    parts.feet = state.feet;
  } else if (state.phase === 'feet' && state.digitBuffer) {
    parts.feet = parseInt(state.digitBuffer, 10);
  }

  if (state.inches !== null) {
    parts.inches = state.inches;
  } else if (state.phase === 'inches' && state.digitBuffer) {
    parts.inches = parseInt(state.digitBuffer, 10);
  } else if (state.phase === 'frac-num' && state.digitBuffer && state.inches === null && state.feet !== null) {
    parts.inches = parseInt(state.digitBuffer, 10);
  } else if (state.phase === 'frac-num' && state.digitBuffer && state.feet === null) {
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

  if (
    parts.feet === undefined &&
    parts.inches === undefined &&
    parts.numerator === undefined
  ) {
    return null;
  }

  return parts;
}

function formatCurrentInput(state: KeypadInputState, precision: FractionPrecision): string {
  const parts = getCurrentParts(state);
  if (!parts) return state.display;
  return formatDimension(buildDimensionValue(parts), precision);
}

function refreshDisplay(state: KeypadInputState): KeypadInputState {
  const parts = getCurrentParts(state);
  if (!parts) {
    return { ...state, display: state.digitBuffer || '0' };
  }
  const decimal = toDecimalInches(parts);
  const display = formatFeetInchesFraction(decimal, state.precision);
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
