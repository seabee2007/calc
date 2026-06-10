/**
 * Field Control — Progress Update Service
 *
 * Orchestrates field progress recording for construction activities:
 *   - Log daily progress (quantity, crew, delays)
 *   - Enforce baseline rules (create once, never modify)
 *   - Calculate rollup and forecast
 *   - Surface historical production data
 *
 * CPM manual rules enforced here:
 *   - Progress updates NEVER modify the baseline.
 *   - Each activity gets one baseline (immutable after creation).
 *   - remainingDuration from the crew is the primary CPM input.
 */
import {
  fetchProgressUpdates,
  saveProgressUpdate,
  deleteProgressUpdate,
  fetchActivityBaseline,
  fetchProjectBaselines,
  createActivityBaseline,
  fetchProjectProgressUpdates,
} from '../infrastructure/progressUpdateRepository';
import { buildActivityProgressRollup } from '../domain/activityProgressCalculations';
import type {
  ActivityProgressUpdate,
  ActivityProgressRollup,
  ActivityBaseline,
  CreateProgressUpdateInput,
} from '../domain/activityProgressTypes';
import type { RepositoryResult } from '../infrastructure/estimateDbTypes';

// ── Progress update service ───────────────────────────────────────────────────

/**
 * Log or update a daily progress record for one activity.
 * Calculates running totals from prior updates automatically.
 */
export async function logDailyProgress(
  input: CreateProgressUpdateInput,
): Promise<RepositoryResult<ActivityProgressUpdate>> {
  return saveProgressUpdate(input);
}

/**
 * Delete a daily progress record.
 */
export async function removeProgressUpdate(
  updateId: string,
): Promise<RepositoryResult<boolean>> {
  return deleteProgressUpdate(updateId);
}

/**
 * Load all progress updates for one activity and compute the rollup.
 * Uses the activity's original quantity and duration to calculate forecast.
 */
export async function getActivityProgressRollup(
  projectActivityId: string,
  originalQuantity: number,
  originalDurationDays: number,
  originalFinishDay: number,
  currentDay: number,
): Promise<RepositoryResult<ActivityProgressRollup>> {
  const result = await fetchProgressUpdates(projectActivityId);
  if (result.error) return { data: null, error: result.error };

  const rollup = buildActivityProgressRollup(
    projectActivityId,
    result.data!,
    originalQuantity,
    originalDurationDays,
    originalFinishDay,
    currentDay,
  );
  return { data: rollup, error: null };
}

/**
 * Load raw progress updates for one activity (for display in a log table).
 */
export async function getActivityProgressUpdates(
  projectActivityId: string,
): Promise<RepositoryResult<ActivityProgressUpdate[]>> {
  return fetchProgressUpdates(projectActivityId);
}

/**
 * Load all progress updates for a project within an optional date range.
 */
export async function getProjectFieldReport(
  projectId: string,
  fromDate?: string,
  toDate?: string,
): Promise<RepositoryResult<ActivityProgressUpdate[]>> {
  return fetchProjectProgressUpdates(projectId, fromDate, toDate);
}

// ── Baseline service ──────────────────────────────────────────────────────────

/**
 * Create the baseline for a project activity.
 *
 * Rules:
 *   - A baseline may only be created once per project activity.
 *   - If a baseline already exists, this call returns an error.
 *   - The baseline is immutable once created.
 */
export async function approveActivityBaseline(
  input: Omit<ActivityBaseline, 'id' | 'createdAt'>,
): Promise<RepositoryResult<ActivityBaseline>> {
  // Guard: check if one already exists
  const existing = await fetchActivityBaseline(input.projectActivityId);
  if (existing.error) return { data: null, error: existing.error };
  if (existing.data !== null) {
    return {
      data: null,
      error: `A baseline already exists for activity ${input.projectActivityId}. Baselines are immutable once approved.`,
    };
  }
  return createActivityBaseline(input);
}

/**
 * Load the baseline for one activity.
 */
export async function getActivityBaseline(
  projectActivityId: string,
): Promise<RepositoryResult<ActivityBaseline | null>> {
  return fetchActivityBaseline(projectActivityId);
}

/**
 * Load all baselines for a project (for project-level baseline report).
 */
export async function getProjectBaselines(
  projectId: string,
): Promise<RepositoryResult<ActivityBaseline[]>> {
  return fetchProjectBaselines(projectId);
}

// ── Historical production rate ────────────────────────────────────────────────

/**
 * Derive the actual production rate from completed updates.
 * Used to feed historical rate comparisons in the UI.
 *
 * Returns null when the activity has not started or has no quantity data.
 */
export async function getHistoricalProductionRate(
  projectActivityId: string,
): Promise<RepositoryResult<{
  actualProductionRate: number | null;
  totalQuantityInstalled: number;
  totalDaysWorked: number;
  unit: string;
} | null>> {
  const result = await fetchProgressUpdates(projectActivityId);
  if (result.error) return { data: null, error: result.error };

  const updates = result.data!;
  if (updates.length === 0) return { data: null, error: null };

  const totalQuantityInstalled = updates.reduce((s, u) => s + u.quantityInstalledToday, 0);
  const totalDaysWorked = updates.length;
  const unit = updates[0].unit;

  const actualProductionRate =
    totalDaysWorked > 0 ? totalQuantityInstalled / totalDaysWorked : null;

  return {
    data: {
      actualProductionRate,
      totalQuantityInstalled,
      totalDaysWorked,
      unit,
    },
    error: null,
  };
}
