import { supabase } from '../../../lib/supabase';
import type { RepositoryResult } from '../../estimating/infrastructure/estimateDbTypes';
import type {
  CreateDesignModelInput,
  CreateDesignQuantityItemInput,
  DesignModel,
  DesignModelObject,
  DesignQuantityItem,
  UpsertDesignModelObjectInput,
} from '../types';
import type { DesignQuantityDestination } from '../application/designScopeTypes';

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

interface DesignModelRow {
  id: string;
  project_id: string;
  estimate_id: string | null;
  name: string;
  unit_system: string;
  model_type: string;
  status: string;
  created_by: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface DesignModelObjectRow {
  id: string;
  design_model_id: string;
  project_id: string;
  object_type: string;
  name: string;
  parent_object_id: string | null;
  parameters: Record<string, unknown>;
  quantity_summary: Record<string, unknown>;
  estimate_mapping: Record<string, unknown>;
  geometry_cache: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface DesignQuantityItemRow {
  id: string;
  design_model_id: string;
  design_object_id: string;
  project_id: string;
  estimate_id: string | null;
  estimate_line_id: string | null;
  estimate_activity_id?: string | null;
  material_resource_id?: string | null;
  equipment_resource_id?: string | null;
  import_destination?: string | null;
  import_status?: string | null;
  scope_package_key?: string | null;
  import_review_reason?: string | null;
  quantity_type: string;
  description: string;
  quantity: number;
  unit: string;
  formula: string;
  source: string;
  confidence: string;
  parameter_snapshot: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

function mapModelRow(row: DesignModelRow): DesignModel {
  return {
    id: row.id,
    projectId: row.project_id,
    estimateId: row.estimate_id,
    name: row.name,
    unitSystem: row.unit_system as DesignModel['unitSystem'],
    modelType: row.model_type as DesignModel['modelType'],
    status: row.status as DesignModel['status'],
    createdBy: row.created_by,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapObjectRow(row: DesignModelObjectRow): DesignModelObject {
  return {
    id: row.id,
    designModelId: row.design_model_id,
    projectId: row.project_id,
    objectType: row.object_type as DesignModelObject['objectType'],
    name: row.name,
    parentObjectId: row.parent_object_id,
    parameters: row.parameters as DesignModelObject['parameters'],
    quantitySummary: row.quantity_summary ?? {},
    estimateMapping: row.estimate_mapping ?? {},
    geometryCache: row.geometry_cache ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapQuantityRow(row: DesignQuantityItemRow): DesignQuantityItem {
  return {
    id: row.id,
    designModelId: row.design_model_id,
    designObjectId: row.design_object_id,
    projectId: row.project_id,
    estimateId: row.estimate_id,
    estimateLineId: row.estimate_line_id,
    estimateActivityId: row.estimate_activity_id ?? null,
    materialResourceId: row.material_resource_id ?? null,
    equipmentResourceId: row.equipment_resource_id ?? null,
    importDestination: row.import_destination ?? null,
    importStatus: row.import_status ?? null,
    scopePackageKey: row.scope_package_key ?? null,
    importReviewReason: row.import_review_reason ?? null,
    quantityType: row.quantity_type,
    description: row.description,
    quantity: Number(row.quantity),
    unit: row.unit,
    formula: row.formula,
    source: row.source as DesignQuantityItem['source'],
    confidence: row.confidence as DesignQuantityItem['confidence'],
    parameterSnapshot: row.parameter_snapshot ?? {},
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createDesignModel(input: CreateDesignModelInput): Promise<RepositoryResult<DesignModel>> {
  try {
    const row: Record<string, unknown> = {
      project_id: input.projectId,
      estimate_id: input.estimateId ?? null,
      name: input.name,
      unit_system: input.unitSystem,
      model_type: input.modelType ?? 'cmu_building',
      status: input.status ?? 'draft',
      created_by: input.createdBy,
      metadata: input.metadata ?? {},
    };
    if (input.id) row.id = input.id;

    const { data, error } = await supabase.from('design_models').upsert(row).select('*').single();
    if (error) return failure(error.message);
    return success(mapModelRow(data as DesignModelRow));
  } catch (err) {
    return failure(err);
  }
}

export async function findDesignModelByEstimateId(
  projectId: string,
  estimateId: string,
): Promise<RepositoryResult<DesignModel | null>> {
  try {
    const { data, error } = await supabase
      .from('design_models')
      .select('*')
      .eq('project_id', projectId)
      .eq('estimate_id', estimateId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return failure(error.message);
    if (!data) return success(null);
    return success(mapModelRow(data as DesignModelRow));
  } catch (err) {
    return failure(err);
  }
}

export async function updateDesignModelMetadata(
  designModelId: string,
  metadata: Record<string, unknown>,
): Promise<RepositoryResult<DesignModel>> {
  try {
    const { data, error } = await supabase
      .from('design_models')
      .update({ metadata, updated_at: new Date().toISOString() })
      .eq('id', designModelId)
      .select('*')
      .single();
    if (error) return failure(error.message);
    return success(mapModelRow(data as DesignModelRow));
  } catch (err) {
    return failure(err);
  }
}

export async function listDesignModels(projectId: string): Promise<RepositoryResult<DesignModel[]>> {
  try {
    const { data, error } = await supabase
      .from('design_models')
      .select('*')
      .eq('project_id', projectId)
      .order('updated_at', { ascending: false });
    if (error) return failure(error.message);
    return success((data as DesignModelRow[]).map(mapModelRow));
  } catch (err) {
    return failure(err);
  }
}

export async function upsertDesignModelObjects(
  objects: UpsertDesignModelObjectInput[],
): Promise<RepositoryResult<DesignModelObject[]>> {
  if (objects.length === 0) return success([]);

  try {
    const rows = objects.map((object) => ({
      ...(object.id ? { id: object.id } : {}),
      design_model_id: object.designModelId,
      project_id: object.projectId,
      object_type: object.objectType,
      name: object.name,
      parent_object_id: object.parentObjectId ?? null,
      parameters: object.parameters,
      quantity_summary: object.quantitySummary ?? {},
      estimate_mapping: object.estimateMapping ?? {},
      geometry_cache: object.geometryCache ?? null,
      updated_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase.from('design_model_objects').upsert(rows).select('*');
    if (error) return failure(error.message);
    return success((data as DesignModelObjectRow[]).map(mapObjectRow));
  } catch (err) {
    return failure(err);
  }
}

export async function listDesignModelObjects(
  designModelId: string,
): Promise<RepositoryResult<DesignModelObject[]>> {
  try {
    const { data, error } = await supabase
      .from('design_model_objects')
      .select('*')
      .eq('design_model_id', designModelId)
      .order('created_at', { ascending: true });
    if (error) return failure(error.message);
    return success((data as DesignModelObjectRow[]).map(mapObjectRow));
  } catch (err) {
    return failure(err);
  }
}

export async function replaceDesignQuantityItems(
  designModelId: string,
  items: CreateDesignQuantityItemInput[],
): Promise<RepositoryResult<DesignQuantityItem[]>> {
  try {
    const { data: committedRows, error: committedError } = await supabase
      .from('design_quantity_items')
      .select('*')
      .eq('design_model_id', designModelId)
      .or(
        'estimate_line_id.not.is.null,estimate_activity_id.not.is.null,material_resource_id.not.is.null,equipment_resource_id.not.is.null,import_status.not.is.null',
      );
    if (committedError) return failure(committedError.message);

    const committedByPreviewId = new Map(
      (committedRows as DesignQuantityItemRow[]).map((row) => [
        String(row.metadata?.previewLineId ?? row.quantity_type),
        row,
      ]),
    );

    const { error: deleteError } = await supabase
      .from('design_quantity_items')
      .delete()
      .eq('design_model_id', designModelId)
      .is('estimate_line_id', null)
      .is('estimate_activity_id', null)
      .is('material_resource_id', null)
      .is('equipment_resource_id', null)
      .is('import_status', null);
    if (deleteError) return failure(deleteError.message);

    if (items.length === 0) return success([]);

    const rows = items.map((item) => ({
      design_model_id: item.designModelId,
      design_object_id: item.designObjectId,
      project_id: item.projectId,
      estimate_id: item.estimateId ?? null,
      estimate_line_id:
        item.estimateLineId ??
        committedByPreviewId.get(String(item.metadata?.previewLineId ?? item.quantityType))?.estimate_line_id ??
        null,
      estimate_activity_id:
        item.estimateActivityId ??
        committedByPreviewId.get(String(item.metadata?.previewLineId ?? item.quantityType))?.estimate_activity_id ??
        null,
      material_resource_id:
        item.materialResourceId ??
        committedByPreviewId.get(String(item.metadata?.previewLineId ?? item.quantityType))?.material_resource_id ??
        null,
      equipment_resource_id:
        item.equipmentResourceId ??
        committedByPreviewId.get(String(item.metadata?.previewLineId ?? item.quantityType))?.equipment_resource_id ??
        null,
      import_destination:
        item.importDestination ??
        committedByPreviewId.get(String(item.metadata?.previewLineId ?? item.quantityType))?.import_destination ??
        null,
      import_status:
        item.importStatus ??
        committedByPreviewId.get(String(item.metadata?.previewLineId ?? item.quantityType))?.import_status ??
        null,
      scope_package_key:
        item.scopePackageKey ??
        committedByPreviewId.get(String(item.metadata?.previewLineId ?? item.quantityType))?.scope_package_key ??
        null,
      import_review_reason:
        item.importReviewReason ??
        committedByPreviewId.get(String(item.metadata?.previewLineId ?? item.quantityType))?.import_review_reason ??
        null,
      quantity_type: item.quantityType,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      formula: item.formula,
      source: 'parametric_design_builder',
      confidence: 'calculated_from_parameters',
      parameter_snapshot: item.parameterSnapshot,
      metadata: item.metadata ?? {},
    }));

    const { data, error } = await supabase.from('design_quantity_items').insert(rows).select('*');
    if (error) return failure(error.message);
    return success((data as DesignQuantityItemRow[]).map(mapQuantityRow));
  } catch (err) {
    return failure(err);
  }
}

export async function listDesignQuantityItems(
  designModelId: string,
): Promise<RepositoryResult<DesignQuantityItem[]>> {
  try {
    const { data, error } = await supabase
      .from('design_quantity_items')
      .select('*')
      .eq('design_model_id', designModelId)
      .order('created_at', { ascending: true });
    if (error) return failure(error.message);
    return success((data as DesignQuantityItemRow[]).map(mapQuantityRow));
  } catch (err) {
    return failure(err);
  }
}

export async function markDesignQuantityItemsCommitted(params: {
  quantityItemIds: string[];
  estimateLineId: string;
}): Promise<RepositoryResult<DesignQuantityItem[]>> {
  if (params.quantityItemIds.length === 0) return success([]);

  try {
    const { data, error } = await supabase
      .from('design_quantity_items')
      .update({
        estimate_line_id: params.estimateLineId,
        import_destination: 'activity_line_item',
        import_status: 'imported',
        updated_at: new Date().toISOString(),
      })
      .in('id', params.quantityItemIds)
      .select('*');
    if (error) return failure(error.message);
    return success((data as DesignQuantityItemRow[]).map(mapQuantityRow));
  } catch (err) {
    return failure(err);
  }
}

export async function markDesignQuantityItemsImported(params: {
  updates: Array<{
    quantityItemId: string;
    estimateActivityId?: string | null;
    estimateLineId?: string | null;
    materialResourceId?: string | null;
    equipmentResourceId?: string | null;
    importDestination: DesignQuantityDestination;
    importStatus: 'imported' | 'reference_only' | 'excluded' | 'review_required';
    scopePackageKey: string;
    importReviewReason?: string | null;
  }>;
}): Promise<RepositoryResult<DesignQuantityItem[]>> {
  if (params.updates.length === 0) return success([]);

  try {
    const updated: DesignQuantityItem[] = [];
    for (const item of params.updates) {
      const { data, error } = await supabase
        .from('design_quantity_items')
        .update({
          estimate_activity_id: item.estimateActivityId ?? null,
          estimate_line_id: item.estimateLineId ?? null,
          material_resource_id: item.materialResourceId ?? null,
          equipment_resource_id: item.equipmentResourceId ?? null,
          import_destination: item.importDestination,
          import_status: item.importStatus,
          scope_package_key: item.scopePackageKey,
          import_review_reason: item.importReviewReason ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.quantityItemId)
        .select('*')
        .single();
      if (error) return failure(error.message);
      updated.push(mapQuantityRow(data as DesignQuantityItemRow));
    }
    return success(updated);
  } catch (err) {
    return failure(err);
  }
}
