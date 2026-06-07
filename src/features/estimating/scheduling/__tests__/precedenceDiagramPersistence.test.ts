import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { ScheduleActivity } from '../adapters/estimateLineItemsToScheduleActivities';
import { isDisplayCritical } from '../cpm/cpmDisplayCritical';
import { runCpmCalculation } from '../cpm/calculateCpm';
import type { CpmLogicLink, ScheduleSettings } from '../cpmTypes';
import {
  buildCpmActivitySignature,
  buildLogicLinksSignature,
  buildPrecedenceDiagramRunState,
  buildScheduleSettingsCpmSignature,
  currentPrecedenceDiagramSignaturesMatch,
  markPrecedenceDiagramStale,
  migratePrecedenceDiagramFromLegacyCpmCache,
  parsePrecedenceDiagramFromAssumptions,
  recomputeCommittedCpmFromSavedState,
} from '../precedenceDiagram';
import { mergeScheduleAssumptions } from '../scheduleAssumptions';

const workspacePageSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../ui/EstimateWorkspacePage.tsx'),
  'utf8',
);
const scheduleSettingsHookSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../ui/hooks/useScheduleSettings.ts'),
  'utf8',
);

function makeActivity(code: string, durationDays = 3): ScheduleActivity {
  return {
    activityCode: code,
    activityDescription: code,
    divisionCode: '01',
    divisionName: 'General',
    durationDays,
    laborHours: 0,
    manDays: 0,
    crewDays: 0,
    crewSize: 2,
    totalCost: 0,
    relationshipType: 'FS',
    lagDays: 0,
  };
}

function fs(pred: string, succ: string): CpmLogicLink {
  return {
    predecessorActivityCode: pred,
    successorActivityCode: succ,
    relationshipType: 'FS',
    lagDays: 0,
  };
}

const scheduleSettings: ScheduleSettings = {
  projectStartDate: '2026-06-06',
  hoursPerDay: 8,
  availableCrewSize: 4,
  includeWeekends: false,
};

describe('precedenceDiagram persistence helpers', () => {
  it('Run CPM metadata records signatures and hasRunCpm', () => {
    const activities = [makeActivity('A', 5), makeActivity('B', 2)];
    const links = [fs('A', 'B')];
    const state = buildPrecedenceDiagramRunState({ activities, logicLinks: links, scheduleSettings });

    expect(state.hasRunCpm).toBe(true);
    expect(state.activitySignature).toBe(buildCpmActivitySignature(activities));
    expect(state.logicLinksSignature).toBe(buildLogicLinksSignature(links));
    expect(state.scheduleSettingsSignature).toBe(buildScheduleSettingsCpmSignature(scheduleSettings));
    expect(state.lastRunAt).toBeTruthy();
  });

  it('reload after Run CPM recalculates CPM and preserves critical path display', () => {
    const activities = [makeActivity('A', 5), makeActivity('B', 2), makeActivity('C', 3)];
    const links = [fs('A', 'B'), fs('B', 'C')];
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
    expect(recompute.cpmResult?.hasValidCriticalPath).toBe(true);
    expect(recompute.warningMessage).toBeNull();
    expect(isDisplayCritical(recompute.cpmResult!, 'A')).toBe(true);
    expect(isDisplayCritical(recompute.cpmResult!, 'C')).toBe(true);
  });

  it('reload does not require Run CPM again when inputs are unchanged', () => {
    const activities = [makeActivity('A'), makeActivity('B')];
    const links = [fs('A', 'B')];
    const precedenceDiagram = buildPrecedenceDiagramRunState({
      activities,
      logicLinks: links,
      scheduleSettings,
    });

    expect(
      currentPrecedenceDiagramSignaturesMatch({
        saved: precedenceDiagram,
        activities,
        logicLinks: links,
        scheduleSettings,
      }),
    ).toBe(true);
  });

  it('changing a logic link marks CPM stale', () => {
    const activities = [makeActivity('A'), makeActivity('B')];
    const links = [fs('A', 'B')];
    const saved = buildPrecedenceDiagramRunState({ activities, logicLinks: links, scheduleSettings });
    const changedLinks = [fs('A', 'B'), fs('B', 'A')];

    const recompute = recomputeCommittedCpmFromSavedState({
      precedenceDiagram: saved,
      activities,
      logicLinks: changedLinks,
      scheduleSettings,
    });

    expect(recompute.cpmResult).toBeNull();
    expect(recompute.precedenceDiagram.hasRunCpm).toBe(false);
    expect(recompute.precedenceDiagram.isStale).toBe(true);
  });

  it('changing an activity duration marks CPM stale', () => {
    const activities = [makeActivity('A', 5), makeActivity('B', 2)];
    const links = [fs('A', 'B')];
    const saved = buildPrecedenceDiagramRunState({ activities, logicLinks: links, scheduleSettings });
    const changedActivities = [makeActivity('A', 9), makeActivity('B', 2)];

    const recompute = recomputeCommittedCpmFromSavedState({
      precedenceDiagram: saved,
      activities: changedActivities,
      logicLinks: links,
      scheduleSettings,
    });

    expect(recompute.cpmResult).toBeNull();
    expect(recompute.precedenceDiagram.isStale).toBe(true);
  });

  it('saved hasRunCpm true but invalid network shows warning and no critical red', () => {
    const activities = [makeActivity('A'), makeActivity('B')];
    const saved = buildPrecedenceDiagramRunState({
      activities,
      logicLinks: [],
      scheduleSettings,
    });

    const recompute = recomputeCommittedCpmFromSavedState({
      precedenceDiagram: saved,
      activities,
      logicLinks: [],
      scheduleSettings,
    });

    expect(recompute.cpmResult).toBeNull();
    expect(recompute.warningMessage).toBeTruthy();
  });

  it('parse and merge precedenceDiagram assumptions', () => {
    const state = buildPrecedenceDiagramRunState({
      activities: [makeActivity('A')],
      logicLinks: [],
      scheduleSettings,
    });
    const merged = mergeScheduleAssumptions({ precedenceDiagram: state }, {});
    const parsed = parsePrecedenceDiagramFromAssumptions(merged);
    expect(parsed?.hasRunCpm).toBe(true);
  });

  it('migrates legacy cpmResultCache into precedenceDiagram metadata', () => {
    const activities = [makeActivity('A'), makeActivity('B')];
    const links = [fs('A', 'B')];
    const cpmResult = runCpmCalculation({ activities, logicLinks: links });
    const migrated = migratePrecedenceDiagramFromLegacyCpmCache({
      assumptions: {
        cpmResultCache: cpmResult,
        cpmCalculatedAt: '2026-06-07T12:00:00.000Z',
      },
      activities,
      logicLinks: links,
      scheduleSettings,
    });

    expect(migrated?.hasRunCpm).toBe(true);
    const recompute = recomputeCommittedCpmFromSavedState({
      precedenceDiagram: migrated,
      activities,
      logicLinks: links,
      scheduleSettings,
    });
    expect(recompute.cpmResult?.hasRunCpm).toBe(true);
    expect(recompute.cpmResult?.hasValidCriticalPath).toBe(true);
  });

  it('markPrecedenceDiagramStale clears hasRunCpm', () => {
    const stale = markPrecedenceDiagramStale(
      buildPrecedenceDiagramRunState({
        activities: [makeActivity('A')],
        logicLinks: [],
        scheduleSettings,
      }),
    );
    expect(stale.hasRunCpm).toBe(false);
    expect(stale.isStale).toBe(true);
  });
});

