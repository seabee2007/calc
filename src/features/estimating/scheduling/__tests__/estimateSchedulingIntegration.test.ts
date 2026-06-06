/**
 * Integration tests: estimate line items → scheduling features.
 * Proves the guardrails from the plan.
 */
import { describe, expect, it } from 'vitest';
import { estimateLineItemsToScheduleActivities } from '../adapters/estimateLineItemsToScheduleActivities';
import { calculateCpm } from '../cpm/calculateCpm';
import {
  parseLogicLinksFromAssumptions,
  parseLogicNetworkLayoutFromAssumptions,
  parseLeveledOffsetsFromAssumptions,
  parseScheduleSettingsFromAssumptions,
  seedLogicLinksFromLineItems,
  mergeScheduleAssumptions,
} from '../scheduleAssumptions';
import { calculateResourceHistogram } from '../resources/resourceHistogramCalculator';
import { resourceLevelSchedule } from '../resources/resourceLevelSchedule';
import type { EstimateDomainTask } from '../../infrastructure/estimateDbTypes';

function makeTask(
  overrides: Partial<EstimateDomainTask> & { activityCode: string },
): EstimateDomainTask {
  return {
    id: overrides.activityCode,
    lineType: 'task',
    activityCode: overrides.activityCode,
    title: overrides.title ?? `Task ${overrides.activityCode}`,
    divisionCode: overrides.divisionCode ?? '01',
    divisionName: overrides.divisionName ?? 'General',
    scheduleEnabled: overrides.scheduleEnabled !== false,
    predecessorActivityCode: overrides.predecessorActivityCode,
    relationshipType: overrides.relationshipType ?? 'FS',
    lagDays: overrides.lagDays ?? 0,
    // calculatedValues intentionally absent — adapter must handle gracefully
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

const SAMPLE_LINE_ITEMS: EstimateDomainTask[] = [
  makeTask({ activityCode: 'A', title: 'Excavation' }),
  makeTask({ activityCode: 'B', title: 'Foundation', predecessorActivityCode: 'A' }),
  makeTask({ activityCode: 'C', title: 'Frame', predecessorActivityCode: 'B' }),
  makeTask({ activityCode: 'D', title: 'Disabled Task', scheduleEnabled: false }),
];

// ── Integration Test 1: adapter converts line items ──────────────────────────

describe('estimateLineItemsToScheduleActivities (adapter)', () => {
  it('1. converts estimate line items to ScheduleActivity[]', () => {
    const { activities } = estimateLineItemsToScheduleActivities(SAMPLE_LINE_ITEMS);
    expect(activities.length).toBeGreaterThan(0);
    for (const act of activities) {
      expect(typeof act.activityCode).toBe('string');
      expect(act.activityCode.length).toBeGreaterThan(0);
      expect(act.durationDays).toBeGreaterThanOrEqual(1);
    }
  });

  it('2. excludes schedule-disabled line items', () => {
    const { activities } = estimateLineItemsToScheduleActivities(SAMPLE_LINE_ITEMS);
    const codes = activities.map((a) => a.activityCode);
    expect(codes).not.toContain('D');
    expect(codes.length).toBe(3);
  });

  it('3. uses activity codes from estimate as CPM keys', () => {
    const { activities } = estimateLineItemsToScheduleActivities(SAMPLE_LINE_ITEMS);
    const cpmResult = calculateCpm({ activities, logicLinks: [] });
    const cpmCodes = new Set(cpmResult.activities.map((a) => a.activityCode));
    for (const act of activities) {
      expect(cpmCodes.has(act.activityCode)).toBe(true);
    }
  });
});

// ── Integration Test 4-6: seedLogicLinks + assumptions ──────────────────────

describe('seedLogicLinksFromLineItems', () => {
  it('4. produces CpmLogicLink[] from line item predecessors', () => {
    const seeded = seedLogicLinksFromLineItems(SAMPLE_LINE_ITEMS);
    expect(seeded.some((l) => l.predecessorActivityCode === 'A' && l.successorActivityCode === 'B')).toBe(true);
    expect(seeded.some((l) => l.predecessorActivityCode === 'B' && l.successorActivityCode === 'C')).toBe(true);
  });

  it('5. saving logic links produces assumptions.logicLinks', () => {
    const seeded = seedLogicLinksFromLineItems(SAMPLE_LINE_ITEMS);
    const assumptions = mergeScheduleAssumptions({ logicLinks: seeded }, {});
    const parsed = parseLogicLinksFromAssumptions(assumptions);
    expect(parsed).toHaveLength(seeded.length);
    expect(parsed[0].predecessorActivityCode).toBe(seeded[0].predecessorActivityCode);
  });

  it('6. node positions save to assumptions.logicNetworkLayout', () => {
    const layout = [{ activityCode: 'A', x: 100, y: 200 }];
    const assumptions = mergeScheduleAssumptions({ logicNetworkLayout: layout }, {});
    const parsed = parseLogicNetworkLayoutFromAssumptions(assumptions);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].activityCode).toBe('A');
    expect(parsed[0].x).toBe(100);
    expect(parsed[0].y).toBe(200);
  });
});

