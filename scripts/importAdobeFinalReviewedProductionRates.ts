#!/usr/bin/env node
/**
 * Import Adobe PDF Extract final-reviewed Chapter 5 production rates into approved JSON.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADOBE_APPROVED_OUTPUT,
  ADOBE_FINAL_REVIEWED_RELATIVE_PATH,
  ADOBE_REJECTED_OUTPUT,
  importAdobeFinalReviewedProductionRates,
  loadAdobeFinalReviewedRows,
} from '../src/features/estimating/data/productionRates/adobeProductionRateImport';
import { assertApprovedProductionRateFile } from '../src/features/estimating/data/productionRates/validateExtractedProductionRates';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const approvedDir = join(repoRoot, 'data/estimating/production-rates/approved');
const rejectedDir = join(repoRoot, 'data/estimating/production-rates/rejected');

function main(): void {
  const rows = loadAdobeFinalReviewedRows(repoRoot);
  const result = importAdobeFinalReviewedProductionRates(rows, { repoRoot });

  assertApprovedProductionRateFile(result.approved);

  mkdirSync(approvedDir, { recursive: true });
  mkdirSync(rejectedDir, { recursive: true });

  const approvedPath = join(approvedDir, ADOBE_APPROVED_OUTPUT);
  const rejectedPath = join(rejectedDir, ADOBE_REJECTED_OUTPUT);

  writeFileSync(approvedPath, `${JSON.stringify(result.approved, null, 2)}\n`, 'utf8');
  writeFileSync(rejectedPath, `${JSON.stringify(result.rejected, null, 2)}\n`, 'utf8');

  console.log(`Adobe import complete from ${ADOBE_FINAL_REVIEWED_RELATIVE_PATH}`);
  console.log(`  input rows: ${result.stats.inputRowCount}`);
  console.log(`  approved rows: ${result.stats.approvedRowCount}`);
  console.log(`  rejected rows: ${result.stats.rejectedRowCount}`);
  console.log(`  duplicate id suffixes: ${result.stats.duplicateIdSuffixes}`);
  console.log(`Approved: ${approvedPath}`);
  console.log(`Rejected: ${rejectedPath}`);
}

main();
