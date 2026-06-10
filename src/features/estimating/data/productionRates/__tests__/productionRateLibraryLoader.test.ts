import { describe, expect, it, beforeEach } from 'vitest';
import {
  loadApprovedProductionRateLibrary,
  resetProductionRateLibraryLoaderForTests,
} from '../productionRateLibraryLoader';
import { filterProductionRates } from '../productionRateLibraryQueries';
import { getApprovedProductionRateLibrary } from '../productionRateLibrary';

describe('productionRateLibraryLoader', () => {
  beforeEach(() => {
    resetProductionRateLibraryLoaderForTests();
  });

  it('loads more than 1,000 approved production rates', async () => {
    const loaded = await loadApprovedProductionRateLibrary();
    expect(loaded.count).toBeGreaterThan(1000);
    expect(loaded.rates.length).toBe(loaded.count);
  });

  it('exposes only approved records after load', async () => {
    await loadApprovedProductionRateLibrary();
    const rates = getApprovedProductionRateLibrary();
    expect(rates.length).toBeGreaterThan(1000);
    expect(rates.every((rate) => rate.id && rate.activityName && rate.unitOfMeasure)).toBe(true);
  });

  it('reuses cached library without reloading generated module', async () => {
    const first = await loadApprovedProductionRateLibrary();
    const second = await loadApprovedProductionRateLibrary();
    expect(first).toBe(second);
  });

  it('supports division filtering on loaded rates', async () => {
    const { rates } = await loadApprovedProductionRateLibrary();
    const concrete = filterProductionRates(rates, { divisionCode: '03', searchText: 'slab' });
    expect(concrete.length).toBeGreaterThan(0);
    expect(concrete.every((rate) => rate.divisionCode === '03')).toBe(true);
  });
});
