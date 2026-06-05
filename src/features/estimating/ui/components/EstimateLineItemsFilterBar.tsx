import type { EstimateLineItemsFilter } from '../../domain/estimateLineItemTree';
import {
  collectDivisionFilterOptions,
  collectScopeFilterOptions,
} from '../../application/estimateLineItemGrouping';
import type { EstimateGroupedDivision } from '../../domain/estimateLineItemTree';
import { PLANNER_MUTED } from '../estimateWorkspaceTheme';

interface Props<TItem> {
  groups: EstimateGroupedDivision<TItem>[];
  filter: EstimateLineItemsFilter;
  onFilterChange: (filter: EstimateLineItemsFilter) => void;
}

function chipClass(active: boolean): string {
  return [
    'shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
    active
      ? 'border-cyan-600 bg-cyan-50 text-cyan-800 dark:border-cyan-500 dark:bg-cyan-950/50 dark:text-cyan-200'
      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-500',
  ].join(' ');
}

export default function EstimateLineItemsFilterBar<TItem>({
  groups,
  filter,
  onFilterChange,
}: Props<TItem>) {
  const divisionOptions = collectDivisionFilterOptions(groups);
  const scopeOptions = collectScopeFilterOptions(groups, filter.divisionKey);

  if (divisionOptions.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className={`text-xs font-semibold uppercase tracking-wide ${PLANNER_MUTED}`}>Filters</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className={`mb-1 text-xs ${PLANNER_MUTED}`}>Division of Work</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              className={chipClass(filter.divisionKey == null)}
              onClick={() => onFilterChange({ divisionKey: null, scopeKey: null })}
            >
              All divisions
            </button>
            {divisionOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                className={chipClass(filter.divisionKey === option.key)}
                onClick={() =>
                  onFilterChange({
                    divisionKey: option.key,
                    scopeKey: filter.divisionKey === option.key ? filter.scopeKey : null,
                  })
                }
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className={`mb-1 text-xs ${PLANNER_MUTED}`}>Work Package / Scope</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              className={chipClass(filter.scopeKey == null)}
              onClick={() => onFilterChange({ ...filter, scopeKey: null })}
            >
              All work packages
            </button>
            {scopeOptions.map((option) => (
              <button
                key={`${option.divisionKey}-${option.key}`}
                type="button"
                className={chipClass(filter.scopeKey === option.key)}
                onClick={() =>
                  onFilterChange({
                    divisionKey: filter.divisionKey ?? option.divisionKey,
                    scopeKey: option.key,
                  })
                }
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
