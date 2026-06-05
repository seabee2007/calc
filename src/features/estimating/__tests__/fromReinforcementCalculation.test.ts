import { describe, expect, it } from 'vitest';
import { buildEstimateDraftSnapshot } from '../application/buildEstimateDraftSnapshot';
import type { EstimateDraftLine } from '../application/estimateDraftLine';
import {
  REINFORCEMENT_CSI_DIVISION,
  REINFORCEMENT_CSI_SECTION,
  REINFORCEMENT_SCOPE_NAME,
  adaptReinforcementCalculationToDraftLines,
  adaptReinforcementSetToDraftLines,
} from '../adapters/fromReinforcementCalculation';

function collectNumericValues(draftLines: EstimateDraftLine[]): number[] {
  const values: number[] = [];
  for (const draft of draftLines) {
    values.push(
      draft.indirectCost,
      draft.task.lineItem.quantity.quantity,
      draft.task.lineItem.material.unitCost,
      draft.task.lineItem.labor.productionRate,
      draft.task.lineItem.labor.laborRate,
    );
  }
  return values;
}

describe('fromReinforcementCalculation', () => {
  it('maps reinforcement data to Division 03 / 03 20 00', () => {
    const { draftLines } = adaptReinforcementCalculationToDraftLines({
      label: 'Slab rebar',
      reinforcementType: 'rebar',
      totalLinearFt: 2400,
      totalBars: 180,
      barSize: '4',
      materialUnitCost: 0.85,
      installationProductionRate: 120,
      installationLaborRate: 48,
    });

    expect(draftLines.length).toBe(2);
    for (const line of draftLines) {
      expect(line.task.lineItem.csiDivision).toBe(REINFORCEMENT_CSI_DIVISION);
      expect(line.task.lineItem.csiSection).toBe(REINFORCEMENT_CSI_SECTION);
      expect(line.task.scopeName).toBe(REINFORCEMENT_SCOPE_NAME);
    }

    expect(draftLines[0].task.title).toContain('material');
    expect(draftLines[0].task.lineItem.quantity.quantity).toBe(2400);
    expect(draftLines[0].unit).toBe('LF');
  });

  it('creates wire mesh and fiber lines when data exists', () => {
    const mesh = adaptReinforcementCalculationToDraftLines({
      reinforcementType: 'mesh',
      meshSheets: 24,
      meshSheetSize: '5x10',
      meshUnitCost: 42,
      installationProductionRate: 8,
      installationLaborRate: 45,
    });

    expect(mesh.draftLines.some((line) => line.task.title.includes('wire mesh'))).toBe(true);

    const fiber = adaptReinforcementCalculationToDraftLines({
      reinforcementType: 'fiber',
      fiberTotalLb: 48,
      fiberType: 'Macro synthetic',
      materialUnitCost: 1.2,
    });

    expect(fiber.draftLines).toHaveLength(1);
    expect(fiber.draftLines[0].unit).toBe('LB');
  });

  it('adds warnings when installation production rate is missing', () => {
    const { warnings } = adaptReinforcementCalculationToDraftLines({
      reinforcementType: 'rebar',
      totalLinearFt: 500,
      installationLaborRate: 50,
    });

    expect(
      warnings.some((w) => w.includes('Rebar installation labor') && w.includes('production rate')),
    ).toBe(true);
  });

  it('adapts reinforcement set records', () => {
    const { draftLines } = adaptReinforcementSetToDraftLines({
      projectName: 'Building A',
      reinforcement_type: 'rebar',
      total_linear_ft: 1800,
      total_bars: 120,
      bar_size: '5',
      pricing: { estimatedCost: 1530, currency: 'USD' },
    });

    expect(draftLines[0].task.lineItem.material.unitCost).toBeCloseTo(0.85, 2);
  });

  it('output draft lines can be passed into buildEstimateDraftSnapshot without crashing', () => {
    const { draftLines } = adaptReinforcementCalculationToDraftLines({
      reinforcementType: 'rebar',
      totalLinearFt: 900,
      installationProductionRate: 100,
      installationLaborRate: 46,
      materialUnitCost: 0.9,
    });

    const snapshot = buildEstimateDraftSnapshot({
      estimateId: 'est-rebar-001',
      projectId: 'proj-rebar-001',
      versionNumber: 1,
      draftLines,
    });

    expect(snapshot.lineItems.length).toBe(2);
  });

  it('never produces NaN or Infinity values', () => {
    const { draftLines } = adaptReinforcementCalculationToDraftLines({
      reinforcementType: 'rebar',
      totalLinearFt: Number.NaN,
      installationProductionRate: undefined,
      installationLaborRate: 'bad' as unknown as number,
    });

    for (const value of collectNumericValues(draftLines)) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });
});
