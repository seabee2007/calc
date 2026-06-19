import { describe, expect, it } from 'vitest';
import { runCpmCalculation } from '../cpm/calculateCpm';
import {
  getEffectiveScheduleAnalysis,
  type ResourceLeveledDelayRecord,
} from '../effectiveSchedule';
import { linkToEdge } from '../../ui/components/scheduling/EstimateLogicNetworkCanvas';
import type { ScheduleActivity } from '../adapters/estimateLineItemsToScheduleActivities';
import type { CpmLogicLink } from '../cpmTypes';

const RED = '#ef4444';

/**
 * GU26-200-shaped fixture.
 *
 * Baseline links:
 *   06-01-03 Decking → 06-01-04 Stairs
 *   06-01-03 Decking → 06-01-05 Railing
 *   06-01-04 Stairs  → 09-01-01 Stain
 *   06-01-05 Railing → 09-01-01 Stain
 *   07-01-01 Flashing→ 09-01-01 Stain
 *
 * Baseline floats: Stairs = 1, Railing = 0, Stain = 0 (matches the user's export).
 * Resource leveling serializes Railing before Stairs (crew limit), delaying
 * Stairs by 3 days and cascading Stain by 2 days.
 */
const DECKING = '06-01-03';
const STAIRS = '06-01-04';
const RAILING = '06-01-05';
const FLASHING = '07-01-01';
const STAIN = '09-01-01';

function makeActivity(activityCode: string, durationDays: number): ScheduleActivity {
  return {
    activityCode,
    activityDescription: activityCode,
    divisionCode: '06',
    divisionName: 'Wood',
    durationDays,
    laborHours: 8 * durationDays,
    manDays: durationDays,
    crewDays: durationDays,
    crewSize: 1,
    totalCost: 1000,
    relationshipType: 'FS',
    lagDays: 0,
  };
}

function fs(pred: string, succ: string): CpmLogicLink {
  return { predecessorActivityCode: pred, successorActivityCode: succ, relationshipType: 'FS', lagDays: 0 };
}

const ACTIVITIES: ScheduleActivity[] = [
  makeActivity(DECKING, 3),
  makeActivity(STAIRS, 2),
  makeActivity(RAILING, 3),
  makeActivity(FLASHING, 2),
  makeActivity(STAIN, 2),
];

const LINKS: CpmLogicLink[] = [
  fs(DECKING, STAIRS),
  fs(DECKING, RAILING),
  fs(STAIRS, STAIN),
  fs(RAILING, STAIN),
  fs(FLASHING, STAIN),
];

const PROJECT_START = '2026-01-01';

// Leveling cascade: Stairs +3 (3→6), Stain +2 (6→8).
const LEVELED_OFFSETS: Record<string, number> = { [STAIRS]: 3, [STAIN]: 2 };

const DELAY_RECORDS: ResourceLeveledDelayRecord[] = [
  { activityCode: STAIRS, resourceProviderActivityCodes: [RAILING] },
];

function baselineCpm() {
  return runCpmCalculation({ activities: ACTIVITIES, logicLinks: LINKS });
}

function leveledAnalysis() {
  return getEffectiveScheduleAnalysis({
    baselineCpmResult: baselineCpm(),
    activities: ACTIVITIES,
    logicLinks: LINKS,
    leveledActivityOffsets: LEVELED_OFFSETS,
    resourceLeveledDelayRecords: DELAY_RECORDS,
    projectStartDate: PROJECT_START,
  });
}

function isGenerated(link: CpmLogicLink): boolean {
  return link.generated === true || link.source === 'resource_leveling';
}

