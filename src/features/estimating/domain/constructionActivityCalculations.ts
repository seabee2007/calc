import type {
  ActivityRollupResult,
  ActivityLineItemTemplate,
  ProductionRate,
  ProjectActivityLineItem,
  ProjectConstructionActivity,
} from './constructionActivityTypes';

const DEFAULT_HOURS_PER_DAY = 8;
const DEFAULT_PRODUCTION_FACTOR = 1;
const MIN_SCHEDULE_DURATION_DAYS = 1;

function normalizeNonNegative(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

function normalizePositive(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return value;
}

/** Defaults missing production factor to 1. */
export function resolveProductionFactor(productionFactor?: number): number {
  if (productionFactor === undefined || productionFactor === null) return DEFAULT_PRODUCTION_FACTOR;
  if (!Number.isFinite(productionFactor) || productionFactor <= 0) return DEFAULT_PRODUCTION_FACTOR;
  return productionFactor;
}

export function validateLineItemQuantity(quantity: number): boolean {
  return Number.isFinite(quantity) && quantity >= 0;
}

export function validateProductionRateUnit(unit: string | undefined | null): boolean {
  return typeof unit === 'string' && unit.trim().length > 0;
}

export function validateCrewSizeForDuration(crewSize: number): boolean {
  return Number.isFinite(crewSize) && crewSize > 0;
}

/**
 * Line item man-hours = quantity × manHoursPerUnit × productionFactor.
 * Production factor defaults to 1.
 */
export function calculateLineItemManHours(
  quantity: number,
  manHoursPerUnit: number,
  productionFactor?: number,
): number {
  const qty = normalizeNonNegative(quantity);
  const rate = normalizeNonNegative(manHoursPerUnit);
  const factor = resolveProductionFactor(productionFactor);
  return qty * rate * factor;
}

/** Sum man-hours from project line items. */
export function calculateActivityManHours(lineItems: ProjectActivityLineItem[]): number {
  return lineItems.reduce(
    (sum, item) =>
      sum +
      calculateLineItemManHours(item.quantity, item.manHoursPerUnit, item.productionFactor),
    0,
  );
}

/** Man-days = manHours / hoursPerDay (default 8). */
export function calculateManDays(manHours: number, hoursPerDay = DEFAULT_HOURS_PER_DAY): number {
  const hours = normalizeNonNegative(manHours);
  const perDay = normalizePositive(hoursPerDay, DEFAULT_HOURS_PER_DAY);
  if (hours === 0) return 0;
  return hours / perDay;
}

/**
 * Activity duration (days) = manHours / (crewSize × hoursPerDay), rounded up.
 * Returns 0 when crew size is invalid (safe handling).
 */
export function calculateActivityDurationDays(
  manHours: number,
  crewSize: number,
  hoursPerDay = DEFAULT_HOURS_PER_DAY,
): number {
  if (!validateCrewSizeForDuration(crewSize)) return 0;

  const hours = normalizeNonNegative(manHours);
  const perDay = normalizePositive(hoursPerDay, DEFAULT_HOURS_PER_DAY);
  if (hours === 0) return 0;

  const crewDays = hours / (crewSize * perDay);
  return Math.ceil(crewDays);
}

export function rollupConstructionActivity(
  activity: ProjectConstructionActivity,
  lineItems: ProjectActivityLineItem[],
): ActivityRollupResult {
  const warnings: string[] = [];

  for (const item of lineItems) {
    if (!validateLineItemQuantity(item.quantity)) {
      warnings.push(`Line item "${item.name}" has invalid quantity.`);
    }
    if (!validateProductionRateUnit(item.unit)) {
      warnings.push(`Line item "${item.name}" is missing a unit.`);
    }
  }

  if (!validateCrewSizeForDuration(activity.crewSize)) {
    warnings.push('Crew size must be greater than zero before duration can be calculated.');
  }

  const totalManHours = calculateActivityManHours(lineItems);
  const hoursPerDay = normalizePositive(activity.hoursPerDay, DEFAULT_HOURS_PER_DAY);
  const totalManDays = calculateManDays(totalManHours, hoursPerDay);

  let calculatedDurationDays = calculateActivityDurationDays(
    totalManHours,
    activity.crewSize,
    hoursPerDay,
  );

  if (calculatedDurationDays > 0 && calculatedDurationDays < MIN_SCHEDULE_DURATION_DAYS) {
    calculatedDurationDays = MIN_SCHEDULE_DURATION_DAYS;
  }

  const durationDaysOverride =
    activity.durationDaysOverride != null &&
    Number.isFinite(activity.durationDaysOverride) &&
    activity.durationDaysOverride > 0
      ? Math.ceil(activity.durationDaysOverride)
      : null;

  const durationDays = durationDaysOverride ?? calculatedDurationDays;

  const totalLaborCost = lineItems.reduce((sum, item) => sum + (item.laborCost ?? 0), 0);
  const totalMaterialCost = lineItems.reduce((sum, item) => sum + (item.materialCost ?? 0), 0);
  const totalEquipmentCost = lineItems.reduce((sum, item) => sum + (item.equipmentCost ?? 0), 0);

  return {
    totalManHours,
    totalManDays,
    calculatedDurationDays,
    effectiveDurationDays: durationDays,
    durationDays,
    totalLaborCost,
    totalMaterialCost,
    totalEquipmentCost,
    totalDirectCost: totalLaborCost + totalMaterialCost + totalEquipmentCost,
    lineItemCount: lineItems.length,
    warnings,
  };
}

/** Whether a line item type participates in scheduling (always false for activity line items). */
export function isScheduleActivityLineItem(_item: ProjectActivityLineItem): boolean {
  return false;
}

/** Whether a construction activity may appear on the schedule when enabled. */
export function isSchedulableConstructionActivity(activity: ProjectConstructionActivity): boolean {
  return activity.scheduleEnabled === true;
}

export function manHoursPerUnitFromProductionRate(rate: ProductionRate): number {
  return normalizeNonNegative(rate.manHoursPerUnit ?? 0);
}

export function manHoursPerUnitFromLineItemTemplate(
  template: ActivityLineItemTemplate,
  productionRatesById: Map<string, ProductionRate>,
): number {
  if (template.productionRateId) {
    const rate = productionRatesById.get(template.productionRateId);
    if (rate) return manHoursPerUnitFromProductionRate(rate);
  }
  return normalizeNonNegative(template.defaultManHoursPerUnit ?? 0);
}
