import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { calculateCpm } from '../cpm/calculateCpm';
import { resolveGanttCellKind } from '../levelThreeGanttUtils';
import type { ScheduleActivity } from '../adapters/estimateLineItemsToScheduleActivities';
import type { CpmLogicLink } from '../cpmTypes';

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

describe('critical path styling uses CPM float, not visual chain order', () => {
  it('Logic Network nodes read isCritical from CPM results', () => {
    expect(cpmNodeSource).toContain('cpmResult?.isCritical');
    expect(cpmNodeSource).toContain('border-red-500');
    expect(cpmNodeSource).not.toContain('criticalPathActivityCodes');
  });

  it('Level III Gantt bars read isCritical from CPM results', () => {
    expect(ganttSource).toContain('row.cpm.isCritical');
    expect(ganttSource).toContain('bg-red-500');
    expect(ganttUtilsSource).toContain('row.cpm.isCritical');
  });

  it('resolveGanttCellKind marks only isCritical rows as critical cells', () => {
    const activities = [makeActivity('A', 5), makeActivity('B', 2), makeActivity('C', 3)];
    const links: CpmLogicLink[] = [
      {
        predecessorActivityCode: 'A',
        successorActivityCode: 'B',
        relationshipType: 'FS',
        lagDays: 0,
      },
      {
        predecessorActivityCode: 'A',
        successorActivityCode: 'C',
        relationshipType: 'FS',
        lagDays: 0,
      },
    ];
    const cpmResult = calculateCpm({ activities, logicLinks: links });
    const critical = cpmResult.activities.find((activity) => activity.activityCode === 'C')!;
    const noncritical = cpmResult.activities.find((activity) => activity.activityCode === 'B')!;

    expect(critical.isCritical).toBe(true);
    expect(noncritical.isCritical).toBe(false);

    const criticalRow = {
      activity: activities[2],
      cpm: critical,
      leveledOffset: 0,
    };
    const noncriticalRow = {
      activity: activities[1],
      cpm: noncritical,
      leveledOffset: 0,
    };

    expect(resolveGanttCellKind(critical.earlyStart, criticalRow)).toBe('critical');
    expect(resolveGanttCellKind(noncritical.earlyStart, noncriticalRow)).toBe('noncritical');
  });
});
