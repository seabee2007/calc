import { describe, expect, it } from 'vitest';
import { normalizeSuggestDivisionsResponse } from './suggestEstimateActivitiesFromScope';

describe('normalizeSuggestDivisionsResponse', () => {
  it('normalizes valid division suggestions and dedupes by division code', () => {
    const result = normalizeSuggestDivisionsResponse(
      {
        divisions: [
          {
            divisionCode: '03',
            divisionName: 'Concrete',
            confidence: 0.91,
            reason: 'Scope mentions concrete slab and footings.',
            sourceExcerpt: 'concrete slab and footings',
            suggestedWorkAreas: ['Slab on grade', 'Footings'],
          },
          {
            divisionCode: '03',
            divisionName: 'Concrete',
            confidence: 0.6,
            reason: 'Lower confidence duplicate.',
          },
          {
            divisionCode: '31',
            divisionName: 'Earthwork',
            confidence: 0.88,
            reason: 'Scope mentions excavation and grading.',
            suggestedWorkAreas: ['Excavation', 'Site grading'],
          },
          {
            divisionCode: '99',
            divisionName: 'Invalid',
            confidence: 0.95,
            reason: 'Should be ignored.',
          },
        ],
        warnings: ['Review suggestions carefully.'],
        fallbackUsed: true,
      },
      'Build office with excavation, concrete slab, and grading.',
    );

    expect(result.divisions).toHaveLength(2);
    expect(result.divisions[0]).toEqual(
      expect.objectContaining({
        divisionCode: '03',
        divisionName: 'Concrete',
        confidence: 'high',
        reason: 'Scope mentions concrete slab and footings.',
        suggestedWorkAreas: ['Slab on grade', 'Footings'],
        status: 'suggested',
      }),
    );
    expect(result.divisions[1]).toEqual(
      expect.objectContaining({
        divisionCode: '31',
        divisionName: 'Earthwork',
        confidence: 'high',
      }),
    );
    expect(result.warnings).toEqual(['Review suggestions carefully.']);
    expect(result.fallbackUsed).toBe(true);
  });

  it('returns empty divisions for invalid payloads', () => {
    const result = normalizeSuggestDivisionsResponse(null, 'Some scope text');
    expect(result.divisions).toEqual([]);
  });

  it('drops low-confidence divisions', () => {
    const result = normalizeSuggestDivisionsResponse(
      {
        divisions: [
          {
            divisionCode: '06',
            confidence: 0.4,
            reason: 'Below threshold.',
          },
        ],
      },
      'Wood framing project.',
    );

    expect(result.divisions).toEqual([]);
  });
});
