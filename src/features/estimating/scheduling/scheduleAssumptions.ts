import type { EstimateDomainTask } from '../infrastructure/estimateDbTypes';
import { parseActivityCode } from '../application/estimateActivityCoding';
import type { ScheduleActivity } from './adapters/estimateLineItemsToScheduleActivities';
import {
  parsePrecedenceDiagramFromAssumptions,
  type PrecedenceDiagramState,
} from './precedenceDiagram';
import {
  DEFAULT_SCHEDULE_SETTINGS,
  attachCpmWorkflowFields,
  type CpmActivityResult,
  type CpmLogicLink,
  type CpmRelationshipType,
  type CpmResult,
  type LogicNetworkLayout,
  type LogicNetworkViewMode,
  type ScheduleSettings,
} from './cpmTypes';
import { wouldCreateCircularDependency } from './logic/logicCycleUtils';
import type { LogicBatchSnapshot } from './logic/logicTypes';

// ── ScheduleSettings ────────────────────────────────────────────────────────

function toFiniteNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  return fallback;
}

function toStringValue(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return fallback;
}

export function parseScheduleSettingsFromAssumptions(
  assumptions: Record<string, unknown> | undefined | null,
): ScheduleSettings {
  if (!assumptions || typeof assumptions !== 'object') {
    return { ...DEFAULT_SCHEDULE_SETTINGS };
  }
  const raw = assumptions.scheduleSettings;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_SCHEDULE_SETTINGS };
  }
  const src = raw as Record<string, unknown>;
  return {
    projectStartDate: toStringValue(src.projectStartDate, DEFAULT_SCHEDULE_SETTINGS.projectStartDate),
    hoursPerDay: toFiniteNumber(src.hoursPerDay, DEFAULT_SCHEDULE_SETTINGS.hoursPerDay),
    availableCrewSize: toFiniteNumber(
      src.availableCrewSize,
      DEFAULT_SCHEDULE_SETTINGS.availableCrewSize,
    ),
    includeWeekends: toBoolean(src.includeWeekends, DEFAULT_SCHEDULE_SETTINGS.includeWeekends),
  };
}

export function scheduleSettingsToAssumptions(
  settings: ScheduleSettings,
  existingAssumptions: Record<string, unknown> = {},
): Record<string, unknown> {
  return { ...existingAssumptions, scheduleSettings: settings };
}

// ── Logic Links ──────────────────────────────────────────────────────────────

function parseRelationshipType(value: unknown): CpmRelationshipType {
  if (value === 'SS' || value === 'FF' || value === 'SF') return value;
  return 'FS';
}

function parseCpmLogicLink(raw: unknown): CpmLogicLink | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const src = raw as Record<string, unknown>;
  const pred = typeof src.predecessorActivityCode === 'string' ? src.predecessorActivityCode.trim() : '';
  const succ = typeof src.successorActivityCode === 'string' ? src.successorActivityCode.trim() : '';
  if (!pred || !succ) return null;
  const predRuntimeId =
    typeof src.predecessorRuntimeId === 'string' && src.predecessorRuntimeId.trim()
      ? src.predecessorRuntimeId.trim()
      : undefined;
  const succRuntimeId =
    typeof src.successorRuntimeId === 'string' && src.successorRuntimeId.trim()
      ? src.successorRuntimeId.trim()
      : undefined;
  return {
    predecessorActivityCode: pred,
    successorActivityCode: succ,
    relationshipType: parseRelationshipType(src.relationshipType),
    lagDays: toFiniteNumber(src.lagDays, 0),
    ...(predRuntimeId ? { predecessorRuntimeId: predRuntimeId } : {}),
    ...(succRuntimeId ? { successorRuntimeId: succRuntimeId } : {}),
  };
}

