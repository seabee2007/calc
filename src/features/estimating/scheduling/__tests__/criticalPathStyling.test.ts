import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { calculateCpm, runCpmCalculation } from '../cpm/calculateCpm';
import { isDisplayCritical } from '../cpm/cpmDisplayCritical';
import { resolveGanttCellKind } from '../levelThreeGanttUtils';
import type { ScheduleActivity } from '../adapters/estimateLineItemsToScheduleActivities';
import { buildValidCpmDisplayFields, type CpmLogicLink, type CpmResult } from '../cpmTypes';

const cpmNodeSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../ui/components/scheduling/CpmActivityNode.tsx',
  ),
  'utf8',
);
const ganttSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../ui/components/scheduling/LevelThreeGantt.tsx',
  ),
  'utf8',
);
const ganttUtilsSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../levelThreeGanttUtils.ts'),
  'utf8',
);
const workspaceSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../ui/EstimateWorkspacePage.tsx',
  ),
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

describe('critical path styling uses display-critical validation', () => {
  it('Logic Network nodes use display-critical flags instead of math isCritical', () => {
    expect(cpmNodeSource).toContain('isDisplayCritical');
    expect(cpmNodeSource).toContain('viewMode');
    expect(cpmNodeSource).toContain('showCpmFields');
    expect(cpmNodeSource).not.toContain('cpmResult?.isCritical');
  });

  it('Level III Gantt bars use isDisplayCritical', () => {
    expect(ganttSource).toContain('isDisplayCritical');
    expect(ganttUtilsSource).toContain('isDisplayCritical');
  });

  it('resolveGanttCellKind marks only display-critical rows as critical cells', () => {
    const activities = [makeActivity('A', 5), makeActivity('B', 2), makeActivity('C', 3)];
    const links: CpmLogicLink[] = [
      {
        predecessorActivityCode: 'A',
        successorActivityCode: 'B',
        relationshipType: 'FS',
        lagDays: 0,
      },
      {
        predecessorActivityCode: 'B',
        successorActivityCode: 'C',
        relationshipType: 'FS',
        lagDays: 0,
      },
    ];
    const cpmResult = runCpmCalculation({ activities, logicLinks: links });

    expect(cpmResult.hasValidCriticalPath).toBe(true);
    expect(isDisplayCritical(cpmResult, 'A')).toBe(true);
    expect(isDisplayCritical(cpmResult, 'C')).toBe(true);

    const fixtureCpm: CpmResult = {
      activities: [
        {
          activityCode: 'A',
          earlyStart: 0,
          earlyFinish: 3,
          lateStart: 0,
          lateFinish: 3,
          totalFloat: 0,
          freeFloat: 0,
          isCritical: true,
        },
        {
          activityCode: 'B',
          earlyStart: 3,
          earlyFinish: 5,
          lateStart: 5,
          lateFinish: 7,
          totalFloat: 2,
          freeFloat: 2,
          isCritical: false,
        },
      ],
      projectDurationDays: 5,
      criticalPathActivityCodes: ['A'],
      warnings: [],
      ...buildValidCpmDisplayFields(['A'], {
        hasRunCpm: true,
        hasValidPrecedenceDiagram: true,
      }),
    };

    const criticalRow = {
      activity: activities[0],
      cpm: fixtureCpm.activities[0]!,
      leveledOffset: 0,
    };
    const noncriticalRow = {
      activity: activities[1],
      cpm: fixtureCpm.activities[1]!,
      leveledOffset: 0,
    };

    expect(resolveGanttCellKind(0, criticalRow, fixtureCpm)).toBe('critical');
    expect(resolveGanttCellKind(3, noncriticalRow, fixtureCpm)).toBe('noncritical');
  });

  it('does not mark cells critical when hasValidCriticalPath is false', () => {
    const activities = [makeActivity('A', 5), makeActivity('B', 5)];
    const cpmResult = calculateCpm({ activities, logicLinks: [] });
    const row = {
      activity: activities[0],
      cpm: cpmResult.activities[0]!,
      leveledOffset: 0,
    };

    expect(cpmResult.hasValidCriticalPath).toBe(false);
    expect(resolveGanttCellKind(0, row, cpmResult)).toBe('noncritical');
  });

  it('shows invalid critical path banner in workspace tabs', () => {
    expect(workspaceSource).toContain('No valid critical path yet');
    expect(workspaceSource).toContain('hasValidCriticalPath');
  });
});
