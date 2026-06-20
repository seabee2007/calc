/**
 * NTRP activity data repository.
 *
 * Wraps Supabase calls for the NTRP schema tables.
 * Returns RepositoryResult<T> — never throws for DB failures.
 *
 * Responsibilities:
 *   - Save / load project_construction_activities + their line items.
 *   - Read production_rates and templates from reference tables.
 *   - Seed reference tables (service-role operations, used by CLI/scripts).
 */
import { supabase } from '../../../lib/supabase';
import type { ProductionRate } from '../domain/constructionActivityTypes';
import type { RepositoryResult } from './estimateDbTypes';
import type {
  ProductionRateRow,
  ProjectConstructionActivityRow,
  ProjectActivityLineItemRow,
} from './activityDbTypes';
import {
  mapProjectActivityFromRow,
  mapProjectLineItemFromRow,
  mapProjectActivityToInsert,
  mapProjectLineItemToInsert,
  mapProductionRateFromRow,
} from './activityMappers';
import type {
  ProjectConstructionActivity,
  ProjectActivityLineItem,
} from '../domain/constructionActivityTypes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function success<T>(data: T): RepositoryResult<T> {
  return { data, error: null };
}

function failure<T>(error: unknown): RepositoryResult<T> {
  const msg =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : JSON.stringify(error);
  return { data: null, error: msg };
}

// ---------------------------------------------------------------------------
// Reference data reads
// ---------------------------------------------------------------------------

/**
 * Load all active production rates, optionally filtered by division code.
 */
export async function fetchProductionRates(
  divisionCode?: string,
): Promise<RepositoryResult<ProductionRate[]>> {
  try {
    let query = supabase
      .from('production_rates')
      .select('*')
      .eq('is_active', true)
      .order('division_code')
      .order('masterformat_code');

    if (divisionCode) {
      query = query.eq('division_code', divisionCode);
    }

    const { data, error } = await query;
    if (error) return failure(error.message);
    const rates = (data as ProductionRateRow[]).map(mapProductionRateFromRow);
    return success(rates);
  } catch (err) {
    return failure(err);
  }
}

/**
 * Load production rates by IDs (for look-up during rollup / UI display).
 */
export async function fetchProductionRatesByIds(
  ids: string[],
): Promise<RepositoryResult<Map<string, ProductionRate>>> {
  if (ids.length === 0) return success(new Map());

  try {
    const { data, error } = await supabase
      .from('production_rates')
      .select('*')
      .in('id', ids);

    if (error) return failure(error.message);
    const map = new Map<string, ProductionRate>(
      (data as ProductionRateRow[]).map((row) => [row.id, mapProductionRateFromRow(row)]),
    );
    return success(map);
  } catch (err) {
    return failure(err);
  }
}

// ---------------------------------------------------------------------------
// Project construction activities
// ---------------------------------------------------------------------------

/**
 * Load all project construction activities for a project, optionally filtered
 * by estimate_id. Results are ordered by sort_order then created_at.
 */
export async function fetchProjectActivities(
  projectId: string,
  estimateId?: string,
): Promise<RepositoryResult<ProjectConstructionActivity[]>> {
  try {
    let query = supabase
      .from('project_construction_activities')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order')
      .order('created_at');

    if (estimateId) {
      query = query.eq('estimate_id', estimateId);
    }

    const { data, error } = await query;
    if (error) return failure(error.message);
    const activities = (data as ProjectConstructionActivityRow[]).map(mapProjectActivityFromRow);
    return success(activities);
  } catch (err) {
    return failure(err);
  }
}

/**
 * Load a single project construction activity by ID.
 */
export async function fetchProjectActivityById(
  id: string,
): Promise<RepositoryResult<ProjectConstructionActivity>> {
  try {
    const { data, error } = await supabase
      .from('project_construction_activities')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return failure(error.message);
    return success(mapProjectActivityFromRow(data as ProjectConstructionActivityRow));
  } catch (err) {
    return failure(err);
  }
}

/**
 * Insert a new project construction activity.
 * Returns the saved activity (with server-assigned id/timestamps).
 */
