import { addDaysToScheduleDate } from '../application/mapScheduleCandidateToScheduleEventInput';
import type { ScheduleActivity } from './adapters/estimateLineItemsToScheduleActivities';
import type { CpmActivityResult, CpmLogicLink, CpmResult } from './cpmTypes';
import { calculateCpm, runCpmCalculation } from './cpm/calculateCpm';
import { buildResourceDummyLinks } from './resources/resourceDummyLinks';

/**
 * Canonical "effective schedule" resolver.
 *
 * The app has three date-producing surfaces (CPM logic network, Level III
 * Gantt + resource leveling, and the draft Schedule Preview). They used to each
 * invent their own duration math, so applying resource leveling produced
 * disagreeing numbers (e.g. 22 / 25 / 27). This module derives ONE effective
 * schedule from the committed CPM result plus any applied leveled offsets so
 * every consumer can report the same dates and duration.
 *
 * Day-index convention matches the Level III Gantt (activity-days):
 *   - earlyStart is the inclusive day-0 based start index
 *   - finish index is exclusive (start + durationDays)
 *   - planned dates map index -> calendar date via addDaysToScheduleDate
 */

export type EffectiveScheduleMode = 'baselineCpm' | 'resourceLeveled';

export interface EffectiveActivityDates {
  activityCode: string;
  cpmEarlyStart: number;
  cpmEarlyFinish: number;
  leveledOffsetDays: number;
  leveledStartDayIndex: number;
  leveledFinishDayIndex: number;
  plannedStart: string;
  plannedFinish: string;
}

export interface EffectiveScheduleSummary {
  /** True when at least one non-zero leveled offset is applied. */
  levelingApplied: boolean;
  mode: EffectiveScheduleMode;
  cpmBaselineDurationDays: number;
  leveledDurationDays: number;
  /** Leveled duration when leveling is applied, otherwise the CPM baseline. */
  effectiveDurationDays: number;
  plannedProjectStart: string | null;
  plannedProjectFinish: string | null;
  byActivityCode: Map<string, EffectiveActivityDates>;
}

export interface ResolveEffectiveScheduleParams {
  activities: ScheduleActivity[];
  cpmResult: CpmResult | null;
  projectStartDate: string;
  leveledOffsets: Record<string, number>;
}

export function resolveEffectiveSchedule(
  params: ResolveEffectiveScheduleParams,
): EffectiveScheduleSummary | null {
  const { activities, cpmResult, projectStartDate, leveledOffsets } = params;

  if (!cpmResult || !cpmResult.hasRunCpm || cpmResult.activities.length === 0) {
    return null;
  }

  const durationByCode = new Map(
    activities.map((activity) => [activity.activityCode, activity.durationDays]),
  );

  const byActivityCode = new Map<string, EffectiveActivityDates>();
  let plannedProjectStart: string | null = null;
  let plannedProjectFinish: string | null = null;
  let leveledDurationDays = 0;
  let levelingApplied = false;

  for (const cpm of cpmResult.activities) {
    const durationDays = durationByCode.get(cpm.activityCode) ?? 1;
    const offset = leveledOffsets[cpm.activityCode] ?? 0;
    if (offset !== 0) levelingApplied = true;

    const startIndex = cpm.earlyStart + offset;
    const finishIndex = startIndex + durationDays;
    const plannedStart = addDaysToScheduleDate(projectStartDate, startIndex);
    const plannedFinish = addDaysToScheduleDate(projectStartDate, finishIndex - 1);

    byActivityCode.set(cpm.activityCode, {
      activityCode: cpm.activityCode,
      cpmEarlyStart: cpm.earlyStart,
      cpmEarlyFinish: cpm.earlyFinish,
      leveledOffsetDays: offset,
      leveledStartDayIndex: startIndex,
      leveledFinishDayIndex: finishIndex,
      plannedStart,
      plannedFinish,
    });

    if (finishIndex > leveledDurationDays) leveledDurationDays = finishIndex;
    if (plannedProjectStart === null || plannedStart < plannedProjectStart) {
      plannedProjectStart = plannedStart;
    }
    if (plannedProjectFinish === null || plannedFinish > plannedProjectFinish) {
      plannedProjectFinish = plannedFinish;
    }
  }

  const cpmBaselineDurationDays = cpmResult.projectDurationDays;
  const effectiveDurationDays = levelingApplied
    ? Math.max(leveledDurationDays, cpmBaselineDurationDays)
    : cpmBaselineDurationDays;

  return {
    levelingApplied,
    mode: levelingApplied ? 'resourceLeveled' : 'baselineCpm',
    cpmBaselineDurationDays,
    leveledDurationDays: Math.max(leveledDurationDays, cpmBaselineDurationDays),
    effectiveDurationDays,
    plannedProjectStart,
    plannedProjectFinish,
    byActivityCode,
  };
}

