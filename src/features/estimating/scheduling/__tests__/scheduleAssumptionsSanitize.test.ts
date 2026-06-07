import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { estimateLineItemsToScheduleActivities } from '../adapters/estimateLineItemsToScheduleActivities';
import { calculateCpm } from '../cpm/calculateCpm';
import {
  getValidScheduleActivityCodes,
  mergeScheduleAssumptionsForAddImport,
  parseLogicLinksFromAssumptions,
  parseLogicNetworkInitializedFromAssumptions,
  parseLogicNetworkLayoutFromAssumptions,
  parseLeveledOffsetsFromAssumptions,
  parseLogicReviewIgnoredFromAssumptions,
  resetScheduleAssumptionsForReplacement,
  sanitizeScheduleAssumptionsForLineItems,
  seedLogicLinksFromLineItems,
} from '../scheduleAssumptions';
import type { EstimateDomainTask } from '../../infrastructure/estimateDbTypes';

function makeTask(
  overrides: Partial<EstimateDomainTask> & { activityCode: string },
): EstimateDomainTask {
  return {
    id: overrides.activityCode,
    lineType: 'task',
    activityCode: overrides.activityCode,
    title: overrides.title ?? overrides.activityCode,
    divisionCode: overrides.divisionCode ?? '01',
    divisionName: overrides.divisionName ?? 'General',
    scheduleEnabled: overrides.scheduleEnabled !== false,
    predecessorActivityCode: overrides.predecessorActivityCode,
    relationshipType: overrides.relationshipType ?? 'FS',
    lagDays: overrides.lagDays ?? 0,
    calculatedValues: undefined as unknown as EstimateDomainTask['calculatedValues'],
    lineItem: {
      crewDays: 3,
      durationDays: 3,
      crewSize: 2,
      laborHours: 24,
      ...(overrides.lineItem as object | undefined),
    } as EstimateDomainTask['lineItem'],
    ...overrides,
  } as EstimateDomainTask;
}

const OLD_TASKS = [
  makeTask({ activityCode: 'OLD-A', title: 'Old excavation' }),
  makeTask({ activityCode: 'OLD-B', title: 'Old foundation', predecessorActivityCode: 'OLD-A' }),
];

const NEW_TASKS = [
  makeTask({ activityCode: 'NEW-1', title: 'Site layout' }),
  makeTask({ activityCode: 'NEW-2', title: 'Excavate footings', predecessorActivityCode: 'NEW-1' }),
];

const STALE_ASSUMPTIONS = {
  scheduleSettings: {
    projectStartDate: '2026-06-06',
    hoursPerDay: 8,
    availableCrewSize: 4,
    includeWeekends: false,
  },
  estimateSettings: { hoursPerDay: 8, defaultCrewSize: 4 },
  logicLinks: [
    {
      predecessorActivityCode: 'OLD-A',
      successorActivityCode: 'OLD-B',
      relationshipType: 'FS',
      lagDays: 0,
    },
  ],
  logicNetworkLayout: [
    { activityCode: 'OLD-A', x: 120, y: 80 },
    { activityCode: 'OLD-B', x: 360, y: 80 },
  ],
  leveledActivityOffsets: { 'OLD-A': 2, 'OLD-B': 0 },
  resourceLevelingResults: { movedActivities: [] },
  logicReviewIgnored: ['missingLikelyPredecessor|OLD-B|OLD-A||rule-1'],
  logicReviewAiSuggestions: [{ id: 'ai-1' }],
  cpmWarnings: ['stale warning'],
};

