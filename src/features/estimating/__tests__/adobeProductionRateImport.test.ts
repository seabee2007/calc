import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildDeterministicProductionRateId,
  importAdobeFinalReviewedProductionRates,
  loadAdobeFinalReviewedRows,
} from '../data/productionRates/adobeProductionRateImport';
import {
  loadApprovedProductionRateRecords,
  isAdobeApprovedLibraryActive,
} from '../data/productionRates/loadApprovedProductionRateRecords';
import { mapProductionRateToLaborRoleKey } from '../application/laborRoleMapping';
import {
  createDraftLineItemFromProductionRate,
  updateDraftLineItemQuantity,
} from '../application/productionRateAssemblyBuilder';
import type { ProductionRateLibraryEntry } from '../data/productionRates/productionRateTypes';

const repoRoot = process.cwd();

describe('adobeProductionRateImport', () => {
  it('loads 2,014 final-reviewed rows before validation', () => {
    const rows = loadAdobeFinalReviewedRows(repoRoot);
    expect(rows).toHaveLength(2014);
  });

  it('imports approved records and quarantines bad rows without guessing', () => {
    const rows = loadAdobeFinalReviewedRows(repoRoot);
    const result = importAdobeFinalReviewedProductionRates(rows, { repoRoot });
    expect(result.stats.inputRowCount).toBe(2014);
    expect(result.stats.approvedRowCount + result.stats.rejectedRowCount).toBe(2014);
    expect(result.stats.rejectedRowCount).toBeGreaterThan(0);
    expect(result.approved.records.every((record) => record.qaStatus === 'approved')).toBe(true);
    expect(result.approved.records.every((record) => record.extractionSource === 'adobe_pdf_extract')).toBe(
      true,
    );
    expect(result.approved.records.every((record) => record.reviewStatus === 'final_reviewed')).toBe(
      true,
    );
    expect(result.rejected.records.every((record) => record.rejectionReasons.length > 0)).toBe(true);
  });

  it('builds stable deterministic ids', () => {
    const first = buildDeterministicProductionRateId('08', '08 71 25.10', '0030');
    const second = buildDeterministicProductionRateId('08', '08 71 25.10', '0030');
    expect(first).toBe(second);
    expect(first).toBe('08-08-71-25.10-0030');
  });
});

describe('Adobe approved library generation', () => {
  it('loads all approved production-rate files when adobe-chapter5 is present', () => {
    const approvedDir = join(repoRoot, 'data/estimating/production-rates/approved');
    expect(isAdobeApprovedLibraryActive(approvedDir)).toBe(true);
    const records = loadApprovedProductionRateRecords(approvedDir);
    expect(records.length).toBeGreaterThan(3000);
    expect(
      records.some((record) => record.id === '03-31-05.70-0310'),
    ).toBe(true);
  });
});

describe('labor role mapping for weatherstripping', () => {
  it('maps door weatherstripping to Carpenter, not HVAC', () => {
    const rate: ProductionRateLibraryEntry = {
      id: '08-71-25.10-0030',
      divisionCode: '08',
      divisionName: 'Openings',
      figure: 'Figure 5-H-1',
      figureTitle: 'Weatherstripping',
      sourcePage: '5-H-1',
      category: 'Doors-Mechanical Seals, Weatherstripping',
      activityName: 'Threshold weatherstripping, door sweep, flush mounted',
      description: 'Threshold weatherstripping, door sweep, flush mounted',
      unitOfMeasure: 'Each',
      manHoursPerUnit: 0.426,
      sourceDocumentFull: 'NTRP 4-04.2.3 / TM 3-34.41 / MCRP 3-40D.12',
      sourceEdition: 'October 2021, Change 1 October 2022',
      referenceNote: 'Reference rate',
      keywords: ['weatherstrip', 'door sweep'],
    };
    expect(mapProductionRateToLaborRoleKey(rate)).toBe('carpenter');
  });
});

describe('Add Activity draft line item selection keys', () => {
  it('keys draft rows by canonical id and keeps quantity isolated per row', () => {
    const sharedTitle = 'Threshold weatherstripping, door sweep, flush mounted';
    const base = {
      divisionCode: '08',
      divisionName: 'Openings',
      figure: 'Figure 5-H-1',
      figureTitle: 'Weatherstripping',
      sourcePage: '5-H-1',
      category: 'Weatherstripping',
      unitOfMeasure: 'Each',
      manHoursPerUnit: 0.426,
      sourceDocumentFull: 'NTRP 4-04.2.3 / TM 3-34.41 / MCRP 3-40D.12' as const,
      sourceEdition: 'October 2021, Change 1 October 2022' as const,
      referenceNote: 'Reference rate',
      keywords: ['weatherstrip'],
    };

    const rowA = createDraftLineItemFromProductionRate(
      {
        ...base,
        id: '08-71-25.10-0030',
        canonicalId: 'canonical-weather-1',
        canonicalTitle: sharedTitle,
        activityName: sharedTitle,
        description: sharedTitle,
      },
      'project-1',
      { selected: true },
    );
    const rowB = createDraftLineItemFromProductionRate(
      {
        ...base,
        id: '08-71-25.10-0040',
        canonicalId: 'canonical-weather-2',
        canonicalTitle: sharedTitle,
        activityName: 'Garage door bottom weatherstrip',
        description: 'Garage door bottom weatherstrip',
        manHoursPerUnit: 0.5,
      },
      'project-1',
    );

    expect(rowA.draftId).toBe('canonical-weather-1');
    expect(rowB.draftId).toBe('canonical-weather-2');
    expect(rowA.draftId).not.toBe(rowB.draftId);

    const updatedA = updateDraftLineItemQuantity(rowA, 12);
    expect(updatedA.quantity).toBe(12);
    expect(rowB.quantity).toBe(0);
    expect(updatedA.lineItem.sourceProductionRateKey).toBe('08-71-25.10-0030');
  });
});

describe('generated canonical library with Adobe data', () => {
  it('reduces duplicate-looking source rows while preserving source references', () => {
    const report = JSON.parse(
      readFileSync(
        join(repoRoot, 'data/estimating/production-rates/reports/canonicalization-report.json'),
        'utf8',
      ),
    );
    expect(report.sourceRecordCount).toBeGreaterThan(1900);
    expect(report.canonicalRecordCount).toBeLessThan(report.sourceRecordCount);
    expect(report.canonicalRecordCount).toBeGreaterThan(1200);
  });
});
