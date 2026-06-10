import { describe, expect, it } from 'vitest';
import {
  ESTIMATOR_ALLOWED_CONFIDENCE,
  SOURCE_DOCUMENT_CODE,
  type ExtractedProductionRateFile,
  type ExtractedProductionRateRecord,
} from '../productionRateTypes';
import { mapExtractedFileToReviewedRateFile } from '../mapExtractedToReviewedRate';
import {
  assertApprovedProductionRateFile,
  isEstimatorSafeRecord,
  validateExtractedProductionRateFile,
  validateExtractedProductionRateRecord,
} from '../validateExtractedProductionRates';

const approvedRecord: ExtractedProductionRateRecord = {
  sourceDocumentCode: SOURCE_DOCUMENT_CODE,
  division: '03',
  divisionName: 'Concrete',
  figure: 'Figure 5-C-7',
  figureTitle: 'Slab on Grade Forms in Place Production',
  workElementNumber: '03 11 13.65',
  workElementLineNumber: '0010',
  activityName: 'Slab on grade, Forms in Place',
  description: 'Bulkhead forms with keyway, wood, 6 inches high, one use',
  unitOfMeasure: 'LF',
  manHoursPerUnit: 0.084,
  crewSize: null,
  skilledTrade: null,
  laborerCount: null,
  equipment: null,
  notes: null,
  sourcePage: '5-C-7',
  sourcePdfPage: 64,
  confidence: 'approved',
  fabricateHours: 0.025,
  erectStripHours: 0.051,
  cleanMoveHours: 0.008,
};

const approvedFile: ExtractedProductionRateFile = {
  batchMeta: {
    sourceDocumentCode: SOURCE_DOCUMENT_CODE,
    sourceDocumentTitle: 'Construction Estimating',
    sourceDocumentFull: 'NTRP 4-04.2.3 / TM 3-34.41 / MCRP 3-40D.12',
    sourceEdition: 'October 2021, Change 1 October 2022',
    division: '03',
    divisionName: 'Concrete',
    figure: 'Figure 5-C-7',
  },
  records: [approvedRecord],
};

describe('validateExtractedProductionRates', () => {
  it('accepts a valid approved record', () => {
    const result = validateExtractedProductionRateRecord(approvedRecord, 0, {
      allowedConfidence: ESTIMATOR_ALLOWED_CONFIDENCE,
    });
    expect(result.valid).toBe(true);
  });

  it('rejects raw records for estimator consumption', () => {
    const raw = { ...approvedRecord, confidence: 'raw' as const };
    expect(() =>
      assertApprovedProductionRateFile({ ...approvedFile, records: [raw] }),
    ).toThrow(/not approved/);
    expect(isEstimatorSafeRecord(raw)).toBe(false);
  });

  it('requires activity name, unit, division, and source page', () => {
    const bad = {
      ...approvedRecord,
      activityName: '',
      unitOfMeasure: '',
      division: '',
      sourcePage: '',
    };
    const result = validateExtractedProductionRateRecord(bad, 0);
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.field)).toEqual(
      expect.arrayContaining(['activityName', 'unitOfMeasure', 'division', 'sourcePage']),
    );
  });

  it('allows null man-hours but rejects non-numeric values', () => {
    const nullable = validateExtractedProductionRateRecord(
      { ...approvedRecord, manHoursPerUnit: null },
      0,
    );
    expect(nullable.valid).toBe(true);

    const bad = validateExtractedProductionRateRecord(
      { ...approvedRecord, manHoursPerUnit: Number.NaN },
      0,
    );
    expect(bad.valid).toBe(false);
  });
});

describe('mapExtractedToReviewedRate', () => {
  it('maps approved extracted records into reviewed rate file shape', () => {
    const reviewed = mapExtractedFileToReviewedRateFile(approvedFile, 'pipeline-test');
    expect(reviewed.batchMeta.divisionCode).toBe('03');
    expect(reviewed.rates).toHaveLength(1);
    expect(reviewed.rates[0].id).toBe('03-11-13.65-0010');
    expect(reviewed.rates[0].manHoursPerUnit).toBe(0.084);
    expect(reviewed.rates[0].sourceFigure).toBe('Figure 5-C-7');
  });
});