export async function insertProjectActivity(
  activity: Omit<ProjectConstructionActivity, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<RepositoryResult<ProjectConstructionActivity>> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const payload = {
      ...mapProjectActivityToInsert(activity as ProjectConstructionActivity),
      created_by: userData.user?.id ?? null,
    };

    const { data, error } = await supabase
      .from('project_construction_activities')
      .insert(payload)
      .select('*')
      .single();

    if (error) return failure(error.message);
    return success(mapProjectActivityFromRow(data as ProjectConstructionActivityRow));
  } catch (err) {
    return failure(err);
  }
}

/**
 * Update an existing project construction activity.
 */
export async function updateProjectActivity(
  id: string,
  updates: Partial<ProjectConstructionActivity>,
): Promise<RepositoryResult<ProjectConstructionActivity>> {
  try {
    const payload: Record<string, unknown> = {};

    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.baseTitle !== undefined) payload.base_title = updates.baseTitle ?? null;
    if (updates.instanceLabel !== undefined) payload.instance_label = updates.instanceLabel ?? null;
    if (updates.location !== undefined) payload.location = updates.location ?? null;
    if (updates.drawingReference !== undefined) payload.drawing_reference = updates.drawingReference ?? null;
    if (updates.phase !== undefined) payload.phase = updates.phase ?? null;
    if (updates.notes !== undefined) payload.notes = updates.notes ?? null;
    if (updates.activitySequence !== undefined) payload.activity_sequence = updates.activitySequence ?? null;
    if (updates.instanceSequence !== undefined) payload.instance_sequence = updates.instanceSequence ?? null;
    if (updates.description !== undefined) payload.description = updates.description ?? null;
    if (updates.scheduleEnabled !== undefined) payload.schedule_enabled = updates.scheduleEnabled;
    if (updates.crewSize !== undefined) payload.crew_size = updates.crewSize;
    if (updates.hoursPerDay !== undefined) payload.hours_per_day = updates.hoursPerDay;
    if (updates.productionFactor !== undefined) payload.production_factor = updates.productionFactor;
    if (updates.durationDaysOverride !== undefined) payload.duration_days_override = updates.durationDaysOverride ?? null;
    if (updates.calculatedManHours !== undefined) payload.calculated_man_hours = updates.calculatedManHours;
    if (updates.calculatedManDays !== undefined) payload.calculated_man_days = updates.calculatedManDays;
    if (updates.calculatedDurationDays !== undefined) payload.calculated_duration_days = updates.calculatedDurationDays;
    if (updates.effectiveDurationDays !== undefined) payload.effective_duration_days = updates.effectiveDurationDays;
    if (updates.totalLaborCost !== undefined) payload.total_labor_cost = updates.totalLaborCost;
    if (updates.totalMaterialCost !== undefined) payload.total_material_cost = updates.totalMaterialCost;
    if (updates.totalEquipmentCost !== undefined) payload.total_equipment_cost = updates.totalEquipmentCost;
    if (updates.totalCost !== undefined) payload.total_cost = updates.totalCost;
    if (updates.sortOrder !== undefined) payload.sort_order = updates.sortOrder;

    const { data, error } = await supabase
      .from('project_construction_activities')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) return failure(error.message);
    return success(mapProjectActivityFromRow(data as ProjectConstructionActivityRow));
  } catch (err) {
    return failure(err);
  }
}

/**
 * Delete all project construction activities for a project.
 * Line items are removed by CASCADE.
 */
export async function deleteProjectConstructionActivities(
  projectId: string,
): Promise<RepositoryResult<null>> {
  try {
    const { error } = await supabase
      .from('project_construction_activities')
      .delete()
      .eq('project_id', projectId);

    if (error) return failure(error.message);
    return success(null);
  } catch (err) {
    return failure(err);
  }
}

/**
 * Delete a project construction activity (and its line items by CASCADE).
 */
export async function deleteProjectActivity(id: string): Promise<RepositoryResult<null>> {
  try {
    const { error } = await supabase
      .from('project_construction_activities')
      .delete()
      .eq('id', id);

    if (error) return failure(error.message);
    return success(null);
  } catch (err) {
    return failure(err);
  }
}

// ---------------------------------------------------------------------------
// Project activity line items
// ---------------------------------------------------------------------------

/**
 * Load all line items for a project activity.
 */
