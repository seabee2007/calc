import {
  calculateContingency,
  calculateDirectCost,
  calculateFinalSellPrice,
  calculateOverhead,
  calculateProfit,
  calculateTax,
  roundToTwo,
  sanitizeCost,
} from '../domain/estimateMath';
import type {
  ActivityEquipmentResource,
  ActivityMaterialResource,
  ProjectActivityLineItem,
  ProjectConstructionActivity,
} from '../domain/constructionActivityTypes';
import { calculateEstimateResourceCostBreakdown } from '../domain/constructionActivityCalculations';
import type { EstimateSettings } from '../domain/estimateTypes';
import {
  normalizeEstimateSettings,
  resolveOverheadBaseAmount,
  resolveProfitBaseAmount,
  resolveTaxBaseAmount,
} from './estimateSettings';

export interface ConstructionActivityEstimateTotalsInput {
  activities: readonly ProjectConstructionActivity[];
  markupSettings?: Partial<EstimateSettings> | null;
  lineItemsByActivityId?: ReadonlyMap<string, readonly ProjectActivityLineItem[]>;
  /** When provided, material/equipment totals come from saved resource rows (source of truth). */
  projectMaterialResources?: readonly ActivityMaterialResource[];
  projectEquipmentResources?: readonly ActivityEquipmentResource[];
}

export interface ConstructionActivityEstimateTotals {
  totalActivities: number;
  totalManHours: number;
  laborCost: number;
  materialCost: number;
  equipmentCost: number;
  subcontractorCost: number;
  indirectCost: number;
  directCostSubtotal: number;
  contingencyPercent: number;
  contingencyAmount: number;
  overheadPercent: number;
  overheadAmount: number;
  profitPercent: number;
  profitAmount: number;
  taxPercent: number;
  taxAmount: number;
  grandTotal: number;
}

function sumLineItemField(
  lineItems: readonly ProjectActivityLineItem[],
  pick: (item: ProjectActivityLineItem) => number,
): number {
  return lineItems.reduce((sum, item) => sum + pick(item), 0);
}

function resolveActivityDirectCosts(
  activity: ProjectConstructionActivity,
  lineItems: readonly ProjectActivityLineItem[] | undefined,
): {
  laborCost: number;
  materialCost: number;
  equipmentCost: number;
  subcontractorCost: number;
  totalManHours: number;
} {
  const lineItemLabor =
    lineItems && lineItems.length > 0
      ? sumLineItemField(lineItems, (item) => item.laborCost ?? 0)
      : 0;
  const lineItemMaterial =
    lineItems && lineItems.length > 0
      ? sumLineItemField(lineItems, (item) => item.materialCost ?? 0)
      : 0;
  const lineItemEquipment =
    lineItems && lineItems.length > 0
      ? sumLineItemField(lineItems, (item) => item.equipmentCost ?? 0)
      : 0;
  const lineItemSubcontractor =
    lineItems && lineItems.length > 0
      ? sumLineItemField(lineItems, (item) => item.subcontractCost ?? 0)
      : 0;
  const lineItemManHours =
    lineItems && lineItems.length > 0
      ? sumLineItemField(lineItems, (item) => item.calculatedManHours ?? 0)
      : 0;

  const laborCost =
    activity.totalLaborCost != null && Number.isFinite(activity.totalLaborCost)
      ? activity.totalLaborCost
      : lineItemLabor;
  const materialCost =
    activity.totalMaterialCost != null && Number.isFinite(activity.totalMaterialCost)
      ? activity.totalMaterialCost
      : lineItemMaterial;
  const equipmentCost =
    activity.totalEquipmentCost != null && Number.isFinite(activity.totalEquipmentCost)
      ? activity.totalEquipmentCost
      : lineItemEquipment;
  const subcontractorCost =
    activity.totalSubcontractCost != null && Number.isFinite(activity.totalSubcontractCost)
      ? activity.totalSubcontractCost
      : lineItemSubcontractor;
  const totalManHours =
    activity.calculatedManHours != null && Number.isFinite(activity.calculatedManHours)
      ? activity.calculatedManHours
      : lineItemManHours;

  return {
    laborCost: sanitizeCost(laborCost),
    materialCost: sanitizeCost(materialCost),
    equipmentCost: sanitizeCost(equipmentCost),
    subcontractorCost: sanitizeCost(subcontractorCost),
    totalManHours: roundToTwo(totalManHours),
  };
}

