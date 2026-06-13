import { beforeEach, describe, expect, it } from 'vitest';
import { groupRatesByCategory } from '../productionRateLibraryQueries';
import {
  loadApprovedProductionRateLibrary,
  resetProductionRateLibraryLoaderForTests,
} from '../productionRateLibraryLoader';

const DISALLOWED_SCREENSHOT_CATEGORIES = [
  'Framed Fabric Structures',
  'Framed Fabric Structures (Continued)',
  'Weapons Clearing Facility',
  'Portable and Mobile Buildings',
];

describe('Global production rate category taxonomy', () => {
  beforeEach(() => {
    resetProductionRateLibraryLoaderForTests();
  });

  async function loadAllRates() {
    const { rates } = await loadApprovedProductionRateLibrary();
    return rates;
  }

  async function loadDivisionRates(divisionCode: string) {
    const rates = await loadAllRates();
    return rates.filter((rate) => rate.divisionCode === divisionCode);
  }

  function categoriesForDivision(rates: Awaited<ReturnType<typeof loadAllRates>>) {
    return groupRatesByCategory(rates).map((group) => group.category);
  }

  it('does not expose categories longer than 60 characters', async () => {
    const rates = await loadAllRates();
    const categories = categoriesForDivision(rates);
    const tooLong = categories.filter((category) => category.length > 60);
    expect(tooLong).toEqual([]);
  });

  it('does not expose crew-size notes as categories', async () => {
    const rates = await loadAllRates();
    const categories = categoriesForDivision(rates);
    const crewNotes = categories.filter((category) =>
      /minimum suggested crew/i.test(category),
    );
    expect(crewNotes).toEqual([]);
  });

  it('does not expose continued figure titles as categories', async () => {
    const rates = await loadAllRates();
    const categories = categoriesForDivision(rates);
    const continued = categories.filter((category) => /continued/i.test(category));
    expect(continued).toEqual([]);
  });

  it('does not expose model-name figure titles as categories', async () => {
    const rates = await loadAllRates();
    const categories = categoriesForDivision(rates);
    const modelTitles = categories.filter((category) => /^[APQS]-[Mm]odel/i.test(category));
    expect(modelTitles).toEqual([]);
  });

  it('does not expose raw screenshot labels as categories', async () => {
    const rates = await loadAllRates();
    const categories = categoriesForDivision(rates);
    for (const disallowed of DISALLOWED_SCREENSHOT_CATEGORIES) {
      expect(categories).not.toContain(disallowed);
    }
  });

  it('keeps Division 03 concrete categories estimator-friendly', async () => {
    const div03 = await loadDivisionRates('03');
    const categories = categoriesForDivision(div03);

    expect(categories).toContain('Concrete Placement');
    expect(categories).toContain('Concrete Formwork');
    expect(categories).toContain('Concrete Finishing');
    expect(categories).toContain('Concrete Reinforcement');
  });

  it('groups Division 13 into clean special-construction categories', async () => {
    const div13 = await loadDivisionRates('13');
    const categories = categoriesForDivision(div13);

    expect(categories).toContain('Metal Building Systems');
    expect(categories).toContain('Fabric Structures');
    expect(categories).toContain('Towers');
    expect(categories).toContain('Protective Facilities');
  });

  it('groups Division 26 electrical work into clean categories', async () => {
    const div26 = await loadDivisionRates('26');
    const categories = categoriesForDivision(div26);

    expect(categories).toContain('Conduit & Raceways');
    expect(categories).toContain('Wire & Cable');
    expect(categories).toContain('Lighting');
  });

  it('groups Division 31 earthwork into clean categories', async () => {
    const div31 = await loadDivisionRates('31');
    const categories = categoriesForDivision(div31);

    expect(categories).toContain('Excavation');
    expect(categories).toContain('Clearing & Grubbing');
    expect(categories).toContain('Backfill & Compaction');
  });
});
