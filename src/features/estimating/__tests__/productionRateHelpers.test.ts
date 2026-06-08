import { describe, expect, it, vi } from 'vitest';
import {
  getProductionRateById,
  getProductionRateDefaultsForActivity,
  getProductionRateMappingCoverage,
  RESIDENTIAL_PRODUCTION_RATES,
} from '../data/productionRates';
import * as masterActivityIndex from '../data/masterActivityIndex';
import { residentialActivityMaster } from '../data/residentialActivityMaster';
import {
  applyMasterActivityToDraftLine,
} from '../application/estimateActivityCoding';
import { createEmptyDraftLine } from '../application/estimateDraftLine';

// ── Record integrity ──────────────────────────────────────────────────────────

describe('residentialProductionRates record integrity', () => {
  it('every production-rate record has a non-empty stable id', () => {
    for (const rate of RESIDENTIAL_PRODUCTION_RATES) {
      expect(rate.id.trim(), `empty id on rate with csiCode ${rate.csiCode}`).not.toBe('');
    }
  });

  it('no duplicate production-rate ids', () => {
    const ids = RESIDENTIAL_PRODUCTION_RATES.map((r) => r.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('every production-rate record has a positive bareManHoursPerUnit', () => {
    for (const rate of RESIDENTIAL_PRODUCTION_RATES) {
      expect(rate.bareManHoursPerUnit, `${rate.id}`).toBeGreaterThan(0);
    }
  });

  it('every production-rate record has a non-empty unit', () => {
    for (const rate of RESIDENTIAL_PRODUCTION_RATES) {
      expect(rate.unit.trim(), `${rate.id}`).not.toBe('');
    }
  });
});

// ── getProductionRateById ─────────────────────────────────────────────────────

describe('getProductionRateById', () => {
  it('returns the footing concrete record', () => {
    expect(getProductionRateById('03-31-00-footings-direct-chute')).toMatchObject({
      csiCode: '03 31 00',
      unit: 'CY',
      bareManHoursPerUnit: 0.337,
      defaultCrewSize: 4,
    });
  });

  it('returns undefined for unknown id', () => {
    expect(getProductionRateById('99-99-99-nonexistent')).toBeUndefined();
  });

  it('returns undefined for null or empty input', () => {
    expect(getProductionRateById(null)).toBeUndefined();
    expect(getProductionRateById('')).toBeUndefined();
  });
});

// ── getProductionRateDefaultsForActivity ──────────────────────────────────────

describe('getProductionRateDefaultsForActivity', () => {
  it('returns footing concrete defaults for 03-01-03', () => {
    expect(getProductionRateDefaultsForActivity('03-01-03')).toMatchObject({
      unit: 'CY',
      productionRate: 0.337,
      productionRateType: 'labor_hours_per_unit',
      defaultCrewSize: 4,
      sourceCsiCode: '03 31 00',
      sourceDescription: 'Placing concrete footings directly via mixer truck chute',
      productionRateId: '03-31-00-footings-direct-chute',
    });
  });

  it('resolves display codes (03-01-03.2) to the base activity code', () => {
    const defaults = getProductionRateDefaultsForActivity('03-01-03.2');
    expect(defaults?.productionRate).toBe(0.337);
    expect(defaults?.productionRateId).toBe('03-31-00-footings-direct-chute');
  });

  it('returns representative rates for all mapped divisions', () => {
    const cases = [
      { code: '06-02-01', productionRate: 0.364, unit: 'LF' },
      { code: '07-05-01', productionRate: 0.010, unit: 'SF' },
      { code: '09-01-01', productionRate: 0.013, unit: 'SF' },
      { code: '09-02-02', productionRate: 0.005, unit: 'SF' },
      { code: '11-01-01', productionRate: 1.0, unit: 'EA' },
    ] as const;

    for (const { code, productionRate, unit } of cases) {
      const defaults = getProductionRateDefaultsForActivity(code);
      expect(defaults?.productionRate, code).toBe(productionRate);
      expect(defaults?.unit, code).toBe(unit);
      expect(defaults?.productionRateType, code).toBe('labor_hours_per_unit');
    }
  });

  it('returns undefined for an unmapped activity code', () => {
    // 03-01-02 is "Place footing reinforcement" (LF) — intentionally not mapped
    expect(getProductionRateDefaultsForActivity('03-01-02')).toBeUndefined();
  });

  it('returns undefined for null or empty input', () => {
    expect(getProductionRateDefaultsForActivity(null)).toBeUndefined();
    expect(getProductionRateDefaultsForActivity('')).toBeUndefined();
  });

  it('rejects a unit-mismatched mapping without allowUnitMismatch', () => {
    const spy = vi.spyOn(masterActivityIndex, 'getMasterActivityByCode').mockReturnValue({
      activityCode: '99-99-01',
      title: 'Unit mismatch test',
      divisionCode: '99',
      divisionName: 'Test',
      workPackageCode: '99-99',
      workPackageName: 'Test',
      activityType: 'work',
      sequencingCategory: 'test',
      logicAnchor: 'test',
      defaultCrewSize: 1,
      defaultHoursPerDay: 8,
      defaultDurationDays: 1,
      defaultUnit: 'TON',
      primaryTrade: 'Test',
      actionDescription: 'Test',
      scheduleEnabled: true,
      productionRateId: '03-31-00-footings-direct-chute',
    });

    expect(getProductionRateDefaultsForActivity('99-99-01')).toBeUndefined();
    spy.mockRestore();
  });

  it('never returns defaults for inspection activities', () => {
    const inspection = residentialActivityMaster.find((a) => a.activityType === 'inspection');
    if (inspection) {
      expect(getProductionRateDefaultsForActivity(inspection.activityCode)).toBeUndefined();
    }
  });

  it('never returns defaults for milestone activities', () => {
    const milestone = residentialActivityMaster.find((a) => a.activityType === 'milestone');
    if (milestone) {
      expect(getProductionRateDefaultsForActivity(milestone.activityCode)).toBeUndefined();
    }
  });
});

// ── Activity bridge integrity ─────────────────────────────────────────────────

describe('activity master → production rate bridge integrity', () => {
  it('every productionRateId used by a master activity resolves to an existing record', () => {
    const badLinks: string[] = [];
    for (const activity of residentialActivityMaster) {
      if (!activity.productionRateId) continue;
      const rate = getProductionRateById(activity.productionRateId);
      if (!rate) {
        badLinks.push(`${activity.activityCode} → ${activity.productionRateId} (not found)`);
      }
    }
    expect(badLinks).toEqual([]);
  });
});

// ── Coverage helper ───────────────────────────────────────────────────────────

describe('getProductionRateMappingCoverage', () => {
  it('returns non-zero totals', () => {
    const coverage = getProductionRateMappingCoverage();
    expect(coverage.totalMasterActivities).toBeGreaterThan(0);
    expect(coverage.totalProductionRates).toBeGreaterThan(0);
  });

  it('mapped + unmapped = total for activities', () => {
    const coverage = getProductionRateMappingCoverage();
    expect(coverage.mappedMasterActivities + coverage.unmappedMasterActivities).toBe(
      coverage.totalMasterActivities,
    );
  });

  it('mapped + unmapped = total for production rates', () => {
    const coverage = getProductionRateMappingCoverage();
    expect(coverage.mappedProductionRates + coverage.unmappedProductionRates).toBe(
      coverage.totalProductionRates,
    );
  });

  it('has at least 30 mapped activities', () => {
    const coverage = getProductionRateMappingCoverage();
    expect(coverage.mappedMasterActivities).toBeGreaterThanOrEqual(30);
  });

  it('includes Division 03 in byDivision breakdown', () => {
    const coverage = getProductionRateMappingCoverage();
    const div03 = coverage.byDivision.find((d) => d.divisionCode === '03');
    expect(div03).toBeDefined();
    expect(div03!.mappedActivities).toBeGreaterThan(0);
  });

  it('unmappedActivityCodes does not include inspection, milestone, curing_lag, testing, or procurement_lead_time', () => {
    const coverage = getProductionRateMappingCoverage();
    const excluded = new Set(['inspection', 'milestone', 'curing_lag', 'testing', 'procurement_lead_time']);
    for (const code of coverage.unmappedActivityCodes) {
      const activity = residentialActivityMaster.find((a) => a.activityCode === code);
      if (activity) {
        expect(excluded.has(activity.activityType), `${code} has excluded type ${activity.activityType}`).toBe(false);
      }
    }
  });
});

// ── applyMasterActivityToDraftLine with full dataset ──────────────────────────

describe('applyMasterActivityToDraftLine with expanded bridge', () => {
  it('fills unit, productionRate, crew for every mapped master activity', () => {
    const noDefaults: string[] = [];
    for (const master of residentialActivityMaster) {
      if (!master.productionRateId) continue;
      const defaults = getProductionRateDefaultsForActivity(master.activityCode);
      if (!defaults) {
        noDefaults.push(master.activityCode);
        continue;
      }
      const applied = applyMasterActivityToDraftLine(createEmptyDraftLine(), master, 1);
      expect(applied.unit, master.activityCode).toBe(defaults.unit);
      expect(applied.task.lineItem.labor.productionRate, master.activityCode).toBe(defaults.productionRate);
      expect(applied.task.lineItem.labor.productionRateType, master.activityCode).toBe('labor_hours_per_unit');
      expect(applied.task.lineItem.labor.crewSize, master.activityCode).toBe(defaults.defaultCrewSize);
    }
    expect(noDefaults, 'activities with productionRateId that return no defaults').toEqual([]);
  });

  it('overwrites an initial zero productionRate with the mapped default', () => {
    const master = residentialActivityMaster.find((a) => a.activityCode === '03-01-03');
    expect(master).toBeDefined();
    const draft = createEmptyDraftLine();
    expect(draft.task.lineItem.labor.productionRate).toBe(0);
    const applied = applyMasterActivityToDraftLine(draft, master!, 1);
    expect(applied.task.lineItem.labor.productionRate).toBe(0.337);
  });

  it('preserves a manually touched productionRate', () => {
    const master = residentialActivityMaster.find((a) => a.activityCode === '03-01-03');
    expect(master).toBeDefined();
    const draft = createEmptyDraftLine();
    draft.task.lineItem.labor.productionRate = 0.5;
    const applied = applyMasterActivityToDraftLine(draft, master!, 1, {
      touchedFields: new Set(['productionRate']),
    });
    expect(applied.task.lineItem.labor.productionRate).toBe(0.5);
  });

  it('falls back to master defaults for unmapped activities', () => {
    const unmapped = residentialActivityMaster.find(
      (a) => !a.productionRateId && a.activityType === 'work',
    );
    expect(unmapped).toBeDefined();
    const applied = applyMasterActivityToDraftLine(createEmptyDraftLine(), unmapped!, 1);
    expect(applied.task.lineItem.labor.productionRate).toBe(0);
    expect(applied.task.lineItem.labor.crewSize).toBe(unmapped!.defaultCrewSize);
  });
});

// ── Calculation verification ──────────────────────────────────────────────────

describe('calculation: 95 CY × 0.337 hrs/CY crew 4 @ 8 hrs/day', () => {
  it('produces about 32.02 labor hours', () => {
    expect(95 * 0.337).toBeCloseTo(32.015, 2);
  });

  it('produces about 1 day duration', () => {
    const laborHours = 95 * 0.337;
    const crewDays = laborHours / (4 * 8);
    expect(crewDays).toBeCloseTo(1.0, 1);
  });
});