export async function fetchProjectLineItems(
  projectActivityId: string,
): Promise<RepositoryResult<ProjectActivityLineItem[]>> {
  try {
    const { data, error } = await supabase
      .from('project_activity_line_items')
      .select('*')
      .eq('project_activity_id', projectActivityId)
      .order('sort_order');

    if (error) return failure(error.message);
    const items = (data as ProjectActivityLineItemRow[]).map(mapProjectLineItemFromRow);
    return success(items);
  } catch (err) {
    return failure(err);
  }
}

/**
 * Replace all line items for an activity (delete + bulk insert).
 * Used when recalculating rollups after quantity changes.
 */
export async function replaceProjectLineItems(
  projectActivityId: string,
  lineItems: ProjectActivityLineItem[],
): Promise<RepositoryResult<ProjectActivityLineItem[]>> {
  try {
    const { error: deleteError } = await supabase
      .from('project_activity_line_items')
      .delete()
      .eq('project_activity_id', projectActivityId);

    if (deleteError) return failure(deleteError.message);

    if (lineItems.length === 0) return success([]);

    const rows = lineItems.map(mapProjectLineItemToInsert);
    const { data, error } = await supabase
      .from('project_activity_line_items')
      .insert(rows)
      .select('*');

    if (error) return failure(error.message);
    const saved = (data as ProjectActivityLineItemRow[]).map(mapProjectLineItemFromRow);
    return success(saved);
  } catch (err) {
    return failure(err);
  }
}

export async function updateProjectLineItemFromDesignPreview(
  lineItemId: string,
  updates: Pick<ProjectActivityLineItem, 'description' | 'quantity' | 'unit'>,
): Promise<RepositoryResult<ProjectActivityLineItem>> {
  try {
    const { data, error } = await supabase
      .from('project_activity_line_items')
      .update({
        name: updates.description,
        description: updates.description,
        quantity: updates.quantity,
        unit: updates.unit,
      })
      .eq('id', lineItemId)
      .select('*')
      .single();

    if (error) return failure(error.message);
    return success(mapProjectLineItemFromRow(data as ProjectActivityLineItemRow));
  } catch (err) {
    return failure(err);
  }
}

// ---------------------------------------------------------------------------
// Atomic save: activity + line items in one operation
// ---------------------------------------------------------------------------

export interface SavedActivityBundle {
  activity: ProjectConstructionActivity;
  lineItems: ProjectActivityLineItem[];
}

/**
 * Save (insert or replace) a complete activity + its line items.
 *
 * If `activityId` is provided, updates the existing activity and replaces its
 * line items. Otherwise inserts a new activity + line items.
 */
export async function saveActivityBundle(
  activity: Omit<ProjectConstructionActivity, 'id' | 'createdAt' | 'updatedAt'>,
  lineItems: Omit<ProjectActivityLineItem, 'id' | 'projectActivityId' | 'createdAt'>[],
  activityId?: string,
): Promise<RepositoryResult<SavedActivityBundle>> {
  try {
    let savedActivity: ProjectConstructionActivity;
    const isInsert = !activityId;

    if (activityId) {
      const updateResult = await updateProjectActivity(activityId, activity as ProjectConstructionActivity);
      if (updateResult.error || !updateResult.data) return failure(updateResult.error ?? 'Update failed');
      savedActivity = updateResult.data;
    } else {
      const insertResult = await insertProjectActivity(activity);
      if (insertResult.error || !insertResult.data) return failure(insertResult.error ?? 'Insert failed');
      savedActivity = insertResult.data;
    }

    const lineItemsWithActivityId: ProjectActivityLineItem[] = lineItems.map((li, i) => ({
      ...li,
      id: '',
      projectActivityId: savedActivity.id,
      sortOrder: li.sortOrder ?? i,
      createdAt: '',
    }));

    const lineItemResult = await replaceProjectLineItems(savedActivity.id, lineItemsWithActivityId);
    if (lineItemResult.error || !lineItemResult.data) {
      // Roll back a newly inserted parent so the UI does not show an activity with missing line items.
      if (isInsert) {
        await deleteProjectActivity(savedActivity.id);
      }
      return failure(
        lineItemResult.error ??
          'Line item save failed. The construction activity was not saved completely.',
      );
    }

    return success({ activity: savedActivity, lineItems: lineItemResult.data });
  } catch (err) {
    return failure(err);
  }
}

