import { describe, expect, it } from 'vitest';
import { estimateProfessionalConcreteLabor } from './professionalConcreteLabor';
import type { ConcreteLaborEstimateInput } from '../types/concreteLaborEstimate';

const baseInput: ConcreteLaborEstimateInput = {
  projectType: 'slab_on_grade',
  concreteYards: 24,
  areaSqFt: 1944,
  thicknessInches: 4,
  crew: { laborers: 4, finishers: 2, foremen: 1 },
  rates: {
    laborerRate: 28,
    finisherRate: 36,
    foremanRate: 48,
    burdenMultiplier: 1.5,
    overtimeMultiplier: 1.5,
  },
  placementMethod: 'pump',
  finishType: 'broom',
  accessDifficulty: 'moderate',
  weatherCondition: 'hot',
  reinforcementType: 'wire_mesh',
  options: {
    pumpRequired: true,
    vaporBarrier: false,
    curingCompound: true,
    sawCutJoints: true,
    smallJobMinimum: false,
    includeCleanup: true,
    includeContingency: true,
  },
};

describe('estimateProfessionalConcreteLabor', () => {
  it('returns positive task hours and total cost for a typical slab', () => {
    const result = estimateProfessionalConcreteLabor(baseInput);
    expect(result.directCrewHours).toBeGreaterThan(0);
    expect(result.billableCrewHours).toBeGreaterThanOrEqual(result.directCrewHours);
    expect(result.costs.totalLaborCost).toBeGreaterThan(0);
    expect(result.taskHours.placement).toBeGreaterThan(0);
    expect(result.taskHours.finishing).toBeGreaterThan(0);
    expect(result.unitCosts.laborCostPerCY).toBeGreaterThan(0);
  });

  it('enforces small job minimum crew-hours', () => {
    const tiny = estimateProfessionalConcreteLabor({
      ...baseInput,
      concreteYards: 1,
      areaSqFt: 50,
      options: { ...baseInput.options, smallJobMinimum: true },
    });
    expect(tiny.billableCrewHours).toBeGreaterThanOrEqual(4);
  });
});
