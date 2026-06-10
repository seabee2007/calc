/**
 * Lazy loader for approved-only generated production-rate seeds.
 *
 * Dynamic import keeps ~1,200+ rates out of the EstimateWorkspacePage bundle
 * until the user opens the Production Rate Library or Add Activity picker.
 */
import type { ProductionRateLibraryEntry } from './productionRateTypes';
import { ESTIMATOR_ALLOWED_QA_STATUS } from './productionRateTypes';

export interface LoadedProductionRateLibrary {
  rates: ProductionRateLibraryEntry[];
  /** Count after approved-only safety gate. */
  count: number;
}

let cachedLibrary: LoadedProductionRateLibrary | null = null;
let loadPromise: Promise<LoadedProductionRateLibrary> | null = null;

export function isProductionRateLibraryLoaded(): boolean {
  return cachedLibrary != null;
}

export function getCachedProductionRateLibrary(): LoadedProductionRateLibrary | null {
  return cachedLibrary;
}

/** Test-only: reset module cache between test cases. */
export function resetProductionRateLibraryLoaderForTests(): void {
  cachedLibrary = null;
  loadPromise = null;
}

export async function loadApprovedProductionRateLibrary(): Promise<LoadedProductionRateLibrary> {
  if (cachedLibrary) return cachedLibrary;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const { GENERATED_PRODUCTION_RATE_INDEX } = await import(
      './generated/generatedProductionRateIndex'
    );

    const unsafe = GENERATED_PRODUCTION_RATE_INDEX.filter(
      (rate) => !ESTIMATOR_ALLOWED_QA_STATUS.includes(rate.qaStatus),
    );
    if (unsafe.length > 0) {
      throw new Error(
        `Production rate library safety gate failed: ${unsafe.length} non-approved record(s) in generated output.`,
      );
    }

    const rates = GENERATED_PRODUCTION_RATE_INDEX.map(({ qaStatus: _qa, ...entry }) => entry);
    cachedLibrary = { rates, count: rates.length };
    return cachedLibrary;
  })();

  try {
    return await loadPromise;
  } catch (error) {
    loadPromise = null;
    throw error;
  }
}
