import type { EstimateDomainTask } from '../infrastructure/estimateDbTypes';
import {
  DEFAULT_SCHEDULE_SETTINGS,
  type CpmLogicLink,
  type CpmRelationshipType,
  type LogicNetworkLayout,
  type ScheduleSettings,
} from './cpmTypes';

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
  return {
    predecessorActivityCode: pred,
    successorActivityCode: succ,
    relationshipType: parseRelationshipType(src.relationshipType),
    lagDays: toFiniteNumber(src.lagDays, 0),
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

/** One-time seed: builds CpmLogicLink[] from line items' predecessorActivityCode.
 *  Only call when assumptions.logicLinks is absent or empty. */
export function seedLogicLinksFromLineItems(lineItems: EstimateDomainTask[]): CpmLogicLink[] {
  const links: CpmLogicLink[] = [];
  for (const task of lineItems) {
    const pred = task.predecessorActivityCode?.trim();
    const succ = task.activityCode?.trim();
    if (!pred || !succ) continue;
    links.push({
      predecessorActivityCode: pred,
      successorActivityCode: succ,
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

export function mergeScheduleAssumptions(
  patch: Partial<{
    scheduleSettings: ScheduleSettings;
    logicLinks: CpmLogicLink[];
    logicNetworkLayout: LogicNetworkLayout[];
    leveledActivityOffsets: Record<string, number>;
    logicReviewIgnored: string[];
  }>,
  existingAssumptions: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
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
  'cpmWarnings',
  'cpmResultCache',
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

/** Remove schedule-layer data that no longer matches the current line items. */
export function sanitizeScheduleAssumptionsForLineItems(
  assumptions: Record<string, unknown> | undefined | null,
  lineItems: readonly EstimateDomainTask[],
): Record<string, unknown> {
  const base = assumptions && typeof assumptions === 'object' ? { ...assumptions } : {};
  const validActivityCodes = getValidScheduleActivityCodes(lineItems);

  const logicLinks = filterLogicLinksForActivityCodes(
    parseLogicLinksFromAssumptions(base),
    validActivityCodes,
  );
  const logicNetworkLayout = filterLogicNetworkLayoutForActivityCodes(
    parseLogicNetworkLayoutFromAssumptions(base),
    validActivityCodes,
  );
  const leveledActivityOffsets = filterLeveledOffsetsForActivityCodes(
    parseLeveledOffsetsFromAssumptions(base),
    validActivityCodes,
  );
  const logicReviewIgnored = filterLogicReviewIgnoredForActivityCodes(
    parseLogicReviewIgnoredFromAssumptions(base),
    validActivityCodes,
  );

  const stripped = stripScheduleLayerKeys(base);
  return mergeScheduleAssumptions(
    {
      scheduleSettings: parseScheduleSettingsFromAssumptions(base),
      logicLinks,
      logicNetworkLayout,
      leveledActivityOffsets,
      logicReviewIgnored,
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
    { logicLinks: appendUniqueLogicLinks(existingLinks, importedSeeds) },
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
