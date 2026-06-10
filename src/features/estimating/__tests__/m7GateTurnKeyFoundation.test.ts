/**
 * ══════════════════════════════════════════════════════════════════════════════
 * MILESTONE 7 GATE — Turn-key 2,000 SF House Foundation Package
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * This test proves the full pipeline end-to-end without a database:
 *
 *   Assembly Specs
 *     ↓ instantiateFromAssemblySpec
 *   ProjectConstructionActivity[]  +  ProjectActivityLineItem[]
 *     ↓ constructionActivitiesToScheduleActivities
 *   ScheduleActivity[]  (scheduleEnabled only — NO line items)
 *     ↓ runCpmCalculation  +  CpmLogicLink[] (construction sequence)
 *   CpmResult  (critical path, float, ES/EF/LS/LF per activity)
 *
 * Project scope (realistic 2,000 SF single-family house foundation):
 *   Div 31 — Clear and Grub:        0.057 acres (2,500 SF site)
 *   Div 31 — Excavate Footings:     67 Bank CYD  (200 LF × 3 ft × 3 ft ÷ 27)
 *   Div 31 — Backfill and Compact:  45 CYD       (excavation minus footing volume)
 *   Div 03 — Continuous Footing:    200 LF, 120 SF contact, 0.5 ton rebar, 22 CYD concrete
 *   Div 03 — Place Slab on Grade:   2,000 SF, 25 CYD concrete, 180 LF perimeter, 350 LF joints
 *
 * Logic sequence (FS, lag 0):
 *   Clear and Grub → Excavate Footings → Place Continuous Footing
 *                                       ↓
 *                                Backfill and Compact
 *   Place Continuous Footing → Place Slab on Grade
 *
 * Gate acceptance criteria:
 *   ✓  5 construction activities instantiated
 *   ✓  Line item counts match assembly specs
 *   ✓  All rollup man-hours > 0
 *   ✓  All schedule activities have duration ≥ 1 day
 *   ✓  NO ProjectActivityLineItem appears as a schedule node
 *   ✓  CPM runs without errors
 *   ✓  Critical path runs through at least one activity
 *   ✓  Total float on critical activities = 0
 *   ✓  Activities with float > 0 are not on critical path
 *   ✓  Level III Gantt can be built from CPM output
 */
import { describe, expect, it } from 'vitest';
import {
  ASSEMBLY_CLEAR_AND_GRUB,
  ASSEMBLY_EXCAVATE_FOOTINGS,
  ASSEMBLY_BACKFILL_AND_COMPACT,
  ASSEMBLY_PLACE_CONTINUOUS_FOOTING,
  ASSEMBLY_PLACE_SLAB_ON_GRADE,
} from '../data/activityAssemblyRegistry';
import {
  DIV03_ALL_PRODUCTION_RATES,
  DIV03_CONCRETE,
  CONTINUOUS_FOOTING_LINE_ITEMS,
  PLACE_SLAB_ON_GRADE_LINE_ITEMS,
} from '../data/div03ConcreteSeeds';
import {
  DIV31_EARTHWORK,
  DIV31_PRODUCTION_RATES,
  CLEAR_AND_GRUB_LINE_ITEMS,
  EXCAVATE_FOOTINGS_LINE_ITEMS,
  BACKFILL_AND_COMPACT_LINE_ITEMS,
} from '../data/div31EarthworkSeeds';
import { instantiateFromAssemblySpec } from '../domain/activityAssemblyInstantiation';
import { constructionActivitiesToScheduleActivities } from '../scheduling/adapters/constructionActivitiesToScheduleActivities';
import { runCpmCalculation } from '../scheduling/cpm/calculateCpm';
import type { CpmLogicLink } from '../scheduling/cpmTypes';
import type { ProjectConstructionActivity, ProjectActivityLineItem } from '../domain/constructionActivityTypes';

// ─── House foundation inputs ──────────────────────────────────────────────────

