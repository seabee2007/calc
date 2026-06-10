/**
 * Crew size and hours-per-day duration tests.
 *
 * Verifies that:
 *   1. Changing crew size changes calculated duration (more crew = shorter duration)
 *   2. Changing hours per day changes calculated duration (fewer hours = longer duration)
 *   3. Duration override wins over calculated duration (effectiveDurationDays)
 *   4. Line item man-hours are unchanged when crew size changes
 *   5. Schedule adapter uses effectiveDurationDays (not calculatedDurationDays)
 *
 * Duration formula (from constructionActivityCalculations.ts):
 *   calculatedDurationDays = ceil(totalManHours / (crewSize × hoursPerDay))
 *   effectiveDurationDays  = durationDaysOverride ?? calculatedDurationDays
 */
import { describe, expect, it } from 'vitest';
import { instantiateFromAssemblySpec } from '../domain/activityAssemblyInstantiation';
import {
  ASSEMBLY_PLACE_SLAB_ON_GRADE,
  ASSEMBLY_CLEAR_AND_GRUB,
} from '../data/activityAssemblyRegistry';
import {
  DIV03_ALL_PRODUCTION_RATES,
  DIV03_CONCRETE,
  PLACE_SLAB_ON_GRADE_LINE_ITEMS,
} from '../data/div03ConcreteSeeds';
import {
  DIV31_EARTHWORK,
  DIV31_PRODUCTION_RATES,
  CLEAR_AND_GRUB_LINE_ITEMS,
} from '../data/div31EarthworkSeeds';
import { constructionActivitiesToScheduleActivities } from '../scheduling/adapters/constructionActivitiesToScheduleActivities';

const RATE_MAP = new Map(
  [...DIV03_ALL_PRODUCTION_RATES, ...DIV31_PRODUCTION_RATES].map((r) => [r.id, r]),
);

const SLAB_INPUTS = {
  slabAreaSf: 2000,
  slabConcreteCy: 25,
  slabPerimeterLf: 180,
  controlJointLf: 350,
};

// ── 1. Changing crew size changes duration ────────────────────────────────────

describe('Crew size changes calculated duration', () => {
  const base = instantiateFromAssemblySpec({
    assembly: ASSEMBLY_PLACE_SLAB_ON_GRADE,
    userInputs: SLAB_INPUTS,
    division: DIV03_CONCRETE,
    lineItemTemplates: PLACE_SLAB_ON_GRADE_LINE_ITEMS,
    productionRates: RATE_MAP,
    projectId: 'proj-crew-test',
    crewSize: 1,
    hoursPerDay: 8,
  });

  const larger = instantiateFromAssemblySpec({
    assembly: ASSEMBLY_PLACE_SLAB_ON_GRADE,
    userInputs: SLAB_INPUTS,
    division: DIV03_CONCRETE,
    lineItemTemplates: PLACE_SLAB_ON_GRADE_LINE_ITEMS,
    productionRates: RATE_MAP,
    projectId: 'proj-crew-test',
    crewSize: 4,
    hoursPerDay: 8,
  });

  it('larger crew produces shorter calculated duration', () => {
    expect(larger.rollup.calculatedDurationDays).toBeLessThan(base.rollup.calculatedDurationDays);
  });

  it('crew=1 duration ≈ 4× crew=4 duration (ceil math may vary by 1)', () => {
    const ratio = base.rollup.calculatedDurationDays / larger.rollup.calculatedDurationDays;
    expect(ratio).toBeGreaterThanOrEqual(3);
    expect(ratio).toBeLessThanOrEqual(5);
  });

  it('crew=4 calculatedDurationDays = ceil(totalMH / (4 × 8))', () => {
    const mh = larger.rollup.totalManHours;
    const expected = Math.ceil(mh / (4 * 8));
    expect(larger.rollup.calculatedDurationDays).toBe(expected);
  });

  it('crew=1 calculatedDurationDays = ceil(totalMH / (1 × 8))', () => {
    const mh = base.rollup.totalManHours;
    const expected = Math.ceil(mh / (1 * 8));
    expect(base.rollup.calculatedDurationDays).toBe(expected);
  });

  it('both results have the same totalManHours (crew size does not affect MH)', () => {
    expect(base.rollup.totalManHours).toBeCloseTo(larger.rollup.totalManHours, 6);
  });
});

// ── 2. Changing hours per day changes duration ────────────────────────────────

