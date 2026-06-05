import { supabase } from '../../../lib/supabase';
import type {
  EstimateInsert,
  EstimateLineItemInsert,
  EstimateLineItemRow,
  EstimateRow,
  EstimateSummary,
  EstimateVersionInsert,
  EstimateVersionRow,
  RepositoryResult,
} from './estimateDbTypes';
import {
  mapEstimateRowToSummary,
  mapLineItemRowsToEstimateVersion,
} from './estimateMappers';
import type { EstimateDomainVersion } from './estimateDbTypes';
import type { EstimateStatus } from '../domain/estimateTypes';

function toErrorMessage(error: { message: string } | null | undefined): string | null {
  if (!error) return null;
  return error.message || 'An unknown database error occurred.';
}

function success<T>(data: T): RepositoryResult<T> {
  return { data, error: null };
}

function failure<T>(error: string): RepositoryResult<T> {
  return { data: null, error };
}

export interface CreateEstimateParams {
  projectId: string;
  name?: string;
  status?: EstimateStatus;
  createdBy?: string | null;
}

export interface CreateEstimateVersionParams {
  estimateId: string;
  projectId: string;
  versionNumber: number;
  versionName: string;
  estimateType?: EstimateVersionInsert['estimate_type'];
  status?: EstimateStatus;
  snapshot?: Record<string, unknown>;
  totals?: Record<string, unknown>;
  notes?: string | null;
  createdBy?: string | null;
}

export interface InsertEstimateLineItemsParams {
  lineItems: EstimateLineItemInsert[];
}

export interface UpdateEstimateCurrentVersionParams {
  estimateId: string;
  versionId: string;
}

function mapEstimateRow(raw: Record<string, unknown>): EstimateRow {
  return raw as unknown as EstimateRow;
}

function mapEstimateVersionRow(raw: Record<string, unknown>): EstimateVersionRow {
  return raw as unknown as EstimateVersionRow;
}

function mapEstimateLineItemRow(raw: Record<string, unknown>): EstimateLineItemRow {
  return raw as unknown as EstimateLineItemRow;
}

export async function listEstimatesForProject(
  projectId: string,
): Promise<RepositoryResult<EstimateSummary[]>> {
  const { data, error } = await supabase
    .from('estimates')
    .select('*')
    .eq('project_id', projectId)
    .order('updated_at', { ascending: false });

  if (error) return failure(toErrorMessage(error)!);
  const rows = (data ?? []).map((row) => mapEstimateRow(row as Record<string, unknown>));
  return success(rows.map(mapEstimateRowToSummary));
}

export async function getEstimateById(
  estimateId: string,
): Promise<RepositoryResult<EstimateSummary>> {
  const { data, error } = await supabase
    .from('estimates')
    .select('*')
    .eq('id', estimateId)
    .maybeSingle();

  if (error) return failure(toErrorMessage(error)!);
  if (!data) return failure('Estimate not found.');
  return success(mapEstimateRowToSummary(mapEstimateRow(data as Record<string, unknown>)));
}

export async function listEstimateVersions(
  estimateId: string,
): Promise<RepositoryResult<EstimateVersionRow[]>> {
  const { data, error } = await supabase
    .from('estimate_versions')
    .select('*')
    .eq('estimate_id', estimateId)
    .order('version_number', { ascending: true });

  if (error) return failure(toErrorMessage(error)!);
  const rows = (data ?? []).map((row) =>
    mapEstimateVersionRow(row as Record<string, unknown>),
  );
  return success(rows);
}

export async function getEstimateVersionWithLineItems(
  estimateVersionId: string,
): Promise<RepositoryResult<EstimateDomainVersion>> {
  const { data: versionData, error: versionError } = await supabase
    .from('estimate_versions')
    .select('*')
    .eq('id', estimateVersionId)
    .maybeSingle();

  if (versionError) return failure(toErrorMessage(versionError)!);
  if (!versionData) return failure('Estimate version not found.');

  const versionRow = mapEstimateVersionRow(versionData as Record<string, unknown>);

  const { data: lineItemData, error: lineItemError } = await supabase
    .from('estimate_line_items')
    .select('*')
    .eq('estimate_version_id', estimateVersionId)
    .order('position', { ascending: true });

  if (lineItemError) return failure(toErrorMessage(lineItemError)!);

  const lineItemRows = (lineItemData ?? []).map((row) =>
    mapEstimateLineItemRow(row as Record<string, unknown>),
  );

  return success(mapLineItemRowsToEstimateVersion(versionRow, lineItemRows));
}

export async function createEstimate(
  params: CreateEstimateParams,
): Promise<RepositoryResult<EstimateSummary>> {
  const insert: EstimateInsert = {
    project_id: params.projectId,
    name: params.name ?? 'Project Estimate',
    status: params.status ?? 'draft',
    created_by: params.createdBy ?? null,
  };

  const { data, error } = await supabase.from('estimates').insert(insert).select('*').single();

  if (error) return failure(toErrorMessage(error)!);
  return success(mapEstimateRowToSummary(mapEstimateRow(data as Record<string, unknown>)));
}

export async function createEstimateVersion(
  params: CreateEstimateVersionParams,
): Promise<RepositoryResult<EstimateVersionRow>> {
  const insert: EstimateVersionInsert = {
    estimate_id: params.estimateId,
    project_id: params.projectId,
    version_number: params.versionNumber,
    version_name: params.versionName,
    estimate_type: params.estimateType ?? 'detailed',
    status: params.status ?? 'draft',
    snapshot: params.snapshot ?? {},
    totals: params.totals ?? {},
    notes: params.notes ?? null,
    created_by: params.createdBy ?? null,
  };

  const { data, error } = await supabase
    .from('estimate_versions')
    .insert(insert)
    .select('*')
    .single();

  if (error) return failure(toErrorMessage(error)!);
  return success(mapEstimateVersionRow(data as Record<string, unknown>));
}

export async function insertEstimateLineItems(
  params: InsertEstimateLineItemsParams,
): Promise<RepositoryResult<EstimateLineItemRow[]>> {
  if (params.lineItems.length === 0) {
    return success([]);
  }

  const { data, error } = await supabase
    .from('estimate_line_items')
    .insert(params.lineItems)
    .select('*');

  if (error) return failure(toErrorMessage(error)!);
  const rows = (data ?? []).map((row) =>
    mapEstimateLineItemRow(row as Record<string, unknown>),
  );
  return success(rows);
}

export async function updateEstimateCurrentVersion(
  params: UpdateEstimateCurrentVersionParams,
): Promise<RepositoryResult<EstimateSummary>> {
  const { data, error } = await supabase
    .from('estimates')
    .update({ current_version_id: params.versionId })
    .eq('id', params.estimateId)
    .select('*')
    .single();

  if (error) return failure(toErrorMessage(error)!);
  return success(mapEstimateRowToSummary(mapEstimateRow(data as Record<string, unknown>)));
}
