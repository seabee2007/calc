import { describe, expect, it } from 'vitest';
import type { ScheduleActivity } from '../adapters/estimateLineItemsToScheduleActivities';
import { buildValidCpmDisplayFields, type CpmLogicLink, type CpmResult } from '../cpmTypes';
import {
  buildActivityDetailsViewModel,
  resolveSelectedGanttActivityDetails,
} from '../activityDetailsModalData';
import { getLevelThreeGanttRows } from '../levelThreeGanttUtils';
import type { EstimateDomainTask } from '../../infrastructure/estimateDbTypes';

function makeActivity(code: string, duration = 3): ScheduleActivity {
  return {
    activityCode: code,
    activityDescription: `${code} description`,
    divisionCode: '01',
    divisionName: 'General Requirements',
    workPackageCode: '01-01',
    workPackageName: 'Mobilization',
    durationDays: duration,
    laborHours: 40,
    manDays: 5,
    crewDays: 2.5,
    crewSize: 2,
    totalCost: 12_500,
    relationshipType: 'FS',
    lagDays: 0,
  };
}

const sampleCpm: CpmResult = {
  activities: [
    {
      activityCode: '01-01-01',
      earlyStart: 0,
      earlyFinish: 3,
      lateStart: 0,
      lateFinish: 3,
      totalFloat: 0,
      freeFloat: 0,
      isCritical: true,
    },
    {
      activityCode: '01-02-01',
      earlyStart: 3,
      earlyFinish: 5,
      lateStart: 40,
      lateFinish: 42,
      totalFloat: 37,
      freeFloat: 37,
      isCritical: false,
    },
  ],
  projectDurationDays: 42,
  criticalPathActivityCodes: ['01-01-01'],
  warnings: [],
  ...buildValidCpmDisplayFields(['01-01-01'], {
    hasRunCpm: true,
    hasValidPrecedenceDiagram: true,
  }),
};

const lineItems: EstimateDomainTask[] = [
  {
    activityCode: '01-01-01',
    title: 'Permit coordination and kickoff',
    description: 'Coordinate permits before mobilization.',
    lineItem: {
      csiDivision: '01',
      quantity: { quantity: 1, unit: 'LS' },
      description: 'Permit coordination and kickoff',
    },
    relationshipType: 'FS',
    lagDays: 0,
    predecessorActivityCode: null,
    calculatedValues: {
      laborHours: 40,
      manDays: 5,
      crewDays: 2.5,
      costs: { directCost: 12_500, sellPrice: 15_000 },
    },
  } as EstimateDomainTask,
];

const logicLinks: CpmLogicLink[] = [
  {
    predecessorActivityCode: '01-01-01',
    successorActivityCode: '01-02-01',
    relationshipType: 'FS',
    lagDays: 0,
  },
];

describe('activityDetailsModalData', () => {
  it('buildActivityDetailsViewModel includes code, title, float, CPM, and cost data', () => {
    const details = buildActivityDetailsViewModel(
      makeActivity('01-01-01'),
      sampleCpm.activities[0],
      logicLinks,
      lineItems[0],
      sampleCpm,
    );

    expect(details.activityCode).toBe('01-01-01');
    expect(details.title).toBe('01-01-01 description');
    expect(details.estimatedFloat).toBe('0d');
    expect(details.earlyStart).toBe(0);
    expect(details.lateFinish).toBe(3);
    expect(details.totalFloat).toBe(0);
    expect(details.freeFloat).toBe(0);
    expect(details.isCritical).toBe(true);
    expect(details.crewSize).toBe(2);
    expect(details.laborHours).toBe(40);
    expect(details.totalCost).toBe(12_500);
    expect(details.predecessors).toBe('—');
    expect(details.notes).toBe('Coordinate permits before mobilization.');
  });

  it('resolveSelectedGanttActivityDetails returns details for critical activity bar click', () => {
    const rows = getLevelThreeGanttRows(
      [makeActivity('01-01-01'), makeActivity('01-02-01', 2)],
      sampleCpm,
      '2026-06-06',
    );
    const details = resolveSelectedGanttActivityDetails(
      '01-01-01',
      rows,
      logicLinks,
      lineItems,
      sampleCpm,
    );

    expect(details).not.toBeNull();
    expect(details?.activityCode).toBe('01-01-01');
    expect(details?.isCritical).toBe(true);
    expect(details?.estimatedFloat).toBe('0d');
  });

  it('resolveSelectedGanttActivityDetails returns details for noncritical activity bar click', () => {
    const rows = getLevelThreeGanttRows(
      [makeActivity('01-01-01'), makeActivity('01-02-01', 2)],
      sampleCpm,
      '2026-06-06',
    );
    const details = resolveSelectedGanttActivityDetails(
      '01-02-01',
      rows,
      logicLinks,
      lineItems,
      sampleCpm,
    );

    expect(details).not.toBeNull();
    expect(details?.activityCode).toBe('01-02-01');
    expect(details?.isCritical).toBe(false);
    expect(details?.estimatedFloat).toBe('37d');
    expect(details?.predecessors).toBe('01-01-01 (FS)');
  });

  it('resolveSelectedGanttActivityDetails returns null when modal is closed', () => {
    const rows = getLevelThreeGanttRows([makeActivity('01-01-01')], sampleCpm, '2026-06-06');
    expect(resolveSelectedGanttActivityDetails(null, rows)).toBeNull();
  });
});