export function parseLogicLinksFromAssumptions(
  assumptions: Record<string, unknown> | undefined | null,
): CpmLogicLink[] {
  if (!assumptions || typeof assumptions !== 'object') return [];
  const raw = assumptions.logicLinks;
  if (!Array.isArray(raw)) return [];
  return raw.map(parseCpmLogicLink).filter((link): link is CpmLogicLink => link !== null);
}

export function logicLinksToAssumptions(
  links: CpmLogicLink[],
  existingAssumptions: Record<string, unknown> = {},
): Record<string, unknown> {
  return { ...existingAssumptions, logicLinks: links };
}

/** True when assumptions explicitly contain a logicLinks key (including empty []). */
export function hasLogicLinksKey(
  assumptions: Record<string, unknown> | undefined | null,
): boolean {
  return (
    assumptions != null &&
    typeof assumptions === 'object' &&
    assumptions.logicLinks !== undefined
  );
}

export function parseLogicNetworkInitializedFromAssumptions(
  assumptions: Record<string, unknown> | undefined | null,
): boolean {
  if (!assumptions || typeof assumptions !== 'object') return false;
  return toBoolean(assumptions.logicNetworkInitialized, false);
}

/** One-time seed: builds CpmLogicLink[] from line items' predecessorActivityCode.
 *  Only call when assumptions.logicLinks is absent or empty. */
export function seedLogicLinksFromLineItems(lineItems: EstimateDomainTask[]): CpmLogicLink[] {
  // Map activity code -> runtime id (line-item id) for resolving predecessor identity.
  const runtimeIdByCode = new Map<string, string>();
  for (const task of lineItems) {
    const code = task.activityCode?.trim();
    if (code && !runtimeIdByCode.has(code)) runtimeIdByCode.set(code, task.id);
  }

  const links: CpmLogicLink[] = [];
  for (const task of lineItems) {
    const pred = task.predecessorActivityCode?.trim();
    const succ = task.activityCode?.trim();
    if (!pred || !succ) continue;
    links.push({
      predecessorActivityCode: pred,
      successorActivityCode: succ,
      predecessorRuntimeId: runtimeIdByCode.get(pred),
      successorRuntimeId: task.id,
      relationshipType: parseRelationshipType(task.relationshipType),
      lagDays: Math.max(0, task.lagDays ?? 0),
    });
  }
  return links;
}

// ── Layout ───────────────────────────────────────────────────────────────────

function parseLayoutEntry(raw: unknown): LogicNetworkLayout | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const src = raw as Record<string, unknown>;
  const code = typeof src.activityCode === 'string' ? src.activityCode.trim() : '';
  const x = toFiniteNumber(src.x, 0);
  const y = toFiniteNumber(src.y, 0);
  if (!code) return null;
  return { activityCode: code, x, y };
}

export function parseLogicNetworkLayoutFromAssumptions(
  assumptions: Record<string, unknown> | undefined | null,
): LogicNetworkLayout[] {
  if (!assumptions || typeof assumptions !== 'object') return [];
  const raw = assumptions.logicNetworkLayout;
  if (!Array.isArray(raw)) return [];
  return raw.map(parseLayoutEntry).filter((l): l is LogicNetworkLayout => l !== null);
}

export function logicNetworkLayoutToAssumptions(
  layout: LogicNetworkLayout[],
  existingAssumptions: Record<string, unknown> = {},
): Record<string, unknown> {
  return { ...existingAssumptions, logicNetworkLayout: layout };
}

// ── Leveled offsets ──────────────────────────────────────────────────────────

export function parseLeveledOffsetsFromAssumptions(
  assumptions: Record<string, unknown> | undefined | null,
): Record<string, number> {
  if (!assumptions || typeof assumptions !== 'object') return {};
  const raw = assumptions.leveledActivityOffsets;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      result[key] = value;
    }
  }
  return result;
}

export function leveledOffsetsToAssumptions(
  offsets: Record<string, number>,
  existingAssumptions: Record<string, unknown> = {},
): Record<string, unknown> {
  return { ...existingAssumptions, leveledActivityOffsets: offsets };
}

