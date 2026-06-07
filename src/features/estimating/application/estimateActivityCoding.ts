import {
  getCsiDivisionByCode,
  normalizeCsiDivisionCode,
} from '../domain/csiDivisions';
import { normalizeScopeName } from '../domain/csiScopeTemplates';
import type { EstimateRelationshipType } from '../domain/estimateTypes';
import type { EstimateDomainTask } from '../infrastructure/estimateDbTypes';
import type { EstimateScheduleTaskCandidate } from '../domain/estimateScheduleTypes';
import type { EstimateActivityTemplate } from '../data/residentialActivityMaster';
import type { EstimateDraftLine } from './estimateDraftLine';

const ACTIVITY_CODE_PATTERN = /^(\d{2})-(\d{2})-(\d{2})$/;
const DEFAULT_WORK_PACKAGE_LABEL = 'General';
const DEFAULT_RELATIONSHIP_TYPE: EstimateRelationshipType = 'FS';

/** Reserved work-package sequence used for user-defined (custom) activities: DD-99-XX. */
export const CUSTOM_ACTIVITY_SEQUENCE = 99;

export interface ParsedActivityCode {
  divisionCode: string;
  activitySequence: number;
  lineSequence: number;
}

export interface ActivityCodeIndexResult {
  byCode: Map<string, EstimateDraftLine>;
  duplicates: string[];
}

export interface AssignActivityCodeOptions {
  preserveManualCode?: boolean;
  forceRegenerate?: boolean;
  divisionName?: string;
}

export function pad2(value: number | string): string {
  const numeric = typeof value === 'number' ? value : Number(String(value).replace(/\D/g, ''));
  if (!Number.isFinite(numeric) || numeric < 0) return '00';
  return String(Math.trunc(numeric)).padStart(2, '0').slice(-2);
}

export function buildWorkPackageCode(
  divisionCode: string,
  activitySequence: number,
): string {
  return `${pad2(normalizeCsiDivisionCode(divisionCode))}-${pad2(activitySequence)}`;
}

export function buildActivityCode(
  divisionCode: string,
  activitySequence: number,
  lineSequence: number,
): string {
  return `${buildWorkPackageCode(divisionCode, activitySequence)}-${pad2(lineSequence)}`;
}

export function parseActivityCode(code: string): ParsedActivityCode | null {
  const trimmed = code.trim();
  const match = trimmed.match(ACTIVITY_CODE_PATTERN);
  if (!match) return null;
  return {
    divisionCode: match[1],
    activitySequence: Number(match[2]),
    lineSequence: Number(match[3]),
  };
}

export function normalizeRelationshipType(
  value: unknown,
): EstimateRelationshipType {
  if (value === 'SS' || value === 'FF' || value === 'SF') return value;
  return DEFAULT_RELATIONSHIP_TYPE;
}

export function compareActivityCodes(
  leftCode: string | undefined,
  rightCode: string | undefined,
): number {
  const left = parseActivityCode(leftCode ?? '');
  const right = parseActivityCode(rightCode ?? '');
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;

  if (left.divisionCode !== right.divisionCode) {
    return left.divisionCode.localeCompare(right.divisionCode, undefined, { numeric: true });
  }
  if (left.activitySequence !== right.activitySequence) {
    return left.activitySequence - right.activitySequence;
  }
  return left.lineSequence - right.lineSequence;
}

export function sortDraftLinesByActivityCode(
  lines: EstimateDraftLine[],
): EstimateDraftLine[] {
  return [...lines].sort((left, right) => {
    const byCode = compareActivityCodes(left.task.activityCode, right.task.activityCode);
    if (byCode !== 0) return byCode;
    return left.task.position - right.task.position;
  });
}

export function indexActivityCodes(lines: EstimateDraftLine[]): ActivityCodeIndexResult {
  const byCode = new Map<string, EstimateDraftLine>();
  const seen = new Map<string, number>();

  for (const line of lines) {
    const code = line.task.activityCode?.trim();
    if (!code) continue;
    byCode.set(code, line);
    seen.set(code, (seen.get(code) ?? 0) + 1);
  }

  const duplicates = [...seen.entries()]
    .filter(([, count]) => count > 1)
    .map(([code]) => code);

  return { byCode, duplicates };
}

