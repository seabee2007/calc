import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canonicalizeProductionRates } from '../data/productionRates/canonicalProductionRateGrouping';
import { mapCanonicalRatesToLibraryEntries } from '../data/productionRates/mapCanonicalToLibraryEntry';
import { buildCanonicalTitle } from '../data/productionRates/canonicalProductionRateTitles';
import type { NormalizedProductionRateRecord } from '../data/productionRates/productionRateTypes';

const fixturePath = join(
  process.cwd(),
  'src/features/estimating/__tests__/fixtures/canonical/sample-approved-records.json',
);
const fixtureRecords = JSON.parse(
  readFileSync(fixturePath, 'utf8'),
) as NormalizedProductionRateRecord[];

describe('canonicalProductionRateGrouping', () => {
  it('auto-merges exact weatherstripping duplicates', () => {
    const { canonicalRates } = canonicalizeProductionRates(fixtureRecords);
    const weather = canonicalRates.find((rate) =>
      rate.sourceRecordIds.includes('08-81-00.00-0010'),
    );
    expect(weather).toBeDefined();
    expect(weather!.sourceRecordIds).toHaveLength(2);
    expect(weather!.variants.length).toBeGreaterThanOrEqual(2);
  });

  it('creates dimension variant groups for spandrel forms', () => {
    const { canonicalRates } = canonicalizeProductionRates(fixtureRecords);
    const spandrel = canonicalRates.find((rate) =>
      rate.sourceRecordIds.includes('03-11-13.65-0100'),
    );
    expect(spandrel).toBeDefined();
    expect(spandrel!.variants.length).toBe(3);
    expect(spandrel!.confidence).toBe('medium');
  });

  it('does not merge slab rows with different units', () => {
    const { canonicalRates } = canonicalizeProductionRates(fixtureRecords);
    const slabCategory = canonicalRates.filter((rate) => rate.category === 'Place Slab on Grade');
    expect(slabCategory.length).toBe(2);
    expect(new Set(slabCategory.map((rate) => rate.unitOfMeasure)).size).toBe(2);
  });

  it('preserves source references on merged canonical records', () => {
    const { canonicalRates } = canonicalizeProductionRates(fixtureRecords);
    for (const canonical of canonicalRates) {
      expect(canonical.sourceReferences.length).toBe(canonical.sourceRecordIds.length);
      expect(canonical.sourceReferences.every((ref) => ref.sourceProductionRateKey)).toBe(true);
    }
  });

  it('builds deterministic titles from longest description', () => {
    const weatherRecords = fixtureRecords.filter((record) => record.category === 'Weatherstripping');
    expect(buildCanonicalTitle(weatherRecords)).toBe('Weatherstripping, Door Sweep');
  });
});

describe('canonicalProductionRateLibrary', () => {
  it('maps canonical records to library entries with variant metadata', () => {
    const { canonicalRates } = canonicalizeProductionRates(fixtureRecords);
    const entries = mapCanonicalRatesToLibraryEntries(canonicalRates, fixtureRecords);
    expect(entries.length).toBe(canonicalRates.length);
    expect(entries.every((entry) => entry.canonicalId && entry.allVariants?.length)).toBe(true);
  });

  it('reduces picker rows versus source count', () => {
    const { canonicalRates } = canonicalizeProductionRates(fixtureRecords);
    expect(canonicalRates.length).toBeLessThan(fixtureRecords.length);
  });

  it('blocks records with missing man-hours from canonical export', () => {
    const withMissing = [
      ...fixtureRecords,
      {
        ...fixtureRecords[0],
        id: '08-81-00.00-0001',
        workElementLineNumber: '0001',
        manHoursPerUnit: null,
        description: 'Weatherstripping without MH',
        activityName: 'Weatherstripping without MH',
      },
    ];
    const { canonicalRates, report } = canonicalizeProductionRates(withMissing);
    expect(report.blockedFromCanonical.length).toBeGreaterThan(0);
    expect(canonicalRates.every((rate) => rate.manHoursPerUnit > 0)).toBe(true);
  });
});
