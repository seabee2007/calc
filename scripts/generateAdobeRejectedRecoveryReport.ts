#!/usr/bin/env node
/**
 * Analyze Adobe rejected production rates and emit recovery suggestions + optional review-fixed file.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadAdobeFinalReviewedRows,
} from '../src/features/estimating/data/productionRates/adobeProductionRateImport';
import {
  ADOBE_REJECTED_RECOVERY_REPORT_RELATIVE_PATH,
  ADOBE_REJECTED_REVIEW_FIXED_RELATIVE_PATH,
  ADOBE_REJECTED_RELATIVE_PATH,
  buildRecoveryFixFromSuggestion,
  buildRecoverySuggestions,
  loadAdobeRejectedFile,
  type AdobeRejectedReviewFixedFile,
} from '../src/features/estimating/data/productionRates/adobeRejectedProductionRateRecovery';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const rejectedDir = join(repoRoot, 'data/estimating/production-rates/rejected');

function parseArgs(argv: string[]) {
  return {
    writeReviewFixed: argv.includes('--write-review-fixed'),
  };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const rejectedFile = loadAdobeRejectedFile(repoRoot);
  const contextRows = loadAdobeFinalReviewedRows(repoRoot);
  const report = buildRecoverySuggestions(rejectedFile.records, contextRows);

  mkdirSync(rejectedDir, { recursive: true });
  const reportPath = join(repoRoot, ADOBE_REJECTED_RECOVERY_REPORT_RELATIVE_PATH);
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`Recovery report: ${report.rejectedRowCount} rejected row(s)`);
  console.log(`  recoverable: ${report.recoverableCount}`);
  console.log(`  unrecoverable: ${report.unrecoverableCount}`);
  console.log(`  with suggestions: ${report.suggestedFixCount}`);
  console.log(`Report: ${reportPath}`);

  if (!args.writeReviewFixed) {
    console.log('Run with --write-review-fixed to generate adobe-chapter5.review-fixed.json');
    return;
  }

  const fixes = rejectedFile.records
    .map((record) => buildRecoveryFixFromSuggestion(record, contextRows, repoRoot))
    .filter((fix): fix is NonNullable<typeof fix> => fix != null);

  const reviewFixed: AdobeRejectedReviewFixedFile = {
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    sourceRejectedFile: ADOBE_REJECTED_RELATIVE_PATH,
    fixCount: fixes.length,
    records: fixes,
  };

  const reviewFixedPath = join(repoRoot, ADOBE_REJECTED_REVIEW_FIXED_RELATIVE_PATH);
  writeFileSync(reviewFixedPath, `${JSON.stringify(reviewFixed, null, 2)}\n`, 'utf8');

  const fixedCount = fixes.filter((fix) => fix.recoveryStatus === 'fixed').length;
  const stillRejected = fixes.filter((fix) => fix.recoveryStatus === 'still_rejected').length;

  console.log(`Review-fixed file: ${reviewFixedPath}`);
  console.log(`  fixes written: ${fixes.length}`);
  console.log(`  importable (fixed): ${fixedCount}`);
  console.log(`  still rejected after suggestion: ${stillRejected}`);
}

main();
