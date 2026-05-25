import type { ForecastDay } from '../types';
import type { PourPlannerFormState } from '../types/pourPlanner';

type SetField = <K extends keyof PourPlannerFormState>(
  key: K,
  value: PourPlannerFormState[K],
) => void;

/** Round the same way as PourDayCard forecast display. */
export function formatForecastWindMph(maxWindSpeed: number): string {
  return String(Math.round(maxWindSpeed));
}

export function formatForecastTempF(temp: number): string {
  return String(Math.round(temp));
}

/** Populate field conditions from the selected pour-day card (same forecast source). */
export function applySelectedPourDayToForm(day: ForecastDay, setField: SetField): void {
  setField('ambientTemp', formatForecastTempF(day.avgTemp));
  if (day.avgHumidity != null) {
    setField('relativeHumidity', String(Math.round(day.avgHumidity)));
  }
  setField('windSpeed', formatForecastWindMph(day.maxWindSpeed));

  const plantTemp = Math.round(day.avgTemp);
  setField('concreteTempAtPlant', String(plantTemp));
  setField('expectedConcreteTempAtArrival', String(plantTemp + 8));
  setField('rainForecast', day.chanceOfRain >= 30);
}
