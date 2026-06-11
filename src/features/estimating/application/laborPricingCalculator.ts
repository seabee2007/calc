import { roundToTwo } from '../domain/estimateMath';
import type { ProjectActivityLineItem } from '../domain/constructionActivityTypes';
import type { ProjectLaborRate } from '../domain/laborRateTypes';

function recomputeLineItemTotalCost(item: ProjectActivityLineItem): number {
  return roundToTwo(
    (item.laborCost ?? 0) +
      (item.materialCost ?? 0) +
      (item.equipmentCost ?? 0) +
      (item.subcontractCost ?? 0),
  );
}

/** Apply a project labor rate snapshot to a line item and recompute labor cost. */
export function applyLaborRateToLineItem(
  item: ProjectActivityLineItem,
  rate: ProjectLaborRate,
): ProjectActivityLineItem {
  const fullyBurdenedRate = rate.fullyBurdenedRate;
  const laborCost = roundToTwo(item.calculatedManHours * fullyBurdenedRate);
  const next: ProjectActivityLineItem = {
    ...item,
    laborRoleId: rate.id,
    laborRoleKey: rate.roleKey,
    laborRoleName: rate.roleName,
    tradeCategory: rate.tradeCategory,
    hourlyRateSnapshot: rate.hourlyRate,
    burdenPercentSnapshot: rate.burdenPercent,
    fullyBurdenedRateSnapshot: fullyBurdenedRate,
    billingRateSnapshot: rate.billingRate,
    pricingSource: 'project_rate',
    pricingSnapshotAt: new Date().toISOString(),
    laborCost,
  };
  return {
    ...next,
    totalCost: recomputeLineItemTotalCost(next),
  };
}

/** Apply manual hourly/burden edits without changing the linked role id. */
export function applyManualLaborPricingToLineItem(
  item: ProjectActivityLineItem,
  hourlyRate: number,
  burdenPercent: number,
  billingRate?: number,
): ProjectActivityLineItem {
  const safeHourly = Number.isFinite(hourlyRate) && hourlyRate >= 0 ? hourlyRate : 0;
  const safeBurden = Number.isFinite(burdenPercent) && burdenPercent >= 0 ? burdenPercent : 0;
  const fullyBurdenedRate = Math.round(safeHourly * (1 + safeBurden / 100) * 10000) / 10000;
  const laborCost = roundToTwo(item.calculatedManHours * fullyBurdenedRate);
  const next: ProjectActivityLineItem = {
    ...item,
    hourlyRateSnapshot: safeHourly,
    burdenPercentSnapshot: safeBurden,
    fullyBurdenedRateSnapshot: fullyBurdenedRate,
    billingRateSnapshot:
      billingRate != null && Number.isFinite(billingRate) ? billingRate : item.billingRateSnapshot,
    pricingSource: 'manual',
    pricingSnapshotAt: new Date().toISOString(),
    laborCost,
  };
  return {
    ...next,
    totalCost: recomputeLineItemTotalCost(next),
  };
}

/** Recalculate labor costs for all line items using a fresh project rate snapshot. */
export function recalculateActivityLaborCosts(
  lineItems: ProjectActivityLineItem[],
  rate: ProjectLaborRate,
  lineItemIds?: Set<string>,
): ProjectActivityLineItem[] {
  return lineItems.map((item) => {
    if (lineItemIds && !lineItemIds.has(item.id)) {
      return item;
    }
    if (item.laborRoleKey && item.laborRoleKey !== rate.roleKey) {
      return item;
    }
    return applyLaborRateToLineItem(item, rate);
  });
}

export function findDefaultProjectLaborRate(
  rates: readonly ProjectLaborRate[],
): ProjectLaborRate | undefined {
  const active = rates.filter((rate) => rate.isActive);
  return active.find((rate) => rate.isDefault) ?? active[0];
}

export function findFirstActiveProjectLaborRate(
  rates: readonly ProjectLaborRate[],
): ProjectLaborRate | undefined {
  return rates.find((rate) => rate.isActive);
}
