import type { ProductionRateLibraryEntry } from './productionRateTypes';

export interface ProductionRateLibraryFilters {
  searchText: string;
  divisionCode?: string;
  category?: string;
  unitOfMeasure?: string;
  figure?: string;
  workElementNumber?: string;
}

export const EMPTY_PRODUCTION_RATE_LIBRARY_FILTERS: ProductionRateLibraryFilters = {
  searchText: '',
};

export interface ProductionRateDivisionOption {
  divisionCode: string;
  divisionName: string;
  count: number;
}

export interface ProductionRateCategoryGroup {
  category: string;
  rates: ProductionRateLibraryEntry[];
}

export interface ProductionRateDivisionCategoryGroup {
  divisionCode: string;
  divisionName: string;
  categories: ProductionRateCategoryGroup[];
  rateCount: number;
}

export interface ProductionRateDivisionGroup {
  divisionCode: string;
  divisionName: string;
  rates: ProductionRateLibraryEntry[];
}

function normalizeFilters(
  filters: Partial<ProductionRateLibraryFilters> = {},
): ProductionRateLibraryFilters {
  return {
    searchText: filters.searchText?.trim() ?? '',
    divisionCode: filters.divisionCode?.trim() || undefined,
    category: filters.category?.trim() || undefined,
    unitOfMeasure: filters.unitOfMeasure?.trim() || undefined,
    figure: filters.figure?.trim() || undefined,
    workElementNumber: filters.workElementNumber?.trim() || undefined,
  };
}

function buildSearchHaystack(rate: ProductionRateLibraryEntry): string {
  return [
    rate.id,
    rate.divisionName,
    rate.activityName,
    rate.description,
    rate.category,
    rate.subcategory,
    rate.unitOfMeasure,
    rate.workElementNumber,
    rate.figure,
    rate.figureTitle,
    rate.keywords.join(' '),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function matchesProductionRateSearchText(
  rate: ProductionRateLibraryEntry,
  query: string,
): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return buildSearchHaystack(rate).includes(normalized);
}

export function searchProductionRates(
  rates: readonly ProductionRateLibraryEntry[],
  query: string,
): ProductionRateLibraryEntry[] {
  return filterProductionRates(rates, { searchText: query });
}

function applyStructuralFilters(
  rate: ProductionRateLibraryEntry,
  filters: ProductionRateLibraryFilters,
): boolean {
  if (filters.divisionCode && rate.divisionCode !== filters.divisionCode) return false;
  if (filters.category && rate.category !== filters.category) return false;
  if (filters.unitOfMeasure && rate.unitOfMeasure !== filters.unitOfMeasure) return false;
  if (filters.figure && rate.figure !== filters.figure) return false;
  if (filters.workElementNumber && rate.workElementNumber !== filters.workElementNumber) {
    return false;
  }
  return true;
}

export function filterProductionRates(
  rates: readonly ProductionRateLibraryEntry[],
  filters: Partial<ProductionRateLibraryFilters> = {},
): ProductionRateLibraryEntry[] {
  const normalized = normalizeFilters(filters);
  return rates.filter((rate) => {
    if (!applyStructuralFilters(rate, normalized)) return false;
    return matchesProductionRateSearchText(rate, normalized.searchText);
  });
}

function filterRatesForFacetOptions(
  rates: readonly ProductionRateLibraryEntry[],
  filters: Partial<ProductionRateLibraryFilters>,
  omit: keyof ProductionRateLibraryFilters,
): ProductionRateLibraryEntry[] {
  const partial: Partial<ProductionRateLibraryFilters> = { ...filters };
  if (omit === 'searchText') {
    partial.searchText = '';
  } else {
    delete partial[omit];
  }
  return filterProductionRates(rates, partial);
}

export function getAvailableDivisions(
  rates: readonly ProductionRateLibraryEntry[],
  filters: Partial<ProductionRateLibraryFilters> = {},
): ProductionRateDivisionOption[] {
  const scoped = filterRatesForFacetOptions(rates, filters, 'divisionCode');
  const map = new Map<string, ProductionRateDivisionOption>();
  for (const rate of scoped) {
    const existing = map.get(rate.divisionCode);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(rate.divisionCode, {
        divisionCode: rate.divisionCode,
        divisionName: rate.divisionName,
        count: 1,
      });
    }
  }
  return [...map.values()].sort((a, b) => a.divisionCode.localeCompare(b.divisionCode));
}

