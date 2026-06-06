import type { EstimateLineItemsFilter } from '../../domain/estimateLineItemTree';
import { collectDivisionFilterOptions } from '../../application/estimateLineItemGrouping';
import type { EstimateGroupedDivision } from '../../domain/estimateLineItemTree';
import FilterChipCarousel from './FilterChipCarousel';

interface Props<TItem> {
  groups: EstimateGroupedDivision<TItem>[];
  filter: EstimateLineItemsFilter;
  onFilterChange: (filter: EstimateLineItemsFilter) => void;
}

const ALL_DIVISIONS_VALUE = 'all';

export default function EstimateLineItemsFilterBar<TItem>({
  groups,
  filter,
  onFilterChange,
}: Props<TItem>) {
  const divisionOptions = collectDivisionFilterOptions(groups);

  if (divisionOptions.length === 0) return null;

  const divisionChips = [
    { value: ALL_DIVISIONS_VALUE, label: 'All divisions' },
    ...divisionOptions.map((option) => ({ value: option.key, label: option.label })),
  ];

  return (
    <FilterChipCarousel
      label="Division"
      chips={divisionChips}
      activeValue={filter.divisionKey ?? ALL_DIVISIONS_VALUE}
      onChange={(value) => {
        if (value === ALL_DIVISIONS_VALUE) {
          onFilterChange({ divisionKey: null, scopeKey: null });
          return;
        }
        onFilterChange({ divisionKey: value, scopeKey: null });
      }}
    />
  );
}
