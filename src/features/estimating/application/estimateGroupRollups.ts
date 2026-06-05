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
import type { EstimateDomainTask } from '../infrastructure/estimateDbTypes';
import type { EstimateDraftLine } from './estimateDraftLine';
import type { EstimateGroupRollup } from '../domain/estimateLineItemTree';
import { emptyGroupRollup } from '../domain/estimateLineItemTree';

export interface TaskRollupSlice {
  laborHours: number;
  manDays: number;
  crewDays: number;
  durationDays: number;
  directCost: number;
  materialCost: number;
  equipmentCost: number;
  subcontractorCost: number;
  indirectCost: number;
  sellPrice: number;
  scheduleEnabled: boolean;
  weatherSensitive: boolean;
  inspectionRequired: boolean;
}

function safeNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function parseMetrics(task: EstimateDomainTask): Record<string, unknown> {
  const raw = task.calculatedValues.metrics;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

function parseCosts(task: EstimateDomainTask): Record<string, unknown> {
  const raw = task.calculatedValues.costs;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

function indirectCostFromTask(task: EstimateDomainTask): number {
  const costs = parseCosts(task);
  return safeNumber(costs.indirectCost ?? costs.indirect_cost);
}

function sellPriceFromCalculatedCosts(task: EstimateDomainTask, directCost: number): number | null {
  const costs = parseCosts(task);
  const sell = safeNumber(costs.sellPrice ?? costs.sell_price ?? costs.finalSellPrice);
  return sell > 0 ? sell : null;
}

/** Per-task rollup slice using engine snapshot + stored calculated_values when present. */
export function computeTaskRollupSlice(
  task: EstimateDomainTask,
  indirectCostOverride?: number,
): TaskRollupSlice {
  const metrics = parseMetrics(task);
  const costs = parseCosts(task);

  const hasStoredMetrics =
    safeNumber(metrics.adjustedLaborHours ?? metrics.laborHours) > 0 ||
    safeNumber(costs.directCost) > 0;

  if (hasStoredMetrics) {
    const directCost = safeNumber(costs.directCost);
    const indirectCost =
      indirectCostOverride !== undefined
        ? safeNumber(indirectCostOverride)
        : indirectCostFromTask(task);
    const storedSell = sellPriceFromCalculatedCosts(task, directCost);

    return {
      laborHours: safeNumber(metrics.adjustedLaborHours ?? metrics.laborHours),
      manDays: safeNumber(metrics.manDays),
      crewDays: safeNumber(metrics.crewDays),
      durationDays: safeNumber(metrics.durationDays),
      directCost,
      materialCost: safeNumber(costs.materialCost ?? costs.material_cost),
      equipmentCost: safeNumber(costs.equipmentCost ?? costs.equipment_cost),
      subcontractorCost: safeNumber(costs.subcontractorCost ?? costs.subcontractor_cost),
      indirectCost,
      sellPrice: storedSell ?? directCost + indirectCost,
      scheduleEnabled: task.scheduleEnabled,
      weatherSensitive: task.weatherSensitive,
      inspectionRequired: task.inspectionRequired,
    };
  }

  const lineSnapshot = buildEstimateLineSnapshot(task.lineItem);
  const directCost = lineSnapshot.costs.directCost;
  const indirectCost = calculateIndirectCost(
    sanitizeCost(indirectCostOverride ?? indirectCostFromTask(task)),
  );
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
    directCost,
    materialCost: lineSnapshot.costs.materialCost,
    equipmentCost: lineSnapshot.costs.equipmentCost,
    subcontractorCost: lineSnapshot.costs.subcontractorCost,
    indirectCost,
    sellPrice,
    scheduleEnabled: task.scheduleEnabled,
    weatherSensitive: task.weatherSensitive,
    inspectionRequired: task.inspectionRequired,
  };
}

export function computeDraftLineRollupSlice(draft: EstimateDraftLine): TaskRollupSlice {
  return computeTaskRollupSlice(draft.task, draft.indirectCost);
}

function addSlice(target: EstimateGroupRollup, slice: TaskRollupSlice): void {
  target.itemCount += 1;
  target.laborHours = roundToTwo(target.laborHours + slice.laborHours);
  target.manDays = roundToTwo(target.manDays + slice.manDays);
  target.crewDays = roundToTwo(target.crewDays + slice.crewDays);
  target.durationDays = roundToTwo(target.durationDays + slice.durationDays);
  target.directCost = roundToTwo(target.directCost + slice.directCost);
  target.materialCost = roundToTwo(target.materialCost + slice.materialCost);
  target.equipmentCost = roundToTwo(target.equipmentCost + slice.equipmentCost);
  target.subcontractorCost = roundToTwo(target.subcontractorCost + slice.subcontractorCost);
  target.indirectCost = roundToTwo(target.indirectCost + slice.indirectCost);
  target.sellPrice = roundToTwo(target.sellPrice + slice.sellPrice);
  if (slice.scheduleEnabled) target.scheduleEnabledCount += 1;
  if (slice.weatherSensitive) target.weatherSensitiveCount += 1;
  if (slice.inspectionRequired) target.inspectionRequiredCount += 1;
}

export function rollupTaskSlices(slices: TaskRollupSlice[]): EstimateGroupRollup {
  const rollup = emptyGroupRollup();
  for (const slice of slices) {
    addSlice(rollup, slice);
  }
  return rollup;
}

export function rollupEstimateTasks(tasks: EstimateDomainTask[]): EstimateGroupRollup {
  const taskRows = tasks.filter((task) => task.lineType === 'task' || !task.lineType);
  return rollupTaskSlices(taskRows.map((task) => computeTaskRollupSlice(task)));
}

export function rollupEstimateDraftLines(drafts: EstimateDraftLine[]): EstimateGroupRollup {
  return rollupTaskSlices(drafts.map((draft) => computeDraftLineRollupSlice(draft)));
}