export function validateActivityCodeUnique(
  code: string,
  lines: EstimateDraftLine[],
  excludeClientId?: string,
): string | null {
  const trimmed = code.trim();
  if (!trimmed) return 'Activity code is required.';
  if (!parseActivityCode(trimmed)) {
    return 'Activity code must use the format DD-AA-LL (for example 03-01-02).';
  }

  const duplicate = lines.find(
    (line) =>
      line.clientId !== excludeClientId &&
      line.task.activityCode?.trim() === trimmed,
  );
  if (duplicate) {
    return `Activity code ${trimmed} is already used by another line item.`;
  }

  return null;
}

function workPackageKey(scopeName?: string | null): string {
  return normalizeScopeName(scopeName) || DEFAULT_WORK_PACKAGE_LABEL;
}

export function groupLinesByWorkPackage(
  lines: EstimateDraftLine[],
  divisionCode: string,
): Map<string, EstimateDraftLine[]> {
  const normalizedDivision = pad2(normalizeCsiDivisionCode(divisionCode));
  const groups = new Map<string, EstimateDraftLine[]>();

  for (const line of lines) {
    const lineDivision = pad2(
      normalizeCsiDivisionCode(line.task.divisionCode ?? line.task.lineItem.csiDivision),
    );
    if (lineDivision !== normalizedDivision) continue;
    const key = workPackageKey(line.task.workPackageName ?? line.task.scopeName);
    const bucket = groups.get(key) ?? [];
    bucket.push(line);
    groups.set(key, bucket);
  }

  return groups;
}

export function nextActivitySequence(
  lines: EstimateDraftLine[],
  divisionCode: string,
): number {
  const normalizedDivision = pad2(normalizeCsiDivisionCode(divisionCode));
  let max = 0;

  for (const line of lines) {
    const lineDivision = pad2(
      normalizeCsiDivisionCode(line.task.divisionCode ?? line.task.lineItem.csiDivision),
    );
    if (lineDivision !== normalizedDivision) continue;
    const sequence = line.task.activitySequence ?? parseActivityCode(line.task.activityCode ?? '')?.activitySequence;
    if (sequence != null && sequence > max) max = sequence;
  }

  return max + 1;
}

export function nextLineSequence(
  lines: EstimateDraftLine[],
  divisionCode: string,
  activitySequence: number,
): number {
  const normalizedDivision = pad2(normalizeCsiDivisionCode(divisionCode));
  let max = 0;

  for (const line of lines) {
    const lineDivision = pad2(
      normalizeCsiDivisionCode(line.task.divisionCode ?? line.task.lineItem.csiDivision),
    );
    if (lineDivision !== normalizedDivision) continue;
    const lineActivity =
      line.task.activitySequence ??
      parseActivityCode(line.task.activityCode ?? '')?.activitySequence;
    if (lineActivity !== activitySequence) continue;
    const sequence =
      line.task.lineSequence ?? parseActivityCode(line.task.activityCode ?? '')?.lineSequence;
    if (sequence != null && sequence > max) max = sequence;
  }

  return max + 1;
}

function resolveActivitySequenceForWorkPackage(
  lines: EstimateDraftLine[],
  divisionCode: string,
  workPackageName: string,
  excludeClientId?: string,
): number {
  const normalizedDivision = pad2(normalizeCsiDivisionCode(divisionCode));
  const packageKey = workPackageKey(workPackageName);

  for (const line of lines) {
    if (line.clientId === excludeClientId) continue;
    const lineDivision = pad2(
      normalizeCsiDivisionCode(line.task.divisionCode ?? line.task.lineItem.csiDivision),
    );
    if (lineDivision !== normalizedDivision) continue;
    const linePackage = workPackageKey(line.task.workPackageName ?? line.task.scopeName);
    if (linePackage !== packageKey) continue;
    const sequence =
      line.task.activitySequence ??
      parseActivityCode(line.task.activityCode ?? '')?.activitySequence;
    if (sequence != null) return sequence;
  }

  return nextActivitySequence(lines, divisionCode);
}

