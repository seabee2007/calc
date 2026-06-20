import { describe, expect, it } from 'vitest';
import type { CpmActivityResult } from '../cpmTypes';
import type { ScheduleActivity } from '../adapters/estimateLineItemsToScheduleActivities';
import type { EffectiveScheduleAnalysis } from '../effectiveSchedule';
import { buildLogicNetworkNodes } from '../../ui/components/scheduling/EstimateLogicNetworkCanvas';
import { buildLogicNetworkTopology } from '../logic/logicNetworkTopology';
import {
  LOGIC_NETWORK_COLUMN_SPACING,
  LOGIC_NETWORK_NODE_HEIGHT,
  LOGIC_NETWORK_NODE_WIDTH,
  LOGIC_NETWORK_ROW_SPACING,
  NODE_HORIZONTAL_GAP,
  autoLayoutNodePosition,
  buildAutoLayoutFromActivities,
  resolveLogicNetworkNodePosition,
} from '../logicNetworkLayout';
import { autoLayoutLogicNetwork } from '../logic/autoLayoutLogicNetwork';

function makeActivity(code: string, durationDays: number): ScheduleActivity {
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

function makeCpm(code: string, earlyStart: number, durationDays: number): CpmActivityResult {
  return {
    activityCode: code,
    earlyStart,
    earlyFinish: earlyStart + durationDays,
    lateStart: earlyStart,
    lateFinish: earlyStart + durationDays,
    totalFloat: 0,
    freeFloat: 0,
    isCritical: true,
  };
}

function makeLeveledAnalysis(
  entries: Array<{
    activityCode: string;
    leveledStartDayIndex: number;
    leveledOffsetDays: number;
  }>,
): EffectiveScheduleAnalysis {
  const byActivityCode = new Map(
    entries.map((entry) => [
      entry.activityCode,
      {
        activityCode: entry.activityCode,
        cpmEarlyStart: 0,
        cpmEarlyFinish: 1,
        leveledOffsetDays: entry.leveledOffsetDays,
        leveledStartDayIndex: entry.leveledStartDayIndex,
        leveledFinishDayIndex: entry.leveledStartDayIndex + 1,
        plannedStart: '2026-01-01',
        plannedFinish: '2026-01-02',
        effectiveTotalFloat: 0,
        controllingAfterLeveling: false,
        baselineTotalFloat: 0,
        baselineFreeFloat: 0,
      },
    ]),
  );
  return {
    levelingApplied: true,
    cpmBaselineDurationDays: 1,
    leveledDurationDays: 171,
    effectiveDurationDays: 171,
    leveledProjectFinishIndex: 172,
    plannedProjectStart: '2026-01-01',
    plannedProjectFinish: '2026-06-01',
    controllingActivityCodes: [],
    byActivityCode,
    effectiveLeveledLinks: [],
    generatedLeveledFsLinks: [],
    leveledCpmResult: null,
  };
}

describe('logic network topology-only layout', () => {
  it('uses fixed node width constants independent of duration', () => {
    expect(LOGIC_NETWORK_NODE_WIDTH).toBe(220);
    expect(LOGIC_NETWORK_NODE_HEIGHT).toBe(118);
    expect(NODE_HORIZONTAL_GAP).toBe(280);
    expect(LOGIC_NETWORK_COLUMN_SPACING).toBe(280);
    expect(LOGIC_NETWORK_ROW_SPACING).toBe(190);
  });

  it('does not derive fallback layout X from CPM earlyStart', () => {
    const short = autoLayoutNodePosition(makeActivity('SHORT', 1), 0);
    const long = autoLayoutNodePosition(makeActivity('LONG', 171), 1);
    expect(short.x).toBe(long.x);
    expect(long.y - short.y).toBe(LOGIC_NETWORK_ROW_SPACING);
  });

  it('places a 171-day successor in the adjacent dependency column, not time-scaled X', () => {
    const activities = [makeActivity('A', 1), makeActivity('B', 171)];
    const links = [
      {
        predecessorActivityCode: 'A',
        successorActivityCode: 'B',
        relationshipType: 'FS' as const,
        lagDays: 0,
      },
    ];
    const { layout } = autoLayoutLogicNetwork({ activities, logicLinks: links });
    const byCode = new Map(layout.map((entry) => [entry.activityCode, entry]));

    expect(byCode.get('A')!.x).toBeLessThan(byCode.get('B')!.x);
    expect(byCode.get('B')!.x - byCode.get('A')!.x).toBe(LOGIC_NETWORK_COLUMN_SPACING);
    expect(byCode.get('B')!.x).toBeLessThan(500);
  });

  it('changing duration does not change topology-derived node position', () => {
    const links = [
      {
        predecessorActivityCode: 'A',
        successorActivityCode: 'B',
        relationshipType: 'FS' as const,
        lagDays: 0,
      },
    ];
    const shortLayout = buildAutoLayoutFromActivities(
      [makeActivity('A', 1), makeActivity('B', 1)],
      links,
    );
    const longLayout = buildAutoLayoutFromActivities(
      [makeActivity('A', 1), makeActivity('B', 171)],
      links,
    );
    const shortB = shortLayout.find((entry) => entry.activityCode === 'B');
    const longB = longLayout.find((entry) => entry.activityCode === 'B');
    expect(shortB).toEqual(longB);
  });

  it('changing ES/EF does not change saved layout position', () => {
    const saved = { activityCode: 'B', x: 360, y: 80 };
    const withEarlyStart = resolveLogicNetworkNodePosition(
      makeActivity('B', 171),
      1,
      saved,
      { earlyStart: 171, durationDays: 171 },
    );
    const withDifferentStart = resolveLogicNetworkNodePosition(
      makeActivity('B', 171),
      1,
      saved,
      { earlyStart: 5, durationDays: 171 },
    );
    expect(withEarlyStart).toEqual({ x: 360, y: 80 });
    expect(withDifferentStart).toEqual({ x: 360, y: 80 });
  });

  it('resource-leveled offsets do not change node X/Y in buildLogicNetworkNodes', () => {
    const activities = [makeActivity('A', 1), makeActivity('B', 171)];
    const layout = buildAutoLayoutFromActivities(activities, [
      {
        predecessorActivityCode: 'A',
        successorActivityCode: 'B',
        relationshipType: 'FS',
        lagDays: 0,
      },
    ]);
    const topology = buildLogicNetworkTopology(activities, []);
    const baselineNodes = buildLogicNetworkNodes(activities, null, layout, {
      viewMode: 'precedence-diagram',
      logicTopology: topology,
      showCpmFields: true,
      leveledViewActive: false,
    });
    const leveledNodes = buildLogicNetworkNodes(activities, null, layout, {
      viewMode: 'precedence-diagram',
      logicTopology: topology,
      showCpmFields: true,
      leveledViewActive: true,
      effectiveAnalysis: makeLeveledAnalysis([
        { activityCode: 'A', leveledStartDayIndex: 0, leveledOffsetDays: 0 },
        { activityCode: 'B', leveledStartDayIndex: 171, leveledOffsetDays: 120 },
      ]),
    });

    expect(leveledNodes.find((node) => node.id === 'node-B')?.position).toEqual(
      baselineNodes.find((node) => node.id === 'node-B')?.position,
    );
    expect(leveledNodes.find((node) => node.id === 'node-B')?.position.x).toBeLessThan(500);
  });

  it('connected activities in adjacent ranks produce short connector span', () => {
    const activities = [makeActivity('A', 1), makeActivity('B', 171)];
    const layout = buildAutoLayoutFromActivities(activities, [
      {
        predecessorActivityCode: 'A',
        successorActivityCode: 'B',
        relationshipType: 'FS',
        lagDays: 0,
      },
    ]);
    const a = layout.find((entry) => entry.activityCode === 'A')!;
    const b = layout.find((entry) => entry.activityCode === 'B')!;
    const connectorSpan = Math.hypot(b.x - a.x, b.y - a.y);
    expect(connectorSpan).toBe(LOGIC_NETWORK_COLUMN_SPACING);
    expect(connectorSpan).toBeLessThan(400);
  });

  it('preserves manual saved positions regardless of schedule hints', () => {
    const manual = { activityCode: 'B', x: 1200, y: 450 };
    const position = resolveLogicNetworkNodePosition(makeActivity('B', 171), 0, manual, {
      earlyStart: 171,
      leveledStartDayIndex: 171,
      leveledOffsetDays: 90,
      durationDays: 171,
    });
    expect(position).toEqual({ x: 1200, y: 450 });
  });

  it('critical-path styling still uses CPM results independent of node coordinates', () => {
    const activities = [makeActivity('A', 1), makeActivity('B', 171)];
    const layout = buildAutoLayoutFromActivities(activities, [
      {
        predecessorActivityCode: 'A',
        successorActivityCode: 'B',
        relationshipType: 'FS',
        lagDays: 0,
      },
    ]);
    const cpmResult = {
      hasRunCpm: true,
      hasValidCriticalPath: true,
      criticalPathStatus: 'valid' as const,
      activities: [makeCpm('A', 0, 1), makeCpm('B', 171, 171)],
      displayCriticalActivityCodes: ['A', 'B'],
      validCriticalPathActivityCodes: ['A', 'B'],
      projectDuration: 342,
      hasValidPrecedenceDiagram: true,
      hardErrors: [],
    };
    const topology = buildLogicNetworkTopology(activities, [
      {
        predecessorActivityCode: 'A',
        successorActivityCode: 'B',
        relationshipType: 'FS',
        lagDays: 0,
      },
    ]);
    const nodes = buildLogicNetworkNodes(activities, cpmResult, layout, {
      viewMode: 'precedence-diagram',
      logicTopology: topology,
      showCpmFields: true,
    });
    expect(nodes.find((node) => node.id === 'node-B')?.data.isDisplayCritical).toBe(true);
    expect(nodes.find((node) => node.id === 'node-B')?.position.x).toBeLessThan(500);
  });
});
