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
export function mergeScheduleAssumptions(
  patch: Partial<{
    scheduleSettings: ScheduleSettings;
    logicLinks: CpmLogicLink[];
    logicNetworkLayout: LogicNetworkLayout[];
    leveledActivityOffsets: Record<string, number>;
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
  };
}
