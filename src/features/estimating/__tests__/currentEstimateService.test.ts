import { describe, expect, it } from 'vitest';
import { currentEstimateTestExports } from '../application/currentEstimateService';
import {
  conceptualEstimateFromAssumptions,
  conceptualEstimateToAssumptions,
} from '../application/conceptualEstimatePersistence';
import {
  DEFAULT_ESTIMATE_SETTINGS,
  parseEstimateSettingsFromAssumptions,
} from '../application/estimateSettings';
import { createEmptyConceptualEstimatePayload } from '../domain/conceptualEstimateTypes';
import { buildWorkspaceSummaryValues } from '../ui/estimateFormatters';
import type { EstimateDomainTask } from '../infrastructure/estimateDbTypes';

const {
  buildConceptualEstimatePersistenceSnapshot,
  currentEstimateToDomainVersion,
  mapEstimateRowToCurrentEstimate,
} =
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

  it('maps a brand-new empty draft row when allowEmpty is true (save roundtrip)', () => {
    const currentEstimate = mapEstimateRowToCurrentEstimate(
      baseRow({
        estimate_type: 'detailed',
        selected_divisions: [],
        line_items: [],
      }),
      { allowEmpty: true },
    );

    expect(currentEstimate).not.toBeNull();
    expect(currentEstimate?.selectedDivisions).toEqual([]);
    expect(currentEstimate?.lineItems).toEqual([]);
    expect(currentEstimate?.estimateType).toBe('detailed');
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

  it('maps legacy conceptual rows when assumptions are the only persisted business data', () => {
    const payload = createEmptyConceptualEstimatePayload();
    payload.revision.name = 'Legacy Conceptual Budget';
    payload.revision.basisOfEstimate = 'Persisted only in assumptions JSON.';
    payload.assumptions.push({
      id: 'asm-1',
      title: 'Owner budget is preliminary',
      description: 'Budget may change after design development.',
      impact: 'cost',
      createdAt: '2026-06-06T00:00:00.000Z',
      updatedAt: '2026-06-06T00:00:00.000Z',
    });

    const currentEstimate = mapEstimateRowToCurrentEstimate(
      baseRow({
        estimate_type: null,
        selected_divisions: [],
        line_items: [],
        totals: {},
        summary: {},
        assumptions: conceptualEstimateToAssumptions(payload),
      }),
    );

    expect(currentEstimate).not.toBeNull();
    expect(currentEstimate?.estimateType).toBe('conceptual');
    const version = currentEstimateToDomainVersion(currentEstimate!);
    expect(version.snapshot.conceptualEstimate?.revision.name).toBe('Legacy Conceptual Budget');
    expect(version.snapshot.conceptualEstimate?.assumptions).toHaveLength(1);
  });

  it('builds a complete conceptual save payload for all conceptual tabs', () => {
    const payload = createEmptyConceptualEstimatePayload();
    payload.revision = {
      name: 'Office TI Conceptual Budget',
      date: '2026-06-06',
      designStage: 'design_development',
      basisOfEstimate: 'Warm shell tenant improvement with owner-provided fixtures.',
      notes: 'Revision notes persist with the budget tab.',
    };
    payload.lineItems.push({
      id: 'cli-1',
      type: 'unit_cost',
      divisionCode: '09',
      divisionName: 'Finishes',
      systemCategory: 'interiors',
      title: 'Interior finishes',
      description: 'Allowance for finishes',
      quantity: 1200,
      unit: 'SF',
      unitCost: 85,
      amount: 102000,
      confidenceLevel: 'medium',
      sourceBasis: 'estimator_judgment',
      escalationPercent: 2,
      notes: 'Conceptual budget line item note.',
      createdAt: '2026-06-06T00:00:00.000Z',
      updatedAt: '2026-06-06T00:00:00.000Z',
    });
    payload.assumptions.push({
      id: 'asm-1',
      title: 'Normal working hours',
      description: 'Work occurs during standard business hours.',
      impact: 'schedule',
      relatedDivision: '09',
      createdAt: '2026-06-06T00:00:00.000Z',
      updatedAt: '2026-06-06T00:00:00.000Z',
    });
    payload.exclusions.push({
      id: 'exc-1',
      title: 'Furniture',
      description: 'Furniture by owner.',
      reason: 'Owner supplied',
      potentialCostImpact: 25000,
      createdAt: '2026-06-06T00:00:00.000Z',
      updatedAt: '2026-06-06T00:00:00.000Z',
    });
    payload.allowanceNotes.push({
      id: 'aln-1',
      title: 'Lighting allowance',
      includedAmount: 15000,
      description: 'Fixture allowance included in conceptual total.',
      responsibility: 'GC',
      createdAt: '2026-06-06T00:00:00.000Z',
      updatedAt: '2026-06-06T00:00:00.000Z',
    });
    payload.risks.push({
      id: 'risk-1',
      title: 'Long lead fixtures',
      description: 'Fixture availability may affect cost.',
      probability: 'medium',
      impact: 'high',
      costExposure: 12000,
      mitigation: 'Release selections early.',
      includedInContingency: true,
      createdAt: '2026-06-06T00:00:00.000Z',
      updatedAt: '2026-06-06T00:00:00.000Z',
    });
    payload.scenarios.push({
      id: 'scenario-1',
      name: 'Value engineering',
      description: 'Reduced finish scope',
      lineItemIds: ['cli-1'],
      subtotal: 0,
      contingency: 0,
      total: 0,
      notes: 'Scenario note.',
      createdAt: '2026-06-06T00:00:00.000Z',
      updatedAt: '2026-06-06T00:00:00.000Z',
    });
    payload.selectedScenarioId = 'scenario-1';
    payload.contingencyPercent = 12;

    const snapshot = buildConceptualEstimatePersistenceSnapshot({
      estimateId: 'estimate-1',
      projectId: 'project-1',
      payload,
      estimateSettings: {
        ...DEFAULT_ESTIMATE_SETTINGS,
        currency: 'AUD',
        indirectCostPercent: 3,
        overheadPercent: 8,
        profitPercent: 10,
        contingencyPercent: 6,
        taxPercent: 7,
        overheadBase: 'labor_only',
        profitBase: 'direct_only',
        taxBase: 'materials_only',
        hoursPerDay: 9,
        defaultCrewSize: 6,
      },
      existingAssumptions: {
        scheduleSettings: { projectStartDate: '2026-07-01' },
      },
      schedulingEnabled: false,
      createdBy: 'user-1',
    });

    expect(snapshot.assumptions.type).toBe('conceptual_estimate');
    expect(snapshot.assumptions.metadata).toMatchObject({
      estimateId: 'estimate-1',
      projectId: 'project-1',
      estimateType: 'conceptual',
    });
    expect(snapshot.assumptions.lineItems).toHaveLength(1);
    expect(snapshot.assumptions.assumptions).toHaveLength(1);
    expect(snapshot.assumptions.exclusions).toHaveLength(1);
    expect(snapshot.assumptions.allowanceNotes).toHaveLength(1);
    expect(snapshot.assumptions.scenarios).toHaveLength(1);
    expect(snapshot.assumptions.risks).toHaveLength(1);
    expect(snapshot.assumptions.revision).toMatchObject({
      name: 'Office TI Conceptual Budget',
      basisOfEstimate: 'Warm shell tenant improvement with owner-provided fixtures.',
    });
    expect(snapshot.assumptions.contingencyPercent).toBe(12);
    expect(snapshot.assumptions.selectedScenarioId).toBe('scenario-1');
    expect(snapshot.assumptions.estimateSettings).toMatchObject({
      currency: 'AUD',
      overheadPercent: 8,
      profitPercent: 10,
      taxPercent: 7,
      hoursPerDay: 9,
      defaultCrewSize: 6,
    });
    expect(snapshot.assumptions.scheduleSettings).toEqual({ projectStartDate: '2026-07-01' });
    expect(snapshot.totals.conceptualEstimate).toBe(true);
    expect(snapshot.summary.conceptualEstimate).toBe(true);
  });

  it('hydrates conceptual payload and estimate settings from the DB assumptions payload', () => {
    const payload = createEmptyConceptualEstimatePayload();
    payload.revision.name = 'Reloaded Conceptual Budget';
    payload.revision.basisOfEstimate = 'Loaded from Supabase assumptions JSON.';
    payload.allowanceNotes.push({
      id: 'aln-1',
      title: 'Owner fixture allowance',
      includedAmount: 5000,
      description: 'Loaded allowance note.',
      createdAt: '2026-06-06T00:00:00.000Z',
      updatedAt: '2026-06-06T00:00:00.000Z',
    });

    const snapshot = buildConceptualEstimatePersistenceSnapshot({
      estimateId: 'estimate-1',
      projectId: 'project-1',
      payload,
      estimateSettings: {
        ...DEFAULT_ESTIMATE_SETTINGS,
        currency: 'CAD',
        overheadPercent: 9,
      },
    });
    const currentEstimate = mapEstimateRowToCurrentEstimate(
      baseRow({
        estimate_type: 'conceptual',
        assumptions: snapshot.assumptions,
        totals: snapshot.totals,
        summary: snapshot.summary,
      }),
    );

    expect(currentEstimate).not.toBeNull();
    const reloadedPayload = conceptualEstimateFromAssumptions(currentEstimate!.assumptions);
    const reloadedSettings = parseEstimateSettingsFromAssumptions(currentEstimate!.assumptions);
    expect(reloadedPayload?.revision.name).toBe('Reloaded Conceptual Budget');
    expect(reloadedPayload?.allowanceNotes[0]?.title).toBe('Owner fixture allowance');
    expect(reloadedSettings.currency).toBe('CAD');
    expect(reloadedSettings.overheadPercent).toBe(9);
  });

  it('hydrates estimate settings from older nested conceptual markup snapshots', () => {
    const settings = parseEstimateSettingsFromAssumptions({
      type: 'conceptual_estimate',
      markupSettings: {
        estimateSettings: {
          ...DEFAULT_ESTIMATE_SETTINGS,
          currency: 'EUR',
          profitPercent: 11,
        },
      },
    });

    expect(settings.currency).toBe('EUR');
    expect(settings.profitPercent).toBe(11);
  });
});