export function getAvailableCategories(
  rates: readonly ProductionRateLibraryEntry[],
  filters: Partial<ProductionRateLibraryFilters> = {},
): string[] {
  const scoped = filterRatesForFacetOptions(rates, filters, 'category');
  return [...new Set(scoped.map((rate) => rate.category).filter(Boolean) as string[])].sort();
}

export function getAvailableUnits(
  rates: readonly ProductionRateLibraryEntry[],
  filters: Partial<ProductionRateLibraryFilters> = {},
): string[] {
  const scoped = filterRatesForFacetOptions(rates, filters, 'unitOfMeasure');
  return [...new Set(scoped.map((rate) => rate.unitOfMeasure))].sort();
}

export function getAvailableFigures(
  rates: readonly ProductionRateLibraryEntry[],
  filters: Partial<ProductionRateLibraryFilters> = {},
): string[] {
  const scoped = filterRatesForFacetOptions(rates, filters, 'figure');
  return [...new Set(scoped.map((rate) => rate.figure))].sort();
}

export function groupRatesByDivision(
  rates: readonly ProductionRateLibraryEntry[],
): ProductionRateDivisionGroup[] {
  const map = new Map<string, ProductionRateDivisionGroup>();
  for (const rate of rates) {
    const existing = map.get(rate.divisionCode);
    if (existing) {
      existing.rates.push(rate);
    } else {
      map.set(rate.divisionCode, {
        divisionCode: rate.divisionCode,
        divisionName: rate.divisionName,
        rates: [rate],
      });
    }
  }
  return [...map.values()].sort((a, b) => a.divisionCode.localeCompare(b.divisionCode));
}

export function groupRatesByCategory(
  rates: readonly ProductionRateLibraryEntry[],
): ProductionRateCategoryGroup[] {
  const map = new Map<string, ProductionRateLibraryEntry[]>();
  for (const rate of rates) {
    const key = rate.category?.trim() || 'Uncategorized';
    const bucket = map.get(key) ?? [];
    bucket.push(rate);
    map.set(key, bucket);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, groupedRates]) => ({ category, rates: groupedRates }));
}

export function groupRatesByDivisionAndCategory(
  rates: readonly ProductionRateLibraryEntry[],
): ProductionRateDivisionCategoryGroup[] {
  return groupRatesByDivision(rates).map((divisionGroup) => {
    const categories = groupRatesByCategory(divisionGroup.rates);
    return {
      divisionCode: divisionGroup.divisionCode,
      divisionName: divisionGroup.divisionName,
      categories,
      rateCount: divisionGroup.rates.length,
    };
  });
}

export function hasActiveProductionRateFilters(
  filters: Partial<ProductionRateLibraryFilters>,
): boolean {
  const normalized = normalizeFilters(filters);
  return Boolean(
    normalized.searchText ||
      normalized.divisionCode ||
      normalized.category ||
      normalized.unitOfMeasure ||
      normalized.figure ||
      normalized.workElementNumber,
  );
}

/** @deprecated Use getAvailableDivisions */
export function getProductionRateDivisionOptions(
  rates: readonly ProductionRateLibraryEntry[],
): Array<{ value: string; label: string }> {
  return getAvailableDivisions(rates).map((option) => ({
    value: option.divisionCode,
    label: `Division ${option.divisionCode} — ${option.divisionName}`,
  }));
}

/** @deprecated Use getAvailableCategories */
export function getProductionRateCategoryOptions(
  rates: readonly ProductionRateLibraryEntry[],
  divisionCode?: string,
): string[] {
  return getAvailableCategories(rates, divisionCode ? { divisionCode } : {});
}

/** @deprecated Use getAvailableUnits */
export function getProductionRateUnitOptions(
  rates: readonly ProductionRateLibraryEntry[],
  divisionCode?: string,
): string[] {
  return getAvailableUnits(rates, divisionCode ? { divisionCode } : {});
}
