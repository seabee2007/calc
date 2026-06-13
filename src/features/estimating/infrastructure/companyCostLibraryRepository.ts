/**
 * Repository for company_cost_library_items.
 * User-managed reusable cost items (materials and equipment).
 */
import { supabase } from '../../../lib/supabase';
import type { CompanyCostLibraryItem } from '../domain/constructionActivityTypes';
import type { RepositoryResult } from './estimateDbTypes';
import type {
  CompanyCostLibraryItemRow,
  CompanyCostLibraryItemInsert,
} from './activityDbTypes';
import {
  mapCompanyCostLibraryItemFromRow,
  mapCompanyCostLibraryItemToInsert,
} from './activityMappers';

function failure<T>(err: unknown): RepositoryResult<T> {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === 'object' && err !== null && 'message' in err
        ? String((err as { message: unknown }).message)
        : String(err);
  return { data: null, error: message };
}

function success<T>(data: T): RepositoryResult<T> {
  return { data, error: null };
}

export async function fetchCompanyCostLibraryItems(
  type?: 'material' | 'equipment',
): Promise<RepositoryResult<CompanyCostLibraryItem[]>> {
  try {
    let query = supabase
      .from('company_cost_library_items')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });
    if (type) {
      query = query.eq('type', type);
    }
    const { data, error } = await query;
    if (error) return failure(error);
    return success((data as CompanyCostLibraryItemRow[]).map(mapCompanyCostLibraryItemFromRow));
  } catch (err) {
    return failure(err);
  }
}

export async function upsertCompanyCostLibraryItem(
  item: Omit<CompanyCostLibraryItem, 'id' | 'createdAt' | 'updatedAt'>,
  existingId?: string,
): Promise<RepositoryResult<CompanyCostLibraryItem>> {
  try {
    const payload: CompanyCostLibraryItemInsert & { id?: string } = {
      ...mapCompanyCostLibraryItemToInsert(item),
    };
    if (existingId) {
      (payload as Record<string, unknown>)['id'] = existingId;
    }
    const { data, error } = await supabase
      .from('company_cost_library_items')
      .upsert(payload)
      .select()
      .single();
    if (error || !data) return failure(error ?? 'Upsert failed');
    return success(mapCompanyCostLibraryItemFromRow(data as CompanyCostLibraryItemRow));
  } catch (err) {
    return failure(err);
  }
}

export async function deleteCompanyCostLibraryItem(id: string): Promise<RepositoryResult<void>> {
  try {
    const { error } = await supabase
      .from('company_cost_library_items')
      .update({ is_active: false })
      .eq('id', id);
    if (error) return failure(error);
    return success(undefined);
  } catch (err) {
    return failure(err);
  }
}
