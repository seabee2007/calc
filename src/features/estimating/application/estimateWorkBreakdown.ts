import {
  getCsiDivisionByCode,
  getCsiDivisionLabel,
  normalizeCsiDivisionCode,
} from '../domain/csiDivisions';
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
