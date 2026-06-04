import type {
  EstimateCostTotals,
  EstimateLineItemInput,
  EstimateLineSnapshot,
  EstimatePricingInput,
  EstimateQuantityFormula,
  EstimateQuantityInput,
} from './estimateTypes';
import {
  calculateAdjustedLaborHours,
  calculateArea,
  calculateBaseLaborCost,
  calculateBurdenCost,
  calculateConcreteCubicYards,
  calculateContingency,
  calculateCrewDays,
  calculateDirectCost,
  calculateDurationDays,
  calculateEquipmentCost,
  calculateFinalSellPrice,
  calculateIndirectCost,
  calculateLaborHours,
  calculateManDays,
  calculateMaterialCost,
  calculateMaterialCoverageUnits,
  calculateNetWallArea,
  calculateOverhead,
  calculateProfit,
  calculateQuantityWithWaste,
  calculateSubcontractorCost,
  calculateTax,
  calculateTotalLaborCost,
  calculateVolumeCubicFeet,
  calculateWallArea,
  clampPercent,
  roundToTwo,
  sanitizeCost,
  sanitizeNonNegative,
} from './estimateMath';

export const DEFAULT_ESTIMATE_PRICING: Required<EstimatePricingInput> = {
  indirectCost: 0,
  overheadPercent: 0,
  profitPercent: 0,
  contingencyPercent: 0,
  taxPercent: 0,
};

function resolveFormula(line: EstimateLineItemInput): EstimateQuantityFormula {
  return line.quantity.formula ?? 'quantity_with_waste';
}

function baseQuantityFromFormula(
  quantity: EstimateQuantityInput,
  formula: EstimateQuantityFormula,
): number {
  const dims = quantity.dimensions;
  const length = sanitizeNonNegative(dims?.length ?? 0);
  const width = sanitizeNonNegative(dims?.width ?? 0);
  const height = sanitizeNonNegative(dims?.height ?? 0);
  const explicitQuantity = sanitizeNonNegative(quantity.quantity ?? 0);
  const openingArea = sanitizeNonNegative(quantity.openingArea ?? 0);
  const coveragePerUnit = sanitizeNonNegative(quantity.coveragePerUnit ?? 0);

  switch (formula) {
    case 'area':
      return calculateArea(length, width);
    case 'wall_area':
      return calculateWallArea(length, height);
    case 'net_wall_area': {
      const grossArea =
        length > 0 && height > 0 ? calculateWallArea(length, height) : explicitQuantity;
      return calculateNetWallArea(grossArea, openingArea);
    }
    case 'volume_cubic_feet':
      return calculateVolumeCubicFeet(length, width, height);
    case 'concrete_cubic_yards': {
      const cubicFeet =
        length > 0 && width > 0 && height > 0
          ? calculateVolumeCubicFeet(length, width, height)
          : explicitQuantity;
      return calculateConcreteCubicYards(cubicFeet);
    }
    case 'material_coverage_units':
      return calculateMaterialCoverageUnits(explicitQuantity, coveragePerUnit);
    case 'quantity_with_waste':
      return roundToTwo(explicitQuantity);
    default:
      return 0;
  }
}

export function normalizeEstimatePricingInput(
  pricing?: EstimatePricingInput,
): Required<EstimatePricingInput> {
  return {
    indirectCost: sanitizeCost(pricing?.indirectCost ?? 0),
    overheadPercent: clampPercent(pricing?.overheadPercent ?? 0),
    profitPercent: clampPercent(pricing?.profitPercent ?? 0),
    contingencyPercent: clampPercent(pricing?.contingencyPercent ?? 0),
    taxPercent: clampPercent(pricing?.taxPercent ?? 0),
  };
}

export function buildEstimateLineSnapshot(line: EstimateLineItemInput): EstimateLineSnapshot {
  const quantityFormula = resolveFormula(line);
  const baseQuantity = baseQuantityFromFormula(line.quantity, quantityFormula);
  const wastePercent = clampPercent(line.quantity.wastePercent ?? 0);
  const quantityWithWaste = calculateQuantityWithWaste(baseQuantity, wastePercent);

  const laborRateType = line.labor?.productionRateType ?? 'units_per_labor_hour';
  const laborHours = line.labor
    ? calculateLaborHours(quantityWithWaste, line.labor.productionRate ?? 0, laborRateType, {
        hoursPerDay: line.labor.hoursPerDay,
        crewSize: line.labor.crewSize,
      })
    : 0;

  const adjustedLaborHours = line.labor
    ? calculateAdjustedLaborHours(
        laborHours,
        line.labor.difficultyFactor ?? 1,
        line.labor.locationFactor ?? 1,
      )
    : 0;

  const manDays = calculateManDays(adjustedLaborHours, line.labor?.hoursPerDay ?? 8);
  const crewDays = calculateCrewDays(
    adjustedLaborHours,
    line.labor?.crewSize ?? 1,
    line.labor?.hoursPerDay ?? 8,
  );
  const durationDays = calculateDurationDays(crewDays, line.labor?.parallelCrews ?? 1);

  const baseLaborCost = calculateBaseLaborCost(adjustedLaborHours, line.labor?.laborRate ?? 0);
  const burdenCost = calculateBurdenCost(baseLaborCost, line.labor?.burdenPercent ?? 0);
  const totalLaborCost = calculateTotalLaborCost(baseLaborCost, burdenCost);

  const materialCost = calculateMaterialCost(quantityWithWaste, line.material?.unitCost ?? 0);
  const equipmentUsageUnits = line.equipment?.usageUnits ?? durationDays;
  const equipmentCost = line.equipment
    ? calculateEquipmentCost(
        line.equipment.rate ?? 0,
        line.equipment.rateType ?? 'lump_sum',
        equipmentUsageUnits,
      )
    : 0;
  const subcontractorCost = calculateSubcontractorCost(line.subcontractor?.cost ?? 0);

  const directCost = calculateDirectCost(
    totalLaborCost,
    materialCost,
    equipmentCost,
    subcontractorCost,
  );

  return {
    id: line.id,
    description: line.description,
    csiDivision: line.csiDivision,
    csiSection: line.csiSection,
    quantityFormula,
    metrics: {
      baseQuantity,
      quantityWithWaste,
      laborHours,
      adjustedLaborHours,
      manDays,
      crewDays,
      durationDays,
    },
    costs: {
      baseLaborCost,
      burdenCost,
      totalLaborCost,
      materialCost,
      equipmentCost,
      subcontractorCost,
      directCost,
    },
  };
}

export function buildEstimateTotals(
  lineItems: EstimateLineSnapshot[],
  pricing?: EstimatePricingInput,
): EstimateCostTotals {
  const normalizedPricing = normalizeEstimatePricingInput(pricing);

  const directCost = roundToTwo(
    lineItems.reduce((sum, line) => sum + line.costs.directCost, 0),
  );
  const indirectCost = calculateIndirectCost(normalizedPricing.indirectCost);
  const overhead = calculateOverhead(directCost, normalizedPricing.overheadPercent);
  const subtotalBeforeProfit = roundToTwo(directCost + indirectCost + overhead);
  const profit = calculateProfit(subtotalBeforeProfit, normalizedPricing.profitPercent);
  const subtotalBeforeContingency = roundToTwo(subtotalBeforeProfit + profit);
  const contingency = calculateContingency(
    subtotalBeforeContingency,
    normalizedPricing.contingencyPercent,
  );
  const taxableAmount = roundToTwo(subtotalBeforeContingency + contingency);
  const tax = calculateTax(taxableAmount, normalizedPricing.taxPercent);
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