/** Merge all scheduling keys into assumptions in a single spread. */
export function parseLogicReviewIgnoredFromAssumptions(
  assumptions: Record<string, unknown> | undefined | null,
): string[] {
  if (!assumptions || typeof assumptions !== 'object') return [];
  const raw = assumptions.logicReviewIgnored;
  if (!Array.isArray(raw)) return [];
  return raw.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
}

export function logicReviewIgnoredToAssumptions(
  ignoredWarningIds: string[],
  existingAssumptions: Record<string, unknown> = {},
): Record<string, unknown> {
  return { ...existingAssumptions, logicReviewIgnored: ignoredWarningIds };
}

// ── Logic suggestion batch snapshot ─────────────────────────────────────────

function parseLogicBatchSnapshot(raw: unknown): LogicBatchSnapshot | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const src = raw as Record<string, unknown>;
  const appliedAt = typeof src.appliedAt === 'string' ? src.appliedAt.trim() : '';
  if (!appliedAt) return null;

  const addedLinks = Array.isArray(src.addedLinks)
    ? src.addedLinks.map(parseCpmLogicLink).filter((link): link is CpmLogicLink => link !== null)
    : [];
  const previousLinksSnapshot = Array.isArray(src.previousLinksSnapshot)
    ? src.previousLinksSnapshot
        .map(parseCpmLogicLink)
        .filter((link): link is CpmLogicLink => link !== null)
    : [];

  return {
    appliedAt,
    addedLinks,
    previousLinksSnapshot,
  };
}

export function parseLogicBatchSnapshotFromAssumptions(
  assumptions: Record<string, unknown> | undefined | null,
): LogicBatchSnapshot | null {
  if (!assumptions || typeof assumptions !== 'object') return null;
  return parseLogicBatchSnapshot(assumptions.lastLogicSuggestionBatch);
}

// ── Logic network view mode + committed CPM ───────────────────────────────────

export function parseLogicNetworkViewModeFromAssumptions(
  assumptions: Record<string, unknown> | undefined | null,
): LogicNetworkViewMode {
  if (!assumptions || typeof assumptions !== 'object') return 'logic-network';
  const raw = assumptions.logicNetworkViewMode;
  return raw === 'precedence-diagram' ? 'precedence-diagram' : 'logic-network';
}

function parseCpmActivityResult(raw: unknown): CpmActivityResult | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const src = raw as Record<string, unknown>;
  const activityCode =
    typeof src.activityCode === 'string' ? src.activityCode.trim() : '';
  if (!activityCode) return null;
  return {
    activityCode,
    earlyStart: toFiniteNumber(src.earlyStart, 0),
    earlyFinish: toFiniteNumber(src.earlyFinish, 0),
    lateStart: toFiniteNumber(src.lateStart, 0),
    lateFinish: toFiniteNumber(src.lateFinish, 0),
    totalFloat: toFiniteNumber(src.totalFloat, 0),
    freeFloat: toFiniteNumber(src.freeFloat, 0),
    isCritical: toBoolean(src.isCritical, false),
  };
}

