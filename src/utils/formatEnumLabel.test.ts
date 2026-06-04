import { describe, expect, it } from 'vitest';
import { formatEnumLabel } from './formatEnumLabel';

describe('formatEnumLabel', () => {
  it('maps known enum values', () => {
    expect(formatEnumLabel('not_completed')).toBe('Not Completed');
    expect(formatEnumLabel('not_applicable')).toBe('Not Applicable');
    expect(formatEnumLabel('under_review')).toBe('Under Review');
    expect(formatEnumLabel('approved_as_noted')).toBe('Approved as Noted');
  });

  it('title-cases unknown snake_case values', () => {
    expect(formatEnumLabel('gross_receipts_tax')).toBe('Gross Receipts Tax');
    expect(formatEnumLabel('materials_and_equipment')).toBe('Materials and Equipment');
  });

  it('formats period-style values', () => {
    expect(formatEnumLabel('6_months')).toBe('6 Months');
    expect(formatEnumLabel('30_days')).toBe('30 Days');
    expect(formatEnumLabel('1_year')).toBe('1 Year');
  });

  it('returns em dash for empty values', () => {
    expect(formatEnumLabel(null)).toBe('—');
    expect(formatEnumLabel('')).toBe('—');
    expect(formatEnumLabel(undefined)).toBe('—');
  });

  it('preserves already human-readable strings', () => {
    expect(formatEnumLabel('Under Review')).toBe('Under Review');
    expect(formatEnumLabel('6 Months')).toBe('6 Months');
  });
});
