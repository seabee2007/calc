#!/usr/bin/env node
/**
 * Build canonical contractor-facing production rate library from approved source records.
 * Does not modify raw, ai-reviewed, or approved JSON source files.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalizeProductionRates } from '../src/features/estimating/data/productionRates/canonicalProductionRateGrouping';
import { loadApprovedProductionRateRecords } from '../src/features/estimating/data/productionRates/loadApprovedProductionRateRecords';
import { mapCanonicalRatesToLibraryEntries } from '../src/features/estimating/data/productionRates/mapCanonicalToLibraryEntry';
import type { CanonicalProductionRate } from '../src/features/estimating/data/productionRates/canonicalProductionRateTypes';
import {
  ESTIMATOR_ALLOWED_QA_STATUS,
  type NormalizedProductionRateRecord,
} from '../src/features/estimating/data/productionRates/productionRateTypes';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const approvedDir = join(repoRoot, 'data/estimating/production-rates/approved');
const generatedDir = join(repoRoot, 'src/features/estimating/data/productionRates/generated');
const reportsDir = join(repoRoot, 'data/estimating/production-rates/reports');

function parseArgs(argv: string[]) {
  return {
    ai: argv.includes('--ai'),
    includeReview: argv.includes('--include-review'),
  };
}

function loadApprovedRecords(): NormalizedProductionRateRecord[] {
  return loadApprovedProductionRateRecords(approvedDir);
}

function enforceSafetyGate(records: NormalizedProductionRateRecord[]): void {
  const unsafe = records.filter((record) => !ESTIMATOR_ALLOWED_QA_STATUS.includes(record.qaStatus));
  if (unsafe.length > 0) {
    throw new Error(`Canonical safety gate failed: ${unsafe.length} non-approved source record(s).`);
  }
}

async function maybeApplyAiSuggestions(
  canonicalRates: CanonicalProductionRate[],
  reportNeedsReview: CanonicalProductionRate[],
): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('[canonical] --ai requested but OPENAI_API_KEY is not set; skipping AI suggestions.');
    return;
  }
  if (reportNeedsReview.length === 0) {
    console.log('[canonical] No needsHumanReview groups for AI polish.');
    return;
  }
  console.log(
    `[canonical] AI polish stub: ${reportNeedsReview.length} review group(s) would be sent to OpenAI in a future pass.`,
  );
  void canonicalRates;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const sourceRecords = loadApprovedRecords();
  if (sourceRecords.length === 0) {
    console.log('No approved records found. Canonical generation skipped.');
    return;
  }

  enforceSafetyGate(sourceRecords);

  const { canonicalRates, report } = canonicalizeProductionRates(sourceRecords, {
    includeReview: args.includeReview,
  });

  if (args.ai) {
    void maybeApplyAiSuggestions(
      canonicalRates,
      report.needsHumanReview.map((entry) =>
        canonicalRates.find((rate) => rate.id === entry.canonicalId),
      ).filter(Boolean) as CanonicalProductionRate[],
    );
  }

  const libraryEntries = mapCanonicalRatesToLibraryEntries(canonicalRates, sourceRecords);
  const indexWithMeta = libraryEntries.map((entry) => ({
    qaStatus: 'approved' as const,
    confidence: entry.confidence ?? 'high',
    ...entry,
  }));

  mkdirSync(generatedDir, { recursive: true });
  mkdirSync(reportsDir, { recursive: true });

  const ratesPath = join(generatedDir, 'generatedCanonicalProductionRates.ts');
  const indexPath = join(generatedDir, 'generatedCanonicalProductionRateIndex.ts');
  const reportPath = join(reportsDir, 'canonicalization-report.json');

  writeFileSync(
    ratesPath,
    `// AUTO-GENERATED — do not edit. Regenerate: npm run generate:canonical-production-rates
import type { CanonicalProductionRate } from '../canonicalProductionRateTypes';

export const GENERATED_CANONICAL_PRODUCTION_RATES: readonly CanonicalProductionRate[] = ${JSON.stringify(canonicalRates, null, 2)} as const;
`,
    'utf8',
  );

  writeFileSync(
    indexPath,
    `// AUTO-GENERATED — do not edit. Regenerate: npm run generate:canonical-production-rates
import type { ProductionRateLibraryEntry } from '../productionRateTypes';
import type { CanonicalConfidence } from '../canonicalProductionRateTypes';

export const GENERATED_CANONICAL_PRODUCTION_RATE_INDEX: readonly (ProductionRateLibraryEntry & {
  qaStatus: 'approved';
  confidence: CanonicalConfidence;
})[] = ${JSON.stringify(indexWithMeta, null, 2)} as const;
`,
    'utf8',
  );

  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(
    `Canonical library generated: ${canonicalRates.length} canonical record(s) from ${sourceRecords.length} source record(s).`,
  );
  console.log(`  autoMergedHighConfidence: ${report.autoMergedHighConfidence.length}`);
  console.log(`  keptSeparateHighConfidence: ${report.keptSeparateHighConfidence.length}`);
  console.log(`  variantGroupsCreated: ${report.variantGroupsCreated.length}`);
  console.log(`  needsHumanReview: ${report.needsHumanReview.length}`);
  console.log(`  blockedFromCanonical: ${report.blockedFromCanonical.length}`);
  console.log(`Report: ${reportPath}`);
}

main();
