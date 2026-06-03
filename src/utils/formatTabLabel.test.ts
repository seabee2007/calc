import { describe, expect, it } from 'vitest';
import { formatTabLabel } from './formatTabLabel';

describe('formatTabLabel', () => {
  it('returns label only when count is missing or zero', () => {
    expect(formatTabLabel('Documents')).toBe('Documents');
    expect(formatTabLabel('Documents', undefined)).toBe('Documents');
    expect(formatTabLabel('Documents', 0)).toBe('Documents');
  });

  it('appends count in parentheses when positive', () => {
    expect(formatTabLabel('RFIs', 1)).toBe('RFIs (1)');
    expect(formatTabLabel('Change orders', 3)).toBe('Change orders (3)');
  });
});