export function applyActivityCodeFieldsToTask(
  task: EstimateDomainTask,
  fields: {
    activityCode: string;
    divisionCode: string;
    divisionName?: string;
    workPackageCode: string;
    workPackageName: string;
    activitySequence: number;
    lineSequence: number;
  },
): EstimateDomainTask {
  return {
    ...task,
    activityCode: fields.activityCode,
    divisionCode: fields.divisionCode,
    divisionName: fields.divisionName,
    workPackageCode: fields.workPackageCode,
    workPackageName: fields.workPackageName,
    activitySequence: fields.activitySequence,
    lineSequence: fields.lineSequence,
    relationshipType: normalizeRelationshipType(task.relationshipType),
    lagDays: task.lagDays ?? 0,
    lineItem: {
      ...task.lineItem,
      csiDivision: fields.divisionCode,
    },
    scopeName: fields.workPackageName,
  };
}

/** Builds the user-facing display code, appending `.N` for repeated instances (N > 1). */
export function buildDisplayCode(
  activityCode: string,
  activityInstance?: number,
): string {
  if (activityInstance != null && activityInstance > 1) {
    return `${activityCode}.${activityInstance}`;
  }
  return activityCode;
}

/** Counts existing draft lines that came from the given master activity. */
export function countMasterActivityInstances(
  lines: EstimateDraftLine[],
  masterActivityCode: string,
  excludeClientId?: string,
): number {
  const target = masterActivityCode.trim();
  let count = 0;
  for (const line of lines) {
    if (line.clientId === excludeClientId) continue;
    if (line.task.masterActivityCode?.trim() === target) count += 1;
  }
  return count;
}

/** Next line sequence within the reserved DD-99 custom work package for a division. */
export function nextCustomLineSequence(
  lines: EstimateDraftLine[],
  divisionCode: string,
): number {
  return nextLineSequence(lines, divisionCode, CUSTOM_ACTIVITY_SEQUENCE);
}

/** Builds a reserved custom activity code: `DD-99-XX`. */
export function buildCustomActivityCode(
  divisionCode: string,
  lineSequence: number,
): string {
  return buildActivityCode(divisionCode, CUSTOM_ACTIVITY_SEQUENCE, lineSequence);
}

/**
 * Applies a master activity's fixed identity and classification onto a draft
 * line. The activity code/title come from the master and never change with add
 * order. `instance` (>1) marks a repeated instance and drives the display code.
 */
export function applyMasterActivityToDraftLine(
  line: EstimateDraftLine,
  master: EstimateActivityTemplate,
  instance: number,
): EstimateDraftLine {
  const parsed = parseActivityCode(master.activityCode);
  const activitySequence = parsed?.activitySequence ?? 0;
  const lineSequence = parsed?.lineSequence ?? 0;
  const displayCode = buildDisplayCode(master.activityCode, instance);

  const baseTask = applyActivityCodeFieldsToTask(line.task, {
    activityCode: master.activityCode,
    divisionCode: master.divisionCode,
    divisionName: master.divisionName,
    workPackageCode: master.workPackageCode,
    workPackageName: master.workPackageName,
    activitySequence,
    lineSequence,
  });

  return {
    ...line,
    unit: master.defaultUnit || line.unit,
    task: {
      ...baseTask,
      title: master.title,
      trade: master.primaryTrade,
      masterActivityCode: master.activityCode,
      isCustomActivity: false,
      activityInstance: instance,
      displayCode,
      activityType: master.activityType,
      sequencingCategory: master.sequencingCategory,
      logicAnchor: master.logicAnchor,
      scheduleEnabled: master.scheduleEnabled,
      weatherSensitive: master.weatherSensitive ?? false,
      inspectionRequired: master.inspectionRequired ?? false,
      lineItem: {
        ...baseTask.lineItem,
        labor: {
          ...baseTask.lineItem.labor,
          crewSize: master.defaultCrewSize,
          hoursPerDay: master.defaultHoursPerDay,
        },
      },
    },
  };
}

/**
 * Assigns a reserved custom (DD-99-XX) code to a user-defined activity that is
 * not in the master dataset, preserving the user's typed title.
 */
