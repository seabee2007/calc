import { describe, expect, it } from 'vitest';
import { buildEstimateDraftSnapshot } from '../application/buildEstimateDraftSnapshot';
import type { EstimateDraftLine } from '../application/estimateDraftLine';
import {
  CONCRETE_CSI_DIVISION,
  CONCRETE_CSI_SECTION,
  CONCRETE_SCOPE_NAME,
  adaptConcreteCalculationToDraftLines,
  adaptCalculationToDraftLines,
} from '../adapters/fromConcreteCalculation';

function collectNumericValues(draftLines: EstimateDraftLine[]): number[] {
  const values: number[] = [];
  for (const draft of draftLines) {
    const { task } = draft;
    values.push(
      draft.indirectCost,
      task.lineItem.quantity.quantity,
      task.lineItem.quantity.wastePercent,
      task.lineItem.material.unitCost,
      task.lineItem.labor.productionRate,
      task.lineItem.labor.laborRate,
      task.lineItem.labor.crewSize,
      task.lineItem.labor.hoursPerDay,
      task.lineItem.equipment.rate,
    );
  }
  return values;
}

describe('fromConcreteCalculation', () => {
  it('converts concrete volume to a ready-mix estimate line', () => {
    const { draftLines } = adaptConcreteCalculationToDraftLines({
      label: 'Main slab',
      volumeCubicYards: 12.5,
      wastePercent: 10,
      pricePerYard: 145,
      areaSqFt: 1350,
      placementProductionRate: 8,
      placementLaborRate: 42,
      finishingProductionRate: 250,
      finishingLaborRate: 48,
    });

    const readyMix = draftLines.find((line) => line.task.title.includes('ready-mix'));
    expect(readyMix).toBeDefined();
    expect(readyMix?.task.lineItem.quantity.quantity).toBe(12.5);
    expect(readyMix?.unit).toBe('CY');
    expect(readyMix?.task.lineItem.material.unitCost).toBe(145);
    expect(readyMix?.task.scopeName).toBe(CONCRETE_SCOPE_NAME);
    expect(readyMix?.task.lineItem.csiDivision).toBe(CONCRETE_CSI_DIVISION);
    expect(readyMix?.task.lineItem.csiSection).toBe(CONCRETE_CSI_SECTION);
  });

  it('preserves waste factor on quantity lines', () => {
    const { draftLines } = adaptConcreteCalculationToDraftLines({
      volumeCubicYards: 20,
      wastePercent: 12.5,
      areaSqFt: 2000,
      placementProductionRate: 5,
      placementLaborRate: 40,
    });

    const materialLine = draftLines[0];
    expect(materialLine.task.lineItem.quantity.wastePercent).toBe(12.5);
    expect(materialLine.task.lineItem.quantity.quantity).toBe(20);
  });

  it('adds a warning when placement production rate is missing', () => {
    const { warnings } = adaptConcreteCalculationToDraftLines({
      volumeCubicYards: 10,
      areaSqFt: 1000,
      placementLaborRate: 45,
    });

    expect(warnings.some((w) => w.includes('Placement labor') && w.includes('production rate'))).toBe(
      true,
    );
  });

  it('maps saved calculation records into draft lines', () => {
    const { draftLines } = adaptCalculationToDraftLines(
      {
        type: 'slab',
        dimensions: { length: 40, width: 30, thickness: 0.33 },
        result: {
          volume: 14.8,
          bags: 0,
          pricing: {
            concreteCost: 2146,
            pricePerYard: 145,
            deliveryFees: {
              baseDeliveryFee: 0,
              smallLoadFee: 0,
              distanceFee: 0,
              totalDeliveryFees: 0,
            },
            additionalServices: {
              pumpTruckFee: 650,
              saturdayFee: 0,
              afterHoursFee: 0,
              totalAdditionalFees: 650,
            },
            totalCost: 2796,
          },
        },
        psi: '4000',
      },
      {
        placementProductionRate: 6,
        placementLaborRate: 42,
        finishingProductionRate: 200,
        finishingLaborRate: 50,
      },
    );

    expect(draftLines.length).toBeGreaterThanOrEqual(4);
    expect(draftLines.some((line) => line.task.title.includes('pump'))).toBe(true);
  });

  it('output draft lines can be passed into buildEstimateDraftSnapshot without crashing', () => {
    const { draftLines } = adaptConcreteCalculationToDraftLines({
      volumeCubicYards: 8,
      wastePercent: 5,
      areaSqFt: 864,
      pricePerYard: 140,
      placementProductionRate: 7,
      placementLaborRate: 40,
      finishingProductionRate: 180,
      finishingLaborRate: 45,
    });

    const snapshot = buildEstimateDraftSnapshot({
      estimateId: 'est-adapter-001',
      projectId: 'proj-adapter-001',
      versionNumber: 1,
      draftLines,
    });

    expect(snapshot.lineItems.length).toBe(draftLines.length);
    expect(snapshot.totals.directCost).toBeGreaterThanOrEqual(0);
  });

  it('never produces NaN or Infinity values', () => {
    const { draftLines } = adaptConcreteCalculationToDraftLines({
      volumeCubicYards: Number.NaN,
      wastePercent: Number.POSITIVE_INFINITY,
      areaSqFt: undefined,
      pricePerYard: 'bad' as unknown as number,
      placementProductionRate: undefined,
      placementLaborRate: undefined,
    });

    for (const value of collectNumericValues(draftLines)) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });
});
