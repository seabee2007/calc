/**
 * Field Control — Progress Calculation Tests
 *
 * Tests the CPM manual's production-rate forecasting method.
 * The drywall example from the roadmap is used as the canonical reference:
 *
 *   Original: 2,000 SF / 10 days = 200 SF/day planned
 *   Actual:   800 SF in 6 days   = 133 SF/day actual
 *   Forecast: 1,200 SF / 133 SF/day = ~9 more days
 *   Total:    6 + 9 = 15 days (5 days behind schedule)
 */
import { describe, expect, it } from 'vitest';
import {
  buildActivityProductionForecast,
  buildActivityProgressRollup,
  calculateActualProductionRate,
  calculatePercentCompleteByQuantity,
  calculatePercentCompleteByRemainingDuration,
  calculatePlannedProductionRate,
  calculateScheduleVariance,
  forecastRemainingDays,
} from '../domain/activityProgressCalculations';
import type { ActivityProgressUpdate } from '../domain/activityProgressTypes';

// ── Primitives ────────────────────────────────────────────────────────────────

describe('calculatePlannedProductionRate', () => {
  it('computes SF/day for the drywall example', () => {
    expect(calculatePlannedProductionRate(2000, 10)).toBe(200);
  });

  it('returns null for zero duration', () => {
    expect(calculatePlannedProductionRate(2000, 0)).toBeNull();
  });

  it('returns null for negative duration', () => {
    expect(calculatePlannedProductionRate(2000, -1)).toBeNull();
  });

  it('returns 0 when quantity is 0', () => {
    expect(calculatePlannedProductionRate(0, 10)).toBe(0);
  });

  it('handles CYD/day for concrete', () => {
    expect(calculatePlannedProductionRate(25, 2)).toBe(12.5);
  });
});

describe('calculateActualProductionRate', () => {
  it('computes 133.33 SF/day for 800 SF in 6 days', () => {
    const rate = calculateActualProductionRate(800, 6);
    expect(rate).toBeCloseTo(133.33, 1);
  });

  it('returns null for 0 days elapsed', () => {
    expect(calculateActualProductionRate(800, 0)).toBeNull();
  });

  it('returns null for negative days elapsed', () => {
    expect(calculateActualProductionRate(800, -1)).toBeNull();
  });

  it('returns 0 when quantity complete is 0 but days elapsed > 0', () => {
    expect(calculateActualProductionRate(0, 3)).toBe(0);
  });
});

describe('forecastRemainingDays', () => {
  it('computes ~9 days for drywall example (1,200 SF at 133 SF/day)', () => {
    const remaining = forecastRemainingDays(1200, 800 / 6);
    expect(remaining).toBeCloseTo(9, 0);
  });

  it('returns 0 when no quantity remains', () => {
    expect(forecastRemainingDays(0, 133)).toBe(0);
  });

  it('falls back to crew estimate when actual rate is null', () => {
    expect(forecastRemainingDays(1000, null, 7)).toBe(7);
  });

  it('falls back to crew estimate when actual rate is 0', () => {
    expect(forecastRemainingDays(1000, 0, 5)).toBe(5);
  });

  it('falls back to quantityRemaining when both rate and crew estimate are null', () => {
    expect(forecastRemainingDays(500, null, null)).toBe(500);
  });
});

describe('calculateScheduleVariance', () => {
  it('returns positive value when behind schedule (15 vs 10 = +5)', () => {
    expect(calculateScheduleVariance(15, 10)).toBe(5);
  });

  it('returns negative value when ahead of schedule (8 vs 10 = -2)', () => {
    expect(calculateScheduleVariance(8, 10)).toBe(-2);
  });

  it('returns 0 when on schedule', () => {
    expect(calculateScheduleVariance(10, 10)).toBe(0);
  });
});

describe('calculatePercentCompleteByQuantity', () => {
  it('returns 40% for 800 SF of 2000 SF', () => {
    expect(calculatePercentCompleteByQuantity(800, 2000)).toBe(40);
  });

  it('caps at 100% when over original quantity', () => {
    expect(calculatePercentCompleteByQuantity(2200, 2000)).toBe(100);
  });

  it('returns 0 when original quantity is 0', () => {
    expect(calculatePercentCompleteByQuantity(800, 0)).toBe(0);
  });
});

describe('calculatePercentCompleteByRemainingDuration', () => {
  it('returns 40% when 6 of 10 days elapsed (4 remain)', () => {
    expect(calculatePercentCompleteByRemainingDuration(4, 10)).toBe(60);
  });

  it('returns 0 when nothing is done (10 of 10 remain)', () => {
    expect(calculatePercentCompleteByRemainingDuration(10, 10)).toBe(0);
  });

  it('returns 100 when complete (0 remain)', () => {
    expect(calculatePercentCompleteByRemainingDuration(0, 10)).toBe(100);
  });
});

// ── Full forecast ─────────────────────────────────────────────────────────────

