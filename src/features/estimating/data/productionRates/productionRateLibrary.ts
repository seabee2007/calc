/**
 * Approved-only production rate library for the estimator UI.
 *
 * Loads exclusively from generated seed bundles — never from raw JSON.
 */
import { GENERATED_PRODUCTION_RATE_INDEX } from './generated/generatedProductionRateIndex';
import type { ProductionRateLibraryEntry } from './productionRateTypes';
import { ESTIMATOR_ALLOWED_QA_STATUS } from './productionRateTypes';

let cachedRates: ProductionRateLibraryEntry[] | null = null;

export function getApprovedProductionRateLibrary(): ProductionRateLibraryEntry[] {
  if (cachedRates) return cachedRates;

  const unsafe = GENERATED_PRODUCTION_RATE_INDEX.filter(
    (rate) => !ESTIMATOR_ALLOWED_QA_STATUS.includes(rate.qaStatus as 'approved'),
  );
  if (unsafe.length > 0) {
    throw new Error(
      `Production rate library safety gate failed: ${unsafe.length} non-approved record(s) in generated output.`,
    );
  }

  cachedRates = GENERATED_PRODUCTION_RATE_INDEX.map(({ qaStatus: _qa, ...entry }) => entry);
  return cachedRates;
}

export function searchProductionRateLibrary(options: {
  query?: string;
  divisionCode?: string;
  category?: string;
  unitOfMeasure?: string;
}): ProductionRateLibraryEntry[] {
  const query = (options.query ?? '').trim().toLowerCase();
  const rates = getApprovedProductionRateLibrary();

  return rates.filter((rate) => {
    if (options.divisionCode && rate.divisionCode !== options.divisionCode) return false;
    if (options.category && rate.category !== options.category) return false;
    if (options.unitOfMeasure && rate.unitOfMeasure !== options.unitOfMeasure) return false;
    if (!query) return true;

    const haystack = [
      rate.activityName,
      rate.description,
      rate.category,
      rate.subcategory,
      rate.figure,
      rate.figureTitle,
      rate.keywords.join(' '),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(query);
  });
}

export function getProductionRateLibraryEntryById(id: string): ProductionRateLibraryEntry | undefined {
  return getApprovedProductionRateLibrary().find((rate) => rate.id === id);
}

export function getProductionRateLibraryDivisionOptions(): Array<{ value: string; label: string }> {
  const rates = getApprovedProductionRateLibrary();
  const map = new Map<string, string>();
  for (const rate of rates) {
    map.set(rate.divisionCode, rate.divisionName);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([value, label]) => ({ value, label: `Division ${value} — ${label}` }));
}

export function getProductionRateLibraryCategoryOptions(divisionCode?: string): string[] {
  const rates = getApprovedProductionRateLibrary().filter(
    (rate) => !divisionCode || rate.divisionCode === divisionCode,
  );
  return [...new Set(rates.map((rate) => rate.category).filter(Boolean) as string[])].sort();
}

export function getProductionRateLibraryUnitOptions(divisionCode?: string): string[] {
  const rates = getApprovedProductionRateLibrary().filter(
    (rate) => !divisionCode || rate.divisionCode === divisionCode,
  );
  return [...new Set(rates.map((rate) => rate.unitOfMeasure))].sort();
}
