import { describe, expect, it } from 'vitest';
import type { EstimateDraftLine } from '../application/estimateDraftLine';
import type { EstimateDomainTask } from '../infrastructure/estimateDbTypes';
import { computeDraftSummaryTotals } from '../ui/estimateFormDefaults';
import {
  buildCollapsedDivisionCodes,
  buildBuilderFilterGroups,
  DEFAULT_BUILDER_FILTER_STATE,
  getFilteredDraftLinesForBuilder,
  getVisibleBreakdownDivisions,
  lineItemsFilterFromBuilderState,
} from '../application/estimateBuilderFilters';
import type { EstimateWorkBreakdown } from '../application/estimateWorkBreakdown';
import { emptyGroupRollup } from '../domain/estimateLineItemTree';

function sampleTask(overrides: Partial<EstimateDomainTask> = {}): EstimateDomainTask {
  const base: EstimateDomainTask = {
    id: 'task-1',
    lineType: 'task',
    title: 'Sample task',
    description: '',
    scopeName: 'Mobilization',
    trade: '',
    activity: '',
    position: 0,
    lineItem: {
      id: 'task-1',
      description: 'Sample description',
      csiDivision: '01',
      quantity: { formula: 'quantity_with_waste', quantity: 10, wastePercent: 0 },
      labor: {
        productionRate: 10,
        productionRateType: 'units_per_labor_hour',
        hoursPerDay: 8,
        crewSize: 1,
        laborRate: 50,
        burdenPercent: 0,
      },
      material: { unitCost: 0 },
      equipment: { rate: 0, rateType: 'lump_sum', usageUnits: 0 },
      subcontractor: { cost: 0 },
    },
    overheadPercent: 0,
    profitPercent: 0,
    contingencyPercent: 0,
    taxPercent: 0,
    wastePercent: 0,
    scheduleEnabled: false,
    weatherSensitive: false,
    inspectionRequired: false,
    calculatedValues: {
      metrics: { adjustedLaborHours: 1 },
      costs: { directCost: 100 },
    },
  };

  return {
    ...base,
    ...overrides,
    lineItem: {
      ...base.lineItem,
      ...overrides.lineItem,
    },
  };
}

function sampleDraft(task: EstimateDomainTask, clientId: string): EstimateDraftLine {
  return {
    clientId,
    unit: '',
    indirectCost: 0,
    task,
  };
}

function breakdown(codes: string[]): EstimateWorkBreakdown {
  return {
    divisions: codes.map((code) => ({
      code,
      label: `${code} - Division`,
      name: 'Division',
      rollup: emptyGroupRollup(),
      activityCount: 0,
      hasActivities: false,
    })),
  };
}

describe('estimateBuilderFilters', () => {
  const draftLines = [
    sampleDraft(
      sampleTask({
        id: 'line-1',
        scopeName: 'Mobilization',
        lineItem: { csiDivision: '01' },
      }),
      'draft-1',
    ),
    sampleDraft(
      sampleTask({
        id: 'line-2',
        scopeName: 'Clearing and Grubbing',
        lineItem: { csiDivision: '31' },
      }),
      'draft-2',
    ),
  ];

  it('defaults filters to all divisions', () => {
    expect(DEFAULT_BUILDER_FILTER_STATE).toEqual({
      activeDivisionFilter: 'all',
    });
    expect(lineItemsFilterFromBuilderState(DEFAULT_BUILDER_FILTER_STATE)).toEqual({
      divisionKey: null,
      scopeKey: null,
    });
  });

  it('shows only the selected division when a division filter is active', () => {
    const visible = getVisibleBreakdownDivisions(breakdown(['01', '31']), draftLines, {
      divisionKey: '01',
      scopeKey: null,
    });

    expect(visible.map((division) => division.code)).toEqual(['01']);
  });

  it('shows all divisions again when All divisions is selected', () => {
    const visible = getVisibleBreakdownDivisions(breakdown(['01', '31']), draftLines, {
      divisionKey: null,
      scopeKey: null,
    });

    expect(visible.map((division) => division.code)).toEqual(['01', '31']);
  });

  it('does not filter divisions by work package anymore', () => {
    const visible = getVisibleBreakdownDivisions(breakdown(['01', '31']), draftLines, {
      divisionKey: null,
      scopeKey: 'Mobilization',
    });

    expect(visible.map((division) => division.code)).toEqual(['01', '31']);
  });

  it('does not delete selected divisions or line items when filtering', () => {
    const filtered = getFilteredDraftLinesForBuilder(draftLines, {
      divisionKey: '01',
      scopeKey: null,
    });

    expect(filtered).toHaveLength(1);
    expect(draftLines).toHaveLength(2);
    expect(buildBuilderFilterGroups(breakdown(['01', '31']), draftLines)).toHaveLength(2);
  });

  it('ignores work package filter when filtering draft lines', () => {
    const filtered = getFilteredDraftLinesForBuilder(draftLines, {
      divisionKey: '01',
      scopeKey: 'Mobilization',
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].clientId).toBe('draft-1');
  });

  it('updates summary totals from visible filtered draft lines by division only', () => {
    const allTotals = computeDraftSummaryTotals(draftLines);
    const filteredTotals = computeDraftSummaryTotals(
      getFilteredDraftLinesForBuilder(draftLines, {
        divisionKey: '01',
        scopeKey: null,
      }),
    );

    expect(allTotals.lineCount).toBe(2);
    expect(filteredTotals.lineCount).toBe(1);
    expect(filteredTotals.laborHours).toBeLessThanOrEqual(allTotals.laborHours);
  });

  it('collapses every division when collapse all is triggered', () => {
    const collapsed = buildCollapsedDivisionCodes(['01', '31']);
    expect(collapsed.has('01')).toBe(true);
    expect(collapsed.has('31')).toBe(true);
    expect(collapsed.size).toBe(2);
  });
});
