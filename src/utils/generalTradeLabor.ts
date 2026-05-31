import type {
  GeneralTradeLaborInput,
  GeneralTradeLaborResult,
} from '../types/generalTradeLabor';

export function validateGeneralTradeLaborInput(
  input: GeneralTradeLaborInput,
): string[] {
  const errors: string[] = [];

  if (input.quantity <= 0) errors.push('Quantity must be greater than 0');
  if (input.productionRate <= 0) errors.push('Production rate must be greater than 0');
  if (input.crewSize <= 0) errors.push('Crew size must be greater than 0');
  if (input.hoursPerDay <= 0) errors.push('Hours per day must be greater than 0');
  if (input.laborRate < 0) errors.push('Labor rate cannot be negative');
  if (input.burdenPercent < 0) errors.push('Burden % cannot be negative');
  if (input.overheadPercent < 0) errors.push('Overhead % cannot be negative');
  if (input.profitPercent < 0) errors.push('Profit % cannot be negative');
  if (input.difficultyFactor === 0) errors.push('Difficulty factor cannot be 0');
  if (input.locationFactor === 0) errors.push('Location factor cannot be 0');

  return errors;
}

export function calculateGeneralTradeLabor(
  input: GeneralTradeLaborInput,
): GeneralTradeLaborResult {
  const {
    quantity,
    productionRate,
    productionRateType,
    hoursPerDay,
    crewSize,
    laborRate,
    burdenPercent,
    overheadPercent,
    profitPercent,
    difficultyFactor,
    locationFactor,
  } = input;

  let baseLaborHours = 0;

  if (productionRateType === 'laborHoursPerUnit') {
    baseLaborHours = quantity * productionRate;
  } else {
    const productionRatePerHour =
      productionRateType === 'unitsPerLaborDay'
        ? productionRate / hoursPerDay
        : productionRate;

    baseLaborHours = quantity / productionRatePerHour;
  }

  const adjustedLaborHours =
    baseLaborHours * difficultyFactor * locationFactor;

  const baseLaborCost = adjustedLaborHours * laborRate;
  const burdenCost = baseLaborCost * (burdenPercent / 100);
  const subtotalLaborCost = baseLaborCost + burdenCost;
  const overhead = subtotalLaborCost * (overheadPercent / 100);
  const profit = (subtotalLaborCost + overhead) * (profitPercent / 100);
  const totalLaborPrice = subtotalLaborCost + overhead + profit;

  const crewDays = adjustedLaborHours / (crewSize * hoursPerDay);
  const costPerUnit = totalLaborPrice / quantity;
  const laborHoursPerUnit = adjustedLaborHours / quantity;

  return {
    baseLaborHours,
    adjustedLaborHours,
    baseLaborCost,
    burdenCost,
    subtotalLaborCost,
    overhead,
    profit,
    totalLaborPrice,
    crewDays,
    costPerUnit,
    laborHoursPerUnit,
  };
}