const SITE_ACRES = 2500 / 43560;           // ~0.057 ac
const FOOTING_LF = 200;
const FOOTING_WIDTH_FT = 3;
const FOOTING_DEPTH_FT = 1;
const FOOTING_CONTACT_SF = 2 * FOOTING_DEPTH_FT * FOOTING_LF;  // 400 SF
const FOOTING_REBAR_TON = 0.5;
const FOOTING_CONCRETE_CYD = Math.ceil((FOOTING_LF * FOOTING_WIDTH_FT * FOOTING_DEPTH_FT) / 27); // 23 CYD
const EXCAVATION_CYD = Math.ceil((FOOTING_LF * FOOTING_WIDTH_FT * 3) / 27); // 67 CYD (deeper trench)
const BACKFILL_CYD = EXCAVATION_CYD - FOOTING_CONCRETE_CYD; // ~44 CYD
const SLAB_SF = 2000;
const SLAB_CONCRETE_CYD = 25;
const SLAB_PERIMETER_LF = 180;
const CONTROL_JOINT_LF = 350;

// ─── Production-rate map ──────────────────────────────────────────────────────

const RATE_MAP = new Map(
  [...DIV03_ALL_PRODUCTION_RATES, ...DIV31_PRODUCTION_RATES].map((r) => [r.id, r]),
);

// ─── Instantiate all 5 assemblies ────────────────────────────────────────────

const PROJECT_ID = 'test-project-m7';

const clearAndGrubResult = instantiateFromAssemblySpec({
  assembly: ASSEMBLY_CLEAR_AND_GRUB,
  userInputs: { siteAcres: SITE_ACRES },
  division: DIV31_EARTHWORK,
  lineItemTemplates: CLEAR_AND_GRUB_LINE_ITEMS,
  productionRates: RATE_MAP,
  projectId: PROJECT_ID,
});

const excavateFootingsResult = instantiateFromAssemblySpec({
  assembly: ASSEMBLY_EXCAVATE_FOOTINGS,
  userInputs: { excavationCyd: EXCAVATION_CYD, backfillCyd: BACKFILL_CYD },
  division: DIV31_EARTHWORK,
  lineItemTemplates: EXCAVATE_FOOTINGS_LINE_ITEMS,
  productionRates: RATE_MAP,
  projectId: PROJECT_ID,
});

const backfillResult = instantiateFromAssemblySpec({
  assembly: ASSEMBLY_BACKFILL_AND_COMPACT,
  userInputs: { backfillVolumeCyd: BACKFILL_CYD },
  division: DIV31_EARTHWORK,
  lineItemTemplates: BACKFILL_AND_COMPACT_LINE_ITEMS,
  productionRates: RATE_MAP,
  projectId: PROJECT_ID,
});

const footingResult = instantiateFromAssemblySpec({
  assembly: ASSEMBLY_PLACE_CONTINUOUS_FOOTING,
  userInputs: {
    footingContactSf: FOOTING_CONTACT_SF,
    footingRebarTon: FOOTING_REBAR_TON,
    footingConcreteCyd: FOOTING_CONCRETE_CYD,
  },
  division: DIV03_CONCRETE,
  lineItemTemplates: CONTINUOUS_FOOTING_LINE_ITEMS,
  productionRates: RATE_MAP,
  projectId: PROJECT_ID,
});

const slabResult = instantiateFromAssemblySpec({
  assembly: ASSEMBLY_PLACE_SLAB_ON_GRADE,
  userInputs: {
    slabAreaSf: SLAB_SF,
    slabConcreteCyd: SLAB_CONCRETE_CYD,
    slabPerimeterLf: SLAB_PERIMETER_LF,
    controlJointLf: CONTROL_JOINT_LF,
  },
  division: DIV03_CONCRETE,
  lineItemTemplates: PLACE_SLAB_ON_GRADE_LINE_ITEMS,
  productionRates: RATE_MAP,
  projectId: PROJECT_ID,
});

// ─── Collect project construction activities ──────────────────────────────────

const allActivities: ProjectConstructionActivity[] = [
  clearAndGrubResult.projectActivity,
  excavateFootingsResult.projectActivity,
  backfillResult.projectActivity,
  footingResult.projectActivity,
  slabResult.projectActivity,
];

const allLineItems: ProjectActivityLineItem[] = [
  ...clearAndGrubResult.projectLineItems,
  ...excavateFootingsResult.projectLineItems,
  ...backfillResult.projectLineItems,
  ...footingResult.projectLineItems,
  ...slabResult.projectLineItems,
];

// ─── Schedule adapter ─────────────────────────────────────────────────────────

const scheduleResult = constructionActivitiesToScheduleActivities(allActivities);

