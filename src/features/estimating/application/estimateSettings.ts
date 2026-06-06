import { getCompanySettings } from '../../../services/companySettingsService';
import {
  DEFAULT_USER_PREFERENCES,
  getUserPreferences,
} from '../../../services/userPreferencesService';
import type { TaxApplication } from '../../../types/pricingParams';
import {
  calculateContingency,
  calculateFinalSellPrice,
  calculateOverhead,
  calculateProfit,
  calculateTax,
  clampPercent,
  roundToTwo,
  sanitizeCost,
} from '../domain/estimateMath';
import type {
  EstimateCostTotals,
  EstimateLineSnapshot,
  EstimateOverheadBase,
  EstimateProfitBase,
  EstimateSettings,
  EstimateTaxBase,
} from '../domain/estimateTypes';

export type {
  EstimateOverheadBase,
  EstimateProfitBase,
  EstimateSettings,
  EstimateTaxBase,
} from '../domain/estimateTypes';

export const DEFAULT_ESTIMATE_SETTINGS: EstimateSettings = {
  defaultLaborRate: 0,
  burdenPercent: 0,
  materialMarkupPercent: 0,
  equipmentMarkupPercent: 0,
  subcontractorMarkupPercent: 0,
  indirectCostPercent: 0,
  overheadPercent: 0,
  profitPercent: 0,
  contingencyPercent: 0,
  taxPercent: 0,
  hoursPerDay: 8,
  defaultCrewSize: 1,
  currency: 'USD',
  overheadBase: 'direct_cost',
  profitBase: 'direct_plus_overhead',
  taxBase: 'total_estimate',
  importedFromUserSettingsAt: null,
};

export const ESTIMATE_SETTINGS_SHEET_NAME = 'Estimate Settings';

export const ESTIMATE_SETTINGS_EXPORT_ROWS: ReadonlyArray<{
  key: keyof EstimateSettings;
  setting: string;
}> = [
  { key: 'defaultLaborRate', setting: 'default_labor_rate' },
  { key: 'burdenPercent', setting: 'burden_percent' },
  { key: 'materialMarkupPercent', setting: 'material_markup_percent' },
  { key: 'equipmentMarkupPercent', setting: 'equipment_markup_percent' },
  { key: 'subcontractorMarkupPercent', setting: 'subcontractor_markup_percent' },
  { key: 'indirectCostPercent', setting: 'indirect_cost_percent' },
  { key: 'overheadPercent', setting: 'overhead_percent' },
  { key: 'profitPercent', setting: 'profit_percent' },
  { key: 'contingencyPercent', setting: 'contingency_percent' },
  { key: 'taxPercent', setting: 'tax_percent' },
  { key: 'hoursPerDay', setting: 'hours_per_day' },
  { key: 'defaultCrewSize', setting: 'default_crew_size' },
  { key: 'currency', setting: 'currency' },
  { key: 'overheadBase', setting: 'overhead_base' },
  { key: 'profitBase', setting: 'profit_base' },
  { key: 'taxBase', setting: 'tax_base' },
];

const ESTIMATE_SETTINGS_EXPORT_KEY_BY_SETTING = new Map(
  ESTIMATE_SETTINGS_EXPORT_ROWS.map((row) => [row.setting, row.key]),
);

function toFiniteNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function toStringValue(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return fallback;
}

function parseOverheadBase(value: unknown): EstimateOverheadBase {
  if (value === 'direct_cost' || value === 'labor_only' || value === 'custom') return value;
  return DEFAULT_ESTIMATE_SETTINGS.overheadBase;
}

function parseProfitBase(value: unknown): EstimateProfitBase {
  if (value === 'direct_plus_overhead' || value === 'direct_only') return value;
  return DEFAULT_ESTIMATE_SETTINGS.profitBase;
}

function parseTaxBase(value: unknown): EstimateTaxBase {
  if (value === 'materials_only' || value === 'total_estimate' || value === 'none') return value;
  return DEFAULT_ESTIMATE_SETTINGS.taxBase;
}

function companyTaxApplicationToEstimateTaxBase(
  taxApplication: TaxApplication | undefined,
): EstimateTaxBase | undefined {
  switch (taxApplication) {
    case 'materials_only':
    case 'materials_and_equipment':
      return 'materials_only';
    case 'entire_project':
      return 'total_estimate';
    default:
      return undefined;
  }
}

