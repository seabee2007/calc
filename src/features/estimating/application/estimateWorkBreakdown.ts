import {
  getCsiDivisionByCode,
  getCsiDivisionLabel,
  normalizeCsiDivisionCode,
} from '../domain/csiDivisions';
import type {
  EstimateSelectedDivision,
  EstimateSelectedDivisionSource,
} from '../domain/estimateTypes';
import type { EstimateGroupRollup } from '../domain/estimateLineItemTree';
import { emptyGroupRollup } from '../domain/estimateLineItemTree';
import type { EstimateDomainTask } from '../infrastructure/estimateDbTypes';
import type { EstimateDraftLine } from './estimateDraftLine';
import {
  computeDraftLineRollupSlice,
  computeTaskRollupSlice,
  rollupTaskSlices,
} from './estimateGroupRollups';

export interface EstimateDivisionBucket {
  code: string;
  label: string;
  name: string;
  rollup: EstimateGroupRollup;
  activityCount: number;
  hasActivities: boolean;
}

export interface EstimateWorkBreakdown {
  divisions: EstimateDivisionBucket[];
}

function parseRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function selectedDivisionSource(value: unknown): EstimateSelectedDivisionSource {
  return value === 'ai' || value === 'inferred' || value === 'manual' ? value : 'manual';
}

function selectedDivisionConfidence(value: unknown): number | undefined {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(numeric) ? Math.min(1, Math.max(0, numeric)) : undefined;
}

function isTaskRow(task: EstimateDomainTask): boolean {
  return task.lineType === 'task' || task.lineType == null;
}