export function assignCustomActivityCodeToDraftLine(
  line: EstimateDraftLine,
  lines: EstimateDraftLine[],
): EstimateDraftLine {
  const divisionCode = pad2(
    normalizeCsiDivisionCode(line.task.divisionCode ?? line.task.lineItem.csiDivision),
  );
  const lineSequence = nextCustomLineSequence(lines, divisionCode);
  const activityCode = buildCustomActivityCode(divisionCode, lineSequence);
  const division = getCsiDivisionByCode(divisionCode);
  const divisionName = line.task.divisionName ?? division?.name ?? divisionCode;
  const workPackageName =
    normalizeScopeName(line.task.workPackageName ?? line.task.scopeName) || 'Custom Activities';

  const baseTask = applyActivityCodeFieldsToTask(line.task, {
    activityCode,
    divisionCode,
    divisionName,
    workPackageCode: buildWorkPackageCode(divisionCode, CUSTOM_ACTIVITY_SEQUENCE),
    workPackageName,
    activitySequence: CUSTOM_ACTIVITY_SEQUENCE,
    lineSequence,
  });

  return {
    ...line,
    task: {
      ...baseTask,
      masterActivityCode: undefined,
      isCustomActivity: true,
      activityInstance: 1,
      displayCode: activityCode,
    },
  };
}

export function assignActivityCodeToDraftLine(
  line: EstimateDraftLine,
  lines: EstimateDraftLine[],
  options: AssignActivityCodeOptions = {},
): EstimateDraftLine {
  const divisionCode = pad2(
    normalizeCsiDivisionCode(
      line.task.divisionCode ?? line.task.lineItem.csiDivision,
    ),
  );
  const workPackageName =
    normalizeScopeName(line.task.workPackageName ?? line.task.scopeName) ||
    DEFAULT_WORK_PACKAGE_LABEL;
  const division = getCsiDivisionByCode(divisionCode);
  const divisionName = options.divisionName ?? line.task.divisionName ?? division?.name ?? divisionCode;

  const manualCode = line.task.activityCode?.trim();
  if (
    options.preserveManualCode &&
    manualCode &&
    parseActivityCode(manualCode) &&
    !options.forceRegenerate
  ) {
    const parsed = parseActivityCode(manualCode)!;
    return {
      ...line,
      task: applyActivityCodeFieldsToTask(line.task, {
        activityCode: manualCode,
        divisionCode: pad2(parsed.divisionCode),
        divisionName,
        workPackageCode: buildWorkPackageCode(parsed.divisionCode, parsed.activitySequence),
        workPackageName,
        activitySequence: parsed.activitySequence,
        lineSequence: parsed.lineSequence,
      }),
    };
  }

  const activitySequence = resolveActivitySequenceForWorkPackage(
    lines,
    divisionCode,
    workPackageName,
    line.clientId,
  );
  const lineSequence = nextLineSequence(lines, divisionCode, activitySequence);
  const activityCode = buildActivityCode(divisionCode, activitySequence, lineSequence);

  return {
    ...line,
    task: applyActivityCodeFieldsToTask(line.task, {
      activityCode,
      divisionCode,
      divisionName,
      workPackageCode: buildWorkPackageCode(divisionCode, activitySequence),
      workPackageName,
      activitySequence,
      lineSequence,
    }),
  };
}

export function backfillActivityCodesForDraftLines(
  lines: EstimateDraftLine[],
): EstimateDraftLine[] {
  const needsBackfill = lines.some((line) => !line.task.activityCode?.trim());
  if (!needsBackfill) return lines;

  const cloned = lines.map((line) => ({
    ...line,
    task: { ...line.task },
  }));

  const byDivision = new Map<string, EstimateDraftLine[]>();
  for (const line of cloned) {
    const divisionCode = pad2(
      normalizeCsiDivisionCode(line.task.divisionCode ?? line.task.lineItem.csiDivision) ||
        '00',
    );
    const bucket = byDivision.get(divisionCode) ?? [];
    bucket.push(line);
    byDivision.set(divisionCode, bucket);
  }

  const result: EstimateDraftLine[] = [];

  for (const [divisionCode, divisionLines] of [...byDivision.entries()].sort(([a], [b]) =>
    a.localeCompare(b, undefined, { numeric: true }),
  )) {
    const packageOrder: string[] = [];
    const packageBuckets = new Map<string, EstimateDraftLine[]>();

    for (const line of divisionLines) {
      const key = workPackageKey(line.task.workPackageName ?? line.task.scopeName);
      if (!packageBuckets.has(key)) packageOrder.push(key);
      const bucket = packageBuckets.get(key) ?? [];
      bucket.push(line);
      packageBuckets.set(key, bucket);
    }

    packageOrder.forEach((packageKey, packageIndex) => {
      const activitySequence = packageIndex + 1;
      const bucket = packageBuckets.get(packageKey) ?? [];
      bucket.forEach((line, lineIndex) => {
        if (line.task.activityCode?.trim() && parseActivityCode(line.task.activityCode)) {
          result.push(line);
          return;
        }

        const lineSequence = lineIndex + 1;
        const division = getCsiDivisionByCode(divisionCode);
        result.push({
          ...line,
          task: applyActivityCodeFieldsToTask(line.task, {
            activityCode: buildActivityCode(divisionCode, activitySequence, lineSequence),
            divisionCode,
            divisionName: line.task.divisionName ?? division?.name ?? divisionCode,
            workPackageCode: buildWorkPackageCode(divisionCode, activitySequence),
            workPackageName: packageKey,
            activitySequence,
            lineSequence,
          }),
        });
      });
    });
  }

  return sortDraftLinesByActivityCode(result).map((line, index) => ({
    ...line,
    task: { ...line.task, position: index },
  }));
}

