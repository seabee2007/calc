import type { EstimateDomainTask, EstimateDomainVersion } from '../infrastructure/estimateDbTypes';
import type { EstimateLineCosts, EstimateLineMetrics, EstimateType } from '../domain/estimateTypes';

export const ESTIMATE_BLANK = '—';

/** Safe empty JSON payloads for new draft estimate versions. */
export const EMPTY_ESTIMATE_SNAPSHOT_JSON: Record<string, unknown> = {};
export const EMPTY_ESTIMATE_TOTALS_JSON: Record<string, unknown> = {};

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function formatEstimateTypeLabel(type: EstimateType): string {
  return type.replace(/_/g, ' ');
}

export function formatEstimateBlank(value: string | null | undefined): string {
  if (value == null) return ESTIMATE_BLANK;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : ESTIMATE_BLANK;
}

export function formatEstimateNumber(
  value: unknown,
  options?: { decimals?: number; suffix?: string },
): string {
  const num = toFiniteNumber(value);
  if (num == null) return ESTIMATE_BLANK;
  const decimals = options?.decimals ?? 2;
  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return options?.suffix ? `${formatted}${options.suffix}` : formatted;
}

export function formatEstimateCurrency(value: unknown): string {
  const num = toFiniteNumber(value);
  if (num == null) return ESTIMATE_BLANK;
  return num.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatEstimateHours(value: unknown): string {
  const num = toFiniteNumber(value);
  if (num == null) return ESTIMATE_BLANK;
  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${formatted} hr`;
}

export function formatEstimatePercent(value: unknown): string {
  const num = toFiniteNumber(value);
  if (num == null) return ESTIMATE_BLANK;
  return `${formatEstimateNumber(num, { decimals: 1 })}%`;
}

function parseMetrics(task: EstimateDomainTask): Partial<EstimateLineMetrics> {
  const raw = task.calculatedValues.metrics;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as Partial<EstimateLineMetrics>;
}

function parseCosts(task: EstimateDomainTask): Partial<EstimateLineCosts> {
  const raw = task.calculatedValues.costs;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as Partial<EstimateLineCosts>;
}

export function laborHoursFromTask(task: EstimateDomainTask): number | null {
  const metrics = parseMetrics(task);
  return toFiniteNumber(metrics.adjustedLaborHours ?? metrics.laborHours);
}

export function lineDirectCostFromTask(task: EstimateDomainTask): number | null {
  const costs = parseCosts(task);
  const direct = toFiniteNumber(costs.directCost);
  if (direct != null) return direct;
  const material = toFiniteNumber(costs.materialCost) ?? 0;
  const equipment = toFiniteNumber(costs.equipmentCost) ?? 0;
  const labor = toFiniteNumber(costs.totalLaborCost) ?? 0;
  const sub = toFiniteNumber(costs.subcontractorCost) ?? 0;
  const sum = material + equipment + labor + sub;
  return sum > 0 ? sum : null;
}

export function unitFromTask(task: EstimateDomainTask): string | undefined {
  const raw = task.calculatedValues.unit;
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  const quantityInput = task.calculatedValues.quantityInput;
  if (quantityInput && typeof quantityInput === 'object' && !Array.isArray(quantityInput)) {
    const unit = (quantityInput as Record<string, unknown>).unit;
    if (typeof unit === 'string' && unit.trim()) return unit.trim();
  }
  return undefined;
}

export interface EstimateWorkspaceSummaryValues {
  totalEstimate: string;
  laborHours: string;
  manDays: string;
  crewDays: string;
  materialCost: string;
  equipmentCost: string;
  profit: string;
}

export function buildWorkspaceSummaryValues(
  version: EstimateDomainVersion | null,
): EstimateWorkspaceSummaryValues {
  if (!version) {
    return {
      totalEstimate: ESTIMATE_BLANK,
      laborHours: ESTIMATE_BLANK,
      manDays: ESTIMATE_BLANK,
      crewDays: ESTIMATE_BLANK,
      materialCost: ESTIMATE_BLANK,
      equipmentCost: ESTIMATE_BLANK,
      profit: ESTIMATE_BLANK,
    };
  }

  let laborHours = 0;
  let manDays = 0;
  let crewDays = 0;
  let materialCost = 0;
  let equipmentCost = 0;

  for (const task of version.lineItems) {
    const metrics = parseMetrics(task);
    laborHours += toFiniteNumber(metrics.adjustedLaborHours ?? metrics.laborHours) ?? 0;
    manDays += toFiniteNumber(metrics.manDays) ?? 0;
    crewDays += toFiniteNumber(metrics.crewDays) ?? 0;
    const costs = parseCosts(task);
    materialCost += toFiniteNumber(costs.materialCost) ?? 0;
    equipmentCost += toFiniteNumber(costs.equipmentCost) ?? 0;
  }

  const totals = version.totals;
  const totalEstimate =
    toFiniteNumber(totals.finalSellPrice) ??
    toFiniteNumber(totals.directCost) ??
    null;

  return {
    totalEstimate: formatEstimateCurrency(totalEstimate),
    laborHours: laborHours > 0 ? formatEstimateHours(laborHours) : ESTIMATE_BLANK,
    manDays: manDays > 0 ? formatEstimateNumber(manDays, { decimals: 2 }) : ESTIMATE_BLANK,
    crewDays: crewDays > 0 ? formatEstimateNumber(crewDays, { decimals: 2 }) : ESTIMATE_BLANK,
    materialCost:
      materialCost > 0 ? formatEstimateCurrency(materialCost) : ESTIMATE_BLANK,
    equipmentCost:
      equipmentCost > 0 ? formatEstimateCurrency(equipmentCost) : ESTIMATE_BLANK,
    profit:
      toFiniteNumber(totals.profit) != null
        ? formatEstimateCurrency(totals.profit)
        : ESTIMATE_BLANK,
  };
}
