import { describe, expect, it } from 'vitest';
import {
  displayLengthToMeters,
  formatDisplayLength,
  formatGridSpacing,
  metersToDisplayLength,
  preferredConstructionUnitCodes,
  squareMetersToDisplayArea,
  cubicMetersToDisplayVolume,
} from './measurementDisplay';

describe('measurementDisplay', () => {
  it('round trips metric length values without changing meter-based storage', () => {
    const display = metersToDisplayLength(3.5, 'metric');
    expect(display).toBe(3.5);
    expect(displayLengthToMeters(display, 'metric')).toBe(3.5);
  });

  it('round trips imperial layout length values through feet', () => {
    const display = metersToDisplayLength(3.048, 'imperial');
    expect(display).toBeCloseTo(10);
    expect(displayLengthToMeters(display, 'imperial')).toBeCloseTo(3.048);
  });

  it('round trips imperial small dimensions through inches', () => {
    const display = metersToDisplayLength(0.1016, 'imperial', 'small');
    expect(display).toBeCloseTo(4);
    expect(displayLengthToMeters(display, 'imperial', 'small')).toBeCloseTo(0.1016);
  });

  it('formats grid labels for metric and imperial systems', () => {
    expect(formatGridSpacing(1, 'metric')).toBe('1 m');
    expect(formatGridSpacing(0.3048, 'imperial')).toBe('1 ft');
  });

  it('formats small dimensions in inches for imperial users', () => {
    expect(formatDisplayLength(0.1016, 'imperial', { kind: 'small' })).toBe('4 in');
  });

  it('converts area and volume display values by measurement system', () => {
    expect(squareMetersToDisplayArea(9.290304, 'imperial')).toBeCloseTo(100);
    expect(cubicMetersToDisplayVolume(0.764554857984, 'imperial')).toBeCloseTo(1);
  });

  it('orders preferred construction units by measurement system', () => {
    expect(preferredConstructionUnitCodes('imperial').slice(0, 4)).toEqual([
      'LF',
      'SF',
      'CY',
      'EA',
    ]);
    expect(preferredConstructionUnitCodes('metric').slice(0, 4)).toEqual([
      'LM',
      'SM',
      'CM',
      'EA',
    ]);
  });
});
