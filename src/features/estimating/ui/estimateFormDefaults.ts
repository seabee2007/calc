import { buildEstimateLineSnapshot } from '../domain/estimateSnapshot';
import {
  calculateContingency,
  calculateFinalSellPrice,
  calculateIndirectCost,
  calculateOverhead,
  calculateProfit,
  calculateTax,
  roundToTwo,
  sanitizeCost,
} from '../domain/estimateMath';
import type { ProductionRateType } from '../domain/estimateTypes';
import type { EstimateDraftLine } from '../application/estimateDraftLine';

export const PRODUCTION_RATE_TYPE_OPTIONS: ReadonlyArray<{
  value: ProductionRateType;
  label: string;
}> = [
  { value: 'units_per_labor_hour', label: 'Units per labor hour' },
  { value: 'units_per_labor_day', label: 'Units per labor day' },
  { value: 'labor_hours_per_unit', label: 'Labor hours per unit' },
  { value: 'units_per_crew_day', label: 'Units per crew day' },
];

export interface DraftFormWarning {
  code: string;
  message: string;
}

export interface LinePreviewTotals {
  laborHours: number;
  manDays: number;
  crewDays: number;
  durationDays: number;
  laborCost: number;
  materialCost: number;
  equipmentCost: number;
  subcontractorCost: number;
  directCost: number;
  overhead: number;
  profit: number;
  contingency: number;
  tax: number;
  sellPrice: number;
}

export function parseEstimateFormNumber(value: string): number {
  if (value.trim() === '') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function collectDraftFormWarnings(draft: EstimateDraftLine): DraftFormWarning[] {
  const warnings: DraftFormWarning[] = [];
  const { task } = draft;
  const labor = task.lineItem.labor;

  if (!task.title?.trim()) {
    warnings.push({ code: 'missing_task_title', message: 'Task title is required.' });
  }

  const quantity = task.lineItem.quantity.quantity ?? 0;
  if (quantity <= 0) {
    warnings.push({ code: 'missing_line_quantity', message: 'Quantity is zero.' });
  }

  if (!labor?.productionRate || labor.productionRate <= 0) {
    warnings.push({ code: 'missing_production_rate', message: 'Production rate is missing.' });
  }

  if (!labor?.crewSize || labor.crewSize <= 0) {
    warnings.push({ code: 'missing_crew_size', message: 'Crew size is missing.' });
  }

  if (!labor?.hoursPerDay || labor.hoursPerDay <= 0) {
    warnings.push({ code: 'missing_hours_per_day', message: 'Hours per day is missing.' });
  }

  return warnings;
}

export interface DraftSummaryTotals {
  lineCount: number;
  laborHours: number;
  manDays: number;
  crewDays: number;
  sellPrice: number;
}

function safeTotal(value: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function computeDraftSummaryTotals(draftLines: EstimateDraftLine[]): DraftSummaryTotals {
  let laborHours = 0;
  let manDays = 0;
  let crewDays = 0;
  let sellPrice = 0;

  for (const draft of draftLines) {
    const totals = computeLinePreviewTotals(draft);
    laborHours += safeTotal(totals.laborHours);
    manDays += safeTotal(totals.manDays);
    crewDays += safeTotal(totals.crewDays);
    sellPrice += safeTotal(totals.sellPrice);
  }

  return {
    lineCount: draftLines.length,
    laborHours,
    manDays,
    crewDays,
    sellPrice,
  };
}

export function computeLinePreviewTotals(draft: EstimateDraftLine): LinePreviewTotals {
  const { task } = draft;
  const lineSnapshot = buildEstimateLineSnapshot(task.lineItem);
  const directCost = lineSnapshot.costs.directCost;
  const indirectCost = calculateIndirectCost(sanitizeCost(draft.indirectCost));
  const overhead = calculateOverhead(directCost, task.overheadPercent);
  const subtotalBeforeProfit = roundToTwo(directCost + indirectCost + overhead);
  const profit = calculateProfit(subtotalBeforeProfit, task.profitPercent);
  const subtotalBeforeContingency = roundToTwo(subtotalBeforeProfit + profit);
  const contingency = calculateContingency(subtotalBeforeContingency, task.contingencyPercent);
  const taxableAmount = roundToTwo(subtotalBeforeContingency + contingency);
  const tax = calculateTax(taxableAmount, task.taxPercent);
  const sellPrice = calculateFinalSellPrice({
    directCost,
    indirectCost,
    overhead,
    profit,
    contingency,
    tax,
  });

  return {
    laborHours: lineSnapshot.metrics.adjustedLaborHours,
    manDays: lineSnapshot.metrics.manDays,
    crewDays: lineSnapshot.metrics.crewDays,
    durationDays: lineSnapshot.metrics.durationDays,
    laborCost: lineSnapshot.costs.totalLaborCost,
    materialCost: lineSnapshot.costs.materialCost,
    equipmentCost: lineSnapshot.costs.equipmentCost,
    subcontractorCost: lineSnapshot.costs.subcontractorCost,
    directCost,
    overhead,
    profit,
    contingency,
    tax,
    sellPrice,
  };
}
