#!/usr/bin/env node
/**
 * Generate approved-only production rate seed bundles for the estimator.
 * Hard safety gate: fails if any non-approved record is present.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapRecordToLibraryEntry, mapRecordToProductionRate } from '../src/features/estimating/data/productionRates/mapToLibraryEntry';
import {
  ESTIMATOR_ALLOWED_QA_STATUS,
  type NormalizedProductionRateFile,
  type NormalizedProductionRateRecord,
} from '../src/features/estimating/data/productionRates/productionRateTypes';
import { assertApprovedProductionRateFile } from '../src/features/estimating/data/productionRates/validateExtractedProductionRates';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const approvedDir = join(repoRoot, 'data/estimating/production-rates/approved');
const generatedDir = join(repoRoot, 'src/features/estimating/data/productionRates/generated');

function loadApprovedRecords(): NormalizedProductionRateRecord[] {
  const files = readdirSync(approvedDir).filter((name) => name.endsWith('.approved.json'));
  const records: NormalizedProductionRateRecord[] = [];

  for (const name of files) {
    const payload = JSON.parse(
      readFileSync(join(approvedDir, name), 'utf8'),
    ) as NormalizedProductionRateFile;
    assertApprovedProductionRateFile(payload);
    records.push(...payload.records);
  }

  return records;
}

function enforceSafetyGate(records: NormalizedProductionRateRecord[]): void {
  const unsafe = records.filter((record) => !ESTIMATOR_ALLOWED_QA_STATUS.includes(record.qaStatus));
  if (unsafe.length > 0) {
    const sample = unsafe
      .slice(0, 5)
      .map((r) => `${r.id} (${r.qaStatus})`)
      .join(', ');
    throw new Error(
      `SAFETY GATE FAILED: ${unsafe.length} non-approved record(s) would enter generated output. Sample: ${sample}`,
    );
  }
}

function main(): void {
  const records = loadApprovedRecords();
  if (records.length === 0) {
    console.log('No approved records found. Seed generation skipped.');
    return;
  }

  enforceSafetyGate(records);

  const importBatchId = `approved-library-${new Date().toISOString().slice(0, 10)}`;
  const libraryEntries = records.map(mapRecordToLibraryEntry);
  const productionRates = records.map((record) => mapRecordToProductionRate(record, importBatchId));
  const indexWithStatus = records.map((record) => ({
    qaStatus: record.qaStatus,
    ...mapRecordToLibraryEntry(record),
  }));

  mkdirSync(generatedDir, { recursive: true });

  const ratesPath = join(generatedDir, 'generatedProductionRates.ts');
  const indexPath = join(generatedDir, 'generatedProductionRateIndex.ts');

  writeFileSync(
    ratesPath,
    `// AUTO-GENERATED — do not edit. Regenerate: npm run generate:production-rates
import type { ProductionRate } from '../../domain/constructionActivityTypes';

export const GENERATED_PRODUCTION_RATES: readonly ProductionRate[] = ${JSON.stringify(productionRates, null, 2)} as const;

export const GENERATED_PRODUCTION_RATE_MAP = new Map<string, ProductionRate>(
  GENERATED_PRODUCTION_RATES.map((rate) => [rate.id, rate]),
);
`,
    'utf8',
  );

  writeFileSync(
    indexPath,
    `// AUTO-GENERATED — do not edit. Regenerate: npm run generate:production-rates
import type { ProductionRateLibraryEntry } from '../productionRateTypes';

type IndexedLibraryEntry = ProductionRateLibraryEntry & { qaStatus: 'approved' };

export const GENERATED_PRODUCTION_RATE_INDEX: readonly IndexedLibraryEntry[] = ${JSON.stringify(indexWithStatus, null, 2)} as const;
`,
    'utf8',
  );

  console.log(`Wrote ${ratesPath} (${productionRates.length} rates)`);
  console.log(`Wrote ${indexPath} (${libraryEntries.length} library entries)`);
  console.log('Safety gate passed: all records are approved.');
}

main();
