import { normalizeCsiDivisionCode, isKnownCsiDivision } from '../domain/csiDivisions';
import { getDefaultScopeForDivision, normalizeScopeName } from '../domain/csiScopeTemplates';
import type { EstimateSettings } from '../domain/estimateTypes';
import type { EstimateDomainTask } from '../infrastructure/estimateDbTypes';
import type { EstimateLineItemInput } from '../domain/estimateTypes';
import {
  assignActivityCodeToDraftLine,
  backfillActivityCodesForDraftLines,
} from './estimateActivityCoding';
import { getMasterActivityByCode } from '../data/masterActivityIndex';
import { DEFAULT_ESTIMATE_SETTINGS, normalizeEstimateSettings } from './estimateSettings';

export interface EstimateDraftLine {
  clientId: string;
  task: EstimateDomainTask;
  unit: string;
  indirectCost: number;
}

export function newLineItemId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function newClientId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createDefaultTaskFields(position = 0): EstimateDomainTask {
  const id = newLineItemId();
  return {
    id,
    lineType: 'task',
    title: '',
    description: '',
    scopeName: '',
    trade: '',
    activity: '',
    position,
    lineItem: {
      id,
      description: '',
      csiDivision: '',
      csiSection: '',
      quantity: {
        formula: 'quantity_with_waste',
        quantity: 0,
        wastePercent: 0,
      },
      labor: {
        productionRate: 0,
        productionRateType: 'units_per_labor_hour',
        hoursPerDay: 8,
        crewSize: 1,
        parallelCrews: 1,
        difficultyFactor: 1,
        locationFactor: 1,
        laborRate: 0,
        burdenPercent: 0,
      },
      material: {
        unitCost: 0,
      },
      equipment: {
        rate: 0,
        rateType: 'lump_sum',
        usageUnits: 1,
      },
      subcontractor: {
        cost: 0,
      },
    },
    overheadPercent: 0,
    profitPercent: 0,
    contingencyPercent: 0,
    taxPercent: 0,
    wastePercent: 0,
    scheduleEnabled: true,
    weatherSensitive: false,
    inspectionRequired: false,
    relationshipType: 'FS',
    lagDays: 0,
    calculatedValues: {},
  };
}

function toFiniteNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function unitFromDomainTask(task: EstimateDomainTask): string {
  const raw = task.calculatedValues.unit;
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  const quantityInput = task.calculatedValues.quantityInput;
  if (quantityInput && typeof quantityInput === 'object' && !Array.isArray(quantityInput)) {
    const unit = (quantityInput as Record<string, unknown>).unit;
    if (typeof unit === 'string' && unit.trim()) return unit.trim();
  }
  return '';
}

function indirectCostFromDomainTask(task: EstimateDomainTask): number {
  const costs = task.calculatedValues.costs;
  if (costs && typeof costs === 'object' && !Array.isArray(costs)) {
    const record = costs as Record<string, unknown>;
    return toFiniteNumber(record.indirectCost ?? record.indirect_cost);
  }
  return 0;
}

export function createEmptyDraftLine(position = 0, clientId?: string): EstimateDraftLine {
  return {
    clientId: clientId ?? newClientId(),
    task: createDefaultTaskFields(position),
    unit: '',
    indirectCost: 0,
  };
}

export function draftLineFromDomainTask(
  task: EstimateDomainTask,
  clientId?: string,
): EstimateDraftLine {
  const cloned: EstimateDomainTask = JSON.parse(JSON.stringify(task));
  return {
    clientId: clientId ?? newClientId(),
    task: cloned,
    unit: unitFromDomainTask(task),
    indirectCost: indirectCostFromDomainTask(task),
  };
}

/**
 * Non-destructively links a saved/legacy line to the master dataset.
 * If the line is not yet linked and its code matches a master activity, the
 * master's classification is attached WITHOUT overwriting the saved title.
 * Lines with a code but no match are flagged as custom so they round-trip intact.
 */
