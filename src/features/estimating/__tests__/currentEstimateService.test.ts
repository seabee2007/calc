import { describe, expect, it } from 'vitest';
import { currentEstimateTestExports } from '../application/currentEstimateService';
import { buildWorkspaceSummaryValues } from '../ui/estimateFormatters';
import type { EstimateDomainTask } from '../infrastructure/estimateDbTypes';

const { currentEstimateToDomainVersion, mapEstimateRowToCurrentEstimate } =
  currentEstimateTestExports;

function baseRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'estimate-1',
    project_id: 'project-1',
    name: 'Project Estimate',
    status: 'draft',
    estimate_type: 'bid',
    selected_divisions: [],
    line_items: [],
    totals: {
      directCost: 0,
      indirectCost: 0,
      overhead: 0,
      profit: 0,
      contingency: 0,
      tax: 0,
      finalSellPrice: 0,
    },
    summary: { lineItems: [] },
    assumptions: {},
    created_by: 'user-1',
    created_at: '2026-06-06T00:00:00.000Z',
    updated_at: '2026-06-06T01:00:00.000Z',
    ...overrides,
  };
}

function lineItem(overrides: Partial<EstimateDomainTask> = {}): EstimateDomainTask {
  return {
    id: 'line-1',
    lineType: 'task',
    title: 'Place slab',
    description: 'Place slab',
    scopeName: 'Concrete',
    trade: 'Concrete',
    activity: 'Place slab',
    position: 0,
    lineItem: {
      id: 'line-1',
      description: 'Place slab',
      csiDivision: '03',
      quantity: { formula: 'quantity_with_waste', quantity: 100, wastePercent: 0 },
      labor: {
        productionRate: 10,
        productionRateType: 'units_per_labor_hour',
        hoursPerDay: 8,
        crewSize: 4,
        parallelCrews: 1,
        difficultyFactor: 1,
        locationFactor: 1,
        laborRate: 65,
        burdenPercent: 0,
      },
      material: { unitCost: 10 },
      equipment: { rate: 0, rateType: 'lump_sum', usageUnits: 1 },
      subcontractor: { cost: 0 },
    },
    overheadPercent: 0,
    profitPercent: 0,
    contingencyPercent: 0,
    taxPercent: 0,
    wastePercent: 0,
    scheduleEnabled: true,
    weatherSensitive: false,
    inspectionRequired: false,
    calculatedValues: {
      metrics: { laborHours: 10, adjustedLaborHours: 10, manDays: 1.25, crewDays: 0.31 },
      costs: { materialCost: 1000, equipmentCost: 0, totalLaborCost: 650, directCost: 1650 },
    },
    ...overrides,
  };
}

