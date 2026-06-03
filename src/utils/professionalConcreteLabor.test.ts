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
  it('returns positive hours and cost for a typical slab', () => {
    const result = estimateProfessionalConcreteLabor(baseInput);
    expect(result.estimatedJobDurationHours).toBeGreaterThan(0);
    expect(result.totalManHours).toBeCloseTo(
      result.billableJobDurationHours * result.crewSize,
      1,
    );
    expect(result.costs.totalLaborCost).toBeGreaterThan(0);
    expect(result.taskHours.placement).toBeGreaterThan(0);
  });

  it('enforces small job minimum clock hours', () => {
    const tiny = estimateProfessionalConcreteLabor({
      ...baseInput,
      concreteYards: 1,
      areaSqFt: 50,
      options: { ...baseInput.options, smallJobMinimum: true },
    });
    expect(tiny.billableJobDurationHours).toBeGreaterThanOrEqual(4);
  });

  it('52 CY chute easy broom — labor cost only, job clock ~6–9 hrs, $/CY in planning range, no false OT', () => {
    const input: ConcreteLaborEstimateInput = {
      ...baseInput,
      concreteYards: 52,
      areaSqFt: 2808,
      thicknessInches: 6,
      crew: { laborers: 5, finishers: 2, foremen: 1 },
      placementMethod: 'chute',
      finishType: 'broom',
      accessDifficulty: 'easy',
      weatherCondition: 'normal',
      reinforcementType: 'none',
      options: {
        ...baseInput.options,
        includeContingency: true,
      },
    };
    const result = estimateProfessionalConcreteLabor(input);

    expect(result.estimatedJobDurationHours).toBeGreaterThanOrEqual(5);
    expect(result.estimatedJobDurationHours).toBeLessThanOrEqual(10);
    expect(result.overtimeJobHours).toBeLessThanOrEqual(2);
    expect(result.unitCosts.laborCostPerCY).toBeGreaterThanOrEqual(40);
    expect(result.unitCosts.laborCostPerCY).toBeLessThanOrEqual(120);
    expect(result.costs.totalLaborCost).toBeGreaterThanOrEqual(2000);
    expect(result.costs.totalLaborCost).toBeLessThanOrEqual(6500);
    expect(result.totalManHours).toBeCloseTo(
      result.billableJobDurationHours * result.crewSize,
      0,
    );
  });

  it('OT only when job clock exceeds 8 hours', () => {
    const longDay = estimateProfessionalConcreteLabor({
      ...baseInput,
      concreteYards: 90,
      areaSqFt: 5000,
      placementMethod: 'wheelbarrow',
      accessDifficulty: 'severe',
    });
    if (longDay.billableJobDurationHours > 8) {
      expect(longDay.overtimeJobHours).toBeGreaterThan(0);
      expect(longDay.overtimeManHours).toBe(
        longDay.overtimeJobHours * longDay.crewSize,
      );
    }
  });
});
