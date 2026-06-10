import type { ScheduleActivity } from './adapters/estimateLineItemsToScheduleActivities';
import { runCpmCalculation } from './cpm/calculateCpm';
import type { CpmLogicLink, CpmResult, ScheduleSettings } from './cpmTypes';

export interface PrecedenceDiagramState {
  hasRunCpm: boolean;
  isStale?: boolean;
  lastRunAt?: string;
  activitySignature?: string;
  logicLinksSignature?: string;
  scheduleSettingsSignature?: string;
}

export const CPM_STALE_MESSAGE =
  'Logic or activity data changed since CPM was last run. Run CPM again.';

export const CPM_INVALID_SAVED_MESSAGE =
  'Saved CPM run is no longer valid. Review logic and rerun CPM.';

export function buildCpmActivitySignature(activities: ScheduleActivity[]): string {
  return activities
    .map((activity) => {
      const stableId = activity.runtimeActivityId?.trim() || activity.activityCode.trim();
      return `${stableId}|${activity.activityCode}|${activity.durationDays}`;
    })
    .sort()
    .join(';;');
}

export function buildLogicLinksSignature(links: CpmLogicLink[]): string {
  return links
    .map(
      (link) =>
        `${link.predecessorActivityCode}|${link.successorActivityCode}|${link.relationshipType}|${link.lagDays}`,
    )
    .sort()
    .join(';;');
}

export function buildScheduleSettingsCpmSignature(settings: ScheduleSettings): string {
  return [
    settings.projectStartDate,
    settings.includeWeekends ? '1' : '0',
    settings.hoursPerDay,
    settings.availableCrewSize,
  ].join('|');
}

export function buildPrecedenceDiagramRunState(input: {
  activities: ScheduleActivity[];
  logicLinks: CpmLogicLink[];
  scheduleSettings: ScheduleSettings;
  runAt?: string;
}): PrecedenceDiagramState {
  return {
    hasRunCpm: true,
    isStale: false,
    lastRunAt: input.runAt ?? new Date().toISOString(),
    activitySignature: buildCpmActivitySignature(input.activities),
    logicLinksSignature: buildLogicLinksSignature(input.logicLinks),
    scheduleSettingsSignature: buildScheduleSettingsCpmSignature(input.scheduleSettings),
  };
}

export function markPrecedenceDiagramStale(
  existing: PrecedenceDiagramState | null | undefined,
): PrecedenceDiagramState {
  return {
    hasRunCpm: false,
    isStale: true,
    lastRunAt: existing?.lastRunAt,
    activitySignature: existing?.activitySignature,
    logicLinksSignature: existing?.logicLinksSignature,
    scheduleSettingsSignature: existing?.scheduleSettingsSignature,
  };
}

export function clearPrecedenceDiagramState(): PrecedenceDiagramState {
  return {
    hasRunCpm: false,
    isStale: false,
  };
}

function toBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function toStringValue(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return undefined;
}

export function parsePrecedenceDiagramFromAssumptions(
  assumptions: Record<string, unknown> | undefined | null,
): PrecedenceDiagramState | null {
  if (!assumptions || typeof assumptions !== 'object') return null;
  const raw = assumptions.precedenceDiagram;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const src = raw as Record<string, unknown>;
  return {
    hasRunCpm: toBoolean(src.hasRunCpm, false),
    isStale: toBoolean(src.isStale, false),
    lastRunAt: toStringValue(src.lastRunAt),
    activitySignature: toStringValue(src.activitySignature),
    logicLinksSignature: toStringValue(src.logicLinksSignature),
    scheduleSettingsSignature: toStringValue(src.scheduleSettingsSignature),
  };
}

export function precedenceDiagramToAssumptions(
  state: PrecedenceDiagramState | null,
  existingAssumptions: Record<string, unknown> = {},
): Record<string, unknown> {
  if (state === null) {
    const { precedenceDiagram: _removed, ...without } = existingAssumptions;
    return without;
  }
  return { ...existingAssumptions, precedenceDiagram: state };
}