describe('Hours per day changes calculated duration', () => {
  const full = instantiateFromAssemblySpec({
    assembly: ASSEMBLY_PLACE_SLAB_ON_GRADE,
    userInputs: SLAB_INPUTS,
    division: DIV03_CONCRETE,
    lineItemTemplates: PLACE_SLAB_ON_GRADE_LINE_ITEMS,
    productionRates: RATE_MAP,
    projectId: 'proj-hours-test',
    crewSize: 4,
    hoursPerDay: 8,
  });

  const half = instantiateFromAssemblySpec({
    assembly: ASSEMBLY_PLACE_SLAB_ON_GRADE,
    userInputs: SLAB_INPUTS,
    division: DIV03_CONCRETE,
    lineItemTemplates: PLACE_SLAB_ON_GRADE_LINE_ITEMS,
    productionRates: RATE_MAP,
    projectId: 'proj-hours-test',
    crewSize: 4,
    hoursPerDay: 4,
  });

  it('half day (4h) produces longer duration than full day (8h)', () => {
    // With 4h/day the duration should be strictly greater — ceil may mean it's not exactly 2×
    expect(half.rollup.calculatedDurationDays).toBeGreaterThan(full.rollup.calculatedDurationDays);
  });

  it('half day (4h) duration is at least 1.5× full day (8h) duration', () => {
    // ceil math prevents exact 2× — 1.5× is a safe lower bound
    expect(half.rollup.calculatedDurationDays).toBeGreaterThanOrEqual(
      full.rollup.calculatedDurationDays * 1.5,
    );
  });

  it('4h/day calculatedDurationDays = ceil(totalMH / (4 crew × 4h))', () => {
    const mh = half.rollup.totalManHours;
    const expected = Math.ceil(mh / (4 * 4));
    expect(half.rollup.calculatedDurationDays).toBe(expected);
  });

  it('man-hours are the same regardless of hoursPerDay', () => {
    expect(full.rollup.totalManHours).toBeCloseTo(half.rollup.totalManHours, 6);
  });
});

// ── 3. Duration override wins over calculated duration ────────────────────────

describe('Duration override wins over calculated duration', () => {
  const noOverride = instantiateFromAssemblySpec({
    assembly: ASSEMBLY_PLACE_SLAB_ON_GRADE,
    userInputs: SLAB_INPUTS,
    division: DIV03_CONCRETE,
    lineItemTemplates: PLACE_SLAB_ON_GRADE_LINE_ITEMS,
    productionRates: RATE_MAP,
    projectId: 'proj-override-test',
    crewSize: 4,
    hoursPerDay: 8,
  });

  const OVERRIDE_DAYS = 99;
  const withOverride = instantiateFromAssemblySpec({
    assembly: ASSEMBLY_PLACE_SLAB_ON_GRADE,
    userInputs: SLAB_INPUTS,
    division: DIV03_CONCRETE,
    lineItemTemplates: PLACE_SLAB_ON_GRADE_LINE_ITEMS,
    productionRates: RATE_MAP,
    projectId: 'proj-override-test',
    crewSize: 4,
    hoursPerDay: 8,
    durationDaysOverride: OVERRIDE_DAYS,
  });

  it('effectiveDurationDays equals override when override is set', () => {
    expect(withOverride.projectActivity.effectiveDurationDays).toBe(OVERRIDE_DAYS);
  });

  it('effectiveDurationDays equals calculatedDurationDays when no override', () => {
    expect(noOverride.projectActivity.effectiveDurationDays).toBe(
      noOverride.projectActivity.calculatedDurationDays,
    );
  });

  it('override does NOT change calculatedDurationDays', () => {
    // calculatedDurationDays should be the same regardless of override
    expect(withOverride.projectActivity.calculatedDurationDays).toBe(
      noOverride.projectActivity.calculatedDurationDays,
    );
  });

  it('override does NOT change totalManHours', () => {
    expect(withOverride.rollup.totalManHours).toBeCloseTo(noOverride.rollup.totalManHours, 6);
  });

  it('rollup.effectiveDurationDays also reflects the override', () => {
    expect(withOverride.rollup.effectiveDurationDays).toBe(OVERRIDE_DAYS);
  });
});

// ── 4. Line item man-hours unchanged when crew size changes ───────────────────

