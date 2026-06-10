/**
 * Converts a validated reviewed rate file into a TypeScript ProductionRate[] seed bundle.
 *
 * Usage (Node script):
 *   import div03 from '../data/manualRates/division03Concrete.reviewed.json';
 *   const seed = buildProductionRateSeedBundle(div03, 'batch-div03-2026-06');
 *   // Write seed to src/features/estimating/data/generated/div03ConcreteRates.generated.ts
 *
 * The generated file is checked in and used as the authoritative TypeScript source.
 * Never edit generated files manually — edit the reviewed JSON and regenerate.
 */
import type { ProductionRate } from '../domain/constructionActivityTypes';
import type { ReviewedProductionRateEntry, ReviewedRateFile } from './manualRateTypes';
import { validateReviewedRateFile } from './validateProductionRates';

export interface SeedBuildResult {
  rates: ProductionRate[];
  skippedIds: string[];
  warnings: string[];
}

/**
 * Converts a reviewed rate file into ProductionRate[] instances.
 * Throws if the file fails validation.
 */
export function buildProductionRateSeedBundle(file: ReviewedRateFile, importBatchId: string): SeedBuildResult {
  const validation = validateReviewedRateFile(file);
  if (!validation.valid) {
    const summary = validation.errors.map((e) => `  [${e.id}] ${e.field}: ${e.message}`).join('\n');
    throw new Error(`Reviewed rate file failed validation (${validation.errorCount} errors):\n${summary}`);
  }

  const warnings: string[] = validation.warnings.map((w) => `[${w.id}] ${w.field}: ${w.message}`);
  const rates: ProductionRate[] = [];
  const skippedIds: string[] = [];

  for (const entry of file.rates) {
    const rate = entryToProductionRate(entry, file.batchMeta.divisionCode, file.batchMeta.divisionName, importBatchId, file.batchMeta.sourceManual, file.batchMeta.sourceEdition);
    if (rate) {
      rates.push(rate);
    } else {
      skippedIds.push(entry.id);
    }
  }

  return { rates, skippedIds, warnings };
}

function entryToProductionRate(
  entry: ReviewedProductionRateEntry,
  divisionCode: string,
  divisionName: string,
  importBatchId: string,
  sourceManual: string,
  sourceEdition: string,
): ProductionRate | null {
  return {
    id: entry.id,
    divisionCode,
    divisionName,
    masterFormatCode: entry.masterFormatCode,
    workElementLineNumber: entry.workElementLineNumber,
    description: entry.description,
    unit: entry.unit,
    rateType: entry.rateType,
    manHoursPerUnit: entry.manHoursPerUnit,
    equipmentHoursPerUnit: entry.equipmentHoursPerUnit,
    quantityPerUnit: entry.quantityPerUnit,
    minimumCrewSize: entry.minimumCrewSize,
    crewComposition: entry.crewComposition,
    sourceManual,
    sourceEdition,
    sourceDivision: divisionCode,
    sourceFigure: entry.sourceFigure,
    sourcePage: entry.sourcePage,
    sourcePdfPage: entry.sourcePdfPage,
    sourceNotes: entry.sourceNotes,
    directLaborOnly: entry.directLaborOnly,
    militaryAdjusted: entry.militaryAdjusted,
    civilianConversionMultiplier: entry.civilianConversionMultiplier,
    tags: [...entry.tags],
    applicableActivityTypes: [...entry.applicableActivityTypes],
    importBatchId,
    isActive: true,
  };
}

/**
 * Generates the TypeScript source text for a seed file from a rate bundle.
 * The generated text is written to the data/generated/ directory.
 */
export function generateSeedFileText(rates: ProductionRate[], exportName: string): string {
  const lines: string[] = [
    '// AUTO-GENERATED — do not edit manually.',
    '// Regenerate by running: npx ts-node scripts/generateRateSeeds.ts',
    "import type { ProductionRate } from '../../domain/constructionActivityTypes';",
    '',
    `export const ${exportName}: readonly ProductionRate[] = ${JSON.stringify(rates, null, 2)} as const;`,
    '',
    `export const ${exportName}_MAP = new Map<string, ProductionRate>(`,
    `  ${exportName}.map((r) => [r.id, r]),`,
    ');',
    '',
  ];
  return lines.join('\n');
}
