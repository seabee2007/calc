import { describe, expect, it } from 'vitest';
import {
  DIV03_CONCRETE_SEED,
  PLACE_SLAB_ON_GRADE_ACTIVITY,
  PLACE_SLAB_ON_GRADE_LINE_ITEMS,
} from '../data/div03ConcreteSeeds';
import { calculateActivityManHours, calculateLineItemManHours } from '../domain/constructionActivityCalculations';
import {
  createSampleSlabOnGradeActivity,
  findActivityTemplateById,
  findProductionRateById,
  getLineItemTemplatesForActivity,
  instantiateConstructionActivity,
  isScheduleActivityLineItem,
  isSchedulableConstructionActivity,
} from '../domain/constructionActivityInstantiation';
import type { ActivityLineItemTemplate } from '../domain/constructionActivityTypes';

function cloneSeedSnapshot() {
  return {
    activity: structuredClone(PLACE_SLAB_ON_GRADE_ACTIVITY),
    lineItems: structuredClone([...PLACE_SLAB_ON_GRADE_LINE_ITEMS]),
    division: structuredClone(DIV03_CONCRETE_SEED.division),
  };
}

describe('constructionActivityInstantiation', () => {
  it('lookup helpers resolve seed records', () => {
    const rate = findProductionRateById(
      DIV03_CONCRETE_SEED.productionRates,
      '03-31-05.70-0320',
    );
    expect(rate?.unit).toBe('CYD');

    const template = findActivityTemplateById(
      [PLACE_SLAB_ON_GRADE_ACTIVITY],
      PLACE_SLAB_ON_GRADE_ACTIVITY.id,
    );
    expect(template?.name).toBe('Place Slab on Grade');

    const lineItems = getLineItemTemplatesForActivity(
      PLACE_SLAB_ON_GRADE_LINE_ITEMS,
      PLACE_SLAB_ON_GRADE_ACTIVITY.id,
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
    expect(result.projectActivity.templateId).toBe(PLACE_SLAB_ON_GRADE_ACTIVITY.id);
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
      division: DIV03_CONCRETE_SEED.division,
      template: PLACE_SLAB_ON_GRADE_ACTIVITY,
      lineItemTemplates: PLACE_SLAB_ON_GRADE_LINE_ITEMS,
      productionRates: DIV03_CONCRETE_SEED.productionRates,
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
      constructionActivityTemplateId: PLACE_SLAB_ON_GRADE_ACTIVITY.id,
      name: 'Bad rate line',
      unit: 'EA',
      productionRateId: 'missing-rate-id',
      defaultManHoursPerUnit: 0.5,
      sortOrder: 99,
    };

    const result = instantiateConstructionActivity({
      projectId: 'project-1',
      division: DIV03_CONCRETE_SEED.division,
      template: PLACE_SLAB_ON_GRADE_ACTIVITY,
      lineItemTemplates: [badTemplate],
      productionRates: DIV03_CONCRETE_SEED.productionRates,
      quantityMap: { 'ali-bad-rate': 10 },
      crewSize: 2,
    });

    expect(result.projectLineItems[0]?.productionRateId).toBeNull();
    expect(result.projectLineItems[0]?.sourceProductionRateKey).toBe('missing-rate-id');
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

    // Manual-sourced rates (NTRP 4-04.2.3 / TM 3-34.41 / MCRP 3-40D.12)
    const expectedManHours =
      calculateLineItemManHours(200, 0.071) +    // edge forms LF  (Fig 5-C-7,  03 11 13.65 line 0040)
      calculateLineItemManHours(3200, 0.002) +   // vapor barrier  (Fig 5-C-9,  03 15 05.96 line 0220)
      calculateLineItemManHours(3200, 0.008) +   // WWF SF         (Fig 5-C-11, 03 22 05.50 line 0010)
      calculateLineItemManHours(32, 0.738) +     // place concrete (Fig 5-C-14, 03 31 05.70 line 0320)
      calculateLineItemManHours(3200, 0.028) +   // finish SF      (Fig 5-C-15, 03 35 29.30 line 0040)
      calculateLineItemManHours(3200, 0.0017) +  // cure SF        (Fig 5-C-15, 03 39 23.13 line 0010)
      calculateLineItemManHours(160, 0.014);     // sawcut LF      (Fig 5-C-15, 03 35 29.35 line 0010)

    // 14.2 + 6.4 + 25.6 + 23.616 + 89.6 + 5.44 + 2.24 = 167.096 MH
    // duration = ceil(167.096 / (4 crew × 8 h/day)) = ceil(5.22) = 6 days
    expect(calculateActivityManHours(result.projectLineItems)).toBeCloseTo(expectedManHours, 5);
    expect(result.rollup.totalManHours).toBeCloseTo(expectedManHours, 5);
    expect(result.rollup.calculatedDurationDays).toBe(6);
    expect(result.rollup.effectiveDurationDays).toBe(result.rollup.durationDays);
  });

  it('resolves quantities by productionRateId when template id is absent', () => {
    const result = instantiateConstructionActivity({
      projectId: 'project-1',
      division: DIV03_CONCRETE_SEED.division,
      template: PLACE_SLAB_ON_GRADE_ACTIVITY,
      lineItemTemplates: PLACE_SLAB_ON_GRADE_LINE_ITEMS,
      productionRates: DIV03_CONCRETE_SEED.productionRates,
      quantityMap: {
        '03-31-05.70-0320': 25,
      },
      crewSize: 4,
    });

    const placeConcrete = result.projectLineItems.find((li) => li.name === 'Place concrete');
    expect(placeConcrete?.quantity).toBe(25);
  });
});