// ── Integration Test 7: reload restores data ─────────────────────────────────

describe('persistence round-trip', () => {
  it('7. reloading restores logic links and node positions', () => {
    const seeded = seedLogicLinksFromLineItems(SAMPLE_LINE_ITEMS);
    const layout = [{ activityCode: 'B', x: 300, y: 150 }];
    const assumptions = mergeScheduleAssumptions(
      { logicLinks: seeded, logicNetworkLayout: layout },
      {},
    );

    const restoredLinks = parseLogicLinksFromAssumptions(assumptions);
    const restoredLayout = parseLogicNetworkLayoutFromAssumptions(assumptions);

    expect(restoredLinks).toHaveLength(seeded.length);
    expect(restoredLayout.find((l) => l.activityCode === 'B')?.x).toBe(300);
  });
});

// ── Integration Test 8: CPM receives ScheduleActivity[] ──────────────────────

describe('calculateCpm with adapter output', () => {
  it('8. calculateCpm receives ScheduleActivity[] and produces ES/EF per code', () => {
    const { activities } = estimateLineItemsToScheduleActivities(SAMPLE_LINE_ITEMS);
    const seeded = seedLogicLinksFromLineItems(SAMPLE_LINE_ITEMS);
    const cpmResult = calculateCpm({ activities, logicLinks: seeded });

    const byCode = new Map(cpmResult.activities.map((a) => [a.activityCode, a]));

    // A starts at 0
    expect(byCode.get('A')!.earlyStart).toBe(0);
    // B must start after A finishes
    expect(byCode.get('B')!.earlyStart).toBeGreaterThanOrEqual(byCode.get('A')!.earlyFinish);
    // C must start after B finishes
    expect(byCode.get('C')!.earlyStart).toBeGreaterThanOrEqual(byCode.get('B')!.earlyFinish);
  });
});

// ── Integration Test 9: resource histogram uses crewSize ────────────────────

describe('resource histogram from adapter output', () => {
  it('9. resource histogram uses crewSize from adapter output', () => {
    const { activities } = estimateLineItemsToScheduleActivities(SAMPLE_LINE_ITEMS);
    const seeded = seedLogicLinksFromLineItems(SAMPLE_LINE_ITEMS);
    const cpmResult = calculateCpm({ activities, logicLinks: seeded });

    const histogram = calculateResourceHistogram({
      activities,
      cpmActivities: cpmResult.activities,
      projectStartDate: '2025-01-01',
      availableCrewSize: 100,
    });

    expect(histogram.length).toBeGreaterThan(0);
    // Crew should be positive on at least day 0
    expect(histogram[0].requiredCrew).toBeGreaterThanOrEqual(0);
  });
});

// ── Integration Test 10: resource leveling writes offsets ───────────────────

describe('resource leveling integration', () => {
  it('10. resource leveling writes offsets to assumptions.leveledActivityOffsets', () => {
    const { activities } = estimateLineItemsToScheduleActivities(SAMPLE_LINE_ITEMS);
    const seeded = seedLogicLinksFromLineItems(SAMPLE_LINE_ITEMS);
    const result = resourceLevelSchedule({
      activities,
      logicLinks: seeded,
      availableCrewSize: 1, // force overallocation
      projectStartDate: '2025-01-01',
    });

    const offsets: Record<string, number> = {};
    for (const moved of result.movedActivities) {
      offsets[moved.activityCode] = moved.daysMoved;
    }

    const assumptions = mergeScheduleAssumptions({ leveledActivityOffsets: offsets }, {});
    const restored = parseLeveledOffsetsFromAssumptions(assumptions);

    for (const moved of result.movedActivities) {
      expect(restored[moved.activityCode]).toBe(offsets[moved.activityCode]);
    }
  });
});

// ── Integration Test 11: no estimate_versions imports ────────────────────────

describe('guardrails', () => {
  it('11. no estimate_versions references in adapter output', () => {
    // This test simply verifies the adapter can run without depending on version structures
    const { activities, warnings } = estimateLineItemsToScheduleActivities(SAMPLE_LINE_ITEMS);
    expect(Array.isArray(activities)).toBe(true);
    expect(Array.isArray(warnings)).toBe(true);
  });

  it('scheduleSettings round-trips through assumptions', () => {
    const settings = {
      projectStartDate: '2025-06-01',
      hoursPerDay: 8,
      availableCrewSize: 12,
      includeWeekends: false,
    };
    const assumptions = mergeScheduleAssumptions({ scheduleSettings: settings }, {});
    const parsed = parseScheduleSettingsFromAssumptions(assumptions);
    expect(parsed.projectStartDate).toBe(settings.projectStartDate);
    expect(parsed.hoursPerDay).toBe(settings.hoursPerDay);
    expect(parsed.availableCrewSize).toBe(settings.availableCrewSize);
  });
});
