import type { CostPerUnitInput, CostPerUnitOutput } from '../constructionCalculatorTypes';
import { sanitizeFinite, sanitizeNonNegative } from '../constructionCalculatorValidators';

export function calculateCostPerUnit(input: CostPerUnitInput): CostPerUnitOutput {
  const quantity = sanitizeNonNegative(input.quantity);
  const unitCost = sanitizeNonNegative(input.unitCost);
  const totalCost = sanitizeFinite(quantity * unitCost);
  return { totalCost: Math.round(totalCost * 100) / 100 };
}
