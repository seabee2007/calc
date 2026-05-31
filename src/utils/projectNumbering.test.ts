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

  it('starts at 200 and increments within prefix', () => {
    const names = ['GA26-200 First job', 'GA26-215 Second job', 'FL26-300 Other state'];
    expect(computeNextProjectNumber(names, 'GA26-')).toBe(216);
    expect(computeNextProjectNumber([], 'GA26-')).toBe(200);
  });

  it('builds full display name', () => {
    expect(buildProjectDisplayName('GA26-', 201, 'Residential house foundation')).toBe(
      'GA26-201 Residential house foundation',
    );
  });
});