export function parseCpmResultCacheFromAssumptions(
  assumptions: Record<string, unknown> | undefined | null,
): CpmResult | null {
  if (!assumptions || typeof assumptions !== 'object') return null;
  const raw = assumptions.cpmResultCache;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const src = raw as Record<string, unknown>;
  const activities = Array.isArray(src.activities)
    ? src.activities.map(parseCpmActivityResult).filter((a): a is CpmActivityResult => a !== null)
    : [];
  const displayCriticalActivityCodes = Array.isArray(src.displayCriticalActivityCodes)
    ? src.displayCriticalActivityCodes.filter((c): c is string => typeof c === 'string')
    : [];
  const base = {
    activities,
    projectDurationDays: toFiniteNumber(src.projectDurationDays, 0),
    criticalPathActivityCodes: Array.isArray(src.criticalPathActivityCodes)
      ? src.criticalPathActivityCodes.filter((c): c is string => typeof c === 'string')
      : [],
    warnings: Array.isArray(src.warnings)
      ? src.warnings.filter((w): w is string => typeof w === 'string')
      : [],
    criticalPathStatus:
      typeof src.criticalPathStatus === 'string' ? src.criticalPathStatus : 'not-run',
    hasValidCriticalPath: toBoolean(src.hasValidCriticalPath, false),
    criticalPathContinuityWarnings: Array.isArray(src.criticalPathContinuityWarnings)
      ? src.criticalPathContinuityWarnings.filter((w): w is string => typeof w === 'string')
      : [],
    displayCriticalActivityCodes,
    openStartActivityCodes: Array.isArray(src.openStartActivityCodes)
      ? src.openStartActivityCodes.filter((c): c is string => typeof c === 'string')
      : [],
    openFinishActivityCodes: Array.isArray(src.openFinishActivityCodes)
      ? src.openFinishActivityCodes.filter((c): c is string => typeof c === 'string')
      : [],
  } as Omit<CpmResult, 'hasRunCpm' | 'hasValidPrecedenceDiagram' | 'validCriticalPathActivityCodes' | 'hardErrors'>;

  return attachCpmWorkflowFields(base, {
    hasRunCpm: toBoolean(src.hasRunCpm, true),
    hardErrors: Array.isArray(src.hardErrors)
      ? src.hardErrors.filter((e): e is string => typeof e === 'string')
      : [],
  });
}

/** Persist canvas node positions only — never overwrite logic links or CPM metadata. */
export function mergeLogicLayoutAssumptionsOnly(
  layout: LogicNetworkLayout[],
  existingAssumptions: Record<string, unknown> = {},
  options: {
    logicNetworkViewMode?: LogicNetworkViewMode;
    precedenceDiagram?: PrecedenceDiagramState;
  } = {},
): Record<string, unknown> {
  return mergeScheduleAssumptions(
    {
      logicNetworkLayout: layout,
      logicNetworkInitialized: true,
      ...(options.logicNetworkViewMode !== undefined
        ? { logicNetworkViewMode: options.logicNetworkViewMode }
        : {}),
      ...(options.precedenceDiagram !== undefined
        ? { precedenceDiagram: options.precedenceDiagram }
        : {}),
    },
    existingAssumptions,
  );
}

