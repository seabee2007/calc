import { describe, expect, it } from 'vitest';
import {
  getMeasurementSystemFromPreferences,
  measurementSystemToLegacyUnits,
  normalizeMeasurementPreferences,
} from './measurementPreferences';

describe('measurementPreferences', () => {
  it('normalizes a clean imperial row', () => {
    expect(
      normalizeMeasurementPreferences({
        measurementSystem: 'imperial',
        units: 'imperial',
        lengthUnit: 'feet',
        volumeUnit: 'cubic_yards',
      }),
    ).toEqual(measurementSystemToLegacyUnits('imperial'));
  });

  it('normalizes a clean metric row', () => {
    expect(
      normalizeMeasurementPreferences({
        measurementSystem: 'metric',
        units: 'metric',
        lengthUnit: 'meters',
        volumeUnit: 'cubic_meters',
      }),
    ).toEqual(measurementSystemToLegacyUnits('metric'));
  });

  it('lets measurementSystem win over inconsistent legacy fields', () => {
    const normalized = normalizeMeasurementPreferences({
      measurementSystem: 'imperial',
      units: 'metric',
      lengthUnit: 'meters',
      volumeUnit: 'cubic_meters',
    });

    expect(normalized).toEqual(measurementSystemToLegacyUnits('imperial'));
  });

  it('infers metric when measurementSystem is missing and legacy fields are metric', () => {
    expect(
      getMeasurementSystemFromPreferences({
        lengthUnit: 'meters',
        volumeUnit: 'cubic_meters',
      }),
    ).toBe('metric');
  });

  it('infers imperial when measurementSystem is missing and legacy fields are imperial', () => {
    expect(
      getMeasurementSystemFromPreferences({
        lengthUnit: 'feet',
        volumeUnit: 'cubic_yards',
      }),
    ).toBe('imperial');
  });

  it('uses imperial when no measurement fields are present', () => {
    expect(normalizeMeasurementPreferences({ currency: 'USD' })).toEqual({
      currency: 'USD',
      ...measurementSystemToLegacyUnits('imperial'),
    });
  });
});
