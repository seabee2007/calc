import { describe, expect, it } from 'vitest';
import { formatRelativeTime } from '../formatRelativeTime';

describe('formatRelativeTime', () => {
  it('formats recent notifications', () => {
    const now = new Date('2026-06-14T12:00:00.000Z').getTime();
    expect(formatRelativeTime('2026-06-14T11:55:00.000Z', now)).toBe('5m ago');
    expect(formatRelativeTime('2026-06-14T10:00:00.000Z', now)).toBe('2h ago');
    expect(formatRelativeTime('2026-06-13T12:00:00.000Z', now)).toBe('1 day ago');
  });
});