describe('Line item man-hours are independent of crew size', () => {
  const crew1 = instantiateFromAssemblySpec({
    assembly: ASSEMBLY_PLACE_SLAB_ON_GRADE,
    userInputs: SLAB_INPUTS,
    division: DIV03_CONCRETE,
    lineItemTemplates: PLACE_SLAB_ON_GRADE_LINE_ITEMS,
    productionRates: RATE_MAP,
    projectId: 'proj-lineitem-test',
    crewSize: 1,
    hoursPerDay: 8,
  });

  const crew8 = instantiateFromAssemblySpec({
    assembly: ASSEMBLY_PLACE_SLAB_ON_GRADE,
    userInputs: SLAB_INPUTS,
    division: DIV03_CONCRETE,
    lineItemTemplates: PLACE_SLAB_ON_GRADE_LINE_ITEMS,
    productionRates: RATE_MAP,
    projectId: 'proj-lineitem-test',
    crewSize: 8,
    hoursPerDay: 8,
  });

  it('same number of line items regardless of crew size', () => {
    expect(crew8.projectLineItems.length).toBe(crew1.projectLineItems.length);
  });

  it('each line item has the same calculatedManHours for crew=1 vs crew=8', () => {
    for (let i = 0; i < crew1.projectLineItems.length; i++) {
      expect(crew8.projectLineItems[i].calculatedManHours).toBeCloseTo(
        crew1.projectLineItems[i].calculatedManHours, 6,
      );
    }
  });

  it('line items are not schedule activities regardless of crew size', () => {
    for (const li of crew8.projectLineItems) {
      expect((li as Record<string, unknown>).scheduleEnabled).toBeUndefined();
    }
  });
});

// ── 5. Schedule adapter uses effectiveDurationDays ────────────────────────────

describe('Schedule adapter uses effectiveDurationDays', () => {
  const OVERRIDE_DAYS = 7;
  const result = instantiateFromAssemblySpec({
    assembly: ASSEMBLY_PLACE_SLAB_ON_GRADE,
    userInputs: SLAB_INPUTS,
    division: DIV03_CONCRETE,
    lineItemTemplates: PLACE_SLAB_ON_GRADE_LINE_ITEMS,
    productionRates: RATE_MAP,
    projectId: 'proj-sched-test',
    crewSize: 4,
    hoursPerDay: 8,
    durationDaysOverride: OVERRIDE_DAYS,
  });

  const { activities: scheduleActivities } = constructionActivitiesToScheduleActivities([
    result.projectActivity,
  ]);

  it('adapter produces one schedule activity', () => {
    expect(scheduleActivities).toHaveLength(1);
  });

  it('schedule activity durationDays = effectiveDurationDays (override)', () => {
    expect(scheduleActivities[0].durationDays).toBe(OVERRIDE_DAYS);
  });

  it('schedule activity durationDays != calculatedDurationDays when override set', () => {
    expect(scheduleActivities[0].durationDays).not.toBe(
      result.projectActivity.calculatedDurationDays,
    );
  });

  // Without override — should use calculatedDurationDays
  const noOverrideResult = instantiateFromAssemblySpec({
    assembly: ASSEMBLY_PLACE_SLAB_ON_GRADE,
    userInputs: SLAB_INPUTS,
    division: DIV03_CONCRETE,
    lineItemTemplates: PLACE_SLAB_ON_GRADE_LINE_ITEMS,
    productionRates: RATE_MAP,
    projectId: 'proj-sched-test-2',
    crewSize: 4,
    hoursPerDay: 8,
  });

  const { activities: noOverrideSchedule } = constructionActivitiesToScheduleActivities([
    noOverrideResult.projectActivity,
  ]);

  it('without override: schedule durationDays = calculatedDurationDays', () => {
    expect(noOverrideSchedule[0].durationDays).toBe(
      noOverrideResult.projectActivity.calculatedDurationDays,
    );
  });
});

// ── 6. Earthwork assembly: crew size / duration round-trip ────────────────────

describe('Clear and Grub: crew size and hours per day affect duration', () => {
  const small = instantiateFromAssemblySpec({
    assembly: ASSEMBLY_CLEAR_AND_GRUB,
    userInputs: { siteAcres: 1.0 },
    division: DIV31_EARTHWORK,
    lineItemTemplates: CLEAR_AND_GRUB_LINE_ITEMS,
    productionRates: RATE_MAP,
    projectId: 'proj-earthwork-crew',
    crewSize: 2,
    hoursPerDay: 8,
  });

  const large = instantiateFromAssemblySpec({
    assembly: ASSEMBLY_CLEAR_AND_GRUB,
    userInputs: { siteAcres: 1.0 },
    division: DIV31_EARTHWORK,
    lineItemTemplates: CLEAR_AND_GRUB_LINE_ITEMS,
    productionRates: RATE_MAP,
    projectId: 'proj-earthwork-crew',
    crewSize: 8,
    hoursPerDay: 8,
  });

  it('larger crew produces shorter or equal duration', () => {
    expect(large.rollup.calculatedDurationDays).toBeLessThanOrEqual(
      small.rollup.calculatedDurationDays,
    );
  });

  it('man-hours are the same regardless of crew', () => {
    expect(small.rollup.totalManHours).toBeCloseTo(large.rollup.totalManHours, 6);
  });

  it('formula holds for large crew: ceil(MH / (8 crew × 8h))', () => {
    const expected = Math.ceil(large.rollup.totalManHours / (8 * 8));
    expect(large.rollup.calculatedDurationDays).toBe(expected);
  });
});