export function mergeScheduleAssumptions(
  patch: Partial<{
    scheduleSettings: ScheduleSettings;
    logicLinks: CpmLogicLink[];
    logicNetworkLayout: LogicNetworkLayout[];
    leveledActivityOffsets: Record<string, number>;
    logicReviewIgnored: string[];
    lastLogicSuggestionBatch: LogicBatchSnapshot | null;
    logicNetworkInitialized: boolean;
    logicNetworkViewMode: LogicNetworkViewMode;
    precedenceDiagram: PrecedenceDiagramState | null;
    cpmResultCache: CpmResult | null;
  }>,
  existingAssumptions: Record<string, unknown> = {},
): Record<string, unknown> {
  const next = {
    ...existingAssumptions,
    ...(patch.scheduleSettings !== undefined ? { scheduleSettings: patch.scheduleSettings } : {}),
    ...(patch.logicLinks !== undefined ? { logicLinks: patch.logicLinks } : {}),
    ...(patch.logicNetworkLayout !== undefined
      ? { logicNetworkLayout: patch.logicNetworkLayout }
      : {}),
    ...(patch.leveledActivityOffsets !== undefined
      ? { leveledActivityOffsets: patch.leveledActivityOffsets }
      : {}),
    ...(patch.logicReviewIgnored !== undefined
      ? { logicReviewIgnored: patch.logicReviewIgnored }
      : {}),
    ...(patch.logicNetworkInitialized !== undefined
      ? { logicNetworkInitialized: patch.logicNetworkInitialized }
      : {}),
    ...(patch.logicNetworkViewMode !== undefined
      ? { logicNetworkViewMode: patch.logicNetworkViewMode }
      : {}),
  };

  const withPrecedenceDiagram =
    patch.precedenceDiagram !== undefined
      ? patch.precedenceDiagram === null
        ? (() => {
            const { precedenceDiagram: _removed, ...withoutPrecedenceDiagram } = next;
            return withoutPrecedenceDiagram;
          })()
        : { ...next, precedenceDiagram: patch.precedenceDiagram }
      : next;

  if (patch.lastLogicSuggestionBatch !== undefined) {
    if (patch.lastLogicSuggestionBatch === null) {
      const { lastLogicSuggestionBatch: _removed, ...withoutBatch } = withPrecedenceDiagram;
      if (patch.cpmResultCache !== undefined) {
        return mergeCpmResultCachePatch(withoutBatch, patch.cpmResultCache);
      }
      return withoutBatch;
    }
    const withBatch = {
      ...withPrecedenceDiagram,
      lastLogicSuggestionBatch: patch.lastLogicSuggestionBatch,
    };
    if (patch.cpmResultCache !== undefined) {
      return mergeCpmResultCachePatch(withBatch, patch.cpmResultCache);
    }
    return withBatch;
  }

  if (patch.cpmResultCache !== undefined) {
    return mergeCpmResultCachePatch(withPrecedenceDiagram, patch.cpmResultCache);
  }

  return withPrecedenceDiagram;
}

function mergeCpmResultCachePatch(
  assumptions: Record<string, unknown>,
  cpmResultCache: CpmResult | null,
): Record<string, unknown> {
  if (cpmResultCache === null) {
    const { cpmResultCache: _removed, cpmCalculatedAt: _at, ...withoutCache } = assumptions;
    return withoutCache;
  }
  return {
    ...assumptions,
    cpmResultCache,
    cpmCalculatedAt: new Date().toISOString(),
  };
}

/** Schedule-only keys that must reset when the activity set is replaced. */
export const SCHEDULE_LAYER_ASSUMPTION_KEYS = [
  'logicLinks',
  'logicNetworkLayout',
  'leveledActivityOffsets',
  'resourceLevelingResults',
  'logicReviewIgnored',
  'logicReviewAiSuggestions',
  'lastLogicSuggestionBatch',
  'cpmWarnings',
  'cpmResultCache',
  'cpmCalculatedAt',
  'logicNetworkViewMode',
  'precedenceDiagram',
  'levelThreeGanttBaseline',
] as const;

export function stripScheduleLayerKeys(
  assumptions: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...assumptions };
  for (const key of SCHEDULE_LAYER_ASSUMPTION_KEYS) {
    delete next[key];
  }
  return next;
}

export function getValidScheduleActivityCodes(
  lineItems: readonly EstimateDomainTask[],
): Set<string> {
  const codes = new Set<string>();
  for (const task of lineItems) {
    if (task.lineType && task.lineType !== 'task') continue;
    if (task.scheduleEnabled === false) continue;
    const code = task.activityCode?.trim();
    if (code) codes.add(code);
  }
  return codes;
}

/** Schedule-enabled construction activity codes (Logic Network / CPM source). */
export function getValidScheduleActivityCodesFromScheduleActivities(
  scheduleActivities: readonly Pick<ScheduleActivity, 'activityCode'>[],
): Set<string> {
  const codes = new Set<string>();
  for (const activity of scheduleActivities) {
    const code = activity.activityCode?.trim();
    if (code) codes.add(code);
  }
  return codes;
}

function isConstructionActivityScheduleCode(code: string): boolean {
  if (code.startsWith('ca-')) return true;
  return parseActivityCode(code.trim()) !== null;
}