export interface EffectiveActivityAnalysis extends EffectiveActivityDates {
  /** Total float relative to the leveled project finish (effective slack). */
  effectiveTotalFloat: number;
  /** True when the activity is on the controlling chain driving the leveled finish. */
  controllingAfterLeveling: boolean;
  /** Baseline CPM total float (unchanged logic). */
  baselineTotalFloat: number;
  baselineFreeFloat: number;
}

export interface EffectiveScheduleAnalysis {
  levelingApplied: boolean;
  cpmBaselineDurationDays: number;
  leveledDurationDays: number;
  effectiveDurationDays: number;
  leveledProjectFinishIndex: number;
  plannedProjectStart: string | null;
  plannedProjectFinish: string | null;
  controllingActivityCodes: string[];
  effectiveLeveledLinks: CpmLogicLink[];
  generatedLeveledFsLinks: CpmLogicLink[];
  leveledCpmResult: CpmResult | null;
  byActivityCode: Map<string, EffectiveActivityAnalysis>;
}

export interface BuildLeveledLogicNetworkFromGanttScheduleResult {
  leveledActivitiesWithDates: EffectiveActivityDates[];
  effectiveLeveledLinks: CpmLogicLink[];
  generatedLeveledFsLinks: CpmLogicLink[];
  leveledCpmResult: CpmResult;
  leveledCriticalActivityIds: string[];
  leveledDurationDays: number;
}

/**
 * A resource-leveling delay record sourced directly from the leveling result.
 * `resourceProviderActivityCodes` are the activities that freed the constrained
 * crew so `activityCode` could start. This is the ONLY permitted source for
 * generated resource-dummy connector lines — connectors are never derived from
 * dates, card positions, or timeline adjacency.
 */
export interface ResourceLeveledDelayRecord {
  activityCode: string;
  resourceProviderActivityCodes: string[];
}

export interface GetEffectiveScheduleAnalysisParams {
  baselineCpmResult: CpmResult | null;
  activities: ScheduleActivity[];
  logicLinks: CpmLogicLink[];
  leveledActivityOffsets: Record<string, number>;
  /** Provider/delay records from resource leveling — render-only, never math. */
  resourceLeveledDelayRecords?: ResourceLeveledDelayRecord[];
  projectStartDate: string;
}

function linkKey(link: CpmLogicLink): string {
  return `${link.predecessorActivityCode}::${link.successorActivityCode}::${link.relationshipType}::${link.lagDays}`;
}

function wouldCreateCycle(
  activities: ScheduleActivity[],
  links: CpmLogicLink[],
  candidate: CpmLogicLink,
): boolean {
  const result = calculateCpm({
    activities,
    logicLinks: [...links, candidate],
  });
  return result.warnings.some((warning) => warning.includes('Circular'));
}

/**
 * Provenance check ONLY — no title/trade/division/CSI/construction-order logic.
 * A generated link is a valid resource dummy when its metadata proves it came
 * from a resource-leveling provider record.
 */
function isValidResourceDummyLink(link: CpmLogicLink): boolean {
  return (
    link.generated === true &&
    link.source === 'resource_leveling' &&
    link.reason === 'crew_limit' &&
    link.relationshipType === 'FS'
  );
}

