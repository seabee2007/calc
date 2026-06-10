import { describe, expect, it } from 'vitest';
import {
  ESTIMATOR_ALLOWED_QA_STATUS,
  SOURCE_DOCUMENT_CODE,
  type NormalizedProductionRateRecord,
} from '../productionRateTypes';
import { mapRecordToLibraryEntry } from '../mapToLibraryEntry';
import {
  assertApprovedProductionRateFile,
  isEstimatorSafeRecord,
  validateProductionRateRecord,
} from '../validateExtractedProductionRates';

const approvedRecord: NormalizedProductionRateRecord = {
  id: '03-11-13.65-0010',
  sourceDocumentCode: SOURCE_DOCUMENT_CODE,
  sourceDocumentTitle: 'Construction Estimating',
  sourceDocumentFull: 'NTRP 4-04.2.3 / TM 3-34.41 / MCRP 3-40D.12',
  sourceEdition: 'October 2021, Change 1 October 2022',
  division: '03',
  divisionName: 'Concrete',
  figure: 'Figure 5-C-7',
  figureTitle: 'Forms in Place for Concrete Production',
  sourcePage: '5-C-7',
  sourcePdfPage: 64,
  workElementNumber: '03 11 13.65',
  workElementLineNumber: '0010',
  category: 'Slab on grade, Forms in Place',
  subcategory: 'Bulkhead forms with keyway, wood, 6 inches high, one use',
  activityName: 'Bulkhead forms with keyway, wood, 6 inches high, one use',
  description: '6 inches high, one use',
  unitOfMeasure: 'LF',
  manHoursPerUnit: 0.084,
  fabricateHours: 0.025,
  erectStripHours: 0.051,
  cleanMoveHours: 0.008,
  qaStatus: 'approved',
  extractionWarnings: [],
  createdAt: '2026-06-10T00:00:00Z',
  updatedAt: '2026-06-10T00:00:00Z',
};

describe('production rate pipeline validation', () => {
  it('accepts valid approved records', () => {
    const result = validateProductionRateRecord(approvedRecord, 0, {
      expectedQaStatus: ESTIMATOR_ALLOWED_QA_STATUS,
    });
    expect(result.valid).toBe(true);
  });

  it('rejects raw records for estimator consumption', () => {
    const raw = { ...approvedRecord, qaStatus: 'raw' as const };
    expect(() =>
      assertApprovedProductionRateFile({ batchMeta: {} as never, records: [raw] }),
    ).toThrow(/not approved/);
    expect(isEstimatorSafeRecord(raw)).toBe(false);
  });

  it('rejects ai_reviewed records for estimator consumption', () => {
    const aiReviewed = { ...approvedRecord, qaStatus: 'ai_reviewed' as const };
    expect(isEstimatorSafeRecord(aiReviewed)).toBe(false);
    expect(() =>
      assertApprovedProductionRateFile({ batchMeta: {} as never, records: [aiReviewed] }),
    ).toThrow(/not approved/);
  });

  it('rejects surface units', () => {
    const bad = { ...approvedRecord, unitOfMeasure: 'surface' };
    const result = validateProductionRateRecord(bad, 0);
    expect(result.valid).toBe(false);
  });

  it('maps approved record to library entry', () => {
    const entry = mapRecordToLibraryEntry(approvedRecord);
    expect(entry.id).toBe('03-11-13.65-0010');
    expect(entry.manHoursPerUnit).toBe(0.084);
    expect(entry.referenceNote).toContain('Reference rate');
  });
});

describe('generated production rate library', () => {
  it('loads only approved records from generated index via lazy loader', async () => {
    const { loadApprovedProductionRateLibrary, resetProductionRateLibraryLoaderForTests } =
      await import('../productionRateLibraryLoader');
    resetProductionRateLibraryLoaderForTests();
    const loaded = await loadApprovedProductionRateLibrary();
    expect(loaded.rates.length).toBeGreaterThan(0);
    expect(loaded.rates.every((rate) => rate.manHoursPerUnit != null || rate.activityName)).toBe(true);
  });

  it('raw JSON is not imported by the library module', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const librarySource = fs.readFileSync(
      path.join(process.cwd(), 'src/features/estimating/data/productionRates/productionRateLibrary.ts'),
      'utf8',
    );
    expect(librarySource).not.toContain('production-rates/raw');
    expect(librarySource).not.toContain('./generated/generatedProductionRateIndex');
  });
});
