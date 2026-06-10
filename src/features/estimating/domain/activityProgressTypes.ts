/**
 * Field Control — Activity Progress Domain Types
 *
 * The CPM manual says to track Actual Start, Remaining Duration, and Actual
 * Finish as the primary progress inputs. Percent complete alone is insufficient
 * because it can create calculation errors when used with PDM relationships
 * and lags.
 *
 * This module defines:
 *   ActivityProgressUpdate  — one daily or periodic progress record
 *   ActivityProductionForecast — derived forecast from actual data
 *   ActivityBaseline        — immutable snapshot of original plan
 *   ActivityProgressRollup  — summary across all updates for one activity
 */

// ── Progress Update ────────────────────────────────────────────────────────────

export type DelayReason =
  | 'weather'
  | 'material_shortage'
  | 'equipment_breakdown'
  | 'labor_shortage'
  | 'design_change'
  | 'rfi_hold'
  | 'inspection_hold'
  | 'safety_stop'
  | 'other';

export type WeatherImpact = 'none' | 'partial_day' | 'full_day_lost';

/**
 * One progress record for a single construction activity on a given date.
 * Multiple records per activity are allowed (one per day).
 */
export interface ActivityProgressUpdate {
  id: string;
  projectActivityId: string;
  projectId: string;

  /** Calendar date of this progress record (ISO 8601 date string, e.g. "2026-06-15"). */
  reportDate: string;

  // ── Actual schedule fields (CPM manual primary inputs) ──────────────────────
  /** ISO 8601 date string; null until construction actually begins. */
  actualStart: string | null;
  /** ISO 8601 date string; null until construction is complete. */
  actualFinish: string | null;
  /**
   * Crew estimate of days still needed to complete this activity.
   * This is the primary CPM update input — preferred over percent complete.
   */
  remainingDurationDays: number | null;

  // ── Production quantity tracking ────────────────────────────────────────────
  /** Quantity installed today (in activity's primary unit). */
  quantityInstalledToday: number;
  /** Running total quantity installed through this report date. */
  quantityCompleteToDate: number;
  /** Quantity still remaining after this record (original − complete). */
  quantityRemainingAfterToday: number;
  /** Primary unit of measure (SF, CYD, LF, EA, etc.). */
  unit: string;

  // ── Crew and resources ──────────────────────────────────────────────────────
  /** Number of workers on site today. */
  crewSizeToday: number;
  /** Hours worked by full crew today. */
  hoursWorkedToday: number;
  /** Equipment identifiers used today (free-text array). */
  equipmentUsedToday: string[];

  // ── Weather and delays ──────────────────────────────────────────────────────
  weatherImpact: WeatherImpact;
  delayHoursToday: number;
  delayReason: DelayReason | null;
  delayNotes: string | null;

  // ── Field notes ─────────────────────────────────────────────────────────────
  dailyNotes: string | null;

  // ── Audit ───────────────────────────────────────────────────────────────────
  reportedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Production Forecast ───────────────────────────────────────────────────────

/**
 * Derived forecast based on actual production performance.
 * Calculated by activityProgressCalculations.ts — never stored directly.
 */
export interface ActivityProductionForecast {
  /** Original planned quantity from the estimate. */
  originalQuantity: number;
  /** Original estimate duration (days). */
  originalDurationDays: number;
  /** Original production rate = originalQuantity / originalDurationDays. */
  plannedProductionRate: number;

  /** Quantity installed to date (sum of all updates). */
  quantityComplete: number;
  /** Quantity still to install. */
  quantityRemaining: number;
  /** Days elapsed since actual start. */
  daysElapsed: number;

  /**
   * Actual production rate = quantityComplete / daysElapsed.
   * null when daysElapsed === 0 (not yet started).
   */
  actualProductionRate: number | null;

  /**
   * Forecast days to finish remaining work.
   * = quantityRemaining / actualProductionRate
   * Falls back to remainingDurationDays when actualProductionRate is null.
   */
  forecastRemainingDays: number;

  /**
   * Forecast finish day (project-day offset from start day 0).
   * = currentDay + forecastRemainingDays
   */
  forecastFinishDay: number;

  /** Schedule variance in days: negative = ahead, positive = behind. */
  scheduleVarianceDays: number;

  /** Whether the activity is complete. */
  isComplete: boolean;

  /** Source of the forecast: 'actual-rate' or 'remaining-duration' estimate. */
  forecastBasis: 'actual-rate' | 'remaining-duration' | 'complete';

  warnings: string[];
}

// ── Baseline ──────────────────────────────────────────────────────────────────

/**
 * Rules enforced by the service:
 *  - A baseline may only be created once per project_activity.
 *  - A baseline cannot be modified after creation.
 *  - Progress updates NEVER modify the baseline.
 *  - Schedule revisions require a reason and create a new current schedule.
 */
export interface ActivityBaseline {
  id: string;
  projectActivityId: string;
  projectId: string;

  /** ISO 8601 date string when the baseline was approved. */
  baselinedAt: string;
  baselinedBy: string | null;
  baselineReason: string | null;

  // ── Frozen plan values ──────────────────────────────────────────────────────
  baselineDurationDays: number;
  baselineCrewSize: number;
  baselineManHours: number;
  baselineManDays: number;
  baselineQuantity: number;
  baselineUnit: string;

  /** Day-offset from project start (from CPM early start). */
  baselineEarlyStartDay: number | null;
  /** Day-offset from project start (from CPM early finish). */
  baselineEarlyFinishDay: number | null;

  createdAt: string;
}

// ── Progress Rollup ───────────────────────────────────────────────────────────

/**
 * Aggregate summary derived from all progress updates for one activity.
 * Used to display a condensed status on the ConstructionActivityCard.
 */
export interface ActivityProgressRollup {
  activityId: string;
  totalQuantityInstalled: number;
  totalManHoursWorked: number;
  totalDaysWorked: number;
  totalDelayHours: number;

  latestActualStart: string | null;
  latestActualFinish: string | null;
  latestRemainingDurationDays: number | null;
  latestReportDate: string | null;

  /** 0–100 percent. Based on quantity if available, else remaining duration. */
  percentComplete: number;

  forecast: ActivityProductionForecast | null;

  /** Count of progress records. */
  updateCount: number;
}

// ── Input for a new progress record ──────────────────────────────────────────

export interface CreateProgressUpdateInput {
  projectActivityId: string;
  projectId: string;
  reportDate: string;
  actualStart?: string | null;
  actualFinish?: string | null;
  remainingDurationDays?: number | null;
  quantityInstalledToday: number;
  quantityCompleteToDate: number;
  quantityRemainingAfterToday: number;
  unit: string;
  crewSizeToday: number;
  hoursWorkedToday: number;
  equipmentUsedToday?: string[];
  weatherImpact?: WeatherImpact;
  delayHoursToday?: number;
  delayReason?: DelayReason | null;
  delayNotes?: string | null;
  dailyNotes?: string | null;
  reportedBy?: string | null;
}
