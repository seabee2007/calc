import type { EquipmentRateType, ProductionRateType } from './estimateTypes';

const ROUND_DIGITS = 2;
const DEFAULT_HOURS_PER_DAY = 8;
const DEFAULT_CREW_SIZE = 1;
const DEFAULT_PARALLEL_CREWS = 1;
const CUBIC_FEET_PER_CUBIC_YARD = 27;

function powerOfTen(digits: number): number {
  return 10 ** digits;
}

export function roundToTwo(value: number): number {
  const normalized = Number.isFinite(value) ? value : 0;
  const p = powerOfTen(ROUND_DIGITS);
  return Math.round((normalized + Number.EPSILON) * p) / p;
}

export function sanitizeFiniteNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

export function sanitizeNonNegative(value: number): number {
  const safe = sanitizeFiniteNumber(value, 0);
  return safe < 0 ? 0 : safe;
}

export function clampPercent(value: number): number {
  const safe = sanitizeFiniteNumber(value, 0);
  if (safe < 0) return 0;
  if (safe > 100) return 100;
  return roundToTwo(safe);
}

export function safeDivide(numerator: number, denominator: number): number {
  const num = sanitizeFiniteNumber(numerator, 0);
  const den = sanitizeFiniteNumber(denominator, 0);
  if (den <= 0) return 0;
  return num / den;
}

function sanitizeFactor(value: number, fallback = 1): number {
  const safe = sanitizeFiniteNumber(value, fallback);
  return safe > 0 ? safe : fallback;
}

export function sanitizeCost(value: number): number {
  return roundToTwo(sanitizeNonNegative(value));
}

export function calculateArea(length: number, width: number): number {
  const safeLength = sanitizeNonNegative(length);
  const safeWidth = sanitizeNonNegative(width);
  return roundToTwo(safeLength * safeWidth);
}

export function calculateWallArea(length: number, height: number): number {
  const safeLength = sanitizeNonNegative(length);
  const safeHeight = sanitizeNonNegative(height);
  return roundToTwo(safeLength * safeHeight);
}

export function calculateNetWallArea(grossWallArea: number, openingArea: number): number {
  const gross = sanitizeNonNegative(grossWallArea);
  const openings = sanitizeNonNegative(openingArea);
  return roundToTwo(Math.max(gross - openings, 0));
}

export function calculateVolumeCubicFeet(length: number, width: number, height: number): number {
  const safeLength = sanitizeNonNegative(length);
  const safeWidth = sanitizeNonNegative(width);
  const safeHeight = sanitizeNonNegative(height);
  return roundToTwo(safeLength * safeWidth * safeHeight);
}

export function calculateConcreteCubicYards(cubicFeet: number): number {
  const safeCubicFeet = sanitizeNonNegative(cubicFeet);
  return roundToTwo(safeDivide(safeCubicFeet, CUBIC_FEET_PER_CUBIC_YARD));
}

export function calculateQuantityWithWaste(baseQuantity: number, wastePercent: number): number {
  const safeBase = sanitizeNonNegative(baseQuantity);
  const safeWaste = clampPercent(wastePercent);
  const multiplier = 1 + safeWaste / 100;
  return roundToTwo(safeBase * multiplier);
}

export function calculateMaterialCoverageUnits(
  requiredQuantity: number,
  coveragePerUnit: number,
): number {
  const required = sanitizeNonNegative(requiredQuantity);
  const coverage = sanitizeNonNegative(coveragePerUnit);
  return roundToTwo(safeDivide(required, coverage));
}

export function calculateLaborHours(
  quantity: number,
  productionRate: number,
  productionRateType: ProductionRateType,
  options?: { hoursPerDay?: number; crewSize?: number },
): number {
  const qty = sanitizeNonNegative(quantity);
  const rate = sanitizeNonNegative(productionRate);
  const hoursPerDay = sanitizeFactor(options?.hoursPerDay ?? DEFAULT_HOURS_PER_DAY);
  const crewSize = sanitizeFactor(options?.crewSize ?? DEFAULT_CREW_SIZE);

  if (qty <= 0 || rate <= 0) return 0;

  switch (productionRateType) {
    case 'units_per_labor_hour':
      return roundToTwo(safeDivide(qty, rate));
    case 'units_per_labor_day':
      return roundToTwo(safeDivide(qty, rate) * hoursPerDay);
    case 'labor_hours_per_unit':
      return roundToTwo(qty * rate);
    case 'units_per_crew_day':
      return roundToTwo(safeDivide(qty, rate) * crewSize * hoursPerDay);
    default:
      return 0;
  }
}

export function calculateAdjustedLaborHours(
  laborHours: number,
  difficultyFactor: number,
  locationFactor: number,
): number {
  const hours = sanitizeNonNegative(laborHours);
  const difficulty = sanitizeFactor(difficultyFactor, 1);
  const location = sanitizeFactor(locationFactor, 1);
  return roundToTwo(hours * difficulty * location);
}

