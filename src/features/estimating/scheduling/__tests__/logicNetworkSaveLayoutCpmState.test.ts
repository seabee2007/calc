import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { ScheduleActivity } from '../adapters/estimateLineItemsToScheduleActivities';
import { runCpmCalculation } from '../cpm/calculateCpm';
import type { CpmLogicLink, LogicNetworkLayout, ScheduleSettings } from '../cpmTypes';
import {
  buildPrecedenceDiagramRunState,
  CPM_STALE_MESSAGE,
  parsePrecedenceDiagramFromAssumptions,
  recomputeCommittedCpmFromSavedState,
} from '../precedenceDiagram';
import {
  mergeLogicLayoutAssumptionsOnly,
  parseLogicLinksFromAssumptions,
  parseLogicNetworkViewModeFromAssumptions,
} from '../scheduleAssumptions';

const workspacePageSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../ui/EstimateWorkspacePage.tsx'),
  'utf8',
);
const scheduleSettingsHookSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../ui/hooks/useScheduleSettings.ts'),
  'utf8',
);

function makeActivity(code: string, durationDays = 3, description = code): ScheduleActivity {
  return {
    activityCode: code,
    runtimeActivityId: `uuid-${code}`,
    activityDescription: description,
    divisionCode: '03',
    divisionName: 'Concrete',
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

const layout: LogicNetworkLayout[] = [
  { activityCode: 'ca-clear', x: 10, y: 20 },
  { activityCode: 'ca-excavate', x: 220, y: 20 },
];

describe('mergeLogicLayoutAssumptionsOnly', () => {
  it('updates layout without overwriting logic links or clearing CPM metadata', () => {
    const activities = [makeActivity('ca-clear'), makeActivity('ca-excavate')];
    const links = [fs('ca-clear', 'ca-excavate')];
    const precedenceDiagram = buildPrecedenceDiagramRunState({
      activities,
      logicLinks: links,
      scheduleSettings,
    });
    const existing = {
      logicLinks: links,
      logicNetworkViewMode: 'precedence-diagram',
      precedenceDiagram,
    };

    const merged = mergeLogicLayoutAssumptionsOnly(layout, existing, {
      logicNetworkViewMode: 'precedence-diagram',
      precedenceDiagram,
    });

    expect(parseLogicLinksFromAssumptions(merged)).toEqual(links);
    expect(parseLogicNetworkViewModeFromAssumptions(merged)).toBe('precedence-diagram');
    expect(parsePrecedenceDiagramFromAssumptions(merged)?.hasRunCpm).toBe(true);
    expect(merged.logicNetworkLayout).toEqual(layout);
  });
});

describe('Save Layout CPM state regression', () => {
  it('run CPM then layout-only merge keeps CPM valid for construction activities', () => {
    const activities = [
      makeActivity('ca-clear', 2),
      makeActivity('ca-excavate', 3),
      makeActivity('ca-footing', 4),
    ];
    const links = [fs('ca-clear', 'ca-excavate'), fs('ca-excavate', 'ca-footing')];
    const precedenceDiagram = buildPrecedenceDiagramRunState({
      activities,
      logicLinks: links,
      scheduleSettings,
    });

    const merged = mergeLogicLayoutAssumptionsOnly(layout, { logicLinks: links, precedenceDiagram }, {
      logicNetworkViewMode: 'precedence-diagram',
      precedenceDiagram,
    });

    const parsedPrecedence = parsePrecedenceDiagramFromAssumptions(merged);
    const recompute = recomputeCommittedCpmFromSavedState({
      precedenceDiagram: parsedPrecedence,
      activities,
      logicLinks: links,
      scheduleSettings,
    });

    expect(recompute.cpmResult?.hasRunCpm).toBe(true);
    expect(recompute.warningMessage).toBeNull();
    expect(recompute.cpmResult?.activities.some((row) => row.totalFloat != null)).toBe(true);
  });

  it('layout merge does not mark CPM stale when only positions change', () => {
    const activities = [makeActivity('ca-clear'), makeActivity('ca-excavate')];
    const links = [fs('ca-clear', 'ca-excavate')];
    const precedenceDiagram = buildPrecedenceDiagramRunState({
      activities,
      logicLinks: links,
      scheduleSettings,
    });

    const merged = mergeLogicLayoutAssumptionsOnly(
      [
        { activityCode: 'ca-clear', x: 999, y: 888 },
        { activityCode: 'ca-excavate', x: 1200, y: 888 },
      ],
      { logicLinks: links, precedenceDiagram },
      { precedenceDiagram },
    );

    const recompute = recomputeCommittedCpmFromSavedState({
      precedenceDiagram: parsePrecedenceDiagramFromAssumptions(merged),
      activities,
      logicLinks: parseLogicLinksFromAssumptions(merged),
      scheduleSettings,
    });

    expect(recompute.warningMessage).not.toBe(CPM_STALE_MESSAGE);
    expect(recompute.cpmResult?.hasRunCpm).toBe(true);
  });

  it('rehydrate with construction schedule activities preserves committed CPM', () => {
    const activities = [makeActivity('ca-clear', 2), makeActivity('ca-excavate', 3)];
    const links = [fs('ca-clear', 'ca-excavate')];
    const precedenceDiagram = buildPrecedenceDiagramRunState({
      activities,
      logicLinks: links,
      scheduleSettings,
    });
    runCpmCalculation({ activities, logicLinks: links });

    const lineItemActivities = [makeActivity('legacy-a'), makeActivity('legacy-b')];
    const wrongLineItemRecompute = recomputeCommittedCpmFromSavedState({
      precedenceDiagram,
      activities: lineItemActivities,
      logicLinks: links,
      scheduleSettings,
    });
    expect(wrongLineItemRecompute.cpmResult).toBeNull();

    const constructionRecompute = recomputeCommittedCpmFromSavedState({
      precedenceDiagram,
      activities,
      logicLinks: links,
      scheduleSettings,
    });
    expect(constructionRecompute.cpmResult?.hasRunCpm).toBe(true);
    expect(constructionRecompute.warningMessage).toBeNull();
  });
});

describe('Save Layout workspace wiring', () => {
  it('persistLogicNetworkLayout uses layout-only assumptions merge and saveCurrentEstimate', () => {
    const persistBody =
      workspacePageSource.match(
        /const persistLogicNetworkLayout = useCallback\([\s\S]*?\n  \);/,
      )?.[0] ?? '';
    expect(persistBody).toContain('mergeLogicLayoutAssumptionsOnly');
    expect(persistBody).toContain('saveCurrentEstimate({');
    expect(persistBody).not.toContain('saveCurrentEstimateWithLineItems');
    expect(persistBody).not.toContain('markPrecedenceDiagramStale');
    expect(persistBody).not.toContain('setCommittedCpmResult(null)');
    expect(persistBody).not.toContain('rehydrateFromEstimate');
    expect(persistBody).toContain('assumptions: result.data.assumptions');
  });

  it('layout drag updates local state only until Save Layout persists', () => {
    const layoutChangeBody =
      workspacePageSource.match(
        /const handleLogicNetworkLayoutChange = useCallback\([\s\S]*?\n  \);/,
      )?.[0] ?? '';
    expect(layoutChangeBody).toContain('setLogicNetworkLayout(layout)');
    expect(layoutChangeBody).not.toContain('persistLogicNetworkLayout');
    expect(layoutChangeBody).not.toContain('saveCurrentEstimate');
  });

  it('top-right save uses construction-aware schedule rehydrate helper on import only', () => {
    expect(workspacePageSource).toContain('rehydrateScheduleFromEstimate');
    expect(workspacePageSource).toContain('resolveEstimateWorkspaceScheduleActivities');
    expect(workspacePageSource).toContain('resolvedScheduleActivitiesBundle.activities');
    const saveEstimateBody =
      workspacePageSource.match(
        /const handleSaveEstimate = useCallback\(async \(\) => \{[\s\S]*?\n  \}, \[/,
      )?.[0] ?? '';
    expect(saveEstimateBody).not.toContain('rehydrateScheduleFromEstimate');
  });

  it('rehydrate preserves precedence diagram view mode from saved assumptions', () => {
    expect(scheduleSettingsHookSource).toContain(
      "savedViewMode === 'precedence-diagram' ? 'precedence-diagram' : 'logic-network'",
    );
  });
});
