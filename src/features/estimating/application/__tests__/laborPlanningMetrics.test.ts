import { describe, expect, it } from 'vitest';
import type { ProjectConstructionActivity } from '../../domain/constructionActivityTypes';
import type { ScheduleActivity } from '../../scheduling/adapters/estimateLineItemsToScheduleActivities';
import type { CpmActivityResult } from '../../scheduling/cpmTypes';
import { calculateLaborPlanningMetrics } from '../laborPlanningMetrics';
import {
  buildEstimateTotalsReviewFromConstructionActivities,
  resolveEstimateTotalsReview,
} from '../../ui/estimateTotalsDisplay';
import { DEFAULT_ESTIMATE_SETTINGS } from '../estimateSettings';

function makeActivity(
  overrides: Partial<ProjectConstructionActivity> = {},
): ProjectConstructionActivity {
  return {
    id: 'act-1',
    projectId: 'project-1',
    divisionCode: '03',
    divisionName: 'Concrete',
    activityCode: '03-01-01',
    title: 'Place Slab',
    scheduleEnabled: true,
    crewSize: 4,
    hoursPerDay: 8,
    productionFactor: 1,
    calculatedManHours: 28.4,
    effectiveDurationDays: 1,
    totalLaborCost: 1000,
    ...overrides,
  };
}

function makeScheduleActivity(overrides: Partial<ScheduleActivity> = {}): ScheduleActivity {
  return {
    activityCode: '03-01-01',
    activityDescription: 'Place Slab',
    divisionCode: '03',
    divisionName: 'Concrete',
    durationDays: 1,
    laborHours: 28.4,
    manDays: 3.55,
    crewDays: 0.8875,
    crewSize: 4,
    totalCost: 1000,
    relationshipType: 'FS',
    lagDays: 0,
    ...overrides,
  };
}

describe('calculateLaborPlanningMetrics', () => {
  it('computes man-days from labor hours / 8 when no hoursPerDay setting exists', () => {
    const result = calculateLaborPlanningMetrics({
      laborHours: 85.3,
    });

    expect(result.laborHours).toBe(85.3);
    expect(result.manDays).toBeCloseTo(10.6625, 4);
  });

  it('uses project/company hoursPerDay when available', () => {
    const result = calculateLaborPlanningMetrics({
      laborHours: 85.3,
      hoursPerDay: 10,
    });

    expect(result.manDays).toBeCloseTo(8.53, 4);
  });

  it('computes crew-days from durationDays * crewSize on schedule activities', () => {
    const result = calculateLaborPlanningMetrics({
      laborHours: 85.3,
      scheduleActivities: [
        makeScheduleActivity({ activityCode: 'A', durationDays: 2, crewSize: 4 }),
        makeScheduleActivity({ activityCode: 'B', durationDays: 1, crewSize: 3 }),
        makeScheduleActivity({ activityCode: 'C', durationDays: 1, crewSize: 2 }),
      ],
    });

    expect(result.crewDays).toBe(2 * 4 + 1 * 3 + 1 * 2);
  });

  it('falls back crew-days to man-days when crew size data is unavailable', () => {
    const result = calculateLaborPlanningMetrics({
      laborHours: 80,
      scheduleActivities: [
        makeScheduleActivity({ durationDays: 2, crewSize: 0 }),
      ],
    });

    expect(result.crewDays).toBe(10);
  });

  it('uses CPM project duration when available', () => {
    const result = calculateLaborPlanningMetrics({
      laborHours: 85.3,
      projectDurationDays: 4,
      scheduleActivities: [
        makeScheduleActivity({ durationDays: 2, crewSize: 4 }),
        makeScheduleActivity({ activityCode: 'B', durationDays: 1, crewSize: 3 }),
        makeScheduleActivity({ activityCode: 'C', durationDays: 1, crewSize: 2 }),
      ],
    });

    expect(result.estimatedDurationDays).toBe(4);
  });

  it('falls back estimated duration to CPM ES/EF span when projectDurationDays is missing', () => {
    const cpmActivities: CpmActivityResult[] = [
      {
        activityCode: 'A',
        earlyStart: 0,
        earlyFinish: 2,
        lateStart: 0,
        lateFinish: 2,
        totalFloat: 0,
        freeFloat: 0,
        isCritical: true,
      },
      {
        activityCode: 'B',
        earlyStart: 2,
        earlyFinish: 4,
        lateStart: 2,
        lateFinish: 4,
        totalFloat: 0,
        freeFloat: 0,
        isCritical: true,
      },
    ];

    const result = calculateLaborPlanningMetrics({
      laborHours: 85.3,
      cpmActivities,
    });

    expect(result.estimatedDurationDays).toBe(4);
  });

  it('uses headcount crew-days (duration × crew size), not Schedule Preview labor crew-days', () => {
    const scheduleActivities = [
      makeScheduleActivity({ activityCode: 'A', durationDays: 2, crewSize: 4, laborHours: 28.4, manDays: 3.55 }),
      makeScheduleActivity({ activityCode: 'B', durationDays: 1, crewSize: 3, laborHours: 28.4, manDays: 3.55 }),
      makeScheduleActivity({ activityCode: 'C', durationDays: 1, crewSize: 2, laborHours: 28.5, manDays: 3.5625 }),
    ];

    const headcountCrewDays = calculateLaborPlanningMetrics({
      laborHours: 85.3,
      scheduleActivities,
      projectDurationDays: 4,
    }).crewDays;

    const laborCrewDays = scheduleActivities.reduce(
      (sum, activity) => sum + activity.manDays / activity.crewSize,
      0,
    );
    const expectedLaborCrewDays = 3.55 / 4 + 3.55 / 3 + 3.5625 / 2;

    expect(headcountCrewDays).toBe(13);
    expect(laborCrewDays).toBeCloseTo(expectedLaborCrewDays, 2);
    expect(headcountCrewDays).not.toBeCloseTo(laborCrewDays, 1);
  });

  it('matches the 3-activity / 85.3 hr / 4d fixture', () => {
    const activities = [
      makeActivity({ id: 'a', activityCode: 'A', calculatedManHours: 28.4, effectiveDurationDays: 2, crewSize: 4 }),
      makeActivity({ id: 'b', activityCode: 'B', calculatedManHours: 28.4, effectiveDurationDays: 1, crewSize: 3 }),
      makeActivity({ id: 'c', activityCode: 'C', calculatedManHours: 28.5, effectiveDurationDays: 1, crewSize: 2 }),
    ];
    const scheduleActivities = [
      makeScheduleActivity({ activityCode: 'A', durationDays: 2, crewSize: 4, laborHours: 28.4 }),
      makeScheduleActivity({ activityCode: 'B', durationDays: 1, crewSize: 3, laborHours: 28.4 }),
      makeScheduleActivity({ activityCode: 'C', durationDays: 1, crewSize: 2, laborHours: 28.5 }),
    ];

    const result = calculateLaborPlanningMetrics({
      laborHours: 85.3,
      activities,
      scheduleActivities,
      projectDurationDays: 4,
    });

    expect(result.laborHours).toBe(85.3);
    expect(result.manDays).toBeCloseTo(10.6625, 2);
    expect(result.crewDays).toBe(13);
    expect(result.estimatedDurationDays).toBe(4);
  });
});

