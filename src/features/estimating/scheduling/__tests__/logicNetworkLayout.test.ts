import { describe, expect, it } from 'vitest';
import { buildLogicNetworkNodes } from '../../ui/components/scheduling/EstimateLogicNetworkCanvas';
import { buildLogicNetworkTopology } from '../logic/logicNetworkTopology';
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
    const topology = buildLogicNetworkTopology(activities, []);
    const nodes = buildLogicNetworkNodes(activities, null, [], {
      viewMode: 'logic-network',
      logicTopology: topology,
      showCpmFields: false,
    });
    expect(nodes).toHaveLength(2);
    expect(nodes[0].id).toBe('node-A');
    expect(nodes[1].position.y).toBeGreaterThan(nodes[0].position.y);
  });

  it('buildAutoLayoutFromActivities returns dependency layout for every activity', () => {
    const activities = [makeActivity('A'), makeActivity('B'), makeActivity('C')];
    const links = [
      {
        predecessorActivityCode: 'A',
        successorActivityCode: 'B',
        relationshipType: 'FS' as const,
        lagDays: 0,
      },
      {
        predecessorActivityCode: 'B',
        successorActivityCode: 'C',
        relationshipType: 'FS' as const,
        lagDays: 0,
      },
    ];
    const layout = buildAutoLayoutFromActivities(activities, links);
    const byCode = new Map(layout.map((entry) => [entry.activityCode, entry]));

    expect(layout).toHaveLength(3);
    expect(byCode.get('A')!.x).toBeLessThan(byCode.get('B')!.x);
    expect(byCode.get('B')!.x).toBeLessThan(byCode.get('C')!.x);
  });
});
