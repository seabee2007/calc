import type { EstimateDomainTask } from '../infrastructure/estimateDbTypes';
import type { EstimateLineItemInput } from '../domain/estimateTypes';

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

export function draftLinesFromVersion(lineItems: EstimateDomainTask[]): EstimateDraftLine[] {
  return [...lineItems]
    .sort((a, b) => a.position - b.position)
    .map((task, index) => {
      const draft = draftLineFromDomainTask(task);
      draft.task.position = index;
      return draft;
    });
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
  return sortDraftLinesByPosition(lines).map((line, index) => ({
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
