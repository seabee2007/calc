import { describe, expect, it } from 'vitest';
import { deriveWeatherRiskChip, weatherRiskChipClass } from '../weatherWidgetRisk';
import type { ForecastDay } from '../types';

function day(overrides: Partial<ForecastDay>): ForecastDay {
  return {
    date: '2026-06-17',
    maxTemp: 72,
    minTemp: 58,
    avgTemp: 65,
    maxWindSpeed: 10,
    chanceOfRain: 10,
    totalPrecipitation: 0,
    conditions: 'Partly cloudy',
    ...overrides,
  };
}

describe('weatherWidgetRisk', () => {
  it('returns Poor for heavy rain or high wind', () => {
    expect(deriveWeatherRiskChip(day({ chanceOfRain: 55 }))).toBe('Poor');
    expect(deriveWeatherRiskChip(day({ maxWindSpeed: 30 }))).toBe('Poor');
  });

  it('returns Watch for moderate rain, wind, or temperature extremes', () => {
    expect(deriveWeatherRiskChip(day({ chanceOfRain: 35 }))).toBe('Watch');
    expect(deriveWeatherRiskChip(day({ maxWindSpeed: 20 }))).toBe('Watch');
    expect(deriveWeatherRiskChip(day({ maxTemp: 96 }))).toBe('Watch');
    expect(deriveWeatherRiskChip(day({ maxTemp: 34 }))).toBe('Watch');
  });

  it('returns Good for mild conditions', () => {
    expect(deriveWeatherRiskChip(day({}))).toBe('Good');
  });

  it('maps chip classes for styling', () => {
    expect(weatherRiskChipClass('Good')).toContain('emerald');
    expect(weatherRiskChipClass('Watch')).toContain('amber');
    expect(weatherRiskChipClass('Poor')).toContain('red');
  });
});