export function normalizeEstimateSettings(
  value?: Partial<EstimateSettings> | null,
): EstimateSettings {
  const source = value ?? {};
  return {
    defaultLaborRate: sanitizeCost(source.defaultLaborRate ?? DEFAULT_ESTIMATE_SETTINGS.defaultLaborRate),
    burdenPercent: clampPercent(source.burdenPercent ?? DEFAULT_ESTIMATE_SETTINGS.burdenPercent),
    materialMarkupPercent: clampPercent(
      source.materialMarkupPercent ?? DEFAULT_ESTIMATE_SETTINGS.materialMarkupPercent,
    ),
    equipmentMarkupPercent: clampPercent(
      source.equipmentMarkupPercent ?? DEFAULT_ESTIMATE_SETTINGS.equipmentMarkupPercent,
    ),
    subcontractorMarkupPercent: clampPercent(
      source.subcontractorMarkupPercent ?? DEFAULT_ESTIMATE_SETTINGS.subcontractorMarkupPercent,
    ),
    indirectCostPercent: clampPercent(
      source.indirectCostPercent ?? DEFAULT_ESTIMATE_SETTINGS.indirectCostPercent,
    ),
    overheadPercent: clampPercent(source.overheadPercent ?? DEFAULT_ESTIMATE_SETTINGS.overheadPercent),
    profitPercent: clampPercent(source.profitPercent ?? DEFAULT_ESTIMATE_SETTINGS.profitPercent),
    contingencyPercent: clampPercent(
      source.contingencyPercent ?? DEFAULT_ESTIMATE_SETTINGS.contingencyPercent,
    ),
    taxPercent: clampPercent(source.taxPercent ?? DEFAULT_ESTIMATE_SETTINGS.taxPercent),
    hoursPerDay: Math.max(
      0,
      toFiniteNumber(source.hoursPerDay, DEFAULT_ESTIMATE_SETTINGS.hoursPerDay),
    ),
    defaultCrewSize: Math.max(
      0,
      toFiniteNumber(source.defaultCrewSize, DEFAULT_ESTIMATE_SETTINGS.defaultCrewSize),
    ),
    currency: toStringValue(source.currency, DEFAULT_ESTIMATE_SETTINGS.currency),
    overheadBase: parseOverheadBase(source.overheadBase),
    profitBase: parseProfitBase(source.profitBase),
    taxBase: parseTaxBase(source.taxBase),
    importedFromUserSettingsAt:
      typeof source.importedFromUserSettingsAt === 'string'
        ? source.importedFromUserSettingsAt
        : null,
  };
}

export function parseEstimateSettingsFromAssumptions(
  assumptions: Record<string, unknown> | undefined | null,
): EstimateSettings {
  if (!assumptions || typeof assumptions !== 'object') {
    return { ...DEFAULT_ESTIMATE_SETTINGS };
  }
  const nested = assumptions.estimateSettings;
  if (!nested || typeof nested !== 'object' || Array.isArray(nested)) {
    return { ...DEFAULT_ESTIMATE_SETTINGS };
  }
  return normalizeEstimateSettings(nested as Partial<EstimateSettings>);
}

export function estimateSettingsToAssumptions(
  settings: EstimateSettings,
  existingAssumptions: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    ...existingAssumptions,
    estimateSettings: normalizeEstimateSettings(settings),
  };
}

export function resolveOverheadBaseAmount(
  settings: EstimateSettings,
  directCostTotal: number,
  laborCostTotal: number,
): number {
  switch (settings.overheadBase) {
    case 'labor_only':
      return sanitizeCost(laborCostTotal);
    case 'custom':
    case 'direct_cost':
    default:
      return sanitizeCost(directCostTotal);
  }
}

export function resolveProfitBaseAmount(
  settings: EstimateSettings,
  directCostTotal: number,
  indirectCost: number,
  overhead: number,
): number {
  if (settings.profitBase === 'direct_only') {
    return sanitizeCost(directCostTotal);
  }
  return roundToTwo(directCostTotal + indirectCost + overhead);
}

export function resolveTaxBaseAmount(
  settings: EstimateSettings,
  materialCostTotal: number,
  subtotalBeforeTax: number,
): number {
  switch (settings.taxBase) {
    case 'materials_only':
      return sanitizeCost(materialCostTotal);
    case 'total_estimate':
      return sanitizeCost(subtotalBeforeTax);
    case 'none':
    default:
      return 0;
  }
}

export function buildEstimateTotalsFromSettings(
  lineItems: EstimateLineSnapshot[],
  settingsInput?: Partial<EstimateSettings> | null,
): EstimateCostTotals {
  const settings = normalizeEstimateSettings(settingsInput);

  const directCost = roundToTwo(
    lineItems.reduce((sum, line) => sum + line.costs.directCost, 0),
  );
  const laborCost = roundToTwo(
    lineItems.reduce((sum, line) => sum + line.costs.totalLaborCost, 0),
  );
  const materialCost = roundToTwo(
    lineItems.reduce((sum, line) => sum + line.costs.materialCost, 0),
  );

  const indirectCost = calculateOverhead(directCost, settings.indirectCostPercent);
  const overheadBaseAmount = resolveOverheadBaseAmount(settings, directCost, laborCost);
  const overhead = calculateOverhead(overheadBaseAmount, settings.overheadPercent);
  const profitBaseAmount = resolveProfitBaseAmount(settings, directCost, indirectCost, overhead);
  const profit = calculateProfit(profitBaseAmount, settings.profitPercent);
  const subtotalBeforeContingency = roundToTwo(directCost + indirectCost + overhead + profit);
  const contingency = calculateContingency(subtotalBeforeContingency, settings.contingencyPercent);
  const subtotalBeforeTax = roundToTwo(subtotalBeforeContingency + contingency);
  const taxBaseAmount = resolveTaxBaseAmount(settings, materialCost, subtotalBeforeTax);
  const tax =
    settings.taxBase === 'none' ? 0 : calculateTax(taxBaseAmount, settings.taxPercent);
  const finalSellPrice = calculateFinalSellPrice({
    directCost,
    indirectCost,
    overhead,
    profit,
    contingency,
    tax,
  });

  return {
    directCost,
    indirectCost,
    overhead,
    profit,
    contingency,
    tax,
    finalSellPrice,
  };
}

