/**
 * Field Control — Activity Progress Calculations
 *
 * Pure functions implementing the CPM manual's production-based forecasting:
 *
 *   plannedProductionRate   = originalQuantity / originalDurationDays
 *   actualProductionRate    = quantityComplete / daysElapsed
 *   forecastRemainingDays   = quantityRemaining / actualProductionRate
 *   forecastFinishDay       = currentDay + forecastRemainingDays
 *   scheduleVarianceDays    = forecastFinishDay − originalFinishDay
 *
 * Example from roadmap (2,000 SF drywall):
 *   originalQuantity = 2,000 SF
 *   originalDurationDays = 10 days
 *   plannedProductionRate = 200 SF/day
 *
 *   After 6 days: quantityComplete = 800 SF
 *   actualProductionRate = 800 / 6 = 133 SF/day
 *   remaining = 1,200 SF / 133 SF/day = ~9 more days
 *   forecastTotal = 6 + 9 = 15 days (5 days behind)
 *
 * The CPM manual specifically warns that percent-complete alone can create
 * incorrect schedule outputs. Remaining duration from the crew is the
 * authoritative input; production-rate forecast is the cross-check.
 */
import type {
  ActivityProgressUpdate,
  ActivityProductionForecast,
  ActivityProgressRollup,
} from './activityProgressTypes';

// ── Core calculation primitives ───────────────────────────────────────────────

/**
 * Planned production rate in quantity/day.
 * Returns null when originalDurationDays ≤ 0 (invalid input).
 */
export function calculatePlannedProductionRate(
  originalQuantity: number,
  originalDurationDays: number,
): number | null {
  if (originalDurationDays <= 0 || originalQuantity < 0) return null;
  return originalQuantity / originalDurationDays;
}

/**
 * Actual production rate in quantity/day based on work completed so far.
 * Returns null when daysElapsed ≤ 0 (not yet started or no elapsed time).
 */
export function calculateActualProductionRate(
  quantityComplete: number,
  daysElapsed: number,
): number | null {
  if (daysElapsed <= 0) return null;
  if (quantityComplete < 0) return null;
  return quantityComplete / daysElapsed;
}

/**
 * Forecast remaining days to complete given remaining quantity and actual rate.
 *
 * Falls back to `fallbackRemainingDays` (crew estimate) when:
 *   - actualRate is null (activity not yet started)
 *   - actualRate is 0 (no production recorded)
 *
 * Returns 0 when quantity is fully complete.
 */
export function forecastRemainingDays(
  quantityRemaining: number,
  actualProductionRate: number | null,
  fallbackRemainingDays: number | null = null,
): number {
  if (quantityRemaining <= 0) return 0;
  if (actualProductionRate !== null && actualProductionRate > 0) {
    return quantityRemaining / actualProductionRate;
  }
  return fallbackRemainingDays ?? quantityRemaining; // last resort: 1 unit/day
}

/**
 * Schedule variance in days.
 * Negative = ahead of schedule, positive = behind.
 */
export function calculateScheduleVariance(
  forecastFinishDay: number,
  originalFinishDay: number,
): number {
  return forecastFinishDay - originalFinishDay;
}

/**
 * Percent complete based on quantity (0–100).
 * Falls back to remaining-duration estimate when original quantity is 0.
 */
export function calculatePercentCompleteByQuantity(
  quantityComplete: number,
  originalQuantity: number,
): number {
  if (originalQuantity <= 0) return 0;
  return Math.min(100, Math.round((quantityComplete / originalQuantity) * 100));
}

/**
 * Percent complete based on remaining duration (0–100).
 */
export function calculatePercentCompleteByRemainingDuration(
  remainingDurationDays: number,
  originalDurationDays: number,
): number {
  if (originalDurationDays <= 0) return 0;
  const elapsed = originalDurationDays - remainingDurationDays;
  return Math.min(100, Math.max(0, Math.round((elapsed / originalDurationDays) * 100)));
}

// ── Full forecast ─────────────────────────────────────────────────────────────

export interface ForecastInput {
  originalQuantity: number;
  originalDurationDays: number;
  /** Day-offset from project start when this activity was planned to finish. */
  originalFinishDay: number;
  /** Current project day offset (0 = project start). */
  currentDay: number;
  quantityComplete: number;
  quantityRemaining: number;
  daysElapsed: number;
  /** Crew's own estimate of remaining days (primary CPM input). */
  crewRemainingDurationDays: number | null;
  isComplete: boolean;
}

/**
 * Build a full ActivityProductionForecast from field data.
 * This is the authoritative field-control calculation — matches the CPM manual
 * production-rate method.
 */