export function enrichLegacyDraftLineFromMaster(draft: EstimateDraftLine): EstimateDraftLine {
  const task = draft.task;
  if (task.masterActivityCode || task.isCustomActivity === true) return draft;

  const code = task.activityCode?.trim();
  if (!code) return draft;

  const master = getMasterActivityByCode(code);
  if (!master) {
    return {
      ...draft,
      task: { ...task, isCustomActivity: true, displayCode: task.displayCode ?? code },
    };
  }

  return {
    ...draft,
    task: {
      ...task,
      masterActivityCode: master.activityCode,
      isCustomActivity: false,
      displayCode: task.displayCode ?? code,
      activityType: task.activityType ?? master.activityType,
      sequencingCategory: task.sequencingCategory ?? master.sequencingCategory,
      logicAnchor: task.logicAnchor ?? master.logicAnchor,
      workPackageCode: task.workPackageCode ?? master.workPackageCode,
    },
  };
}

export function draftLinesFromVersion(lineItems: EstimateDomainTask[]): EstimateDraftLine[] {
  const drafts = [...lineItems]
    .sort((a, b) => a.position - b.position)
    .map((task, index) => {
      const draft = draftLineFromDomainTask(task);
      draft.task.position = index;
      return draft;
    });
  return backfillActivityCodesForDraftLines(drafts).map(enrichLegacyDraftLineFromMaster);
}

export function sortDraftLinesByPosition(lines: EstimateDraftLine[]): EstimateDraftLine[] {
  return [...lines].sort((a, b) => a.task.position - b.task.position);
}

export function draftLineToLineItemInput(draft: EstimateDraftLine): EstimateLineItemInput {
  const { task } = draft;
  const description = task.title.trim() || task.lineItem.description || task.title;
  return {
    ...task.lineItem,
    id: task.lineItem.id || task.id,
    description,
    csiDivision: task.lineItem.csiDivision || undefined,
    csiSection: task.lineItem.csiSection || undefined,
  };
}

export function reindexDraftLines(lines: EstimateDraftLine[]): EstimateDraftLine[] {
  const ordered = sortDraftLinesByPosition(lines);
  return ordered.map((line, index) => ({
    ...line,
    task: {
      ...line.task,
      position: index,
    },
  }));
}

/** Reindex using the current array order (after manual reorder). */
function reindexDraftLinesInPlace(lines: EstimateDraftLine[]): EstimateDraftLine[] {
  return lines.map((line, index) => ({
    ...line,
    task: {
      ...line.task,
      position: index,
    },
  }));
}

export function syncDraftLineDescription(draft: EstimateDraftLine): EstimateDraftLine {
  const title = draft.task.title.trim();
  return {
    ...draft,
    task: {
      ...draft.task,
      lineItem: {
        ...draft.task.lineItem,
        description: title || draft.task.lineItem.description,
      },
    },
  };
}

export function cloneDraftLine(draft: EstimateDraftLine): EstimateDraftLine {
  return JSON.parse(JSON.stringify(draft)) as EstimateDraftLine;
}

function copyTitleLabel(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return 'copy';
  return trimmed.toLowerCase().endsWith(' copy') ? trimmed : `${trimmed} copy`;
}

/** Apply default scope when division is known and scope is empty. */
export function applyDivisionScopeDefaults(draft: EstimateDraftLine): EstimateDraftLine {
  const divisionCode = normalizeCsiDivisionCode(draft.task.lineItem.csiDivision);
  if (!divisionCode || !isKnownCsiDivision(divisionCode)) return draft;
  if (normalizeScopeName(draft.task.scopeName)) return draft;

  const defaultScope = getDefaultScopeForDivision(divisionCode);
  if (!defaultScope) return draft;

  return {
    ...draft,
    task: {
      ...draft.task,
      scopeName: defaultScope,
    },
  };
}