describe('buildActivityProductionForecast — drywall example', () => {
  const forecast = buildActivityProductionForecast({
    originalQuantity: 2000,
    originalDurationDays: 10,
    originalFinishDay: 10,
    currentDay: 6,
    quantityComplete: 800,
    quantityRemaining: 1200,
    daysElapsed: 6,
    crewRemainingDurationDays: null,
    isComplete: false,
  });

  it('plannedProductionRate = 200 SF/day', () => {
    expect(forecast.plannedProductionRate).toBe(200);
  });

  it('actualProductionRate ≈ 133.33 SF/day', () => {
    expect(forecast.actualProductionRate).toBeCloseTo(133.33, 1);
  });

  it('forecastRemainingDays ≈ 9 days', () => {
    expect(forecast.forecastRemainingDays).toBeCloseTo(9, 0);
  });

  it('forecastFinishDay ≈ day 15', () => {
    expect(forecast.forecastFinishDay).toBeCloseTo(15, 0);
  });

  it('scheduleVarianceDays ≈ +5 (behind)', () => {
    expect(forecast.scheduleVarianceDays).toBeCloseTo(5, 0);
  });

  it('forecastBasis = actual-rate', () => {
    expect(forecast.forecastBasis).toBe('actual-rate');
  });

  it('issues a schedule-delay warning', () => {
    expect(forecast.warnings.some((w) => w.includes('behind'))).toBe(true);
  });

  it('issues a low-productivity warning (< 50% of planned? no — 133/200 = 67%)', () => {
    // 133/200 = 66.5%, which is > 50%, so no productivity warning
    expect(forecast.warnings.some((w) => w.includes('50%'))).toBe(false);
  });
});

describe('buildActivityProductionForecast — activity ahead of schedule', () => {
  const forecast = buildActivityProductionForecast({
    originalQuantity: 2000,
    originalDurationDays: 10,
    originalFinishDay: 10,
    currentDay: 5,
    quantityComplete: 1200,
    quantityRemaining: 800,
    daysElapsed: 5,
    crewRemainingDurationDays: 3,
    isComplete: false,
  });

  it('actualProductionRate = 240 SF/day', () => {
    expect(forecast.actualProductionRate).toBe(240);
  });

  it('forecastFinishDay < 10 (ahead of schedule)', () => {
    expect(forecast.forecastFinishDay).toBeLessThan(10);
  });

  it('scheduleVarianceDays is negative', () => {
    expect(forecast.scheduleVarianceDays).toBeLessThan(0);
  });

  it('no warnings', () => {
    expect(forecast.warnings).toHaveLength(0);
  });
});

describe('buildActivityProductionForecast — not yet started', () => {
  const forecast = buildActivityProductionForecast({
    originalQuantity: 2000,
    originalDurationDays: 10,
    originalFinishDay: 15,
    currentDay: 0,
    quantityComplete: 0,
    quantityRemaining: 2000,
    daysElapsed: 0,
    crewRemainingDurationDays: 10,
    isComplete: false,
  });

  it('actualProductionRate is null', () => {
    expect(forecast.actualProductionRate).toBeNull();
  });

  it('uses crew remaining duration estimate', () => {
    expect(forecast.forecastBasis).toBe('remaining-duration');
    expect(forecast.forecastRemainingDays).toBe(10);
  });
});

describe('buildActivityProductionForecast — complete', () => {
  const forecast = buildActivityProductionForecast({
    originalQuantity: 2000,
    originalDurationDays: 10,
    originalFinishDay: 10,
    currentDay: 9,
    quantityComplete: 2000,
    quantityRemaining: 0,
    daysElapsed: 9,
    crewRemainingDurationDays: 0,
    isComplete: true,
  });

  it('forecastRemainingDays = 0', () => {
    expect(forecast.forecastRemainingDays).toBe(0);
  });

  it('forecastBasis = complete', () => {
    expect(forecast.forecastBasis).toBe('complete');
  });

  it('no warnings', () => {
    expect(forecast.warnings).toHaveLength(0);
  });
});

describe('buildActivityProductionForecast — very low productivity warning', () => {
  const forecast = buildActivityProductionForecast({
    originalQuantity: 2000,
    originalDurationDays: 10,
    originalFinishDay: 10,
    currentDay: 8,
    quantityComplete: 200,     // only 10% done in 80% of planned time
    quantityRemaining: 1800,
    daysElapsed: 8,
    crewRemainingDurationDays: null,
    isComplete: false,
  });

  it('issues a low-productivity warning', () => {
    // actualRate = 25 SF/day vs planned 200 SF/day = 12.5% → < 50% threshold
    expect(forecast.warnings.some((w) => w.includes('50%'))).toBe(true);
  });
});

// ── Progress rollup ───────────────────────────────────────────────────────────

