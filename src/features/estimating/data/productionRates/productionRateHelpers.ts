import { residentialActivityMaster } from '../residentialActivityMaster';
import { getMasterActivityByCode } from '../masterActivityIndex';
import {
  RESIDENTIAL_PRODUCTION_RATES,
  type ProductionRateReference,
  type ResidentialProductionRate,
} from './residentialProductionRates';

export type ProductionRateDefaults = {
  unit: string;
  productionRate: number;
  productionRateType: 'labor_hours_per_unit';
  defaultCrewSize: number;
  sourceCsiCode: string;
  sourceDescription: string;
  productionRateId: string;
};

/** Activity types that must never receive production-rate auto-fill. */
const NO_AUTOFILL_TYPES = new Set([
  'inspection',
  'milestone',
  'curing_lag',
  'testing',
  'procurement_lead_time',
]);

const PRODUCTION_RATE_BY_ID = new Map<string, ProductionRateReference>(
  RESIDENTIAL_PRODUCTION_RATES.map((rate) => [rate.id, rate]),
);

export function normalizeProductionRateActivityCode(activityCode: string | undefined | null): string {
  const trimmed = activityCode?.trim();
  if (!trimmed) return '';
  return trimmed.replace(/\.\d+$/, '');
}

export function getProductionRateById(id: string | undefined | null): ProductionRateReference | undefined {
  const trimmed = id?.trim();
  if (!trimmed) return undefined;
  return PRODUCTION_RATE_BY_ID.get(trimmed);
}

export function getProductionRateDefaultsForActivity(
  activityCode: string | undefined | null,
): ProductionRateDefaults | undefined {
  const baseCode = normalizeProductionRateActivityCode(activityCode);
  if (!baseCode) return undefined;

  const master = getMasterActivityByCode(baseCode);
  if (!master) return undefined;

  // Never auto-fill production rates for non-work activity types.
  if (NO_AUTOFILL_TYPES.has(master.activityType)) return undefined;

  const productionRateId = master.productionRateId?.trim();
  if (!productionRateId) return undefined;

  const rate = getProductionRateById(productionRateId);
  if (!rate) return undefined;

  // Reject unit mismatches — every mapped productionRateId must match the activity's unit.
  if (master.defaultUnit && rate.unit !== master.defaultUnit) {
    return undefined;
  }

  return {
    unit: rate.unit,
    productionRate: rate.bareManHoursPerUnit,
    productionRateType: 'labor_hours_per_unit',
    defaultCrewSize: rate.defaultCrewSize,
    sourceCsiCode: rate.csiCode,
    sourceDescription: rate.itemDescription,
    productionRateId: rate.id,
  };
}

// ── Dataset validation ────────────────────────────────────────────────────────

export type ProductionRateValidationError = {
  id: string;
  field: string;
  message: string;
};

/**
 * Validates the entire production-rate dataset and returns any integrity errors.
 * Checks: required fields, positive numerics, no duplicate IDs, and
 * sourceDivisionCode matching the first two digits of csiCode.
 */
export function validateProductionRates(): ProductionRateValidationError[] {
  const errors: ProductionRateValidationError[] = [];
  const seenIds = new Map<string, number>();

  RESIDENTIAL_PRODUCTION_RATES.forEach((rate, idx) => {
    const label = rate.id || `record[${idx}]`;

    if (!rate.id?.trim()) errors.push({ id: label, field: 'id', message: 'id is required' });
    if (!rate.csiCode?.trim()) errors.push({ id: label, field: 'csiCode', message: 'csiCode is required' });
    if (!rate.itemDescription?.trim()) errors.push({ id: label, field: 'itemDescription', message: 'itemDescription is required' });
    if (!rate.unit?.trim()) errors.push({ id: label, field: 'unit', message: 'unit is required' });
    if (!rate.dailyOutputUnit?.trim()) errors.push({ id: label, field: 'dailyOutputUnit', message: 'dailyOutputUnit is required' });
    if (!rate.sourceDivisionCode?.trim()) errors.push({ id: label, field: 'sourceDivisionCode', message: 'sourceDivisionCode is required' });

    if (!(rate.defaultCrewSize > 0)) errors.push({ id: label, field: 'defaultCrewSize', message: 'defaultCrewSize must be > 0' });
    if (!(rate.dailyOutput > 0)) errors.push({ id: label, field: 'dailyOutput', message: 'dailyOutput must be > 0' });
    if (!(rate.bareManHoursPerUnit > 0)) errors.push({ id: label, field: 'bareManHoursPerUnit', message: 'bareManHoursPerUnit must be > 0' });

    // sourceDivisionCode must be exactly two digits matching the csiCode prefix.
    if (rate.sourceDivisionCode && rate.csiCode) {
      const prefix = rate.csiCode.trim().slice(0, 2);
      if (!/^\d{2}$/.test(rate.sourceDivisionCode)) {
        errors.push({ id: label, field: 'sourceDivisionCode', message: `sourceDivisionCode "${rate.sourceDivisionCode}" must be exactly two digits` });
      } else if (rate.sourceDivisionCode !== prefix) {
        errors.push({ id: label, field: 'sourceDivisionCode', message: `sourceDivisionCode "${rate.sourceDivisionCode}" does not match csiCode prefix "${prefix}"` });
      }
    }

    // Track duplicate IDs.
    if (rate.id) {
      seenIds.set(rate.id, (seenIds.get(rate.id) ?? 0) + 1);
    }
  });

  for (const [id, count] of seenIds.entries()) {
    if (count > 1) {
      errors.push({ id, field: 'id', message: `Duplicate id "${id}" appears ${count} times` });
    }
  }

  return errors;
}

