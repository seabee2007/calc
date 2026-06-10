import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { constructionActivitiesToScheduleActivities } from '../adapters/constructionActivitiesToScheduleActivities';
import { linkToEdge } from '../../ui/components/scheduling/EstimateLogicNetworkCanvas';
import type { ProjectConstructionActivity } from '../../domain/constructionActivityTypes';
import type { CpmLogicLink } from '../cpmTypes';
import { runCpmCalculation } from '../cpm/calculateCpm';
import {
  logicLinksEqual,
  parseLogicLinksFromAssumptions,
  parseLogicNetworkLayoutFromAssumptions,
  reconcileLogicLinksWithScheduleActivities,
  sanitizeScheduleAssumptionsForLineItems,
  shouldDeferScheduleLayerActivityCodeFiltering,
} from '../scheduleAssumptions';
import type { EstimateDomainTask } from '../../infrastructure/estimateDbTypes';

const CA_CODES = {
  clear: 'ca-31-clear-and-grub',
  excavate: 'ca-31-excavate-footings',
  footing: 'ca-03-place-continuous-footing',
  backfill: 'ca-31-backfill-compact',
  slab: 'ca-03-place-slab-on-grade',
} as const;

function makeConstructionActivity(
  overrides: Partial<ProjectConstructionActivity> & { id: string; activityCode: string },
): ProjectConstructionActivity {
  return {
    projectId: 'proj-1',
    divisionCode: '31',
    divisionName: 'Earthwork',
    title: overrides.activityCode,
    scheduleEnabled: true,
    crewSize: 4,
    hoursPerDay: 8,
    productionFactor: 1,
    calculatedDurationDays: 3,
    effectiveDurationDays: 3,
    ...overrides,
  };
}

function makeLineItem(activityCode: string): EstimateDomainTask {
  return {
    id: activityCode,
    lineType: 'task',
    activityCode,
    title: activityCode,
    divisionCode: '01',
    divisionName: 'General',
    scheduleEnabled: true,
    calculatedValues: undefined as unknown as EstimateDomainTask['calculatedValues'],
    lineItem: {
      crewDays: 3,
      durationDays: 3,
      crewSize: 2,
      laborHours: 24,
    } as EstimateDomainTask['lineItem'],
  } as EstimateDomainTask;
}

const SAVED_LINKS: CpmLogicLink[] = [
  {
    predecessorActivityCode: CA_CODES.clear,
    successorActivityCode: CA_CODES.excavate,
    relationshipType: 'FS',
    lagDays: 0,
    predecessorRuntimeId: 'uuid-clear-old',
    successorRuntimeId: 'uuid-excavate-old',
  },
  {
    predecessorActivityCode: CA_CODES.excavate,
    successorActivityCode: CA_CODES.footing,
    relationshipType: 'FS',
    lagDays: 0,
    predecessorRuntimeId: 'uuid-excavate-old',
    successorRuntimeId: 'uuid-footing-old',
  },
  {
    predecessorActivityCode: CA_CODES.excavate,
    successorActivityCode: CA_CODES.backfill,
    relationshipType: 'FS',
    lagDays: 0,
    predecessorRuntimeId: 'uuid-excavate-old',
    successorRuntimeId: 'uuid-backfill-old',
  },
  {
    predecessorActivityCode: CA_CODES.footing,
    successorActivityCode: CA_CODES.slab,
    relationshipType: 'FS',
    lagDays: 0,
    predecessorRuntimeId: 'uuid-footing-old',
    successorRuntimeId: 'uuid-slab-old',
  },
  {
    predecessorActivityCode: CA_CODES.backfill,
    successorActivityCode: CA_CODES.slab,
    relationshipType: 'FS',
    lagDays: 0,
    predecessorRuntimeId: 'uuid-backfill-old',
    successorRuntimeId: 'uuid-slab-old',
  },
];

const ASSUMPTIONS_WITH_CA_LINKS = {
  logicNetworkInitialized: true,
  logicLinks: SAVED_LINKS,
  logicNetworkLayout: [
    { activityCode: CA_CODES.clear, x: 10, y: 20 },
    { activityCode: CA_CODES.slab, x: 400, y: 20 },
  ],
};

