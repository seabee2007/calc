import { describe, expect, it, beforeEach } from 'vitest';
import {
  loadApprovedProductionRateLibrary,
  loadSourceProductionRateLibrary,
  resetProductionRateLibraryLoaderForTests,
} from '../productionRateLibraryLoader';
import { filterProductionRates } from '../productionRateLibraryQueries';
import { getApprovedProductionRateLibrary } from '../productionRateLibrary';

describe('productionRateLibraryLoader', () => {
  beforeEach(() => {
    resetProductionRateLibraryLoaderForTests();
  });

  it('loads canonical library by default with fewer rows than source index', async () => {
    const canonical = await loadApprovedProductionRateLibrary();
    resetProductionRateLibraryLoaderForTests();
    const source = await loadSourceProductionRateLibrary();

    expect(canonical.isSourceIndex).toBe(false);
    expect(source.isSourceIndex).toBe(true);
    expect(canonical.count).toBeGreaterThan(1200);
    expect(canonical.count).toBeLessThan(source.count);
    expect(source.count).toBeGreaterThan(1900);
    expect(canonical.rates.length).toBe(canonical.count);
  }, 15000);

  it('exposes canonical rates after load', async () => {
    await loadApprovedProductionRateLibrary();
    const rates = getApprovedProductionRateLibrary();
    expect(rates.length).toBeGreaterThan(1200);
    expect(rates.every((rate) => rate.id && rate.activityName && rate.unitOfMeasure)).toBe(true);
  });

  it('reuses cached library without reloading generated module', async () => {
    const first = await loadApprovedProductionRateLibrary();
    const second = await loadApprovedProductionRateLibrary();
    expect(first).toBe(second);
  });

  it('loads source debug index separately from canonical cache', async () => {
    const canonical = await loadApprovedProductionRateLibrary();
    resetProductionRateLibraryLoaderForTests();
    const source = await loadApprovedProductionRateLibrary({ useSourceRecords: true });
    expect(source.isSourceIndex).toBe(true);
    expect(source.count).toBeGreaterThan(canonical.count);
  });

  it('supports division filtering on loaded canonical rates', async () => {
    const { rates } = await loadApprovedProductionRateLibrary();
    const concrete = filterProductionRates(rates, { divisionCode: '03', searchText: 'slab' });
    expect(concrete.length).toBeGreaterThan(0);
    expect(concrete.every((rate) => rate.divisionCode === '03')).toBe(true);
  });
});