describe('currentEstimateService mapping', () => {
  it('maps a row to a flat current estimate, not nested estimate/version data', () => {
    const currentEstimate = mapEstimateRowToCurrentEstimate(
      baseRow({
        selected_divisions: [
          {
            code: '03',
            name: 'Concrete',
            source: 'ai',
            confidence: 0.92,
            reason: 'Scope mentions concrete slab.',
            createdAt: '2026-06-06T00:00:00.000Z',
          },
        ],
      }),
    );

    expect(currentEstimate).toMatchObject({
      id: 'estimate-1',
      projectId: 'project-1',
      estimateType: 'bid',
      status: 'draft',
    });
    expect(currentEstimate).not.toHaveProperty('estimate');
    expect(currentEstimate).not.toHaveProperty('version');
    expect(currentEstimate?.lineItems).toHaveLength(0);
    expect(currentEstimate?.selectedDivisions).toEqual([
      {
        code: '03',
        name: 'Concrete',
        source: 'ai',
        confidence: 0.92,
        reason: 'Scope mentions concrete slab.',
        createdAt: '2026-06-06T00:00:00.000Z',
      },
    ]);
  });

  it('restores saved line items from the current estimate row', () => {
    const currentEstimate = mapEstimateRowToCurrentEstimate(
      baseRow({
        line_items: [lineItem()],
        totals: {
          directCost: 1650,
          indirectCost: 0,
          overhead: 0,
          profit: 0,
          contingency: 0,
          tax: 0,
          finalSellPrice: 1650,
        },
      }),
    );
    expect(currentEstimate).not.toBeNull();
    const version = currentEstimateToDomainVersion(currentEstimate!);

    expect(version.lineItems).toHaveLength(1);
    expect(version.lineItems[0].lineItem.csiDivision).toBe('03');
    expect(buildWorkspaceSummaryValues(version).totalEstimate).toBe('$1,650.00');
  });

  it('restores quick feasibility totals and labor summary from the current estimate row', () => {
    const currentEstimate = mapEstimateRowToCurrentEstimate(
      baseRow({
        estimate_type: 'quick_feasibility',
        totals: {
          finalSellPrice: 100000,
          totalEstimate: 100000,
          directCost: 85000,
          laborCost: 35000,
          materialCost: 45000,
          equipmentCost: 5000,
          overhead: 10000,
          profit: 10000,
          contingency: 0,
          tax: 0,
          laborHours: 538.46,
          manDays: 67.31,
          crewDays: 8.41,
          plannedDurationDays: 9,
        },
        assumptions: {
          type: 'quick_feasibility',
          totals: {
            totalEstimate: 100000,
            laborCost: 35000,
            materialCost: 45000,
            equipmentCost: 5000,
            overhead: 10000,
            profit: 10000,
          },
          labor: {
            laborHours: 538.46,
            manDays: 67.31,
            crewDays: 8.41,
            estimatedCrewSize: 8,
          },
          schedule: { plannedDurationDays: 9 },
        },
      }),
    );
    expect(currentEstimate).not.toBeNull();
    const version = currentEstimateToDomainVersion(currentEstimate!);

    const values = buildWorkspaceSummaryValues(version);

    expect(values.totalEstimate).toBe('$100,000.00');
    expect(values.laborHours).toBe('538.5 hr');
    expect(values.manDays).toBe('67.31');
    expect(values.crewDays).toBe('8.41');
    expect(values.materialCost).toBe('$45,000.00');
    expect(values.equipmentCost).toBe('$5,000.00');
    expect(values.profit).toBe('$10,000.00');
  });

  it('treats an old empty estimate row with no type as no current estimate', () => {
    const currentEstimate = mapEstimateRowToCurrentEstimate(
      baseRow({
        estimate_type: null,
        selected_divisions: [],
        line_items: [],
        totals: {},
        summary: {},
        assumptions: {},
      }),
    );

    expect(currentEstimate).toBeNull();
  });

  it('maps selected_divisions snake_case column to selectedDivisions on save roundtrip', () => {
    const divisions = [
      {
        code: '01',
        name: 'General Requirements',
        source: 'manual' as const,
        createdAt: '2026-06-06T00:00:00.000Z',
      },
      {
        code: '03',
        name: 'Concrete',
        source: 'ai' as const,
        confidence: 0.9,
        reason: 'Concrete scope detected.',
        createdAt: '2026-06-06T00:00:00.000Z',
      },
    ];
    const currentEstimate = mapEstimateRowToCurrentEstimate(
      baseRow({ selected_divisions: divisions }),
    );

    expect(currentEstimate?.selectedDivisions).toEqual(divisions);
  });

  it('infers a detailed estimate for legacy rows with selected divisions but no type', () => {
    const currentEstimate = mapEstimateRowToCurrentEstimate(
      baseRow({
        estimate_type: null,
        selected_divisions: [
          {
            code: '09',
            name: 'Finishes',
            source: 'manual',
            createdAt: '2026-06-06T00:00:00.000Z',
          },
        ],
      }),
    );

    expect(currentEstimate?.estimateType).toBe('detailed');
    expect(currentEstimate?.selectedDivisions).toHaveLength(1);
  });
});