describe('sanitizeScheduleAssumptionsForLineItems', () => {
  it('removes logic links that reference missing activity codes', () => {
    const sanitized = sanitizeScheduleAssumptionsForLineItems(STALE_ASSUMPTIONS, NEW_TASKS);
    expect(parseLogicLinksFromAssumptions(sanitized)).toEqual([]);
  });

  it('removes layout entries for missing activity codes', () => {
    const sanitized = sanitizeScheduleAssumptionsForLineItems(STALE_ASSUMPTIONS, NEW_TASKS);
    expect(parseLogicNetworkLayoutFromAssumptions(sanitized)).toEqual([]);
  });

  it('removes leveled offsets for missing activity codes', () => {
    const sanitized = sanitizeScheduleAssumptionsForLineItems(STALE_ASSUMPTIONS, NEW_TASKS);
    expect(parseLeveledOffsetsFromAssumptions(sanitized)).toEqual({});
  });

  it('removes ignored review warnings tied to missing activity codes', () => {
    const sanitized = sanitizeScheduleAssumptionsForLineItems(STALE_ASSUMPTIONS, NEW_TASKS);
    expect(parseLogicReviewIgnoredFromAssumptions(sanitized)).toEqual([]);
  });

  it('keeps scheduleSettings while sanitizing schedule layer data', () => {
    const sanitized = sanitizeScheduleAssumptionsForLineItems(STALE_ASSUMPTIONS, NEW_TASKS);
    expect(sanitized.scheduleSettings).toEqual(STALE_ASSUMPTIONS.scheduleSettings);
    expect(sanitized.estimateSettings).toEqual(STALE_ASSUMPTIONS.estimateSettings);
    expect(sanitized.cpmWarnings).toBeUndefined();
    expect(sanitized.resourceLevelingResults).toBeUndefined();
    expect(sanitized.logicReviewAiSuggestions).toBeUndefined();
  });

  it('preserves logicNetworkInitialized through sanitize', () => {
    const sanitized = sanitizeScheduleAssumptionsForLineItems(
      { ...STALE_ASSUMPTIONS, logicNetworkInitialized: true },
      NEW_TASKS,
    );
    expect(parseLogicNetworkInitializedFromAssumptions(sanitized)).toBe(true);
  });
});

describe('resetScheduleAssumptionsForReplacement', () => {
  it('clears old logic links and layout on replace import', () => {
    const reset = resetScheduleAssumptionsForReplacement(STALE_ASSUMPTIONS, NEW_TASKS);
    expect(parseLogicNetworkLayoutFromAssumptions(reset)).toEqual([]);
    expect(parseLeveledOffsetsFromAssumptions(reset)).toEqual({});
    expect(parseLogicReviewIgnoredFromAssumptions(reset)).toEqual([]);
    expect(reset.cpmWarnings).toBeUndefined();
    expect(reset.resourceLevelingResults).toBeUndefined();
  });

  it('seeds logic links only from imported line item predecessors', () => {
    const reset = resetScheduleAssumptionsForReplacement(STALE_ASSUMPTIONS, NEW_TASKS);
    const links = parseLogicLinksFromAssumptions(reset);
    expect(links).toEqual(seedLogicLinksFromLineItems(NEW_TASKS));
    expect(links.some((link) => link.predecessorActivityCode === 'OLD-A')).toBe(false);
  });

  it('sets logicNetworkInitialized on replace import', () => {
    const reset = resetScheduleAssumptionsForReplacement(STALE_ASSUMPTIONS, NEW_TASKS);
    expect(parseLogicNetworkInitializedFromAssumptions(reset)).toBe(true);
  });
});

