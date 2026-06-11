import { describe, expect, it } from 'vitest';
import { ASSEMBLY_PLACE_CONTINUOUS_FOOTING } from '../data/activityAssemblyRegistry';
import {
  assignProjectActivityCode,
  buildConstructionActivityDisplayTitle,
  countTemplateInstances,
  generateNextProjectActivityCode,
  validateInstanceLabelForDuplicateTemplate,
} from '../application/constructionActivityCoding';
import { constructionActivitiesToScheduleActivities } from '../scheduling/adapters/constructionActivitiesToScheduleActivities';
import { reconcileLogicLinksWithScheduleActivities } from '../scheduling/scheduleAssumptions';
import { getProjectActivityLineItemWarning, isProjectActivityLineItemValid } from '../domain/constructionActivityCalculations';
import type { CpmLogicLink } from '../scheduling/cpmTypes';
import type { ProjectActivityLineItem, ProjectConstructionActivity } from '../domain/constructionActivityTypes';

function makeActivity(
  overrides: Partial<ProjectConstructionActivity> & { id: string; activityCode: string },
): ProjectConstructionActivity {
  return {
    projectId: 'proj-1',
    divisionCode: '03',
    divisionName: 'Concrete',
    title: overrides.title ?? 'Place Continuous Footing',
    scheduleEnabled: true,
    crewSize: 4,
    hoursPerDay: 8,
    productionFactor: 1,
    sourceTemplateKey: 'ca-03-place-continuous-footing',
    effectiveDurationDays: 3,
    calculatedDurationDays: 3,
    ...overrides,
  };
}

describe('construction activity instance coding', () => {
  it('assigns the first Concrete project activity as 03-01-01', () => {
    const assigned = generateNextProjectActivityCode({
      divisionCode: '03',
      existingActivities: [],
      preferredCategoryKey: 'concrete:slab-on-grade',
      preferredTitle: 'Slab on grade, Forms in Place',
    });

    expect(assigned.activityCode).toBe('03-01-01');
  });

  it('assigns unique DD-AA-II codes for duplicate templates', () => {
    const existing = [
      makeActivity({
        id: 'a1',
        activityCode: '03-02-01',
        sourceTemplateKey: 'ca-03-place-continuous-footing',
        activitySequence: 2,
        instanceSequence: 1,
      }),
    ];

    const second = assignProjectActivityCode({
      existingActivities: existing,
      divisionCode: '03',
      sourceTemplateKey: 'ca-03-place-continuous-footing',
      templateMasterCode: '03-02-01',
      identity: {
        activityName: 'Place Continuous Footing',
        instanceLabel: 'F-2',
      },
    });

    expect(second.activityCode).toBe('03-02-02');
    expect(second.title).toBe('Place Continuous Footing — F-2');
  });

  it('adds the same template twice with unique project activity codes', () => {
    const existing = [
      makeActivity({
        id: 'a1',
        activityCode: '03-01-01',
        sourceTemplateKey: 'concrete:slab-on-grade',
        activitySequence: 1,
        instanceSequence: 1,
      }),
    ];

    const second = generateNextProjectActivityCode({
      divisionCode: '03',
      existingActivities: existing,
      preferredCategoryKey: 'concrete:slab-on-grade',
      preferredTitle: 'Slab on grade, Forms in Place',
    });

    expect(second.activityCode).toBe('03-01-02');
  });

  it('adds a different Concrete category without duplicating 03-01-01', () => {
    const existing = [
      makeActivity({
        id: 'a1',
        activityCode: '03-01-01',
        sourceTemplateKey: 'concrete:slab-on-grade',
        activitySequence: 1,
        instanceSequence: 1,
      }),
    ];

    const nextCategory = generateNextProjectActivityCode({
      divisionCode: '03',
      existingActivities: existing,
      preferredCategoryKey: 'concrete:walls',
      preferredTitle: 'Walls, Forms in Place',
    });

    expect(nextCategory.activityCode).toBe('03-02-01');
  });

  it('starts Division 09 activities independently at 09-01-01', () => {
    const division09 = generateNextProjectActivityCode({
      divisionCode: '09',
      existingActivities: [
        makeActivity({
          id: 'a1',
          activityCode: '03-01-01',
          sourceTemplateKey: 'concrete:slab-on-grade',
        }),
      ],
      preferredCategoryKey: 'finishes:drywall',
      preferredTitle: 'Drywall',
    });

    expect(division09.activityCode).toBe('09-01-01');
  });

  it('fills gaps for repeated instances in the same category', () => {
    const existing = [
      makeActivity({
        id: 'a1',
        activityCode: '03-01-01',
        sourceTemplateKey: 'concrete:slab-on-grade',
        activitySequence: 1,
        instanceSequence: 1,
      }),
      makeActivity({
        id: 'a3',
        activityCode: '03-01-03',
        sourceTemplateKey: 'concrete:slab-on-grade',
        activitySequence: 1,
        instanceSequence: 3,
      }),
    ];

    const next = generateNextProjectActivityCode({
      divisionCode: '03',
      existingActivities: existing,
      preferredCategoryKey: 'concrete:slab-on-grade',
      preferredTitle: 'Slab on grade, Forms in Place',
    });

    expect(next.activityCode).toBe('03-01-02');
  });

  it('ignores an edited activity when checking for the next code', () => {
    const activity = makeActivity({
      id: 'stable-id',
      activityCode: '03-01-01',
      sourceTemplateKey: 'concrete:slab-on-grade',
      activitySequence: 1,
      instanceSequence: 1,
    });

    const assigned = generateNextProjectActivityCode({
      divisionCode: '03',
      existingActivities: [activity],
      preferredCategoryKey: 'concrete:slab-on-grade',
      preferredTitle: 'Slab on grade, Forms in Place',
      excludeActivityId: activity.id,
    });

    expect(assigned.activityCode).toBe('03-01-01');
  });

  it('builds display title with instance label', () => {
    expect(buildConstructionActivityDisplayTitle('Place Slab on Grade', 'Area C-2')).toBe(
      'Place Slab on Grade — Area C-2',
    );
  });

  it('requires instance label when duplicate template exists', () => {
    const existing = [
      makeActivity({ id: 'a1', activityCode: '03-02-01', sourceTemplateKey: 'ca-03-place-continuous-footing' }),
    ];
    expect(countTemplateInstances(existing, 'ca-03-place-continuous-footing')).toBe(1);
    expect(
      validateInstanceLabelForDuplicateTemplate({
        existingActivities: existing,
        sourceTemplateKey: 'ca-03-place-continuous-footing',
        instanceLabel: '',
      }),
    ).toContain('instance label');
  });

  it('preserves stable activity code when editing metadata', () => {
    const activity = makeActivity({
      id: 'stable-id',
      activityCode: '03-02-01',
      sourceTemplateKey: 'ca-03-place-continuous-footing',
    });
    const assigned = assignProjectActivityCode({
      existingActivities: [activity],
      divisionCode: '03',
      sourceTemplateKey: 'ca-03-place-continuous-footing',
      identity: { activityName: 'Place Continuous Footing', instanceLabel: 'F-1' },
      preserveActivityCode: activity.activityCode,
      excludeActivityId: activity.id,
    });
    expect(assigned.activityCode).toBe('03-02-01');
    expect(assigned.title).toBe('Place Continuous Footing — F-1');
  });
});