describe('buildEstimateTotalsReviewFromConstructionActivities labor planning', () => {
  it('wires schedule rollup into labor metrics without changing cost totals', () => {
    const activities = [
      makeActivity({ calculatedManHours: 28.4, totalLaborCost: 1000 }),
      makeActivity({
        id: 'act-2',
        activityCode: '03-01-02',
        calculatedManHours: 28.4,
        totalLaborCost: 500,
      }),
      makeActivity({
        id: 'act-3',
        activityCode: '03-01-03',
        calculatedManHours: 28.5,
        totalLaborCost: 500,
      }),
    ];

    const review = buildEstimateTotalsReviewFromConstructionActivities(
      activities,
      DEFAULT_ESTIMATE_SETTINGS,
      undefined,
      undefined,
      undefined,
      {
        projectDurationDays: 4,
        scheduleActivities: [
          makeScheduleActivity({ activityCode: 'A', durationDays: 2, crewSize: 4 }),
          makeScheduleActivity({ activityCode: 'B', durationDays: 1, crewSize: 3 }),
          makeScheduleActivity({ activityCode: 'C', durationDays: 1, crewSize: 2 }),
        ],
      },
    );

    expect(review.laborMetrics.laborHours).toBeCloseTo(85.3, 1);
    expect(review.laborMetrics.manDays).toBeCloseTo(10.6625, 2);
    expect(review.laborMetrics.crewDays).toBe(13);
    expect(review.laborMetrics.durationDays).toBe(4);
    expect(review.costGroups.labor).toBe(2000);
    expect(review.costGroups.materials).toBe(0);
    expect(review.costGroups.equipment).toBe(0);
  });
});

describe('resolveEstimateTotalsReview schedule wiring', () => {
  it('passes schedule data through to labor metrics', () => {
    const review = resolveEstimateTotalsReview({
      version: null,
      estimateType: 'detailed',
      constructionActivities: [makeActivity({ calculatedManHours: 85.3, totalLaborCost: 1000 })],
      markupSettings: DEFAULT_ESTIMATE_SETTINGS,
      scheduleActivities: [makeScheduleActivity({ durationDays: 4, crewSize: 4 })],
      projectDurationDays: 4,
    });

    expect(review.laborMetrics.laborHours).toBe(85.3);
    expect(review.laborMetrics.durationDays).toBe(4);
    expect(review.laborMetrics.manDays).toBeCloseTo(10.6625, 2);
  });
});
