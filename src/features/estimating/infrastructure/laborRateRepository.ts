/**
 * Supabase CRUD for company_labor_rates and project_labor_rates.
 * Returns RepositoryResult<T> — never throws for DB failures.
 */
import { supabase } from '../../../lib/supabase';
import type {
  CompanyLaborRate,
  CompanyLaborRateInput,
  ProjectLaborRate,
  ProjectLaborRateInput,
} from '../domain/laborRateTypes';
import { STARTER_LABOR_ROLES } from '../domain/laborRateTypes';
import type { RepositoryResult } from './estimateDbTypes';
import type { CompanyLaborRateRow, ProjectLaborRateRow } from './activityDbTypes';

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

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function mapCompanyLaborRateFromRow(row: CompanyLaborRateRow): CompanyLaborRate {
  return {
    id: row.id,
    userId: row.user_id,
    roleKey: row.role_key,
    roleName: row.role_name,
    tradeCategory: row.trade_category,
    hourlyRate: toNumber(row.hourly_rate),
    burdenPercent: toNumber(row.burden_percent),
    fullyBurdenedRate: toNumber(row.fully_burdened_rate),
    billingRate: toNumber(row.billing_rate),
    description: row.description ?? undefined,
    isActive: row.is_active,
    isDefault: row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapProjectLaborRateFromRow(row: ProjectLaborRateRow): ProjectLaborRate {
  return {
    id: row.id,
    projectId: row.project_id,
    companyLaborRateId: row.company_labor_rate_id,
    roleKey: row.role_key,
    roleName: row.role_name,
    tradeCategory: row.trade_category,
    hourlyRate: toNumber(row.hourly_rate),
    burdenPercent: toNumber(row.burden_percent),
    fullyBurdenedRate: toNumber(row.fully_burdened_rate),
    billingRate: toNumber(row.billing_rate),
    description: row.description ?? undefined,
    isActive: row.is_active,
    isDefault: row.is_default,
    isOverride: row.is_override,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCompanyLaborRateToRow(input: CompanyLaborRateInput): Record<string, unknown> {
  return {
    user_id: input.userId,
    role_key: input.roleKey,
    role_name: input.roleName,
    trade_category: input.tradeCategory ?? 'General',
    hourly_rate: input.hourlyRate ?? 0,
    burden_percent: input.burdenPercent ?? 0,
    billing_rate: input.billingRate ?? 0,
    description: input.description ?? null,
    is_active: input.isActive ?? true,
    is_default: input.isDefault ?? false,
  };
}

function mapProjectLaborRateToRow(input: ProjectLaborRateInput): Record<string, unknown> {
  return {
    project_id: input.projectId,
    company_labor_rate_id: input.companyLaborRateId ?? null,
    role_key: input.roleKey,
    role_name: input.roleName,
    trade_category: input.tradeCategory ?? 'General',
    hourly_rate: input.hourlyRate ?? 0,
    burden_percent: input.burdenPercent ?? 0,
    billing_rate: input.billingRate ?? 0,
    description: input.description ?? null,
    is_active: input.isActive ?? true,
    is_default: input.isDefault ?? false,
    is_override: input.isOverride ?? false,
  };
}

export async function fetchCompanyLaborRatesFromDb(
  userId: string,
  activeOnly = true,
): Promise<RepositoryResult<CompanyLaborRate[]>> {
  try {
    let query = supabase
      .from('company_labor_rates')
      .select('*')
      .eq('user_id', userId)
      .order('role_name');

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) return failure(error.message);
    return success((data as CompanyLaborRateRow[]).map(mapCompanyLaborRateFromRow));
  } catch (err) {
    return failure(err);
  }
}

export async function upsertCompanyLaborRateInDb(
  input: CompanyLaborRateInput,
): Promise<RepositoryResult<CompanyLaborRate>> {
  try {
    const payload = mapCompanyLaborRateToRow(input);
    if (input.id) {
      const { data, error } = await supabase
        .from('company_labor_rates')
        .update(payload)
        .eq('id', input.id)
        .eq('user_id', input.userId)
        .select('*');
      if (error) return failure(error.message);
      const row = (data as CompanyLaborRateRow[] | null)?.[0];
      if (!row) {
        return failure('Labor rate not found or you do not have permission to update it.');
      }
      return success(mapCompanyLaborRateFromRow(row));
    }

    const { data, error } = await supabase
      .from('company_labor_rates')
      .upsert(payload, { onConflict: 'user_id,role_key' })
      .select('*')
      .single();
    if (error) return failure(error.message);
    return success(mapCompanyLaborRateFromRow(data as CompanyLaborRateRow));
  } catch (err) {
    return failure(err);
  }
}

export async function softDeleteCompanyLaborRateInDb(
  id: string,
  userId: string,
): Promise<RepositoryResult<CompanyLaborRate>> {
  try {
    const { data, error } = await supabase
      .from('company_labor_rates')
      .update({ is_active: false, is_default: false })
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .single();
    if (error) return failure(error.message);
    return success(mapCompanyLaborRateFromRow(data as CompanyLaborRateRow));
  } catch (err) {
    return failure(err);
  }
}

export async function seedStarterCompanyLaborRatesInDb(
  userId: string,
): Promise<RepositoryResult<CompanyLaborRate[]>> {
  try {
    const { error: rpcError } = await supabase.rpc('seed_starter_company_labor_rates', {
      p_user_id: userId,
    });
    if (rpcError) {
      // Fallback when RPC not deployed yet — insert directly if table empty.
      const existing = await fetchCompanyLaborRatesFromDb(userId, false);
      if (existing.data && existing.data.length > 0) {
        return success(existing.data);
      }

      const rows = STARTER_LABOR_ROLES.map((role, index) => ({
        user_id: userId,
        role_key: role.roleKey,
        role_name: role.roleName,
        trade_category: role.tradeCategory,
        is_default: index === 0,
      }));

      const { data, error } = await supabase.from('company_labor_rates').insert(rows).select('*');
      if (error) return failure(error.message);
      return success((data as CompanyLaborRateRow[]).map(mapCompanyLaborRateFromRow));
    }

    return fetchCompanyLaborRatesFromDb(userId);
  } catch (err) {
    return failure(err);
  }
}

export async function fetchProjectLaborRatesFromDb(
  projectId: string,
  activeOnly = true,
): Promise<RepositoryResult<ProjectLaborRate[]>> {
  try {
    let query = supabase
      .from('project_labor_rates')
      .select('*')
      .eq('project_id', projectId)
      .order('role_name');

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) return failure(error.message);
    return success((data as ProjectLaborRateRow[]).map(mapProjectLaborRateFromRow));
  } catch (err) {
    return failure(err);
  }
}

export async function insertProjectLaborRatesInDb(
  rates: ProjectLaborRateInput[],
): Promise<RepositoryResult<ProjectLaborRate[]>> {
  if (rates.length === 0) return success([]);
  try {
    const rows = rates.map(mapProjectLaborRateToRow);
    const { data, error } = await supabase.from('project_labor_rates').insert(rows).select('*');
    if (error) return failure(error.message);
    return success((data as ProjectLaborRateRow[]).map(mapProjectLaborRateFromRow));
  } catch (err) {
    return failure(err);
  }
}

export async function upsertProjectLaborRateInDb(
  input: ProjectLaborRateInput,
): Promise<RepositoryResult<ProjectLaborRate>> {
  try {
    const payload = mapProjectLaborRateToRow(input);
    if (input.id) {
      const { data, error } = await supabase
        .from('project_labor_rates')
        .update(payload)
        .eq('id', input.id)
        .eq('project_id', input.projectId)
        .select('*')
        .single();
      if (error) return failure(error.message);
      return success(mapProjectLaborRateFromRow(data as ProjectLaborRateRow));
    }

    const { data, error } = await supabase
      .from('project_labor_rates')
      .upsert(payload, { onConflict: 'project_id,role_key' })
      .select('*')
      .single();
    if (error) return failure(error.message);
    return success(mapProjectLaborRateFromRow(data as ProjectLaborRateRow));
  } catch (err) {
    return failure(err);
  }
}

export async function clearProjectLaborRateDefaultInDb(
  projectId: string,
  exceptId?: string,
): Promise<RepositoryResult<null>> {
  try {
    let query = supabase
      .from('project_labor_rates')
      .update({ is_default: false })
      .eq('project_id', projectId);

    if (exceptId) {
      query = query.neq('id', exceptId);
    }

    const { error } = await query;
    if (error) return failure(error.message);
    return success(null);
  } catch (err) {
    return failure(err);
  }
}

export async function clearCompanyLaborRateDefaultInDb(
  userId: string,
  exceptId?: string,
): Promise<RepositoryResult<null>> {
  try {
    let query = supabase
      .from('company_labor_rates')
      .update({ is_default: false })
      .eq('user_id', userId);

    if (exceptId) {
      query = query.neq('id', exceptId);
    }

    const { error } = await query;
    if (error) return failure(error.message);
    return success(null);
  } catch (err) {
    return failure(err);
  }
}

export async function fetchProjectActivitiesUsingLaborRole(
  projectId: string,
  roleKey: string,
): Promise<RepositoryResult<Array<{ activityId: string; lineItemId: string; activityTitle: string }>>> {
  try {
    const { data, error } = await supabase
      .from('project_activity_line_items')
      .select(
        'id, project_activity_id, labor_role_key, project_construction_activities!inner(id, title, project_id)',
      )
      .eq('project_id', projectId)
      .eq('labor_role_key', roleKey);

    if (error) return failure(error.message);

    const rows = (data ?? []) as Array<{
      id: string;
      project_activity_id: string;
      labor_role_key: string | null;
      project_construction_activities: { id: string; title: string; project_id: string };
    }>;

    return success(
      rows.map((row) => ({
        activityId: row.project_activity_id,
        lineItemId: row.id,
        activityTitle: row.project_construction_activities.title,
      })),
    );
  } catch (err) {
    return failure(err);
  }
}

export async function replaceProjectLineItemsInDb(
  projectActivityId: string,
  lineItems: Record<string, unknown>[],
): Promise<RepositoryResult<null>> {
  try {
    const { error: deleteError } = await supabase
      .from('project_activity_line_items')
      .delete()
      .eq('project_activity_id', projectActivityId);

    if (deleteError) return failure(deleteError.message);
    if (lineItems.length === 0) return success(null);

    const { error } = await supabase.from('project_activity_line_items').insert(lineItems);
    if (error) return failure(error.message);
    return success(null);
  } catch (err) {
    return failure(err);
  }
}
