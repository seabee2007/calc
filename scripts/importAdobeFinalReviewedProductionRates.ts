#!/usr/bin/env node
/**
 * Re-import Adobe production rates with review-fixed recovery overlays,
 * then regenerate source/canonical libraries.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADOBE_APPROVED_OUTPUT,
  ADOBE_REJECTED_OUTPUT,
  loadAdobeFinalReviewedRows,
} from '../src/features/estimating/data/productionRates/adobeProductionRateImport';
import {
  importAdobeWithRecoveryFixes,
  loadAdobeRejectedReviewFixedFile,
  validateReviewFixedFile,
  loadAdobeRejectedFile,
} from '../src/features/estimating/data/productionRates/adobeRejectedProductionRateRecovery';
import { assertApprovedProductionRateFile } from '../src/features/estimating/data/productionRates/validateExtractedProductionRates';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const approvedDir = join(repoRoot, 'data/estimating/production-rates/approved');
const rejectedDir = join(repoRoot, 'data/estimating/production-rates/rejected');

function main(): void {
  const baseRows = loadAdobeFinalReviewedRows(repoRoot);
  const reviewFixed = loadAdobeRejectedReviewFixedFile(repoRoot);
  const rejectedSource = loadAdobeRejectedFile(repoRoot);

  if (reviewFixed) {
    const errors = validateReviewFixedFile(reviewFixed, rejectedSource.records, repoRoot);
    if (errors.length > 0) {
      console.error('Review-fixed validation failed:');
      errors.slice(0, 10).forEach((error) => console.error(`  - ${error}`));
      process.exit(1);
    }
  }

  const result = importAdobeWithRecoveryFixes(
    baseRows,
    repoRoot,
    reviewFixed?.records ?? [],
  );

  assertApprovedProductionRateFile(result.approved);

  mkdirSync(approvedDir, { recursive: true });
  mkdirSync(rejectedDir, { recursive: true });

  writeFileSync(
    join(approvedDir, ADOBE_APPROVED_OUTPUT),
    `${JSON.stringify(result.approved, null, 2)}\n`,
    'utf8',
  );
  writeFileSync(
    join(rejectedDir, ADOBE_REJECTED_OUTPUT),
    `${JSON.stringify(result.rejected, null, 2)}\n`,
    'utf8',
  );

  console.log('Adobe import with recovery fixes complete.');
  console.log(`  applied fixes: ${result.appliedFixCount}`);
  console.log(`  approved rows: ${result.stats.approvedRowCount}`);
  console.log(`  rejected rows: ${result.stats.rejectedRowCount}`);
}

main();
