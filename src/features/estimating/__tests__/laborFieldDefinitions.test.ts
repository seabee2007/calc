import { describe, expect, it } from 'vitest';
import {
  getLaborFieldDefinition,
  getLaborFormTooltipDefinitions,
  LABOR_FIELD_DEFINITIONS,
} from '../data/laborFieldDefinitions';

describe('laborFieldDefinitions', () => {
  it('includes short tooltip text for all labor form fields', () => {
    const tooltipIds = [
      'production_rate',
      'production_rate_type',
      'crew_size',
      'hours_per_day',
      'labor_rate',
      'burden_percent',
      'difficulty_factor',
      'location_factor',
    ];

    for (const id of tooltipIds) {
      const definition = getLaborFieldDefinition(id);
      expect(definition?.short).toBeTruthy();
    }

    expect(getLaborFormTooltipDefinitions()).toHaveLength(8);
  });

  it('includes modal definitions for man-hours per unit, crew size, man-days, and crew-days', () => {
    const titles = LABOR_FIELD_DEFINITIONS.map((entry) => entry.title);
    expect(titles).toEqual(
      expect.arrayContaining(['Man-hours per unit', 'Crew size', 'Man-days', 'Crew-days']),
    );
  });

  it('includes production rate type options in modal content', () => {
    const productionRateType = getLaborFieldDefinition('production_rate_type');
    expect(productionRateType?.options).toEqual(['Man-hours per unit']);
  });
});