describe('effectiveSchedule — Resource-Leveled minimal fix', () => {
  it('baseline fixture has Stairs float 1, Railing/Stain float 0', () => {
    const cpm = baselineCpm();
    const byCode = new Map(cpm.activities.map((a) => [a.activityCode, a]));
    expect(byCode.get(STAIRS)!.totalFloat).toBe(1);
    expect(byCode.get(RAILING)!.totalFloat).toBe(0);
    expect(byCode.get(STAIN)!.totalFloat).toBe(0);
  });

  it('1. effectiveTotalFloat comes from the real leveled CPM backward pass', () => {
    const analysis = leveledAnalysis();
    expect(analysis).not.toBeNull();
    // Float is now a real CPM backward pass on baseline links + resource dummy
    // links (not the old baselineTF - offset heuristic). The leveled controlling
    // chain Decking → Railing → Stairs → Stain is zero-float; Flashing keeps the
    // slack it genuinely has against the extended (10-day) finish.
    const byCode = analysis!.byActivityCode;
    expect(byCode.get(DECKING)!.effectiveTotalFloat).toBe(0);
    expect(byCode.get(RAILING)!.effectiveTotalFloat).toBe(0);
    expect(byCode.get(STAIRS)!.effectiveTotalFloat).toBe(0);
    expect(byCode.get(STAIN)!.effectiveTotalFloat).toBe(0);
    expect(byCode.get(FLASHING)!.effectiveTotalFloat).toBe(6);
    // effectiveTotalFloat is exactly the leveled CPM total float.
    const leveled = new Map(analysis!.leveledCpmResult!.activities.map((a) => [a.activityCode, a]));
    for (const [code, entry] of byCode) {
      expect(entry.effectiveTotalFloat).toBe(leveled.get(code)!.totalFloat);
    }
  });

  it('leveled CPM reproduces the leveled schedule exactly (baseline ES/EF + offset)', () => {
    const analysis = leveledAnalysis();
    const cpm = baselineCpm();
    const baseByCode = new Map(cpm.activities.map((a) => [a.activityCode, a]));
    const leveled = new Map(
      analysis!.leveledCpmResult!.activities.map((a) => [a.activityCode, a]),
    );
    // HARD reproduction guarantee for GU26-200: running CPM on baseline links +
    // provider-derived dummy links must land every activity exactly where the
    // leveled schedule (baselineES + offset) put it.
    for (const activity of ACTIVITIES) {
      const code = activity.activityCode;
      const offset = LEVELED_OFFSETS[code] ?? 0;
      const expectedEarlyStart = baseByCode.get(code)!.earlyStart + offset;
      const expectedEarlyFinish = expectedEarlyStart + activity.durationDays;
      expect(leveled.get(code)!.earlyStart).toBe(expectedEarlyStart);
      expect(leveled.get(code)!.earlyFinish).toBe(expectedEarlyFinish);
    }
    // Stairs ES6/EF8, Stain ES8/EF10, project duration 10.
    expect(leveled.get(STAIRS)!.earlyStart).toBe(6);
    expect(leveled.get(STAIRS)!.earlyFinish).toBe(8);
    expect(leveled.get(STAIN)!.earlyStart).toBe(8);
    expect(leveled.get(STAIN)!.earlyFinish).toBe(10);
    expect(analysis!.leveledDurationDays).toBe(10);
  });

  it('2. leveled edge-critical set equals leveled node-critical (controlling) set', () => {
    const analysis = leveledAnalysis();
    const edgeCritical = new Set(analysis!.leveledCpmResult!.validCriticalPathActivityCodes);
    const nodeCritical = new Set(analysis!.controllingActivityCodes);
    expect([...edgeCritical].sort()).toEqual([...nodeCritical].sort());
    // GU26-200 expectation: Railing, Stairs, Stain all controlling after leveling.
    expect(nodeCritical.has(RAILING)).toBe(true);
    expect(nodeCritical.has(STAIRS)).toBe(true);
    expect(nodeCritical.has(STAIN)).toBe(true);
  });

  it('3. rendered links contain no date/sibling-generated links — only baseline + provider dummies', () => {
    const analysis = leveledAnalysis();
    const rendered = analysis!.effectiveLeveledLinks;
    const generated = rendered.filter(isGenerated);
    // Every generated rendered link must be a provider-derived resource dummy
    // (present in generatedLeveledFsLinks) — never a sibling/date link.
    const dummyKeys = new Set(
      analysis!.generatedLeveledFsLinks.map(
        (l) => `${l.predecessorActivityCode}->${l.successorActivityCode}`,
      ),
    );
    for (const link of generated) {
      expect(link.source).toBe('resource_leveling');
      expect(link.reason).toBe('crew_limit');
      expect(link.relationshipType).toBe('FS');
      expect(dummyKeys.has(`${link.predecessorActivityCode}->${link.successorActivityCode}`)).toBe(
        true,
      );
    }
    // Baseline saved links are all preserved.
    for (const baseline of LINKS) {
      expect(
        rendered.some(
          (l) =>
            l.predecessorActivityCode === baseline.predecessorActivityCode &&
            l.successorActivityCode === baseline.successorActivityCode &&
            !isGenerated(l),
        ),
      ).toBe(true);
    }
    // Exactly baseline links + the single provider dummy, nothing extra.
    expect(rendered.length).toBe(LINKS.length + 1);
  });

  it('4. provider-derived dummy link comes from the provider record (Railing → Stairs)', () => {
    const analysis = leveledAnalysis();
    expect(analysis!.generatedLeveledFsLinks).toHaveLength(1);
    const dummy = analysis!.generatedLeveledFsLinks[0];
    expect(dummy.predecessorActivityCode).toBe(RAILING);
    expect(dummy.successorActivityCode).toBe(STAIRS);
    expect(dummy.generated).toBe(true);
    expect(dummy.source).toBe('resource_leveling');
  });

  it('does not invent a dummy link when no provider record is supplied', () => {
    const analysis = getEffectiveScheduleAnalysis({
      baselineCpmResult: baselineCpm(),
      activities: ACTIVITIES,
      logicLinks: LINKS,
      leveledActivityOffsets: LEVELED_OFFSETS,
      resourceLeveledDelayRecords: [],
      projectStartDate: PROJECT_START,
    });
    expect(analysis!.generatedLeveledFsLinks).toHaveLength(0);
    expect(analysis!.effectiveLeveledLinks.filter(isGenerated)).toHaveLength(0);
  });

  it('preserves manual "backwards-looking" baseline links by provenance, not by activity titles', () => {
    // User intentionally linked a finish-trade activity as predecessor of an
    // early-trade activity. CPM is pure math — this must be preserved because it
    // is a saved baseline link, regardless of how the trade codes read.
    const acts = [makeActivity(STAIN, 2), makeActivity('31-01-01', 3)];
    const backwardsLink = fs(STAIN, '31-01-01'); // 09-01-01 -> 31-01-01
    const base = runCpmCalculation({ activities: acts, logicLinks: [backwardsLink] });
    const analysis = getEffectiveScheduleAnalysis({
      baselineCpmResult: base,
      activities: acts,
      logicLinks: [backwardsLink],
      leveledActivityOffsets: { '31-01-01': 1 },
      resourceLeveledDelayRecords: [],
      projectStartDate: PROJECT_START,
    });
    expect(analysis).not.toBeNull();
    expect(analysis!.levelingApplied).toBe(true);
    expect(
      analysis!.effectiveLeveledLinks.some(
        (l) =>
          l.predecessorActivityCode === STAIN &&
          l.successorActivityCode === '31-01-01' &&
          !isGenerated(l),
      ),
    ).toBe(true);
    // No provider records → no generated links sneak in.
    expect(analysis!.effectiveLeveledLinks.filter(isGenerated)).toHaveLength(0);
  });

  it('renders a continuous red critical chain (driving edges only) through the dummy', () => {
    const analysis = leveledAnalysis();
    const leveledCpm = analysis!.leveledCpmResult!;
    const strokeOf = (pred: string, succ: string): string => {
      const link = analysis!.effectiveLeveledLinks.find(
        (l) => l.predecessorActivityCode === pred && l.successorActivityCode === succ,
      )!;
      return linkToEdge(link, leveledCpm, 'precedence-diagram').style?.stroke as string;
    };
    // Controlling chain Decking → Railing → Stairs (via dummy) → Stain is red and
    // continuous. The Railing → Stairs leg is the provider-derived dummy link.
    expect(strokeOf(DECKING, RAILING)).toBe(RED);
    expect(strokeOf(RAILING, STAIRS)).toBe(RED);
    expect(strokeOf(STAIRS, STAIN)).toBe(RED);
    // Non-driving zero-float edges are NOT red (Decking → Stairs has a 3-day gap;
    // Railing → Stain does not control Stain's start after leveling).
    expect(strokeOf(DECKING, STAIRS)).not.toBe(RED);
    expect(strokeOf(RAILING, STAIN)).not.toBe(RED);
    expect(strokeOf(FLASHING, STAIN)).not.toBe(RED);
  });

  it('5. baseline mode (no offsets) renders saved logic links only', () => {
    const analysis = getEffectiveScheduleAnalysis({
      baselineCpmResult: baselineCpm(),
      activities: ACTIVITIES,
      logicLinks: LINKS,
      leveledActivityOffsets: {},
      resourceLeveledDelayRecords: DELAY_RECORDS,
      projectStartDate: PROJECT_START,
    });
    expect(analysis).not.toBeNull();
    expect(analysis!.levelingApplied).toBe(false);
    expect(analysis!.generatedLeveledFsLinks).toHaveLength(0);
    expect(analysis!.effectiveLeveledLinks.filter(isGenerated)).toHaveLength(0);
    expect(analysis!.effectiveLeveledLinks.length).toBe(LINKS.length);
  });
});
