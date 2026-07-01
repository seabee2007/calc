import type { UserPreferences } from '../types';

export type MeasurementSystem = UserPreferences['measurementSystem'];

export type MeasurementPreferenceFields = Pick<
  UserPreferences,
  'measurementSystem' | 'units' | 'lengthUnit' | 'volumeUnit'
>;

const DEFAULT_MEASUREMENT_SYSTEM: MeasurementSystem = 'imperial';

function isMeasurementSystem(value: unknown): value is MeasurementSystem {
  return value === 'imperial' || value === 'metric';
}

export function measurementSystemToLegacyUnits(
  system: MeasurementSystem,
): MeasurementPreferenceFields {
  if (system === 'metric') {
    return {
      measurementSystem: 'metric',
      units: 'metric',
      lengthUnit: 'meters',
      volumeUnit: 'cubic_meters',
    };
  }

  return {
    measurementSystem: 'imperial',
    units: 'imperial',
    lengthUnit: 'feet',
    volumeUnit: 'cubic_yards',
  };
}

export function getMeasurementSystemFromPreferences(
  preferences: Partial<Pick<UserPreferences, 'measurementSystem' | 'units' | 'lengthUnit' | 'volumeUnit'>> | null | undefined,
): MeasurementSystem {
  if (!preferences) return DEFAULT_MEASUREMENT_SYSTEM;

  if (isMeasurementSystem(preferences.measurementSystem)) {
    return preferences.measurementSystem;
  }

  if (isMeasurementSystem(preferences.units)) {
    return preferences.units;
  }

  if (
    preferences.lengthUnit === 'meters' ||
    preferences.volumeUnit === 'cubic_meters'
  ) {
    return 'metric';
  }

  if (
    preferences.lengthUnit === 'feet' ||
    preferences.volumeUnit === 'cubic_yards' ||
    preferences.volumeUnit === 'cubic_feet'
  ) {
    return 'imperial';
  }

  return DEFAULT_MEASUREMENT_SYSTEM;
}

export function normalizeMeasurementPreferences<T extends Partial<UserPreferences>>(
  preferences: T,
): T & MeasurementPreferenceFields {
  return {
    ...preferences,
    ...measurementSystemToLegacyUnits(getMeasurementSystemFromPreferences(preferences)),
  };
}

