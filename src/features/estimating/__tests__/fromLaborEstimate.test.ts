import { describe, expect, it } from 'vitest';
import { buildEstimateDraftSnapshot } from '../application/buildEstimateDraftSnapshot';
import type { EstimateDraftLine } from '../application/estimateDraftLine';
import {
  adaptLaborEstimateRecordToDraftLines,
  adaptLaborEstimateToDraftLines,
} from '../adapters/fromLaborEstimate';

function collectNumericValues(draftLines: EstimateDraftLine[]): number[] {
  const values: number[] = [];
  for (const draft of draftLines) {
    values.push(
      draft.indirectCost,
      draft.task.lineItem.quantity.quantity,
      draft.task.lineItem.labor.productionRate,
      draft.task.lineItem.labor.laborRate,
      draft.task.lineItem.labor.crewSize,
      draft.task.lineItem.labor.hoursPerDay,
    );
  }
  return values;
}

describe('fromLaborEstimate', () => {
  it('maps labor data to labor hours and crew fields', () => {
    const { draftLines } = adaptLaborEstimateToDraftLines({
      label: 'Slab pour labor',
      volumeYd: 18,
      areaSqFt: 1620,
      production: {
        laborCost: 4200,
        adjustedLaborHours: 96,
        placingLaborHours: 40,
        finishingLaborHours: 32,
        setupCleanupHours: 8,
        estimatedCrewDurationHours: 12,
        laborRates: {} as never,
        capturedAt: '2026-06-01T00:00:00.000Z',
        crewSize: '6',
        finishers: '2',
        vibrators: '1',
        laborerRateCYHr: '42',
        finisherRateSFHr: '0.18',
        placingProductivityCYPerLaborHour: '6.5',
        finishingProductivitySFPerLaborHour: '220',
        setupHours: '2',
        cleanupHours: '2',
        crewEfficiency: 'normal',
        complexityFactor: 'normal',
        accessFactorMode: 'auto',
        weatherFactorMode: 'auto',
        placementMethod: 'pump',
      },
      professionalLabor: {
        crewSize: 6,
        averageCrewRate: 48,
        burdenedRates: { laborer: 42, finisher: 46, foreman: 55 },
        taskHours: {
          mobilization: 1,
          subgradePrep: 2,
          formworkEdgePrep: 2,
          vaporBarrier: 0,
          reinforcement: 0,
          placement: 4,
          screeding: 2,
          bullFloating: 1,
          edgingJointing: 1,
          finishing: 3,
          curing: 1,
          cleanup: 1,
        },
        estimatedJobDurationHours: 12,
        billableJobDurationHours: 12,
        totalManHours: 72,
        regularJobHours: 12,
        overtimeJobHours: 0,
        regularManHours: 72,
        overtimeManHours: 0,
        costs: {
          regularCost: 4200,
          overtimeCost: 0,
          smallToolsAndPpe: 150,
          contingency: 200,
          totalLaborCost: 4550,
        },
        unitCosts: { laborCostPerCY: 252.78, laborCostPerSqFt: 2.81 },
        placementFactor: 1,
        finishFactor: 1,
      },
    });

    const placement = draftLines.find((line) => line.task.activity === 'Placement');
    const finishing = draftLines.find((line) => line.task.activity === 'Finishing');
    const duration = draftLines.find((line) => line.task.activity === 'Crew duration');

    expect(placement?.task.lineItem.quantity.quantity).toBe(18);
    expect(placement?.task.lineItem.labor.productionRate).toBe(6.5);
    expect(placement?.task.lineItem.labor.laborRate).toBe(42);
    expect(placement?.task.lineItem.labor.crewSize).toBe(6);

    expect(finishing?.task.lineItem.quantity.quantity).toBe(1620);
    expect(finishing?.task.lineItem.labor.productionRate).toBe(220);

    expect(duration?.task.lineItem.quantity.quantity).toBe(12);
    expect(duration?.task.lineItem.labor.crewSize).toBe(6);
  });

  it('creates a general trade labor task when provided', () => {
    const { draftLines } = adaptLaborEstimateToDraftLines({
      volumeYd: 0,
      generalTradeLabor: {
        trade: 'Carpentry',
        activity: 'Temporary bracing',
        quantity: 120,
        unit: 'LF',
        productionRate: 40,
        productionRateType: 'unitsPerLaborHour',
        crewSize: 2,
        hoursPerDay: 8,
        laborRate: 55,
        burdenPercent: 25,
        overheadPercent: 10,
        profitPercent: 12,
        difficultyFactor: 1,
        locationFactor: 1,
        notes: 'Edge forms',
      },
    });

    expect(draftLines).toHaveLength(1);
    expect(draftLines[0].task.trade).toBe('Carpentry');
    expect(draftLines[0].task.lineItem.labor.productionRate).toBe(40);
  });

  it('adds warnings when production rates are missing', () => {
    const { warnings } = adaptLaborEstimateToDraftLines({
      volumeYd: 10,
      areaSqFt: 900,
    });

    expect(
      warnings.some((w) => w.includes('Concrete placement labor') && w.includes('production rate')),
    ).toBe(true);
    expect(
      warnings.some((w) => w.includes('Concrete finishing labor') && w.includes('production rate')),
    ).toBe(true);
  });

  it('adapts saved labor estimate records', () => {
    const { draftLines } = adaptLaborEstimateRecordToDraftLines(
      {
        id: 'labor-1',
        projectId: 'proj-1',
        label: 'Driveway placement',
        volumeYd: 6,
        inputs: {
          crewSize: '4',
          finishers: '2',
          foremen: '1',
          vibrators: '1',
          complexityFactor: 'normal',
          accessFactorMode: 'auto',
          weatherFactorMode: 'auto',
          placementMethod: 'chute',
          manualVolume: '6',
          slabSize: '20 x 30',
          slabThicknessIn: '4',
          projectType: 'driveway',
          finishType: 'broom',
          accessDifficulty: 'easy',
          weatherCondition: 'normal',
          reinforcementType: 'wire_mesh',
          burdenMultiplier: '1.35',
          overtimeMultiplier: '1.5',
          vaporBarrier: 'false',
          curingCompound: 'true',
          sawCutJoints: 'true',
          smallJobMinimum: 'false',
          includeCleanup: 'true',
          includeContingency: 'true',
          placingProductivityCYPerLaborHour: '5',
          laborerRateCYHr: '40',
        },
        laborCost: 1800,
        adjustedLaborHours: 42,
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
      },
      { areaSqFt: 600 },
    );

    expect(draftLines.length).toBeGreaterThanOrEqual(2);
    expect(draftLines[0].task.title).toContain('Driveway placement');
  });

  it('output draft lines can be passed into buildEstimateDraftSnapshot without crashing', () => {
    const { draftLines } = adaptLaborEstimateToDraftLines({
      volumeYd: 12,
      areaSqFt: 1080,
      production: {
        laborCost: 3000,
        adjustedLaborHours: 60,
        placingLaborHours: 24,
        finishingLaborHours: 20,
        setupCleanupHours: 4,
        estimatedCrewDurationHours: 10,
        laborRates: {} as never,
        capturedAt: '2026-06-01T00:00:00.000Z',
        crewSize: '5',
        finishers: '2',
        vibrators: '1',
        laborerRateCYHr: '40',
        finisherRateSFHr: '0.2',
        placingProductivityCYPerLaborHour: '6',
        finishingProductivitySFPerLaborHour: '200',
        setupHours: '2',
        cleanupHours: '2',
        crewEfficiency: 'normal',
        complexityFactor: 'normal',
        accessFactorMode: 'auto',
        weatherFactorMode: 'auto',
        placementMethod: 'chute',
      },
    });

    const snapshot = buildEstimateDraftSnapshot({
      estimateId: 'est-labor-001',
      projectId: 'proj-labor-001',
      versionNumber: 1,
      draftLines,
    });

    expect(snapshot.lineItems.length).toBeGreaterThan(0);
    expect(Number.isFinite(snapshot.totals.directCost)).toBe(true);
  });

  it('never produces NaN or Infinity values', () => {
    const { draftLines } = adaptLaborEstimateToDraftLines({
      volumeYd: Number.NaN,
      areaSqFt: Number.POSITIVE_INFINITY,
      production: {
        laborCost: Number.NaN,
        adjustedLaborHours: Number.NaN,
        placingLaborHours: 0,
        finishingLaborHours: 0,
        setupCleanupHours: 0,
        estimatedCrewDurationHours: 0,
        laborRates: {} as never,
        capturedAt: '2026-06-01T00:00:00.000Z',
        crewSize: 'bad',
        finishers: '2',
        vibrators: '1',
        laborerRateCYHr: '',
        finisherRateSFHr: '',
        placingProductivityCYPerLaborHour: '',
        finishingProductivitySFPerLaborHour: '',
        setupHours: '0',
        cleanupHours: '0',
        crewEfficiency: 'normal',
        complexityFactor: 'normal',
        accessFactorMode: 'auto',
        weatherFactorMode: 'auto',
        placementMethod: 'chute',
      },
    });

    for (const value of collectNumericValues(draftLines)) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });
});
