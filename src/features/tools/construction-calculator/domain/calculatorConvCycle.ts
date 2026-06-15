import type { ConvUnit, DimensionValue, FractionPrecision } from './constructionCalculatorTypes';
import { CONV_UNITS } from './constructionCalculatorTypes';
import {
  formatAsCentimeters,
  formatAsDecimalFeet,
  formatAsMeters,
  formatAsYards,
  formatDimension,
} from './constructionCalculatorFormatters';

export function nextConvUnitIndex(currentIndex: number): number {  return (currentIndex + 1) % CONV_UNITS.length;
}

export function formatDimensionInConvUnit(
  value: DimensionValue,
  unit: ConvUnit,
  precision: FractionPrecision,
): string {
  switch (unit) {
    case 'ft-in':
      return formatDimension(value, precision);
    case 'decimal-ft':
      return formatAsDecimalFeet(value, precision);
    case 'decimal-in':
      return `${Math.round(value.decimalInches * 10000) / 10000} in`;
    case 'yd':
      return formatAsYards(value, precision);
    case 'm':
      return formatAsMeters(value, precision);
    case 'cm':
      return formatAsCentimeters(value, precision);
    default:
      return formatDimension(value, precision);
  }
}

export function formatDecimalInchesAsConvUnit(
  decimalInches: number,
  unit: ConvUnit,
  precision: FractionPrecision,
): string {
  return formatDimensionInConvUnit({ decimalInches }, unit, precision);
}