export function currentPrecedenceDiagramSignaturesMatch(input: {
  saved: PrecedenceDiagramState;
  activities: ScheduleActivity[];
  logicLinks: CpmLogicLink[];
  scheduleSettings: ScheduleSettings;
}): boolean {
  if (!input.saved.hasRunCpm) return false;
  return (
    input.saved.activitySignature === buildCpmActivitySignature(input.activities) &&
    input.saved.logicLinksSignature === buildLogicLinksSignature(input.logicLinks) &&
    input.saved.scheduleSettingsSignature ===
      buildScheduleSettingsCpmSignature(input.scheduleSettings)
  );
}

/** Estimate bucket save should not invalidate CPM when only non-schedule fields changed. */
export function shouldInvalidateCpmOnEstimateSave(input: {
  estimateSettingsDirty: boolean;
  lineItemDraftDirty: boolean;
  usesConstructionActivities: boolean;
}): boolean {
  if (input.estimateSettingsDirty) return true;
  if (input.lineItemDraftDirty && !input.usesConstructionActivities) return true;
  return false;
}

export interface RecomputeCommittedCpmResult {
  cpmResult: CpmResult | null;
  precedenceDiagram: PrecedenceDiagramState;
  warningMessage: string | null;
}

export function migratePrecedenceDiagramFromLegacyCpmCache(input: {
  assumptions: Record<string, unknown> | undefined | null;
  activities: ScheduleActivity[];
  logicLinks: CpmLogicLink[];
  scheduleSettings: ScheduleSettings;
}): PrecedenceDiagramState | null {
  const existing = parsePrecedenceDiagramFromAssumptions(input.assumptions);
  if (existing?.hasRunCpm) return existing;

  const raw = input.assumptions;
  if (!raw || typeof raw !== 'object') return null;
  const cache = raw.cpmResultCache;
  if (!cache || typeof cache !== 'object' || Array.isArray(cache)) return null;
  const hasRunCpm = (cache as Record<string, unknown>).hasRunCpm === true;
  if (!hasRunCpm) return null;

  const lastRunAt =
    typeof raw.cpmCalculatedAt === 'string' ? raw.cpmCalculatedAt : undefined;

  return buildPrecedenceDiagramRunState({
    activities: input.activities,
    logicLinks: input.logicLinks,
    scheduleSettings: input.scheduleSettings,
    runAt: lastRunAt,
  });
}

export function recomputeCommittedCpmFromSavedState(input: {
  precedenceDiagram: PrecedenceDiagramState | null;
  activities: ScheduleActivity[];
  logicLinks: CpmLogicLink[];
  scheduleSettings: ScheduleSettings;
}): RecomputeCommittedCpmResult {
  const saved = input.precedenceDiagram;
  if (!saved?.hasRunCpm) {
    return {
      cpmResult: null,
      precedenceDiagram: saved ?? clearPrecedenceDiagramState(),
      warningMessage: saved?.isStale ? CPM_STALE_MESSAGE : null,
    };
  }

  if (!currentPrecedenceDiagramSignaturesMatch({
    saved,
    activities: input.activities,
    logicLinks: input.logicLinks,
    scheduleSettings: input.scheduleSettings,
  })) {
    return {
      cpmResult: null,
      precedenceDiagram: markPrecedenceDiagramStale(saved),
      warningMessage: CPM_STALE_MESSAGE,
    };
  }

  const cpmResult = runCpmCalculation({
    activities: input.activities,
    logicLinks: input.logicLinks,
  });

  if (!cpmResult.hasValidPrecedenceDiagram) {
    return {
      cpmResult: null,
      precedenceDiagram: {
        ...saved,
        hasRunCpm: false,
        isStale: true,
      },
      warningMessage: CPM_INVALID_SAVED_MESSAGE,
    };
  }

  return {
    cpmResult,
    precedenceDiagram: {
      ...saved,
      hasRunCpm: true,
      isStale: false,
    },
    warningMessage: null,
  };
}
