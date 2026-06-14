import type {
  CalculatorOperator,
  CalculatorToken,
  DimensionValue,
  EvaluationResult,
  FractionPrecision,
} from './constructionCalculatorTypes';
import { buildDimensionFromDecimal } from './constructionCalculatorFormatters';
import { safeDivide, sanitizeFinite } from './constructionCalculatorValidators';

export function applyOperator(
  left: EvaluationResult,
  operator: CalculatorOperator,
  right: EvaluationResult,
): EvaluationResult {
  if (operator === '+') {
    return addResults(left, right);
  }
  if (operator === '-') {
    return subtractResults(left, right);
  }
  if (operator === '×') {
    return multiplyResults(left, right);
  }
  if (operator === '÷') {
    return divideResults(left, right);
  }
  throw new Error(`Unknown operator: ${operator}`);
}

function addResults(left: EvaluationResult, right: EvaluationResult): EvaluationResult {
  if (left.kind === 'dimension' && right.kind === 'dimension') {
    return {
      kind: 'dimension',
      value: buildDimensionFromDecimal(left.value.decimalInches + right.value.decimalInches),
    };
  }
  if (left.kind === 'scalar' && right.kind === 'scalar') {
    return { kind: 'scalar', value: left.value + right.value };
  }
  throw new Error('Cannot add mixed dimension and scalar');
}

function subtractResults(left: EvaluationResult, right: EvaluationResult): EvaluationResult {
  if (left.kind === 'dimension' && right.kind === 'dimension') {
    return {
      kind: 'dimension',
      value: buildDimensionFromDecimal(left.value.decimalInches - right.value.decimalInches),
    };
  }
  if (left.kind === 'scalar' && right.kind === 'scalar') {
    return { kind: 'scalar', value: left.value - right.value };
  }
  throw new Error('Cannot subtract mixed dimension and scalar');
}

function multiplyResults(left: EvaluationResult, right: EvaluationResult): EvaluationResult {
  if (left.kind === 'dimension' && right.kind === 'scalar') {
    return {
      kind: 'dimension',
      value: buildDimensionFromDecimal(left.value.decimalInches * right.value),
    };
  }
  if (left.kind === 'scalar' && right.kind === 'dimension') {
    return {
      kind: 'dimension',
      value: buildDimensionFromDecimal(right.value.decimalInches * left.value),
    };
  }
  if (left.kind === 'scalar' && right.kind === 'scalar') {
    return { kind: 'scalar', value: left.value * right.value };
  }
  throw new Error('Cannot multiply two dimensions');
}

function divideResults(left: EvaluationResult, right: EvaluationResult): EvaluationResult {
  if (left.kind === 'dimension' && right.kind === 'dimension') {
    const divisor = right.value.decimalInches;
    if (divisor === 0) throw new Error('Cannot divide by zero');
    return { kind: 'scalar', value: left.value.decimalInches / divisor };
  }
  if (left.kind === 'dimension' && right.kind === 'scalar') {
    if (right.value === 0) throw new Error('Cannot divide by zero');
    return {
      kind: 'dimension',
      value: buildDimensionFromDecimal(left.value.decimalInches / right.value),
    };
  }
  if (left.kind === 'scalar' && right.kind === 'scalar') {
    if (right.value === 0) throw new Error('Cannot divide by zero');
    return { kind: 'scalar', value: left.value / right.value };
  }
  throw new Error('Cannot divide scalar by dimension');
}

export function tokenToEvaluationResult(token: CalculatorToken): EvaluationResult {
  if (token.type === 'dimension') {
    return { kind: 'dimension', value: token.value };
  }
  if (token.type === 'scalar') {
    return { kind: 'scalar', value: token.value };
  }
  throw new Error('Cannot evaluate operator token');
}

export function evaluateExpression(tokens: CalculatorToken[]): EvaluationResult {
  if (tokens.length === 0) {
    return { kind: 'dimension', value: buildDimensionFromDecimal(0) };
  }

  const values: EvaluationResult[] = [];
  const operators: CalculatorOperator[] = [];

  for (const token of tokens) {
    if (token.type === 'operator') {
      operators.push(token.operator);
    } else {
      values.push(tokenToEvaluationResult(token));
    }
  }

  if (values.length === 0) {
    return { kind: 'dimension', value: buildDimensionFromDecimal(0) };
  }

  let result = values[0];
  for (let i = 0; i < operators.length; i++) {
    const right = values[i + 1];
    if (!right) break;
    result = applyOperator(result, operators[i], right);
  }

  return result;
}

export function divideDimensionByScalar(
  dimension: DimensionValue,
  scalar: number,
): DimensionValue {
  const safe = sanitizeFinite(scalar, 0);
  if (safe === 0) throw new Error('Cannot divide by zero');
  return buildDimensionFromDecimal(dimension.decimalInches / safe);
}

export function divideDimensionsToScalar(
  numerator: DimensionValue,
  denominator: DimensionValue,
): number {
  const denom = denominator.decimalInches;
  if (denom === 0) throw new Error('Cannot divide by zero');
  return safeDivide(numerator.decimalInches, denom);
}

export function evaluateRiserHeight(
  totalRiseInches: number,
  riserCount: number,
): number {
  if (riserCount <= 0) return 0;
  return totalRiseInches / riserCount;
}
