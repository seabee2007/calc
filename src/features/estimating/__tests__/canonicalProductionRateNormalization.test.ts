import { describe, expect, it } from 'vitest';
import {
  extractDimensionTokens,
  jaccardSimilarity,
  normalizeForComparison,
  normalizeText,
  normalizeUnitKey,
} from '../data/productionRates/canonicalProductionRateNormalization';

describe('canonicalProductionRateNormalization', () => {
  it('normalizes unit synonyms to comparable keys', () => {
    expect(normalizeUnitKey('SF')).toBe('sf');
    expect(normalizeUnitKey('square foot')).toBe('sf');
    expect(normalizeUnitKey('SF of contact surface')).toBe('sf_contact');
    expect(normalizeUnitKey('CY')).toBe('cyd');
    expect(normalizeUnitKey('LF')).toBe('lf');
    expect(normalizeUnitKey('linear foot')).toBe('lf');
  });

  it('does not treat different normalized units as equal', () => {
    expect(normalizeUnitKey('SF')).not.toBe(normalizeUnitKey('CYD'));
  });

  it('extracts dimension tokens from descriptions', () => {
    const tokens = extractDimensionTokens('Beam and spandrel forms, 12-inch');
    expect(tokens.some((token) => token.includes('12'))).toBe(true);
  });

  it('strips leading verbs for comparison only', () => {
    const normalized = normalizeForComparison('Install weatherstripping, door sweep');
    expect(normalized).toContain('weatherstripping');
    expect(normalized.startsWith('install')).toBe(false);
  });

  it('computes jaccard similarity for near-duplicate descriptions', () => {
    const a = normalizeText('Weatherstripping, door sweep');
    const b = normalizeText('Weatherstripping, door sweep');
    expect(jaccardSimilarity(a, b)).toBe(1);
  });
});
