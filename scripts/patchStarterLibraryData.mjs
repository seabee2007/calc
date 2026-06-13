/**
 * One-shot patch for starter library data quality issues.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LIB_DIR = path.join(__dirname, '../src/features/estimating/data/starterCostLibrary');

function extractTsExportArray(filePath, exportName) {
  const content = fs.readFileSync(filePath, 'utf8');
  const marker = `export const ${exportName}`;
  const start = content.indexOf(marker);
  const arrStart = content.indexOf('= [', start);
  const bracketStart = arrStart + 2;
  let depth = 0;
  let arrEnd = bracketStart;
  for (let i = bracketStart; i < content.length; i++) {
    if (content[i] === '[') depth++;
    else if (content[i] === ']') {
      depth--;
      if (depth === 0) {
        arrEnd = i + 1;
        break;
      }
    }
  }
  return eval(content.slice(bracketStart, arrEnd));
}

function patchItem(item) {
  const name =
    item.name.length >= 12
      ? item.name
      : `${item.name}, construction supply catalog item`;
  const defaultUnitCost =
    typeof item.defaultUnitCost === 'number' && Number.isFinite(item.defaultUnitCost)
      ? Math.max(0, item.defaultUnitCost)
      : 0;
  return {
    ...item,
    name,
    defaultUnitCost,
    costConfidence: item.costConfidence || 'placeholder',
    pricingRequired: item.pricingRequired ?? true,
    notes: item.notes || 'Starter placeholder only. Verify local supplier pricing before proposal.',
  };
}

function toTsModule(exportName, items, label) {
  return `import type { StarterCostLibraryItem } from './starterCostLibraryTypes';

/** Auto-generated starter ${label} catalog. */
export const ${exportName}: StarterCostLibraryItem[] = ${JSON.stringify(items, null, 2)};
`;
}

const materials = extractTsExportArray(path.join(LIB_DIR, 'starterMaterials.ts'), 'STARTER_MATERIAL_ITEMS').map(patchItem);
const equipment = extractTsExportArray(path.join(LIB_DIR, 'starterEquipment.ts'), 'STARTER_EQUIPMENT_ITEMS').map(patchItem);

fs.writeFileSync(path.join(LIB_DIR, 'starterMaterials.ts'), toTsModule('STARTER_MATERIAL_ITEMS', materials, 'material'));
fs.writeFileSync(path.join(LIB_DIR, 'starterEquipment.ts'), toTsModule('STARTER_EQUIPMENT_ITEMS', equipment, 'equipment'));
fs.mkdirSync(path.join(LIB_DIR, 'seeds'), { recursive: true });
fs.writeFileSync(path.join(LIB_DIR, 'seeds/materials.json'), JSON.stringify(materials, null, 2));
fs.writeFileSync(path.join(LIB_DIR, 'seeds/equipment.json'), JSON.stringify(equipment, null, 2));

console.log(`Patched ${materials.length} materials and ${equipment.length} equipment`);