/**
 * When saved logic links or layout reference construction activity codes that are not on
 * estimate line items, defer endpoint filtering until construction activities load as the
 * schedule source (avoids wiping persisted links on refresh).
 */
export function shouldDeferScheduleLayerActivityCodeFiltering(
  assumptions: Record<string, unknown> | undefined | null,
  lineItemCodes: Set<string>,
): boolean {
  const links = parseLogicLinksFromAssumptions(assumptions);
  const layout = parseLogicNetworkLayoutFromAssumptions(assumptions);
  const referencedCodes = new Set<string>();
  for (const link of links) {
    referencedCodes.add(link.predecessorActivityCode);
    referencedCodes.add(link.successorActivityCode);
  }
  for (const entry of layout) {
    referencedCodes.add(entry.activityCode);
  }

  for (const code of referencedCodes) {
    if (isConstructionActivityScheduleCode(code) && !lineItemCodes.has(code)) {
      return true;
    }
  }
  return false;
}

export interface ReconcileLogicLinksResult {
  links: CpmLogicLink[];
  preservedCount: number;
  prunedCount: number;
}

/**
 * Keep manual logic links when schedule activities reload.
 * Matches endpoints by stable activityCode; refreshes runtime IDs for canvas/CPM identity.
 */
export function reconcileLogicLinksWithScheduleActivities(
  links: CpmLogicLink[],
  scheduleActivities: readonly Pick<ScheduleActivity, 'activityCode' | 'runtimeActivityId'>[],
): ReconcileLogicLinksResult {
  const activityByCode = new Map<
    string,
    Pick<ScheduleActivity, 'activityCode' | 'runtimeActivityId'>
  >();
  for (const activity of scheduleActivities) {
    const code = activity.activityCode?.trim();
    if (code && !activityByCode.has(code)) {
      activityByCode.set(code, activity);
    }
  }
  const validCodes = new Set(activityByCode.keys());
  const sanitized = sanitizeLogicLinks(links);
  const reconciled: CpmLogicLink[] = [];
  let prunedCount = 0;

  for (const link of sanitized) {
    if (
      !validCodes.has(link.predecessorActivityCode) ||
      !validCodes.has(link.successorActivityCode)
    ) {
      prunedCount += 1;
      continue;
    }
    const pred = activityByCode.get(link.predecessorActivityCode);
    const succ = activityByCode.get(link.successorActivityCode);
    reconciled.push({
      ...link,
      predecessorRuntimeId: pred?.runtimeActivityId ?? link.predecessorRuntimeId,
      successorRuntimeId: succ?.runtimeActivityId ?? link.successorRuntimeId,
    });
  }

  return {
    links: reconciled,
    preservedCount: reconciled.length,
    prunedCount,
  };
}

