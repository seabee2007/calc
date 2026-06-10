import { describe, expect, it } from 'vitest';
import {
  SEABEE_DIVISION_03_CONCRETE_SEED,
  SEABEE_PLACE_SLAB_ON_GRADE_ACTIVITY,
  SEABEE_PLACE_SLAB_ON_GRADE_LINE_ITEMS,
} from '../data/seabeeConcreteSeeds';
import { calculateActivityManHours, calculateLineItemManHours } from '../domain/seabeeActivityCalculations';
import {
  createSampleSlabOnGradeActivity,
  findActivityTemplateById,
  findProductionRateById,
  getLineItemTemplatesForActivity,
  instantiateConstructionActivity,
  isScheduleActivityLineItem,
  isSchedulableConstructionActivity,
} from '../domain/seabeeActivityInstantiation';
import type { ActivityLineItemTemplate } from '../domain/seabeeActivityTypes';

function cloneSeedSnapshot() {
  return {
    activity: structuredClone(SEABEE_PLACE_SLAB_ON_GRADE_ACTIVITY),
    lineItems: structuredClone([...SEABEE_PLACE_SLAB_ON_GRADE_LINE_ITEMS]),
    division: structuredClone(SEABEE_DIVISION_03_CONCRETE_SEED.division),
  };
}