/** Normalize, dedupe, and preserve first-seen order for CSI division codes. */
export function normalizeSelectedDivisionCodes(codes: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of codes) {
    const normalized = normalizeCsiDivisionCode(raw);
    if (!normalized || !/^\d{2}$/.test(normalized) || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

export function buildSelectedDivisionsFromCodes(
  codes: readonly string[],
  options: { source?: EstimateSelectedDivisionSource; createdAt?: string } = {},
): EstimateSelectedDivision[] {
  const createdAt = options.createdAt ?? new Date().toISOString();
  const source = options.source ?? 'manual';
  return normalizeSelectedDivisionCodes(codes).map((code) => {
    const division = getCsiDivisionByCode(code);
    return {
      code,
      name: division?.name ?? code,
      source,
      createdAt,
    };
  });
}

export function normalizeSelectedDivisions(
  divisions: readonly Partial<EstimateSelectedDivision>[],
  options: { fallbackSource?: EstimateSelectedDivisionSource; createdAt?: string } = {},
): EstimateSelectedDivision[] {
  const seen = new Set<string>();
  const result: EstimateSelectedDivision[] = [];

  for (const raw of divisions) {
    const code = normalizeCsiDivisionCode(raw.code);
    if (!code || !/^\d{2}$/.test(code) || seen.has(code)) continue;
    seen.add(code);
    const division = getCsiDivisionByCode(code);
    result.push({
      code,
      name: raw.name?.trim() || division?.name || code,
      source: selectedDivisionSource(raw.source ?? options.fallbackSource),
      confidence: selectedDivisionConfidence(raw.confidence),
      reason: raw.reason?.trim() || undefined,
      createdAt: raw.createdAt || options.createdAt || new Date().toISOString(),
    });
  }

  return result;
}

export function selectedDivisionsFromSnapshot(snapshot: unknown): EstimateSelectedDivision[] {
  const snapshotObj = parseRecord(snapshot);
  const selectedDivisions = Array.isArray(snapshotObj.selectedDivisions)
    ? snapshotObj.selectedDivisions
    : [];
  const normalizedFromObjects = normalizeSelectedDivisions(
    selectedDivisions.map((item) => parseRecord(item) as Partial<EstimateSelectedDivision>),
  );
  if (normalizedFromObjects.length > 0) return normalizedFromObjects;

  const meta = parseRecord(snapshotObj.meta);
  const codes = Array.isArray(meta.selectedDivisionCodes) ? meta.selectedDivisionCodes : [];
  return buildSelectedDivisionsFromCodes(
    codes.filter((code): code is string => typeof code === 'string'),
    { source: 'manual' },
  );
}

export function selectedDivisionCodesFromSnapshot(snapshot: unknown): string[] {
  return selectedDivisionsFromSnapshot(snapshot).map((division) => division.code);
}

export function createDivisionBucketsFromSelection(
  codes: readonly string[],
): EstimateDivisionBucket[] {
  const normalized = normalizeSelectedDivisionCodes(codes);
  return normalized.map((code) => {
    const division = getCsiDivisionByCode(code);
    return {
      code,
      label: division?.label ?? (getCsiDivisionLabel(code) || code),
      name: division?.name ?? code,
      rollup: emptyGroupRollup(),
      activityCount: 0,
      hasActivities: false,
    };
  });
}

export function buildWorkBreakdownFromSelection(codes: readonly string[]): EstimateWorkBreakdown {
  return { divisions: createDivisionBucketsFromSelection(codes) };
}

function normalizedDivisionCodeFromValue(value?: string | null): string | null {
  const normalized = normalizeCsiDivisionCode(value);
  if (!normalized || !/^\d{2}$/.test(normalized)) return null;
  return normalized;
}

function divisionCodeFromDraftLine(line: EstimateDraftLine): string | null {
  return normalizedDivisionCodeFromValue(line.task.lineItem.csiDivision);
}

function divisionCodeFromTask(task: EstimateDomainTask): string | null {
  return normalizedDivisionCodeFromValue(task.lineItem.csiDivision);
}

function rollupForDivisionActivities(
  draftLines: EstimateDraftLine[],
  savedTasks: EstimateDomainTask[],
  divisionCode: string,
): EstimateGroupRollup {
  const slices = [
    ...draftLines
      .filter((line) => divisionCodeFromDraftLine(line) === divisionCode)
      .map((line) => computeDraftLineRollupSlice(line)),
    ...savedTasks
      .filter((task) => isTaskRow(task) && divisionCodeFromTask(task) === divisionCode)
      .map((task) => computeTaskRollupSlice(task)),
  ];

  if (slices.length === 0) return emptyGroupRollup();
  return rollupTaskSlices(slices);
}

/** Infer CSI division codes present in draft or saved task rows. */
export function inferDivisionCodesFromItems(
  draftLines: readonly EstimateDraftLine[],
  savedTasks: readonly EstimateDomainTask[],
): string[] {
  const codes: string[] = [];

  for (const line of draftLines) {
    const normalized = normalizeCsiDivisionCode(line.task.lineItem.csiDivision);
    if (normalized && /^\d{2}$/.test(normalized)) {
      codes.push(normalized);
    }
  }

  for (const task of savedTasks) {
    if (!isTaskRow(task)) continue;
    const normalized = normalizeCsiDivisionCode(task.lineItem.csiDivision);
    if (normalized && /^\d{2}$/.test(normalized)) {
      codes.push(normalized);
    }
  }

  return normalizeSelectedDivisionCodes(codes);
}

export function mergeDivisionBucketsWithActivities(
  selectedCodes: readonly string[],
  draftLines: readonly EstimateDraftLine[],
  savedTasks: readonly EstimateDomainTask[],
): EstimateWorkBreakdown {
  const mergedCodes = normalizeSelectedDivisionCodes([
    ...selectedCodes,
    ...inferDivisionCodesFromItems(draftLines, savedTasks),
  ]);

  if (mergedCodes.length === 0) {
    return { divisions: [] };
  }

  const divisions = mergedCodes.map((code) => {
    const division = getCsiDivisionByCode(code);
    const rollup = rollupForDivisionActivities(draftLines, savedTasks, code);
    const activityCount = rollup.itemCount;

    return {
      code,
      label: division?.label ?? (getCsiDivisionLabel(code) || code),
      name: division?.name ?? code,
      rollup,
      activityCount,
      hasActivities: activityCount > 0,
    };
  });

  return { divisions };
}

export function hasEstimateWorkBreakdown(
  selectedCodes: readonly string[],
  draftLines: readonly EstimateDraftLine[],
  savedTasks: readonly EstimateDomainTask[],
): boolean {
  if (normalizeSelectedDivisionCodes(selectedCodes).length > 0) return true;
  return inferDivisionCodesFromItems(draftLines, savedTasks).length > 0;
}

export function filterDraftLinesForDivision(
  draftLines: readonly EstimateDraftLine[],
  divisionCode: string,
): EstimateDraftLine[] {
  const normalized = normalizeCsiDivisionCode(divisionCode);
  if (!normalized || !/^\d{2}$/.test(normalized)) return [];
  return draftLines.filter((line) => divisionCodeFromDraftLine(line) === normalized);
}
