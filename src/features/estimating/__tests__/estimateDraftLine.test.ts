import { describe, expect, it } from 'vitest';
import {
  createEmptyDraftLine,
  draftLineFromDomainTask,
  draftLinesFromVersion,
  reindexDraftLines,
  sortDraftLinesByPosition,
  syncDraftLineDescription,
} from '../application/estimateDraftLine';
import type { EstimateDomainTask } from '../infrastructure/estimateDbTypes';

function sampleTask(overrides: Partial<EstimateDomainTask> = {}): EstimateDomainTask {
  return {
    id: 'task-1',
    lineType: 'task',
    title: 'Sample task',
    description: 'Sample description',
    scopeName: 'Concrete',
    trade: 'Flatwork',
    activity: 'Pour',
    position: 0,
    lineItem: {
      id: 'task-1',
      description: 'Sample description',
      csiDivision: '03',
      csiSection: '03 30 00',
      quantity: { formula: 'quantity_with_waste', quantity: 100, wastePercent: 5 },
      labor: {
        productionRate: 10,
        productionRateType: 'units_per_labor_hour',
        hoursPerDay: 8,
        crewSize: 2,
        laborRate: 50,
        burdenPercent: 10,
      },
      material: { unitCost: 5 },
      equipment: { rate: 200, rateType: 'lump_sum', usageUnits: 1 },
      subcontractor: { cost: 100 },
    },
    overheadPercent: 10,
    profitPercent: 5,
    contingencyPercent: 2,
    taxPercent: 8,
    wastePercent: 5,
    scheduleEnabled: true,
    weatherSensitive: false,
    inspectionRequired: false,
    calculatedValues: {
      unit: 'SF',
      costs: { indirectCost: 25 },
    },
    ...overrides,
  };
}

describe('estimateDraftLine', () => {
  it('createEmptyDraftLine returns a task draft with defaults', () => {
    const draft = createEmptyDraftLine(3, 'client-fixed');

    expect(draft.clientId).toBe('client-fixed');
    expect(draft.task.position).toBe(3);
    expect(draft.task.lineType).toBe('task');
    expect(draft.task.lineItem.quantity.formula).toBe('quantity_with_waste');
    expect(draft.unit).toBe('');
    expect(draft.indirectCost).toBe(0);
  });

  it('draftLineFromDomainTask clones task metadata and unit/indirect values', () => {
    const draft = draftLineFromDomainTask(sampleTask(), 'draft-client');

    expect(draft.clientId).toBe('draft-client');
    expect(draft.task.title).toBe('Sample task');
    expect(draft.unit).toBe('SF');
    expect(draft.indirectCost).toBe(25);
    expect(draft.task).not.toBe(sampleTask());
  });

  it('draftLinesFromVersion sorts and reindexes positions', () => {
    const lines = draftLinesFromVersion([
      sampleTask({ id: 'b', position: 2, title: 'Second' }),
      sampleTask({ id: 'a', position: 0, title: 'First' }),
    ]);

    expect(lines).toHaveLength(2);
    expect(lines[0].task.title).toBe('First');
    expect(lines[0].task.position).toBe(0);
    expect(lines[1].task.title).toBe('Second');
    expect(lines[1].task.position).toBe(1);
  });

  it('sortDraftLinesByPosition orders by task.position', () => {
    const sorted = sortDraftLinesByPosition([
      createEmptyDraftLine(2, 'c2'),
      createEmptyDraftLine(0, 'c0'),
      createEmptyDraftLine(1, 'c1'),
    ]);

    expect(sorted.map((line) => line.task.position)).toEqual([0, 1, 2]);
  });

  it('reindexDraftLines normalizes positions after removal', () => {
    const lines = [
      draftLineFromDomainTask(sampleTask({ id: 'a', position: 0 }), 'a'),
      draftLineFromDomainTask(sampleTask({ id: 'b', position: 1 }), 'b'),
      draftLineFromDomainTask(sampleTask({ id: 'c', position: 2 }), 'c'),
    ];

    const reindexed = reindexDraftLines(lines.filter((line) => line.clientId !== 'b'));
    expect(reindexed).toHaveLength(2);
    expect(reindexed.map((line) => line.task.position)).toEqual([0, 1]);
  });

  it('syncDraftLineDescription copies title into line item description', () => {
    const draft = createEmptyDraftLine();
    draft.task.title = 'Pour slab';

    const synced = syncDraftLineDescription(draft);
    expect(synced.task.lineItem.description).toBe('Pour slab');
  });
});