/** Provenance label for a rendered/exported Resource-Leveled link. */
type ResourceLeveledLinkOrigin = 'baseline' | 'resource_dummy' | 'invalid';

function classifyResourceLeveledLink(
  link: CpmLogicLink,
  baselineKeys: Set<string>,
  dummyKeys: Set<string>,
): ResourceLeveledLinkOrigin {
  const key = linkKey(link);
  // (A) exact saved baseline link (same source/target/type/lag), never generated.
  if (!link.generated && baselineKeys.has(key)) return 'baseline';
  // (B) valid provider-derived resource dummy link.
  if (isValidResourceDummyLink(link) && dummyKeys.has(key)) return 'resource_dummy';
  return 'invalid';
}

export function buildLeveledLogicNetworkFromGanttSchedule(params: {
  activities: ScheduleActivity[];
  baselineLogicLinks: CpmLogicLink[];
  baselineCpmResult: CpmResult;
  leveledSchedule: EffectiveScheduleSummary;
  resourceLeveledDelayRecords?: ResourceLeveledDelayRecord[];
}): BuildLeveledLogicNetworkFromGanttScheduleResult {
  const {
    activities,
    baselineLogicLinks,
    baselineCpmResult,
    leveledSchedule,
    resourceLeveledDelayRecords = [],
  } = params;

  const scheduleByCode = leveledSchedule.byActivityCode;
  const baselineByCode = new Map(
    baselineCpmResult.activities.map((activity) => [activity.activityCode, activity]),
  );
  const validCodes = new Set(scheduleByCode.keys());

  const normalizedBaselineLinks = baselineLogicLinks
    .filter((link) => !link.generated && link.source !== 'resource_leveling')
    .map((link) => ({ ...link }))
    .filter(
      (link) =>
        validCodes.has(link.predecessorActivityCode) &&
        validCodes.has(link.successorActivityCode) &&
        link.predecessorActivityCode !== link.successorActivityCode,
    );


  const dedupedBaselineLinks: CpmLogicLink[] = [];
  const dedupedBaselineKeys = new Set<string>();
  for (const link of normalizedBaselineLinks) {
    const key = linkKey(link);
    if (dedupedBaselineKeys.has(key)) continue;
    dedupedBaselineKeys.add(key);
    dedupedBaselineLinks.push({ ...link });
  }

  const preservedLinks: CpmLogicLink[] = dedupedBaselineLinks;

  const leveledOrder = [...scheduleByCode.values()].sort((left, right) => {
    if (left.leveledStartDayIndex !== right.leveledStartDayIndex) {
      return left.leveledStartDayIndex - right.leveledStartDayIndex;
    }
    if (left.leveledFinishDayIndex !== right.leveledFinishDayIndex) {
      return left.leveledFinishDayIndex - right.leveledFinishDayIndex;
    }
    return left.activityCode.localeCompare(right.activityCode);
  });

  // --- Resource-dummy links (provider-derived) ----------------------------
  // The ONLY generated links. Built from leveling provider records via the
  // shared builder (the same one resourceLevelSchedule uses), then cycle-
  // filtered. Connectors are NEVER derived from card position, sorted dates,
  // timeline adjacency, or activity titles.
  const leveledStartByCode = new Map<string, number>();
  const leveledFinishByCode = new Map<string, number>();
  for (const entry of scheduleByCode.values()) {
    leveledStartByCode.set(entry.activityCode, entry.leveledStartDayIndex);
    leveledFinishByCode.set(entry.activityCode, entry.leveledFinishDayIndex);
  }
  const baselineEdgeKeys = new Set(
    preservedLinks.map(
      (link) => `${link.predecessorActivityCode}->${link.successorActivityCode}`,
    ),
  );
  const candidateDummyLinks = leveledSchedule.levelingApplied
    ? buildResourceDummyLinks({
        delayRecords: resourceLeveledDelayRecords.map((record) => ({
          activityCode: record.activityCode,
          resourceProviderActivityCodes: record.resourceProviderActivityCodes ?? [],
        })),
        leveledStartByCode,
        leveledFinishByCode,
        hasBaselineEdge: (pred, succ) => baselineEdgeKeys.has(`${pred}->${succ}`),
        isValidCode: (code) => validCodes.has(code),
      })
    : [];

  // Defensive cycle filter (provider.finish <= target.start should never cycle
  // in a consistent schedule, but we never let a generated link form a loop).
  const resourceDummyLinks: CpmLogicLink[] = [];
  const dummySeen = new Set<string>();
  for (const candidate of candidateDummyLinks) {
    const key = linkKey(candidate);
    if (dummySeen.has(key)) continue;
    if (wouldCreateCycle(activities, [...preservedLinks, ...resourceDummyLinks], candidate)) {
      continue;
    }
    dummySeen.add(key);
    resourceDummyLinks.push(candidate);
  }

  // --- One leveled CPM result (single source of truth) --------------------
  // Resource-Leveled mode = baseline saved links + provider-derived resource
  // dummy links, run through the SAME CPM engine as baseline. Every leveled
  // value (ES/EF/LS/LF/TF/FF, critical path, duration) and every rendered
  // connector derives from this one result — no synthetic baselineTF-offset
  // math, no hidden links.
  const effectiveLeveledLinks: CpmLogicLink[] = [...preservedLinks, ...resourceDummyLinks];
  // runCpmCalculation (not calculateCpm) so the leveled result is a committed run
  // (hasRunCpm/hasValidCriticalPath set) — the Logic Network's isDisplayCritical
  // gate and node/edge styling treat it exactly like the baseline committed CPM.
  const leveledCpmResult = runCpmCalculation({ activities, logicLinks: effectiveLeveledLinks });
  const leveledCriticalActivityIds = leveledCpmResult.displayCriticalActivityCodes;
  const leveledDurationDays = leveledCpmResult.projectDurationDays;

  if (import.meta.env.DEV && leveledSchedule.levelingApplied) {
    warnIfLeveledCpmDriftsFromSchedule(scheduleByCode, leveledCpmResult);
    logResourceLeveledAudit({
      links: effectiveLeveledLinks,
      baselineKeys: new Set(preservedLinks.map((link) => linkKey(link))),
      dummyKeys: new Set(resourceDummyLinks.map((link) => linkKey(link))),
      leveledCpmResult,
      baselineCpmResult,
    });
  }

  return {
    leveledActivitiesWithDates: leveledOrder,
    effectiveLeveledLinks,
    generatedLeveledFsLinks: resourceDummyLinks,
    leveledCpmResult,
    leveledCriticalActivityIds,
    leveledDurationDays,
  };
}

