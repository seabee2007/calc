/**
 * Activity Resource Service — Materials & Equipment.
 *
 * Business logic for adding, updating, and deleting material/equipment resources
 * attached to a construction activity. After any mutation, syncActivityCostTotals
 * re-aggregates material and equipment totals and writes them back to the activity
 * WITHOUT touching labor cost (which is owned by the labor calculation system).
 */
import type {
  ActivityMaterialResource,
  ActivityEquipmentResource,
  ActivityResourceSnapshot,
  ActivityResourceProvider,
  CompanyCostLibraryItem,
} from '../domain/constructionActivityTypes';
import { calculateResourceLineTotal } from '../domain/constructionActivityCalculations';
import {
  fetchActivityMaterials,
  fetchActivityEquipment,
  upsertMaterialResource,
  upsertEquipmentResource,
  deleteMaterialResource as repoDeleteMaterial,
  deleteEquipmentResource as repoDeleteEquipment,
} from '../infrastructure/activityRepository';
import { fetchProjectActivityById } from '../infrastructure/activityRepository';
import { updateProjectActivity } from '../infrastructure/activityRepository';
import { mapMaterialResourceToInsert, mapEquipmentResourceToInsert } from '../infrastructure/activityMappers';
import { upsertCompanyCostLibraryItem } from '../infrastructure/companyCostLibraryRepository';
import { supabase } from '../../../lib/supabase';

// ---------------------------------------------------------------------------
// Input shapes
// ---------------------------------------------------------------------------

export interface AddResourceInput {
  activityId: string;
  projectId: string;
  name: string;
  description?: string;
  category?: string;
  subcategory?: string;
  quantity: number;
  unit: string;
  unitCost: number;
  sourceProvider: ActivityResourceProvider;
  sourceSnapshot?: ActivityResourceSnapshot;
  sourceId?: string;
  companyLibraryItemId?: string;
  /** If true, also save this item to the user's company cost library. */
  saveToCompanyLibrary?: boolean;
}

export interface UpdateResourceInput {
  name?: string;
  description?: string;
  category?: string;
  subcategory?: string;
  quantity?: number;
  unit?: string;
  unitCost?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data?.user?.id) throw new Error('Not authenticated');
  return data.user.id;
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getActivityResources(activityId: string): Promise<{
  materials: ActivityMaterialResource[];
  equipment: ActivityEquipmentResource[];
  error: string | null;
}> {
  const [matResult, equipResult] = await Promise.all([
    fetchActivityMaterials(activityId),
    fetchActivityEquipment(activityId),
  ]);
  const error = matResult.error ?? equipResult.error;
  return {
    materials: matResult.data ?? [],
    equipment: equipResult.data ?? [],
    error,
  };
}

// ---------------------------------------------------------------------------
// Sync — preserves existing labor cost
// ---------------------------------------------------------------------------

/**
 * Re-aggregates material and equipment totals from DB and writes them to the
 * activity row. NEVER recalculates or overwrites totalLaborCost.
 */
export async function syncActivityCostTotals(activityId: string): Promise<void> {
  const [existingResult, matResult, equipResult] = await Promise.all([
    fetchProjectActivityById(activityId),
    fetchActivityMaterials(activityId),
    fetchActivityEquipment(activityId),
  ]);

  if (!existingResult.data) return;

  const totalMaterialCost = (matResult.data ?? []).reduce((s, r) => s + r.totalCost, 0);
  const totalEquipmentCost = (equipResult.data ?? []).reduce((s, r) => s + r.totalCost, 0);
  const existingLaborCost = existingResult.data.totalLaborCost ?? 0;
  const totalCost = existingLaborCost + totalMaterialCost + totalEquipmentCost;

  await updateProjectActivity(activityId, {
    totalMaterialCost,
    totalEquipmentCost,
    totalCost,
  });
}

// ---------------------------------------------------------------------------
// Material CRUD
// ---------------------------------------------------------------------------