// ── Coverage reporting ────────────────────────────────────────────────────────

export type ProductionRateDivisionCoverage = {
  divisionCode: string;
  totalActivities: number;
  mappedActivities: number;
  unmappedActivityCodes: string[];
  totalProductionRates: number;
  mappedProductionRates: number;
  unmappedProductionRateIds: string[];
};

export type ProductionRateMappingCoverage = {
  totalMasterActivities: number;
  mappedMasterActivities: number;
  unmappedMasterActivities: number;
  unmappedActivityCodes: string[];
  totalProductionRates: number;
  mappedProductionRates: number;
  unmappedProductionRates: number;
  unmappedProductionRateIds: string[];
  byDivision: ProductionRateDivisionCoverage[];
};

/**
 * Returns a full mapping-coverage report: how many master activities are wired
 * to production-rate records and which rates remain unlinked. Useful for
 * tracking expansion progress and catching regressions.
 */
export function getProductionRateMappingCoverage(): ProductionRateMappingCoverage {
  // Work activities only (exclude inspections, milestones, lags, etc.)
  const workActivities = residentialActivityMaster.filter(
    (a) => !NO_AUTOFILL_TYPES.has(a.activityType),
  );

  const mappedActivityCodes = new Set<string>();
  const unmappedActivityCodes: string[] = [];

  for (const activity of workActivities) {
    const defaults = getProductionRateDefaultsForActivity(activity.activityCode);
    if (defaults) {
      mappedActivityCodes.add(activity.activityCode);
    } else {
      unmappedActivityCodes.push(activity.activityCode);
    }
  }

  // Production rates referenced by at least one mapped activity.
  const referencedRateIds = new Set<string>();
  for (const activity of workActivities) {
    if (activity.productionRateId) {
      const rate = getProductionRateById(activity.productionRateId);
      if (rate) referencedRateIds.add(rate.id);
    }
  }

  const allRateIds = RESIDENTIAL_PRODUCTION_RATES.map((r) => r.id);
  const unmappedProductionRateIds = allRateIds.filter((id) => !referencedRateIds.has(id));

  // Per-division breakdown.
  const divisionMap = new Map<string, {
    activities: typeof workActivities;
    rateIds: Set<string>;
  }>();

  for (const activity of workActivities) {
    const div = activity.divisionCode;
    if (!divisionMap.has(div)) divisionMap.set(div, { activities: [], rateIds: new Set() });
    divisionMap.get(div)!.activities.push(activity);
  }

  for (const rate of RESIDENTIAL_PRODUCTION_RATES) {
    const div = rate.sourceDivisionCode;
    if (!divisionMap.has(div)) divisionMap.set(div, { activities: [], rateIds: new Set() });
    divisionMap.get(div)!.rateIds.add(rate.id);
  }

  const byDivision: ProductionRateDivisionCoverage[] = [...divisionMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([divisionCode, { activities, rateIds }]) => {
      const divMappedCodes: string[] = [];
      const divUnmappedCodes: string[] = [];
      for (const a of activities) {
        if (mappedActivityCodes.has(a.activityCode)) divMappedCodes.push(a.activityCode);
        else divUnmappedCodes.push(a.activityCode);
      }
      const divReferencedIds = new Set<string>();
      for (const a of activities) {
        if (a.productionRateId && referencedRateIds.has(a.productionRateId)) {
          divReferencedIds.add(a.productionRateId);
        }
      }
      const divUnmappedRateIds = [...rateIds].filter((id) => !divReferencedIds.has(id));

      return {
        divisionCode,
        totalActivities: activities.length,
        mappedActivities: divMappedCodes.length,
        unmappedActivityCodes: divUnmappedCodes,
        totalProductionRates: rateIds.size,
        mappedProductionRates: divReferencedIds.size,
        unmappedProductionRateIds: divUnmappedRateIds,
      };
    });

  return {
    totalMasterActivities: workActivities.length,
    mappedMasterActivities: mappedActivityCodes.size,
    unmappedMasterActivities: unmappedActivityCodes.length,
    unmappedActivityCodes,
    totalProductionRates: allRateIds.length,
    mappedProductionRates: referencedRateIds.size,
    unmappedProductionRates: unmappedProductionRateIds.length,
    unmappedProductionRateIds,
    byDivision,
  };
}
