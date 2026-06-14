import { describe, expect, it } from 'vitest';
import type { ProductionRateLibraryEntry } from '../data/productionRates/productionRateTypes';
import {
  matchScopeSuggestionToProductionRates,
  pickDefaultScopeProductionRateMatch,
  getScopeProductionRateMatchStatus,
} from './matchScopeSuggestionToProductionRates';

const LIBRARY: ProductionRateLibraryEntry[] = [
  {
    id: '03-slab-001',
    divisionCode: '03',
    divisionName: 'Concrete',
    figure: 'Figure 5-C-14',
    figureTitle: 'Slab on Grade',
    sourcePage: '5-C-12',
    activityName: 'Place concrete, slab on grade, direct from chute',
    description: 'Place concrete, slab on grade, up to 6 inches thick',
    category: 'Place Slab on Grade',
    unitOfMeasure: 'CYD',
    manHoursPerUnit: 0.654,
    sourceDocumentFull: 'NTRP 4-04.2.3 / TM 3-34.41 / MCRP 3-40D.12',
    sourceEdition: 'October 2021, Change 1 October 2022',
    referenceNote: 'Reference rate',
    keywords: ['slab', 'concrete', 'placement'],
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
    category: 'Excavation',
    unitOfMeasure: 'Bank CYD',
    manHoursPerUnit: 0.18,
    sourceDocumentFull: 'NTRP 4-04.2.3 / TM 3-34.41 / MCRP 3-40D.12',
    sourceEdition: 'October 2021, Change 1 October 2022',
    referenceNote: 'Reference rate',
    keywords: ['excavate', 'earthwork', 'foundation'],
  },
  {
    id: '31-earth-002',
    divisionCode: '31',
    divisionName: 'Earthwork',
    figure: 'Figure 5-R-9',
    figureTitle: 'Excavation',
    sourcePage: '5-R-9',
    activityName: 'Machine excavating, 1/2 CYD excavator',
    description: 'Machine excavating',
    category: 'Excavation',
    unitOfMeasure: 'Bank CYD',
    manHoursPerUnit: 0.142,
    sourceDocumentFull: 'NTRP 4-04.2.3 / TM 3-34.41 / MCRP 3-40D.12',
    sourceEdition: 'October 2021, Change 1 October 2022',
    referenceNote: 'Reference rate',
    keywords: ['excavating', 'machine'],
  },
];

describe('matchScopeSuggestionToProductionRates', () => {
  it('matches excavation suggestions to Division 31 earthwork rates', () => {
    const matches = matchScopeSuggestionToProductionRates(
      {
        divisionCode: '31',
        activityTitle: 'Excavate for Foundation',
        sourceExcerpt: 'Excavate for foundation footings',
      },
      LIBRARY,
    );

    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every((match) => match.divisionCode === '31')).toBe(true);
    expect(matches[0].manHoursPerUnit).toBeGreaterThan(0);
    expect(matches.some((match) => /excavat/i.test(match.workElementName))).toBe(true);
  });

  it('does not match across divisions', () => {
    const matches = matchScopeSuggestionToProductionRates(
      {
        divisionCode: '31',
        activityTitle: 'Slab on Grade Concrete',
      },
      LIBRARY,
    );

    expect(matches.every((match) => match.divisionCode === '31')).toBe(true);
    expect(matches.some((match) => match.productionRateId === '03-slab-001')).toBe(false);
  });

  it('returns empty matches when library has no suitable rate', () => {
    const matches = matchScopeSuggestionToProductionRates(
      {
        divisionCode: '26',
        activityTitle: 'Electrical Rough-In',
      },
      LIBRARY,
    );

    expect(matches).toEqual([]);
    expect(getScopeProductionRateMatchStatus(matches, null)).toBe('none');
  });

  it('preselects a single strong match', () => {
    const matches = matchScopeSuggestionToProductionRates(
      {
        divisionCode: '03',
        activityTitle: 'Place Slab on Grade',
      },
      LIBRARY,
    );

    expect(pickDefaultScopeProductionRateMatch(matches)).toBe('03-slab-001');
  });
});