export async function addMaterialResource(
  input: AddResourceInput,
): Promise<{ resource: ActivityMaterialResource | null; error: string | null }> {
  try {
    const userId = await getUserId();
    const quantity = Math.max(0, input.quantity ?? 0);
    const unitCost = Math.max(0, input.unitCost ?? 0);
    const totalCost = calculateResourceLineTotal(quantity, unitCost);

    const payload = mapMaterialResourceToInsert(
      {
        activityId: input.activityId,
        projectId: input.projectId,
        name: input.name,
        description: input.description,
        category: input.category,
        subcategory: input.subcategory,
        quantity,
        unit: input.unit,
        unitCost,
        totalCost,
        sourceProvider: input.sourceProvider,
        sourceSnapshot: input.sourceSnapshot,
        sourceId: input.sourceId,
        companyLibraryItemId: input.companyLibraryItemId,
      },
      userId,
    );

    const result = await upsertMaterialResource(payload);
    if (result.error || !result.data) return { resource: null, error: result.error ?? 'Save failed' };

    if (input.saveToCompanyLibrary) {
      await maybeSaveToLibrary(input, userId, 'material');
    }

    await syncActivityCostTotals(input.activityId);
    return { resource: result.data, error: null };
  } catch (err) {
    return { resource: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function updateMaterialResource(
  id: string,
  activityId: string,
  updates: UpdateResourceInput,
  existingResource: ActivityMaterialResource,
): Promise<{ resource: ActivityMaterialResource | null; error: string | null }> {
  try {
    const userId = await getUserId();
    const quantity = Math.max(0, updates.quantity ?? existingResource.quantity);
    const unitCost = Math.max(0, updates.unitCost ?? existingResource.unitCost);
    const totalCost = calculateResourceLineTotal(quantity, unitCost);

    const merged: ActivityMaterialResource = {
      ...existingResource,
      ...updates,
      quantity,
      unitCost,
      totalCost,
    };

    const payload = { ...mapMaterialResourceToInsert(merged, userId), id };
    const result = await upsertMaterialResource(payload);
    if (result.error || !result.data) return { resource: null, error: result.error ?? 'Update failed' };

    await syncActivityCostTotals(activityId);
    return { resource: result.data, error: null };
  } catch (err) {
    return { resource: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteMaterialResource(
  id: string,
  activityId: string,
): Promise<{ error: string | null }> {
  try {
    const result = await repoDeleteMaterial(id);
    if (result.error) return { error: result.error };
    await syncActivityCostTotals(activityId);
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// ---------------------------------------------------------------------------
// Equipment CRUD
// ---------------------------------------------------------------------------

export async function addEquipmentResource(
  input: AddResourceInput,
): Promise<{ resource: ActivityEquipmentResource | null; error: string | null }> {
  try {
    const userId = await getUserId();
    const quantity = Math.max(0, input.quantity ?? 0);
    const unitCost = Math.max(0, input.unitCost ?? 0);
    const totalCost = calculateResourceLineTotal(quantity, unitCost);

    const payload = mapEquipmentResourceToInsert(
      {
        activityId: input.activityId,
        projectId: input.projectId,
        name: input.name,
        description: input.description,
        category: input.category,
        subcategory: input.subcategory,
        quantity,
        unit: input.unit,
        unitCost,
        totalCost,
        sourceProvider: input.sourceProvider,
        sourceSnapshot: input.sourceSnapshot,
        sourceId: input.sourceId,
        companyLibraryItemId: input.companyLibraryItemId,
      },
      userId,
    );

    const result = await upsertEquipmentResource(payload);
    if (result.error || !result.data) return { resource: null, error: result.error ?? 'Save failed' };

    if (input.saveToCompanyLibrary) {
      await maybeSaveToLibrary(input, userId, 'equipment');
    }

    await syncActivityCostTotals(input.activityId);
    return { resource: result.data, error: null };
  } catch (err) {
    return { resource: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function updateEquipmentResource(
  id: string,
  activityId: string,
  updates: UpdateResourceInput,
  existingResource: ActivityEquipmentResource,
): Promise<{ resource: ActivityEquipmentResource | null; error: string | null }> {
  try {
    const userId = await getUserId();
    const quantity = Math.max(0, updates.quantity ?? existingResource.quantity);
    const unitCost = Math.max(0, updates.unitCost ?? existingResource.unitCost);
    const totalCost = calculateResourceLineTotal(quantity, unitCost);

    const merged: ActivityEquipmentResource = {
      ...existingResource,
      ...updates,
      quantity,
      unitCost,
      totalCost,
    };

    const payload = { ...mapEquipmentResourceToInsert(merged, userId), id };
    const result = await upsertEquipmentResource(payload);
    if (result.error || !result.data) return { resource: null, error: result.error ?? 'Update failed' };

    await syncActivityCostTotals(activityId);
    return { resource: result.data, error: null };
  } catch (err) {
    return { resource: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteEquipmentResource(
  id: string,
  activityId: string,
): Promise<{ error: string | null }> {
  try {
    const result = await repoDeleteEquipment(id);
    if (result.error) return { error: result.error };
    await syncActivityCostTotals(activityId);
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// ---------------------------------------------------------------------------
// Save-to-library helper
// ---------------------------------------------------------------------------

async function maybeSaveToLibrary(
  input: AddResourceInput,
  userId: string,
  type: 'material' | 'equipment',
): Promise<void> {
  const libraryItem: Omit<CompanyCostLibraryItem, 'id' | 'createdAt' | 'updatedAt'> = {
    userId,
    type,
    name: input.name,
    description: input.description,
    category: input.category,
    subcategory: input.subcategory,
    unit: input.unit,
    defaultUnitCost: Math.max(0, input.unitCost ?? 0),
    sourceProvider: input.sourceProvider,
    sourceId: input.sourceId,
    notes: input.sourceSnapshot?.notes,
  };
  // Ignore errors — saving to library is best-effort; do not fail the resource add.
  await upsertCompanyCostLibraryItem(libraryItem);
}
