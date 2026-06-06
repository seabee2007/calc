import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { calculateCpm } from '../cpm/calculateCpm';
import {
  buildCpmCriticalPathPreview,
  mapCriticalActivityCodesToCandidateIds,
} from '../cpm/cpmCriticalPathPreview';
import { resolveGanttCellKind } from '../levelThreeGanttUtils';
import type { ScheduleActivity } from '../adapters/estimateLineItemsToScheduleActivities';
import type { CpmLogicLink } from '../cpmTypes';

const ganttPreviewSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../ui/components/EstimateGanttPreview.tsx',
  ),
  'utf8',
);
const logicNetworkCanvasSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../ui/components/scheduling/EstimateLogicNetworkCanvas.tsx',
  ),
  'utf8',
);
const levelThreeGanttSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../ui/components/scheduling/LevelThreeGantt.tsx',
  ),
  'utf8',
);
const estimateWorkspaceSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../ui/EstimateWorkspacePage.tsx'),
  'utf8',
);

function makeActivity(activityCode: string, durationDays: number): ScheduleActivity {
  return {
    activityCode,
    activityDescription: activityCode,
    divisionCode: '01',
    divisionName: 'General',
    durationDays,
    laborHours: 24,
    manDays: 3,
    crewDays: 3,
    crewSize: 2,
    totalCost: 1000,
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

describe('unified CPM critical path', () => {
  it('Logic Network and Level III Gantt read isCritical from calculateCpm', () => {
    const activities = [makeActivity('A', 5), makeActivity('B', 2), makeActivity('C', 3)];
    const links = [fs('A', 'B'), fs('A', 'C')];
    const cpmResult = calculateCpm({ activities, logicLinks: links });

    const criticalCodes = cpmResult.activities
      .filter((activity) => activity.isCritical)
      .map((activity) => activity.activityCode)
      .sort();

    expect(criticalCodes).toEqual(['A', 'C']);
    expect(cpmResult.activities.find((activity) => activity.activityCode === 'B')?.isCritical).toBe(
      false,
    );

    const criticalRow = {
      activity: activities[2],
      cpm: cpmResult.activities.find((activity) => activity.activityCode === 'C')!,
      leveledOffset: 0,
    };
    expect(resolveGanttCellKind(criticalRow.cpm.earlyStart, criticalRow)).toBe('critical');
    expect(logicNetworkCanvasSource).toContain('cpmResult');
    expect(levelThreeGanttSource).toContain('row.cpm.isCritical');
  });

  it('Gantt preview uses buildCpmCriticalPathPreview instead of legacy engine', () => {
    expect(ganttPreviewSource).toContain('buildCpmCriticalPathPreview');
    expect(ganttPreviewSource).not.toContain('calculateEstimateCriticalPath');
    expect(estimateWorkspaceSource).toContain('cpmResult={cpmResult}');
  });

  it('Gantt preview critical task ids map from the same CPM critical activity codes', () => {
    const activities = [makeActivity('A', 3), makeActivity('B', 4), makeActivity('C', 2)];
    const links = [fs('A', 'B'), fs('B', 'C')];
    const cpmResult = calculateCpm({ activities, logicLinks: links });
    const preview = buildCpmCriticalPathPreview({
      cpmResult,
      plan: {
        projectStartDate: '2026-06-01',
        divisions: [
          {
            key: '01',
            label: 'General',
            scopes: [
              {
                key: 'scope',
                label: 'Scope',
                tasks: [
                  {
                    candidateId: 'task-a',
                    activityCode: 'A',
                    title: 'A',
                    plannedStartDate: '2026-06-01',
                    plannedEndDate: '2026-06-03',
                    labor: { durationDays: 3, laborHours: 24, manDays: 3, crewDays: 3, crewSize: 2 },
                    weatherSensitive: false,
                    inspectionRequired: false,
                    predecessorCandidateIds: [],
                  },
                  {
                    candidateId: 'task-b',
                    activityCode: 'B',
                    title: 'B',
                    plannedStartDate: '2026-06-04',
                    plannedEndDate: '2026-06-07',
                    labor: { durationDays: 4, laborHours: 32, manDays: 4, crewDays: 4, crewSize: 2 },
                    weatherSensitive: false,
                    inspectionRequired: false,
                    predecessorCandidateIds: ['task-a'],
                  },
                  {
                    candidateId: 'task-c',
                    activityCode: 'C',
                    title: 'C',
                    plannedStartDate: '2026-06-08',
                    plannedEndDate: '2026-06-09',
                    labor: { durationDays: 2, laborHours: 16, manDays: 2, crewDays: 2, crewSize: 2 },
                    weatherSensitive: false,
                    inspectionRequired: false,
                    predecessorCandidateIds: ['task-b'],
                  },
                ],
              },
            ],
          },
        ],
      },
      projectStartDate: '2026-06-01',
    });

    expect(preview.criticalActivityCodes.sort()).toEqual(['A', 'B', 'C']);
    expect(preview.criticalTaskIds.sort()).toEqual(['task-a', 'task-b', 'task-c']);
    expect(preview.warnings).toEqual(cpmResult.warnings);
    expect(
      mapCriticalActivityCodesToCandidateIds(preview.criticalActivityCodes, new Map([
        ['A', 'task-a'],
        ['B', 'task-b'],
        ['C', 'task-c'],
      ])),
    ).toEqual(['task-a', 'task-b', 'task-c']);
  });

  it('critical path warnings are shared from calculateCpm', () => {
    const activities = [makeActivity('A', 5), makeActivity('B', 5)];
    const cpmResult = calculateCpm({ activities, logicLinks: [] });
    const preview = buildCpmCriticalPathPreview({
      cpmResult,
      plan: null,
      projectStartDate: '2026-06-01',
    });

    expect(preview.warnings.some((warning) => warning.includes('not connected through logic links'))).toBe(
      true,
    );
  });

  it('no schedule UI uses visual chain order for critical styling', () => {
    expect(logicNetworkCanvasSource).not.toContain('criticalPathActivityCodes');
    expect(levelThreeGanttSource).not.toContain('criticalPathActivityCodes');
    expect(ganttPreviewSource).not.toContain('calculateEstimateCriticalPath');
  });
});