export function buildActivityProductionForecast(
  input: ForecastInput,
): ActivityProductionForecast {
  const warnings: string[] = [];

  const plannedProductionRate = calculatePlannedProductionRate(
    input.originalQuantity,
    input.originalDurationDays,
  );
  if (plannedProductionRate === null) {
    warnings.push('Original quantity or duration is zero — planned production rate unavailable.');
  }

  const actualProductionRate = calculateActualProductionRate(
    input.quantityComplete,
    input.daysElapsed,
  );

  // Determine forecast remaining days
  let forecastRemainingDaysValue: number;
  let forecastBasis: ActivityProductionForecast['forecastBasis'];

  if (input.isComplete) {
    forecastRemainingDaysValue = 0;
    forecastBasis = 'complete';
  } else if (actualProductionRate !== null && actualProductionRate > 0 && input.quantityRemaining > 0) {
    forecastRemainingDaysValue = forecastRemainingDays(
      input.quantityRemaining,
      actualProductionRate,
    );
    forecastBasis = 'actual-rate';
  } else if (input.crewRemainingDurationDays !== null) {
    forecastRemainingDaysValue = Math.max(0, input.crewRemainingDurationDays);
    forecastBasis = 'remaining-duration';
  } else {
    // Final fallback: assume original duration remains
    forecastRemainingDaysValue = input.originalDurationDays;
    forecastBasis = 'remaining-duration';
    warnings.push('No actual production data or crew estimate — using original duration as forecast.');
  }

  const forecastFinishDay = input.currentDay + forecastRemainingDaysValue;
  const scheduleVarianceDays = calculateScheduleVariance(forecastFinishDay, input.originalFinishDay);

  if (scheduleVarianceDays >= 5) {
    warnings.push(
      `Activity is forecast to finish ${scheduleVarianceDays.toFixed(1)} days behind the baseline.`,
    );
  }
  if (actualProductionRate !== null && plannedProductionRate !== null && plannedProductionRate > 0) {
    const productivityRatio = actualProductionRate / plannedProductionRate;
    if (productivityRatio < 0.5) {
      warnings.push(
        `Actual production rate (${actualProductionRate.toFixed(2)}/day) is less than 50% of planned (${plannedProductionRate.toFixed(2)}/day).`,
      );
    }
  }

  return {
    originalQuantity: input.originalQuantity,
    originalDurationDays: input.originalDurationDays,
    plannedProductionRate: plannedProductionRate ?? 0,
    quantityComplete: input.quantityComplete,
    quantityRemaining: input.quantityRemaining,
    daysElapsed: input.daysElapsed,
    actualProductionRate,
    forecastRemainingDays: forecastRemainingDaysValue,
    forecastFinishDay,
    scheduleVarianceDays,
    isComplete: input.isComplete,
    forecastBasis,
    warnings,
  };
}

// ── Progress rollup from update list ─────────────────────────────────────────

/**
 * Aggregate all progress updates for one activity into a single rollup.
 * Suitable for display on the activity card.
 */
export function buildActivityProgressRollup(
  activityId: string,
  updates: ActivityProgressUpdate[],
  originalQuantity: number,
  originalDurationDays: number,
  originalFinishDay: number,
  currentDay: number,
): ActivityProgressRollup {
  if (updates.length === 0) {
    return {
      activityId,
      totalQuantityInstalled: 0,
      totalManHoursWorked: 0,
      totalDaysWorked: 0,
      totalDelayHours: 0,
      latestActualStart: null,
      latestActualFinish: null,
      latestRemainingDurationDays: null,
      latestReportDate: null,
      percentComplete: 0,
      forecast: null,
      updateCount: 0,
    };
  }

  // Sort chronologically
  const sorted = [...updates].sort((a, b) => a.reportDate.localeCompare(b.reportDate));
  const latest = sorted[sorted.length - 1];

  const totalQuantityInstalled = sorted.reduce((s, u) => s + u.quantityInstalledToday, 0);
  const totalManHoursWorked = sorted.reduce(
    (s, u) => s + u.crewSizeToday * u.hoursWorkedToday,
    0,
  );
  const totalDaysWorked = sorted.length;
  const totalDelayHours = sorted.reduce((s, u) => s + u.delayHoursToday, 0);

  // Use the latest quantityCompleteToDate (it's a running total, not per-day)
  const quantityComplete = latest.quantityCompleteToDate;
  const quantityRemaining = Math.max(0, latest.quantityRemainingAfterToday);
  const isComplete = !!latest.actualFinish || quantityRemaining === 0;

  const percentComplete = isComplete
    ? 100
    : calculatePercentCompleteByQuantity(quantityComplete, originalQuantity);

  // Find actual start: earliest non-null actualStart
  const actualStart =
    sorted.find((u) => u.actualStart)?.actualStart ?? null;

  // Days elapsed since actual start
  const daysElapsed = actualStart ? totalDaysWorked : 0;

  const forecast = buildActivityProductionForecast({
    originalQuantity,
    originalDurationDays,
    originalFinishDay,
    currentDay,
    quantityComplete,
    quantityRemaining,
    daysElapsed,
    crewRemainingDurationDays: latest.remainingDurationDays,
    isComplete,
  });

  return {
    activityId,
    totalQuantityInstalled,
    totalManHoursWorked,
    totalDaysWorked,
    totalDelayHours,
    latestActualStart: actualStart,
    latestActualFinish: latest.actualFinish,
    latestRemainingDurationDays: latest.remainingDurationDays,
    latestReportDate: latest.reportDate,
    percentComplete,
    forecast,
    updateCount: updates.length,
  };
}