/** Ensure standard labor defaults on draft lines. */
export function applyDraftLaborDefaults(draft: EstimateDraftLine): EstimateDraftLine {
  const labor = draft.task.lineItem.labor;
  return {
    ...draft,
    task: {
      ...draft.task,
      lineItem: {
        ...draft.task.lineItem,
        labor: {
          ...labor,
          hoursPerDay: labor.hoursPerDay > 0 ? labor.hoursPerDay : 8,
          difficultyFactor: labor.difficultyFactor > 0 ? labor.difficultyFactor : 1,
          locationFactor: labor.locationFactor > 0 ? labor.locationFactor : 1,
        },
      },
    },
  };
}

/** Prefill new activity drafts from project-wide estimate settings. */
export function applyEstimateSettingsToNewDraftLine(
  draft: EstimateDraftLine,
  estimateSettings?: Partial<EstimateSettings> | null,
): EstimateDraftLine {
  const settings = normalizeEstimateSettings(estimateSettings ?? DEFAULT_ESTIMATE_SETTINGS);
  const labor = draft.task.lineItem.labor;

  return {
    ...draft,
    task: {
      ...draft.task,
      overheadPercent: settings.overheadPercent,
      profitPercent: settings.profitPercent,
      contingencyPercent: settings.contingencyPercent,
      taxPercent: settings.taxPercent,
      lineItem: {
        ...draft.task.lineItem,
        labor: {
          ...labor,
          laborRate: settings.defaultLaborRate,
          burdenPercent: settings.burdenPercent,
          hoursPerDay: settings.hoursPerDay > 0 ? settings.hoursPerDay : labor.hoursPerDay,
          crewSize: settings.defaultCrewSize > 0 ? settings.defaultCrewSize : labor.crewSize,
        },
      },
    },
  };
}

export function duplicateDraftLine(
  lines: EstimateDraftLine[],
  clientId: string,
): EstimateDraftLine[] {
  const sorted = sortDraftLinesByPosition(lines);
  const index = sorted.findIndex((line) => line.clientId === clientId);
  if (index < 0) return reindexDraftLines(lines);

  const source = sorted[index];
  const copy = cloneDraftLine(source);
  const newTaskId = newLineItemId();

  copy.clientId = newClientId();
  copy.task.id = newTaskId;
  copy.task.lineItem.id = newTaskId;
  copy.task.title = copyTitleLabel(source.task.title);
  copy.task.description = copy.task.title;
  copy.task.lineItem.description = copy.task.title;
  copy.task.activityCode = undefined;

  const next = [...sorted.slice(0, index + 1), copy, ...sorted.slice(index + 1)];
  const withCode = assignActivityCodeToDraftLine(copy, next);
  const replaced = next.map((line) =>
    line.clientId === withCode.clientId ? withCode : line,
  );
  return reindexDraftLines(replaced);
}

export function moveDraftLineUp(
  lines: EstimateDraftLine[],
  clientId: string,
): EstimateDraftLine[] {
  const sorted = sortDraftLinesByPosition(lines);
  const index = sorted.findIndex((line) => line.clientId === clientId);
  if (index <= 0) return reindexDraftLines(lines);

  const next = [...sorted];
  [next[index - 1], next[index]] = [next[index], next[index - 1]];
  return reindexDraftLinesInPlace(next);
}

export function moveDraftLineDown(
  lines: EstimateDraftLine[],
  clientId: string,
): EstimateDraftLine[] {
  const sorted = sortDraftLinesByPosition(lines);
  const index = sorted.findIndex((line) => line.clientId === clientId);
  if (index < 0 || index >= sorted.length - 1) return reindexDraftLines(lines);

  const next = [...sorted];
  [next[index], next[index + 1]] = [next[index + 1], next[index]];
  return reindexDraftLinesInPlace(next);
}

export function getDraftLineMoveState(
  lines: EstimateDraftLine[],
  clientId: string,
): { canMoveUp: boolean; canMoveDown: boolean } {
  const sorted = sortDraftLinesByPosition(lines);
  const index = sorted.findIndex((line) => line.clientId === clientId);
  if (index < 0) {
    return { canMoveUp: false, canMoveDown: false };
  }
  return {
    canMoveUp: index > 0,
    canMoveDown: index < sorted.length - 1,
  };
}
