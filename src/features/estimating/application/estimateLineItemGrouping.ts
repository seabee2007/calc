import type { EstimateDomainTask } from '../infrastructure/estimateDbTypes';
import type { EstimateDraftLine } from './estimateDraftLine';
import {
  computeDraftLineRollupSlice,
  computeTaskRollupSlice,
  rollupTaskSlices,
} from './estimateGroupRollups';
import { roundToTwo } from '../domain/estimateMath';
import {
  GENERAL_SCOPE_KEY,
  GENERAL_SCOPE_LABEL,
  UNASSIGNED_DIVISION_KEY,
  UNASSIGNED_DIVISION_LABEL,
  emptyGroupRollup,
  type EstimateGroupedDivision,
  type EstimateGroupedScope,
  type EstimateGroupRollup,
  type EstimateLineItemsFilter,
} from '../domain/estimateLineItemTree';

export function normalizeDivisionKey(csiDivision?: string | null): string {
  const trimmed = csiDivision?.trim();
  return trimmed ? trimmed : UNASSIGNED_DIVISION_KEY;
}

export function normalizeScopeKey(scopeName?: string | null): string {
  const trimmed = scopeName?.trim();
  return trimmed ? trimmed : GENERAL_SCOPE_KEY;
}

export function divisionLabelFromKey(key: string): string {
  return key === UNASSIGNED_DIVISION_KEY ? UNASSIGNED_DIVISION_LABEL : key;
}

export function scopeLabelFromKey(key: string): string {
  return key === GENERAL_SCOPE_KEY ? GENERAL_SCOPE_LABEL : key;
}

