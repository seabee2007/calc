import { describe, expect, it } from 'vitest';
import {
  EMPTY_PRODUCTION_RATE_LIBRARY_FILTERS,
  filterProductionRates,
  getAvailableCategories,
  getAvailableDivisions,
  getAvailableFigures,
  getAvailableUnits,
  groupRatesByDivisionAndCategory,
  hasActiveProductionRateFilters,
  searchProductionRates,
} from '../productionRateLibraryQueries';
import type { ProductionRateLibraryEntry } from '../productionRateTypes';

const SAMPLE_RATES: ProductionRateLibraryEntry[] = [
  {
    id: '03-slab-001',
    divisionCode: '03',
    divisionName: 'Concrete',
    figure: 'Figure 5-C-14',
    figureTitle: 'Slab on Grade',
    sourcePage: '5-C-12',
    activityName: 'Place concrete, slab on grade, direct from chute',
    description: 'Place concrete, slab on grade, up to 6 inches thick, direct from chute',
    category: 'Place Slab on Grade',
    unitOfMeasure: 'CYD',
    manHoursPerUnit: 0.654,
    crewSize: 9,
    workElementNumber: '03 30 00.00',
    sourceDocumentFull: 'NTRP 4-04.2.3 / TM 3-34.41 / MCRP 3-40D.12',
    sourceEdition: 'October 2021, Change 1 October 2022',
    referenceNote: 'Reference rate',
    keywords: ['slab', 'concrete', 'placement'],
  },
  {
    id: '03-slab-002',
    divisionCode: '03',
    divisionName: 'Concrete',
    figure: 'Figure 5-C-7',
    figureTitle: 'Forms',
    sourcePage: '5-C-7',
    activityName: 'Vapor barrier, polyethylene',
    description: 'Vapor barrier, polyethylene',
    category: 'Place Slab on Grade',
    unitOfMeasure: 'SF',
    manHoursPerUnit: 0.012,
    crewSize: 2,
    workElementNumber: '03 30 00.10',
    sourceDocumentFull: 'NTRP 4-04.2.3 / TM 3-34.41 / MCRP 3-40D.12',
    sourceEdition: 'October 2021, Change 1 October 2022',
    referenceNote: 'Reference rate',
    keywords: ['vapor', 'barrier'],
  },
  {
    id: '31-earth-001',
    divisionCode: '31',
    divisionName: 'Earthwork',
    figure: 'Figure 5-R-9',
    figureTitle: 'Excavation',
    sourcePage: '5-R-9',
    activityName: 'Excavate common material, 0 to 6 feet deep',
    description: 'Excavate common material, 0 to 6 feet deep',
    category: 'Excavate Footings',
    unitOfMeasure: 'Bank CYD',
    manHoursPerUnit: 0.18,
    crewSize: 4,
    workElementNumber: '31 23 00.00',
    sourceDocumentFull: 'NTRP 4-04.2.3 / TM 3-34.41 / MCRP 3-40D.12',
    sourceEdition: 'October 2021, Change 1 October 2022',
    referenceNote: 'Reference rate',
    keywords: ['excavate', 'earthwork'],
  },
  {
    id: '22-plumb-001',
    divisionCode: '22',
    divisionName: 'Plumbing',
    figure: 'Figure 5-N-2',
    figureTitle: 'Plumbing',
    sourcePage: '5-N-2',
    activityName: 'Install copper water pipe, 1 inch',
    description: 'Install copper water pipe, 1 inch',
    category: 'Water Distribution',
    unitOfMeasure: 'LF',
    manHoursPerUnit: 0.22,
    sourceDocumentFull: 'NTRP 4-04.2.3 / TM 3-34.41 / MCRP 3-40D.12',
    sourceEdition: 'October 2021, Change 1 October 2022',
    referenceNote: 'Reference rate',
    keywords: ['plumbing', 'pipe'],
  },
];

