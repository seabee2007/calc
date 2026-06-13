/**
 * Starter Cost Library generator.
 *
 * Reads per-trade seed JSON files from:
 *   seeds/materials/<trade>.json
 *   seeds/equipment/<trade>.json
 *
 * Merges, deduplicates, validates, sorts, then writes:
 *   starterMaterials.ts
 *   starterEquipment.ts
 *
 * Usage:
 *   node scripts/generateStarterCostLibrary.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const LIB_DIR = path.join(ROOT, 'src/features/estimating/data/starterCostLibrary');
const SEEDS_MAT_DIR = path.join(LIB_DIR, 'seeds/materials');
const SEEDS_EQ_DIR = path.join(LIB_DIR, 'seeds/equipment');

const VALID_CONFIDENCES = new Set(['placeholder', 'low', 'medium', 'high']);
const MATERIAL_VALID_UNITS = new Set([
  'EA', 'LF', 'SF', 'SY', 'CY', 'TON', 'LB', 'BAG', 'ROLL', 'BOX', 'SQ', 'GAL', 'MBF',
  'bag', 'pallet', 'gal', 'pail', 'roll', 'box', 'Sq', 'sq', 'bundle', 'lb', 'm³',
]);
const EQUIPMENT_VALID_UNITS = new Set(['HR', 'DAY', 'WEEK', 'MONTH', 'hour', 'day', 'week', 'month']);
const GENERIC_NAMES = new RegExp(
  '^(2x4|2x6|compactor|concrete|pipe|wire|lumber|nails|screws|hardware|material|equipment|item)$',
  'i',
);

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

function readJsonDir(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .flatMap((f) => {
      const filePath = path.join(dir, f);
      try {
        const items = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (!Array.isArray(items)) throw new Error('must be an array');
        return items.map((item) => ({ ...item, _sourceFile: f }));
      } catch (err) {
        throw new Error(`Failed to parse ${filePath}: ${err.message}`);
      }
    });
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateItem(item, index) {
  const loc = `${item._sourceFile ?? '?'}[${index}]`;

  if (!item.id || typeof item.id !== 'string')
    throw new Error(`${loc}: missing or invalid id`);
  if (!item.name || typeof item.name !== 'string')
    throw new Error(`${loc} id=${item.id}: missing name`);
  if (item.name.trim().length < 12)
    throw new Error(`${loc} id=${item.id}: name too short (<12 chars): "${item.name}"`);
  if (GENERIC_NAMES.test(item.name.trim()))
    throw new Error(`${loc} id=${item.id}: generic-only name not allowed: "${item.name}"`);
  if (!item.description || item.description.length < 40)
    throw new Error(`${loc} id=${item.id}: description too short (<40 chars)`);
  if (!item.category)
    throw new Error(`${loc} id=${item.id}: missing category`);
  if (!item.subcategory)
    throw new Error(`${loc} id=${item.id}: missing subcategory`);
  if (!item.unit)
    throw new Error(`${loc} id=${item.id}: missing unit`);
  if (!Array.isArray(item.tags) || item.tags.length === 0)
    throw new Error(`${loc} id=${item.id}: tags must be a non-empty array`);
  if (!VALID_CONFIDENCES.has(item.costConfidence))
    throw new Error(`${loc} id=${item.id}: invalid costConfidence "${item.costConfidence}"`);
  if (item.pricingRequired !== true)
    throw new Error(`${loc} id=${item.id}: pricingRequired must be true`);
  if (typeof item.defaultUnitCost !== 'number' || !Number.isFinite(item.defaultUnitCost) || item.defaultUnitCost < 0)
    throw new Error(`${loc} id=${item.id}: defaultUnitCost must be a finite number >= 0`);

  const allUnits = [item.unit, ...(item.commonUnits ?? [])];
  const validUnitSet = item.type === 'material' ? MATERIAL_VALID_UNITS : EQUIPMENT_VALID_UNITS;
  const hasValidUnit = allUnits.some((u) => validUnitSet.has(u));
  if (!hasValidUnit) {
    throw new Error(
      `${loc} id=${item.id}: no recognized unit in unit/commonUnits: ${JSON.stringify(allUnits)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Merge helpers
// ---------------------------------------------------------------------------

function dedupeById(items) {
  const seen = new Map();
  const dupes = [];
  for (const item of items) {
    if (seen.has(item.id)) {
      dupes.push(`id="${item.id}" in ${item._sourceFile} (first seen in ${seen.get(item.id)})`);
    } else {
      seen.set(item.id, item._sourceFile ?? '?');
    }
  }
  if (dupes.length > 0) {
    throw new Error(`Duplicate IDs found:\n  ${dupes.join('\n  ')}`);
  }
  return items;
}

function sortItems(items) {
  return [...items].sort((a, b) => {
    const cmp = (x, y) => (x ?? '').localeCompare(y ?? '');
    return cmp(a.type, b.type) || cmp(a.category, b.category) ||
      cmp(a.subcategory, b.subcategory) || cmp(a.name, b.name);
  });
}

function stripMeta(item) {
  const { _sourceFile, ...rest } = item;
  return rest;
}

// ---------------------------------------------------------------------------
// TypeScript module writer
// ---------------------------------------------------------------------------

function toTsModule(exportName, items, label) {
  const json = JSON.stringify(items.map(stripMeta), null, 2);
  return [
    `import type { StarterCostLibraryItem } from './starterCostLibraryTypes';`,
    ``,
    `/** Auto-generated starter ${label} catalog. DO NOT EDIT DIRECTLY.`,
    ` * Edit seed files in seeds/materials/ or seeds/equipment/ and re-run:`,
    ` *   node scripts/generateStarterCostLibrary.mjs`,
    ` */`,
    `export const ${exportName}: StarterCostLibraryItem[] = ${json};`,
    ``,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const rawMaterials = readJsonDir(SEEDS_MAT_DIR);
  const rawEquipment = readJsonDir(SEEDS_EQ_DIR);

  console.log(`Read ${rawMaterials.length} materials from ${SEEDS_MAT_DIR}`);
  console.log(`Read ${rawEquipment.length} equipment from ${SEEDS_EQ_DIR}`);

  // Validate
  let errors = 0;
  for (const [i, item] of rawMaterials.entries()) {
    try { validateItem(item, i); }
    catch (e) { console.error('  MATERIAL ERROR:', e.message); errors++; }
  }
  for (const [i, item] of rawEquipment.entries()) {
    try { validateItem(item, i); }
    catch (e) { console.error('  EQUIPMENT ERROR:', e.message); errors++; }
  }
  if (errors > 0) {
    throw new Error(`Validation failed with ${errors} error(s). Fix seed files before building.`);
  }

  // Deduplicate (throws on collision)
  dedupeById([...rawMaterials, ...rawEquipment]);

  // Sort
  const allMaterials = sortItems(rawMaterials);
  const allEquipment = sortItems(rawEquipment);

  // Write TypeScript modules
  fs.writeFileSync(
    path.join(LIB_DIR, 'starterMaterials.ts'),
    toTsModule('STARTER_MATERIAL_ITEMS', allMaterials, 'material'),
  );
  fs.writeFileSync(
    path.join(LIB_DIR, 'starterEquipment.ts'),
    toTsModule('STARTER_EQUIPMENT_ITEMS', allEquipment, 'equipment'),
  );

  console.log(`\nGenerated:`);
  console.log(`  starterMaterials.ts  (${allMaterials.length} items)`);
  console.log(`  starterEquipment.ts  (${allEquipment.length} items)`);
  console.log(`  Total: ${allMaterials.length + allEquipment.length} starter catalog items`);
}

main();