describe('construction activity instance schedule integration', () => {
  it('uses updated effectiveDurationDays in schedule adapter', () => {
    const activity = makeActivity({
      id: 'stable-id',
      activityCode: '03-02-01',
      effectiveDurationDays: 7,
      calculatedDurationDays: 3,
      durationDaysOverride: 7,
    });
    const { activities } = constructionActivitiesToScheduleActivities([activity]);
    expect(activities[0].durationDays).toBe(7);
    expect(activities[0].activityCode).toBe('03-02-01');
  });

  it('keeps logic network links when activity id/code stable after edit', () => {
    const pred = makeActivity({ id: 'pred-id', activityCode: '03-01-01' });
    const succ = makeActivity({
      id: 'uuid-1',
      activityCode: '03-02-01',
      effectiveDurationDays: 8,
      title: 'Place Continuous Footing — F-1',
    });
    const links: CpmLogicLink[] = [
      {
        predecessorActivityCode: '03-01-01',
        successorActivityCode: '03-02-01',
        relationshipType: 'FS',
        lagDays: 0,
        predecessorRuntimeId: 'pred-id',
        successorRuntimeId: 'uuid-1',
      },
    ];
    const afterSchedule = constructionActivitiesToScheduleActivities([pred, succ]).activities;
    const reconciled = reconcileLogicLinksWithScheduleActivities(links, afterSchedule);
    expect(reconciled.preservedCount).toBe(1);
    expect(reconciled.links[0].successorRuntimeId).toBe('uuid-1');
  });
});

describe('line item warning specificity', () => {
  it('accepts sourceProductionRateKey without production_rate_id FK', () => {
    const item = {
      id: 'li-1',
      projectActivityId: 'act-1',
      projectId: 'proj-1',
      name: 'Place concrete',
      unit: 'CYD',
      quantity: 10,
      manHoursPerUnit: 0.6,
      productionFactor: 1,
      calculatedManHours: 6,
      laborCost: 0,
      materialCost: 0,
      equipmentCost: 0,
      productionRateId: null,
      sourceProductionRateKey: '03-31-05.70-0130',
    } as ProjectActivityLineItem;
    expect(isProjectActivityLineItemValid(item)).toBe(true);
    expect(getProjectActivityLineItemWarning(item)).toBeNull();
  });

  it('reports missing quantity by line item name', () => {
    const item = {
      id: 'li-1',
      projectActivityId: 'act-1',
      projectId: 'proj-1',
      name: 'Form footing',
      unit: 'SF',
      quantity: 0,
      manHoursPerUnit: 0.1,
      productionFactor: 1,
      calculatedManHours: 0,
      laborCost: 0,
      materialCost: 0,
      equipmentCost: 0,
      sourceProductionRateKey: '03-11-13.45-0010',
    } as ProjectActivityLineItem;
    expect(getProjectActivityLineItemWarning(item)).toContain('Missing quantity');
    expect(getProjectActivityLineItemWarning(item)).toContain('Form footing');
  });
});

describe('assembly registry template master codes', () => {
  it('includes templateMasterCode for footing assembly', () => {
    expect(ASSEMBLY_PLACE_CONTINUOUS_FOOTING.templateMasterCode).toBe('03-02-01');
  });
});
