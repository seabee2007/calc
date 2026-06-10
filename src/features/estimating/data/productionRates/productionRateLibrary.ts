/**
 * Approved-only production rate library for the estimator UI.
 *
 * Data is loaded lazily via productionRateLibraryLoader — never import generated seeds here.
 */
import {
  getCachedProductionRateLibrary,
  loadApprovedProductionRateLibrary,
} from './productionRateLibraryLoader';
import {
  filterProductionRates,
  getAvailableCategories,
  getAvailableDivisions,
  getAvailableUnits,
} from './productionRateLibraryQueries';
import type { ProductionRateLibraryEntry } from './productionRateTypes';

function requireLoadedRates(): ProductionRateLibraryEntry[] {
  const cached = getCachedProductionRateLibrary();
  if (!cached) {
    throw new Error(
      'Production rate library is not loaded. Await loadApprovedProductionRateLibrary() before synchronous access.',
    );
  }
  return cached.rates;
}

export { loadApprovedProductionRateLibrary } from './productionRateLibraryLoader';
export type { LoadedProductionRateLibrary } from './productionRateLibraryLoader';

export function getApprovedProductionRateLibrary(): ProductionRateLibraryEntry[] {
  return requireLoadedRates();
}

export function searchProductionRateLibrary(options: {
  query?: string;
  divisionCode?: string;
  category?: string;
  unitOfMeasure?: string;
}): ProductionRateLibraryEntry[] {
  return filterProductionRates(requireLoadedRates(), {
    searchText: options.query ?? '',
    divisionCode: options.divisionCode,
    category: options.category,
    unitOfMeasure: options.unitOfMeasure,
  });
}

export function getProductionRateLibraryEntryById(id: string): ProductionRateLibraryEntry | undefined {
  return requireLoadedRates().find((rate) => rate.id === id);
}

export function getProductionRateLibraryDivisionOptions(): Array<{ value: string; label: string }> {
  return getAvailableDivisions(requireLoadedRates()).map((option) => ({
    value: option.divisionCode,
    label: `Division ${option.divisionCode} — ${option.divisionName}`,
  }));
}

export function getProductionRateLibraryCategoryOptions(divisionCode?: string): string[] {
  return getAvailableCategories(requireLoadedRates(), divisionCode ? { divisionCode } : {});
}

export function getProductionRateLibraryUnitOptions(divisionCode?: string): string[] {
  return getAvailableUnits(requireLoadedRates(), divisionCode ? { divisionCode } : {});
}

/** Preload helper for modals that know they will open imminently. */
export async function preloadProductionRateLibrary(): Promise<void> {
  await loadApprovedProductionRateLibrary();
}
