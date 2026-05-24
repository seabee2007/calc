import type { ForecastDay } from '../types';
import type { PourPlannerFormState } from '../types/pourPlanner';

export function conditionsToCloudCover(conditions: string | undefined): PourPlannerFormState['cloudCover'] {
  const c = (conditions ?? '').toLowerCase();
  if (c.includes('overcast') || (c.includes('cloud') && !c.includes('partly') && !c.includes('partial'))) {
    return 'overcast';
  }
  if (c.includes('partly') || c.includes('partial')) {
    return 'partly_cloudy';
  }
  return 'clear';
}

type SetField = <K extends keyof PourPlannerFormState>(
  key: K,
  value: PourPlannerFormState[K],
) => void;

/** Jobsite forecast → ambient field readings at the pour location. */
export function applyJobsiteForecastToForm(day: ForecastDay, setField: SetField): void {
  setField('ambientTemp', String(Math.round(day.avgTemp)));
  if (day.avgHumidity != null) {
    setField('relativeHumidity', String(Math.round(day.avgHumidity)));
  }
  setField('windSpeed', String(Math.round(day.maxWindSpeed)));
  setField('cloudCover', conditionsToCloudCover(day.conditions));
  setField('rainForecast', day.chanceOfRain >= 30);
}

/** Batch plant forecast → concrete temperature readings at the plant. */
export function applyBatchPlantForecastToForm(day: ForecastDay, setField: SetField): void {
  const plantTemp = Math.round(day.avgTemp);
  setField('concreteTempAtPlant', String(plantTemp));
  setField('expectedConcreteTempAtArrival', String(plantTemp + 8));
}
