import type { ForecastDay } from '../types';

export type WeatherRiskChip = 'Good' | 'Watch' | 'Poor';

/** Simple weather risk label derived from forecast fields (not official placement approval). */
export function deriveWeatherRiskChip(day: ForecastDay): WeatherRiskChip {
  if (day.chanceOfRain >= 50 || day.maxWindSpeed >= 25) return 'Poor';
  if (
    day.chanceOfRain >= 30 ||
    day.maxWindSpeed >= 18 ||
    day.maxTemp >= 95 ||
    day.maxTemp <= 35
  ) {
    return 'Watch';
  }
  return 'Good';
}

export function weatherRiskChipClass(level: WeatherRiskChip): string {
  switch (level) {
    case 'Good':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
    case 'Watch':
      return 'bg-amber-500/15 text-amber-800 dark:text-amber-300';
    case 'Poor':
      return 'bg-red-500/15 text-red-700 dark:text-red-300';
  }
}
