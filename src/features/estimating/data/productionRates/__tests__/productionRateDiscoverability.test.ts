import { beforeEach, describe, expect, it } from 'vitest';
import {
  groupRatesByCategory,
  searchProductionRates,
} from '../productionRateLibraryQueries';
import {
  loadApprovedProductionRateLibrary,
  resetProductionRateLibraryLoaderForTests,
} from '../productionRateLibraryLoader';

const SLAB_CHUTE_ID = '03-31-05.70-0310';

describe('Division 03 production rate discoverability', () => {
  beforeEach(() => {
    resetProductionRateLibraryLoaderForTests();
  });

  async function loadDiv03Rates() {
    const { rates } = await loadApprovedProductionRateLibrary();
    return rates.filter((rate) => rate.divisionCode === '03');
  }

  it('finds slab-on-grade direct chute when searching "place concrete"', async () => {
    const div03 = await loadDiv03Rates();
    const results = searchProductionRates(div03, 'place concrete');
    expect(
      results.some(
        (rate) =>
          rate.id === SLAB_CHUTE_ID ||
          rate.activityName.toLowerCase().includes('slab on grade') ||
          rate.description.toLowerCase().includes('slab on grade'),
      ),
    ).toBe(true);
  });

  it('finds slab-on-grade direct chute when searching "slab chute"', async () => {
    const div03 = await loadDiv03Rates();
    const results = searchProductionRates(div03, 'slab chute');
    expect(results.some((rate) => rate.id === SLAB_CHUTE_ID)).toBe(true);
  });

  it('finds footing pump placement when searching "footing pump"', async () => {
    const div03 = await loadDiv03Rates();
    const results = searchProductionRates(div03, 'footing pump');
    expect(
      results.some(
        (rate) =>
          rate.id === '03-31-05.70-0140' ||
          rate.id === '03-31-05.70-0150' ||
          rate.description.toLowerCase().includes('footing') &&
            rate.description.toLowerCase().includes('pump'),
      ),
    ).toBe(true);
  });

  it('finds wall pump placement when searching "wall pump"', async () => {
    const div03 = await loadDiv03Rates();
    const results = searchProductionRates(div03, 'wall pump');
    expect(
      results.some(
        (rate) =>
          rate.id === '03-31-05.70-0210' ||
          (rate.description.toLowerCase().includes('wall') &&
            rate.description.toLowerCase().includes('pump')),
      ),
    ).toBe(true);
  });

  it('groups Division 03 records into estimator-friendly categories', async () => {
    const div03 = await loadDiv03Rates();
    const categories = groupRatesByCategory(div03).map((group) => group.category);

    expect(categories).toContain('Concrete Placement');
    expect(categories).toContain('Concrete Finishing');
    expect(categories).toContain('Concrete Formwork');
    expect(categories).toContain('Concrete Reinforcement');
    expect(categories).toContain('Concrete Joints, Curing & Accessories');
  });

  it('does not expose raw manual PDF section titles as top-level categories', async () => {
    const div03 = await loadDiv03Rates();
    const categories = groupRatesByCategory(div03).map((group) => group.category);

    expect(categories).not.toContain('Finishing Floors');
    expect(categories).not.toContain('Plywood (job-built), one use');
    expect(categories).not.toContain('Hand mixing onsite:');
  });
});
