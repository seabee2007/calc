import { describe, expect, it } from 'vitest';
import { buildDimensionValue, formatDimension } from '../constructionCalculatorFormatters';
import {
  applyOperator,
  evaluateExpression,
  evaluateRiserHeight,
} from '../constructionCalculatorEngine';
import {
  centimetersToDecimalInches,
  decimalInchesToMeters,
  formatFeetInchesFraction,
  toDecimalInches,
} from '../constructionDimensionMath';
import type { CalculatorToken } from '../constructionCalculatorTypes';

describe('construction dimension math', () => {
  it('adds 5 ft 4 1/2 in + 8 in = 6 ft 0 1/2 in', () => {
    const left = buildDimensionValue({ feet: 5, inches: 4, numerator: 1, denominator: 2 });
    const right = buildDimensionValue({ inches: 8 });
    const result = applyOperator(
      { kind: 'dimension', value: left },
      '+',
      { kind: 'dimension', value: right },
    );
    expect(result.kind).toBe('dimension');
    if (result.kind === 'dimension') {
      expect(formatDimension(result.value, 16)).toBe(`6' 0 1/2"`);
    }
  });

  it('divides 10 ft by 2 ft 2 in to yield scalar count', () => {
    const left = buildDimensionValue({ feet: 10 });
    const right = buildDimensionValue({ feet: 2, inches: 2 });
    const result = applyOperator(
      { kind: 'dimension', value: left },
      '÷',
      { kind: 'dimension', value: right },
    );
    expect(result.kind).toBe('scalar');
    if (result.kind === 'scalar') {
      expect(result.value).toBeCloseTo(120 / 26, 4);
    }
  });

  it('computes riser height for 9 ft 4 in / 15 risers', () => {
    const totalRise = toDecimalInches({ feet: 9, inches: 4 });
    const riserHeight = evaluateRiserHeight(totalRise, 15);
    expect(formatFeetInchesFraction(riserHeight, 16)).toBe(`7 7/16"`);
  });

  it('overflows 11 15/16 in + 1/16 in to 1 ft', () => {
    const left = buildDimensionValue({ inches: 11, numerator: 15, denominator: 16 });
    const right = buildDimensionValue({ numerator: 1, denominator: 16 });
    const result = applyOperator(
      { kind: 'dimension', value: left },
      '+',
      { kind: 'dimension', value: right },
    );
    if (result.kind === 'dimension') {
      expect(formatDimension(result.value, 16)).toBe(`1' 0"`);
    }
  });

  it('formats negative dimensions correctly', () => {
    expect(formatFeetInchesFraction(-14.5, 16)).toBe(`-1' 2 1/2"`);
  });

  it('rounds to precision 1/16, 1/32, 1/64', () => {
    const value = toDecimalInches({ inches: 3, numerator: 1, denominator: 8 });
    expect(formatFeetInchesFraction(value, 16)).toBe(`3 1/8"`);
    expect(formatFeetInchesFraction(value, 32)).toBe(`3 1/8"`);
    expect(formatFeetInchesFraction(value, 64)).toBe(`3 1/8"`);
  });

  it('converts metric to decimal inches', () => {
    const inches = centimetersToDecimalInches(2.54);
    expect(inches).toBeCloseTo(1, 4);
    const meters = decimalInchesToMeters(39.3701);
    expect(meters).toBeCloseTo(1, 2);
  });
});

describe('evaluateExpression', () => {
  it('evaluates chained operations', () => {
    const tokens: CalculatorToken[] = [
      { type: 'dimension', value: buildDimensionValue({ feet: 5, inches: 4, numerator: 1, denominator: 2 }) },
      { type: 'operator', operator: '+' },
      { type: 'dimension', value: buildDimensionValue({ inches: 8 }) },
    ];
    const result = evaluateExpression(tokens);
    expect(result.kind).toBe('dimension');
    if (result.kind === 'dimension') {
      expect(formatDimension(result.value, 16)).toBe(`6' 0 1/2"`);
    }
  });
});
