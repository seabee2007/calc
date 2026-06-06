import type { EstimateWorkBreakdown, EstimateDivisionBucket } from './estimateWorkBreakdown';
import type { EstimateDraftLine } from './estimateDraftLine';
import { groupEstimateDraftLines } from './estimateLineItemGrouping';
import { computeDraftLineRollupSlice, rollupTaskSlices } from './estimateGroupRollups';
import { emptyGroupRollup, type EstimateGroupedDivision, type EstimateLineItemsFilter } from '../domain/estimateLineItemTree';

export const DEFAULT_BUILDER_DIVISION_FILTER = 'all';

export interface BuilderFilterState {
  activeDivisionFilter: string;
}

export const DEFAULT_BUILDER_FILTER_STATE: BuilderFilterState = {
  activeDivisionFilter: DEFAULT_BUILDER_DIVISION_FILTER,
};

export function builderFilterStateFromLineItemsFilter(
  filter: EstimateLineItemsFilter,
): BuilderFilterState {
  return {
    activeDivisionFilter: filter.divisionKey ?? DEFAULT_BUILDER_DIVISION_FILTER,
  };
}

export function lineItemsFilterFromBuilderState(
  state: BuilderFilterState,
): EstimateLineItemsFilter {
  return {
    divisionKey:
      state.activeDivisionFilter === DEFAULT_BUILDER_DIVISION_FILTER
        ? null
        : state.activeDivisionFilter,
    scopeKey: null,
  };
}

export function getVisibleBreakdownDivisions(
  breakdown: EstimateWorkBreakdown,
  _draftLines: readonly EstimateDraftLine[],
  filter: EstimateLineItemsFilter,
): EstimateDivisionBucket[] {
  return breakdown.divisions.filter(
    (bucket) => !filter.divisionKey || bucket.code === filter.divisionKey,
  );
}

export function rollupFromDraftLines(draftLines: readonly EstimateDraftLine[]) {
  if (draftLines.length === 0) return emptyGroupRollup();
  return rollupTaskSlices(draftLines.map((line) => computeDraftLineRollupSlice(line)));
}

export function buildBuilderFilterGroups(
  breakdown: EstimateWorkBreakdown,
  draftLines: readonly EstimateDraftLine[],
): EstimateGroupedDivision<EstimateDraftLine>[] {
  const draftGroups = groupEstimateDraftLines([...draftLines]);
  const draftByKey = new Map(draftGroups.map((group) => [group.key, group]));

  return breakdown.divisions.map((bucket) => {
    const existing = draftByKey.get(bucket.code);
    if (existing) return existing;
    return {
      key: bucket.code,
      label: bucket.label,
      scopes: [],
      rollup: emptyGroupRollup(),
    };
  });
}

export function getFilteredDraftLinesForBuilder(
  draftLines: readonly EstimateDraftLine[],
  filter: EstimateLineItemsFilter,
): EstimateDraftLine[] {
  return draftLines.filter((line) => {
    const divisionCode = line.task.lineItem.csiDivision?.trim();
    if (filter.divisionKey && divisionCode !== filter.divisionKey) return false;
    return true;
  });
}

export function buildCollapsedDivisionCodes(
  divisionCodes: readonly string[],
): Set<string> {
  return new Set(divisionCodes);
}
