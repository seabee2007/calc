import { describe, expect, it } from 'vitest';
import { buildLogicNetworkNodes } from '../../ui/components/scheduling/EstimateLogicNetworkCanvas';
import {
  LOGIC_NETWORK_CANVAS_HEIGHT_CLASS,
  autoLayoutNodePosition,
  buildAutoLayoutFromActivities,
  resolveLogicNetworkNodePosition,
} from '../logicNetworkLayout';
import type { ScheduleActivity } from '../adapters/estimateLineItemsToScheduleActivities';

function makeActivity(code: string): ScheduleActivity {
  return {
    activityCode: code,
    activityDescription: code,
    divisionCode: '01',
    divisionName: 'General',
    durationDays: 3,
    laborHours: 0,
    manDays: 0,
    crewDays: 0,
    crewSize: 2,
    totalCost: 0,
    relationshipType: 'FS',
    lagDays: 0,
  };
}

describe('logicNetworkLayout', () => {
  it('canvas wrapper class includes explicit min height', () => {
    expect(LOGIC_NETWORK_CANVAS_HEIGHT_CLASS).toContain('min-h-[640px]');
    expect(LOGIC_NETWORK_CANVAS_HEIGHT_CLASS).toContain('h-[calc(100vh-300px)]');
    expect(LOGIC_NETWORK_CANVAS_HEIGHT_CLASS).toContain('w-full');
  });

  it('auto-layout uses CPM earlyStart when no saved layout', () => {
    const pos = autoLayoutNodePosition(makeActivity('A'), 0, {
      activityCode: 'A',
      earlyStart: 5,
      earlyFinish: 8,
      lateStart: 5,
      lateFinish: 8,
      totalFloat: 0,
      freeFloat: 0,
      isCritical: true,
    });
    expect(pos.x).toBe(5 * 160);
    expect(pos.y).toBe(0);
  });

  it('resolveLogicNetworkNodePosition prefers saved layout', () => {
    const pos = resolveLogicNetworkNodePosition(
      makeActivity('A'),
      0,
      { activityCode: 'A', x: 99, y: 88 },
      undefined,
    );
    expect(pos).toEqual({ x: 99, y: 88 });
  });

  it('buildLogicNetworkNodes renders nodes without saved layout', () => {
    const activities = [makeActivity('A'), makeActivity('B')];
    const nodes = buildLogicNetworkNodes(activities, null, []);
    expect(nodes).toHaveLength(2);
    expect(nodes[0].id).toBe('node-A');
    expect(nodes[1].position.y).toBeGreaterThan(nodes[0].position.y);
  });

  it('buildAutoLayoutFromActivities returns layout for every activity', () => {
    const activities = [makeActivity('A'), makeActivity('B'), makeActivity('C')];
    const layout = buildAutoLayoutFromActivities(activities, {
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
          earlyFinish: 6,
          lateStart: 3,
          lateFinish: 6,
          totalFloat: 0,
          freeFloat: 0,
          isCritical: true,
        },
        {
          activityCode: 'C',
          earlyStart: 6,
          earlyFinish: 9,
          lateStart: 6,
          lateFinish: 9,
          totalFloat: 0,
          freeFloat: 0,
          isCritical: true,
        },
      ],
      projectDurationDays: 9,
      criticalPathActivityCodes: ['A', 'B', 'C'],
      warnings: [],
    });
    expect(layout).toHaveLength(3);
    expect(layout[1].x).toBe(3 * 160);
  });
});
