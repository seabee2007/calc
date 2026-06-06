import { describe, expect, it } from 'vitest';
import {
  buildWorkBreakdownFromSelection,
  createDivisionBucketsFromSelection,
  filterDraftLinesForDivision,
  hasEstimateWorkBreakdown,
  inferDivisionCodesFromItems,
  mergeDivisionBucketsWithActivities,
  normalizeSelectedDivisions,
  normalizeSelectedDivisionCodes,
  selectedDivisionCodesFromSnapshot,
  selectedDivisionsFromSnapshot,
} from '../application/estimateWorkBreakdown';
import { createEmptyDraftLine } from '../application/estimateDraftLine';
import type { EstimateDomainTask } from '../infrastructure/estimateDbTypes';

function taskWithDivision(code: string, title = 'Activity'): EstimateDomainTask {
  const draft = createEmptyDraftLine(0);
  draft.task.title = title;
  draft.task.lineItem.csiDivision = code;
  return draft.task;
}

describe('estimateWorkBreakdown', () => {
  it('selected CSI divisions create division buckets', () => {
    const buckets = createDivisionBucketsFromSelection(['03', '31']);
    expect(buckets).toHaveLength(2);
    expect(buckets[0].code).toBe('03');
    expect(buckets[0].label).toContain('Concrete');
    expect(buckets[1].code).toBe('31');
    expect(buckets[1].label).toContain('Earthwork');
  });

  it('division buckets preserve selected order', () => {
    const breakdown = buildWorkBreakdownFromSelection(['31', '03', '01']);
    expect(breakdown.divisions.map((division) => division.code)).toEqual(['31', '03', '01']);
  });

  it('duplicate divisions are ignored', () => {
    expect(normalizeSelectedDivisionCodes(['03', '03', '31', '03'])).toEqual(['03', '31']);
    expect(createDivisionBucketsFromSelection(['03', '03', '31']).map((b) => b.code)).toEqual([
      '03',
      '31',
    ]);
  });

  it('empty selection returns safe empty work breakdown', () => {
    const breakdown = mergeDivisionBucketsWithActivities([], [], []);
    expect(breakdown.divisions).toEqual([]);
    expect(hasEstimateWorkBreakdown([], [], [])).toBe(false);
  });

  it('activity counts roll up under divisions', () => {
    const draftLines = [
      createEmptyDraftLine(0),
      createEmptyDraftLine(1),
      createEmptyDraftLine(2),
    ];
    draftLines[0].task.lineItem.csiDivision = '03';
    draftLines[0].task.title = 'Pour slab';
    draftLines[0].task.lineItem.quantity.quantity = 10;
    draftLines[0].task.lineItem.labor = {
      ...draftLines[0].task.lineItem.labor!,
      productionRate: 2,
      productionRateType: 'units_per_labor_hour',
      crewSize: 2,
      hoursPerDay: 8,
    };

    draftLines[1].task.lineItem.csiDivision = '03';
    draftLines[1].task.title = 'Formwork';

    draftLines[2].task.lineItem.csiDivision = '31';
    draftLines[2].task.title = 'Excavate';

    const breakdown = mergeDivisionBucketsWithActivities(['03', '31'], draftLines, []);
    const concrete = breakdown.divisions.find((division) => division.code === '03');
    const earthwork = breakdown.divisions.find((division) => division.code === '31');

    expect(concrete?.activityCount).toBe(2);
    expect(earthwork?.activityCount).toBe(1);
    expect(concrete?.hasActivities).toBe(true);
  });

  it('division with no activities shows zero totals', () => {
    const breakdown = mergeDivisionBucketsWithActivities(['03', '31'], [], []);
    const concrete = breakdown.divisions.find((division) => division.code === '03');

    expect(concrete?.activityCount).toBe(0);
    expect(concrete?.hasActivities).toBe(false);
    expect(concrete?.rollup.itemCount).toBe(0);
    expect(concrete?.rollup.laborHours).toBe(0);
    expect(concrete?.rollup.sellPrice).toBe(0);
  });

  it('extracts selected divisions from snapshot so empty groups render after reload', () => {
    const snapshot = {
      selectedDivisions: [
        {
          code: '01',
          name: 'General Requirements',
          source: 'ai',
          confidence: 0.9,
          reason: 'General requirements are needed.',
          createdAt: '2026-06-06T00:00:00.000Z',
        },
        {
          code: '03',
          name: 'Concrete',
          source: 'ai',
          confidence: 0.95,
          reason: 'Concrete slab is named.',
          createdAt: '2026-06-06T00:00:00.000Z',
        },
        {
          code: '09',
          name: 'Finishes',
          source: 'ai',
          confidence: 0.78,
          reason: 'Building scope implies finishes.',
          createdAt: '2026-06-06T00:00:00.000Z',
        },
      ],
    };

    expect(selectedDivisionCodesFromSnapshot(snapshot)).toEqual(['01', '03', '09']);

    const savedTasks = [taskWithDivision('03', 'Saved concrete')];
    const breakdown = mergeDivisionBucketsWithActivities(
      selectedDivisionCodesFromSnapshot(snapshot),
      [],
      savedTasks,
    );

    expect(breakdown.divisions.map((division) => division.code)).toEqual(['01', '03', '09']);
    expect(breakdown.divisions.find((division) => division.code === '01')?.activityCount).toBe(0);
    expect(breakdown.divisions.find((division) => division.code === '09')?.activityCount).toBe(0);
    expect(breakdown.divisions.find((division) => division.code === '03')?.activityCount).toBe(1);
  });

  it('normalizing selected divisions respects manual removal', () => {
    const selected = selectedDivisionsFromSnapshot({
      selectedDivisions: [
        { code: '01', name: 'General Requirements', source: 'ai', createdAt: '2026-06-06' },
        { code: '03', name: 'Concrete', source: 'ai', createdAt: '2026-06-06' },
        { code: '09', name: 'Finishes', source: 'ai', createdAt: '2026-06-06' },
      ],
    });
    const afterManualRemoval = selected.filter((division) => division.code !== '09');

    expect(normalizeSelectedDivisions(afterManualRemoval).map((division) => division.code)).toEqual([
      '01',
      '03',
    ]);
  });

  it('existing activities map into division buckets correctly', () => {
    const savedTasks = [taskWithDivision('03', 'Saved concrete'), taskWithDivision('32', 'Paving')];
    const inferred = inferDivisionCodesFromItems([], savedTasks);
    expect(inferred).toEqual(['03', '32']);

    const breakdown = mergeDivisionBucketsWithActivities([], [], savedTasks);
    expect(breakdown.divisions.map((division) => division.code)).toEqual(['03', '32']);
    expect(breakdown.divisions.every((division) => division.activityCount === 1)).toBe(true);
    expect(hasEstimateWorkBreakdown([], [], savedTasks)).toBe(true);
  });

  it('filterDraftLinesForDivision returns only matching draft lines', () => {
    const draftLines = [
      createEmptyDraftLine(0),
      createEmptyDraftLine(1),
    ];
    draftLines[0].task.lineItem.csiDivision = '03';
    draftLines[1].task.lineItem.csiDivision = '31';

    expect(filterDraftLinesForDivision(draftLines, '03')).toHaveLength(1);
    expect(filterDraftLinesForDivision(draftLines, '03')[0].task.lineItem.csiDivision).toBe('03');
  });
});
