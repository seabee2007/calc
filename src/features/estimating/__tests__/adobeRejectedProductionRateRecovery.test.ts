import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ADOBE_REJECTED_RECOVERY_REPORT_RELATIVE_PATH,
  applyRecoveryPatch,
  buildRecoveryFixFromSuggestion,
  importAdobeWithRecoveryFixes,
  loadAdobeRejectedFile,
  stripRejectedMetadata,
  validateReviewFixedFile,
} from '../data/productionRates/adobeRejectedProductionRateRecovery';
import { loadAdobeFinalReviewedRows } from '../data/productionRates/adobeProductionRateImport';

const repoRoot = process.cwd();

function loadRecoveryReport() {
  const path = join(repoRoot, ADOBE_REJECTED_RECOVERY_REPORT_RELATIVE_PATH);
  return JSON.parse(readFileSync(path, 'utf8')) as {
    rejectedRowCount: number;
    recoverableCount: number;
    unrecoverableCount: number;
  };
}

describe('adobeRejectedProductionRateRecovery', () => {
  it('recovery report tracks 64 original quarantined rows', () => {
    const report = loadRecoveryReport();
    expect(report.rejectedRowCount).toBe(64);
    expect(report.recoverableCount + report.unrecoverableCount).toBe(64);
  });

  it('rejected file lists remaining rows after recovery import', () => {
    const rejected = loadAdobeRejectedFile(repoRoot);
    expect(rejected.rejectedRowCount).toBeGreaterThan(0);
    expect(rejected.records.every((record) => record.rejectionReasons.length > 0)).toBe(true);
  });

  it('classifies missing item code as recoverable from recovery report', () => {
    const report = loadRecoveryReport() as {
      records: Array<{ rejectionReasons: string[]; recoverable: boolean }>;
      recoverableCount: number;
    };
    const missingItemCode = report.records.find((record) =>
      record.rejectionReasons.some((reason) => reason.includes('workElementLineNumber missing')),
    );
    expect(missingItemCode).toBeDefined();
    expect(missingItemCode!.recoverable).toBe(true);
    expect(report.recoverableCount).toBeGreaterThan(0);
  });

  it('blocks recovery patches that modify locked manHoursPerUnit', () => {
    const rejected = loadAdobeRejectedFile(repoRoot);
    const base = stripRejectedMetadata(rejected.records[0]);

    expect(() =>
      applyRecoveryPatch(base, {
        manHoursPerUnit: (base.manHoursPerUnit ?? 0) + 1,
      }),
    ).toThrow(/locked field: manHoursPerUnit/);
  });

  it('never changes manHoursPerUnit in auto-generated fixes', () => {
    const rejected = loadAdobeRejectedFile(repoRoot);
    const contextRows = loadAdobeFinalReviewedRows(repoRoot);
    const fixes = rejected.records
      .map((record) => buildRecoveryFixFromSuggestion(record, contextRows, repoRoot))
      .filter((fix): fix is NonNullable<typeof fix> => fix != null);

    for (const fix of fixes) {
      const source = rejected.records.find((record) => record.id === fix.sourceRejectedId);
      expect(source).toBeDefined();
      expect(fix.correctedRow.manHoursPerUnit).toBe(source!.manHoursPerUnit);
    }
  });

  it('applies only fixed recovery overlays during import merge', () => {
    const baseRows = loadAdobeFinalReviewedRows(repoRoot);
    const rejected = loadAdobeRejectedFile(repoRoot);
    const contextRows = loadAdobeFinalReviewedRows(repoRoot);

    const fixes = rejected.records
      .map((record) => buildRecoveryFixFromSuggestion(record, contextRows, repoRoot))
      .filter((fix): fix is NonNullable<typeof fix> => fix != null);

    const baseline = importAdobeWithRecoveryFixes(baseRows, repoRoot, []);
    const withFixes = importAdobeWithRecoveryFixes(baseRows, repoRoot, fixes);

    const fixedCount = fixes.filter((fix) => fix.recoveryStatus === 'fixed').length;
    expect(withFixes.appliedFixCount).toBe(fixedCount);
    expect(withFixes.stats.approvedRowCount).toBeGreaterThanOrEqual(baseline.stats.approvedRowCount);
    expect(withFixes.stats.rejectedRowCount).toBeLessThanOrEqual(baseline.stats.rejectedRowCount);

    if (fixedCount > 0) {
      expect(withFixes.stats.approvedRowCount).toBeGreaterThan(baseline.stats.approvedRowCount);
    }
  });

  it('keeps rows without importable fixes rejected after merge', () => {
    const rejected = loadAdobeRejectedFile(repoRoot);
    const contextRows = loadAdobeFinalReviewedRows(repoRoot);
    const baseRows = loadAdobeFinalReviewedRows(repoRoot);

    const fixes = rejected.records
      .map((record) => buildRecoveryFixFromSuggestion(record, contextRows, repoRoot))
      .filter((fix): fix is NonNullable<typeof fix> => fix != null);

    const stillRejectedFixes = fixes.filter((fix) => fix.recoveryStatus !== 'fixed');
    const result = importAdobeWithRecoveryFixes(baseRows, repoRoot, fixes);

    if (stillRejectedFixes.length > 0) {
      for (const fix of stillRejectedFixes) {
        const stillRejected = result.rejected.records.some((item) => item.id === fix.sourceRejectedId);
        expect(stillRejected).toBe(true);
      }
    } else {
      expect(result.stats.rejectedRowCount).toBeGreaterThan(0);
    }
  });

  it('validates review-fixed file rejects MH mutation', () => {
    const rejected = loadAdobeRejectedFile(repoRoot);
    const record = rejected.records[0];
    const { rejectionReasons: _r, ...correctedRow } = record;
    const badFix = {
      sourceRejectedId: record.id ?? '',
      originalRejectionReasons: record.rejectionReasons,
      recoveryStatus: 'fixed' as const,
      recoveryNotes: ['test'],
      correctedRow: {
        ...correctedRow,
        manHoursPerUnit: (correctedRow.manHoursPerUnit ?? 0) + 0.5,
      },
      changedFields: [] as const,
      reviewedAt: new Date().toISOString(),
    };

    const errors = validateReviewFixedFile(
      {
        schemaVersion: '1.0.0',
        generatedAt: new Date().toISOString(),
        sourceRejectedFile: 'data/estimating/production-rates/rejected/adobe-chapter5.rejected.json',
        fixCount: 1,
        records: [badFix],
      },
      rejected.records,
      repoRoot,
    );

    expect(errors.some((error) => error.includes('manHoursPerUnit changed'))).toBe(true);
  });
});