export function calculateManDays(laborHours: number, hoursPerDay = DEFAULT_HOURS_PER_DAY): number {
  const hours = sanitizeNonNegative(laborHours);
  const dailyHours = sanitizeFactor(hoursPerDay, DEFAULT_HOURS_PER_DAY);
  return roundToTwo(safeDivide(hours, dailyHours));
}

export function calculateCrewDays(
  laborHours: number,
  crewSize = DEFAULT_CREW_SIZE,
  hoursPerDay = DEFAULT_HOURS_PER_DAY,
): number {
  const hours = sanitizeNonNegative(laborHours);
  const crew = sanitizeFactor(crewSize, DEFAULT_CREW_SIZE);
  const dailyHours = sanitizeFactor(hoursPerDay, DEFAULT_HOURS_PER_DAY);
  return roundToTwo(safeDivide(hours, crew * dailyHours));
}

export function calculateDurationDays(crewDays: number, parallelCrews = DEFAULT_PARALLEL_CREWS): number {
  const safeCrewDays = sanitizeNonNegative(crewDays);
  const crews = sanitizeFactor(parallelCrews, DEFAULT_PARALLEL_CREWS);
  return roundToTwo(safeDivide(safeCrewDays, crews));
}

export function calculateBaseLaborCost(adjustedLaborHours: number, laborRate: number): number {
  const hours = sanitizeNonNegative(adjustedLaborHours);
  const rate = sanitizeNonNegative(laborRate);
  return roundToTwo(hours * rate);
}

export function calculateBurdenCost(baseLaborCost: number, burdenPercent: number): number {
  const base = sanitizeCost(baseLaborCost);
  const burden = clampPercent(burdenPercent);
  return roundToTwo(base * (burden / 100));
}

export function calculateTotalLaborCost(baseLaborCost: number, burdenCost: number): number {
  const base = sanitizeCost(baseLaborCost);
  const burden = sanitizeCost(burdenCost);
  return roundToTwo(base + burden);
}

export function calculateMaterialCost(quantityWithWaste: number, materialUnitCost: number): number {
  const qty = sanitizeNonNegative(quantityWithWaste);
  const unitCost = sanitizeNonNegative(materialUnitCost);
  return roundToTwo(qty * unitCost);
}

export function calculateEquipmentCost(
  rate: number,
  rateType: EquipmentRateType,
  usageUnits?: number,
): number {
  const safeRate = sanitizeNonNegative(rate);
  if (safeRate <= 0) return 0;
  if (rateType === 'lump_sum') return roundToTwo(safeRate);

  const usage = sanitizeNonNegative(usageUnits ?? 0);
  return roundToTwo(safeRate * usage);
}

export function calculateSubcontractorCost(cost: number): number {
  return sanitizeCost(cost);
}

export function calculateDirectCost(
  totalLaborCost: number,
  materialCost: number,
  equipmentCost: number,
  subcontractorCost: number,
): number {
  const labor = sanitizeCost(totalLaborCost);
  const material = sanitizeCost(materialCost);
  const equipment = sanitizeCost(equipmentCost);
  const subcontractor = sanitizeCost(subcontractorCost);
  return roundToTwo(labor + material + equipment + subcontractor);
}

export function calculateIndirectCost(indirectCost: number): number {
  return sanitizeCost(indirectCost);
}

export function calculateOverhead(directCost: number, overheadPercent: number): number {
  const base = sanitizeCost(directCost);
  const percent = clampPercent(overheadPercent);
  return roundToTwo(base * (percent / 100));
}

export function calculateProfit(subtotalBeforeProfit: number, profitPercent: number): number {
  const base = sanitizeCost(subtotalBeforeProfit);
  const percent = clampPercent(profitPercent);
  return roundToTwo(base * (percent / 100));
}

export function calculateContingency(
  subtotalBeforeContingency: number,
  contingencyPercent: number,
): number {
  const base = sanitizeCost(subtotalBeforeContingency);
  const percent = clampPercent(contingencyPercent);
  return roundToTwo(base * (percent / 100));
}

export function calculateTax(taxableAmount: number, taxPercent: number): number {
  const taxable = sanitizeCost(taxableAmount);
  const percent = clampPercent(taxPercent);
  return roundToTwo(taxable * (percent / 100));
}

export function calculateFinalSellPrice(parts: {
  directCost: number;
  indirectCost: number;
  overhead: number;
  profit: number;
  contingency: number;
  tax: number;
}): number {
  const direct = sanitizeCost(parts.directCost);
  const indirect = sanitizeCost(parts.indirectCost);
  const overhead = sanitizeCost(parts.overhead);
  const profit = sanitizeCost(parts.profit);
  const contingency = sanitizeCost(parts.contingency);
  const tax = sanitizeCost(parts.tax);
  return roundToTwo(direct + indirect + overhead + profit + contingency + tax);
}

