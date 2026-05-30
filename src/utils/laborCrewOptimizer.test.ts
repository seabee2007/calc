import { describe, expect, it } from 'vitest';
import type { ConcreteLaborEstimateInput } from '../types/concreteLaborEstimate';
import { optimizeLaborCrew } from './laborCrewOptimizer';

const baseInput: ConcreteLaborEstimateInput = {
  projectType: 'slab_on_grade',
  concreteYards: 30,
  areaSqFt: 4000,
  thicknessInches: 6,
  crew: { laborers: 4, finishers: 2, foremen: 1 },
  rates: {
    laborerRate: 28,
    finisherRate: 32,
    foremanRate: 38,
    burdenMultiplier: 1.35,
    overtimeMultiplier: 1.5,
  },
  placementMethod: 'chute',
  finishType: 'broom',
  accessDifficulty: 'easy',
  weatherCondition: 'normal',
  reinforcementType: 'wire_mesh',
  options: {
    pumpRequired: false,
    vaporBarrier: false,
    curingCompound: true,
    sawCutJoints: true,
    smallJobMinimum: false,
    includeCleanup: true,
    includeContingency: true,
  },
};

describe('optimizeLaborCrew', () => {
  it('returns ranked scenarios with a recommended crew', () => {
    const result = optimizeLaborCrew(baseInput);
    expect(result.scenarios.length).toBeGreaterThan(0);
    expect(result.recommended.crewSize).toBeGreaterThanOrEqual(3);
    expect(result.recommended.totalLaborCost).toBeGreaterThan(0);
    expect(result.current.crewSize).toBe(7);
  });

  it('prefers larger finishing crew for hot stamped slabs', () => {
    const hotStamp: ConcreteLaborEstimateInput = {
      ...baseInput,
      finishType: 'stamp',
      weatherCondition: 'hot',
      areaSqFt: 3500,
    };
    const result = optimizeLaborCrew(hotStamp);
    expect(result.recommended.finishers).toBeGreaterThanOrEqual(2);
  });

  it('requires a foreman on large pours', () => {
    const result = optimizeLaborCrew(baseInput);
    expect(result.recommended.foremen).toBeGreaterThanOrEqual(1);
  });

  it('penalizes crews with too few finishers relative to headcount', () => {
    const result = optimizeLaborCrew(baseInput);
    const understaffed = result.scenarios.find(
      (s) => s.finishers / s.crewSize < 0.25,
    );
    const wellStaffed = result.scenarios.find(
      (s) => s.finishers / s.crewSize >= 0.25,
    );
    if (understaffed && wellStaffed) {
      expect(understaffed.score).toBeGreaterThan(wellStaffed.score);
    }
  });
});
