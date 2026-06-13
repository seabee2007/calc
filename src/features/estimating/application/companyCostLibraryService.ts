/**
 * Company Cost Library Service.
 *
 * Manages the user's reusable material and equipment pricing items.
 * Deduplicates by name (case-insensitive) within a user + type combination.
 */
import type { CompanyCostLibraryItem } from '../domain/constructionActivityTypes';
import {
  fetchCompanyCostLibraryItems,
  upsertCompanyCostLibraryItem,
  deleteCompanyCostLibraryItem,
} from '../infrastructure/companyCostLibraryRepository';

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getCompanyCostLibraryItems(
  type?: 'material' | 'equipment',
): Promise<{ items: CompanyCostLibraryItem[]; error: string | null }> {
  const result = await fetchCompanyCostLibraryItems(type);
  return { items: result.data ?? [], error: result.error };
}

export async function searchCompanyCostLibraryItems(
  query: string,
  type?: 'material' | 'equipment',
): Promise<{ items: CompanyCostLibraryItem[]; error: string | null }> {
  const { items, error } = await getCompanyCostLibraryItems(type);
  if (error) return { items: [], error };
  if (!query.trim()) return { items, error: null };
  const q = query.trim().toLowerCase();
  const filtered = items.filter(
    (item) =>
      item.name.toLowerCase().includes(q) ||
      (item.category ?? '').toLowerCase().includes(q) ||
      (item.subcategory ?? '').toLowerCase().includes(q) ||
      (item.description ?? '').toLowerCase().includes(q),
  );
  return { items: filtered, error: null };
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export async function addCompanyCostLibraryItem(
  item: Omit<CompanyCostLibraryItem, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<{ item: CompanyCostLibraryItem | null; error: string | null }> {
  const result = await upsertCompanyCostLibraryItem(item);
  return { item: result.data, error: result.error };
}

export async function updateCompanyCostLibraryItem(
  id: string,
  updates: Omit<CompanyCostLibraryItem, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<{ item: CompanyCostLibraryItem | null; error: string | null }> {
  const result = await upsertCompanyCostLibraryItem(updates, id);
  return { item: result.data, error: result.error };
}

export async function deleteCompanyCostLibraryItemById(
  id: string,
): Promise<{ error: string | null }> {
  const result = await deleteCompanyCostLibraryItem(id);
  return { error: result.error };
}