describe('precedenceDiagram workspace wiring', () => {
  it('Run CPM persists precedenceDiagram metadata', () => {
    expect(workspacePageSource).toContain('buildPrecedenceDiagramRunState');
    expect(workspacePageSource).toContain('precedenceDiagram');
    expect(workspacePageSource).not.toMatch(/handleRunCpm[\s\S]{0,500}cpmResultCache: result/);
  });

  it('save layout preserves precedenceDiagram state', () => {
    const persistBody =
      workspacePageSource.match(
        /const persistLogicNetworkLayout = useCallback\([\s\S]*?\n  \);/,
      )?.[0] ?? '';
    expect(persistBody).toContain('precedenceDiagram: scheduleSettingsHook.precedenceDiagram');
    expect(persistBody).not.toContain('cpmResultCache: null');
  });

  it('save estimate preserves precedenceDiagram state', () => {
    expect(workspacePageSource).toContain('precedenceDiagramForSave');
    expect(workspacePageSource).toContain('precedenceDiagram: precedenceDiagramForSave');
  });

  it('logic link changes mark precedenceDiagram stale', () => {
    const saveLinksBody =
      workspacePageSource.match(/const saveLogicLinksSafely = useCallback\([\s\S]*?\n  \);/)?.[0] ??
      '';
    expect(saveLinksBody).toContain('markPrecedenceDiagramStale');
    expect(saveLinksBody).toContain('precedenceDiagram: stalePrecedenceDiagram');
  });

  it('rehydrate recalculates committed CPM from saved precedenceDiagram', () => {
    expect(scheduleSettingsHookSource).toContain('recomputeCommittedCpmFromSavedState');
    expect(scheduleSettingsHookSource).toContain('migratePrecedenceDiagramFromLegacyCpmCache');
  });

  it('runCpmCalculation still gates display-critical styling', () => {
    const preview = runCpmCalculation({
      activities: [makeActivity('A'), makeActivity('B')],
      logicLinks: [fs('A', 'B')],
    });
    expect(preview.hasRunCpm).toBe(true);
    expect(isDisplayCritical(preview, 'A')).toBe(true);
  });
});