function logicLinksEqual(a: CpmLogicLink[], b: CpmLogicLink[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((link, index) => {
    const other = b[index];
    return (
      link.predecessorActivityCode === other.predecessorActivityCode &&
      link.successorActivityCode === other.successorActivityCode &&
      link.relationshipType === other.relationshipType &&
      link.lagDays === other.lagDays &&
      (link.predecessorRuntimeId ?? '') === (other.predecessorRuntimeId ?? '') &&
      (link.successorRuntimeId ?? '') === (other.successorRuntimeId ?? '')
    );
  });
}

export { logicLinksEqual };

function exactLogicLinkKey(link: CpmLogicLink): string {
  return `${link.predecessorActivityCode}|${link.successorActivityCode}|${link.relationshipType}|${link.lagDays}`;
}

export function sanitizeLogicLinks(links: CpmLogicLink[]): CpmLogicLink[] {
  const seen = new Set<string>();
  const sanitized: CpmLogicLink[] = [];

  for (const link of links) {
    if (link.predecessorActivityCode === link.successorActivityCode) {
      continue;
    }
    const key = exactLogicLinkKey(link);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    sanitized.push(link);
  }

  return sanitized;
}

function filterLogicLinksForActivityCodes(
  links: CpmLogicLink[],
  validActivityCodes: Set<string>,
): CpmLogicLink[] {
  return links.filter(
    (link) =>
      validActivityCodes.has(link.predecessorActivityCode) &&
      validActivityCodes.has(link.successorActivityCode),
  );
}

/** Drop self-links, duplicates, and links whose endpoints are not in validActivityCodes. */
export function sanitizeLogicLinksForActivities(
  links: CpmLogicLink[],
  validActivityCodes: Set<string>,
): CpmLogicLink[] {
  return sanitizeLogicLinks(filterLogicLinksForActivityCodes(links, validActivityCodes));
}

function filterLogicNetworkLayoutForActivityCodes(
  layout: LogicNetworkLayout[],
  validActivityCodes: Set<string>,
): LogicNetworkLayout[] {
  return layout.filter((entry) => validActivityCodes.has(entry.activityCode));
}

function filterLeveledOffsetsForActivityCodes(
  offsets: Record<string, number>,
  validActivityCodes: Set<string>,
): Record<string, number> {
  const next: Record<string, number> = {};
  for (const [activityCode, offset] of Object.entries(offsets)) {
    if (validActivityCodes.has(activityCode)) {
      next[activityCode] = offset;
    }
  }
  return next;
}

function filterLogicReviewIgnoredForActivityCodes(
  ignoredWarningIds: string[],
  validActivityCodes: Set<string>,
): string[] {
  return ignoredWarningIds.filter((warningId) => {
    const parts = warningId.split('|');
    const referencedCodes = [parts[1], parts[2], parts[3]].filter(
      (code): code is string => typeof code === 'string' && code.trim().length > 0,
    );
    if (referencedCodes.length === 0) return true;
    return referencedCodes.every((code) => validActivityCodes.has(code));
  });
}

/** Remove schedule-layer data that no longer matches the current schedule source. */
export function sanitizeScheduleAssumptionsForLineItems(
  assumptions: Record<string, unknown> | undefined | null,
  lineItems: readonly EstimateDomainTask[],
  scheduleActivities?: readonly Pick<ScheduleActivity, 'activityCode' | 'runtimeActivityId'>[],
): Record<string, unknown> {
  const base = assumptions && typeof assumptions === 'object' ? { ...assumptions } : {};
  const validLineItemCodes = getValidScheduleActivityCodes(lineItems);
  const validScheduleCodes =
    scheduleActivities && scheduleActivities.length > 0
      ? getValidScheduleActivityCodesFromScheduleActivities(scheduleActivities)
      : new Set<string>();
  const useConstructionScheduleSource = validScheduleCodes.size > 0;
  const validCodes = useConstructionScheduleSource ? validScheduleCodes : validLineItemCodes;
  const deferActivityCodeFiltering = useConstructionScheduleSource
    ? false
    : shouldDeferScheduleLayerActivityCodeFiltering(base, validLineItemCodes);

  const parsedLinks = parseLogicLinksFromAssumptions(base);
  const logicLinks = deferActivityCodeFiltering
    ? sanitizeLogicLinks(parsedLinks)
    : sanitizeLogicLinks(filterLogicLinksForActivityCodes(parsedLinks, validCodes));

  if (
    logicLinks.length > 0 &&
    wouldCreateCircularDependency(logicLinks, [])
  ) {
    console.warn(
      '[scheduleAssumptions] Circular dependency detected after sanitizing logic links.',
    );
  }
  const logicNetworkLayout = deferActivityCodeFiltering
    ? parseLogicNetworkLayoutFromAssumptions(base)
    : filterLogicNetworkLayoutForActivityCodes(
        parseLogicNetworkLayoutFromAssumptions(base),
        validCodes,
      );
  const leveledActivityOffsets = deferActivityCodeFiltering
    ? parseLeveledOffsetsFromAssumptions(base)
    : filterLeveledOffsetsForActivityCodes(
        parseLeveledOffsetsFromAssumptions(base),
        validCodes,
      );
  const logicReviewIgnored = deferActivityCodeFiltering
    ? parseLogicReviewIgnoredFromAssumptions(base)
    : filterLogicReviewIgnoredForActivityCodes(
        parseLogicReviewIgnoredFromAssumptions(base),
        validCodes,
      );

  const logicNetworkInitialized = parseLogicNetworkInitializedFromAssumptions(base);
  const precedenceDiagram = parsePrecedenceDiagramFromAssumptions(base);

  const stripped = stripScheduleLayerKeys(base);
  return mergeScheduleAssumptions(
    {
      scheduleSettings: parseScheduleSettingsFromAssumptions(base),
      logicLinks,
      logicNetworkLayout,
      leveledActivityOffsets,
      logicReviewIgnored,
      logicNetworkInitialized,
      precedenceDiagram,
    },
    stripped,
  );
}

/** Replace import: keep project schedule settings, clear old network state, seed links from items. */
export function resetScheduleAssumptionsForReplacement(
  assumptions: Record<string, unknown> | undefined | null,
  importedLineItems: readonly EstimateDomainTask[],
): Record<string, unknown> {
  const base = assumptions && typeof assumptions === 'object' ? assumptions : {};
  const scheduleSettings = parseScheduleSettingsFromAssumptions(base);
  const stripped = stripScheduleLayerKeys(base);
  const seededLinks = seedLogicLinksFromLineItems([...importedLineItems]);

  return mergeScheduleAssumptions(
    {
      scheduleSettings,
      logicLinks: seededLinks,
      logicNetworkLayout: [],
      leveledActivityOffsets: {},
      logicReviewIgnored: [],
      logicNetworkInitialized: true,
    },
    stripped,
  );
}

function appendUniqueLogicLinks(
  existingLinks: CpmLogicLink[],
  additionalLinks: CpmLogicLink[],
): CpmLogicLink[] {
  const merged = [...existingLinks];
  for (const link of additionalLinks) {
    const duplicate = merged.some(
      (existing) =>
        existing.predecessorActivityCode === link.predecessorActivityCode &&
        existing.successorActivityCode === link.successorActivityCode,
    );
    if (!duplicate) merged.push(link);
  }
  return merged;
}

/** Add import: keep valid old links, drop missing-code links, seed from newly imported items. */
export function mergeScheduleAssumptionsForAddImport(
  assumptions: Record<string, unknown> | undefined | null,
  allLineItems: readonly EstimateDomainTask[],
  newlyImportedLineItems: readonly EstimateDomainTask[],
): Record<string, unknown> {
  const sanitized = sanitizeScheduleAssumptionsForLineItems(assumptions, allLineItems);
  const validActivityCodes = getValidScheduleActivityCodes(allLineItems);
  const existingLinks = parseLogicLinksFromAssumptions(sanitized);
  const importedSeeds = seedLogicLinksFromLineItems([...newlyImportedLineItems]).filter(
    (link) =>
      validActivityCodes.has(link.predecessorActivityCode) &&
      validActivityCodes.has(link.successorActivityCode),
  );

  return mergeScheduleAssumptions(
    {
      logicLinks: appendUniqueLogicLinks(existingLinks, importedSeeds),
      logicNetworkInitialized: true,
    },
    sanitized,
  );
}

export function buildScheduleActivitySignature(
  lineItems: readonly Pick<EstimateDomainTask, 'activityCode' | 'scheduleEnabled' | 'lineType'>[],
): string {
  return lineItems
    .filter((item) => (!item.lineType || item.lineType === 'task') && item.scheduleEnabled !== false)
    .map((item) => item.activityCode?.trim())
    .filter((code): code is string => Boolean(code))
    .sort()
    .join('|');
}
