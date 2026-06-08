import { describe, expect, it } from 'vitest';
import {
  applyMasterActivityToDraftLine,
  assignActivityCodeToDraftLine,
  backfillActivityCodesForDraftLines,
  buildActivityCode,
  compareActivityCodes,
  validateActivityCodeUnique,
} from '../application/estimateActivityCoding';
import { createEmptyDraftLine } from '../application/estimateDraftLine';
import { getMasterActivityByCode } from '../data/masterActivityIndex';

function line(
  clientId: string,
  divisionCode: string,
  scopeName: string,
  title: string,
  overrides: Record<string, unknown> = {},
) {
  const draft = createEmptyDraftLine(0, clientId);
  draft.task.title = title;
  draft.task.lineItem.csiDivision = divisionCode;
  draft.task.divisionCode = divisionCode;
  draft.task.scopeName = scopeName;
  Object.assign(draft.task, overrides);
  return draft;
}

describe('estimateActivityCoding', () => {
  it('generates 01-01-01 for the first item in Division 01', () => {
    const first = assignActivityCodeToDraftLine(
      line('a', '01', 'Mobilization', 'Mobilize crew'),
      [],
    );
    expect(first.task.activityCode).toBe('01-01-01');
    expect(first.task.workPackageCode).toBe('01-01');
  });

  it('generates 03-01-02 for the second line in the first Concrete work package', () => {
    const existing = assignActivityCodeToDraftLine(
      line('a', '03', 'Slab on Grade', 'Form slab'),
      [],
    );
    const second = assignActivityCodeToDraftLine(
      line('b', '03', 'Slab on Grade', 'Place concrete'),
      [existing],
    );
    expect(second.task.activityCode).toBe('03-01-02');
  });

  it('generates 03-02-01 for the first line in the second Concrete work package', () => {
    const slab = assignActivityCodeToDraftLine(
      line('a', '03', 'Slab on Grade', 'Form slab'),
      [],
    );
    const footing = assignActivityCodeToDraftLine(
      line('b', '03', 'Footings', 'Excavate footings'),
      [slab],
    );
    expect(footing.task.activityCode).toBe('03-02-01');
  });

  it('validates activity code uniqueness within an estimate', () => {
    const first = assignActivityCodeToDraftLine(line('a', '03', 'Slab', 'A'), []);
    const second = {
      ...line('b', '03', 'Slab', 'B'),
      task: { ...first.task, title: 'B' },
    };
    second.task.activityCode = first.task.activityCode;
    expect(validateActivityCodeUnique(first.task.activityCode!, [first, second], 'b')).toMatch(
      /already used/,
    );
  });

  it('sorts activity codes by division, activity, and line', () => {
    expect(compareActivityCodes('01-01-01', '03-01-01')).toBeLessThan(0);
    expect(compareActivityCodes('03-01-01', '03-01-02')).toBeLessThan(0);
    expect(compareActivityCodes('03-02-01', '03-01-02')).toBeGreaterThan(0);
    expect(buildActivityCode('3', 1, 2)).toBe('03-01-02');
  });

  it('backfills stable generated codes for legacy lines without activityCode', () => {
    const backfilled = backfillActivityCodesForDraftLines([
      line('a', '03', 'Slab on Grade', 'Form slab'),
      line('b', '03', 'Slab on Grade', 'Place concrete'),
      line('c', '03', 'Footings', 'Excavate footings'),
    ]);
    expect(backfilled.map((item) => item.task.activityCode)).toEqual([
      '03-01-01',
      '03-01-02',
      '03-02-01',
    ]);
  });

  it('applies production defaults when selecting a mapped master activity', () => {
    const master = getMasterActivityByCode('03-01-03');
    expect(master).toBeDefined();

    const applied = applyMasterActivityToDraftLine(createEmptyDraftLine(), master!, 1);

    expect(applied.unit).toBe('CY');
    expect(applied.task.lineItem.labor.productionRate).toBe(0.337);
    expect(applied.task.lineItem.labor.productionRateType).toBe('labor_hours_per_unit');
    expect(applied.task.lineItem.labor.crewSize).toBe(4);
  });

  it('applies representative mapped production defaults from the activity bridge', () => {
    const cases = [
      { code: '06-02-01', productionRate: 0.364 },
      { code: '07-05-01', productionRate: 0.010 },
      { code: '09-01-01', productionRate: 0.013 },
      { code: '09-02-02', productionRate: 0.005 },
      { code: '11-01-01', productionRate: 1 },
    ] as const;

    for (const { code, productionRate } of cases) {
      const master = getMasterActivityByCode(code);
      expect(master).toBeDefined();
      const applied = applyMasterActivityToDraftLine(createEmptyDraftLine(), master!, 1);
      expect(applied.task.lineItem.labor.productionRate).toBe(productionRate);
      expect(applied.task.lineItem.labor.productionRateType).toBe('labor_hours_per_unit');
    }
  });

  it('overwrites initial zero production rate with mapped defaults', () => {
    const master = getMasterActivityByCode('03-01-03');
    expect(master).toBeDefined();
    const draft = createEmptyDraftLine();
    expect(draft.task.lineItem.labor.productionRate).toBe(0);

    const applied = applyMasterActivityToDraftLine(draft, master!, 1);

    expect(applied.task.lineItem.labor.productionRate).toBe(0.337);
  });

  it('does not overwrite production fields touched in the current modal session', () => {
    const master = getMasterActivityByCode('03-01-03');
    expect(master).toBeDefined();
    const draft = createEmptyDraftLine();
    draft.unit = 'SF';
    draft.task.lineItem.labor.productionRate = 0.5;
    draft.task.lineItem.labor.crewSize = 2;

    const applied = applyMasterActivityToDraftLine(draft, master!, 1, {
      touchedFields: new Set(['unit', 'productionRate', 'crewSize']),
    });

    expect(applied.unit).toBe('SF');
    expect(applied.task.lineItem.labor.productionRate).toBe(0.5);
    expect(applied.task.lineItem.labor.crewSize).toBe(2);
    expect(applied.task.lineItem.labor.productionRateType).toBe('labor_hours_per_unit');
  });

  it('uses fallback master defaults for unmapped activities', () => {
    // 03-01-02 is "Place footing reinforcement" (LF) — intentionally not mapped to a production rate
    const master = getMasterActivityByCode('03-01-02');
    expect(master).toBeDefined();

    const applied = applyMasterActivityToDraftLine(createEmptyDraftLine(), master!, 1);

    expect(applied.unit).toBe(master!.defaultUnit);
    expect(applied.task.lineItem.labor.productionRate).toBe(0);
    expect(applied.task.lineItem.labor.crewSize).toBe(master!.defaultCrewSize);
  });
});