function compareDivisionKeys(a: string, b: string): number {
  if (a === UNASSIGNED_DIVISION_KEY && b !== UNASSIGNED_DIVISION_KEY) return 1;
  if (b === UNASSIGNED_DIVISION_KEY && a !== UNASSIGNED_DIVISION_KEY) return -1;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function compareScopeKeys(a: string, b: string): number {
  if (a === GENERAL_SCOPE_KEY && b !== GENERAL_SCOPE_KEY) return 1;
  if (b === GENERAL_SCOPE_KEY && a !== GENERAL_SCOPE_KEY) return -1;
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

function isTaskRow(task: EstimateDomainTask): boolean {
  return task.lineType === 'task' || task.lineType == null;
}

interface ScopeBucket<TItem> {
  key: string;
  label: string;
  divisionKey: string;
  items: TItem[];
  minPosition: number;
}

interface DivisionBucket<TItem> {
  key: string;
  label: string;
  scopes: Map<string, ScopeBucket<TItem>>;
  minPosition: number;
}

function buildGroupedTree<TItem>(
  items: TItem[],
  getTask: (item: TItem) => EstimateDomainTask,
  getSlice: (item: TItem) => ReturnType<typeof computeTaskRollupSlice>,
): EstimateGroupedDivision<TItem>[] {
  if (items.length === 0) return [];

  const divisions = new Map<string, DivisionBucket<TItem>>();

  for (const item of items) {
    const task = getTask(item);
    if (!isTaskRow(task)) continue;

    const divisionKey = normalizeDivisionKey(task.lineItem.csiDivision);
    const scopeKey = normalizeScopeKey(task.scopeName);
    const position = task.position ?? 0;

    let division = divisions.get(divisionKey);
    if (!division) {
      division = {
        key: divisionKey,
        label: divisionLabelFromKey(divisionKey),
        scopes: new Map(),
        minPosition: position,
      };
      divisions.set(divisionKey, division);
    } else {
      division.minPosition = Math.min(division.minPosition, position);
    }

    let scope = division.scopes.get(scopeKey);
    if (!scope) {
      scope = {
        key: scopeKey,
        label: scopeLabelFromKey(scopeKey),
        divisionKey,
        items: [],
        minPosition: position,
      };
      division.scopes.set(scopeKey, scope);
    } else {
      scope.minPosition = Math.min(scope.minPosition, position);
    }

    scope.items.push(item);
  }

  const divisionGroups: EstimateGroupedDivision<TItem>[] = [];

  for (const division of divisions.values()) {
    const scopes: EstimateGroupedScope<TItem>[] = [];

    for (const scope of division.scopes.values()) {
      scope.items.sort((a, b) => getTask(a).position - getTask(b).position);
      const slices = scope.items.map((item) => getSlice(item));
      scopes.push({
        key: scope.key,
        label: scope.label,
        divisionKey: scope.divisionKey,
        items: scope.items,
        minPosition: scope.minPosition,
        rollup: rollupTaskSlices(slices),
      });
    }

    scopes.sort((a, b) => compareScopeKeys(a.key, b.key));

    const divisionSlices = scopes.flatMap((scope) =>
      scope.items.map((item) => getSlice(item)),
    );

    divisionGroups.push({
      key: division.key,
      label: division.label,
      scopes,
      rollup: rollupTaskSlices(divisionSlices),
    });
  }

  divisionGroups.sort((a, b) => compareDivisionKeys(a.key, b.key));

  return divisionGroups;
}

export function groupEstimateTasks(
  tasks: EstimateDomainTask[],
): EstimateGroupedDivision<EstimateDomainTask>[] {
  const sorted = [...tasks].sort((a, b) => a.position - b.position);
  return buildGroupedTree(
    sorted,
    (task) => task,
    (task) => computeTaskRollupSlice(task),
  );
}

export function groupEstimateDraftLines(
  drafts: EstimateDraftLine[],
): EstimateGroupedDivision<EstimateDraftLine>[] {
  const sorted = [...drafts].sort((a, b) => a.task.position - b.task.position);
  return buildGroupedTree(
    sorted,
    (draft) => draft.task,
    (draft) => computeDraftLineRollupSlice(draft),
  );
}

export function filterGroupedEstimateLines<TItem>(
  groups: EstimateGroupedDivision<TItem>[],
  filter: EstimateLineItemsFilter,
): EstimateGroupedDivision<TItem>[] {
  if (!filter.divisionKey && !filter.scopeKey) return groups;

  return groups
    .filter((division) => !filter.divisionKey || division.key === filter.divisionKey)
    .map((division) => {
      const scopes = division.scopes
        .filter((scope) => !filter.scopeKey || scope.key === filter.scopeKey)
        .map((scope) => ({ ...scope }));

      if (scopes.length === 0) return null;

      const rollup = rollupFromFilteredScopes(scopes);

      return {
        ...division,
        scopes,
        rollup,
      };
    })
    .filter((division): division is EstimateGroupedDivision<TItem> => division != null);
}

function rollupFromFilteredScopes<TItem>(
  scopes: EstimateGroupedScope<TItem>[],
): EstimateGroupRollup {
  const rollup = emptyGroupRollup();
  for (const scope of scopes) {
    rollup.itemCount += scope.rollup.itemCount;
    rollup.laborHours = roundToTwo(rollup.laborHours + scope.rollup.laborHours);
    rollup.manDays = roundToTwo(rollup.manDays + scope.rollup.manDays);
    rollup.crewDays = roundToTwo(rollup.crewDays + scope.rollup.crewDays);
    rollup.durationDays = roundToTwo(rollup.durationDays + scope.rollup.durationDays);
    rollup.directCost = roundToTwo(rollup.directCost + scope.rollup.directCost);
    rollup.materialCost = roundToTwo(rollup.materialCost + scope.rollup.materialCost);
    rollup.equipmentCost = roundToTwo(rollup.equipmentCost + scope.rollup.equipmentCost);
    rollup.subcontractorCost = roundToTwo(rollup.subcontractorCost + scope.rollup.subcontractorCost);
    rollup.indirectCost = roundToTwo(rollup.indirectCost + scope.rollup.indirectCost);
    rollup.sellPrice = roundToTwo(rollup.sellPrice + scope.rollup.sellPrice);
    rollup.scheduleEnabledCount += scope.rollup.scheduleEnabledCount;
    rollup.weatherSensitiveCount += scope.rollup.weatherSensitiveCount;
    rollup.inspectionRequiredCount += scope.rollup.inspectionRequiredCount;
  }
  return rollup;
}

export function collectDivisionFilterOptions<TItem>(
  groups: EstimateGroupedDivision<TItem>[],
): Array<{ key: string; label: string }> {
  const byKey = new Map<string, string>();
  for (const division of groups) {
    if (!byKey.has(division.key)) {
      byKey.set(division.key, division.label);
    }
  }
  return Array.from(byKey.entries())
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => compareDivisionKeys(a.key, b.key));
}

export function collectScopeFilterOptions<TItem>(
  groups: EstimateGroupedDivision<TItem>[],
  divisionKey: string | null,
): Array<{ key: string; label: string; divisionKey: string }> {
  const divisions = divisionKey
    ? groups.filter((division) => division.key === divisionKey)
    : groups;

  const options: Array<{ key: string; label: string; divisionKey: string }> = [];
  const seen = new Set<string>();

  for (const division of divisions) {
    for (const scope of division.scopes) {
      const id = `${scope.divisionKey}::${scope.key}`;
      if (seen.has(id)) continue;
      seen.add(id);
      options.push({
        key: scope.key,
        label: scope.label,
        divisionKey: scope.divisionKey,
      });
    }
  }

  options.sort((a, b) => compareScopeKeys(a.key, b.key));
  return options;
}

export function countGroupedTasks<TItem>(groups: EstimateGroupedDivision<TItem>[]): {
  divisionCount: number;
  scopeCount: number;
  taskCount: number;
} {
  let scopeCount = 0;
  let taskCount = 0;

  for (const division of groups) {
    scopeCount += division.scopes.length;
    for (const scope of division.scopes) {
      taskCount += scope.items.length;
    }
  }

  return {
    divisionCount: groups.length,
    scopeCount,
    taskCount,
  };
}