/**
 * DEV reproduction guard. The provider-derived dummy links must make CPM
 * reproduce the leveled schedule (baselineES + offset). A mismatch means a
 * delayed activity lacked a provider dummy to pin it — we warn at runtime, and a
 * dedicated unit test hard-fails for known fixtures (e.g. GU26-200).
 */
function warnIfLeveledCpmDriftsFromSchedule(
  scheduleByCode: Map<string, EffectiveActivityDates>,
  leveledCpmResult: CpmResult,
): void {
  const leveledCpmByCode = new Map(
    leveledCpmResult.activities.map((activity) => [activity.activityCode, activity]),
  );
  const mismatches = [...scheduleByCode.values()]
    .map((entry) => {
      const cpm = leveledCpmByCode.get(entry.activityCode);
      if (!cpm) return null;
      if (
        cpm.earlyStart === entry.leveledStartDayIndex &&
        cpm.earlyFinish === entry.leveledFinishDayIndex
      ) {
        return null;
      }
      return {
        code: entry.activityCode,
        expectedES: entry.leveledStartDayIndex,
        actualES: cpm.earlyStart,
        expectedEF: entry.leveledFinishDayIndex,
        actualEF: cpm.earlyFinish,
      };
    })
    .filter((value): value is NonNullable<typeof value> => value != null);
  if (mismatches.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[resource-leveled-cpm] leveled CPM did not reproduce the leveled schedule for ` +
        `${mismatches.length} activit${mismatches.length === 1 ? 'y' : 'ies'} ` +
        `(a delayed activity has no provider-derived dummy to pin it):`,
      mismatches,
    );
  }
}

/** True when a link's relationship mathematically drives its successor under the given CPM. */
function isDrivingUnderCpm(cpmByCode: Map<string, CpmActivityResult>, link: CpmLogicLink): boolean {
  const source = cpmByCode.get(link.predecessorActivityCode);
  const target = cpmByCode.get(link.successorActivityCode);
  if (!source || !target) return false;
  const lag = link.lagDays ?? 0;
  switch (link.relationshipType) {
    case 'SS':
      return target.earlyStart === source.earlyStart + lag;
    case 'FF':
      return target.earlyFinish === source.earlyFinish + lag;
    case 'SF':
      return target.earlyFinish === source.earlyStart + lag;
    case 'FS':
    default:
      return target.earlyStart === source.earlyFinish + lag;
  }
}

/**
 * Dev-only audit (spec item 11): one table of every rendered Resource-Leveled
 * edge (origin/type/lag/source+target ES/EF/driving/on-critical/color) plus a
 * duration and critical-set comparison between baseline and leveled CPM. Origin
 * is decided by PROVENANCE only — never by activity titles.
 */
function logResourceLeveledAudit(params: {
  links: CpmLogicLink[];
  baselineKeys: Set<string>;
  dummyKeys: Set<string>;
  leveledCpmResult: CpmResult;
  baselineCpmResult: CpmResult;
}): void {
  const { links, baselineKeys, dummyKeys, leveledCpmResult, baselineCpmResult } = params;
  const cpmByCode = new Map(leveledCpmResult.activities.map((a) => [a.activityCode, a]));
  const criticalSet = new Set(leveledCpmResult.displayCriticalActivityCodes);

  const table = links.map((link) => {
    const origin = classifyResourceLeveledLink(link, baselineKeys, dummyKeys);
    const source = cpmByCode.get(link.predecessorActivityCode);
    const target = cpmByCode.get(link.successorActivityCode);
    const driving = isDrivingUnderCpm(cpmByCode, link);
    const sourceCritical = criticalSet.has(link.predecessorActivityCode);
    const targetCritical = criticalSet.has(link.successorActivityCode);
    const onCriticalPath = driving && sourceCritical && targetCritical;
    const isDummy = origin === 'resource_dummy';
    const color = onCriticalPath ? 'red' : isDummy ? 'amber' : 'slate';
    return {
      pred: link.predecessorActivityCode,
      succ: link.successorActivityCode,
      origin,
      type: link.relationshipType,
      lag: link.lagDays,
      sourceES: source?.earlyStart,
      sourceEF: source?.earlyFinish,
      targetES: target?.earlyStart,
      targetEF: target?.earlyFinish,
      driving,
      onCriticalPath,
      color,
    };
  });

  // eslint-disable-next-line no-console
  console.table(table);
  // eslint-disable-next-line no-console
  console.info('[resource-leveled-audit] durations + critical sets', {
    baselineDurationDays: baselineCpmResult.projectDurationDays,
    leveledDurationDays: leveledCpmResult.projectDurationDays,
    baselineCritical: baselineCpmResult.displayCriticalActivityCodes,
    leveledCritical: leveledCpmResult.displayCriticalActivityCodes,
  });
}

/**
 * Builds the resource-leveled effective schedule analysis the Logic Network can
 * display. Dependency relationships are NOT modified — this only re-derives an
 * effective controlling path and effective float from the leveled start/finish
 * positions so a float activity pushed into the controlling chain is visible.
 *
 * Effective float is a backward pass relative to the leveled project finish,
 * using the leveled (early) finish positions as the forward result; an activity
 * with zero effective float is controlling after leveling.
 */
export function getEffectiveScheduleAnalysis(
  params: GetEffectiveScheduleAnalysisParams,
): EffectiveScheduleAnalysis | null {
  const {
    baselineCpmResult,
    activities,
    logicLinks,
    leveledActivityOffsets,
    resourceLeveledDelayRecords,
    projectStartDate,
  } = params;

  const base = resolveEffectiveSchedule({
    activities,
    cpmResult: baselineCpmResult,
    projectStartDate,
    leveledOffsets: leveledActivityOffsets,
  });
  if (!base || !baselineCpmResult) return null;

  const baselineByCode = new Map(
    baselineCpmResult.activities.map((cpm) => [cpm.activityCode, cpm]),
  );

  const leveledNetwork = buildLeveledLogicNetworkFromGanttSchedule({
    activities,
    baselineLogicLinks: logicLinks,
    baselineCpmResult,
    leveledSchedule: base,
    resourceLeveledDelayRecords,
  });
  const leveledCpmResult = leveledNetwork.leveledCpmResult;
  const leveledDisplayCriticalSet = new Set(leveledNetwork.leveledCriticalActivityIds);
  const leveledProjectFinishIndex = leveledNetwork.leveledDurationDays;

  // Every leveled value (dates, float, controlling status) reads from the ONE
  // leveled CPM result. Under the reproduction guarantee these equal
  // baselineES + offset; if a delayed activity drifts, the leveled CPM (not the
  // offset heuristic) is authoritative, matching the Level III Gantt exactly.
  const byActivityCode = new Map<string, EffectiveActivityAnalysis>();
  const controllingActivityCodes: string[] = [];
  let plannedProjectStart: string | null = null;
  let plannedProjectFinish: string | null = null;

  for (const cpm of leveledCpmResult.activities) {
    const code = cpm.activityCode;
    const baselineCpm = baselineByCode.get(code);
    const cpmEarlyStart = baselineCpm?.earlyStart ?? cpm.earlyStart;
    const cpmEarlyFinish = baselineCpm?.earlyFinish ?? cpm.earlyFinish;
    const plannedStart = addDaysToScheduleDate(projectStartDate, cpm.earlyStart);
    const plannedFinish = addDaysToScheduleDate(projectStartDate, cpm.earlyFinish - 1);
    const controllingAfterLeveling = leveledDisplayCriticalSet.has(code);
    if (controllingAfterLeveling) controllingActivityCodes.push(code);

    byActivityCode.set(code, {
      activityCode: code,
      cpmEarlyStart,
      cpmEarlyFinish,
      leveledOffsetDays: cpm.earlyStart - cpmEarlyStart,
      leveledStartDayIndex: cpm.earlyStart,
      leveledFinishDayIndex: cpm.earlyFinish,
      plannedStart,
      plannedFinish,
      effectiveTotalFloat: cpm.totalFloat,
      controllingAfterLeveling,
      baselineTotalFloat: baselineCpm?.totalFloat ?? 0,
      baselineFreeFloat: baselineCpm?.freeFloat ?? 0,
    });

    if (plannedProjectStart === null || plannedStart < plannedProjectStart) {
      plannedProjectStart = plannedStart;
    }
    if (plannedProjectFinish === null || plannedFinish > plannedProjectFinish) {
      plannedProjectFinish = plannedFinish;
    }
  }

  return {
    levelingApplied: base.levelingApplied,
    cpmBaselineDurationDays: base.cpmBaselineDurationDays,
    leveledDurationDays: leveledNetwork.leveledDurationDays,
    effectiveDurationDays: base.levelingApplied
      ? leveledNetwork.leveledDurationDays
      : base.cpmBaselineDurationDays,
    leveledProjectFinishIndex,
    plannedProjectStart: plannedProjectStart ?? base.plannedProjectStart,
    plannedProjectFinish: plannedProjectFinish ?? base.plannedProjectFinish,
    controllingActivityCodes,
    effectiveLeveledLinks: leveledNetwork.effectiveLeveledLinks,
    generatedLeveledFsLinks: leveledNetwork.generatedLeveledFsLinks,
    leveledCpmResult,
    byActivityCode,
  };
}
