import type { DesignEstimatePreviewLine } from '../types';

export type DesignMeasurementSystem = 'metric' | 'imperial';

const SQUARE_METERS_PER_SQUARE_FOOT = 0.09290304;
const CUBIC_METERS_PER_CUBIC_YARD = 0.764554857984;
const METERS_PER_FOOT = 0.3048;

export function roundDesignQuantity(value: number, precision = 3): number {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function cubicMetersToCubicYardsForDisplay(cubicMeters: number): number {
  return cubicMeters / CUBIC_METERS_PER_CUBIC_YARD;
}

export function squareMetersToSquareFeetForDisplay(squareMeters: number): number {
  return squareMeters / SQUARE_METERS_PER_SQUARE_FOOT;
}

export function metersToFeetForDisplay(meters: number): number {
  return meters / METERS_PER_FOOT;
}

export function volumeFromCubicMeters(
  cubicMeters: number,
  system: DesignMeasurementSystem,
  precision = 2,
): { quantity: number; unit: 'CM' | 'CY' } {
  if (system === 'metric') {
    return { quantity: roundDesignQuantity(cubicMeters, precision), unit: 'CM' };
  }
  return {
    quantity: roundDesignQuantity(cubicMetersToCubicYardsForDisplay(cubicMeters), precision),
    unit: 'CY',
  };
}

export function areaFromSquareMeters(
  squareMeters: number,
  system: DesignMeasurementSystem,
  precision = 2,
): { quantity: number; unit: 'SM' | 'SF' } {
  if (system === 'metric') {
    return { quantity: roundDesignQuantity(squareMeters, precision), unit: 'SM' };
  }
  return {
    quantity: roundDesignQuantity(squareMetersToSquareFeetForDisplay(squareMeters), precision),
    unit: 'SF',
  };
}

export function lengthFromMeters(
  meters: number,
  system: DesignMeasurementSystem,
  precision = 2,
): { quantity: number; unit: 'M' | 'LF' } {
  if (system === 'metric') {
    return { quantity: roundDesignQuantity(meters, precision), unit: 'M' };
  }
  return { quantity: roundDesignQuantity(metersToFeetForDisplay(meters), precision), unit: 'LF' };
}

export function applyMeasurementSystemToPreviewLine(
  line: DesignEstimatePreviewLine,
  system: DesignMeasurementSystem,
): DesignEstimatePreviewLine {
  if (system === 'metric') {
    switch (line.unit) {
      case 'CY':
        return {
          ...line,
          quantity: roundDesignQuantity(line.quantity * CUBIC_METERS_PER_CUBIC_YARD, 2),
          unit: 'CM',
        };
      case 'SF':
        return {
          ...line,
          quantity: roundDesignQuantity(line.quantity * SQUARE_METERS_PER_SQUARE_FOOT, 2),
          unit: 'SM',
        };
      case 'LF':
        return {
          ...line,
          quantity: roundDesignQuantity(line.quantity * METERS_PER_FOOT, 2),
          unit: 'M',
        };
      default:
        return line;
    }
  }

  switch (line.unit) {
    case 'M3':
    case 'CM':
      return {
        ...line,
        quantity: roundDesignQuantity(cubicMetersToCubicYardsForDisplay(line.quantity), 2),
        unit: 'CY',
      };
    case 'M2':
    case 'SM':
      return {
        ...line,
        quantity: roundDesignQuantity(squareMetersToSquareFeetForDisplay(line.quantity), 2),
        unit: 'SF',
      };
    case 'M':
      return {
        ...line,
        quantity: roundDesignQuantity(metersToFeetForDisplay(line.quantity), 2),
        unit: 'LF',
      };
    default:
      return line;
  }
}

export function applyMeasurementSystemToPreviewLines(
  lines: readonly DesignEstimatePreviewLine[],
  system: DesignMeasurementSystem,
): DesignEstimatePreviewLine[] {
  return lines.map((line) => applyMeasurementSystemToPreviewLine(line, system));
}