export function calculateEstimateTotalsFromConstructionActivities(
  input: ConstructionActivityEstimateTotalsInput,
): ConstructionActivityEstimateTotals {
  const settings = normalizeEstimateSettings(input.markupSettings);
  const { lineItemsByActivityId } = input;

  let laborCost = 0;
  let materialCost = 0;
  let equipmentCost = 0;
  let subcontractorCost = 0;
  let totalManHours = 0;

  for (const activity of input.activities) {
    const lineItems = lineItemsByActivityId?.get(activity.id);
    const costs = resolveActivityDirectCosts(activity, lineItems);
    laborCost = roundToTwo(laborCost + costs.laborCost);
    materialCost = roundToTwo(materialCost + costs.materialCost);
    equipmentCost = roundToTwo(equipmentCost + costs.equipmentCost);
    subcontractorCost = roundToTwo(subcontractorCost + costs.subcontractorCost);
    totalManHours = roundToTwo(totalManHours + costs.totalManHours);
  }

  const hasProjectResources =
    input.projectMaterialResources != null || input.projectEquipmentResources != null;

  if (hasProjectResources) {
    const resourceBreakdown = calculateEstimateResourceCostBreakdown({
      laborTotal: laborCost,
      materials: input.projectMaterialResources ?? [],
      equipment: input.projectEquipmentResources ?? [],
      subcontractorTotal: subcontractorCost,
    });
    laborCost = resourceBreakdown.laborTotal;
    materialCost = resourceBreakdown.materialTotal;
    equipmentCost = resourceBreakdown.equipmentTotal;
    subcontractorCost = resourceBreakdown.subcontractorTotal;
  }

  const directCostSubtotal = hasProjectResources
    ? roundToTwo(laborCost + materialCost + equipmentCost + subcontractorCost)
    : calculateDirectCost(laborCost, materialCost, equipmentCost, subcontractorCost);
  const indirectCost = calculateOverhead(directCostSubtotal, settings.indirectCostPercent);
  const overheadBaseAmount = resolveOverheadBaseAmount(settings, directCostSubtotal, laborCost);
  const overheadAmount = calculateOverhead(overheadBaseAmount, settings.overheadPercent);
  const profitBaseAmount = resolveProfitBaseAmount(
    settings,
    directCostSubtotal,
    indirectCost,
    overheadAmount,
  );
  const profitAmount = calculateProfit(profitBaseAmount, settings.profitPercent);
  const subtotalBeforeContingency = roundToTwo(
    directCostSubtotal + indirectCost + overheadAmount + profitAmount,
  );
  const contingencyAmount = calculateContingency(
    subtotalBeforeContingency,
    settings.contingencyPercent,
  );
  const subtotalBeforeTax = roundToTwo(subtotalBeforeContingency + contingencyAmount);
  const taxBaseAmount = resolveTaxBaseAmount(settings, materialCost, subtotalBeforeTax);
  const taxAmount =
    settings.taxBase === 'none' ? 0 : calculateTax(taxBaseAmount, settings.taxPercent);
  const grandTotal = calculateFinalSellPrice({
    directCost: directCostSubtotal,
    indirectCost,
    overhead: overheadAmount,
    profit: profitAmount,
    contingency: contingencyAmount,
    tax: taxAmount,
  });

  return {
    totalActivities: input.activities.length,
    totalManHours,
    laborCost,
    materialCost,
    equipmentCost,
    subcontractorCost,
    indirectCost,
    directCostSubtotal,
    contingencyPercent: settings.contingencyPercent,
    contingencyAmount,
    overheadPercent: settings.overheadPercent,
    overheadAmount,
    profitPercent: settings.profitPercent,
    profitAmount,
    taxPercent: settings.taxPercent,
    taxAmount,
    grandTotal,
  };
}