describe('seabeeActivityInstantiation', () => {
  it('lookup helpers resolve seed records', () => {
    const rate = findProductionRateById(
      SEABEE_DIVISION_03_CONCRETE_SEED.productionRates,
      '03-31-00-slab-on-grade-pump',
    );
    expect(rate?.unit).toBe('CY');

    const template = findActivityTemplateById(
      [SEABEE_PLACE_SLAB_ON_GRADE_ACTIVITY],
      SEABEE_PLACE_SLAB_ON_GRADE_ACTIVITY.id,
    );
    expect(template?.name).toBe('Place Slab on Grade');

    const lineItems = getLineItemTemplatesForActivity(
      SEABEE_PLACE_SLAB_ON_GRADE_LINE_ITEMS,
      SEABEE_PLACE_SLAB_ON_GRADE_ACTIVITY.id,
    );
    expect(lineItems).toHaveLength(7);
    expect(lineItems[0]?.sortOrder).toBe(1);
  });

  it('instantiates Place Slab on Grade with one activity and seven line items', () => {
    const result = createSampleSlabOnGradeActivity('project-abc', {
      slabAreaSf: 3200,
      slabConcreteCy: 32,
      slabPerimeterLf: 200,
      controlJointLf: 160,
      crewSize: 4,
    });

    expect(result.projectActivity.projectId).toBe('project-abc');
    expect(result.projectActivity.divisionCode).toBe('03');
    expect(result.projectActivity.code).toBe('03-01-01');
    expect(result.projectActivity.name).toBe('Place Slab on Grade');
    expect(result.projectActivity.templateId).toBe(SEABEE_PLACE_SLAB_ON_GRADE_ACTIVITY.id);
    expect(result.projectLineItems).toHaveLength(7);
    expect(result.projectLineItems.every((li) => li.constructionActivityId === result.projectActivity.id)).toBe(
      true,
    );
  });

  it('project activity is schedule-enabled and line items are not schedule activities', () => {
    const result = createSampleSlabOnGradeActivity('project-abc', {
      slabAreaSf: 100,
      slabConcreteCy: 10,
      slabPerimeterLf: 50,
      controlJointLf: 40,
    });

    expect(isSchedulableConstructionActivity(result.projectActivity)).toBe(true);
    expect(result.projectActivity.scheduleEnabled).toBe(true);
    for (const lineItem of result.projectLineItems) {
      expect(isScheduleActivityLineItem(lineItem)).toBe(false);
    }
  });

  it('missing quantities default to 0 and produce warnings', () => {
    const result = instantiateConstructionActivity({
      projectId: 'project-1',
      division: SEABEE_DIVISION_03_CONCRETE_SEED.division,
      template: SEABEE_PLACE_SLAB_ON_GRADE_ACTIVITY,
      lineItemTemplates: SEABEE_PLACE_SLAB_ON_GRADE_LINE_ITEMS,
      productionRates: SEABEE_DIVISION_03_CONCRETE_SEED.productionRates,
      quantityMap: {},
      crewSize: 4,
    });

    expect(result.projectLineItems.every((li) => li.quantity === 0)).toBe(true);
    expect(result.rollup.totalManHours).toBe(0);
    expect(result.rollup.warnings.filter((w) => w.includes('defaulting to 0'))).toHaveLength(7);
  });

  it('production factor applies to every generated line item', () => {
    const baseline = createSampleSlabOnGradeActivity('project-1', {
      slabAreaSf: 1000,
      slabConcreteCy: 10,
      slabPerimeterLf: 100,
      controlJointLf: 80,
      crewSize: 4,
      productionFactor: 1,
    });

    const adjusted = createSampleSlabOnGradeActivity('project-1', {
      slabAreaSf: 1000,
      slabConcreteCy: 10,
      slabPerimeterLf: 100,
      controlJointLf: 80,
      crewSize: 4,
      productionFactor: 1.25,
    });

    expect(adjusted.projectLineItems.every((li) => li.productionFactor === 1.25)).toBe(true);
    expect(adjusted.rollup.totalManHours).toBeGreaterThan(baseline.rollup.totalManHours);
  });

  it('duration override does not destroy calculated duration', () => {
    const result = createSampleSlabOnGradeActivity('project-1', {
      slabAreaSf: 3200,
      slabConcreteCy: 32,
      slabPerimeterLf: 200,
      controlJointLf: 160,
      crewSize: 4,
      durationDaysOverride: 10,
    });

    expect(result.rollup.calculatedDurationDays).toBeGreaterThan(0);
    expect(result.rollup.calculatedDurationDays).not.toBe(10);
    expect(result.rollup.effectiveDurationDays).toBe(10);
    expect(result.rollup.durationDays).toBe(10);
  });

  it('does not mutate seed or template objects', () => {
    const before = cloneSeedSnapshot();

    createSampleSlabOnGradeActivity('project-1', {
      slabAreaSf: 500,
      slabConcreteCy: 12,
      slabPerimeterLf: 90,
      controlJointLf: 70,
      activityTitleOverride: 'Custom Slab Title',
    });

    const after = cloneSeedSnapshot();
    expect(after).toEqual(before);
  });

  it('handles invalid productionRateId safely with a warning', () => {
    const badTemplate: ActivityLineItemTemplate = {
      id: 'ali-bad-rate',
      constructionActivityTemplateId: SEABEE_PLACE_SLAB_ON_GRADE_ACTIVITY.id,
      name: 'Bad rate line',
      unit: 'EA',
      productionRateId: 'missing-rate-id',
      defaultManHoursPerUnit: 0.5,
      sortOrder: 99,
    };

    const result = instantiateConstructionActivity({
      projectId: 'project-1',
      division: SEABEE_DIVISION_03_CONCRETE_SEED.division,
      template: SEABEE_PLACE_SLAB_ON_GRADE_ACTIVITY,
      lineItemTemplates: [badTemplate],
      productionRates: SEABEE_DIVISION_03_CONCRETE_SEED.productionRates,
      quantityMap: { 'ali-bad-rate': 10 },
      crewSize: 2,
    });

    expect(result.projectLineItems[0]?.manHoursPerUnit).toBe(0.5);
    expect(result.rollup.warnings.some((w) => w.includes('missing-rate-id'))).toBe(true);
    expect(result.rollup.totalManHours).toBe(calculateLineItemManHours(10, 0.5, 1));
  });

  it('rollup totals match expected sum for sample slab inputs', () => {
    const result = createSampleSlabOnGradeActivity('project-1', {
      slabAreaSf: 3200,
      slabConcreteCy: 32,
      slabPerimeterLf: 200,
      controlJointLf: 160,
      crewSize: 4,
    });

    const expectedManHours =
      calculateLineItemManHours(200, 0.12) +
      calculateLineItemManHours(3200, 0.004) +
      calculateLineItemManHours(3200, 0.005) +
      calculateLineItemManHours(32, 0.286) +
      calculateLineItemManHours(3200, 0.016) +
      calculateLineItemManHours(3200, 0.002) +
      calculateLineItemManHours(160, 0.025);

    expect(calculateActivityManHours(result.projectLineItems)).toBeCloseTo(expectedManHours, 5);
    expect(result.rollup.totalManHours).toBeCloseTo(expectedManHours, 5);
    expect(result.rollup.calculatedDurationDays).toBe(4);
    expect(result.rollup.effectiveDurationDays).toBe(result.rollup.durationDays);
  });

  it('resolves quantities by productionRateId when template id is absent', () => {
    const result = instantiateConstructionActivity({
      projectId: 'project-1',
      division: SEABEE_DIVISION_03_CONCRETE_SEED.division,
      template: SEABEE_PLACE_SLAB_ON_GRADE_ACTIVITY,
      lineItemTemplates: SEABEE_PLACE_SLAB_ON_GRADE_LINE_ITEMS,
      productionRates: SEABEE_DIVISION_03_CONCRETE_SEED.productionRates,
      quantityMap: {
        '03-31-00-slab-on-grade-pump': 25,
      },
      crewSize: 4,
    });

    const placeConcrete = result.projectLineItems.find((li) => li.name === 'Place concrete');
    expect(placeConcrete?.quantity).toBe(25);
  });
});
