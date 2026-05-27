import { describe, expect, it } from 'vitest';
import { suggestConcreteParameters } from './mixDesign';
import { buildProfessionalMixRecommendation } from './mixDesignProfessional';
import { DEFAULT_MIX_ADVISOR_FORM } from '../constants/mixDesignAdvisorDefaults';

describe('mixDesignProfessional', () => {
  it('does not increase w/c ratio in hot weather (legacy suggestConcreteParameters)', () => {
    const cool = suggestConcreteParameters({
      tempF: 70,
      humidityPercent: 50,
      windMph: 5,
      psi: 3000,
      exposure: 'F1',
      climate: 'temperate',
    });
    const hot = suggestConcreteParameters({
      tempF: 95,
      humidityPercent: 40,
      windMph: 8,
      psi: 3000,
      exposure: 'F1',
      climate: 'temperate',
    });
    expect(hot.waterCementRatio).toBeLessThanOrEqual(cool.waterCementRatio);
  });

  it('professional mix holds w/c at durability max and recommends retarder when hot', () => {
    const result = buildProfessionalMixRecommendation({
      form: {
        ...DEFAULT_MIX_ADVISOR_FORM,
        selectedPsi: '3000',
        exposure: 'F1',
        airEntrainmentRequired: true,
      },
      tempF: 95,
      humidityPercent: 35,
      windMph: 10,
    });
    expect(result.waterCementRatio).toBe(result.maxAllowedWaterCementRatio);
    expect(result.hotWeatherPrecautions.length).toBeGreaterThan(0);
    expect(
      result.admixtureRecommendations.some((r) => r.toLowerCase().includes('retard')),
    ).toBe(true);
  });
});