describe('logic link persistence — construction activity schedule source', () => {
  it('defers line-item sanitization when saved links use construction activity codes', () => {
    const lineItems = [makeLineItem('LEGACY-01')];
    expect(
      shouldDeferScheduleLayerActivityCodeFiltering(
        ASSUMPTIONS_WITH_CA_LINKS,
        new Set(['LEGACY-01']),
      ),
    ).toBe(true);
  });

  it('still sanitizes stale legacy line-item links when codes are not construction activities', () => {
    const assumptions = {
      logicLinks: [
        {
          predecessorActivityCode: 'OLD-A',
          successorActivityCode: 'OLD-B',
          relationshipType: 'FS',
          lagDays: 0,
        },
      ],
    };
    expect(
      shouldDeferScheduleLayerActivityCodeFiltering(assumptions, new Set(['NEW-1'])),
    ).toBe(false);
  });

  it('preserves construction-activity logic links on estimate rehydrate sanitize', () => {
    const sanitized = sanitizeScheduleAssumptionsForLineItems(
      ASSUMPTIONS_WITH_CA_LINKS,
      [makeLineItem('LEGACY-01')],
    );
    expect(parseLogicLinksFromAssumptions(sanitized)).toEqual(SAVED_LINKS);
    expect(parseLogicNetworkLayoutFromAssumptions(sanitized)).toEqual(
      ASSUMPTIONS_WITH_CA_LINKS.logicNetworkLayout,
    );
  });

  it('reconciles persisted links after schedule activities reload with new runtime IDs', () => {
    const reloadedActivities = [
      makeConstructionActivity({ id: 'uuid-clear-new', activityCode: CA_CODES.clear }),
      makeConstructionActivity({ id: 'uuid-excavate-new', activityCode: CA_CODES.excavate }),
      makeConstructionActivity({ id: 'uuid-footing-new', activityCode: CA_CODES.footing }),
      makeConstructionActivity({ id: 'uuid-backfill-new', activityCode: CA_CODES.backfill }),
      makeConstructionActivity({ id: 'uuid-slab-new', activityCode: CA_CODES.slab }),
    ];
    const { activities } = constructionActivitiesToScheduleActivities(reloadedActivities);
    const { links, preservedCount, prunedCount } = reconcileLogicLinksWithScheduleActivities(
      SAVED_LINKS,
      activities,
    );

    expect(preservedCount).toBe(5);
    expect(prunedCount).toBe(0);
    expect(links).toHaveLength(5);
    expect(links[0].predecessorRuntimeId).toBe('uuid-clear-new');
    expect(links[0].successorRuntimeId).toBe('uuid-excavate-new');
    expect(links.every((link) => link.predecessorActivityCode.startsWith('ca-'))).toBe(true);
  });

  it('prunes only links whose activities were deleted', () => {
    const remaining = [
      makeConstructionActivity({ id: 'uuid-clear-new', activityCode: CA_CODES.clear }),
      makeConstructionActivity({ id: 'uuid-excavate-new', activityCode: CA_CODES.excavate }),
    ];
    const { activities } = constructionActivitiesToScheduleActivities(remaining);
    const { links, prunedCount } = reconcileLogicLinksWithScheduleActivities(SAVED_LINKS, activities);

    expect(prunedCount).toBeGreaterThan(0);
    expect(links).toEqual([
      {
        predecessorActivityCode: CA_CODES.clear,
        successorActivityCode: CA_CODES.excavate,
        relationshipType: 'FS',
        lagDays: 0,
        predecessorRuntimeId: 'uuid-clear-new',
        successorRuntimeId: 'uuid-excavate-new',
      },
    ]);
  });

  it('renders edges after reload even when saved runtime IDs are stale', () => {
    const reloadedActivities = [
      makeConstructionActivity({ id: 'uuid-clear-new', activityCode: CA_CODES.clear }),
      makeConstructionActivity({ id: 'uuid-excavate-new', activityCode: CA_CODES.excavate }),
    ];
    const { activities } = constructionActivitiesToScheduleActivities(reloadedActivities);
    const validGraphKeys = new Set(activities.map((activity) => activity.runtimeActivityId!));
    const codeToGraphKey = new Map(
      activities.map((activity) => [activity.activityCode, activity.runtimeActivityId!]),
    );

    const edge = linkToEdge(
      SAVED_LINKS[0],
      null,
      'logic-network',
      codeToGraphKey,
      validGraphKeys,
    );

    expect(edge.source).toBe('node-uuid-clear-new');
    expect(edge.target).toBe('node-uuid-excavate-new');
  });

  it('CPM recalculation uses reconciled persisted links', () => {
    const activitiesBundle = constructionActivitiesToScheduleActivities([
      makeConstructionActivity({ id: 'id-1', activityCode: CA_CODES.clear, effectiveDurationDays: 2 }),
      makeConstructionActivity({ id: 'id-2', activityCode: CA_CODES.excavate, effectiveDurationDays: 3 }),
      makeConstructionActivity({ id: 'id-3', activityCode: CA_CODES.footing, effectiveDurationDays: 4 }),
      makeConstructionActivity({ id: 'id-4', activityCode: CA_CODES.backfill, effectiveDurationDays: 2 }),
      makeConstructionActivity({ id: 'id-5', activityCode: CA_CODES.slab, effectiveDurationDays: 5 }),
    ]);
    const { links } = reconcileLogicLinksWithScheduleActivities(
      SAVED_LINKS,
      activitiesBundle.activities,
    );
    const cpmResult = runCpmCalculation({
      activities: activitiesBundle.activities,
      logicLinks: links,
    });

    expect(cpmResult.hasRunCpm).toBe(true);
    expect(cpmResult.activities).toHaveLength(5);
    expect(cpmResult.projectDurationDays).toBeGreaterThan(5);
  });

  it('Save Layout merge does not include logicLinks (layout-only save)', () => {
    const pageSource = readFileSync(
      join(process.cwd(), 'src/features/estimating/ui/EstimateWorkspacePage.tsx'),
      'utf8',
    );
    expect(pageSource).toContain(
      'Layout-only save: positions + view mode + CPM metadata — never logic links or line items.',
    );
    const layoutSaveBlock = pageSource.slice(
      pageSource.indexOf('const persistLogicNetworkLayout'),
      pageSource.indexOf('const handleLogicNetworkLayoutChange'),
    );
    expect(layoutSaveBlock).toContain('mergeLogicLayoutAssumptionsOnly');
    expect(layoutSaveBlock).not.toContain('logicLinks: scheduleSettingsHook.logicLinks');
    expect(layoutSaveBlock).not.toContain('saveCurrentEstimateWithLineItems');
  });

  it('logicLinksEqual detects runtime ID refresh after reconcile', () => {
    const activities = [
      { activityCode: CA_CODES.clear, runtimeActivityId: 'uuid-clear-new' },
      { activityCode: CA_CODES.excavate, runtimeActivityId: 'uuid-excavate-new' },
    ];
    const after = reconcileLogicLinksWithScheduleActivities([SAVED_LINKS[0]], activities).links;
    expect(logicLinksEqual([SAVED_LINKS[0]], after)).toBe(false);
    expect(after[0].predecessorRuntimeId).toBe('uuid-clear-new');
    expect(after[0].successorRuntimeId).toBe('uuid-excavate-new');
  });
});
