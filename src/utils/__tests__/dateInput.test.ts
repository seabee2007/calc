import { describe, expect, it } from 'vitest';
import {
  formatDateForDocument,
  isDateDocumentField,
  isDateQuestionKey,
  normalizeDateInputValue,
  normalizeDateValue,
  toDateInputValue,
} from '../dateInput';

describe('dateInput', () => {
  it('detects date question keys', () => {
    expect(isDateQuestionKey('reportDate')).toBe(true);
    expect(isDateQuestionKey('followUpDate')).toBe(true);
    expect(isDateQuestionKey('reportNumber')).toBe(false);
  });

  it('detects date document fields by type, key, or label', () => {
    expect(
      isDateDocumentField({
        questionKey: 'listDate',
        label: 'List date',
        type: 'date',
      }),
    ).toBe(true);
    expect(
      isDateDocumentField({
        questionKey: 'customField',
        label: 'Inspection date',
        type: 'text',
      }),
    ).toBe(true);
    expect(
      isDateDocumentField({
        questionKey: 'summary',
        label: 'Summary',
        type: 'text',
      }),
    ).toBe(false);
  });

  it('normalizes values to YYYY-MM-DD', () => {
    expect(toDateInputValue('2026-06-03')).toBe('2026-06-03');
    expect(toDateInputValue('June 3, 2026')).toBe('2026-06-03');
    expect(toDateInputValue('')).toBe('');
    expect(toDateInputValue(null)).toBe('');
    expect(normalizeDateValue('June 3, 2026')).toBe('2026-06-03');
    expect(normalizeDateValue('not-a-date')).toBe('not-a-date');
  });

  it('keeps picker output as ISO date without timezone shift', () => {
    expect(normalizeDateInputValue('2026-06-14')).toBe('2026-06-14');
    expect(normalizeDateInputValue('')).toBe('');
  });

  it('formats ISO dates for document display', () => {
    const formatted = formatDateForDocument('2026-06-03');
    expect(formatted).toMatch(/2026/);
    expect(formatted).toMatch(/June|6/);
    expect(formatDateForDocument('')).toBe('');
    expect(formatDateForDocument('TBD')).toBe('TBD');
  });
});
