import { describe, expect, it } from 'vitest';
import {
  weatherForecastDaysForMode,
  weatherForecastDisplayMode,
} from './weatherForecastDisplay';

describe('weatherForecastDisplay', () => {
  it('uses compact mode for third-width and mobile cards', () => {
    expect(weatherForecastDisplayMode(4)).toBe('compact');
    expect(weatherForecastDisplayMode(12, true)).toBe('compact');
  });

  it('uses single-day mode for half-width cards', () => {
    expect(weatherForecastDisplayMode(6)).toBe('singleDay');
  });

  it('uses two-thirds mode for 8–9 column cards', () => {
    expect(weatherForecastDisplayMode(8)).toBe('twoThirds');
    expect(weatherForecastDisplayMode(9)).toBe('twoThirds');
  });

  it('uses wide mode for full-width cards', () => {
    expect(weatherForecastDisplayMode(10)).toBe('wide');
    expect(weatherForecastDisplayMode(12)).toBe('wide');
  });

  it('requests the correct forecast day count per mode', () => {
    expect(weatherForecastDaysForMode('wide')).toBe(7);
    expect(weatherForecastDaysForMode('twoThirds')).toBe(5);
    expect(weatherForecastDaysForMode('singleDay')).toBe(1);
    expect(weatherForecastDaysForMode('compact')).toBe(1);
  });
});