// ---------------------------------------------------------------------------
// Activity resource CRUD
// ---------------------------------------------------------------------------
import type {
  ActivityMaterialResource,
  ActivityEquipmentResource,
} from '../domain/constructionActivityTypes';
import type {
  ActivityMaterialResourceRow,
  ActivityEquipmentResourceRow,
  ActivityMaterialResourceInsert,
  ActivityEquipmentResourceInsert,
} from './activityDbTypes';
import {
  mapMaterialResourceFromRow,
  mapEquipmentResourceFromRow,
} from './activityMappers';

export async function fetchActivityMaterials(
  activityId: string,
): Promise<RepositoryResult<ActivityMaterialResource[]>> {
  try {
    const { data, error } = await supabase
      .from('project_activity_material_resources')
      .select('*')
      .eq('project_activity_id', activityId)
      .order('sort_order', { ascending: true });
    if (error) return failure(error);
    return success((data as ActivityMaterialResourceRow[]).map(mapMaterialResourceFromRow));
  } catch (err) {
    return failure(err);
  }
}

export async function fetchActivityEquipment(
  activityId: string,
): Promise<RepositoryResult<ActivityEquipmentResource[]>> {
  try {
    const { data, error } = await supabase
      .from('project_activity_equipment_resources')
      .select('*')
      .eq('project_activity_id', activityId)
      .order('sort_order', { ascending: true });
    if (error) return failure(error);
    return success((data as ActivityEquipmentResourceRow[]).map(mapEquipmentResourceFromRow));
  } catch (err) {
    return failure(err);
  }
}

/** All material resources for a project (RLS-scoped). */
export async function fetchProjectMaterialResources(
  projectId: string,
): Promise<RepositoryResult<ActivityMaterialResource[]>> {
  try {
    const { data, error } = await supabase
      .from('project_activity_material_resources')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true });
    if (error) return failure(error);
    return success((data as ActivityMaterialResourceRow[]).map(mapMaterialResourceFromRow));
  } catch (err) {
    return failure(err);
  }
}

/** All equipment resources for a project (RLS-scoped). */
export async function fetchProjectEquipmentResources(
  projectId: string,
): Promise<RepositoryResult<ActivityEquipmentResource[]>> {
  try {
    const { data, error } = await supabase
      .from('project_activity_equipment_resources')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true });
    if (error) return failure(error);
    return success((data as ActivityEquipmentResourceRow[]).map(mapEquipmentResourceFromRow));
  } catch (err) {
    return failure(err);
  }
}

export async function upsertMaterialResource(
  payload: ActivityMaterialResourceInsert & { id?: string },
): Promise<RepositoryResult<ActivityMaterialResource>> {
  try {
    const { data, error } = await supabase
      .from('project_activity_material_resources')
      .upsert(payload)
      .select()
      .single();
    if (error || !data) return failure(error ?? 'Upsert failed');
    return success(mapMaterialResourceFromRow(data as ActivityMaterialResourceRow));
  } catch (err) {
    return failure(err);
  }
}

export async function upsertEquipmentResource(
  payload: ActivityEquipmentResourceInsert & { id?: string },
): Promise<RepositoryResult<ActivityEquipmentResource>> {
  try {
    const { data, error } = await supabase
      .from('project_activity_equipment_resources')
      .upsert(payload)
      .select()
      .single();
    if (error || !data) return failure(error ?? 'Upsert failed');
    return success(mapEquipmentResourceFromRow(data as ActivityEquipmentResourceRow));
  } catch (err) {
    return failure(err);
  }
}

export async function deleteMaterialResource(id: string): Promise<RepositoryResult<void>> {
  try {
    const { error } = await supabase
      .from('project_activity_material_resources')
      .delete()
      .eq('id', id);
    if (error) return failure(error);
    return success(undefined);
  } catch (err) {
    return failure(err);
  }
}

export async function deleteEquipmentResource(id: string): Promise<RepositoryResult<void>> {
  try {
    const { error } = await supabase
      .from('project_activity_equipment_resources')
      .delete()
      .eq('id', id);
    if (error) return failure(error);
    return success(undefined);
  } catch (err) {
    return failure(err);
  }
}
