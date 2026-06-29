import { describe, expect, it } from 'vitest';
import {
  areProductionRateUnitsCompatible,
  matchQuantityToProductionRates,
} from '../application/matchQuantityToProductionRates';
import type { ProductionRateLibraryEntry } from '../data/productionRates/productionRateTypes';

function rate(overrides: Partial<ProductionRateLibraryEntry> = {}): ProductionRateLibraryEntry {
  return {
    id: 'rate-1',
    divisionCode: '03',
    divisionName: 'Concrete',
    figure: '03-31-05',
    figureTitle: 'Concrete placement',
    sourcePage: '10',
    sourcePdfPage: 10,
    workElementNumber: '0010',
    workElementLineNumber: '0010',
    category: 'Concrete',
    subcategory: 'Placement',
    activityName: 'Place concrete in isolated footings',
    description: 'Place concrete in isolated footings',
    unitOfMeasure: 'CYD',
    manHoursPerUnit: 0.45,
    sourceDocumentFull: 'RSMeans Facilities Construction Cost Data' as ProductionRateLibraryEntry['sourceDocumentFull'],
    sourceEdition: '2026' as ProductionRateLibraryEntry['sourceEdition'],
    referenceNote: 'Figure 03-31-05',
    keywords: ['concrete', 'footing', 'place'],
    ...overrides,
  };
}

describe('matchQuantityToProductionRates', () => {
  it('excludes zero quantity rows before matching', () => {
    const result = matchQuantityToProductionRates(
      {
        divisionCode: '03',
        divisionName: 'Concrete',
        description: 'Concrete footings',
        quantity: 0,
        unit: 'CYD',
      },
      [rate()],
    );

    expect(result).toEqual({ status: 'excluded', reason: 'Zero quantity.' });
  });

  it('blocks auto-match when the unit dimension is incompatible', () => {
    const result = matchQuantityToProductionRates(
      {
        divisionCode: '03',
        divisionName: 'Concrete',
        description: 'Concrete footings',
        quantity: 20,
        unit: 'SF',
        keywords: ['concrete', 'footing'],
      },
      [rate()],
    );

    expect(result.status).toBe('review_required');
    if (result.status === 'review_required') {
      expect(result.issue).toContain('does not match');
      expect(result.candidates[0]?.unitCompatible).toBe(false);
    }
  });

  it('treats CY and CYD as compatible aliases', () => {
    expect(areProductionRateUnitsCompatible('CY', 'CYD')).toBe(true);

    const result = matchQuantityToProductionRates(
      {
        divisionCode: '03',
        divisionName: 'Concrete',
        description: 'Concrete isolated footing place concrete',
        quantity: 20,
        unit: 'CY',
        keywords: ['concrete', 'footing', 'place'],
      },
      [rate()],
    );

    expect(result.status).toBe('auto_matched');
    if (result.status === 'auto_matched') {
      expect(result.productionRateId).toBe('rate-1');
      expect(result.unitCompatible).toBe(true);
    }
  });

  it('requires same CSI division and positive MH/unit', () => {
    const result = matchQuantityToProductionRates(
      {
        divisionCode: '03',
        divisionName: 'Concrete',
        description: 'Concrete footings',
        quantity: 20,
        unit: 'CYD',
        keywords: ['concrete', 'footing'],
      },
      [
        rate({ id: 'wrong-division', divisionCode: '04', divisionName: 'Masonry' }),
        rate({ id: 'zero-rate', manHoursPerUnit: 0 }),
      ],
    );

    expect(result.status).toBe('review_required');
    if (result.status === 'review_required') {
      expect(result.candidates).toHaveLength(0);
      expect(result.issue).toContain('No approved Division 03 production rates');
    }
  });
});
