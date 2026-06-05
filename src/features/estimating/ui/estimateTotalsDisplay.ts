import type { EstimateCostTotals, EstimateLineCosts, EstimateLineMetrics } from '../domain/estimateTypes';
import type { EstimateDomainTask, EstimateDomainVersion } from '../infrastructure/estimateDbTypes';

const ZERO_TOTALS: EstimateCostTotals = {
  directCost: 0,
  indirectCost: 0,
  overhead: 0,
  profit: 0,
  contingency: 0,
  tax: 0,
  finalSellPrice: 0,
};

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Coerce unknown values to a finite number, defaulting to zero. */
export function safeEstimateNumber(value: unknown, fallback = 0): number {
  const parsed = toFiniteNumber(value);
  return parsed ?? fallback;
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function parseCosts(task: EstimateDomainTask): Partial<EstimateLineCosts> {
  const raw = task.calculatedValues.costs;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as Partial<EstimateLineCosts>;
}

function parseMetrics(task: EstimateDomainTask): Partial<EstimateLineMetrics> {
  const raw = task.calculatedValues.metrics;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as Partial<EstimateLineMetrics>;
}

export interface EstimateLineCostRollups {
  labor: number;
  materials: number;
  equipment: number;
  subcontractors: number;
}

/** Safely read version totals JSON fields into a normalized shape. */
export function extractTotalsFromJson(
  totals: Record<string, unknown> | EstimateCostTotals | null | undefined,
): EstimateCostTotals {
  const obj = parseJsonObject(totals);
  if (Object.keys(obj).length === 0 && totals && typeof totals === 'object') {
    const direct = totals as EstimateCostTotals;
    return {
      directCost: safeEstimateNumber(direct.directCost),
      indirectCost: safeEstimateNumber(direct.indirectCost),
      overhead: safeEstimateNumber(direct.overhead),
      profit: safeEstimateNumber(direct.profit),
      contingency: safeEstimateNumber(direct.contingency),
      tax: safeEstimateNumber(direct.tax),
      finalSellPrice: safeEstimateNumber(direct.finalSellPrice),
    };
  }

  return {
    directCost: safeEstimateNumber(obj.directCost),
    indirectCost: safeEstimateNumber(obj.indirectCost),
    overhead: safeEstimateNumber(obj.overhead),
    profit: safeEstimateNumber(obj.profit),
    contingency: safeEstimateNumber(obj.contingency),
    tax: safeEstimateNumber(obj.tax),
    finalSellPrice: safeEstimateNumber(obj.finalSellPrice),
  };
}

export function extractVersionTotals(version: EstimateDomainVersion | null): EstimateCostTotals {
  if (!version) return { ...ZERO_TOTALS };
  return extractTotalsFromJson(version.totals);
}

export function rollupLineItemCosts(version: EstimateDomainVersion | null): EstimateLineCostRollups {
  if (!version) {
    return { labor: 0, materials: 0, equipment: 0, subcontractors: 0 };
  }

  let labor = 0;
  let materials = 0;
  let equipment = 0;
  let subcontractors = 0;

  for (const task of version.lineItems) {
    const costs = parseCosts(task);
    labor += safeEstimateNumber(costs.totalLaborCost);
    materials += safeEstimateNumber(costs.materialCost);
    equipment += safeEstimateNumber(costs.equipmentCost);
    subcontractors += safeEstimateNumber(costs.subcontractorCost);
  }

  return { labor, materials, equipment, subcontractors };
}

/** Prefer finalSellPrice; fall back to directCost when sell price is zero. */
export function resolveFinalSellPrice(totals: EstimateCostTotals): number {
  const finalSell = safeEstimateNumber(totals.finalSellPrice);
  if (finalSell > 0) return finalSell;

  const direct = safeEstimateNumber(totals.directCost);
  if (direct > 0) return direct;

  return 0;
}

export interface EstimateLaborPlanningMetrics {
  laborHours: number;
  manDays: number;
  crewDays: number;
  durationDays: number | null;
}

export function extractLaborPlanningMetrics(
  version: EstimateDomainVersion | null,
): EstimateLaborPlanningMetrics {
  if (!version) {
    return { laborHours: 0, manDays: 0, crewDays: 0, durationDays: null };
  }

  let laborHours = 0;
  let manDays = 0;
  let crewDays = 0;
  let durationDays = 0;
  let hasDuration = false;

  for (const task of version.lineItems) {
    const metrics = parseMetrics(task);
    laborHours += safeEstimateNumber(metrics.adjustedLaborHours ?? metrics.laborHours);
    manDays += safeEstimateNumber(metrics.manDays);
    crewDays += safeEstimateNumber(metrics.crewDays);

    const duration = toFiniteNumber(metrics.durationDays);
    if (duration != null) {
      durationDays += duration;
      hasDuration = true;
    }
  }

  return {
    laborHours,
    manDays,
    crewDays,
    durationDays: hasDuration && durationDays > 0 ? durationDays : null,
  };
}

export interface EstimatePercentBreakdown {
  laborPercent: number | null;
  materialsPercent: number | null;
  equipmentPercent: number | null;
  subcontractorPercent: number | null;
  profitPercent: number | null;
}

/** Share of final sell price; returns null when denominator is zero or invalid. */
export function calculatePercentOfFinalPrice(part: number, finalSellPrice: number): number | null {
  if (!Number.isFinite(part) || !Number.isFinite(finalSellPrice) || finalSellPrice <= 0) {
    return null;
  }

  const percent = (part / finalSellPrice) * 100;
  return Number.isFinite(percent) ? percent : null;
}

export function buildPercentBreakdown(
  rollups: EstimateLineCostRollups,
  totals: EstimateCostTotals,
  finalSellPrice: number,
): EstimatePercentBreakdown {
  return {
    laborPercent: calculatePercentOfFinalPrice(rollups.labor, finalSellPrice),
    materialsPercent: calculatePercentOfFinalPrice(rollups.materials, finalSellPrice),
    equipmentPercent: calculatePercentOfFinalPrice(rollups.equipment, finalSellPrice),
    subcontractorPercent: calculatePercentOfFinalPrice(rollups.subcontractors, finalSellPrice),
    profitPercent: calculatePercentOfFinalPrice(safeEstimateNumber(totals.profit), finalSellPrice),
  };
}

export interface EstimateCostGroupReview {
  labor: number;
  materials: number;
  equipment: number;
  subcontractors: number;
  indirectCosts: number;
  directCost: number;
  overhead: number;
  profit: number;
  contingency: number;
  tax: number;
  finalSellPrice: number;
}

export interface EstimateTotalsReviewData {
  costGroups: EstimateCostGroupReview;
  laborMetrics: EstimateLaborPlanningMetrics;
  percentBreakdown: EstimatePercentBreakdown;
  hasTotals: boolean;
}

export function hasEstimateTotalsReview(version: EstimateDomainVersion | null): boolean {
  if (!version) return false;

  const rollups = rollupLineItemCosts(version);
  const totals = extractVersionTotals(version);
  const finalSellPrice = resolveFinalSellPrice(totals);

  if (finalSellPrice > 0) return true;

  const lineSum =
    rollups.labor + rollups.materials + rollups.equipment + rollups.subcontractors;
  if (lineSum > 0) return true;

  const totalsSum =
    totals.directCost +
    totals.indirectCost +
    totals.overhead +
    totals.profit +
    totals.contingency +
    totals.tax;

  return totalsSum > 0;
}

export function buildEstimateTotalsReview(
  version: EstimateDomainVersion | null,
): EstimateTotalsReviewData {
  const rollups = rollupLineItemCosts(version);
  const totals = extractVersionTotals(version);
  const finalSellPrice = resolveFinalSellPrice(totals);

  const costGroups: EstimateCostGroupReview = {
    labor: rollups.labor,
    materials: rollups.materials,
    equipment: rollups.equipment,
    subcontractors: rollups.subcontractors,
    indirectCosts: totals.indirectCost,
    directCost: totals.directCost,
    overhead: totals.overhead,
    profit: totals.profit,
    contingency: totals.contingency,
    tax: totals.tax,
    finalSellPrice,
  };

  return {
    costGroups,
    laborMetrics: extractLaborPlanningMetrics(version),
    percentBreakdown: buildPercentBreakdown(rollups, totals, finalSellPrice),
    hasTotals: hasEstimateTotalsReview(version),
  };
}