describe('productionRateLibraryQueries', () => {
  it('getAvailableDivisions returns multiple divisions', () => {
    const divisions = getAvailableDivisions(SAMPLE_RATES);
    expect(divisions.length).toBeGreaterThanOrEqual(3);
    expect(divisions.map((d) => d.divisionCode)).toEqual(expect.arrayContaining(['03', '31', '22']));
  });

  it('filters by division code', () => {
    const filtered = filterProductionRates(SAMPLE_RATES, { divisionCode: '03' });
    expect(filtered).toHaveLength(2);
    expect(filtered.every((rate) => rate.divisionCode === '03')).toBe(true);
  });

  it('filters by category', () => {
    const filtered = filterProductionRates(SAMPLE_RATES, {
      divisionCode: '03',
      category: 'Place Slab on Grade',
    });
    expect(filtered).toHaveLength(2);
  });

  it('filters by unit of measure', () => {
    const filtered = filterProductionRates(SAMPLE_RATES, { unitOfMeasure: 'CYD' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe('03-slab-001');
  });

  it('filters by figure', () => {
    const filtered = filterProductionRates(SAMPLE_RATES, { figure: 'Figure 5-C-14' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.figure).toBe('Figure 5-C-14');
  });

  it('filters by work element number', () => {
    const filtered = filterProductionRates(SAMPLE_RATES, { workElementNumber: '31 23 00.00' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.divisionCode).toBe('31');
  });

  it('keyword search matches description, activityName, and keywords', () => {
    expect(searchProductionRates(SAMPLE_RATES, 'slab')).toHaveLength(2);
    expect(searchProductionRates(SAMPLE_RATES, 'excavate')).toHaveLength(1);
    expect(searchProductionRates(SAMPLE_RATES, 'plumbing')).toHaveLength(1);
    expect(searchProductionRates(SAMPLE_RATES, 'pipe')).toHaveLength(1);
  });

  it('groups rates by division and category', () => {
    const grouped = groupRatesByDivisionAndCategory(SAMPLE_RATES);
    expect(grouped).toHaveLength(3);
    const concrete = grouped.find((group) => group.divisionCode === '03');
    expect(concrete?.categories).toHaveLength(1);
    expect(concrete?.categories[0]?.category).toBe('Place Slab on Grade');
    expect(concrete?.categories[0]?.rates).toHaveLength(2);
  });

  it('returns correct filtered count', () => {
    const filtered = filterProductionRates(SAMPLE_RATES, {
      divisionCode: '03',
      searchText: 'vapor',
    });
    expect(filtered).toHaveLength(1);
    expect(filterProductionRates(SAMPLE_RATES, EMPTY_PRODUCTION_RATE_LIBRARY_FILTERS)).toHaveLength(
      SAMPLE_RATES.length,
    );
  });

  it('clear filters returns all rates when filters are empty', () => {
    expect(hasActiveProductionRateFilters(EMPTY_PRODUCTION_RATE_LIBRARY_FILTERS)).toBe(false);
    expect(filterProductionRates(SAMPLE_RATES, EMPTY_PRODUCTION_RATE_LIBRARY_FILTERS)).toHaveLength(4);
  });

  it('narrows category and unit options based on active filters', () => {
    const categories = getAvailableCategories(SAMPLE_RATES, { divisionCode: '03' });
    expect(categories).toEqual(['Place Slab on Grade']);

    const units = getAvailableUnits(SAMPLE_RATES, { divisionCode: '03', category: 'Place Slab on Grade' });
    expect(units).toEqual(expect.arrayContaining(['CYD', 'SF']));

    const figures = getAvailableFigures(SAMPLE_RATES, { divisionCode: '31' });
    expect(figures).toEqual(['Figure 5-R-9']);
  });

  it('combines search text with structural filters', () => {
    const filtered = filterProductionRates(SAMPLE_RATES, {
      divisionCode: '03',
      searchText: 'slab',
      unitOfMeasure: 'CYD',
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe('03-slab-001');
  });
});
