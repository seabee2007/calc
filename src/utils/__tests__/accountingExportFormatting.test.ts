import { describe, expect, it } from 'vitest';
import {
  exportCompanyInfoPairs,
  formatDateOnly,
  formatMoneyCsv,
  formatMoneyOrNotTracked,
  roundMoney,
  toAsciiExportText,
} from '../accountingExportFormatting';

describe('roundMoney / formatMoneyCsv', () => {
  it('rounds to two decimal places', () => {
    expect(formatMoneyCsv(1234.567)).toBe('1234.57');
    expect(formatMoneyCsv(100)).toBe('100.00');
  });

  it('handles non-finite values as zero', () => {
    expect(formatMoneyCsv(null)).toBe('0.00');
    expect(roundMoney(undefined)).toBe(0);
  });
});

describe('formatDateOnly', () => {
  it('returns YYYY-MM-DD from ISO timestamp', () => {
    expect(formatDateOnly('2025-04-01T00:00:00.000Z')).toBe('2025-04-01');
  });

  it('returns empty string for invalid dates', () => {
    expect(formatDateOnly('')).toBe('');
    expect(formatDateOnly('not-a-date')).toBe('');
  });
});

describe('toAsciiExportText', () => {
  it('replaces em/en dashes with hyphen', () => {
    expect(toAsciiExportText('— Direct Job Costs —')).toBe('- Direct Job Costs -');
  });
});

describe('formatMoneyOrNotTracked', () => {
  it('returns Not tracked only for null/undefined', () => {
    expect(formatMoneyOrNotTracked(null)).toBe('Not tracked');
    expect(formatMoneyOrNotTracked(undefined)).toBe('Not tracked');
    expect(formatMoneyOrNotTracked(0)).toBe('0.00');
  });
});

describe('exportCompanyInfoPairs', () => {
  it('includes non-empty company fields', () => {
    const pairs = exportCompanyInfoPairs({
      name: 'Acme Concrete',
      address: '123 Main St',
      phone: '555-0100',
    });
    expect(pairs).toEqual([
      ['Company Name', 'Acme Concrete'],
      ['Company Address', '123 Main St'],
      ['Company Phone', '555-0100'],
    ]);
  });
});
