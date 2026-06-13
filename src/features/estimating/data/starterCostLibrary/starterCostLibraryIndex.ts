import type { StarterCostLibraryItem } from './starterCostLibraryTypes';
import { STARTER_MATERIAL_ITEMS } from './starterMaterials';
import { STARTER_EQUIPMENT_ITEMS } from './starterEquipment';

export const STARTER_COST_LIBRARY_ITEMS: StarterCostLibraryItem[] = [
  ...STARTER_MATERIAL_ITEMS,
  ...STARTER_EQUIPMENT_ITEMS,
];

export const STARTER_MATERIALS = STARTER_MATERIAL_ITEMS;
export const STARTER_EQUIPMENT = STARTER_EQUIPMENT_ITEMS;

/** Returns all items matching the given type, optionally filtered by category. */
export function getStarterItemsByCategory(
  type: 'material' | 'equipment',
  category?: string,
): StarterCostLibraryItem[] {
  const base = type === 'material' ? STARTER_MATERIALS : STARTER_EQUIPMENT;
  if (!category) return base;
  return base.filter((item) => item.category === category);
}

/** Case-insensitive search across name, description, category, subcategory, and tags. */
export function searchStarterCostLibrary(
  query: string,
  type?: 'material' | 'equipment',
): StarterCostLibraryItem[] {
  const q = query.trim().toLowerCase();
  const pool = type === 'material' ? STARTER_MATERIALS : type === 'equipment' ? STARTER_EQUIPMENT : STARTER_COST_LIBRARY_ITEMS;
  if (!q) return pool;
  return pool.filter(
    (item) =>
      item.name.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.subcategory.toLowerCase().includes(q) ||
      item.tags.some((t) => t.toLowerCase().includes(q)),
  );
}

/** Look up a single starter item by its string ID. Returns undefined if not found. */
export function getStarterCostItemById(
  id: string,
): StarterCostLibraryItem | undefined {
  return STARTER_COST_LIBRARY_ITEMS.find((item) => item.id === id);
}

/** All unique categories for the given type. */
export function getStarterCategories(type: 'material' | 'equipment'): string[] {
  const pool = type === 'material' ? STARTER_MATERIALS : STARTER_EQUIPMENT;
  return [...new Set(pool.map((item) => item.category))].sort();
}
