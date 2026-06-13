/**
 * Lazy loader for approved production-rate library entries.
 *
 * Default: canonical contractor-facing index (~400–800 rows).
 * Debug: source-level index (~1,200+ rows) via loadSourceProductionRateLibrary().
 *
 * Dynamic import keeps generated bundles out of EstimateWorkspacePage until needed.
 * Import paths MUST be string literals so Vite can emit hashed chunk URLs in production.
 */
import type { ProductionRateLibraryEntry } from './productionRateTypes';
import { ESTIMATOR_ALLOWED_QA_STATUS } from './productionRateTypes';

export interface LoadedProductionRateLibrary {
  rates: ProductionRateLibraryEntry[];
  /** Count after approved-only safety gate. */
  count: number;
  /** True when loaded from per-source generated index (debug). */
  isSourceIndex: boolean;
}

type IndexEntry = ProductionRateLibraryEntry & {
  qaStatus?: string;
  confidence?: string;
};

let cachedCanonicalLibrary: LoadedProductionRateLibrary | null = null;
let cachedSourceLibrary: LoadedProductionRateLibrary | null = null;
let canonicalLoadPromise: Promise<LoadedProductionRateLibrary> | null = null;
let sourceLoadPromise: Promise<LoadedProductionRateLibrary> | null = null;

export function isProductionRateLibraryLoaded(useSource = false): boolean {
  return useSource ? cachedSourceLibrary != null : cachedCanonicalLibrary != null;
}

export function getCachedProductionRateLibrary(
  useSource = false,
): LoadedProductionRateLibrary | null {
  return useSource ? cachedSourceLibrary : cachedCanonicalLibrary;
}

/** Test-only: reset module cache between test cases. */
export function resetProductionRateLibraryLoaderForTests(): void {
  cachedCanonicalLibrary = null;
  cachedSourceLibrary = null;
  canonicalLoadPromise = null;
  sourceLoadPromise = null;
}

function stripIndexMeta(entry: IndexEntry): ProductionRateLibraryEntry {
  const { qaStatus: _qa, confidence: _confidence, ...rest } = entry;
  return rest;
}

function enforceSafetyGate(entries: IndexEntry[]): ProductionRateLibraryEntry[] {
  const unsafe = entries.filter(
    (rate) => rate.qaStatus && !ESTIMATOR_ALLOWED_QA_STATUS.includes(rate.qaStatus as never),
  );
  if (unsafe.length > 0) {
    throw new Error(
      `Production rate library safety gate failed: ${unsafe.length} non-approved record(s) in generated output.`,
    );
  }

  return entries
    .filter((rate) => rate.confidence !== 'blocked')
    .map(stripIndexMeta);
}

function buildLoadedLibrary(
  index: readonly IndexEntry[],
  isSourceIndex: boolean,
): LoadedProductionRateLibrary {
  const rates = enforceSafetyGate([...index]);
  return { rates, count: rates.length, isSourceIndex };
}

async function loadCanonicalIndexModule(): Promise<LoadedProductionRateLibrary> {
  try {
    const module = await import('./generated/generatedCanonicalProductionRateIndex');
    const loaded = buildLoadedLibrary(module.GENERATED_CANONICAL_PRODUCTION_RATE_INDEX, false);
    return loaded;
  } catch (error) {
    console.error('[Production Rates] Failed to load generated canonical index', error);
    throw new Error('Production rate library failed to load. Please refresh and try again.');
  }
}

async function loadSourceIndexModule(): Promise<LoadedProductionRateLibrary> {
  try {
    const module = await import('./generated/generatedProductionRateIndex');
    const loaded = buildLoadedLibrary(module.GENERATED_PRODUCTION_RATE_INDEX, true);
    return loaded;
  } catch (error) {
    console.error('[Production Rates] Failed to load generated source index', error);
    throw new Error('Production rate library failed to load. Please refresh and try again.');
  }
}

/** Load canonical contractor-facing library (default for estimator UI). */
export async function loadCanonicalProductionRateLibrary(): Promise<LoadedProductionRateLibrary> {
  if (cachedCanonicalLibrary) return cachedCanonicalLibrary;
  if (canonicalLoadPromise) return canonicalLoadPromise;

  canonicalLoadPromise = loadCanonicalIndexModule().then((loaded) => {
    cachedCanonicalLibrary = loaded;
    return loaded;
  });

  try {
    return await canonicalLoadPromise;
  } catch (error) {
    canonicalLoadPromise = null;
    throw error;
  }
}

/** Load per-source library for dev debug toggle only. */
export async function loadSourceProductionRateLibrary(): Promise<LoadedProductionRateLibrary> {
  if (cachedSourceLibrary) return cachedSourceLibrary;
  if (sourceLoadPromise) return sourceLoadPromise;

  sourceLoadPromise = loadSourceIndexModule().then((loaded) => {
    cachedSourceLibrary = loaded;
    return loaded;
  });

  try {
    return await sourceLoadPromise;
  } catch (error) {
    sourceLoadPromise = null;
    throw error;
  }
}

/** Default estimator entry point — canonical index. */
export async function loadApprovedProductionRateLibrary(
  options: { useSourceRecords?: boolean } = {},
): Promise<LoadedProductionRateLibrary> {
  if (options.useSourceRecords) {
    return loadSourceProductionRateLibrary();
  }
  return loadCanonicalProductionRateLibrary();
}
