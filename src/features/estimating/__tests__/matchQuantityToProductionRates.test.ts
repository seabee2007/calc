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

  it('filters formwork labor candidates by operation before scoring unit-compatible Division 03 rates', () => {
    const result = matchQuantityToProductionRates(
      {
        divisionCode: '03',
        divisionName: 'Concrete',
        description: 'Slab edge forms, Interior Floor Slab',
        quantity: 374.19,
        unit: 'LF',
        usageRole: 'formwork_labor',
        quantityType: 'interior_floor_slab_volume',
        keywords: ['formwork', 'edge forms', 'Interior Floor Slab'],
      },
      [
        rate({
          id: 'sog-bulkhead-keyway',
          category: 'Concrete Formwork',
          subcategory: 'Slab on grade forms',
          activityName: 'Slab on grade, bulkhead forms with keyway, wood, 6 inches high, one use',
          description: 'Slab on grade, bulkhead forms with keyway, wood, 6 inches high, one use',
          unitOfMeasure: 'LF',
          manHoursPerUnit: 0.084,
          keywords: ['concrete', 'formwork', 'slab-on-grade', 'bulkhead-forms'],
        }),
        rate({
          id: 'sog-edge-forms-7-12',
          category: 'Concrete Formwork',
          subcategory: 'Slab on grade forms',
          activityName: 'Slab on grade, edge forms, wood, 7 to 12 inches high, one use',
          description: 'Slab on grade, edge forms, wood, 7 to 12 inches high, one use',
          unitOfMeasure: 'LF',
          manHoursPerUnit: 0.071,
          keywords: ['concrete', 'formwork', 'slab-on-grade', 'edge-forms'],
        }),
        rate({
          id: 'poured-expansion-joint',
          category: 'Concrete Joints, Curing & Accessories',
          subcategory: 'Expansion joints',
          activityName: 'Poured expansion joint, 1/2 inch wide',
          description: 'Poured expansion joint, 1/2 inch wide',
          unitOfMeasure: 'LF',
          manHoursPerUnit: 0.05,
          keywords: ['concrete', 'joint', 'expansion'],
        }),
        rate({
          id: 'saw-cut-control-joint',
          category: 'Concrete Joints, Curing & Accessories',
          subcategory: 'Saw cut control joints',
          activityName: 'Saw cut in green concrete',
          description: 'Saw cut in green concrete control joints',
          unitOfMeasure: 'LF',
          manHoursPerUnit: 0.02,
          keywords: ['concrete', 'joint', 'sawcut'],
        }),
      ],
    );

    if (result.status === 'excluded') {
      throw new Error(`Expected formwork candidates, got excluded: ${result.reason}`);
    }
    const candidateIds = result.candidates.map((candidate) => candidate.productionRateId);
    expect(candidateIds).toEqual(expect.arrayContaining(['sog-bulkhead-keyway', 'sog-edge-forms-7-12']));
    expect(candidateIds).not.toEqual(expect.arrayContaining(['poured-expansion-joint', 'saw-cut-control-joint']));
  });

  it('filters generic Design Builder labor candidates by usage context across divisions', () => {
    const result = matchQuantityToProductionRates(
      {
        divisionCode: '09',
        divisionName: 'Finishes',
        description: 'Infill plaster scratch coat area',
        quantity: 860,
        unit: 'SF',
        usageRole: 'primary_labor_driver',
        quantityType: 'infill_plaster_scratch_coat_area',
        keywords: ['plaster', 'scratch coat'],
      },
      [
        rate({
          id: 'plaster-scratch-coat',
          divisionCode: '09',
          divisionName: 'Finishes',
          figure: '09-24-00',
          figureTitle: 'Plastering and Stucco Production',
          category: 'Plaster & Stucco',
          subcategory: 'Scratch coat',
          activityName: 'Portland cement plaster, scratch coat',
          description: 'Portland cement plaster, scratch coat over masonry',
          unitOfMeasure: 'SF',
          manHoursPerUnit: 0.038,
          keywords: ['plaster', 'scratch coat', 'stucco'],
        }),
        rate({
          id: 'gypsum-board',
          divisionCode: '09',
          divisionName: 'Finishes',
          figure: '09-29-00',
          figureTitle: 'Gypsum Board Assemblies',
          category: 'Gypsum Board',
          subcategory: 'Wallboard',
          activityName: 'Gypsum wallboard, 5/8 inch',
          description: 'Gypsum wallboard, 5/8 inch',
          unitOfMeasure: 'SF',
          manHoursPerUnit: 0.021,
          keywords: ['gypsum', 'wallboard'],
        }),
        rate({
          id: 'acoustical-ceiling',
          divisionCode: '09',
          divisionName: 'Finishes',
          figure: '09-51-00',
          figureTitle: 'Acoustical Ceilings',
          category: 'Acoustical Ceilings',
          subcategory: 'Ceiling tile',
          activityName: 'Acoustical ceiling tile',
          description: 'Acoustical ceiling tile',
          unitOfMeasure: 'SF',
          manHoursPerUnit: 0.018,
          keywords: ['ceiling', 'tile'],
        }),
        rate({
          id: 'paint-finish-coat',
          divisionCode: '09',
          divisionName: 'Finishes',
          figure: '09-91-00',
          figureTitle: 'Painting',
          category: 'Painting',
          subcategory: 'Finish coat',
          activityName: 'Latex paint, finish coat',
          description: 'Latex paint, finish coat',
          unitOfMeasure: 'SF',
          manHoursPerUnit: 0.012,
          keywords: ['paint', 'finish coat'],
        }),
      ],
    );

    if (result.status === 'excluded') {
      throw new Error(`Expected plaster candidates, got excluded: ${result.reason}`);
    }
    const candidateIds = result.candidates.map((candidate) => candidate.productionRateId);
    expect(candidateIds).toEqual(['plaster-scratch-coat']);
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
