import { supabase } from '../../../lib/supabase';
import type { RepositoryResult } from '../../estimating/infrastructure/estimateDbTypes';
import type {
  CreateDesignModelInput,
  CreateDesignQuantityImportLinkInput,
  CreateDesignQuantityItemInput,
  DesignQuantityImportLink,
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
  preview_line_id?: string | null;
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

interface DesignQuantityImportLinkRow {
  id: string;
  design_quantity_item_id: string;
  design_model_id: string;
  project_id: string;
  estimate_id: string | null;
  target_type: string;
  target_id: string | null;
  project_activity_id: string | null;
  usage_role: string;
  destination: string;
  scope_package_key: string;
  activity_key: string | null;
  source_preview_line_id?: string | null;
  quantity: number;
  unit: string;
  formula: string;
  derived: boolean;
  metadata: Record<string, unknown>;
  commit_batch_id: string;
  superseded_at?: string | null;
  superseded_by_commit_batch_id?: string | null;
  superseded_reason?: string | null;
  created_by: string | null;
  created_at: string;
}

interface FinalizeDesignBuilderImportLinksRow {
  import_links?: DesignQuantityImportLinkRow[];
  quantity_items?: DesignQuantityItemRow[];
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
    parameters: row.parameters as unknown as DesignModelObject['parameters'],
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
    previewLineId: row.preview_line_id ?? stringFromMetadata(row.metadata, 'previewLineId'),
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

function mapImportLinkRow(row: DesignQuantityImportLinkRow): DesignQuantityImportLink {
  return {
    id: row.id,
    designQuantityItemId: row.design_quantity_item_id,
    designModelId: row.design_model_id,
    projectId: row.project_id,
    estimateId: row.estimate_id,
    targetType: row.target_type,
    targetId: row.target_id,
    projectActivityId: row.project_activity_id,
    usageRole: row.usage_role,
    destination: row.destination,
    scopePackageKey: row.scope_package_key,
    activityKey: row.activity_key,
    sourcePreviewLineId: row.source_preview_line_id ?? stringFromMetadata(row.metadata, 'sourcePreviewLineId'),
    quantity: Number(row.quantity),
    unit: row.unit,
    formula: row.formula,
    derived: row.derived,
    metadata: row.metadata ?? {},
    commitBatchId: row.commit_batch_id,
    supersededAt: row.superseded_at ?? null,
    supersededByCommitBatchId: row.superseded_by_commit_batch_id ?? null,
    supersededReason: row.superseded_reason ?? null,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function stringFromMetadata(metadata: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value : null;
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
    const { data: existingRows, error: existingError } = await supabase
      .from('design_quantity_items')
      .select('*')
      .eq('design_model_id', designModelId);
    if (existingError) return failure(existingError.message);

    const existingByPreviewId = new Map(
      (existingRows as DesignQuantityItemRow[]).map((row) => [previewLineIdForRow(row), row]),
    );

    const nextPreviewIds = new Set(items.map((item) => previewLineIdForInput(item)));
    const staleUncommittedIds = (existingRows as DesignQuantityItemRow[])
      .filter((row) => !nextPreviewIds.has(previewLineIdForRow(row)))
      .filter((row) => !isQuantityRowImported(row))
      .map((row) => row.id);

    if (staleUncommittedIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('design_quantity_items')
        .delete()
        .in('id', staleUncommittedIds);
      if (deleteError) return failure(deleteError.message);
    }

    if (items.length === 0) return success([]);

    const rows = items.map((item) => {
      const previewLineId = previewLineIdForInput(item);
      const existing = existingByPreviewId.get(previewLineId);
      const imported = existing ? isQuantityRowImported(existing) : false;
      const changed = existing ? hasMaterialQuantityChange(existing, item) : false;
      const preserveTargets = imported && !changed;
      return {
        design_model_id: item.designModelId,
        design_object_id: item.designObjectId,
        preview_line_id: previewLineId,
        project_id: item.projectId,
        estimate_id: item.estimateId ?? null,
        estimate_line_id: preserveTargets ? existing?.estimate_line_id ?? null : item.estimateLineId ?? null,
        estimate_activity_id: preserveTargets ? existing?.estimate_activity_id ?? null : item.estimateActivityId ?? null,
        material_resource_id: preserveTargets ? existing?.material_resource_id ?? null : item.materialResourceId ?? null,
        equipment_resource_id: preserveTargets ? existing?.equipment_resource_id ?? null : item.equipmentResourceId ?? null,
        import_destination: preserveTargets ? existing?.import_destination ?? null : item.importDestination ?? null,
        import_status: changed && imported
          ? 'review_required'
          : preserveTargets
            ? existing?.import_status ?? null
            : item.importStatus ?? null,
        scope_package_key: preserveTargets ? existing?.scope_package_key ?? null : item.scopePackageKey ?? null,
        import_review_reason: changed && imported
          ? 'Design Builder quantity changed after import; review before recommit.'
          : preserveTargets
            ? existing?.import_review_reason ?? null
            : item.importReviewReason ?? null,
        quantity_type: item.quantityType,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        formula: item.formula,
        source: 'parametric_design_builder',
        confidence: 'calculated_from_parameters',
        parameter_snapshot: item.parameterSnapshot,
        metadata: {
          ...(item.metadata ?? {}),
          previewLineId,
        },
      };
    });

    const { data, error } = await supabase
      .from('design_quantity_items')
      .upsert(rows, { onConflict: 'design_model_id,preview_line_id' })
      .select('*');
    if (error) return failure(error.message);
    return success((data as DesignQuantityItemRow[]).map(mapQuantityRow));
  } catch (err) {
    return failure(err);
  }
}

function previewLineIdForInput(item: CreateDesignQuantityItemInput): string {
  const explicit = item.previewLineId ?? item.metadata?.previewLineId;
  if (typeof explicit === 'string' && explicit.trim()) return explicit.trim();
  return `${item.designObjectId}:${item.quantityType}`;
}

function previewLineIdForRow(row: DesignQuantityItemRow): string {
  if (row.preview_line_id?.trim()) return row.preview_line_id.trim();
  const metadataPreviewLineId = stringFromMetadata(row.metadata, 'previewLineId');
  if (metadataPreviewLineId) return metadataPreviewLineId;
  return `${row.design_object_id}:${row.quantity_type}`;
}

function isQuantityRowImported(row: DesignQuantityItemRow): boolean {
  return Boolean(
    row.estimate_line_id ||
    row.estimate_activity_id ||
    row.material_resource_id ||
    row.equipment_resource_id ||
    row.import_status,
  );
}

function hasMaterialQuantityChange(row: DesignQuantityItemRow, item: CreateDesignQuantityItemInput): boolean {
  return (
    row.design_object_id !== item.designObjectId ||
    row.quantity_type !== item.quantityType ||
    Number(row.quantity) !== item.quantity ||
    row.unit !== item.unit ||
    row.formula !== item.formula ||
    stableJson(row.parameter_snapshot ?? {}) !== stableJson(item.parameterSnapshot ?? {})
  );
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
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

export async function listDesignQuantityImportLinksByActivityKeys(params: {
  designModelId: string;
  projectId: string;
  estimateId?: string | null;
  activityKeys: readonly string[];
  sourcePreviewLineIds?: readonly string[];
}): Promise<RepositoryResult<DesignQuantityImportLink[]>> {
  if (params.activityKeys.length === 0 && (params.sourcePreviewLineIds?.length ?? 0) === 0) {
    return success([]);
  }

  try {
    let query = supabase
      .from('design_quantity_import_links')
      .select('*')
      .eq('design_model_id', params.designModelId)
      .eq('project_id', params.projectId)
      .is('superseded_at', null);

    query = params.estimateId
      ? query.eq('estimate_id', params.estimateId)
      : query.is('estimate_id', null);

    const { data, error } = await query;
    if (error) return failure(error.message);
    const activityKeys = new Set(params.activityKeys);
    const sourcePreviewLineIds = new Set(params.sourcePreviewLineIds ?? []);
    const filtered = (data as DesignQuantityImportLinkRow[]).filter((row) => {
      const sourcePreviewLineId =
        row.source_preview_line_id ?? stringFromMetadata(row.metadata, 'sourcePreviewLineId');
      return (
        (row.activity_key != null && activityKeys.has(row.activity_key)) ||
        (sourcePreviewLineId != null && sourcePreviewLineIds.has(sourcePreviewLineId))
      );
    });
    return success(filtered.map(mapImportLinkRow));
  } catch (err) {
    return failure(err);
  }
}

export async function createDesignQuantityImportLinks(
  links: readonly CreateDesignQuantityImportLinkInput[],
): Promise<RepositoryResult<DesignQuantityImportLink[]>> {
  if (links.length === 0) return success([]);

  try {
    const { data: userData } = await supabase.auth.getUser();
    const rows = links.map((link) => ({
      design_quantity_item_id: link.designQuantityItemId,
      design_model_id: link.designModelId,
      project_id: link.projectId,
      estimate_id: link.estimateId ?? null,
      target_type: link.targetType,
      target_id: link.targetId ?? null,
      project_activity_id: link.projectActivityId ?? null,
      usage_role: link.usageRole,
      destination: link.destination,
      scope_package_key: link.scopePackageKey,
      activity_key: link.activityKey ?? null,
      source_preview_line_id: link.sourcePreviewLineId ?? null,
      quantity: link.quantity,
      unit: link.unit,
      formula: link.formula,
      derived: link.derived,
      metadata: link.metadata ?? {},
      commit_batch_id: link.commitBatchId,
      created_by: userData.user?.id ?? null,
    }));

    const { data, error } = await supabase
      .from('design_quantity_import_links')
      .insert(rows)
      .select('*');
    if (error) return failure(error.message);
    return success((data as DesignQuantityImportLinkRow[]).map(mapImportLinkRow));
  } catch (err) {
    return failure(err);
  }
}

export async function finalizeDesignBuilderImportLinks(params: {
  designModelId: string;
  projectId: string;
  estimateId?: string | null;
  commitBatchId: string;
  activityKeys: readonly string[];
  sourcePreviewLineIds: readonly string[];
  links: readonly CreateDesignQuantityImportLinkInput[];
  quantityUpdates: Parameters<typeof markDesignQuantityItemsImported>[0]['updates'];
}): Promise<RepositoryResult<{ importLinks: DesignQuantityImportLink[]; quantityItems: DesignQuantityItem[] }>> {
  try {
    const linkRows = params.links.map((link) => ({
      design_quantity_item_id: link.designQuantityItemId,
      target_type: link.targetType,
      target_id: link.targetId ?? null,
      project_activity_id: link.projectActivityId ?? null,
      usage_role: link.usageRole,
      destination: link.destination,
      scope_package_key: link.scopePackageKey,
      activity_key: link.activityKey ?? null,
      source_preview_line_id: link.sourcePreviewLineId ?? null,
      quantity: link.quantity,
      unit: link.unit,
      formula: link.formula,
      derived: link.derived,
      metadata: link.metadata ?? {},
    }));
    const updateRows = params.quantityUpdates.map((update) => ({
      design_quantity_item_id: update.quantityItemId,
      estimate_activity_id: update.estimateActivityId ?? null,
      estimate_line_id: update.estimateLineId ?? null,
      material_resource_id: update.materialResourceId ?? null,
      equipment_resource_id: update.equipmentResourceId ?? null,
      import_destination: update.importDestination,
      import_status: update.importStatus,
      scope_package_key: update.scopePackageKey,
      import_review_reason: update.importReviewReason ?? null,
    }));

    const { data, error } = await supabase.rpc('finalize_design_builder_import_links', {
      p_design_model_id: params.designModelId,
      p_project_id: params.projectId,
      p_estimate_id: params.estimateId ?? null,
      p_commit_batch_id: params.commitBatchId,
      p_activity_keys: [...new Set(params.activityKeys)],
      p_source_preview_line_ids: [...new Set(params.sourcePreviewLineIds)],
      p_links: linkRows,
      p_quantity_updates: updateRows,
    });
    if (error) return failure(error.message);

    const payload = (data ?? {}) as FinalizeDesignBuilderImportLinksRow;
    return success({
      importLinks: (payload.import_links ?? []).map(mapImportLinkRow),
      quantityItems: (payload.quantity_items ?? []).map(mapQuantityRow),
    });
  } catch (err) {
    return failure(err);
  }
}

export async function deleteDesignQuantityImportLinks(
  linkIds: readonly string[],
): Promise<RepositoryResult<null>> {
  if (linkIds.length === 0) return success(null);

  try {
    const { error } = await supabase
      .from('design_quantity_import_links')
      .delete()
      .in('id', [...linkIds]);
    if (error) return failure(error.message);
    return success(null);
  } catch (err) {
    return failure(err);
  }
}