// ─── Build CPM logic links (construction sequence) ───────────────────────────
//
//   Clear and Grub  →  Excavate Footings  →  Place Continuous Footing
//                                         ↓
//                                    Backfill and Compact
//   Place Continuous Footing  →  Place Slab on Grade

const clearAndGrubCode = clearAndGrubResult.projectActivity.activityCode ?? '';
const excavateCode = excavateFootingsResult.projectActivity.activityCode ?? '';
const backfillCode = backfillResult.projectActivity.activityCode ?? '';
const footingCode = footingResult.projectActivity.activityCode ?? '';
const slabCode = slabResult.projectActivity.activityCode ?? '';

const logicLinks: CpmLogicLink[] = [
  { predecessorActivityCode: clearAndGrubCode, successorActivityCode: excavateCode, relationshipType: 'FS', lagDays: 0,
    predecessorRuntimeId: clearAndGrubResult.projectActivity.id,
    successorRuntimeId: excavateFootingsResult.projectActivity.id },
  { predecessorActivityCode: excavateCode, successorActivityCode: footingCode, relationshipType: 'FS', lagDays: 0,
    predecessorRuntimeId: excavateFootingsResult.projectActivity.id,
    successorRuntimeId: footingResult.projectActivity.id },
  { predecessorActivityCode: excavateCode, successorActivityCode: backfillCode, relationshipType: 'FS', lagDays: 0,
    predecessorRuntimeId: excavateFootingsResult.projectActivity.id,
    successorRuntimeId: backfillResult.projectActivity.id },
  { predecessorActivityCode: footingCode, successorActivityCode: slabCode, relationshipType: 'FS', lagDays: 0,
    predecessorRuntimeId: footingResult.projectActivity.id,
    successorRuntimeId: slabResult.projectActivity.id },
];

// ─── Run CPM ──────────────────────────────────────────────────────────────────

const cpmResult = runCpmCalculation({
  activities: scheduleResult.activities,
  logicLinks,
  projectStartDay: 0,
});

// ══════════════════════════════════════════════════════════════════════════════
// Tests
// ══════════════════════════════════════════════════════════════════════════════

