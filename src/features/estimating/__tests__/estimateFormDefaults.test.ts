import { describe, expect, it } from 'vitest';
import { createEmptyDraftLine, draftLineFromDomainTask } from '../application/estimateDraftLine';
import {
  collectDraftFormWarnings,
  computeDraftSummaryTotals,
  computeLinePreviewTotals,
  parseEstimateFormNumber,
  PRODUCTION_RATE_TYPE_OPTIONS,
} from '../ui/estimateFormDefaults';

describe('estimateFormDefaults', () => {
  it('parseEstimateFormNumber handles blank and invalid values', () => {
    expect(parseEstimateFormNumber('')).toBe(0);
    expect(parseEstimateFormNumber('12.5')).toBe(12.5);
    expect(parseEstimateFormNumber('abc')).toBe(0);
  });

  it('exposes all production rate type options', () => {
    expect(PRODUCTION_RATE_TYPE_OPTIONS.map((option) => option.value)).toEqual([
      'units_per_labor_hour',
      'units_per_labor_day',
      'labor_hours_per_unit',
      'units_per_crew_day',
    ]);
  });

  it('collectDraftFormWarnings flags required preview warnings', () => {
    const draft = createEmptyDraftLine();
    draft.task.lineItem.labor = {
      ...draft.task.lineItem.labor,
      productionRate: 0,
      crewSize: 0,
      hoursPerDay: 0,
    };

    const warnings = collectDraftFormWarnings(draft);
    const codes = warnings.map((warning) => warning.code);

    expect(codes).toContain('missing_task_title');
    expect(codes).toContain('missing_line_quantity');
    expect(codes).toContain('missing_production_rate');
    expect(codes).toContain('missing_crew_size');
    expect(codes).toContain('missing_hours_per_day');
  });

  it('computeLinePreviewTotals returns positive sell price for populated draft line', () => {
    const draft = createEmptyDraftLine();
    draft.task.title = 'Pour slab';
    draft.task.lineItem.quantity.quantity = 100;
    draft.task.lineItem.labor = {
      productionRate: 10,
      productionRateType: 'units_per_labor_hour',
      hoursPerDay: 8,
      crewSize: 2,
      laborRate: 50,
      burdenPercent: 10,
    };
    draft.task.lineItem.material = { unitCost: 5 };
    draft.task.lineItem.equipment = { rate: 200, rateType: 'lump_sum', usageUnits: 1 };
    draft.task.lineItem.subcontractor = { cost: 100 };
    draft.task.overheadPercent = 10;
    draft.task.profitPercent = 5;
    draft.indirectCost = 50;

    const totals = computeLinePreviewTotals(draft);

    expect(totals.laborHours).toBeGreaterThan(0);
    expect(totals.directCost).toBeGreaterThan(0);
    expect(totals.sellPrice).toBeGreaterThan(totals.directCost);
  });

  it('computeLinePreviewTotals works for hydrated domain tasks', () => {
    const draft = draftLineFromDomainTask({
      id: 'line-1',
      lineType: 'task',
      title: 'Existing line',
      position: 0,
      lineItem: {
        id: 'line-1',
        description: 'Existing line',
        quantity: { formula: 'quantity_with_waste', quantity: 50, wastePercent: 0 },
        labor: {
          productionRate: 5,
          productionRateType: 'units_per_labor_hour',
          hoursPerDay: 8,
          crewSize: 1,
          laborRate: 40,
          burdenPercent: 0,
        },
      },
      overheadPercent: 0,
      profitPercent: 0,
      contingencyPercent: 0,
      taxPercent: 0,
      wastePercent: 0,
      scheduleEnabled: true,
      weatherSensitive: false,
      inspectionRequired: false,
      calculatedValues: {},
    });

    const totals = computeLinePreviewTotals(draft);
    expect(totals.laborHours).toBe(10);
    expect(totals.laborCost).toBe(400);
  });

  it('computeDraftSummaryTotals aggregates draft lines safely', () => {
    const first = createEmptyDraftLine(0, 'line-a');
    first.task.title = 'Line A';
    first.task.lineItem.quantity.quantity = 10;
    first.task.lineItem.labor = {
      productionRate: 5,
      productionRateType: 'units_per_labor_hour',
      hoursPerDay: 8,
      crewSize: 2,
      laborRate: 40,
      burdenPercent: 0,
      difficultyFactor: 1,
      locationFactor: 1,
    };

    const second = createEmptyDraftLine(1, 'line-b');
    second.task.title = 'Line B';
    second.task.lineItem.quantity.quantity = 20;
    second.task.lineItem.labor = {
      productionRate: 10,
      productionRateType: 'units_per_labor_hour',
      hoursPerDay: 8,
      crewSize: 1,
      laborRate: 35,
      burdenPercent: 0,
      difficultyFactor: 1,
      locationFactor: 1,
    };

    const summary = computeDraftSummaryTotals([first, second]);

    expect(summary.lineCount).toBe(2);
    expect(summary.laborHours).toBeGreaterThan(0);
    expect(Number.isFinite(summary.manDays)).toBe(true);
    expect(Number.isFinite(summary.crewDays)).toBe(true);
    expect(Number.isFinite(summary.sellPrice)).toBe(true);
    expect(summary.sellPrice).toBeGreaterThan(0);
  });

  it('computeDraftSummaryTotals returns zeros for empty draft list', () => {
    const summary = computeDraftSummaryTotals([]);
    expect(summary).toEqual({
      lineCount: 0,
      laborHours: 0,
      manDays: 0,
      crewDays: 0,
      sellPrice: 0,
    });
  });
});
