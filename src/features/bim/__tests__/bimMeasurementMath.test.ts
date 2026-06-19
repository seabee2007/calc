import { describe, expect, it } from 'vitest';
import {
  buildMeasurementResult,
  calculateCalibrationScaleFactor,
  calculatePolygonArea3D,
  calculatePolylineLength,
  formatFeetInchesFraction,
  formatLengthMeasurement,
  convertModelUnitsToFeet,
} from '../measurement/bimMeasurementMath';

describe('bim measurement math', () => {
  it('converts model units to feet', () => {
    expect(convertModelUnitsToFeet('feet')).toBe(1);
    expect(convertModelUnitsToFeet('inches')).toBeCloseTo(1 / 12);
    expect(convertModelUnitsToFeet('meters')).toBeCloseTo(3.28084);
    expect(convertModelUnitsToFeet('millimeters')).toBeCloseTo(0.00328084);
  });

  it('calculates polyline length', () => {
    expect(
      calculatePolylineLength([
        { x: 0, y: 0, z: 0 },
        { x: 3, y: 4, z: 0 },
      ]),
    ).toBe(5);
  });

  it('calculates polygon area in 3D', () => {
    expect(
      calculatePolygonArea3D([
        { x: 0, y: 0, z: 0 },
        { x: 10, y: 0, z: 0 },
        { x: 10, y: 5, z: 0 },
        { x: 0, y: 5, z: 0 },
      ]),
    ).toBe(50);
  });

  it('builds line measurement result as LF', () => {
    const result = buildMeasurementResult({
      mode: 'line',
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 3, y: 4, z: 0 },
      ],
      closed: false,
      modelUnit: 'feet',
      scaleConfirmed: true,
    });

    expect(result.quantity).toBe(5);
    expect(result.unit).toBe('LF');
  });

  it('calculates scale factor from a known distance', () => {
    const calibration = calculateCalibrationScaleFactor({
      knownDistance: 3,
      knownDistanceUnit: 'feet',
      rawModelDistance: 6,
      modelUnit: 'feet',
    });

    expect(calibration?.scaleFactor).toBe(0.5);
    expect(calibration?.knownDistanceFeet).toBe(3);
    expect(calibration?.rawDistanceFeet).toBe(6);
  });

  it('applies calibration scale factor to line measurement', () => {
    const result = buildMeasurementResult({
      mode: 'line',
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 10, y: 0, z: 0 },
      ],
      closed: false,
      modelUnit: 'feet',
      scaleConfirmed: true,
      calibrationScaleFactor: 0.3,
      calibrated: true,
    });

    expect(result.quantity).toBe(3);
    expect(result.calibrated).toBe(true);
  });

  it('builds closed area measurement result as SF', () => {
    const result = buildMeasurementResult({
      mode: 'area',
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 10, y: 0, z: 0 },
        { x: 10, y: 5, z: 0 },
        { x: 0, y: 5, z: 0 },
      ],
      closed: true,
      modelUnit: 'feet',
      scaleConfirmed: true,
    });

    expect(result.quantity).toBe(50);
    expect(result.unit).toBe('SF');
    expect(result.perimeter).toBe(30);
  });

  it('applies square of calibration scale factor to area measurement', () => {
    const result = buildMeasurementResult({
      mode: 'area',
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 10, y: 0, z: 0 },
        { x: 10, y: 10, z: 0 },
        { x: 0, y: 10, z: 0 },
      ],
      closed: true,
      modelUnit: 'feet',
      scaleConfirmed: true,
      calibrationScaleFactor: 0.5,
      calibrated: true,
    });

    expect(result.quantity).toBe(25);
    expect(result.unit).toBe('SF');
  });

  it('formats feet-inch fractions with common fractions and overflow', () => {
    expect(formatFeetInchesFraction(5.375)).toBe(`5'-4 1/2"`);
    expect(formatFeetInchesFraction(3)).toBe(`3'-0"`);
    expect(formatFeetInchesFraction(0.5)).toBe(`6"`);
    expect(formatFeetInchesFraction(5 + 11.99 / 12, 16)).toBe(`6'-0"`);
    expect(formatFeetInchesFraction(2 + 3.25 / 12, 16)).toBe(`2'-3 1/4"`);
    expect(formatFeetInchesFraction(2 + 3.125 / 12, 16)).toBe(`2'-3 1/8"`);
    expect(formatFeetInchesFraction(2 + 3.0625 / 12, 16)).toBe(`2'-3 1/16"`);
  });

  it('formats metric lengths as millimeters under one meter and meters above', () => {
    expect(formatLengthMeasurement(0.5 / 0.3048, 'metric')).toBe('500 mm');
    expect(formatLengthMeasurement(1.5 / 0.3048, 'metric')).toBe('1.50 m');
  });
});