export function backfillActivityCodesForDomainTasks(
  tasks: EstimateDomainTask[],
): EstimateDomainTask[] {
  const drafts = tasks.map((task, index) => ({
    clientId: task.id,
    task: { ...task, position: index },
    unit: '',
    indirectCost: 0,
  }));
  return backfillActivityCodesForDraftLines(drafts).map((line) => line.task);
}

export function syncActivityCodeFromParsedManualCode(
  line: EstimateDraftLine,
  lines: EstimateDraftLine[],
): EstimateDraftLine {
  const manualCode = line.task.activityCode?.trim();
  if (!manualCode) return assignActivityCodeToDraftLine(line, lines);

  const parsed = parseActivityCode(manualCode);
  if (!parsed) return line;

  const division = getCsiDivisionByCode(parsed.divisionCode);
  const workPackageName =
    normalizeScopeName(line.task.workPackageName ?? line.task.scopeName) ||
    DEFAULT_WORK_PACKAGE_LABEL;

  return {
    ...line,
    task: applyActivityCodeFieldsToTask(line.task, {
      activityCode: manualCode,
      divisionCode: parsed.divisionCode,
      divisionName: line.task.divisionName ?? division?.name ?? parsed.divisionCode,
      workPackageCode: buildWorkPackageCode(parsed.divisionCode, parsed.activitySequence),
      workPackageName,
      activitySequence: parsed.activitySequence,
      lineSequence: parsed.lineSequence,
    }),
  };
}

export interface ResolveSchedulePredecessorsResult {
  candidates: EstimateScheduleTaskCandidate[];
  warnings: string[];
}

export function resolvePredecessorCandidateIds(
  candidates: EstimateScheduleTaskCandidate[],
): ResolveSchedulePredecessorsResult {
  const warnings: string[] = [];
  const codeToCandidateId = new Map<string, string>();

  for (const candidate of candidates) {
    const code = candidate.activityCode?.trim();
    if (!code) continue;
    if (codeToCandidateId.has(code)) {
      warnings.push(`Duplicate activity code "${code}" found in schedule candidates.`);
      continue;
    }
    codeToCandidateId.set(code, candidate.candidateId);
  }

  const resolved = candidates.map((candidate) => {
    const predecessorCode = candidate.predecessorActivityCode?.trim();
    if (!predecessorCode) return candidate;

    const predecessorId = codeToCandidateId.get(predecessorCode);
    if (!predecessorId) {
      warnings.push(
        `Activity "${candidate.activityCode ?? candidate.title}" references missing predecessor "${predecessorCode}".`,
      );
      return candidate;
    }

    if (predecessorId === candidate.candidateId) {
      warnings.push(
        `Activity "${candidate.activityCode ?? candidate.title}" cannot depend on itself.`,
      );
      return candidate;
    }

    return {
      ...candidate,
      predecessorCandidateIds: [predecessorId],
    };
  });

  return { candidates: resolved, warnings };
}

export function compareScheduleCandidatesByActivityCode(
  left: EstimateScheduleTaskCandidate,
  right: EstimateScheduleTaskCandidate,
): number {
  const byCode = compareActivityCodes(left.activityCode, right.activityCode);
  if (byCode !== 0) return byCode;
  return left.sortOrder - right.sortOrder;
}
