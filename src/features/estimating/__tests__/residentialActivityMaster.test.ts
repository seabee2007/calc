import { describe, expect, it } from 'vitest';
import {
  residentialActivityMaster,
  type EstimateActivityTemplate,
} from '../data/residentialActivityMaster';
import { validateActivityMasterDataset } from '../data/validateActivityMasterDataset';

const byCode = new Map(residentialActivityMaster.map((row) => [row.activityCode, row]));

function findByTitle(title: string): EstimateActivityTemplate | undefined {
  return residentialActivityMaster.find((row) => row.title === title);
}

describe('residentialActivityMaster', () => {
  it('passes the validator with zero errors', () => {
    const result = validateActivityMasterDataset(residentialActivityMaster);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('has a substantial number of activities across the lifecycle', () => {
    expect(residentialActivityMaster.length).toBeGreaterThanOrEqual(100);
  });

  it('uses unique DD-PP-SS activity codes', () => {
    const codes = residentialActivityMaster.map((row) => row.activityCode);
    const unique = new Set(codes);
    expect(unique.size).toBe(codes.length);
    for (const code of codes) {
      expect(code).toMatch(/^\d{2}-\d{2}-\d{2}$/);
    }
  });

  it('schedules every row by default', () => {
    expect(residentialActivityMaster.every((row) => row.scheduleEnabled === true)).toBe(true);
  });

  it('classifies municipal inspection gates as inspection', () => {
    const gates = residentialActivityMaster.filter((row) => row.activityCode.startsWith('01-02-'));
    expect(gates.length).toBeGreaterThan(0);
    expect(gates.every((row) => row.activityType === 'inspection')).toBe(true);
    expect(byCode.get('01-03-05')?.activityType).toBe('inspection');
  });

  it('classifies framing/foundation milestones with zero duration', () => {
    const milestones = ['01-03-01', '01-03-02', '01-03-03', '01-03-04'];
    for (const code of milestones) {
      const row = byCode.get(code);
      expect(row?.activityType).toBe('milestone');
      expect(row?.defaultDurationDays).toBe(0);
    }
  });

  it('classifies curing periods as curing_lag with no crew demand', () => {
    const curing = residentialActivityMaster.filter((row) => row.activityType === 'curing_lag');
    expect(curing.map((row) => row.title)).toEqual(
      expect.arrayContaining([
        'Foundation concrete curing period',
        'Slab concrete curing period',
      ]),
    );
    expect(curing.every((row) => row.defaultCrewSize === 0)).toBe(true);
  });

  it('marks countertop fabrication as procurement lead time with no crew', () => {
    const fabricate = findByTitle('Fabricate countertops');
    expect(fabricate?.activityType).toBe('procurement_lead_time');
    expect(fabricate?.defaultCrewSize).toBe(0);
  });

  it('classifies field tests as testing', () => {
    const expectedTests = [
      'Underground DWV test',
      'Domestic water pressure test',
      'Gas piping pressure test',
      'Duct leakage test',
      'Mechanical ventilation airflow test',
      'Low-voltage continuity test',
    ];
    for (const title of expectedTests) {
      expect(findByTitle(title)?.activityType).toBe('testing');
    }
  });

  it('splits compound rows into single-responsibility activities', () => {
    expect(findByTitle('Template countertops')).toBeDefined();
    expect(findByTitle('Fabricate countertops')).toBeDefined();
    expect(findByTitle('Place concrete driveway')).toBeDefined();
    expect(findByTitle('Place concrete walkways')).toBeDefined();
    expect(findByTitle('Install landscaping and sod')).toBeDefined();
    expect(findByTitle('Install irrigation system')).toBeDefined();
    expect(findByTitle('Punch list walkthrough')).toBeDefined();
    expect(findByTitle('Punch list corrections')).toBeDefined();
  });

  it('keeps drywall hanging separate from taping and finishing', () => {
    expect(findByTitle('Hang drywall')).toBeDefined();
    expect(findByTitle('Tape and finish drywall')).toBeDefined();
    expect(findByTitle('Hang and finish drywall')).toBeUndefined();
  });

  it('contains no unapproved compound phrases in titles', () => {
    const blocklist = [
      'templating and fabrication',
      'sod and irrigation',
      'driveway and walks',
      'rectification walkthrough',
    ];
    for (const row of residentialActivityMaster) {
      const lower = row.title.toLowerCase();
      for (const phrase of blocklist) {
        expect(lower.includes(phrase)).toBe(false);
      }
    }
  });
});

describe('validateActivityMasterDataset', () => {
  const base = residentialActivityMaster[0];

  it('flags a malformed activity code', () => {
    const result = validateActivityMasterDataset([{ ...base, activityCode: '1-2-3' }]);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('DD-PP-SS'))).toBe(true);
  });

  it('flags duplicate activity codes', () => {
    const result = validateActivityMasterDataset([base, base]);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('duplicate activityCode'))).toBe(true);
  });

  it('flags a milestone with non-zero duration', () => {
    const milestone = byCode.get('01-03-01')!;
    const result = validateActivityMasterDataset([{ ...milestone, defaultDurationDays: 2 }]);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('milestone'))).toBe(true);
  });

  it('flags an unapproved compound phrase', () => {
    const result = validateActivityMasterDataset([
      { ...base, title: 'Countertop templating and fabrication' },
    ]);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('compound phrase'))).toBe(true);
  });

  it('flags a zero hours-per-day', () => {
    const result = validateActivityMasterDataset([{ ...base, defaultHoursPerDay: 0 }]);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('defaultHoursPerDay'))).toBe(true);
  });
});
