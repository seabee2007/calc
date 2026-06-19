import { supabase } from '../../../lib/supabase';
import type { RepositoryResult } from '../../estimating/infrastructure/estimateDbTypes';
import type {
  BimModel,
  BimModelObject,
  BimTakeoffItem,
  CreateBimModelInput,
  CreateBimTakeoffItemInput,
  InsertBimModelObjectInput,
} from '../types';

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

interface BimModelRow {
  id: string;
  project_id: string;
  estimate_id: string | null;
  uploaded_by: string;
  file_name: string;
  file_type: string;
  original_file_name?: string;
  original_file_type?: string;
  viewer_file_type?: string | null;
  storage_path: string;
  file_size: number | null;
  status: string;
  processing_status?: string;
  unsupported_reason?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface BimModelObjectRow {
  id: string;
  model_id: string;
  project_id: string;
  external_object_id: string;
  name: string | null;
  object_type: string | null;
  category: string | null;
  material: string | null;
  level: string | null;
  properties: Record<string, unknown>;
  geometry_metrics: Record<string, unknown>;
  takeoff_status: string;
  created_at: string;
  updated_at: string;
}

interface BimTakeoffItemRow {
  id: string;
  project_id: string;
  estimate_id: string | null;
  model_id: string;
  object_id: string | null;
  division_code: string | null;
  activity_code: string | null;
  estimate_line_id: string | null;
  quantity: number;
  unit: string;
  source: string;
  confidence: string;
  notes: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

function mapModelRow(row: BimModelRow): BimModel {
  return {
    id: row.id,
    projectId: row.project_id,
    estimateId: row.estimate_id,
    uploadedBy: row.uploaded_by,
    fileName: row.file_name,
    fileType: row.file_type,
    originalFileName: row.original_file_name ?? row.file_name,
    originalFileType: row.original_file_type ?? row.file_type,
    viewerFileType: row.viewer_file_type ?? (row.file_type === 'glb' ? 'glb' : null),
    storagePath: row.storage_path,
    fileSize: row.file_size,
    status: row.status as BimModel['status'],
    processingStatus: (row.processing_status ?? row.status) as BimModel['processingStatus'],
    unsupportedReason: row.unsupported_reason ?? null,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapObjectRow(row: BimModelObjectRow): BimModelObject {
  return {
    id: row.id,
    modelId: row.model_id,
    projectId: row.project_id,
    externalObjectId: row.external_object_id,
    name: row.name,
    objectType: row.object_type,
    category: row.category,
    material: row.material,
    level: row.level,
    properties: row.properties ?? {},
    geometryMetrics: (row.geometry_metrics ?? {}) as BimModelObject['geometryMetrics'],
    takeoffStatus: row.takeoff_status as BimModelObject['takeoffStatus'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTakeoffRow(row: BimTakeoffItemRow): BimTakeoffItem {
  return {
    id: row.id,
    projectId: row.project_id,
    estimateId: row.estimate_id,
    modelId: row.model_id,
    objectId: row.object_id,
    divisionCode: row.division_code,
    activityCode: row.activity_code,
    estimateLineId: row.estimate_line_id,
    quantity: Number(row.quantity),
    unit: row.unit,
    source: row.source as BimTakeoffItem['source'],
    confidence: row.confidence as BimTakeoffItem['confidence'],
    notes: row.notes,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createModel(input: CreateBimModelInput): Promise<RepositoryResult<BimModel>> {
  try {
    const row: Record<string, unknown> = {
      project_id: input.projectId,
      estimate_id: input.estimateId ?? null,
      uploaded_by: input.uploadedBy,
      file_name: input.fileName,
      file_type: input.fileType,
      original_file_name: input.originalFileName ?? input.fileName,
      original_file_type: input.originalFileType ?? input.fileType,
      viewer_file_type: input.viewerFileType ?? null,
      storage_path: input.storagePath,
      file_size: input.fileSize ?? null,
      status: input.status ?? 'uploaded',
      processing_status: input.processingStatus ?? input.status ?? 'uploaded',
      unsupported_reason: input.unsupportedReason ?? null,
      metadata: input.metadata ?? {},
    };
    if (input.id) row.id = input.id;

    const { data, error } = await supabase
      .from('bim_models')
      .insert(row)
      .select('*')
      .single();

    if (error) return failure(error.message);
    return success(mapModelRow(data as BimModelRow));
  } catch (err) {
    return failure(err);
  }
}

export async function listModels(projectId: string): Promise<RepositoryResult<BimModel[]>> {
  try {
    const { data, error } = await supabase
      .from('bim_models')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) return failure(error.message);
    return success((data as BimModelRow[]).map(mapModelRow));
  } catch (err) {
    return failure(err);
  }
}

export async function getModel(modelId: string): Promise<RepositoryResult<BimModel>> {
  try {
    const { data, error } = await supabase
      .from('bim_models')
      .select('*')
      .eq('id', modelId)
      .maybeSingle();

    if (error) return failure(error.message);
    if (!data) return failure('BIM model not found.');
    return success(mapModelRow(data as BimModelRow));
  } catch (err) {
    return failure(err);
  }
}

export async function updateModelStatus(
  modelId: string,
  status: BimModel['status'],
  metadataPatch?: Record<string, unknown>,
): Promise<RepositoryResult<BimModel>> {
  try {
    const patch: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (metadataPatch) {
      const existing = await getModel(modelId);
      if (existing.error || !existing.data) return failure(existing.error ?? 'Model not found.');
      patch.metadata = { ...existing.data.metadata, ...metadataPatch };
    }

    const { data, error } = await supabase
      .from('bim_models')
      .update(patch)
      .eq('id', modelId)
      .select('*')
      .single();

    if (error) return failure(error.message);
    return success(mapModelRow(data as BimModelRow));
  } catch (err) {
    return failure(err);
  }
}

export async function listModelObjects(
  modelId: string,
): Promise<RepositoryResult<BimModelObject[]>> {
  try {
    const { data, error } = await supabase
      .from('bim_model_objects')
      .select('*')
      .eq('model_id', modelId)
      .order('name', { ascending: true });

    if (error) return failure(error.message);
    return success((data as BimModelObjectRow[]).map(mapObjectRow));
  } catch (err) {
    return failure(err);
  }
}

export async function insertObjects(
  objects: InsertBimModelObjectInput[],
): Promise<RepositoryResult<BimModelObject[]>> {
  if (objects.length === 0) return success([]);

  try {
    const rows = objects.map((obj) => ({
      model_id: obj.modelId,
      project_id: obj.projectId,
      external_object_id: obj.externalObjectId,
      name: obj.name ?? null,
      object_type: obj.objectType ?? null,
      category: obj.category ?? null,
      material: obj.material ?? null,
      level: obj.level ?? null,
      properties: obj.properties ?? {},
      geometry_metrics: obj.geometryMetrics ?? {},
      takeoff_status: obj.takeoffStatus ?? 'unmapped',
    }));

    const { data, error } = await supabase
      .from('bim_model_objects')
      .upsert(rows, { onConflict: 'model_id,external_object_id' })
      .select('*');

    if (error) return failure(error.message);
    return success((data as BimModelObjectRow[]).map(mapObjectRow));
  } catch (err) {
    return failure(err);
  }
}

export async function updateObjectTakeoffStatus(
  objectId: string,
  takeoffStatus: BimModelObject['takeoffStatus'],
  propertiesPatch?: Record<string, unknown>,
): Promise<RepositoryResult<BimModelObject>> {
  try {
    const row: Record<string, unknown> = {
      takeoff_status: takeoffStatus,
      updated_at: new Date().toISOString(),
    };

    if (propertiesPatch) {
      const { data: existing, error: loadError } = await supabase
        .from('bim_model_objects')
        .select('properties')
        .eq('id', objectId)
        .maybeSingle();

      if (loadError) return failure(loadError.message);
      row.properties = {
        ...(((existing as { properties?: Record<string, unknown> } | null)?.properties ?? {})),
        ...propertiesPatch,
      };
    }

    const { data, error } = await supabase
      .from('bim_model_objects')
      .update(row)
      .eq('id', objectId)
      .select('*')
      .single();

    if (error) return failure(error.message);
    return success(mapObjectRow(data as BimModelObjectRow));
  } catch (err) {
    return failure(err);
  }
}

export async function createTakeoffItem(
  input: CreateBimTakeoffItemInput,
): Promise<RepositoryResult<BimTakeoffItem>> {
  try {
    const { data, error } = await supabase
      .from('bim_takeoff_items')
      .insert({
        project_id: input.projectId,
        estimate_id: input.estimateId ?? null,
        model_id: input.modelId,
        object_id: input.objectId ?? null,
        division_code: input.divisionCode ?? null,
        activity_code: input.activityCode ?? null,
        estimate_line_id: input.estimateLineId ?? null,
        quantity: input.quantity,
        unit: input.unit,
        source: input.source,
        confidence: input.confidence,
        notes: input.notes ?? null,
        metadata: input.metadata ?? {},
      })
      .select('*')
      .single();

    if (error) return failure(error.message);
    return success(mapTakeoffRow(data as BimTakeoffItemRow));
  } catch (err) {
    return failure(err);
  }
}

export async function listTakeoffItems(params: {
  projectId: string;
  estimateId?: string | null;
  modelId?: string | null;
}): Promise<RepositoryResult<BimTakeoffItem[]>> {
  try {
    let query = supabase.from('bim_takeoff_items').select('*').eq('project_id', params.projectId);
    if (params.estimateId) query = query.eq('estimate_id', params.estimateId);
    if (params.modelId) query = query.eq('model_id', params.modelId);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return failure(error.message);
    return success((data as BimTakeoffItemRow[]).map(mapTakeoffRow));
  } catch (err) {
    return failure(err);
  }
}

export async function updateTakeoffItem(
  takeoffId: string,
  patch: Partial<
    Pick<
      CreateBimTakeoffItemInput,
      'quantity' | 'unit' | 'source' | 'confidence' | 'notes' | 'estimateLineId'
    >
  >,
): Promise<RepositoryResult<BimTakeoffItem>> {
  try {
    const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.quantity !== undefined) row.quantity = patch.quantity;
    if (patch.unit !== undefined) row.unit = patch.unit;
    if (patch.source !== undefined) row.source = patch.source;
    if (patch.confidence !== undefined) row.confidence = patch.confidence;
    if (patch.notes !== undefined) row.notes = patch.notes;
    if (patch.estimateLineId !== undefined) row.estimate_line_id = patch.estimateLineId;

    const { data, error } = await supabase
      .from('bim_takeoff_items')
      .update(row)
      .eq('id', takeoffId)
      .select('*')
      .single();

    if (error) return failure(error.message);
    return success(mapTakeoffRow(data as BimTakeoffItemRow));
  } catch (err) {
    return failure(err);
  }
}

export interface DeleteBimModelResult {
  modelId: string;
  storagePath: string | null;
  storageCleanupRequired: boolean;
}

export const BIM_MODEL_DELETE_BLOCKED_MESSAGE =
  'This model has takeoff items linked to the estimate. Remove those links before deleting the model.';

async function hasLinkedTakeoffItems(modelId: string): Promise<RepositoryResult<boolean>> {
  try {
    const { data, error } = await supabase
      .from('bim_takeoff_items')
      .select('id')
      .eq('model_id', modelId)
      .not('estimate_line_id', 'is', null)
      .limit(1);

    if (error) return failure(error.message);
    return success((data ?? []).length > 0);
  } catch (err) {
    return failure(err);
  }
}

export async function deleteBimModel(modelId: string): Promise<RepositoryResult<DeleteBimModelResult>> {
  try {
    const modelResult = await getModel(modelId);
    if (modelResult.error || !modelResult.data) {
      return failure(modelResult.error ?? 'BIM model not found.');
    }

    const linkedResult = await hasLinkedTakeoffItems(modelId);
    if (linkedResult.error) return failure(linkedResult.error);
    if (linkedResult.data) return failure(BIM_MODEL_DELETE_BLOCKED_MESSAGE);

    const { error: takeoffDeleteError } = await supabase
      .from('bim_takeoff_items')
      .delete()
      .eq('model_id', modelId)
      .is('estimate_line_id', null);
    if (takeoffDeleteError) return failure(takeoffDeleteError.message);

    const { error: objectDeleteError } = await supabase
      .from('bim_model_objects')
      .delete()
      .eq('model_id', modelId);
    if (objectDeleteError) return failure(objectDeleteError.message);

    const { error: modelDeleteError } = await supabase
      .from('bim_models')
      .delete()
      .eq('id', modelId);
    if (modelDeleteError) return failure(modelDeleteError.message);

    return success({
      modelId,
      storagePath: modelResult.data.storagePath,
      storageCleanupRequired: Boolean(modelResult.data.storagePath),
    });
  } catch (err) {
    return failure(err);
  }
}
