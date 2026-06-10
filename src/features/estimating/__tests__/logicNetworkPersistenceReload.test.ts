import { describe, expect, it } from 'vitest';
import { constructionActivitiesToScheduleActivities } from '../scheduling/adapters/constructionActivitiesToScheduleActivities';
import type { ProjectConstructionActivity } from '../domain/constructionActivityTypes';
import type { CpmLogicLink } from '../scheduling/cpmTypes';
import { runCpmCalculation } from '../scheduling/cpm/calculateCpm';
import {
  buildCpmActivitySignature,
  buildPrecedenceDiagramRunState,
  recomputeCommittedCpmFromSavedState,
} from '../scheduling/precedenceDiagram';
import {
  parseLogicLinksFromAssumptions,
  reconcileLogicLinksWithScheduleActivities,
  sanitizeScheduleAssumptionsForLineItems,
} from '../scheduling/scheduleAssumptions';
import type { EstimateDomainTask } from '../infrastructure/estimateDbTypes';

function makeActivity(
  overrides: Partial<ProjectConstructionActivity> & { id: string; activityCode: string },
): ProjectConstructionActivity {
  return {
    projectId: 'proj-1',
    divisionCode: '03',
    divisionName: 'Concrete',
    title: overrides.activityCode,
    scheduleEnabled: true,
    crewSize: 4,
    hoursPerDay: 8,
    productionFactor: 1,
    calculatedManHours: 32,
    calculatedManDays: 4,
    calculatedDurationDays: 2,
    effectiveDurationDays: 2,
    ...overrides,
  };
}

const SAVED_LINKS: CpmLogicLink[] = [
  {
    predecessorActivityCode: '03-30-01',
    successorActivityCode: '03-30-02',
    relationshipType: 'FS',
    lagDays: 0,
    predecessorRuntimeId: 'uuid-old-1',
    successorRuntimeId: 'uuid-old-2',
  },
];

describe('logic network persistence across reload', () => {
  it('keeps saved links when sanitizing against construction schedule activities', () => {
    const constructionActivities = [
      makeActivity({ id: 'uuid-new-1', activityCode: '03-30-01' }),
      makeActivity({ id: 'uuid-new-2', activityCode: '03-30-02' }),
    ];
    const { activities } = constructionActivitiesToScheduleActivities(constructionActivities);
    const assumptions = {
      logicNetworkInitialized: true,
      logicLinks: SAVED_LINKS,
      precedenceDiagram: {
        hasRunCpm: true,
        isStale: false,
        activitySignature: buildCpmActivitySignature(activities),
        logicLinksSignature: '03-30-01|03-30-02|FS|0',
        scheduleSettingsSignature: '2026-06-10|0|8|4',
      },
    };

    const sanitized = sanitizeScheduleAssumptionsForLineItems(
      assumptions,
      [] as EstimateDomainTask[],
      activities,
    );

    expect(parseLogicLinksFromAssumptions(sanitized)).toHaveLength(1);
  });

  it('reconciles saved links to refreshed runtime activity ids without dropping links', () => {
    const constructionActivities = [
      makeActivity({ id: 'uuid-new-1', activityCode: '03-30-01' }),
      makeActivity({ id: 'uuid-new-2', activityCode: '03-30-02' }),
      makeActivity({ id: 'uuid-new-3', activityCode: '03-30-03' }),
    ];
    const { activities } = constructionActivitiesToScheduleActivities(constructionActivities);
    const { links, prunedCount } = reconcileLogicLinksWithScheduleActivities(SAVED_LINKS, activities);

    expect(links).toHaveLength(1);
    expect(prunedCount).toBe(0);
    expect(links[0].predecessorRuntimeId).toBe('uuid-new-1');
    expect(links[0].successorRuntimeId).toBe('uuid-new-2');
  });

  it('restores CPM after reload when precedence metadata still matches', () => {
    const constructionActivities = [
      makeActivity({ id: 'act-a', activityCode: '03-30-01', effectiveDurationDays: 5 }),
      makeActivity({ id: 'act-b', activityCode: '03-30-02', effectiveDurationDays: 2 }),
    ];
    const { activities } = constructionActivitiesToScheduleActivities(constructionActivities);
    const links = [
      {
        predecessorActivityCode: '03-30-01',
        successorActivityCode: '03-30-02',
        relationshipType: 'FS' as const,
        lagDays: 0,
        predecessorRuntimeId: 'act-a',
        successorRuntimeId: 'act-b',
      },
    ];
    const scheduleSettings = {
      projectStartDate: '2026-06-10',
      hoursPerDay: 8,
      availableCrewSize: 4,
      includeWeekends: false,
    };
    const precedenceDiagram = buildPrecedenceDiagramRunState({
      activities,
      logicLinks: links,
      scheduleSettings,
    });

    const recompute = recomputeCommittedCpmFromSavedState({
      precedenceDiagram,
      activities,
      logicLinks: links,
      scheduleSettings,
    });

    expect(recompute.cpmResult?.hasRunCpm).toBe(true);
    expect(recompute.warningMessage).toBeNull();
    expect(recompute.cpmResult?.activities.find((a) => a.activityCode === '03-30-01')?.earlyStart).toBe(
      runCpmCalculation({ activities, logicLinks: links }).activities.find(
        (a) => a.activityCode === '03-30-01',
      )?.earlyStart,
    );
  });

  it('does not invalidate CPM when only activity title/description changes', () => {
    const baseActivities = constructionActivitiesToScheduleActivities([
      makeActivity({ id: 'act-a', activityCode: '03-30-01', title: 'Original title' }),
      makeActivity({ id: 'act-b', activityCode: '03-30-02', title: 'Successor' }),
    ]).activities;
    const links = [
      {
        predecessorActivityCode: '03-30-01',
        successorActivityCode: '03-30-02',
        relationshipType: 'FS' as const,
        lagDays: 0,
      },
    ];
    const scheduleSettings = {
      projectStartDate: '2026-06-10',
      hoursPerDay: 8,
      availableCrewSize: 4,
      includeWeekends: false,
    };
    const precedenceDiagram = buildPrecedenceDiagramRunState({
      activities: baseActivities,
      logicLinks: links,
      scheduleSettings,
    });
    const reloadedActivities = baseActivities.map((activity) => ({
      ...activity,
      activityDescription: 'Renamed after reload',
    }));

    const recompute = recomputeCommittedCpmFromSavedState({
      precedenceDiagram,
      activities: reloadedActivities,
      logicLinks: links,
      scheduleSettings,
    });

    expect(recompute.cpmResult?.hasRunCpm).toBe(true);
    expect(recompute.warningMessage).toBeNull();
  });

  it('prunes only links connected to deleted activities', () => {
    const activities = constructionActivitiesToScheduleActivities([
      makeActivity({ id: 'act-a', activityCode: '03-30-01' }),
      makeActivity({ id: 'act-c', activityCode: '03-30-03' }),
    ]).activities;
    const links: CpmLogicLink[] = [
      {
        predecessorActivityCode: '03-30-01',
        successorActivityCode: '03-30-02',
        relationshipType: 'FS',
        lagDays: 0,
      },
      {
        predecessorActivityCode: '03-30-01',
        successorActivityCode: '03-30-03',
        relationshipType: 'FS',
        lagDays: 0,
      },
    ];

    const { links: reconciled, prunedCount } = reconcileLogicLinksWithScheduleActivities(
      links,
      activities,
    );

    expect(reconciled).toHaveLength(1);
    expect(reconciled[0].successorActivityCode).toBe('03-30-03');
    expect(prunedCount).toBe(1);
  });
});