export interface UserSettingsImportSources {
  preferences?: Partial<{
    currency: string;
  }>;
  company?: Partial<{
    taxRatePercent: number;
    taxApplication: TaxApplication;
    taxSystem: string;
  }>;
}

export function mergeEstimateSettingsFromUserSources(
  current: EstimateSettings,
  sources: UserSettingsImportSources,
): EstimateSettings {
  const next: EstimateSettings = { ...normalizeEstimateSettings(current) };
  const preferences = sources.preferences;
  const company = sources.company;

  if (preferences?.currency) {
    next.currency = preferences.currency;
  }

  if (company?.taxRatePercent != null && Number.isFinite(company.taxRatePercent)) {
    next.taxPercent = clampPercent(company.taxRatePercent);
  }

  const taxBase = companyTaxApplicationToEstimateTaxBase(company?.taxApplication);
  if (taxBase) {
    next.taxBase = taxBase;
  }

  if (company?.taxSystem === 'none') {
    next.taxPercent = 0;
    next.taxBase = 'none';
  }

  next.importedFromUserSettingsAt = new Date().toISOString();
  return normalizeEstimateSettings(next);
}

export async function loadUserSettingsForEstimateImport(): Promise<UserSettingsImportSources> {
  const [preferences, company] = await Promise.all([
    getUserPreferences().catch(() => DEFAULT_USER_PREFERENCES),
    getCompanySettings().catch(() => null),
  ]);

  return {
    preferences: {
      currency: preferences.currency,
    },
    company: company
      ? {
          taxRatePercent: company.taxRatePercent,
          taxApplication: company.taxApplication,
          taxSystem: company.taxSystem,
        }
      : undefined,
  };
}

export function estimateSettingsRowsForExport(
  settings: EstimateSettings,
): Array<{ setting: string; value: string | number }> {
  const normalized = normalizeEstimateSettings(settings);
  return ESTIMATE_SETTINGS_EXPORT_ROWS.map((row) => ({
    setting: row.setting,
    value:
      row.key === 'currency' ||
      row.key === 'overheadBase' ||
      row.key === 'profitBase' ||
      row.key === 'taxBase'
        ? normalized[row.key]
        : normalized[row.key],
  }));
}

export function parseEstimateSettingsSheetRows(
  rows: Array<Record<string, unknown>>,
): Partial<EstimateSettings> | null {
  if (rows.length === 0) return null;

  const patch: Partial<EstimateSettings> = {};
  let found = false;

  for (const row of rows) {
    const settingKey = toStringValue(row.setting, '');
    if (!settingKey) continue;
    const mappedKey = ESTIMATE_SETTINGS_EXPORT_KEY_BY_SETTING.get(settingKey);
    if (!mappedKey) continue;
    found = true;
    const rawValue = row.value;

    if (mappedKey === 'currency') {
      patch.currency = toStringValue(rawValue, DEFAULT_ESTIMATE_SETTINGS.currency);
      continue;
    }
    if (mappedKey === 'overheadBase') {
      patch.overheadBase = parseOverheadBase(toStringValue(rawValue, ''));
      continue;
    }
    if (mappedKey === 'profitBase') {
      patch.profitBase = parseProfitBase(toStringValue(rawValue, ''));
      continue;
    }
    if (mappedKey === 'taxBase') {
      patch.taxBase = parseTaxBase(toStringValue(rawValue, ''));
      continue;
    }

    patch[mappedKey] = toFiniteNumber(
      rawValue,
      DEFAULT_ESTIMATE_SETTINGS[mappedKey] as number,
    ) as never;
  }

  return found ? patch : null;
}

export function estimateSettingsAreEqual(
  left: EstimateSettings,
  right: EstimateSettings,
): boolean {
  const normalizedLeft = normalizeEstimateSettings(left);
  const normalizedRight = normalizeEstimateSettings(right);
  return JSON.stringify(normalizedLeft) === JSON.stringify(normalizedRight);
}
