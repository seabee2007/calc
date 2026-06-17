/** Responsive layout modes for the Weather Forecast dashboard widget. */
export type WeatherForecastDisplayMode = 'compact' | 'singleDay' | 'twoThirds' | 'wide';

/**
 * Layout by dashboard column width (12-col grid):
 * - wide (≥10): full-width premium side-by-side panel
 * - twoThirds (8–9): compact operations weather card
 * - singleDay (5–7): half-width detail view
 * - compact (≤4): third-width / mobile
 */
export function weatherForecastDisplayMode(
  cardWidth?: number,
  isMobile?: boolean,
): WeatherForecastDisplayMode {
  const w = cardWidth ?? 12;
  if (isMobile || w <= 4) return 'compact';
  if (w >= 10) return 'wide';
  if (w >= 8) return 'twoThirds';
  return 'singleDay';
}

export function weatherForecastDaysForMode(mode: WeatherForecastDisplayMode): number {
  if (mode === 'compact' || mode === 'singleDay') return 1;
  if (mode === 'twoThirds') return 5;
  return 7;
}