function makeUpdate(
  partial: Partial<ActivityProgressUpdate> & { quantityInstalledToday: number; quantityCompleteToDate: number; quantityRemainingAfterToday: number },
): ActivityProgressUpdate {
  return {
    id: Math.random().toString(36).slice(2),
    projectActivityId: 'act-001',
    projectId: 'proj-001',
    reportDate: '2026-06-10',
    actualStart: '2026-06-05',
    actualFinish: null,
    remainingDurationDays: null,
    unit: 'SF',
    crewSizeToday: 4,
    hoursWorkedToday: 8,
    equipmentUsedToday: [],
    weatherImpact: 'none',
    delayHoursToday: 0,
    delayReason: null,
    delayNotes: null,
    dailyNotes: null,
    reportedBy: null,
    createdAt: '2026-06-10T00:00:00Z',
    updatedAt: '2026-06-10T00:00:00Z',
    ...partial,
  };
}

describe('buildActivityProgressRollup', () => {
  it('returns zero rollup for empty updates', () => {
    const rollup = buildActivityProgressRollup('act-001', [], 2000, 10, 10, 6);
    expect(rollup.totalQuantityInstalled).toBe(0);
    expect(rollup.percentComplete).toBe(0);
    expect(rollup.forecast).toBeNull();
    expect(rollup.updateCount).toBe(0);
  });

  it('sums quantity installed across multiple days', () => {
    const updates = [
      makeUpdate({ reportDate: '2026-06-05', quantityInstalledToday: 300, quantityCompleteToDate: 300, quantityRemainingAfterToday: 1700 }),
      makeUpdate({ reportDate: '2026-06-06', quantityInstalledToday: 250, quantityCompleteToDate: 550, quantityRemainingAfterToday: 1450 }),
      makeUpdate({ reportDate: '2026-06-07', quantityInstalledToday: 250, quantityCompleteToDate: 800, quantityRemainingAfterToday: 1200 }),
    ];
    const rollup = buildActivityProgressRollup('act-001', updates, 2000, 10, 10, 7);
    expect(rollup.totalQuantityInstalled).toBe(800);
    expect(rollup.percentComplete).toBe(40);
    expect(rollup.updateCount).toBe(3);
  });

  it('accumulates man-hours across updates', () => {
    const updates = [
      makeUpdate({ reportDate: '2026-06-05', crewSizeToday: 4, hoursWorkedToday: 8, quantityInstalledToday: 400, quantityCompleteToDate: 400, quantityRemainingAfterToday: 1600 }),
      makeUpdate({ reportDate: '2026-06-06', crewSizeToday: 4, hoursWorkedToday: 8, quantityInstalledToday: 400, quantityCompleteToDate: 800, quantityRemainingAfterToday: 1200 }),
    ];
    const rollup = buildActivityProgressRollup('act-001', updates, 2000, 10, 10, 6);
    expect(rollup.totalManHoursWorked).toBe(64); // 2 days × 4 crew × 8 hours
  });

  it('marks activity as 100% complete when actualFinish is set', () => {
    const updates = [
      makeUpdate({
        reportDate: '2026-06-15',
        actualFinish: '2026-06-15',
        quantityInstalledToday: 100,
        quantityCompleteToDate: 2000,
        quantityRemainingAfterToday: 0,
      }),
    ];
    const rollup = buildActivityProgressRollup('act-001', updates, 2000, 10, 10, 15);
    expect(rollup.percentComplete).toBe(100);
    expect(rollup.forecast?.isComplete).toBe(true);
  });

  it('uses latest quantityCompleteToDate (not sum)', () => {
    // quantityCompleteToDate is a running total — we should use the latest, not add them up
    const updates = [
      makeUpdate({ reportDate: '2026-06-05', quantityInstalledToday: 400, quantityCompleteToDate: 400, quantityRemainingAfterToday: 1600 }),
      makeUpdate({ reportDate: '2026-06-06', quantityInstalledToday: 400, quantityCompleteToDate: 800, quantityRemainingAfterToday: 1200 }),
    ];
    const rollup = buildActivityProgressRollup('act-001', updates, 2000, 10, 10, 6);
    expect(rollup.forecast?.quantityComplete).toBe(800); // latest, not 400+800=1200
  });

  it('sets latestActualStart from earliest update with actualStart', () => {
    const updates = [
      makeUpdate({ reportDate: '2026-06-05', actualStart: '2026-06-05', quantityInstalledToday: 300, quantityCompleteToDate: 300, quantityRemainingAfterToday: 1700 }),
      makeUpdate({ reportDate: '2026-06-06', actualStart: null, quantityInstalledToday: 250, quantityCompleteToDate: 550, quantityRemainingAfterToday: 1450 }),
    ];
    const rollup = buildActivityProgressRollup('act-001', updates, 2000, 10, 10, 6);
    expect(rollup.latestActualStart).toBe('2026-06-05');
  });

  it('produces a production forecast', () => {
    const updates = [
      makeUpdate({ reportDate: '2026-06-05', quantityInstalledToday: 800, quantityCompleteToDate: 800, quantityRemainingAfterToday: 1200 }),
    ];
    const rollup = buildActivityProgressRollup('act-001', updates, 2000, 10, 10, 1);
    expect(rollup.forecast).not.toBeNull();
    expect(rollup.forecast!.forecastBasis).toBe('actual-rate');
  });
});
