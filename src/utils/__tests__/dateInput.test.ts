import { describe, expect, it } from 'vitest';
import {
  isDateQuestionKey,
  normalizeDateInputValue,
  toDateInputValue,
} from '../dateInput';

describe('dateInput', () => {
  it('detects date question keys', () => {
    expect(isDateQuestionKey('reportDate')).toBe(true);
    expect(isDateQuestionKey('followUpDate')).toBe(true);
    expect(isDateQuestionKey('reportNumber')).toBe(false);
  });

  it('normalizes values to YYYY-MM-DD', () => {
    expect(toDateInputValue('2026-06-03')).toBe('2026-06-03');
    expect(toDateInputValue('June 3, 2026')).toBe('2026-06-03');
    expect(toDateInputValue('')).toBe('');
    expect(toDateInputValue(null)).toBe('');
  });

  it('keeps picker output as ISO date without timezone shift', () => {
    expect(normalizeDateInputValue('2026-06-14')).toBe('2026-06-14');
    expect(normalizeDateInputValue('')).toBe('');
  });
});
