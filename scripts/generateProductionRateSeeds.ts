#!/usr/bin/env node
/**
 * Generate TypeScript seed files (and optional Supabase SQL) from approved production-rate JSON.
 *
 * Usage:
 *   npx tsx scripts/generateProductionRateSeeds.ts
 *   npx tsx scripts/generateProductionRateSeeds.ts --sql
 *
 * Only reads from data/estimating/production-rates/approved/.
 * Raw and reviewed files are never consumed by this script.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildProductionRateSeedBundle, generateSeedFileText } from '../src/features/estimating/rates/buildProductionRateSeed';
import {
  divisionSeedExportName,
  mapExtractedFileToReviewedRateFile,
} from '../src/features/estimating/data/productionRates/mapExtractedToReviewedRate';
import type { ExtractedProductionRateFile } from '../src/features/estimating/data/productionRates/productionRateTypes';
import { assertApprovedProductionRateFile } from '../src/features/estimating/data/productionRates/validateExtractedProductionRates';

const repoRoot = join(import.meta.dirname, '..');
const approvedDir = join(repoRoot, 'data/estimating/production-rates/approved');
const generatedDir = join(repoRoot, 'src/features/estimating/data/generated');
const sqlDir = join(repoRoot, 'supabase/seeds/production_rates');

const writeSql = process.argv.includes('--sql');

function loadApprovedFiles(): ExtractedProductionRateFile[] {
  let files: string[];
  try {
    files = readdirSync(approvedDir).filter((name) => name.endsWith('.approved.json'));
  } catch {
    console.warn(`No approved directory found at ${approvedDir}. Nothing to generate.`);
    return [];
  }

  return files.map((name) => {
    const payload = JSON.parse(readFileSync(join(approvedDir, name), 'utf8')) as ExtractedProductionRateFile;
    assertApprovedProductionRateFile(payload);
    return payload;
  });
}

function groupByDivision(files: ExtractedProductionRateFile[]): Map<string, ExtractedProductionRateFile[]> {
  const groups = new Map<string, ExtractedProductionRateFile[]>();
  for (const file of files) {
    const key = file.batchMeta.division;
    const bucket = groups.get(key) ?? [];
    bucket.push(file);
    groups.set(key, bucket);
  }
  return groups;
}

function mergeRecords(files: ExtractedProductionRateFile[]): ExtractedProductionRateFile {
  const [first] = files;
  return {
    batchMeta: first.batchMeta,
    records: files.flatMap((file) => file.records),
  };
}

function sqlEscape(value: string): string {
  return value.replace(/'/g, "''");
}

function generateSqlInsert(file: ExtractedProductionRateFile, importBatchId: string): string {
  const reviewed = mapExtractedFileToReviewedRateFile(file, file.batchMeta.reviewedBy ?? 'approved-pipeline');
  const bundle = buildProductionRateSeedBundle(reviewed, importBatchId);
  const lines = [
    '-- AUTO-GENERATED from approved production-rate JSON. Do not edit manually.',
    `-- batch: ${importBatchId}`,
    'BEGIN;',
  ];

  for (const rate of bundle.rates) {
    lines.push(
      "INSERT INTO production_rates (id, division_code, division_name, master_format_code, work_element_line_number, description, unit, rate_type, man_hours_per_unit, source_manual, source_edition, source_figure, source_page, import_batch_id, payload) VALUES (",
      `'${sqlEscape(rate.id)}', '${sqlEscape(rate.divisionCode)}', '${sqlEscape(rate.divisionName)}', '${sqlEscape(rate.masterFormatCode)}', '${sqlEscape(rate.workElementLineNumber)}', '${sqlEscape(rate.description)}', '${sqlEscape(rate.unit)}', '${sqlEscape(rate.rateType)}', ${rate.manHoursPerUnit ?? 'NULL'}, '${sqlEscape(rate.sourceManual)}', '${sqlEscape(rate.sourceEdition)}', '${sqlEscape(rate.sourceFigure)}', '${sqlEscape(rate.sourcePage)}', '${sqlEscape(importBatchId)}', '${sqlEscape(JSON.stringify(rate))}'::jsonb`,
      ') ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, import_batch_id = EXCLUDED.import_batch_id;',
    );
  }

  lines.push('COMMIT;');
  return lines.join('\n');
}

function main(): void {
  const approvedFiles = loadApprovedFiles();
  if (approvedFiles.length === 0) {
    console.log('No approved JSON files found. Seed generation skipped.');
    return;
  }

  mkdirSync(generatedDir, { recursive: true });
  if (writeSql) mkdirSync(sqlDir, { recursive: true });

  const groups = groupByDivision(approvedFiles);
  for (const [divisionCode, files] of groups.entries()) {
    const merged = mergeRecords(files);
    const reviewedBy = merged.batchMeta.reviewedBy ?? 'approved-pipeline';
    const reviewed = mapExtractedFileToReviewedRateFile(merged, reviewedBy);
    const importBatchId = `approved-div${divisionCode}-${new Date().toISOString().slice(0, 10)}`;
    const bundle = buildProductionRateSeedBundle(reviewed, importBatchId);
    const exportName = divisionSeedExportName(divisionCode, merged.batchMeta.divisionName);
    const outFile = join(generatedDir, `${exportName}.generated.ts`);
    writeFileSync(outFile, generateSeedFileText(bundle.rates, exportName), 'utf8');
    console.log(`Wrote ${outFile} (${bundle.rates.length} rates)`);

    if (writeSql) {
      const sqlFile = join(sqlDir, `${exportName}.sql`);
      writeFileSync(sqlFile, generateSqlInsert(merged, importBatchId), 'utf8');
      console.log(`Wrote ${sqlFile}`);
    }
  }
}

main();
