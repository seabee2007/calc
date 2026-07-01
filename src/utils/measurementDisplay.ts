import type { MeasurementSystem } from './measurementPreferences';

export type MeasurementDimensionKind = 'length' | 'small' | 'area' | 'volume';

export const METERS_PER_FOOT = 0.3048;
export const METERS_PER_INCH = 0.0254;
export const SQUARE_METERS_PER_SQUARE_FOOT = 0.09290304;
export const CUBIC_METERS_PER_CUBIC_YARD = 0.764554857984;

function round(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function formatRoundedNumber(value: number, precision: number): string {
  const fixed = value.toFixed(precision);
  return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed;
}

export function metersToDisplayLength(
  meters: number,
  system: MeasurementSystem,
  kind: 'length' | 'small' = 'length',
): number {
  if (system === 'metric') return meters;
  return kind === 'small' ? meters / METERS_PER_INCH : meters / METERS_PER_FOOT;
}

export function displayLengthToMeters(
  value: number,
  system: MeasurementSystem,
  kind: 'length' | 'small' = 'length',
): number {
  if (system === 'metric') return value;
  return value * (kind === 'small' ? METERS_PER_INCH : METERS_PER_FOOT);
}

export function squareMetersToDisplayArea(squareMeters: number, system: MeasurementSystem): number {
  if (system === 'metric') return squareMeters;
  return squareMeters / SQUARE_METERS_PER_SQUARE_FOOT;
}

export function cubicMetersToDisplayVolume(cubicMeters: number, system: MeasurementSystem): number {
  if (system === 'metric') return cubicMeters;
  return cubicMeters / CUBIC_METERS_PER_CUBIC_YARD;
}

export function displayLengthUnit(system: MeasurementSystem, kind: 'length' | 'small' = 'length'): string {
  if (system === 'metric') return 'm';
  return kind === 'small' ? 'in' : 'ft';
}

export function displayAreaUnit(system: MeasurementSystem): 'SM' | 'SF' {
  return system === 'metric' ? 'SM' : 'SF';
}

export function displayVolumeUnit(system: MeasurementSystem): 'CM' | 'CY' {
  return system === 'metric' ? 'CM' : 'CY';
}

export function formatDisplayLength(
  meters: number,
  system: MeasurementSystem,
  options: {
    kind?: 'length' | 'small';
    precision?: number;
    includeUnit?: boolean;
  } = {},
): string {
  const kind = options.kind ?? 'length';
  const precision = options.precision ?? (kind === 'small' ? 2 : 2);
  const value = round(metersToDisplayLength(meters, system, kind), precision);
  const formatted = formatRoundedNumber(value, precision);
  return options.includeUnit === false
    ? formatted
    : `${formatted} ${displayLengthUnit(system, kind)}`;
}

export function formatDisplayArea(
  squareMeters: number,
  system: MeasurementSystem,
  precision = 2,
): string {
  const value = round(squareMetersToDisplayArea(squareMeters, system), precision);
  return `${formatRoundedNumber(value, precision)} ${displayAreaUnit(system)}`;
}

export function formatDisplayVolume(
  cubicMeters: number,
  system: MeasurementSystem,
  precision = 2,
): string {
  const value = round(cubicMetersToDisplayVolume(cubicMeters, system), precision);
  return `${formatRoundedNumber(value, precision)} ${displayVolumeUnit(system)}`;
}

export function formatGridSpacing(
  spacingMeters: number,
  system: MeasurementSystem,
): string {
  return formatDisplayLength(spacingMeters, system, {
    kind: 'length',
    precision: spacingMeters < 1 || system === 'imperial' ? 1 : 0,
  });
}

const IMPERIAL_DEFAULT_UNITS = [
  'LF',
  'SF',
  'CY',
  'EA',
  'LS',
  'CF',
  'SY',
  'HR',
  'DAY',
  'TON',
  'LB',
  'BAG',
  'SHEET',
  'BOX',
  'ROLL',
  'SET',
  'LOT',
] as const;

const METRIC_DEFAULT_UNITS = [
  'LM',
  'SM',
  'CM',
  'EA',
  'LS',
  'L',
  'KG',
  'MT',
  'HR',
  'DAY',
  'BAG',
  'SHEET',
  'BOX',
  'ROLL',
  'SET',
  'LOT',
] as const;

export function preferredConstructionUnitCodes(system: MeasurementSystem): readonly string[] {
  return system === 'metric' ? METRIC_DEFAULT_UNITS : IMPERIAL_DEFAULT_UNITS;
}