describe('mergeScheduleAssumptionsForAddImport', () => {
  it('keeps valid old links and removes links for missing activity codes', () => {
    const currentTasks = [
      makeTask({ activityCode: 'KEEP-A' }),
      makeTask({ activityCode: 'KEEP-B', predecessorActivityCode: 'KEEP-A' }),
      ...NEW_TASKS,
    ];
    const assumptionsWithMixedLinks = {
      ...STALE_ASSUMPTIONS,
      logicLinks: [
        {
          predecessorActivityCode: 'KEEP-A',
          successorActivityCode: 'KEEP-B',
          relationshipType: 'FS',
          lagDays: 0,
        },
        {
          predecessorActivityCode: 'OLD-A',
          successorActivityCode: 'OLD-B',
          relationshipType: 'FS',
          lagDays: 0,
        },
      ],
      logicNetworkLayout: [
        { activityCode: 'KEEP-A', x: 10, y: 10 },
        { activityCode: 'OLD-A', x: 20, y: 20 },
      ],
    };

    const merged = mergeScheduleAssumptionsForAddImport(
      assumptionsWithMixedLinks,
      currentTasks,
      NEW_TASKS,
    );
    const links = parseLogicLinksFromAssumptions(merged);
    expect(links.some((link) => link.predecessorActivityCode === 'KEEP-A')).toBe(true);
    expect(links.some((link) => link.predecessorActivityCode === 'OLD-A')).toBe(false);
    expect(links.some((link) => link.predecessorActivityCode === 'NEW-1')).toBe(true);
    expect(parseLogicNetworkLayoutFromAssumptions(merged).map((entry) => entry.activityCode)).toEqual([
      'KEEP-A',
    ]);
  });

  it('sets logicNetworkInitialized on add import', () => {
    const merged = mergeScheduleAssumptionsForAddImport(STALE_ASSUMPTIONS, NEW_TASKS, NEW_TASKS);
    expect(parseLogicNetworkInitializedFromAssumptions(merged)).toBe(true);
  });
});

describe('schedule layer reset wiring', () => {
  const pageSource = readFileSync(
    resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../../ui/EstimateWorkspacePage.tsx',
    ),
    'utf8',
  );
  const canvasSource = readFileSync(
    resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../../ui/components/scheduling/EstimateLogicNetworkCanvas.tsx',
    ),
    'utf8',
  );

  it('reset form clears in-memory schedule assumptions', () => {
    expect(pageSource).toContain('scheduleSettingsHook.rehydrateFromEstimate(null, [])');
    expect(pageSource).toContain('setLevelingModalResult(null)');
  });

  it('replace import uses resetScheduleAssumptionsForReplacement', () => {
    expect(pageSource).toContain('resetScheduleAssumptionsForReplacement');
    expect(pageSource).toContain('mergeScheduleAssumptionsForAddImport');
  });

  it('logic network prunes stale activities when activity signature changes', () => {
    expect(pageSource).toContain('activitySignature={scheduleActivitySignature}');
    expect(canvasSource).toContain('activitySignature');
    expect(canvasSource).toContain('autoLayoutSnapshotRef.current = null');
  });
});

describe('sanitizeScheduleAssumptionsForLineItems link hygiene', () => {
  it('removes self links and exact duplicate links on load', () => {
    const tasks = [
      makeTask({ activityCode: 'A', title: 'Layout' }),
      makeTask({ activityCode: 'B', title: 'Excavation', predecessorActivityCode: 'A' }),
    ];
    const assumptions = {
      logicLinks: [
        {
          predecessorActivityCode: 'A',
          successorActivityCode: 'A',
          relationshipType: 'FS',
          lagDays: 0,
        },
        {
          predecessorActivityCode: 'A',
          successorActivityCode: 'B',
          relationshipType: 'FS',
          lagDays: 0,
        },
        {
          predecessorActivityCode: 'A',
          successorActivityCode: 'B',
          relationshipType: 'FS',
          lagDays: 0,
        },
      ],
    };

    const sanitized = sanitizeScheduleAssumptionsForLineItems(assumptions, tasks);
    expect(parseLogicLinksFromAssumptions(sanitized)).toEqual([
      {
        predecessorActivityCode: 'A',
        successorActivityCode: 'B',
        relationshipType: 'FS',
        lagDays: 0,
      },
    ]);
  });
});

describe('cpm warnings after replacement', () => {
  it('recalculates warnings from current activities only', () => {
    const { activities } = estimateLineItemsToScheduleActivities(NEW_TASKS);
    const links = seedLogicLinksFromLineItems(NEW_TASKS);
    const result = calculateCpm({ activities, logicLinks: links });
    expect(result.activities.map((activity) => activity.activityCode)).toEqual(['NEW-1', 'NEW-2']);
    expect(result.warnings.some((warning) => warning.includes('OLD-A'))).toBe(false);
    expect(getValidScheduleActivityCodes(NEW_TASKS).has('OLD-A')).toBe(false);
  });
});
