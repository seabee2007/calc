import { describe, expect, it } from 'vitest';
import { formatPlannerDisplayValue } from './plannerDocumentFormat';
import { formatDocDate } from './documentsPanelUtils';

describe('formatDocDate', () => {
  it('formats full ISO timestamps as friendly local calendar date', () => {
    const result = formatDocDate('2026-06-03T21:29:10.413433+00:00');
    expect(result).toMatch(/^Jun \d{1,2}, 2026$/);
  });

  it('formats date-only strings', () => {
    expect(formatDocDate('2026-06-04')).toBe('Jun 4, 2026');
  });

  it('returns em dash for missing or invalid dates', () => {
    expect(formatDocDate(undefined)).toBe('—');
    expect(formatDocDate('')).toBe('—');
    expect(formatDocDate('not-a-date')).toBe('—');
  });

  it('does not return raw ISO on parse failure', () => {
    const result = formatDocDate('2026-06-03T21:29:10.413433+00:00');
    expect(result).not.toContain('T21:29');
    expect(result).not.toContain('+00:00');
  });
});

describe('formatPlannerDisplayValue', () => {
  it('formats enum-like answer values for display', () => {
    expect(formatPlannerDisplayValue('not_completed')).toBe('Not Completed');
    expect(formatPlannerDisplayValue('6_months')).toBe('6 Months');
  });
});