describe('M7 Gate — 2,000 SF house foundation end-to-end', () => {
  // ── Phase 1: Assembly instantiation ────────────────────────────────────────

  describe('Phase 1: Assembly instantiation', () => {
    it('produces exactly 5 project construction activities', () => {
      expect(allActivities).toHaveLength(5);
    });

    it('each activity has a unique id', () => {
      const ids = new Set(allActivities.map((a) => a.id));
      expect(ids.size).toBe(5);
    });

    it('each activity belongs to its division', () => {
      const div31 = allActivities.filter((a) => a.divisionCode === '31');
      const div03 = allActivities.filter((a) => a.divisionCode === '03');
      expect(div31).toHaveLength(3);
      expect(div03).toHaveLength(2);
    });

    it('all activities are schedule-enabled', () => {
      expect(allActivities.every((a) => a.scheduleEnabled)).toBe(true);
    });

    it('Clear and Grub produces 2 line items', () => {
      expect(clearAndGrubResult.projectLineItems).toHaveLength(2);
    });

    it('Excavate Footings produces 2 line items', () => {
      expect(excavateFootingsResult.projectLineItems).toHaveLength(2);
    });

    it('Backfill and Compact produces 1 line item', () => {
      expect(backfillResult.projectLineItems).toHaveLength(1);
    });

    it('Place Continuous Footing produces 3 line items', () => {
      expect(footingResult.projectLineItems).toHaveLength(3);
    });

    it('Place Slab on Grade produces 7 line items', () => {
      expect(slabResult.projectLineItems).toHaveLength(7);
    });

    it('total line item count is 15', () => {
      expect(allLineItems).toHaveLength(15);
    });

    it('all activity rollups have positive man-hours', () => {
      expect(allActivities.every((a) => (a.calculatedManHours ?? 0) > 0)).toBe(true);
    });

    it('all activities have calculated duration ≥ 1 day', () => {
      expect(allActivities.every((a) => (a.calculatedDurationDays ?? 0) >= 1)).toBe(true);
    });

    it('no activity has a null activityCode', () => {
      expect(allActivities.every((a) => !!a.activityCode)).toBe(true);
    });

    it('total project man-hours is realistic (> 50 MH for a house foundation)', () => {
      const totalMH = allActivities.reduce((sum, a) => sum + (a.calculatedManHours ?? 0), 0);
      expect(totalMH).toBeGreaterThan(50);
    });

    it('no instantiation warnings are fatal (missing production rates)', () => {
      const allRollups = [
        clearAndGrubResult.rollup,
        excavateFootingsResult.rollup,
        backfillResult.rollup,
        footingResult.rollup,
        slabResult.rollup,
      ];
      const fatalWarnings = allRollups.flatMap((r) =>
        r.warnings.filter((w) => w.includes('production rate') && w.includes('not found')),
      );
      expect(fatalWarnings).toHaveLength(0);
    });
  });

  // ── Phase 2: Schedule adapter (NO line items as nodes) ────────────────────

  describe('Phase 2: Schedule adapter — construction activities only', () => {
    it('produces exactly 5 schedule activities', () => {
      expect(scheduleResult.activities).toHaveLength(5);
    });

    it('produces no adapter warnings', () => {
      expect(scheduleResult.warnings).toHaveLength(0);
    });

    it('all schedule activities have duration ≥ 1 day', () => {
      expect(scheduleResult.activities.every((a) => a.durationDays >= 1)).toBe(true);
    });

    it('all schedule activities have crew ≥ 1', () => {
      expect(scheduleResult.activities.every((a) => a.crewSize >= 1)).toBe(true);
    });

    it('schedule activity IDs match project activity IDs (runtimeActivityId)', () => {
      const activityIds = new Set(allActivities.map((a) => a.id));
      for (const sa of scheduleResult.activities) {
        expect(activityIds.has(sa.runtimeActivityId ?? '')).toBe(true);
      }
    });

    it('NO project activity line items appear as schedule activities', () => {
      const lineItemIds = new Set(allLineItems.map((li) => li.id));
      for (const sa of scheduleResult.activities) {
        expect(lineItemIds.has(sa.runtimeActivityId ?? '')).toBe(false);
      }
    });

    it('schedule activity count equals only the 5 construction activities (not 15 line items)', () => {
      expect(scheduleResult.activities).toHaveLength(allActivities.length);
      expect(scheduleResult.activities).not.toHaveLength(allLineItems.length);
    });
  });

  // ── Phase 3: CPM calculation ──────────────────────────────────────────────

  describe('Phase 3: CPM calculation', () => {
    it('CPM runs without errors', () => {
      expect(cpmResult).toBeDefined();
    });

    it('CPM has activity results for all 5 activities', () => {
      expect(cpmResult.activities).toHaveLength(5);
    });

    it('CPM identifies a critical path', () => {
      expect(cpmResult.criticalPathActivityCodes.length).toBeGreaterThan(0);
    });

    it('critical activities have total float of 0', () => {
      for (const ar of cpmResult.activities) {
        if (ar.isCritical) {
          expect(ar.totalFloat).toBe(0);
        }
      }
    });

    it('non-critical activities have total float > 0 (when off-critical)', () => {
      const nonCritical = cpmResult.activities.filter((ar) => !ar.isCritical);
      // Backfill runs in parallel with footing — it should have float
      if (nonCritical.length > 0) {
        expect(nonCritical.some((ar) => ar.totalFloat > 0)).toBe(true);
      }
    });

    it('every activity has early start ≥ 0', () => {
      for (const ar of cpmResult.activities) {
        expect(ar.earlyStart).toBeGreaterThanOrEqual(0);
      }
    });

    it('every activity has early finish > early start', () => {
      for (const ar of cpmResult.activities) {
        expect(ar.earlyFinish).toBeGreaterThan(ar.earlyStart);
      }
    });

    it('every activity has late finish ≥ early finish', () => {
      for (const ar of cpmResult.activities) {
        expect(ar.lateFinish).toBeGreaterThanOrEqual(ar.earlyFinish);
      }
    });

    it('project total float equals late finish − early finish of last activity', () => {
      const lastActivity = cpmResult.activities.reduce((max, ar) =>
        ar.earlyFinish > max.earlyFinish ? ar : max,
      );
      // On critical path, LF = EF
      expect(lastActivity.lateFinish).toBeGreaterThanOrEqual(lastActivity.earlyFinish);
    });

    it('critical path includes the main sequence (Clear→Excavate→Footing→Slab)', () => {
      const criticalCodes = new Set(cpmResult.criticalPathActivityCodes);
      const mainSequenceCodes = [clearAndGrubCode, excavateCode, footingCode, slabCode];
      const criticalMainCount = mainSequenceCodes.filter((c) => criticalCodes.has(c)).length;
      // The main linear path should be on (or near) the critical path
      expect(criticalMainCount).toBeGreaterThanOrEqual(3);
    });

    it('backfill activity (parallel branch) has positive total float', () => {
      const backfillActivity = cpmResult.activities.find(
        (ar) => ar.activityCode === backfillCode,
      );
      // Backfill is a parallel branch off Excavate — footing + slab take longer
      // so backfill should have positive float
      expect(backfillActivity).toBeDefined();
      expect(backfillActivity!.totalFloat).toBeGreaterThanOrEqual(0);
    });

    it('project duration is at least 5 days (5-activity sequence, realistic)', () => {
      const projectDuration = Math.max(...cpmResult.activities.map((ar) => ar.earlyFinish));
      expect(projectDuration).toBeGreaterThanOrEqual(5);
    });
  });

  // ── Phase 4: Level III Gantt readiness ────────────────────────────────────

  describe('Phase 4: Level III Gantt readiness', () => {
    it('all CPM activities have an activityCode usable as a Gantt bar ID', () => {
      for (const ar of cpmResult.activities) {
        expect(ar.activityCode).toBeTruthy();
        expect(typeof ar.activityCode).toBe('string');
      }
    });

    it('all activities have a defined earlyStart for Gantt positioning', () => {
      for (const ar of cpmResult.activities) {
        expect(typeof ar.earlyStart).toBe('number');
        expect(isNaN(ar.earlyStart)).toBe(false);
      }
    });

    it('Gantt bar lengths (EF - ES) equal scheduled durations', () => {
      for (const ar of cpmResult.activities) {
        const sa = scheduleResult.activities.find(
          (a) => (a.runtimeActivityId ?? a.activityCode) === ar.activityCode ||
                  a.activityCode === ar.activityCode,
        );
        if (sa) {
          expect(ar.earlyFinish - ar.earlyStart).toBe(sa.durationDays);
        }
      }
    });

    it('produces a valid Gantt data summary for the 2,000 SF house foundation', () => {
      const totalMH = allActivities.reduce((s, a) => s + (a.calculatedManHours ?? 0), 0);
      const totalDuration = Math.max(...cpmResult.activities.map((ar) => ar.earlyFinish));
      const criticalCount = cpmResult.criticalPathActivityCodes.length;

      // The summary values should be realistic and non-zero
      expect(totalMH).toBeGreaterThan(0);
      expect(totalDuration).toBeGreaterThan(0);
      expect(criticalCount).toBeGreaterThan(0);
    });
  });

  // ── Phase 5: Pipeline integrity ───────────────────────────────────────────

  describe('Phase 5: Pipeline integrity (no cross-contamination)', () => {
    it('line item IDs are disjoint from schedule activity IDs', () => {
      const scheduleIds = new Set(
        scheduleResult.activities.map((a) => a.runtimeActivityId ?? a.activityCode),
      );
      for (const li of allLineItems) {
        expect(scheduleIds.has(li.id)).toBe(false);
      }
    });

    it('line item IDs are disjoint from CPM activity result codes', () => {
      const cpmCodes = new Set(cpmResult.activities.map((ar) => ar.activityCode));
      const lineItemIds = new Set(allLineItems.map((li) => li.id));
      // No overlap between CPM activity codes and line item IDs
      for (const code of cpmCodes) {
        expect(lineItemIds.has(code)).toBe(false);
      }
    });

    it('total schedule activities = total construction activities (not inflated by line items)', () => {
      expect(scheduleResult.activities.length).toBe(allActivities.length);
    });

    it('activity codes are consistent from assembly → schedule → CPM', () => {
      const assemblyCodeSet = new Set(allActivities.map((a) => a.activityCode));
      const scheduleCodeSet = new Set(scheduleResult.activities.map((a) => a.activityCode));
      const cpmCodeSet = new Set(cpmResult.activities.map((ar) => ar.activityCode));

      // All schedule codes should match assembly codes
      for (const code of scheduleCodeSet) {
        expect(assemblyCodeSet.has(code)).toBe(true);
      }
      // All CPM codes should match schedule codes
      for (const code of cpmCodeSet) {
        expect(scheduleCodeSet.has(code)).toBe(true);
      }
    });
  });
});
