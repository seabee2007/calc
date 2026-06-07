import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { EstimateDomainTask } from '../../infrastructure/estimateDbTypes';
import type { CpmLogicLink } from '../cpmTypes';
import {
  hasLogicLinksKey,
  mergeScheduleAssumptions,
  parseLogicLinksFromAssumptions,
  parseLogicNetworkInitializedFromAssumptions,
  sanitizeScheduleAssumptionsForLineItems,
  seedLogicLinksFromLineItems,
} from '../scheduleAssumptions';

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

const LINE_ITEMS = [
  makeTask({ activityCode: 'A', title: 'Start' }),
  makeTask({ activityCode: 'B', title: 'Finish', predecessorActivityCode: 'A' }),
];

function resolveLinksOnRehydrate(
  rawAssumptions: Record<string, unknown>,
  lineItems: EstimateDomainTask[],
): CpmLogicLink[] {
  const sanitizedAssumptions = sanitizeScheduleAssumptionsForLineItems(rawAssumptions, lineItems);
  const initialized = parseLogicNetworkInitializedFromAssumptions(sanitizedAssumptions);
  const hasLinksKey = hasLogicLinksKey(rawAssumptions);
  const existingLinks = parseLogicLinksFromAssumptions(sanitizedAssumptions);
  if (initialized || hasLinksKey) {
    return existingLinks;
  }
  return seedLogicLinksFromLineItems(lineItems);
}

describe('logicNetworkInitialized helpers', () => {
  it('hasLogicLinksKey is true when logicLinks key exists including empty array', () => {
    expect(hasLogicLinksKey({ logicLinks: [] })).toBe(true);
    expect(hasLogicLinksKey({ logicLinks: [{ predecessorActivityCode: 'A', successorActivityCode: 'B', relationshipType: 'FS', lagDays: 0 }] })).toBe(true);
    expect(hasLogicLinksKey({})).toBe(false);
    expect(hasLogicLinksKey(null)).toBe(false);
  });

  it('parseLogicNetworkInitializedFromAssumptions defaults to false', () => {
    expect(parseLogicNetworkInitializedFromAssumptions({})).toBe(false);
    expect(parseLogicNetworkInitializedFromAssumptions({ logicNetworkInitialized: true })).toBe(true);
  });
});

describe('logic network seeding gate', () => {
  it('seeds once when logicLinks key is missing and not initialized', () => {
    const links = resolveLinksOnRehydrate({}, LINE_ITEMS);
    expect(links).toEqual(seedLogicLinksFromLineItems(LINE_ITEMS));
  });

  it('does not re-seed when logicLinks is empty and initialized', () => {
    const links = resolveLinksOnRehydrate(
      { logicLinks: [], logicNetworkInitialized: true },
      LINE_ITEMS,
    );
    expect(links).toEqual([]);
  });

  it('does not re-seed when logicLinks key exists as empty array even without initialized flag', () => {
    const links = resolveLinksOnRehydrate({ logicLinks: [] }, LINE_ITEMS);
    expect(links).toEqual([]);
  });

  it('clear persists empty links and initialized flag through merge', () => {
    const cleared = mergeScheduleAssumptions(
      { logicLinks: [], logicNetworkInitialized: true },
      { logicLinks: [{ predecessorActivityCode: 'A', successorActivityCode: 'B', relationshipType: 'FS', lagDays: 0 }] },
    );
    expect(parseLogicLinksFromAssumptions(cleared)).toEqual([]);
    expect(parseLogicNetworkInitializedFromAssumptions(cleared)).toBe(true);
  });

  it('reload after clear stays empty', () => {
    const cleared = mergeScheduleAssumptions(
      { logicLinks: [], logicNetworkInitialized: true },
      { logicLinks: [{ predecessorActivityCode: 'A', successorActivityCode: 'B', relationshipType: 'FS', lagDays: 0 }] },
    );
    const links = resolveLinksOnRehydrate(cleared, LINE_ITEMS);
    expect(links).toEqual([]);
  });
});

describe('logic network save wiring', () => {
  const pageSource = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), '../../ui/EstimateWorkspacePage.tsx'),
    'utf8',
  );
  const canvasSource = readFileSync(
    resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../../ui/components/scheduling/EstimateLogicNetworkCanvas.tsx',
    ),
    'utf8',
  );
  const hookSource = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), '../../ui/hooks/useScheduleSettings.ts'),
    'utf8',
  );

  it('useScheduleSettings gates seeding on initialized or logicLinks key', () => {
    expect(hookSource).toContain('parseLogicNetworkInitializedFromAssumptions');
    expect(hookSource).toContain('hasLogicLinksKey');
    expect(hookSource).toContain('if (initialized || hasLinksKey)');
    expect(hookSource).not.toContain('if (existingLinks.length > 0)');
  });

  it('manual, AI, and clear routes use saveLogicLinksSafely', () => {
    expect(pageSource).toContain('saveLogicLinksSafely');
    expect(pageSource).toContain('handleLogicLinksChange');
    expect(pageSource).toContain('handleAddSuggestedLogicLinks');
    expect(pageSource).toContain('handleClearAllLogicLinks');
    expect(pageSource).toContain('clearLevelingState: true');
    expect(pageSource).toContain('sanitizeLogicLinksForActivities');
  });

  it('canvas derives edges from sanitized logic links without local addEdge', () => {
    expect(canvasSource).toContain('sanitizedLogicLinks');
    expect(canvasSource).toContain('sanitizeLogicLinksForActivities');
    expect(canvasSource).not.toContain('addEdge');
    expect(canvasSource).not.toContain('setEdges((currentEdges) =>');
  });
});
