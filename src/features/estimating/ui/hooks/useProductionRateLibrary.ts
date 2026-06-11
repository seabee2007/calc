import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  loadApprovedProductionRateLibrary,
  type LoadedProductionRateLibrary,
} from '../../data/productionRates/productionRateLibraryLoader';
import {
  EMPTY_PRODUCTION_RATE_LIBRARY_FILTERS,
  filterProductionRates,
  getAvailableCategories,
  getAvailableDivisions,
  getAvailableFigures,
  getAvailableUnits,
  groupRatesByDivisionAndCategory,
  type ProductionRateDivisionCategoryGroup,
  type ProductionRateLibraryFilters,
} from '../../data/productionRates/productionRateLibraryQueries';
import type { ProductionRateLibraryEntry } from '../../data/productionRates/productionRateTypes';

export type { ProductionRateLibraryFilters } from '../../data/productionRates/productionRateLibraryQueries';

const SHOW_SOURCE_RECORDS_KEY = 'estimating.showSourceProductionRecords';

export interface UseProductionRateLibraryResult {
  rates: ProductionRateLibraryEntry[];
  totalCount: number;
  loading: boolean;
  error: string | null;
  reload: () => void;
  showSourceRecords: boolean;
  setShowSourceRecords: (value: boolean) => void;
  isSourceIndex: boolean;
  filterRates: (filters: Partial<ProductionRateLibraryFilters>) => ProductionRateLibraryEntry[];
  groupFilteredRates: (
    filters: Partial<ProductionRateLibraryFilters>,
  ) => ProductionRateDivisionCategoryGroup[];
  divisionOptions: (
    filters: Partial<ProductionRateLibraryFilters>,
  ) => ReturnType<typeof getAvailableDivisions>;
  categoryOptions: (filters: Partial<ProductionRateLibraryFilters>) => string[];
  unitOptions: (filters: Partial<ProductionRateLibraryFilters>) => string[];
  figureOptions: (filters: Partial<ProductionRateLibraryFilters>) => string[];
}

function readShowSourceRecords(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(SHOW_SOURCE_RECORDS_KEY) === 'true';
}

export function useProductionRateLibrary(enabled: boolean): UseProductionRateLibraryResult {
  const [library, setLibrary] = useState<LoadedProductionRateLibrary | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [showSourceRecords, setShowSourceRecordsState] = useState(readShowSourceRecords);

  const setShowSourceRecords = useCallback((value: boolean) => {
    setShowSourceRecordsState(value);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SHOW_SOURCE_RECORDS_KEY, value ? 'true' : 'false');
    }
  }, []);

  const reload = useCallback(() => {
    setReloadToken((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    loadApprovedProductionRateLibrary({ useSourceRecords: showSourceRecords })
      .then((loaded) => {
        if (cancelled) return;
        setLibrary(loaded);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load production rate library');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, reloadToken, showSourceRecords]);

  const rates = library?.rates ?? [];
  const totalCount = library?.count ?? 0;

  const filterRates = useCallback(
    (filters: Partial<ProductionRateLibraryFilters> = EMPTY_PRODUCTION_RATE_LIBRARY_FILTERS) =>
      filterProductionRates(rates, filters),
    [rates],
  );

  const groupFilteredRates = useCallback(
    (filters: Partial<ProductionRateLibraryFilters> = EMPTY_PRODUCTION_RATE_LIBRARY_FILTERS) =>
      groupRatesByDivisionAndCategory(filterProductionRates(rates, filters)),
    [rates],
  );

  const divisionOptions = useCallback(
    (filters: Partial<ProductionRateLibraryFilters> = EMPTY_PRODUCTION_RATE_LIBRARY_FILTERS) =>
      getAvailableDivisions(rates, filters),
    [rates],
  );

  const categoryOptions = useCallback(
    (filters: Partial<ProductionRateLibraryFilters> = EMPTY_PRODUCTION_RATE_LIBRARY_FILTERS) =>
      getAvailableCategories(rates, filters),
    [rates],
  );

  const unitOptions = useCallback(
    (filters: Partial<ProductionRateLibraryFilters> = EMPTY_PRODUCTION_RATE_LIBRARY_FILTERS) =>
      getAvailableUnits(rates, filters),
    [rates],
  );

  const figureOptions = useCallback(
    (filters: Partial<ProductionRateLibraryFilters> = EMPTY_PRODUCTION_RATE_LIBRARY_FILTERS) =>
      getAvailableFigures(rates, filters),
    [rates],
  );

  return {
    rates,
    totalCount,
    loading,
    error,
    reload,
    showSourceRecords,
    setShowSourceRecords,
    isSourceIndex: library?.isSourceIndex ?? showSourceRecords,
    filterRates,
    groupFilteredRates,
    divisionOptions,
    categoryOptions,
    unitOptions,
    figureOptions,
  };
}
