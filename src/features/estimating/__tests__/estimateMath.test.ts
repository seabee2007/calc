import { describe, expect, it } from 'vitest';
import {
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
} from '../domain/estimateMath';

describe('estimateMath geometry and quantity formulas', () => {
  it('calculates area, wall area, net wall area, volume, cubic yards, and quantity with waste', () => {
    expect(calculateArea(12, 5)).toBe(60);
    expect(calculateWallArea(10, 8)).toBe(80);
    expect(calculateNetWallArea(120, 20)).toBe(100);
    expect(calculateVolumeCubicFeet(10, 5, 0.5)).toBe(25);
    expect(calculateConcreteCubicYards(54)).toBe(2);
    expect(calculateQuantityWithWaste(200, 10)).toBe(220);
  });
});

describe('estimateMath labor formulas', () => {
  it('calculates labor hours for all supported production rate types', () => {
    expect(calculateLaborHours(100, 20, 'units_per_labor_hour')).toBe(5);
    expect(calculateLaborHours(100, 10, 'units_per_labor_day', { hoursPerDay: 8 })).toBe(80);
    expect(calculateLaborHours(100, 0.5, 'labor_hours_per_unit')).toBe(50);
    expect(calculateLaborHours(100, 25, 'units_per_crew_day', { crewSize: 4, hoursPerDay: 8 })).toBe(
      128,
    );
  });

  it('calculates man-days, crew-days, and duration days', () => {
    expect(calculateManDays(80, 8)).toBe(10);
    expect(calculateCrewDays(80, 4, 8)).toBe(2.5);
    expect(calculateDurationDays(2.5)).toBe(3);
    expect(calculateDurationDays(5, 2)).toBe(3);
  });
});

describe('estimateMath cost formulas', () => {
  it('calculates labor, burden, material with waste and tax, equipment, subcontractor, and direct cost', () => {
    const baseLaborCost = calculateBaseLaborCost(10, 50);
    const burdenCost = calculateBurdenCost(baseLaborCost, 25);
    const totalLaborCost = calculateTotalLaborCost(baseLaborCost, burdenCost);
    const quantityWithWaste = calculateQuantityWithWaste(200, 10);
    const materialCost = calculateMaterialCost(quantityWithWaste, 4);
    const materialTax = calculateTax(materialCost, 8);
    const equipmentCost = calculateEquipmentCost(75, 'hour', 8);
    const subcontractorCost = calculateSubcontractorCost(1000);
    const subcontractorMarkup = calculateProfit(subcontractorCost, 10);
    const directCost = calculateDirectCost(totalLaborCost, materialCost, equipmentCost, subcontractorCost);

    expect(baseLaborCost).toBe(500);
    expect(burdenCost).toBe(125);
    expect(totalLaborCost).toBe(625);
    expect(materialCost).toBe(880);
    expect(materialTax).toBe(70.4);
    expect(equipmentCost).toBe(600);
    expect(subcontractorCost).toBe(1000);
    expect(roundToTwo(subcontractorCost + subcontractorMarkup)).toBe(1100);
    expect(directCost).toBe(3105);
  });

  it('calculates overhead, profit, contingency, tax, and final sell price', () => {
    const directCost = 3105;
    const indirectCost = calculateIndirectCost(200);
    const overhead = calculateOverhead(directCost, 10);
    const subtotalBeforeProfit = roundToTwo(directCost + indirectCost + overhead);
    const profit = calculateProfit(subtotalBeforeProfit, 5);
    const subtotalBeforeContingency = roundToTwo(subtotalBeforeProfit + profit);
    const contingency = calculateContingency(subtotalBeforeContingency, 2);
    const taxableAmount = roundToTwo(subtotalBeforeContingency + contingency);
    const tax = calculateTax(taxableAmount, 8);
    const finalSellPrice = calculateFinalSellPrice({
      directCost,
      indirectCost,
      overhead,
      profit,
      contingency,
      tax,
    });

    expect(overhead).toBe(310.5);
    expect(profit).toBe(180.78);
    expect(contingency).toBe(75.93);
    expect(tax).toBe(309.78);
    expect(finalSellPrice).toBe(4181.99);
  });
});

describe('estimateMath normalization safety', () => {
  it('clamps percent inputs and normalizes invalid negatives', () => {
    expect(clampPercent(-25)).toBe(0);
    expect(clampPercent(250)).toBe(100);
    expect(calculateQuantityWithWaste(100, -25)).toBe(100);
    expect(calculateQuantityWithWaste(100, 250)).toBe(200);
    expect(calculateMaterialCost(-10, 5)).toBe(0);
    expect(calculateEquipmentCost(-100, 'day', 2)).toBe(0);
    expect(calculateSubcontractorCost(-500)).toBe(0);
  });

  it('never returns NaN or Infinity for non-finite inputs', () => {
    const results = [
      calculateArea(Number.NaN, 10),
      calculateWallArea(10, Number.POSITIVE_INFINITY),
      calculateVolumeCubicFeet(10, 5, Number.POSITIVE_INFINITY),
      calculateConcreteCubicYards(Number.POSITIVE_INFINITY),
      calculateQuantityWithWaste(100, Number.POSITIVE_INFINITY),
      calculateLaborHours(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, 'units_per_labor_hour'),
      calculateManDays(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY),
      calculateCrewDays(Number.POSITIVE_INFINITY, 0, 0),
      calculateDurationDays(Number.POSITIVE_INFINITY, 0),
      calculateBaseLaborCost(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY),
      calculateTax(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY),
      calculateFinalSellPrice({
        directCost: Number.POSITIVE_INFINITY,
        indirectCost: Number.POSITIVE_INFINITY,
        overhead: Number.POSITIVE_INFINITY,
        profit: Number.POSITIVE_INFINITY,
        contingency: Number.POSITIVE_INFINITY,
        tax: Number.POSITIVE_INFINITY,
      }),
    ];

    for (const value of results) {
      expect(Number.isFinite(value)).toBe(true);
      expect(Number.isNaN(value)).toBe(false);
    }
  });
});
