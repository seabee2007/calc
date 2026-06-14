import type { DimensionParts, DimensionValue, FractionPrecision } from './constructionCalculatorTypes';
import {
  decimalInchesToCentimeters,
  decimalInchesToDecimalFeet,
  decimalInchesToMeters,
  decimalInchesToMillimeters,
  decimalInchesToYards,
  formatFeetInchesFraction,
  roundToPrecision,
  toDecimalInches,
} from './constructionDimensionMath';

export function buildDimensionValue(parts: DimensionParts): DimensionValue {
  const decimalInches = toDecimalInches(parts);
  return { decimalInches, parts };
}

export function buildDimensionFromDecimal(decimalInches: number): DimensionValue {
  return { decimalInches };
}

export function formatDimension(
  value: DimensionValue,
  precision: FractionPrecision = 16,
): string {
  return formatFeetInchesFraction(value.decimalInches, precision);
}

export function formatAsDecimalFeet(value: DimensionValue, precision: FractionPrecision = 16): string {
  const feet = decimalInchesToDecimalFeet(value.decimalInches);
  return `${roundToPrecision(feet, precision)} ft`;
}

export function formatAsYards(value: DimensionValue, precision: FractionPrecision = 16): string {
  const yards = decimalInchesToYards(value.decimalInches);
  return `${roundToPrecision(yards, precision)} yd`;
}

export function formatAsMeters(value: DimensionValue, precision: FractionPrecision = 16): string {
  const meters = decimalInchesToMeters(value.decimalInches);
  return `${roundToPrecision(meters, precision)} m`;
}

export function formatAsCentimeters(value: DimensionValue, precision: FractionPrecision = 16): string {
  const cm = decimalInchesToCentimeters(value.decimalInches);
  return `${roundToPrecision(cm, precision)} cm`;
}

export function formatAsMillimeters(value: DimensionValue, precision: FractionPrecision = 16): string {
  const mm = decimalInchesToMillimeters(value.decimalInches);
  return `${roundToPrecision(mm, precision)} mm`;
}

export function formatScalar(value: number, decimals = 4): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 10 ** decimals) / 10 ** decimals;
  return String(rounded);
}

export function formatEvaluationResult(
  result: { kind: 'dimension'; value: DimensionValue } | { kind: 'scalar'; value: number },
  precision: FractionPrecision = 16,
): string {
  if (result.kind === 'dimension') {
    return formatDimension(result.value, precision);
  }
  return formatScalar(result.value);
}
