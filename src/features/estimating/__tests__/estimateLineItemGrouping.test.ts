import { describe, expect, it } from 'vitest';
import type { EstimateDomainTask } from '../infrastructure/estimateDbTypes';
import type { EstimateDraftLine } from '../application/estimateDraftLine';
import {
  GENERAL_SCOPE_KEY,
  GENERAL_SCOPE_LABEL,
  UNASSIGNED_DIVISION_KEY,
  UNASSIGNED_DIVISION_LABEL,
} from '../domain/estimateLineItemTree';
import {
  filterGroupedEstimateLines,
  groupEstimateDraftLines,
  groupEstimateTasks,
} from '../application/estimateLineItemGrouping';

function sampleTask(overrides: Partial<EstimateDomainTask> = {}): EstimateDomainTask {
  const base: EstimateDomainTask = {
    id: 'task-1',
    lineType: 'task',
    title: 'Sample task',
    description: '',
    scopeName: 'Concrete',
    trade: '',
    activity: '',
    position: 0,
    lineItem: {
      id: 'task-1',
      description: 'Sample description',
      csiDivision: '03',
      csiSection: '',
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
      quantity: {
        ...base.lineItem.quantity,
        ...overrides.lineItem?.quantity,
      },
      labor: {
        ...base.lineItem.labor,
        ...overrides.lineItem?.labor,
      },
      material: {
        ...base.lineItem.material,
        ...overrides.lineItem?.material,
      },
      equipment: {
        ...base.lineItem.equipment,
        ...overrides.lineItem?.equipment,
      },
      subcontractor: {
        ...base.lineItem.subcontractor,
        ...overrides.lineItem?.subcontractor,
      },
    },
  };
}

function sampleDraft(task: EstimateDomainTask, clientId: string): EstimateDraftLine {
  return { clientId, task, unit: 'EA', indirectCost: 0 };
}

describe('estimateLineItemGrouping', () => {
  it('groups tasks by division', () => {
    const tasks = [
      sampleTask({ id: 'a', position: 0, lineItem: { csiDivision: '03' } }),
      sampleTask({ id: 'b', position: 1, lineItem: { csiDivision: '04' } }),
    ];

    const groups = groupEstimateTasks(tasks);

    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.key)).toEqual(['03', '04']);
  });

  it('groups tasks by scope inside each division', () => {
    const tasks = [
      sampleTask({ id: 'a', position: 0, scopeName: 'Slab', lineItem: { csiDivision: '03' } }),
      sampleTask({ id: 'b', position: 1, scopeName: 'Wall', lineItem: { csiDivision: '03' } }),
    ];

    const groups = groupEstimateTasks(tasks);
    const division = groups.find((g) => g.key === '03');

    expect(division?.scopes).toHaveLength(2);
    expect(division?.scopes.map((s) => s.label)).toEqual(['Slab', 'Wall']);
  });

  it('places missing division in Unassigned Division', () => {
    const tasks = [
      sampleTask({
        id: 'a',
        position: 0,
        lineItem: { csiDivision: '' },
      }),
    ];

    const groups = groupEstimateTasks(tasks);

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe(UNASSIGNED_DIVISION_KEY);
    expect(groups[0].label).toBe(UNASSIGNED_DIVISION_LABEL);
  });

  it('places missing scope in General Scope', () => {
    const tasks = [sampleTask({ id: 'a', position: 0, scopeName: '' })];

    const groups = groupEstimateTasks(tasks);
    const scope = groups[0].scopes[0];

    expect(scope.key).toBe(GENERAL_SCOPE_KEY);
    expect(scope.label).toBe(GENERAL_SCOPE_LABEL);
  });

  it('preserves position order inside each scope group', () => {
    const tasks = [
      sampleTask({ id: 'c', position: 2, title: 'Third', scopeName: 'Concrete' }),
      sampleTask({ id: 'a', position: 0, title: 'First', scopeName: 'Concrete' }),
      sampleTask({ id: 'b', position: 1, title: 'Second', scopeName: 'Concrete' }),
    ];

    const groups = groupEstimateTasks(tasks);
    const items = groups[0].scopes[0].items;

    expect(items.map((task) => task.title)).toEqual(['First', 'Second', 'Third']);
  });

  it('sorts divisions naturally with Unassigned Division last', () => {
    const tasks = [
      sampleTask({
        id: 'u',
        position: 0,
        lineItem: { csiDivision: '' },
      }),
      sampleTask({ id: '10', position: 1, lineItem: { csiDivision: '10' } }),
      sampleTask({ id: '03', position: 2, lineItem: { csiDivision: '03' } }),
    ];

    const groups = groupEstimateTasks(tasks);

    expect(groups.map((g) => g.key)).toEqual(['03', '10', UNASSIGNED_DIVISION_KEY]);
  });

  it('sorts scopes alphabetically with General Scope last', () => {
    const tasks = [
      sampleTask({ id: 'g', position: 0, scopeName: '' }),
      sampleTask({ id: 'b', position: 1, scopeName: 'Brick' }),
      sampleTask({ id: 'a', position: 2, scopeName: 'Asphalt' }),
    ];

    const groups = groupEstimateTasks(tasks);
    const scopeLabels = groups[0].scopes.map((s) => s.label);

    expect(scopeLabels).toEqual(['Asphalt', 'Brick', GENERAL_SCOPE_LABEL]);
  });

  it('filters grouped lines by division', () => {
    const tasks = [
      sampleTask({ id: 'a', position: 0, lineItem: { csiDivision: '03' } }),
      sampleTask({ id: 'b', position: 1, lineItem: { csiDivision: '04' } }),
    ];
    const groups = groupEstimateTasks(tasks);

    const filtered = filterGroupedEstimateLines(groups, { divisionKey: '03', scopeKey: null });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].key).toBe('03');
    expect(filtered[0].rollup.itemCount).toBe(1);
  });

  it('filters grouped lines by scope', () => {
    const tasks = [
      sampleTask({ id: 'a', position: 0, scopeName: 'Slab' }),
      sampleTask({ id: 'b', position: 1, scopeName: 'Wall' }),
    ];
    const groups = groupEstimateTasks(tasks);

    const filtered = filterGroupedEstimateLines(groups, {
      divisionKey: '03',
      scopeKey: 'Wall',
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].scopes).toHaveLength(1);
    expect(filtered[0].scopes[0].label).toBe('Wall');
  });

  it('returns empty groups for empty input', () => {
    expect(groupEstimateTasks([])).toEqual([]);
    expect(groupEstimateDraftLines([])).toEqual([]);
    expect(filterGroupedEstimateLines([], { divisionKey: '03', scopeKey: null })).toEqual([]);
  });

  it('groups draft lines using task metadata', () => {
    const drafts = [
      sampleDraft(sampleTask({ id: 'a', position: 0, scopeName: 'Alpha' }), 'c1'),
      sampleDraft(sampleTask({ id: 'b', position: 1, scopeName: 'Beta' }), 'c2'),
    ];

    const groups = groupEstimateDraftLines(drafts);

    expect(groups[0].scopes).toHaveLength(2);
    expect(groups[0].scopes.flatMap((s) => s.items.map((d) => d.clientId))).toEqual(['c1', 'c2']);
  });
});
