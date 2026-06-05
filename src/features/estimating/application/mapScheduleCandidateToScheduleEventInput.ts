import type {
  EstimateSchedulePlan,
  EstimateScheduleTaskCandidate,
  EstimateScheduleWarning,
} from '../domain/estimateScheduleTypes';
export const ESTIMATE_SCHEDULE_LINE_SYNC_KEY = 'estimate_schedule_line';

export interface MapScheduleCandidateToScheduleEventOptions {
  projectId: string;
  defaultStartDate: string;
  timezone?: string;
  calendarId?: string;
}

export interface EstimateScheduleEventSyncMetadata {
  syncKey: typeof ESTIMATE_SCHEDULE_LINE_SYNC_KEY;
  estimateId: string;
  estimateVersionId: string;
  estimateVersionNumber: number;
  estimateLineItemId: string;
  candidateId: string;
  csiDivision?: string;
  csiSection?: string;
  scopeName: string;
  laborHours: number;
  crewDays: number;
  durationDays: number;
  weatherSensitive: boolean;
  inspectionRequired: boolean;
}

/** Draft schedule event payload for future creation — snake_case, no service coupling. */
export interface EstimateScheduleEventDraftInput {
  project_id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  all_day: true;
  event_type: 'estimate_task';
  trade: string | null;
  status: 'planned';
  priority: 'normal';
  source: 'estimate';
  timezone?: string;
  calendar_id?: string;
  syncMetadata: EstimateScheduleEventSyncMetadata;
}

function safeFiniteNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function parseYmd(date: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function formatYmd(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDaysToScheduleDate(startDate: string, daysToAdd: number): string {
  const safeDays = Number.isFinite(daysToAdd) ? Math.max(0, Math.floor(daysToAdd)) : 0;
  const parsed = parseYmd(startDate);
  if (!parsed) return startDate;

  parsed.setUTCDate(parsed.getUTCDate() + safeDays);
  return formatYmd(parsed);
}

export function resolveScheduleEventDurationDays(
  candidate: EstimateScheduleTaskCandidate,
): number {
  const duration = safeFiniteNumber(candidate.labor.durationDays, 0);
  if (duration < 1) return 1;
  return Math.ceil(duration);
}

export function resolveScheduleEventStartDate(
  candidate: EstimateScheduleTaskCandidate,
  options: MapScheduleCandidateToScheduleEventOptions,
): string {
  const planned = candidate.plannedStartDate;
  if (typeof planned === 'string' && planned.trim()) {
    return planned.trim();
  }
  return options.defaultStartDate;
}

export function calculateScheduleEventEndDate(
  startDate: string,
  durationDays: number,
): string {
  const safeDuration = resolveDurationDaysFromNumber(durationDays);
  return addDaysToScheduleDate(startDate, safeDuration - 1);
}

function resolveDurationDaysFromNumber(durationDays: number): number {
  if (!Number.isFinite(durationDays) || durationDays < 1) return 1;
  return Math.ceil(durationDays);
}

function formatWarningLines(warnings: EstimateScheduleWarning[]): string[] {
  return warnings
    .filter((warning) => warning.message.trim().length > 0)
    .map((warning) => `- ${warning.message.trim()}`);
}

export function buildEstimateScheduleEventDescription(
  candidate: EstimateScheduleTaskCandidate,
  durationDays: number,
): string {
  const laborHours = safeFiniteNumber(
    candidate.labor.adjustedLaborHours || candidate.labor.laborHours,
    0,
  );
  const crewDays = safeFiniteNumber(candidate.labor.crewDays, 0);

  const lines = [
    'Estimate source',
    `Version: v${candidate.source.estimateVersionNumber}`,
    `Line item: ${candidate.source.estimateLineItemId}`,
    `CSI division: ${candidate.divisionLabel}`,
    `Scope: ${candidate.scopeLabel}`,
    `Labor hours: ${laborHours.toFixed(1)}`,
    `Crew-days: ${crewDays.toFixed(2)}`,
    `Duration: ${durationDays} day${durationDays === 1 ? '' : 's'}`,
  ];

  const warningLines = formatWarningLines(candidate.warnings);
  if (warningLines.length > 0) {
    lines.push('Warnings:', ...warningLines);
  }

  return lines.join('\n');
}

function buildSyncMetadata(
  candidate: EstimateScheduleTaskCandidate,
  durationDays: number,
): EstimateScheduleEventSyncMetadata {
  return {
    syncKey: ESTIMATE_SCHEDULE_LINE_SYNC_KEY,
    estimateId: candidate.source.estimateId,
    estimateVersionId: candidate.source.estimateVersionId,
    estimateVersionNumber: candidate.source.estimateVersionNumber,
    estimateLineItemId: candidate.source.estimateLineItemId,
    candidateId: candidate.candidateId,
    csiDivision: candidate.csiDivision,
    csiSection: candidate.csiSection,
    scopeName: candidate.scopeLabel,
    laborHours: safeFiniteNumber(
      candidate.labor.adjustedLaborHours || candidate.labor.laborHours,
      0,
    ),
    crewDays: safeFiniteNumber(candidate.labor.crewDays, 0),
    durationDays,
    weatherSensitive: candidate.weatherSensitive,
    inspectionRequired: candidate.inspectionRequired,
  };
}

/** Map one schedule candidate to a draft schedule event input object. */
export function mapScheduleCandidateToScheduleEventInput(
  candidate: EstimateScheduleTaskCandidate,
  options: MapScheduleCandidateToScheduleEventOptions,
): EstimateScheduleEventDraftInput {
  const durationDays = resolveScheduleEventDurationDays(candidate);
  const startDate = resolveScheduleEventStartDate(candidate, options);
  const endDate = calculateScheduleEventEndDate(startDate, durationDays);

  const draft: EstimateScheduleEventDraftInput = {
    project_id: options.projectId,
    title: candidate.title.trim() || candidate.description?.trim() || 'Estimate task',
    description: buildEstimateScheduleEventDescription(candidate, durationDays),
    start_date: startDate,
    end_date: endDate,
    all_day: true,
    event_type: 'estimate_task',
    trade: candidate.trade?.trim() || null,
    status: 'planned',
    priority: 'normal',
    source: 'estimate',
    syncMetadata: buildSyncMetadata(candidate, durationDays),
  };

  if (options.timezone?.trim()) {
    draft.timezone = options.timezone.trim();
  }
  if (options.calendarId?.trim()) {
    draft.calendar_id = options.calendarId.trim();
  }

  return draft;
}

function collectSchedulePlanCandidates(
  plan: EstimateSchedulePlan,
): EstimateScheduleTaskCandidate[] {
  return plan.divisions.flatMap((division) =>
    division.scopes.flatMap((scope) => scope.tasks),
  );
}

/** Map all candidates in a schedule plan to draft schedule event inputs. */
export function mapSchedulePlanToScheduleEventInputs(
  plan: EstimateSchedulePlan,
  options: MapScheduleCandidateToScheduleEventOptions,
): EstimateScheduleEventDraftInput[] {
  return collectSchedulePlanCandidates(plan).map((candidate) =>
    mapScheduleCandidateToScheduleEventInput(candidate, options),
  );
}
