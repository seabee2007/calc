/**
 * Field Control — Progress Update Repository
 *
 * Wraps Supabase calls for:
 *   project_activity_progress_updates
 *   project_activity_baselines
 *
 * Returns RepositoryResult<T> — never throws for DB failures.
 */
import { supabase } from '../../../lib/supabase';
import type { RepositoryResult } from './estimateDbTypes';
import type {
  ActivityProgressUpdate,
  ActivityBaseline,
  CreateProgressUpdateInput,
} from '../domain/activityProgressTypes';

// ── DB row shapes ─────────────────────────────────────────────────────────────

interface ProgressUpdateRow {
  id: string;
  project_activity_id: string;
  project_id: string;
  report_date: string;
  actual_start: string | null;
  actual_finish: string | null;
  remaining_duration_days: number | null;
  quantity_installed_today: number;
  quantity_complete_to_date: number;
  quantity_remaining_after: number;
  unit: string;
  crew_size_today: number;
  hours_worked_today: number;
  equipment_used_today: string[];
  weather_impact: string;
  delay_hours_today: number;
  delay_reason: string | null;
  delay_notes: string | null;
  daily_notes: string | null;
  reported_by: string | null;
  created_at: string;
  updated_at: string;
}

interface BaselineRow {
  id: string;
  project_activity_id: string;
  project_id: string;
  baselined_at: string;
  baselined_by: string | null;
  baseline_reason: string | null;
  baseline_duration_days: number;
  baseline_crew_size: number;
  baseline_man_hours: number;
  baseline_man_days: number;
  baseline_quantity: number;
  baseline_unit: string;
  baseline_early_start_day: number | null;
  baseline_early_finish_day: number | null;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ok<T>(data: T): RepositoryResult<T> {
  return { data, error: null };
}

function fail<T>(err: unknown): RepositoryResult<T> {
  const msg =
    err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err);
  return { data: null, error: msg };
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapUpdateFromRow(row: ProgressUpdateRow): ActivityProgressUpdate {
  return {
    id: row.id,
    projectActivityId: row.project_activity_id,
    projectId: row.project_id,
    reportDate: row.report_date,
    actualStart: row.actual_start,
    actualFinish: row.actual_finish,
    remainingDurationDays: row.remaining_duration_days,
    quantityInstalledToday: Number(row.quantity_installed_today),
    quantityCompleteToDate: Number(row.quantity_complete_to_date),
    quantityRemainingAfterToday: Number(row.quantity_remaining_after),
    unit: row.unit,
    crewSizeToday: row.crew_size_today,
    hoursWorkedToday: Number(row.hours_worked_today),
    equipmentUsedToday: row.equipment_used_today ?? [],
    weatherImpact: row.weather_impact as ActivityProgressUpdate['weatherImpact'],
    delayHoursToday: Number(row.delay_hours_today),
    delayReason: (row.delay_reason as ActivityProgressUpdate['delayReason']) ?? null,
    delayNotes: row.delay_notes,
    dailyNotes: row.daily_notes,
    reportedBy: row.reported_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBaselineFromRow(row: BaselineRow): ActivityBaseline {
  return {
    id: row.id,
    projectActivityId: row.project_activity_id,
    projectId: row.project_id,
    baselinedAt: row.baselined_at,
    baselinedBy: row.baselined_by,
    baselineReason: row.baseline_reason,
    baselineDurationDays: Number(row.baseline_duration_days),
    baselineCrewSize: row.baseline_crew_size,
    baselineManHours: Number(row.baseline_man_hours),
    baselineManDays: Number(row.baseline_man_days),
    baselineQuantity: Number(row.baseline_quantity),
    baselineUnit: row.baseline_unit,
    baselineEarlyStartDay: row.baseline_early_start_day,
    baselineEarlyFinishDay: row.baseline_early_finish_day,
    createdAt: row.created_at,
  };
}

// ── Progress update CRUD ──────────────────────────────────────────────────────

/**
 * Load all progress updates for a given project activity, ordered by date.
 */
export async function fetchProgressUpdates(
  projectActivityId: string,
): Promise<RepositoryResult<ActivityProgressUpdate[]>> {
  try {
    const { data, error } = await supabase
      .from('project_activity_progress_updates')
      .select('*')
      .eq('project_activity_id', projectActivityId)
      .order('report_date', { ascending: true });

    if (error) return fail(error.message);
    return ok((data as ProgressUpdateRow[]).map(mapUpdateFromRow));
  } catch (err) {
    return fail(err);
  }
}

/**
 * Load all progress updates for a project (all activities) for a date range.
 * Used by the project-level field-control dashboard.
 */
export async function fetchProjectProgressUpdates(
  projectId: string,
  fromDate?: string,
  toDate?: string,
): Promise<RepositoryResult<ActivityProgressUpdate[]>> {
  try {
    let query = supabase
      .from('project_activity_progress_updates')
      .select('*')
      .eq('project_id', projectId)
      .order('report_date', { ascending: false });

    if (fromDate) query = query.gte('report_date', fromDate);
    if (toDate) query = query.lte('report_date', toDate);

    const { data, error } = await query;
    if (error) return fail(error.message);
    return ok((data as ProgressUpdateRow[]).map(mapUpdateFromRow));
  } catch (err) {
    return fail(err);
  }
}

/**
 * Save or update a daily progress record.
 * Upserts on (project_activity_id, report_date).
 */
export async function saveProgressUpdate(
  input: CreateProgressUpdateInput,
): Promise<RepositoryResult<ActivityProgressUpdate>> {
  try {
    const row = {
      project_activity_id: input.projectActivityId,
      project_id: input.projectId,
      report_date: input.reportDate,
      actual_start: input.actualStart ?? null,
      actual_finish: input.actualFinish ?? null,
      remaining_duration_days: input.remainingDurationDays ?? null,
      quantity_installed_today: input.quantityInstalledToday,
      quantity_complete_to_date: input.quantityCompleteToDate,
      quantity_remaining_after: input.quantityRemainingAfterToday,
      unit: input.unit,
      crew_size_today: input.crewSizeToday,
      hours_worked_today: input.hoursWorkedToday,
      equipment_used_today: input.equipmentUsedToday ?? [],
      weather_impact: input.weatherImpact ?? 'none',
      delay_hours_today: input.delayHoursToday ?? 0,
      delay_reason: input.delayReason ?? null,
      delay_notes: input.delayNotes ?? null,
      daily_notes: input.dailyNotes ?? null,
      reported_by: input.reportedBy ?? null,
    };

    const { data, error } = await supabase
      .from('project_activity_progress_updates')
      .upsert(row, { onConflict: 'project_activity_id,report_date' })
      .select()
      .single();

    if (error) return fail(error.message);
    return ok(mapUpdateFromRow(data as ProgressUpdateRow));
  } catch (err) {
    return fail(err);
  }
}

/**
 * Delete a single progress update by ID.
 */
export async function deleteProgressUpdate(
  updateId: string,
): Promise<RepositoryResult<boolean>> {
  try {
    const { error } = await supabase
      .from('project_activity_progress_updates')
      .delete()
      .eq('id', updateId);

    if (error) return fail(error.message);
    return ok(true);
  } catch (err) {
    return fail(err);
  }
}

// ── Baseline CRUD ─────────────────────────────────────────────────────────────

/**
 * Load the baseline for a project activity, if one has been approved.
 */
export async function fetchActivityBaseline(
  projectActivityId: string,
): Promise<RepositoryResult<ActivityBaseline | null>> {
  try {
    const { data, error } = await supabase
      .from('project_activity_baselines')
      .select('*')
      .eq('project_activity_id', projectActivityId)
      .maybeSingle();

    if (error) return fail(error.message);
    return ok(data ? mapBaselineFromRow(data as BaselineRow) : null);
  } catch (err) {
    return fail(err);
  }
}

/**
 * Load baselines for all activities in a project.
 */
export async function fetchProjectBaselines(
  projectId: string,
): Promise<RepositoryResult<ActivityBaseline[]>> {
  try {
    const { data, error } = await supabase
      .from('project_activity_baselines')
      .select('*')
      .eq('project_id', projectId);

    if (error) return fail(error.message);
    return ok((data as BaselineRow[]).map(mapBaselineFromRow));
  } catch (err) {
    return fail(err);
  }
}

/**
 * Create a new baseline for a project activity.
 * Will fail at DB level if a baseline already exists (unique constraint).
 */
export async function createActivityBaseline(
  baseline: Omit<ActivityBaseline, 'id' | 'createdAt'>,
): Promise<RepositoryResult<ActivityBaseline>> {
  try {
    const { data, error } = await supabase
      .from('project_activity_baselines')
      .insert({
        project_activity_id: baseline.projectActivityId,
        project_id: baseline.projectId,
        baselined_at: baseline.baselinedAt,
        baselined_by: baseline.baselinedBy,
        baseline_reason: baseline.baselineReason,
        baseline_duration_days: baseline.baselineDurationDays,
        baseline_crew_size: baseline.baselineCrewSize,
        baseline_man_hours: baseline.baselineManHours,
        baseline_man_days: baseline.baselineManDays,
        baseline_quantity: baseline.baselineQuantity,
        baseline_unit: baseline.baselineUnit,
        baseline_early_start_day: baseline.baselineEarlyStartDay,
        baseline_early_finish_day: baseline.baselineEarlyFinishDay,
      })
      .select()
      .single();

    if (error) return fail(error.message);
    return ok(mapBaselineFromRow(data as BaselineRow));
  } catch (err) {
    return fail(err);
  }
}
