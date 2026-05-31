import { describe, expect, it } from 'vitest';
import {
  buildProjectCodePrefix,
  buildProjectDisplayName,
  computeNextProjectNumber,
  parseProjectNumberFromName,
} from './projectNumbering';

describe('projectNumbering', () => {
  it('builds prefix from state and year', () => {
    expect(buildProjectCodePrefix('ga', new Date('2026-06-01'))).toBe('GA26-');
  });

  it('parses project number from name', () => {
    expect(parseProjectNumberFromName('GA26-201 Residential house foundation', 'GA26-')).toBe(
      201,
    );
    expect(parseProjectNumberFromName('Other project', 'GA26-')).toBeNull();
  });

  it('starts at 200 when no projects exist for the year', () => {
    expect(computeNextProjectNumber([], 'GA26-')).toBe(200);
  });

  it('increments globally across all states for the same year', () => {
    const names = ['GA26-200 First job', 'GA26-215 Second job', 'FL26-300 Other state'];
    expect(computeNextProjectNumber(names, 'GA26-')).toBe(301);
    expect(computeNextProjectNumber(names, 'GU26-')).toBe(301);
  });

  it('follows user example: after GA26-200, next is 201 in any state', () => {
    const names = ['ga26-200 Residential foundation'];
    expect(computeNextProjectNumber(names, 'GU26-')).toBe(201);
    expect(computeNextProjectNumber(['GU26-201 Guam job'], 'GA26-')).toBe(202);
  });

  it('does not count projects from a different year', () => {
    const names = ['GA26-250 Current year', 'GA25-999 Prior year'];
    expect(computeNextProjectNumber(names, 'GA26-')).toBe(251);
    expect(computeNextProjectNumber(names, 'GA25-')).toBe(1000);
  });

  it('builds full display name', () => {
    expect(buildProjectDisplayName('GA26-', 201, 'Residential house foundation')).toBe(
      'GA26-201 Residential house foundation',
    );
  });
});
